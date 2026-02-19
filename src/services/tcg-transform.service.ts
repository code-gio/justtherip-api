import type {
  TCGProduct,
  TransformedProduct,
  TCGPrice,
  TransformedPrice,
} from '../types/tcg.types.js';

/**
 * Transform a single TCG product from API format to database format.
 * Tolerates missing extendedData / presaleInfo from API.
 */
export function transformProduct(product: TCGProduct): TransformedProduct {
  const extendedData = product.extendedData ?? [];
  const extendedDataMap: Record<string, string> = {};
  extendedData.forEach((item) => {
    extendedDataMap[item.name] = item.value;
  });

  const presaleInfo = product.presaleInfo ?? {
    isPresale: false,
    releasedOn: null,
    note: null,
  };

  return {
    product_id: product.productId,
    name: product.name ?? '',
    clean_name: product.cleanName ?? product.name ?? '',
    image_url: product.imageUrl ?? '',
    category_id: product.categoryId,
    group_id: product.groupId,
    url: product.url ?? '',
    image_count: product.imageCount ?? 0,

    is_presale: presaleInfo.isPresale,
    presale_released_on: presaleInfo.releasedOn,
    presale_note: presaleInfo.note,

    rarity: extendedDataMap.Rarity ?? null,
    card_number: extendedDataMap.Number ?? null,
    sub_type: extendedDataMap.SubType ?? null,
    oracle_text: extendedDataMap.OracleText ?? null,
    power: extendedDataMap.P ?? null,
    toughness: extendedDataMap.T ?? null,

    extended_data: extendedData,

    modified_on: product.modifiedOn ?? new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Transform array of products
 */
export function transformProducts(
  products: TCGProduct[]
): TransformedProduct[] {
  return products.map(transformProduct);
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/**
 * Transform a single TCG price from API format to database format
 */
export function transformPrice(
  price: TCGPrice,
  asOfDate?: string
): TransformedPrice {
  return {
    product_id: price.productId,
    sub_type_name: price.subTypeName,
    low_price: price.lowPrice,
    mid_price: price.midPrice,
    high_price: price.highPrice,
    market_price: price.marketPrice,
    direct_low_price: price.directLowPrice,
    as_of_date: asOfDate ?? todayISO(),
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Transform array of prices
 */
export function transformPrices(
  prices: TCGPrice[],
  asOfDate?: string
): TransformedPrice[] {
  const date = asOfDate ?? todayISO();
  return prices.map((p) => transformPrice(p, date));
}
