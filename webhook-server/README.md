# FB Webhook Server

Express server that receives Facebook Lead Ads webhooks, fetches lead details from the Graph API, and exposes them for the CRM to poll.

## Local Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill values
3. `node server.js`
4. Test: `curl http://localhost:3000/health`

## Railway Deployment

Railway must run **Node** (`node server.js`), not Caddy/static. If deploy logs show Caddy on port 8080, the CRM frontend was deployed by mistake.

**Option A (recommended):** Service **Settings → Root Directory** = `webhook-server`  
**Config file path:** `/webhook-server/railway.json`  
**Start command:** leave empty (uses `npm start` → `node server.js`)

**Option B:** Root Directory = `/` (repo root)  
**Config file path:** `/railway.toml`  
**Start command:** `npm start --prefix webhook-server` (or `node server.js` via root [`server.js`](../server.js) shim)

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

Root `.env` sets `VITE_WEBHOOK_URL=https://crm-production-be3b.up.railway.app`. For local webhook testing, `.env.development` points to `http://localhost:3000` when you run `npm run dev`.
