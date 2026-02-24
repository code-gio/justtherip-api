import { config } from '../config/configuration.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { getCategoriesToSync, getGroups } from './tcg-catalog.service.js';
import { fetchJSON } from './tcg-fetcher.service.js';
import { transformProducts, transformPrices } from './tcg-transform.service.js';
import type {
  TCGApiResponse,
  TCGPriceApiResponse,
  TCGCategory,
  TCGGroup,
  TransformedProduct,
  TransformedPrice,
  SyncStats,
} from '../types/tcg.types.js';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Format Supabase/Postgres or Error for logging (avoids [object Object]). */
function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err != null && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    const o = err as { message: string; details?: string; code?: string };
    return [o.message, o.details, o.code].filter(Boolean).join(' | ');
  }
  return String(err);
}

/** Build product row for upsert. Pokemon table has different columns (card_type, hp, stage, etc.). */
function productRowForTable(
  product: TransformedProduct,
  table: string
): Record<string, unknown> {
  if (table === 'tcg_pokemon_products') {
    const ext = product.extended_data ?? [];
    const map: Record<string, string> = {};
    ext.forEach((item) => {
      map[item.name] = item.value;
    });
    const parseNum = (s: string | undefined): number | null => {
      if (s == null || s === '') return null;
      const n = parseInt(s.replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? null : n;
    };
    return {
      product_id: product.product_id,
      name: product.name,
      clean_name: product.clean_name,
      image_url: product.image_url || null,
      url: product.url || null,
      category_id: product.category_id,
      group_id: product.group_id,
      image_count: product.image_count,
      is_presale: product.is_presale,
      presale_released_on: product.presale_released_on ?? null,
      presale_note: product.presale_note ?? null,
      card_number: product.card_number ?? null,
      rarity: product.rarity ?? null,
      card_type: map['Type'] ?? map['Card Type'] ?? product.sub_type ?? null,
      hp: parseNum(map['HP']),
      stage: map['Stage'] ?? null,
      weakness: map['Weakness'] ?? null,
      resistance: map['Resistance'] ?? null,
      retreat_cost: parseNum(map['Retreat Cost']),
      card_text: map['Card Text'] ?? map['CardText'] ?? null,
      attacks: null,
      extended_data: ext.length ? ext : [],
      modified_on: product.modified_on ?? null,
      last_synced_at: product.last_synced_at,
      updated_at: new Date().toISOString(),
    };
  }
  return product as unknown as Record<string, unknown>;
}

async function upsertProductsBatch(
  table: string,
  products: TransformedProduct[]
): Promise<{ successCount: number; errorCount: number }> {
  const batchSize = config.tcg.productBatchSize;
  let successCount = 0;
  let errorCount = 0;
  const supabase = getSupabaseAdmin();

  for (let i = 0; i < products.length; i += batchSize) {
    const slice = products.slice(i, i + batchSize);
    const batch = slice.map((p) => productRowForTable(p, table));
    try {
      const { error } = await supabase.from(table).upsert(batch, {
        onConflict: 'product_id',
        ignoreDuplicates: false,
      });
      if (error) throw error;
      successCount += batch.length;
    } catch (err) {
      errorCount += batch.length;
      console.error(
        `[tcg-sync] Error upserting products batch to ${table}:`,
        formatErr(err)
      );
    }
  }
  return { successCount, errorCount };
}

async function upsertPricesBatch(
  table: string,
  prices: TransformedPrice[]
): Promise<{ successCount: number; errorCount: number }> {
  const batchSize = config.tcg.priceBatchSize;
  let successCount = 0;
  let errorCount = 0;
  const supabase = getSupabaseAdmin();

  for (let i = 0; i < prices.length; i += batchSize) {
    const batch = prices.slice(i, i + batchSize);
    try {
      const { error } = await supabase.from(table).upsert(batch, {
        onConflict: 'product_id,sub_type_name,as_of_date',
        ignoreDuplicates: false,
      });
      if (error) throw error;
      successCount += batch.length;
    } catch (err) {
      errorCount += batch.length;
      console.error(
        `[tcg-sync] Error upserting prices batch to ${table}:`,
        formatErr(err)
      );
    }
  }
  return { successCount, errorCount };
}

async function syncOneGroup(
  baseUrl: string,
  categoryId: number,
  group: TCGGroup,
  productTable: string,
  priceTable: string,
  stats: SyncStats
): Promise<void> {
  const productsUrl = `${baseUrl}/${categoryId}/${group.groupId}/products`;
  const pricesUrl = `${baseUrl}/${categoryId}/${group.groupId}/prices`;

  const [productsData, pricesData] = await Promise.all([
    fetchJSON<TCGApiResponse>(productsUrl),
    fetchJSON<TCGPriceApiResponse>(pricesUrl),
  ]);

  if (!productsData.success || !productsData.results) {
    stats.errors.push({
      type: 'products_fetch',
      error: productsData.errors?.join('; ') ?? 'Unknown',
      groupId: group.groupId,
      categoryId,
    });
    return;
  }
  if (!pricesData.success || !pricesData.results) {
    stats.errors.push({
      type: 'prices_fetch',
      error: pricesData.errors?.join('; ') ?? 'Unknown',
      groupId: group.groupId,
      categoryId,
    });
  }

  const products = transformProducts(productsData.results);
  const productResult = await upsertProductsBatch(productTable, products);
  stats.productsUpserted += productResult.successCount;
  if (productResult.errorCount > 0) {
    stats.errors.push({
      type: 'products_upsert',
      error: `Failed to upsert ${productResult.errorCount} products`,
      count: productResult.errorCount,
      groupId: group.groupId,
      categoryId,
    });
  }

  const priceRows =
    pricesData.results != null && Array.isArray(pricesData.results)
      ? transformPrices(pricesData.results)
      : [];
  if (priceRows.length > 0) {
    const priceResult = await upsertPricesBatch(priceTable, priceRows);
    stats.pricesUpserted += priceResult.successCount;
    if (priceResult.errorCount > 0) {
      stats.errors.push({
        type: 'prices_upsert',
        error: `Failed to upsert ${priceResult.errorCount} prices`,
        count: priceResult.errorCount,
        groupId: group.groupId,
        categoryId,
      });
    }
  }

  stats.groupsProcessed++;
  stats.totalItems += productsData.results.length;
}

const CATEGORY_TABLES: Record<
  string,
  { products: string; prices: string }
> = {
  Magic: { products: 'tcg_mtg_products', prices: 'tcg_mtg_prices' },
  Pokemon: { products: 'tcg_pokemon_products', prices: 'tcg_pokemon_prices' },
};

/**
 * Sync one category (e.g. Magic or Pokemon): resolve groups, process in batches with concurrency limit.
 */
export async function syncCategory(
  category: TCGCategory,
  productTable: string,
  priceTable: string,
  stats: SyncStats
): Promise<void> {
  const baseUrl = config.tcg.baseUrl.replace(/\/$/, '');
  const groups = await getGroups(category.categoryId);
  if (groups.length === 0) return;

  const limit = config.tcg.concurrencyLimit;
  const batches = chunk(groups, limit);

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((group) =>
        syncOneGroup(
          baseUrl,
          category.categoryId,
          group,
          productTable,
          priceTable,
          stats
        )
      )
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        const group = batch[i];
        stats.errors.push({
          type: 'group_failed',
          error: r.reason?.message ?? String(r.reason),
          groupId: group?.groupId,
          categoryId: category.categoryId,
        });
        console.error(
          `[tcg-sync] Group ${group?.groupId} (category ${category.categoryId}) failed:`,
          r.reason
        );
      }
    }
  }
}

export async function syncMTG(): Promise<SyncStats> {
  const categories = await getCategoriesToSync();
  const magic = categories.find(
    (c) => c.name.toLowerCase() === 'magic'
  );
  if (!magic) {
    console.warn('[tcg-sync] Magic category not found');
    return createEmptyStats();
  }
  const tables = CATEGORY_TABLES.Magic;
  const stats = createEmptyStats();
  await syncCategory(magic, tables.products, tables.prices, stats);
  stats.categoriesProcessed = 1;
  return stats;
}

export async function syncPokemon(): Promise<SyncStats> {
  const categories = await getCategoriesToSync();
  const pokemon = categories.find(
    (c) => c.name.toLowerCase() === 'pokemon'
  );
  if (!pokemon) {
    console.warn('[tcg-sync] Pokemon category not found');
    return createEmptyStats();
  }
  const tables = CATEGORY_TABLES.Pokemon;
  const stats = createEmptyStats();
  await syncCategory(pokemon, tables.products, tables.prices, stats);
  stats.categoriesProcessed = 1;
  return stats;
}

function createEmptyStats(): SyncStats {
  const now = new Date().toISOString();
  return {
    startTime: now,
    endTime: now,
    categoriesProcessed: 0,
    groupsProcessed: 0,
    endpointsProcessed: 0,
    totalItems: 0,
    productsUpserted: 0,
    pricesUpserted: 0,
    errors: [],
    durationMs: 0,
  };
}

function mergeStats(a: SyncStats, b: SyncStats): SyncStats {
  return {
    startTime: a.startTime,
    endTime: b.endTime,
    categoriesProcessed: a.categoriesProcessed + b.categoriesProcessed,
    groupsProcessed: a.groupsProcessed + b.groupsProcessed,
    endpointsProcessed: a.endpointsProcessed + b.endpointsProcessed,
    totalItems: a.totalItems + b.totalItems,
    productsUpserted: a.productsUpserted + b.productsUpserted,
    pricesUpserted: a.pricesUpserted + b.pricesUpserted,
    errors: [...a.errors, ...b.errors],
    durationMs: a.durationMs + b.durationMs,
  };
}

async function logSyncRun(stats: SyncStats): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('tcg_sync_logs').insert({
      run_at: new Date().toISOString(),
      endpoints_processed: stats.groupsProcessed,
      total_items: stats.totalItems,
      products_upserted: stats.productsUpserted,
      errors: stats.errors,
      duration_ms: stats.durationMs,
    });
  } catch (err) {
    console.error(
      '[tcg-sync] Error logging sync run:',
      formatErr(err)
    );
  }
}

/**
 * Main TCG daily sync: MTG then Pokemon. Single entry point for cron and run script.
 */
export async function syncTCGData(): Promise<SyncStats> {
  const startTime = Date.now();
  const startTimeISO = new Date().toISOString();
  console.log(`[tcg-sync] Sync started at ${startTimeISO}`);

  let mtgStats = createEmptyStats();
  mtgStats.startTime = startTimeISO;

  try {
    const [mtg, pokemon] = await Promise.all([
      syncMTG(),
      syncPokemon(),
    ]);
    mtgStats = mergeStats(mtg, pokemon);
  } catch (err) {
    const message = formatErr(err);
    console.error('[tcg-sync] Fatal error:', message);
    mtgStats.errors.push({ type: 'fatal', error: message });
  }

  mtgStats.endTime = new Date().toISOString();
  mtgStats.durationMs = Date.now() - startTime; // wall-clock duration, not sum of category durations

  await logSyncRun(mtgStats);

  console.log(`[tcg-sync] Sync completed in ${(mtgStats.durationMs / 1000).toFixed(2)}s`);
  console.log(`[tcg-sync] Categories: ${mtgStats.categoriesProcessed}, Groups: ${mtgStats.groupsProcessed}`);
  console.log(`[tcg-sync] Products upserted: ${mtgStats.productsUpserted}, Prices upserted: ${mtgStats.pricesUpserted}`);
  console.log(`[tcg-sync] Errors: ${mtgStats.errors.length}`);

  return mtgStats;
}
