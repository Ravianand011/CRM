# FB Webhook Server

Express server that receives Facebook Lead Ads webhooks, fetches lead details from the Graph API, and exposes them for the CRM to poll.

## Local Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill values
3. `node server.js`
4. Test: `curl http://localhost:3000/health`

## Railway Deployment

Railway must run **Node only** (no Caddy). If build logs show a `caddy` phase, Nixpacks is still building the Vite app — use the **Dockerfile** builder instead (configured in [`railway.json`](../railway.json)).

**Root Directory must be `/` (repository root)** — not `webhook-server`.  
Config file: `/railway.json` — builds root [`Dockerfile`](../Dockerfile) (CRM + webhook).

If you see `Cannot GET /`, Railway is using the API-only image (no `dist/`). Fix Root Directory and redeploy.

**Start command:** leave empty (Dockerfile `CMD` runs `node server.js`)  
**Do not** use Nixpacks if the plan still lists `caddy`.

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Apply Option A or B above
5. Add environment variables in Railway dashboard:
   - `VERIFY_TOKEN`
   - `FB_APP_SECRET`
   - `FB_PAGE_ACCESS_TOKEN`
6. Redeploy; deploy logs should show `Server started on port …` (not Caddy)
7. Public domain: `https://crm-production-be3b.up.railway.app`
8. Update Facebook Webhook Callback URL (see below)

> **Note:** `crm.railway.internal` is private Railway networking only. Facebook and your browser must use the **public** domain above, not `.railway.internal`.

## Facebook Webhook Setup

1. [developers.facebook.com](https://developers.facebook.com) → Your App → Webhooks
2. Select product: **Page**
3. Callback URL: `https://crm-production-be3b.up.railway.app/webhook`
4. Verify token: (same as `VERIFY_TOKEN` in Railway variables / `.env`)
5. Subscribe to field: **leadgen**
6. Save

## Test

```bash
curl https://crm-production-be3b.up.railway.app/health
curl -X POST https://crm-production-be3b.up.railway.app/test-lead
curl https://crm-production-be3b.up.railway.app/leads
```

## CRM Integration

On Railway, the CRM dashboard and webhook API share **https://crm-production-be3b.up.railway.app** (Dockerfile builds both). The app polls `/leads` on the same host.

For local `npm run dev`, `.env.development` points `VITE_WEBHOOK_URL` at Railway (or `.env.local` → `http://localhost:3000`).
