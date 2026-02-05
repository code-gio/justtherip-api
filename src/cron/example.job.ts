import { getHealth } from '../services/health.service.js';

export async function runExampleJob(): Promise<void> {
  const start = Date.now();
  console.log('[cron] example.job started');
  try {
    const health = getHealth();
    console.log('[cron] example.job health check:', health.status, health.timestamp);
  } catch (err) {
    console.error('[cron] example.job error:', err);
    throw err;
  } finally {
    console.log(`[cron] example.job finished in ${Date.now() - start}ms`);
  }
}
