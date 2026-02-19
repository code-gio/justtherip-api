import { syncTCGData } from '../services/tcg-sync.service.js';

/**
 * TCG daily cron job (20:30 UTC).
 * Syncs MTG + Pokemon products and prices from TCG CSV to tcg_mtg_* and tcg_pokemon_* tables.
 */
export async function runTcgDailyJob(): Promise<void> {
  const start = Date.now();
  console.log('[cron] tcg-daily.job started');

  try {
    await syncTCGData();
  } catch (err) {
    console.error('[cron] tcg-daily.job error:', err);
    throw err;
  } finally {
    console.log(
      `[cron] tcg-daily.job finished in ${Date.now() - start}ms`
    );
  }
}
