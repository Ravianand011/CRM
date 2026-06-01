# FB Webhook Server

Express server that receives Facebook Lead Ads webhooks, fetches lead details from the Graph API, and exposes them for the CRM to poll.

## Local Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill values
3. `node server.js`
4. Test: `curl http://localhost:3000/health`

## Railway Deployment

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Set **Root Directory** to `webhook-server`
5. Add environment variables in Railway dashboard:
   - `VERIFY_TOKEN`
   - `FB_APP_SECRET`
   - `FB_PAGE_ACCESS_TOKEN`
6. Railway auto-deploys; get URL from Settings → Networking → Generate Domain
7. Update Facebook Webhook Callback URL with Railway URL

## Facebook Webhook Setup

1. [developers.facebook.com](https://developers.facebook.com) → Your App → Webhooks
2. Select product: **Page**
3. Callback URL: `https://your-railway-url.up.railway.app/webhook`
4. Verify token: (same as `VERIFY_TOKEN` in `.env`)
5. Subscribe to field: **leadgen**
6. Save

## Test

```bash
curl -X POST https://your-railway-url.up.railway.app/test-lead
curl https://your-railway-url.up.railway.app/leads
```

## CRM Integration

Set `VITE_WEBHOOK_URL` in the CRM root `.env` to your Railway URL (or `http://localhost:3000` locally). The CRM polls `GET /leads` every 30 seconds.
