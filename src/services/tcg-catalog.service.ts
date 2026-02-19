import { config } from '../config/configuration.js';
import { fetchJSON } from './tcg-fetcher.service.js';
import type {
  TCGCategory,
  TCGGroup,
  TCGCatalogResponse,
} from '../types/tcg.types.js';

const baseUrl = (): string =>
  config.tcg.baseUrl.replace(/\/$/, '');

/**
 * Fetch all categories from TCGplayer API.
 */
export async function fetchCategories(): Promise<TCGCategory[]> {
  const url = `${baseUrl()}/categories`;
  const data = await fetchJSON<TCGCatalogResponse<TCGCategory>>(url);
  if (!data.success || !data.results) {
    throw new Error(data.errors?.join('; ') ?? 'Failed to fetch categories');
  }
  return data.results;
}

/**
 * Fetch categories to sync: resolve by name from config (e.g. "Magic", "Pokemon").
 * Does not use hardcoded category IDs.
 */
export async function getCategoriesToSync(): Promise<TCGCategory[]> {
  const all = await fetchCategories();
  const names = config.tcg.categoryNames;
  const nameSet = new Set(names.map((n) => n.toLowerCase()));
  const filtered = all.filter(
    (c) => nameSet.has(c.name.toLowerCase())
  );
  if (filtered.length === 0 && names.length > 0) {
    console.warn(
      `[tcg-catalog] No categories found for names: ${names.join(', ')}`
    );
  }
  return filtered;
}

/**
 * Fetch all categories (optionally filtered by config.categoryIds for backward compat).
 */
export async function getCategories(): Promise<TCGCategory[]> {
  const data = await fetchCategories();
  const categoryIds = config.tcg.categoryIds;
  if (categoryIds != null && categoryIds.length > 0) {
    const idSet = new Set(categoryIds);
    return data.filter((c) => idSet.has(c.categoryId));
  }
  return data;
}

/**
 * Fetch groups for a single category.
 */
export async function getGroups(categoryId: number): Promise<TCGGroup[]> {
  const url = `${baseUrl()}/${categoryId}/groups`;
  try {
    const data = await fetchJSON<TCGCatalogResponse<TCGGroup>>(url);
    if (!data.success || !data.results) {
      console.warn(
        `[tcg-catalog] Groups response not successful for category ${categoryId}:`,
        data.errors?.join('; ')
      );
      return [];
    }
    return data.results;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[tcg-catalog] Error fetching groups for category ${categoryId}:`,
      message
    );
    return [];
  }
}

/**
 * Resolve product endpoints from categories and groups.
 * Uses getCategories() (config filter). For daily sync use getCategoriesToSync() instead.
 */
export async function getProductEndpoints(): Promise<string[]> {
  const categories = await getCategories();
  const endpoints: string[] = [];
  for (const category of categories) {
    const groups = await getGroups(category.categoryId);
    for (const group of groups) {
      endpoints.push(
        `${baseUrl()}/${category.categoryId}/${group.groupId}/products`
      );
    }
  }
  return endpoints;
}
