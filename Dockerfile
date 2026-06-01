# Webhook API only — bypasses Nixpacks/Caddy (Vite static detection at repo root).
FROM node:18-alpine

WORKDIR /app

COPY webhook-server/package.json webhook-server/package-lock.json ./
RUN npm ci --omit=dev

COPY webhook-server/server.js ./

ENV NODE_ENV=production

CMD ["node", "server.js"]
