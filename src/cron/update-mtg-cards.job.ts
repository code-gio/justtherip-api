import { updateMtgCards } from '../services/mtg-cards.service.js';

export async function runUpdateMtgCardsJob(): Promise<void> {
  const start = Date.now();
  console.log('[cron] update-mtg-cards.job started');
  try {
    const result = await updateMtgCards();
    if (!result.success) {
      console.error('[cron] update-mtg-cards.job failed:', result.message, result.error);
      throw new Error(result.error ?? result.message);
    }
    console.log('[cron] update-mtg-cards.job completed:', result.message);
  } catch (err) {
    console.error('[cron] update-mtg-cards.job error:', err);
    throw err;
  } finally {
    console.log(`[cron] update-mtg-cards.job finished in ${Date.now() - start}ms`);
  }
}
