# ==============================================================================
# RYFT.io (PROJECT_ID = orb_arena_project) Production Multi-Stage Dockerfile
# Supports Google Cloud Run, Kubernetes, Fly.io, Railway, and Dedicated Servers
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build frontend Vite SPA + PWA bundle into /app/dist
COPY . .
RUN npm run build

# Production Runtime Image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src

# Create persistent data directory for accountStore ledger
RUN mkdir -p /app/.data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npx", "tsx", "server.ts"]
