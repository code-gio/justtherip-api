# App Structure & Coding Guide

This document describes the project layout and how to add and maintain API routes, services, cron jobs, and configuration in a consistent way.

---

## Folder Structure

```
justtherip-api/
├── src/
│   ├── config/
│   │   └── configuration.ts    # Env-based config (single source of truth)
│   ├── controllers/            # HTTP handlers: call services, send responses
│   │   ├── health.controller.ts
│   │   └── index.ts
│   ├── services/               # Business logic; used by controllers and cron
│   │   ├── health.service.ts
│   │   └── index.ts
│   ├── routes/                 # Express routers: map URLs to controllers
│   │   ├── health.routes.ts
│   │   └── index.ts
│   ├── cron/                   # Scheduled jobs: call services on a schedule
│   │   ├── scheduler.ts        # Registers all cron jobs
│   │   └── example.job.ts
│   ├── middleware/            # Express middleware (error, 404, requestId)
│   ├── app.ts                  # Express app setup (no listen)
│   ├── server.ts               # Entry: listen + optional cron start
│   └── cron-runner.ts          # Optional: run only cron in a separate process
├── swagger/
│   └── openapi.ts              # OpenAPI 3 spec for Swagger UI
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Request Flow

- **API:** `Route` → `Controller` → `Service` → response (or `next(err)`).
- **Cron:** `Scheduler` runs a job → job calls `Service`(s).
- **Config:** Only `configuration.ts` reads `process.env`; everyone else imports `config`.

Do not skip layers: routes do not call services directly; controllers do not contain business logic; cron jobs do not duplicate service logic.

---

## 1. Configuration

**File:** `src/config/configuration.ts`

- Read all env via `process.env` here; export a single typed `config` object.
- No business logic—only values and defaults.
- Add new keys (e.g. feature flags, external URLs) in this file; do not use `process.env` in controllers, services, or cron.

**Adding a new config value:**

1. Add the key to the `config` object in `configuration.ts`.
2. Use `config.yourKey` wherever needed; never `process.env` outside this file.

**API base path:** Default is `/v1` (version only). When the host is `api.domain.com`, do not use `/api` in the path—set `API_BASE_PATH=/v1` so URLs are e.g. `https://api.domain.com/v1/health`. Override with `API_BASE_PATH` in `.env` if you need a different prefix.

---

## 2. Adding a New API Route

You add a **route** + **controller** + **service** (and optionally Swagger). One domain = one route file, one controller, one service.

### Step 1: Service

**Path:** `src/services/<domain>.service.ts`

- Holds all business logic for that domain.
- Receives plain arguments; returns plain data (or throws).
- No `req`, `res`, or Express types.

**Example:** `src/services/users.service.ts`

```ts
export function getUserById(id: string): { id: string; name: string } {
  // logic only
  return { id, name: 'Example' };
}
```

- Export from `src/services/index.ts` if you want a single barrel.

### Step 2: Controller

**Path:** `src/controllers/<domain>.controller.ts`

- Handles one (or a few) HTTP actions: parse params/query/body, call service(s), set status + `res.json()`, or `next(err)`.
- Keep it thin: no business logic, no direct DB or external calls.

**Example:** `src/controllers/users.controller.ts`

```ts
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../services/users.service.js';

export function getUserByIdHandler(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params;
    const user = getUserById(id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}
```

- Export from `src/controllers/index.ts` if you use a barrel.

### Step 3: Route

**Path:** `src/routes/<domain>.routes.ts`

- Create a `Router()`, define method + path, and call the controller.
- No logic—only wiring.

**Example:** `src/routes/users.routes.ts`

```ts
import { Router } from 'express';
import { getUserByIdHandler } from '../controllers/users.controller.js';

const router = Router();
router.get('/users/:id', getUserByIdHandler);
export default router;
```

### Step 4: Mount the route

**File:** `src/routes/index.ts`

- Import the new router and `router.use(yourRoutes)`.

```ts
import usersRoutes from './users.routes.js';
// ...
router.use(usersRoutes);
```

### Step 5: Swagger (optional)

**File:** `swagger/openapi.ts`

- Add the path and method under `paths`, with summary, parameters, and responses, so the new route appears in Swagger UI.

---

## 3. Adding a New Cron Job

### Step 1: Job file

**Path:** `src/cron/<name>.job.ts`

- Export a single function (e.g. `runXxxJob()`) that performs the work.
- Inside, only call **services**; no HTTP, no route logic.
- Log start/end/errors; handle errors (log and rethrow so the scheduler can log).

**Example:** `src/cron/daily-cleanup.job.ts`

```ts
import { someCleanupService } from '../services/cleanup.service.js';

export async function runDailyCleanupJob(): Promise<void> {
  const start = Date.now();
  console.log('[cron] daily-cleanup.job started');
  try {
    await someCleanupService();
  } catch (err) {
    console.error('[cron] daily-cleanup.job error:', err);
    throw err;
  } finally {
    console.log(`[cron] daily-cleanup.job finished in ${Date.now() - start}ms`);
  }
}
```

### Step 2: Register in the scheduler

**File:** `src/cron/scheduler.ts`

- Import the job function.
- Call `cron.schedule(schedule, fn, { timezone: config.cron.timezone })` with the desired cron expression.

**Example:**

```ts
import { runDailyCleanupJob } from './daily-cleanup.job.js';

// Inside startCron():
cron.schedule(
  '0 2 * * *',  // daily at 02:00
  () => {
    runDailyCleanupJob().catch((err) => {
      console.error('[cron] Unhandled job error:', err);
    });
  },
  { timezone: config.cron.timezone }
);
```

- Use `config.cron.enabled` and `config.cron.timezone` from `configuration.ts`; do not read env in the scheduler or jobs.

---

## 4. Middleware

**Path:** `src/middleware/`

- **errorHandler:** Catches `next(err)`, logs (e.g. for 5xx), responds with status + JSON.
- **notFound:** Sends 404 when no route matches (mounted after all routes).
- **requestId:** Adds/forwards `x-request-id` for tracing.

Add new middleware here and mount it in `app.ts` in the right order: routes first, then notFound, then errorHandler.

---

## 5. Conventions Summary

| Rule | Description |
|------|--------------|
| **Layers** | Routes → Controllers → Services. Cron → Services. No skipping. |
| **Config** | All env in `configuration.ts`; rest of app uses `config` only. |
| **Naming** | `users.routes.ts`, `users.controller.ts`, `users.service.ts` for the same domain; cron: `<purpose>.job.ts`. |
| **Imports** | Use `.js` extension in relative imports (e.g. `from './app.js'`) for Node/TS output. |
| **Errors** | Controllers: `try/catch` and `next(err)`. Jobs: log and rethrow; scheduler `.catch()` for unhandled errors. |
| **Barrels** | Optional `index.ts` in controllers/services for cleaner imports. |
| **Swagger** | Keep `swagger/openapi.ts` in sync when adding or changing API routes. |

---

## 6. Scripts

- **Development:** `npm run dev` (runs API + cron in one process via `tsx`).
- **Production:** `npm run build` then `npm start`.
- **Cron only (separate process):** `npm run cron` (uses `cron-runner.ts`).

Use these entry points; do not run `node` on `.ts` files directly—use `tsx` for dev or run compiled `dist/` for production.
