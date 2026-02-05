import 'dotenv/config';
import { config } from './config/configuration.js';
import { startCron } from './cron/scheduler.js';

if (!config.cron.enabled) {
  console.log('Cron is disabled (CRON_ENABLED=false). Exiting.');
  process.exit(0);
}

console.log('Starting cron runner (standalone process)');
startCron();
console.log(`Cron timezone: ${config.cron.timezone}`);
console.log('Cron runner is active. Press Ctrl+C to exit.');
