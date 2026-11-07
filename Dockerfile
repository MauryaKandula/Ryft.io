# RYFT.io — Render-compatible Node.js + Colyseus deployment.
# Install dependencies once. Reinstalling tsx in the runtime image previously
# caused the Render build to fail during "npm install --omit=dev && npm install tsx".
FROM node:22-alpine AS builder
WORKDIR /app

# npm resolves at least one dependency through Git; Alpine does not ship git.
RUN apk add --no-cache git ca-certificates

COPY package.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Use the exact dependencies that successfully built the project.
# tsx is a devDependency but is needed to run the TypeScript server.
# TODO: compile server.ts to JS and prune dev dependencies for a lean production image.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# AccountStore currently writes to /app/data, NOT /app/.data.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/api/health || exit 1

CMD ["./node_modules/.bin/tsx", "server.ts"]
