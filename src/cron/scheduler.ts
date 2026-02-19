import cron from 'node-cron';
import { config } from '../config/configuration.js';
import { runTcgDailyJob } from './tcg-daily.job.js';
import { runUpdateMtgCardsJob } from './update-mtg-cards.job.js';

export function startCron(): void {
  if (!config.cron.enabled) return;

  cron.schedule(
    config.cron.mtgCardsSchedule,
    () => {
      runUpdateMtgCardsJob().catch((err) => {
        console.error('[cron] Unhandled job error:', err);
      });
    },
    { timezone: config.cron.timezone }
  );

  cron.schedule(
    config.cron.tcgDailySchedule,
    () => {
      runTcgDailyJob().catch((err) => {
        console.error('[cron] Unhandled tcg-daily.job error:', err);
      });
    },
    { timezone: config.cron.timezone }
  );
}
