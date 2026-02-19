/**
 * Run the TCG daily sync (MTG + Pokemon products and prices -> tcg_mtg_* / tcg_pokemon_* tables).
 * Usage: npm run tcg:sync  or  npm run cron:tcg  or  npx tsx scripts/run-tcg-sync.ts
 */
import 'dotenv/config';
import { syncTCGData } from '../src/services/tcg-sync.service.js';

console.log('Running TCG daily sync (MTG + Pokemon)...');

syncTCGData()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Job failed:', err);
    process.exit(1);
  });
