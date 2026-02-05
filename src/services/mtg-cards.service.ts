import { getSupabaseAdmin } from '../lib/supabase.js';

interface ScryfallBulkData {
  object: string;
  id: string;
  type: string;
  name: string;
  description: string;
  download_uri: string;
  updated_at: string;
  size: number;
  content_type: string;
  content_encoding: string;
}

interface ScryfallBulkDataResponse {
  object: string;
  has_more: boolean;
  data: ScryfallBulkData[];
}

export interface UpdateMtgCardsResult {
  success: boolean;
  message: string;
  defaultCardsData?: ScryfallBulkData;
  cardsDataFetched?: boolean;
  cardsCount?: number;
  cardsProcessed?: number;
  batchesProcessed?: number;
  newCards?: number;
  updatedCards?: number;
  errorCards?: number;
  error?: string;
}

interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string | null;
  cmc?: number | null;
  type_line?: string | null;
  oracle_text?: string | null;
  power?: string | null;
  toughness?: string | null;
  colors?: string[] | null;
  color_identity?: string[] | null;
  rarity?: string | null;
  set?: string | null;
  set_name?: string | null;
  collector_number?: string | null;
  artist?: string | null;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  } | null;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  } | null;
  legalities?: {
    [format: string]: string;
  } | null;
  released_at?: string | null;
  [key: string]: unknown;
}

interface ProcessStats {
  new: number;
  updated: number;
  errors: number;
}

const CHUNK_SIZE = 1000;

function mapScryfallCardToDb(card: ScryfallCard) {
  let releasedAt: Date | null = null;
  if (card.released_at) {
    releasedAt = new Date(card.released_at as string);
    if (isNaN(releasedAt.getTime())) {
      releasedAt = null;
    }
  }

  return {
    card_id: card.id,
    name: card.name,
    mana_cost: card.mana_cost || null,
    cmc: card.cmc ?? null,
    type_line: card.type_line || null,
    oracle_text: card.oracle_text || null,
    power: card.power || null,
    toughness: card.toughness || null,
    colors:
      card.colors && Array.isArray(card.colors) && card.colors.length > 0
        ? card.colors
        : null,
    color_identity:
      card.color_identity &&
      Array.isArray(card.color_identity) &&
      card.color_identity.length > 0
        ? card.color_identity
        : null,
    rarity: card.rarity || null,
    set_code: card.set || null,
    set_name: card.set_name || null,
    collector_number: card.collector_number || null,
    artist: card.artist || null,
    image_uri: card.image_uris ? card.image_uris : null,
    prices: card.prices || null,
    legalities: card.legalities || null,
    released_at: releasedAt,
    updated_at: new Date().toISOString(),
  };
}

async function processCardsChunk(
  chunk: ScryfallCard[],
  batchNumber: number
): Promise<ProcessStats> {
  const stats: ProcessStats = {
    new: 0,
    updated: 0,
    errors: 0,
  };

  const client = getSupabaseAdmin();

  try {
    const dbCards = chunk
      .map((card) => {
        try {
          return mapScryfallCardToDb(card);
        } catch (error) {
          console.error(
            `Error mapping card ${card.id} (${card.name}):`,
            error
          );
          stats.errors++;
          return null;
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (dbCards.length === 0) {
      return stats;
    }

    const cardIds = dbCards.map((card) => card.card_id);
    // Query in sub-batches to avoid URL length limit (PostgREST/Supabase)
    const ID_CHUNK_SIZE = 100;
    const existingCardIds = new Set<string>();
    for (let i = 0; i < cardIds.length; i += ID_CHUNK_SIZE) {
      const idChunk = cardIds.slice(i, i + ID_CHUNK_SIZE);
      const { data: existingChunk, error: fetchError } = await client
        .from('mtg_cards')
        .select('card_id')
        .in('card_id', idChunk);

      if (fetchError) {
        const err = fetchError as { message?: string; code?: string; details?: string; hint?: string };
        console.error(
          `Error fetching existing cards for batch ${batchNumber}:`,
          JSON.stringify({ message: err.message, code: err.code, details: err.details, hint: err.hint })
        );
      } else {
        existingChunk?.forEach((row) => existingCardIds.add(row.card_id));
      }
    }

    dbCards.forEach((card) => {
      if (existingCardIds.has(card.card_id)) {
        stats.updated++;
      } else {
        stats.new++;
      }
    });

    const { error } = await client.from('mtg_cards').upsert(dbCards, {
      onConflict: 'card_id',
      ignoreDuplicates: false,
    });

    if (error) {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      console.error(
        `Error upserting batch ${batchNumber}:`,
        JSON.stringify({ message: err.message, code: err.code, details: err.details, hint: err.hint })
      );
      stats.errors += dbCards.length;
      throw error;
    }

    if (batchNumber % 10 === 0 || batchNumber === 1) {
      console.log(
        `Batch ${batchNumber}: ${dbCards.length} cards processed (${stats.new} new, ${stats.updated} updated)`
      );
    }
  } catch (error) {
    console.error(`Error processing batch ${batchNumber}:`, error);
    stats.errors += chunk.length;
  }

  return stats;
}

/**
 * Update MTG cards from Scryfall bulk data API.
 * Fetches the "Default Cards" dataset and upserts into mtg_cards.
 */
export async function updateMtgCards(): Promise<UpdateMtgCardsResult> {
  try {
    const response = await fetch('https://api.scryfall.com/bulk-data');

    if (!response.ok) {
      return {
        success: false,
        message: 'Failed to fetch bulk data from Scryfall',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as ScryfallBulkDataResponse;

    if (!data.data || !Array.isArray(data.data)) {
      return {
        success: false,
        message: 'Invalid response format from Scryfall API',
        error: 'Response data is not an array',
      };
    }

    const defaultCards = data.data.find((item) => item.name === 'Default Cards');

    if (!defaultCards) {
      return {
        success: false,
        message: "Default Cards dataset not found in bulk data",
        error: "Could not locate 'Default Cards' in the bulk data list",
      };
    }

    console.log(`Fetching cards data from: ${defaultCards.download_uri}`);
    const cardsResponse = await fetch(defaultCards.download_uri);

    if (!cardsResponse.ok) {
      return {
        success: false,
        message: 'Failed to fetch cards data from download URI',
        error: `HTTP ${cardsResponse.status}: ${cardsResponse.statusText}`,
        defaultCardsData: defaultCards,
      };
    }

    const responseText = await cardsResponse.text();
    const cardsData: ScryfallCard[] = JSON.parse(responseText);

    if (!Array.isArray(cardsData)) {
      return {
        success: false,
        message: 'Invalid cards data format',
        error: 'Cards data is not an array',
        defaultCardsData: defaultCards,
        cardsDataFetched: false,
      };
    }

    const totalCards = cardsData.length;
    console.log(`Fetched ${totalCards} cards. Processing in chunks...`);

    let cardsProcessed = 0;
    let batchesProcessed = 0;
    const stats: ProcessStats = {
      new: 0,
      updated: 0,
      errors: 0,
    };

    for (let i = 0; i < cardsData.length; i += CHUNK_SIZE) {
      const chunk = cardsData.slice(i, i + CHUNK_SIZE);
      batchesProcessed++;

      const chunkStats = await processCardsChunk(chunk, batchesProcessed);
      stats.new += chunkStats.new;
      stats.updated += chunkStats.updated;
      stats.errors += chunkStats.errors;

      cardsProcessed += chunk.length;

      if (batchesProcessed % 10 === 0) {
        const progress = ((cardsProcessed / totalCards) * 100).toFixed(1);
        console.log(
          `Processed ${cardsProcessed}/${totalCards} cards (${progress}%) - ${batchesProcessed} batches | New: ${stats.new}, Updated: ${stats.updated}, Errors: ${stats.errors}`
        );
      }
    }

    console.log(
      `Completed processing ${cardsProcessed} cards in ${batchesProcessed} batches`
    );
    console.log(
      `Stats: ${stats.new} new, ${stats.updated} updated, ${stats.errors} errors`
    );

    return {
      success: true,
      message: `Successfully processed ${cardsProcessed} cards in ${batchesProcessed} batches`,
      defaultCardsData: defaultCards,
      cardsDataFetched: true,
      cardsCount: totalCards,
      cardsProcessed,
      batchesProcessed,
      newCards: stats.new,
      updatedCards: stats.updated,
      errorCards: stats.errors,
    };
  } catch (error) {
    console.error('Error updating MTG cards:', error);
    return {
      success: false,
      message: 'Error updating MTG cards',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
