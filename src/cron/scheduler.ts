import cron from 'node-cron';
import { config } from '../config/configuration.js';
import { runExampleJob } from './example.job.js';
import { runUpdateMtgCardsJob } from './update-mtg-cards.job.js';

export function startCron(): void {
  if (!config.cron.enabled) return;

  cron.schedule(
    '0 * * * *',
    () => {
      runExampleJob().catch((err) => {
        console.error('[cron] Unhandled job error:', err);
      });
    },
    { timezone: config.cron.timezone }
  );

  cron.schedule(
    config.cron.mtgCardsSchedule,
    () => {
      runUpdateMtgCardsJob().catch((err) => {
        console.error('[cron] Unhandled job error:', err);
      });
    },
    { timezone: config.cron.timezone }
  );
}
