import app from './app.js';
import { config } from './config/configuration.js';
import { startCron } from './cron/scheduler.js';

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  if (config.swagger.enabled) {
    console.log(`Swagger UI: http://localhost:${config.port}${config.swagger.path}`);
  }
  if (config.cron.enabled) {
    startCron();
    console.log('Cron scheduler started');
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Try: PORT=${config.port + 1} npm run dev`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

export default server;
