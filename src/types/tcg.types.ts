export interface TCGCatalogResponse<T> {
  totalItems: number;
  success: boolean;
  errors: string[];
  results: T[];
}

export interface TCGCategory {
  categoryId: number;
  name: string;
  displayName: string;
  modifiedOn: string;
  seoCategoryName?: string;
  categoryDescription?: string | null;
  popularity?: number;
  isDirect?: boolean;
}

export interface TCGGroup {
  groupId: number;
  name: string;
  abbreviation: string;
  categoryId: number;
  modifiedOn: string;
  isSupplemental?: boolean;
  publishedOn?: string | null;
}

export interface TCGProduct {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string;
  categoryId: number;
  groupId: number;
  url: string;
  modifiedOn: string;
  imageCount: number;
  presaleInfo: {
    isPresale: boolean;
    releasedOn: string | null;
    note: string | null;
  };
  extendedData: Array<{
    name: string;
    displayName: string;
    value: string;
  }>;
}

export interface TCGApiResponse {
  totalItems: number;
  success: boolean;
  errors: string[];
  results: TCGProduct[];
}

export interface TransformedProduct {
  product_id: number;
  name: string;
  clean_name: string;
  image_url: string;
  category_id: number;
  group_id: number;
  url: string;
  image_count: number;
  is_presale: boolean;
  presale_released_on: string | null;
  presale_note: string | null;
  rarity: string | null;
  card_number: string | null;
  sub_type: string | null;
  oracle_text: string | null;
  power: string | null;
  toughness: string | null;
  extended_data: Array<{
    name: string;
    displayName: string;
    value: string;
  }>;
  modified_on: string;
  last_synced_at: string;
}

export interface TCGPrice {
  productId: number;
  subTypeName: string;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
}

export interface TCGPriceApiResponse {
  totalItems?: number;
  success: boolean;
  errors: string[];
  results: TCGPrice[];
}

export interface TransformedPrice {
  product_id: number;
  sub_type_name: string;
  low_price: number | null;
  mid_price: number | null;
  high_price: number | null;
  market_price: number | null;
  direct_low_price: number | null;
  as_of_date: string;
  last_synced_at: string;
}

export interface SyncStats {
  startTime: string;
  endTime: string;
  categoriesProcessed: number;
  groupsProcessed: number;
  endpointsProcessed: number;
  totalItems: number;
  productsUpserted: number;
  pricesUpserted: number;
  errors: Array<{
    url?: string;
    type?: string;
    error: string;
    count?: number;
    groupId?: number;
    categoryId?: number;
  }>;
  durationMs: number;
}
