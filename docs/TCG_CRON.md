# TCG Daily Cron Job

This document describes the TCG (Trading Card Game) daily cron job that syncs **Magic: The Gathering** and **Pokémon** product and price data from [TCG CSV](https://tcgcsv.com) into Postgres (Supabase).

---

## Purpose

- Ingest product catalog and daily price snapshots for **MTG** and **Pokémon** from the TCG CSV JSON API.
- Write to four tables: `tcg_mtg_products`, `tcg_mtg_prices`, `tcg_pokemon_products`, `tcg_pokemon_prices`.
- Run once per day (default **20:30 UTC**) so data is refreshed after TCG CSV’s typical update window (~20:00 UTC).

---

## Schedule

- **Default:** `30 20 * * *` (20:30 UTC every day).
- **Config:** `CRON_TCG_DAILY_SCHEDULE` in `.env` (cron expression).
- **Timezone:** Uses `CRON_TIMEZONE` (default `UTC`).

The job is registered in `src/cron/scheduler.ts` and implemented in `src/cron/tcg-daily.job.ts`.

---

## High-Level Flow

1. **Resolve categories by name**  
   Fetch `GET https://tcgcsv.com/tcgplayer/categories` and select categories whose `name` is `"Magic"` or `"Pokemon"` (no hardcoded IDs).

2. **Fetch groups per category**  
   For each category, `GET .../categories/{categoryId}/groups` and keep group IDs in memory.

3. **Process groups in batches**  
   For each group (in batches of up to `TCG_CONCURRENCY_LIMIT`, default 10):
   - **Fetch products:** `GET .../{categoryId}/{groupId}/products`
   - **Fetch prices:** `GET .../{categoryId}/{groupId}/prices`
   - **Transform** products and prices to DB row shape (with `as_of_date` for prices).
   - **Upsert products** to the correct products table (MTG or Pokémon).
   - **Upsert prices** to the correct prices table (MTG or Pokémon).

4. **Fail isolation**  
   If one group fails, the job logs the error and continues with the rest. Results are aggregated in stats and written to `tcg_sync_logs`.

---

## Data Written

| Target Table              | Content |
|---------------------------|--------|
| `tcg_mtg_products`        | MTG products (including `oracle_text`, `power`, `toughness`). Upsert key: `product_id`. |
| `tcg_mtg_prices`          | MTG daily price snapshots. Upsert key: `(product_id, sub_type_name, as_of_date)`. |
| `tcg_pokemon_products`    | Pokémon products (no MTG-only columns). Upsert key: `product_id`. |
| `tcg_pokemon_prices`      | Pokémon daily price snapshots. Upsert key: `(product_id, sub_type_name, as_of_date)`. |

- **Products:** Batched upserts; batch size from `TCG_PRODUCT_BATCH_SIZE` (default 200).
- **Prices:** Batched upserts; batch size from `TCG_PRICE_BATCH_SIZE` (default 1000).  
  `as_of_date` is set to the run date; re-running the same day is idempotent.

---

## Concurrency and Resilience

- **Concurrency:** Groups are processed in chunks of `TCG_CONCURRENCY_LIMIT` (default 10) using `Promise.allSettled`, so one failing group does not stop others.
- **Retry:** The shared fetcher (`src/services/tcg-fetcher.service.ts`) retries each request up to 3 times with exponential backoff on HTTP 429 or 5xx.
- **Timeout:** HTTP requests use `TCG_REQUEST_TIMEOUT` (default 30 seconds).

---

## Configuration (Environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_TCG_DAILY_SCHEDULE` | `30 20 * * *` | Cron expression (20:30 UTC). |
| `TCG_BASE_URL` | `https://tcgcsv.com/tcgplayer` | TCG CSV API base URL. |
| `TCG_CATEGORY_NAMES` | `Magic,Pokemon` | Comma-separated category names to sync. |
| `TCG_REQUEST_TIMEOUT` | `30000` | HTTP timeout in ms. |
| `TCG_PRODUCT_BATCH_SIZE` | `200` | Rows per product upsert batch (reduce if DB times out). |
| `TCG_PRICE_BATCH_SIZE` | `1000` | Rows per price upsert batch. |
| `TCG_CONCURRENCY_LIMIT` | `10` | Max concurrent groups processed at once. |

Supabase is configured via `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## How to Run

**As cron (scheduler):**

```bash
npm run cron
```

The TCG job runs at the configured time (e.g. 20:30 UTC).

**One-off sync (no cron):**

```bash
npm run tcg:sync
# or
npm run cron:tcg
```

**Catalog-only (no DB writes):**

```bash
npm run tcg:catalog
```

Lists categories to sync (by name) and their group counts.

---

## Logging and Observability

- **Console:** Start/end time, groups processed, products and prices upserted, error count. Per-batch and per-group errors are logged with readable messages (Supabase/Postgres errors are formatted, not `[object Object]`).
- **Persisted:** Each run writes a row to `tcg_sync_logs` with `run_at`, `endpoints_processed` (groups), `total_items`, `products_upserted`, `prices_upserted`, `errors`, `duration_ms`.

---

## Main Code References

| Area | File(s) |
|------|---------|
| Cron entry | `src/cron/tcg-daily.job.ts`, `src/cron/scheduler.ts` |
| Sync orchestration | `src/services/tcg-sync.service.ts` (`syncTCGData`, `syncMTG`, `syncPokemon`, `syncCategory`) |
| Catalog (categories/groups) | `src/services/tcg-catalog.service.ts` (`getCategoriesToSync`, `getGroups`) |
| HTTP + retry | `src/services/tcg-fetcher.service.ts` (`fetchJSON`) |
| Transform (API → DB rows) | `src/services/tcg-transform.service.ts` (`transformProducts`, `transformPrices`) |
| Config | `src/config/configuration.ts` (under `cron.tcgDailySchedule`, `tcg.*`) |
| One-off script | `src/run-tcg-sync.ts` |

---

## Idempotency

- **Products:** Upsert on `product_id`; re-running updates existing rows.
- **Prices:** Upsert on `(product_id, sub_type_name, as_of_date)` with `as_of_date` set to the run date; running again the same day updates the same snapshot.

Running the job multiple times per day does not create duplicate product or price rows for that day.
