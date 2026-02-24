# API Authentication

## Endpoints that do NOT require auth

- `GET /v1/health` — health check
- `GET /v1/rips/bundles` — list Rip bundles (public)
- `POST /v1/stripe/webhook` — Stripe webhook (validated by signature)

Use these to confirm the API is up. Example:

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/rips/bundles
```

## Endpoints that require auth

All other endpoints expect a valid **Supabase JWT** in the request.

### 1. Set `SUPABASE_JWT_SECRET` in the API `.env`

The token you send is correct: **`session.access_token`** from your SvelteKit/frontend is the right JWT. The API validates that JWT using a **secret**. That secret must be the same one Supabase uses to sign the token.

**Where to get it (same Supabase project as your frontend):**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and open **the same project** your frontend uses.
2. Left sidebar → **Project Settings** (gear icon).
3. In the menu, click **API**.
4. Scroll down to the **JWT Settings** section (below "Project API keys").
5. There you see **JWT Secret** (a long string). Click **Reveal** and copy it.

**Important:** Use **JWT Secret**, not:
- **anon** (public) key  
- **service_role** key  

Those are different and will not verify the user's `access_token`.

6. In your **API** project (justtherip-api) `.env`:

```env
SUPABASE_JWT_SECRET=el-secreto-que-copiaste-del-dashboard
```

7. Restart the API server.

If this is missing or wrong, every authenticated request will return `401 Unauthorized`.

### 2. Send the token in the request

Use the **access_token** from your Supabase Auth session:

**Option A – From your frontend (Svelte/React, etc.):**

```ts
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;
// Then send in API calls:
headers: { Authorization: `Bearer ${accessToken}` }
```

**Option B – From curl (for testing):**

1. Get a token: sign in via your app and read `session.access_token` from the Supabase client (e.g. in DevTools or a small script that calls `supabase.auth.signInWithPassword()` and logs the token).
2. Or use Supabase Auth REST API to sign in and copy the `access_token` from the response.

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" http://localhost:3000/v1/rips/balance
```

### 3. 401 response hints

The API returns a `hint` in the JSON body when auth fails:

- **"Missing Authorization: Bearer <token> header"** — add the header with a valid Supabase access token.
- **"Invalid or expired token, or SUPABASE_JWT_SECRET mismatch..."** — check that:
  - `SUPABASE_JWT_SECRET` in `.env` matches the JWT Secret in Supabase Dashboard.
  - The token is the **access_token** from `getSession()`, not the anon key or another value.
  - The token has not expired (refresh the session if needed).

## Admin endpoints

Routes under `/v1/admin/*` require auth **and** that the user is an admin. The backend checks `profiles.role === 'admin'` or `profiles.is_admin === true`. If the user is not admin, the response is **403 Forbidden**.
