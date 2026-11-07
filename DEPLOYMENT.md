# RYFT.io (`PROJECT_ID = 'orb_arena_project'`) — Production Deployment & Mobile Packaging Guide

> **Architecture Note:** Never deploy RYFT.io purely to a static website host (e.g., GitHub Pages or static-only S3) expecting multiplayer to work on its own. Real-time `.io` combat, server-authoritative hit validation, Capture the Orb magnetic tether physics, and persistent accounts require the Node.js + Express + Colyseus WebSocket server (`server.ts`) running on port `3000` (or reverse-proxied behind HTTPS/WSS on port `443`).

---

## 15-Step Production Deployment Guide (Local → Cloud Run → Custom Domain → Mobile)

### Step 1: Export Project from Google AI Studio
Download the project ZIP from Google AI Studio or sync directly to a private GitHub repository. Verify that `package.json`, `server.ts`, `Dockerfile`, and `.env.example` are present at the root.

### Step 2: Local Installation & Environment Setup
```bash
npm install
cp .env.example .env
```
Edit `.env` to configure optional OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`) and `ADMIN_TOKEN`.

### Step 3: Local Verification & Automated Multiplayer Test Suite
Run the automated 7-suite multiplayer, anti-cheat, OAuth, and store idempotency test runner before deploying:
```bash
npm run lint
npx tsx tests/multiplayer.test.ts
npm run dev
```
Open `http://localhost:3000` and verify `http://localhost:3000/api/health` returns `"status": "ok"`.

### Step 4: Production Bundle Compilation
Build the optimized Vite SPA and Workbox Service Worker PWA assets into `dist/`:
```bash
npm run build
```

### Step 5: Hosting Architecture Selection (Google Cloud Run vs. Dedicated Match Servers)
- **Option A — Google Cloud Run (Recommended for 1–10 rooms / auto-scaling):**
  - Supports concurrent WebSockets up to 3600s timeout per connection.
  - Enable `--session-affinity` and `--min-instances=1` so active rooms stay warm.
  - The client (`src/network/colyseusClient.ts`) automatically reconnects and re-syncs if a Cloud Run container recycles.
- **Option B — Dedicated Long-Lived Match Servers (Fly.io / Railway / AWS ECS / Bare-Metal VPS):**
  - Recommended when scaling beyond a single stateful container or when using Redis Presence (`@colyseus/redis-presence` + `@colyseus/redis-driver`) across multiple regional match nodes.

### Step 6: Deploy Authoritative Server to Google Cloud Run
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

gcloud run deploy ryft-io-server \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 3000 \
  --session-affinity \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PROJECT_ID=orb_arena_project,APP_URL=https://game.example.com"
```

### Step 7: Persistent Account & Ledger Storage Configuration
By default, `src/server/accountStore.ts` persists accounts, OAuth links, match records, receipts, and audit logs to `.data/orb_arena_project_store.json`.
- On **Google Cloud Run**, mount a Cloud Storage FUSE volume or Cloud SQL / Firestore adapter at `/app/.data` so container restarts preserve player accounts across deployments.
- On a **Dedicated VPS / Docker Host**, mount a persistent volume:
  ```bash
  docker run -d -p 3000:3000 -v ryft_data:/app/.data --env-file .env ryft-io
  ```

### Step 8: Purchasing & Mapping a Custom Domain (`game.example.com`)
1. Purchase your domain (e.g., `game.example.com`) via Google Domains / Cloudflare / Namecheap.
2. In Google Cloud Run → **Manage Custom Domains** → Map `game.example.com` to `ryft-io-server`.
3. Add the provided `A` / `AAAA` or `CNAME` DNS records at your DNS registrar.

### Step 9: SSL/TLS & Secure WebSocket (`wss://`) Configuration
Google Cloud Run and Cloudflare automatically provision managed Let's Encrypt / Google Trust Services TLS certificates.
- Ensure `src/network/colyseusClient.ts` connects via `wss://game.example.com` when the page is loaded over `https://` (already handled automatically by protocol detection in `colyseusClient.ts`).

### Step 10: OAuth 2.0 Production Redirect URIs (Google & Facebook)
Register the exact callback URLs in your OAuth provider consoles:
- **Google Cloud Console (APIs & Services → Credentials → OAuth 2.0 Client IDs):**
  - `https://ais-dev-vs7wamwosirvot7kqsbio7-348257724109.asia-northeast1.run.app/auth/google/callback`
  - `https://ais-pre-vs7wamwosirvot7kqsbio7-348257724109.asia-northeast1.run.app/auth/google/callback`
  - `https://game.example.com/auth/google/callback`
- **Meta for Developers (Facebook Login → Settings → Valid OAuth Redirect URIs):**
  - `https://ais-dev-vs7wamwosirvot7kqsbio7-348257724109.asia-northeast1.run.app/auth/facebook/callback`
  - `https://ais-pre-vs7wamwosirvot7kqsbio7-348257724109.asia-northeast1.run.app/auth/facebook/callback`
  - `https://game.example.com/auth/facebook/callback`

### Step 11: Payment & Ad Network Production Verification
- In-game Killpoint (KP) cosmetic and ship unlocks work out of the box with server-side idempotency (`POST /api/store/purchase`) and restoration (`POST /api/store/restore`).
- Optional Sponsored Broadcast rewards (`REWARDED_AD`) are strictly opt-in from the Cosmetic Store and **never** interrupt active combat.
- Do not insert test/fabricated AdSense or AdMob publisher IDs in production; configure real IDs only after publisher domain approval.

### Step 12: Android Native Packaging (Capacitor `.aab` / `.apk`)
1. Build the production web bundle:
   ```bash
   npm run build
   ```
2. Add and sync Capacitor Android (requires `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`):
   ```bash
   npx cap add android
   npx cap sync android
   npx cap open android
   ```
3. In Android Studio:
   - Set screen orientation to `sensorLandscape` in `AndroidManifest.xml`.
   - Generate a signed Upload Keystore (`keytool -genkey -v -keystore ryft-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ryft`).
   - Select **Build → Generate Signed Bundle / APK → Android App Bundle (`.aab`)** for Google Play Console upload.

### Step 13: iOS Native Packaging (Capacitor Xcode `.ipa`)
1. On macOS with Xcode 15+ installed:
   ```bash
   npm run build
   npx cap add ios
   npx cap sync ios
   npx cap open ios
   ```
2. In Xcode:
   - Select the `App` target → **Signing & Capabilities** → select your Apple Developer Team and Bundle Identifier (`com.ryftio.spacearena`).
   - Under **Deployment Info**, check **Landscape Left** and **Landscape Right** (uncheck Portrait).
   - Select **Product → Archive** and distribute to **App Store Connect / TestFlight**.

### Step 14: Live Telemetry, Health Checks & Admin Monitoring
- Monitor container health via `GET https://game.example.com/api/health`.
- Monitor concurrent human players, active Colyseus rooms, mode popularity, store receipts, refunds, and safety reports via the in-game **📊 SERVER TELEMETRY & REVENUE** modal (`GET /api/admin/metrics`).

### Step 15: Rollback & Incident Recovery Procedure
- **Cloud Run Instant Traffic Rollback:**
  ```bash
  gcloud run revisions list --service ryft-io-server --region asia-northeast1
  gcloud run services update-traffic ryft-io-server --to-revisions PREVIOUS_REVISION_NAME=100 --region asia-northeast1
  ```
- **Git Checkpoint Rollback:**
  Every major upgrade maintains clean TypeScript compilation and test verification (`npx tsx tests/multiplayer.test.ts`).
