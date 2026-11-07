# RYFT.io (`PROJECT_ID = 'orb_arena_project'`) — Security & Anti-Cheat Architecture

## 1. Server-Authoritative Multiplayer Simulation (`src/server/FleetIoRoom.ts`)
Clients never dictate authoritative game state. The Colyseus room server runs a 20Hz authoritative simulation loop (`50ms` tick) and validates:
- **Movement & Speed Clamping:** Clients transmit normalized steering/thrust vectors (`vx`, `vy`, `angle`, `boosting`). The server clamps input vectors (`Math.hypot(vx, vy) <= 1.0`) and integrates ship velocity using server-side ship blueprint speed limits and boost energy availability.
- **Weapon Cooldowns & Energy Validation:** `fireCannons` and `fireMissile` are validated against server timestamps (`cannonCooldown`, `missileCharge`) and energy reserves before spawning authoritative projectiles.
- **Authoritative Hit Detection & Kill Attribution:** Projectile-to-ship, projectile-to-asteroid, and projectile-to-mothership collisions are computed on the server. Clients cannot forge damage packets or self-award kills.
- **Capture the Orb & Magnetic Tether Validation:** In `capture_orb` mode, the Quantum Orb's spring-damper magnetic tether, carrier transfer on ship destruction, and friendly Mothership capture zone scoring (`+1` team score and `500` orbital mega-beam damage) are computed exclusively on the server.
- **Timed Dogfight & Survival Progression:** Match countdown timers (`matchRemainingSec = 300` in `dogfight`), `.io` plasma orb pickups, and 3-Tier starfighter evolution (`Scout` → `Interceptor` → `Heavy Frigate`) are server-controlled.

## 2. Network Flood & Input Rate Limiting
- **WebSocket Message Rate Limiter:** Each client session in `FleetIoRoom.ts` is tracked with a per-second message counter (`windowStart`, `count`). Exceeding `90 messages/sec` drops excess packets and logs a rate-limit warning without crashing the room.
- **REST API Rate Limiter:** `server.ts` enforces a per-IP sliding window rate limit (`120 requests / 10 seconds`) on all `/api/*` routes, returning `HTTP 429 Too Many Requests` on abuse.
- **Payload Size Caps:** `express.json({ limit: '64kb' })` prevents oversized JSON body DoS attacks.

## 3. Authentication, OAuth 2.0 & Account Linking Safety (`src/server/accountStore.ts`)
- **Opaque Bearer Session Tokens:** Sessions use 256-bit cryptographically random tokens (`crypto.randomBytes(24).toString('hex')`) with 30-day sliding expiration.
- **Safe Account Linking:** Guest accounts can upgrade to Google OAuth, Facebook OAuth, or Callsign/Password accounts by passing their active `linkSessionToken`. Accounts are **never** silently merged solely on matching email addresses without authenticated session ownership.
- **Salted Password Hashing:** Optional password authentication uses per-account random 128-bit salts with SHA-256 verification (`hashPassword` / `verifyPassword`).
- **Callsign Moderation & Sanitization:** `sanitizeCallsign()` strips control characters, enforces length limits (`2–18` characters), and filters profanity or reserved impersonation terms (`admin`, `moderator`, `sysop`) down to safe pilot handles (`Pilot-XXXX`).

## 4. Economy Integrity, Idempotent Purchases & Refund Revocation
- **Idempotent Store Transactions:** `POST /api/store/purchase` requires a unique `transactionId`. Duplicate submissions of the same `transactionId` return the existing receipt with `duplicate: true` and never double-deduct Killpoints or double-grant rewards.
- **Server-Side Price Lookup:** Item costs are looked up from `src/game/catalog.ts` on the server; client-supplied prices are ignored.
- **Purchase Restoration & Refund Revocation:**
  - `POST /api/store/restore` re-applies all `completed` receipts to the player's inventory.
  - `POST /api/admin/refund` marks a transaction as `refunded`, revokes the item from `unlockedShips` / `unlockedWeapons` / `unlockedCosmetics`, and logs an immutable entry in `auditLogs`.

## 5. GDPR / CCPA Privacy Controls
- **Self-Service Data Export:** Authenticated players can download a complete JSON archive of their profile, receipts, and match history via `GET /api/account/export` (available in the **ACCOUNT, EXPORT & OAUTH** modal tab).
- **Self-Service Account Deletion:** Authenticated players can permanently erase their account, OAuth bindings, and session tokens via `DELETE /api/account`.
