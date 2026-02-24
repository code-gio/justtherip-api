/// <reference types="node" />
import 'dotenv/config';

function parseCategoryIds(envValue: string | undefined): number[] | undefined {
  if (envValue == null || envValue.trim() === '') return undefined;
  const ids = envValue
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return ids.length > 0 ? ids : undefined;
}

function parseCategoryNames(envValue: string | undefined): string[] {
  if (envValue == null || envValue.trim() === '') return ['Magic', 'Pokemon'];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiBasePath: process.env.API_BASE_PATH ?? '/v1',
  cron: {
    enabled: process.env.CRON_ENABLED !== 'false',
    timezone: process.env.CRON_TIMEZONE ?? 'UTC',
    mtgCardsSchedule: process.env.CRON_MTG_CARDS_SCHEDULE ?? '0 3 * * *',
    tcgDailySchedule:
      process.env.CRON_TCG_DAILY_SCHEDULE ?? '30 20 * * *',
  },
  tcg: {
    baseUrl:
      process.env.TCG_BASE_URL ?? 'https://tcgcsv.com/tcgplayer',
    categoryIds: parseCategoryIds(process.env.TCG_CATEGORY_IDS),
    categoryNames: parseCategoryNames(process.env.TCG_CATEGORY_NAMES),
    requestTimeout: parseInt(
      process.env.TCG_REQUEST_TIMEOUT ?? '30000',
      10
    ),
    productBatchSize: parseInt(
      process.env.TCG_PRODUCT_BATCH_SIZE ?? '200',
      10
    ),
    priceBatchSize: parseInt(
      process.env.TCG_PRICE_BATCH_SIZE ?? '1000',
      10
    ),
    concurrencyLimit: parseInt(
      process.env.TCG_CONCURRENCY_LIMIT ?? '10',
      10
    ),
  },
  supabase: {
    url: process.env.PUBLIC_SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  },
  cronApiSecret: process.env.CRON_API_SECRET ?? '',
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    path: process.env.SWAGGER_PATH ?? '/api-docs',
  },
} as const;

export type Config = typeof config;
