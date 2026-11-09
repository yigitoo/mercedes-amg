# AMG Pulse: Next.js + WebSocket (server.mts) üretim imajı.
#   docker build -t amg-pulse .
#   docker run -p 3000:3000 --env-file .env amg-pulse
# VPS kurulumu için deploy/README.md (docker compose + Caddy).

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- bağımlılıklar + build ------------------------------------------------------------------------------------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# --- yalnız çalışma zamanı bağımlılıkları ---------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- çalışma zamanı -------------------------------------------------------------------------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
# opengraph-image.tsx fontları çalışma anında buradan okur.
COPY --from=build /app/brand/fonts ./brand/fonts
COPY package.json next.config.ts server.mts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.mts"]
