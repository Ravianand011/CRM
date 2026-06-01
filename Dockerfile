# Stage 1: Build CRM dashboard (Vite)
FROM node:18-alpine AS crm-build

WORKDIR /crm

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public

# Empty = poll /leads on same host as the dashboard (Railway)
ARG VITE_WEBHOOK_URL=
ENV VITE_WEBHOOK_URL=${VITE_WEBHOOK_URL}

RUN npm run build

# Stage 2: Webhook API + static CRM
FROM node:18-alpine

WORKDIR /app

COPY webhook-server/package.json webhook-server/package-lock.json ./
RUN npm ci --omit=dev

COPY webhook-server/server.js ./
COPY --from=crm-build /crm/dist ./dist

RUN test -f dist/index.html || (echo "ERROR: CRM dist/index.html missing" && exit 1)

ENV NODE_ENV=production

CMD ["node", "server.js"]
