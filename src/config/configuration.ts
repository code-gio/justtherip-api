import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiBasePath: process.env.API_BASE_PATH ?? '/v1',
  cron: {
    enabled: process.env.CRON_ENABLED !== 'false',
    timezone: process.env.CRON_TIMEZONE ?? 'UTC',
    mtgCardsSchedule: process.env.CRON_MTG_CARDS_SCHEDULE ?? '0 3 * * *',
  },
  supabase: {
    url: process.env.PUBLIC_SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    path: process.env.SWAGGER_PATH ?? '/api-docs',
  },
} as const;

export type Config = typeof config;
