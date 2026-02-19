/**
 * Test the TCG catalog service (categories by name, groups, product endpoints).
 * Does not call Supabase or run the full sync.
 * Usage: npm run tcg:catalog  or  npx tsx scripts/run-tcg-catalog.ts
 */
import 'dotenv/config';
import {
  getCategories,
  getCategoriesToSync,
  getGroups,
  getProductEndpoints,
} from '../src/services/tcg-catalog.service.js';

async function main() {
  console.log('--- TCG Catalog test ---\n');

  try {
    const categoriesToSync = await getCategoriesToSync();
    console.log(`Categories to sync (by name): ${categoriesToSync.length}`);
    for (const c of categoriesToSync) {
      const groups = await getGroups(c.categoryId);
      console.log(`  ${c.categoryId}: ${c.name} — ${groups.length} groups`);
    }

    const categories = await getCategories();
    console.log(`\nAll categories (filtered by config): ${categories.length}`);
    if (categories.length > 0) {
      console.log('Sample (first 5):');
      categories.slice(0, 5).forEach((c) => {
        console.log(`  ${c.categoryId}: ${c.displayName ?? c.name}`);
      });
    }

    console.log('\nResolving product endpoints...');
    const endpoints = await getProductEndpoints();
    console.log(`Product endpoints: ${endpoints.length}`);
    if (endpoints.length > 0) {
      console.log('Sample (first 5):');
      endpoints.slice(0, 5).forEach((url) => console.log(`  ${url}`));
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}

main();
