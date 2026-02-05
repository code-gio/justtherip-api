/**
 * One-off script to run the MTG cards update job (for testing).
 * Usage: npm run cron:mtg  or  npx tsx src/run-mtg-job.ts
 */
import 'dotenv/config';
import { runUpdateMtgCardsJob } from './cron/update-mtg-cards.job.js';

runUpdateMtgCardsJob()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Job failed:', err);
    process.exit(1);
  });
