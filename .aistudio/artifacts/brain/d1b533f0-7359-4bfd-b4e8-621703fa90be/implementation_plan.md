# Fleet.io — Server-Authoritative Multiplayer Space .io Architecture & Phased Plan

Transform the existing *Pocket Fleet*-inspired browser space dogfighter into **Fleet.io**, an original, production-ready multiplayer `.io` web and installable PWA game powered by a server-authoritative **Node.js + Colyseus** backend, **Agar/Starblast `.io` energy orb progression & automatic ship tier evolution**, and a **strictly cosmetic-only monetization & rewarded ad loop**, while preserving 100% of existing working controls, visuals, screen-shake, tactical minimap, floating damage numbers, persistent exhaust particles, and progressive shield break mechanics.

## User Review & Critical Decisions

> [!IMPORTANT]
> All architectural and gameplay preferences from our codebase audit and clarification step are locked in below. Review the phased implementation plan and click **Proceed** to begin execution.

- **Confirmed Decision 1 — Strict Online Colyseus Server-Authoritative Rooms**: Replace client-authoritative `PLAYER_SYNC` state trusts with authoritative **Colyseus** (`colyseus`, `@colyseus/ws-transport`, `@colyseus/schema`, `colyseus.js`) game rooms supporting 10–20 players per room (dynamically filled with server-simulated AI pilots so rooms are always active), 20Hz network state synchronization over a 60Hz authoritative physics/combat tick, server-side collision and damage validation, anti-cheat input clamping, and 30-second session reconnection tokens.
- **Confirmed Decision 2 — Agar/Starblast `.io` Energy Orbs + Live Mass Leaderboard + Ship Tier Evolution**: Scatter collectible glowing Plasma/Energy Orbs across the 3000×2000 sector grid. Collecting orbs and eliminating enemy ships awards `.io` Mass/XP, drives a live **Top-10 Sector Mass Leaderboard**, triggers automatic in-flight **Ship Tier Evolution** (*Tier I Scout → Tier II Hunter → Tier III Heavy Frigate*) with passive stat/weapon upgrades, and bursts a high-value cluster of loot orbs when any ship is destroyed.
- **Confirmed Decision 3 — Cosmetic Skins, Trail Colors & Shield Effects Store + Simulated Rewarded Ad Bonus**: Add a dedicated **Fleet.io Cosmetic Store** in the Hangar/Menu for unlocking hull paint skins, engine exhaust particle trail palettes, and hexagonal shield aura styles using earned KP/Cosmetic Credits, alongside an optional **"Watch Ad (+500 Cosmetic Credits)"** simulated 5-second rewarded ad flow accessible only in menus/hangar (strictly zero pay-to-win stats and zero ads during active combat).

---

## 1. Overview & Core Concept

- **What It Does**: Evolves the existing 60fps HTML5 Canvas 2D space dogfighter into a scalable `.io` multiplayer arena where players drop into live sector rooms via instant guest matchmaking or room codes, harvest Plasma Orbs, dogfight rival pilots, evolve their starfighter hull across three tiers in real time, and compete for the `#1 Crown` on the live sector leaderboard.
- **Target Audience / Persona**: Browser `.io` action gamers (*Agar.io*, *Starblast.io*, *Diep.io* fans) and *Pocket Fleet* veterans across desktop and mobile browsers/PWAs.
- **Key Value**: Combines responsive zero-gravity momentum dogfighting (mouse cursor steering, keyboard flight, virtual touch diamond throttle, and gyroscope tilt) with cheat-resistant server-authoritative Colyseus networking and instant `.io` drop-in progression.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Instant Guest `.io` Matchmaking & Multi-Room Browser**: From the **Fleet.io** main menu, players enter a pilot callsign, choose a faction (*Incorruptus*, *Omnitron*, *Aerie*), and click **Quick Join `.io` Sector** (auto-matchmaking into a Colyseus room with <20 pilots) or pick a specific room from the live multi-room directory / `?room=` invite URL.
  2. **`.io` Energy Orb Harvesting & In-Flight Ship Tier Evolution**:
     - Across the 3000×2000 sector (`SEC-A1` through `SEC-L8`), glowing **Plasma Orbs** (Small `+15 Mass`, Medium `+40 Mass`, Radiant Core `+100 Mass`) drift in zero-G space and respawn dynamically.
     - Destroying an enemy fighter bursts **35% of that pilot's accumulated Mass** into collectible high-value loot orbs at the wreck coordinates.
     - Reaching Mass thresholds (`500 Mass` → Tier II Hunter; `1,500 Mass` → Tier III Heavy Frigate) triggers an in-flight **Evolution Flash & Banner**, upgrading the player's hull silhouette, shield/armor capacity, and weapon hardpoints without interrupting flight.
  3. **Live Top-10 `.io` Leaderboard & Crown Target**:
     - A sleek Top-10 Mass Leaderboard overlay in the upper HUD ranks all pilots in the active Colyseus room by live Mass/Score, highlighting the `#1 Sector Leader` (marked with a golden crown icon on both the leaderboard and the top-right tactical minimap) and pinning the local player's current rank.
  4. **Cosmetic-Only Hangar Store & Non-Combat Rewarded Ad Flow**:
     - In the Hangar / Main Menu, players open the **Cosmetics Tab** to equip unlocked **Hull Skins** (*Solar Gold*, *Void Crimson*, *Nebula Violet*, *Cyber Matrix*), **Engine Exhaust Trail Colors** (*Plasma Cyan*, *Supernova Magenta*, *Emerald Ion*, *Golden Afterburner*), and **Shield Aura Styles** (*Classic Hex*, *Prismatic Pulse*, *Void Barrier*).
     - Players can click **Watch Sponsored Broadcast (+500 KP)** in the Hangar/Menu to view a simulated 5-second non-combat holo-broadcast with a countdown timer and immediate credit grant. This button is completely hidden and disabled during active combat.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast deep-space tactical telemetry (`#050811` void canvas, `#0B1120` dark slate HUD framing, gold/amber metallic **FLEET.IO** insignia, and faction-coded vector hulls).
  - *Low-Occlusion HUD Discipline*: Over 85% of the viewport remains unobstructed space canvas. The Top-Right Tactical Minimap (`SEC-A1..L8`), Top-10 `.io` Leaderboard, Bottom Telemetry Bar, and Tier Evolution progress bar sit cleanly along the viewport perimeter with `pointer-events: none` on non-interactive wrappers.
- **Interactive Feedback & Motion**:
  - Preserves and synchronizes all existing visual effects: weapon impact & proximity explosion screen-shake, color-coded floating damage numbers (`◈` cyan shield / `⬢` orange armor / `!` crimson critical), persistent thermal engine exhaust particles (upgraded to support custom cosmetic trail palettes), and progressive shield opacity decay + `SHIELD BROKEN!` crystal shatter with a `4.2s` reboot delay.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Server-Authoritative Colyseus State with Client-Side Input Prediction & Snapshot Interpolation**:
  - *Chosen Approach*: Clients transmit compact normalized input commands (`targetAngle`, `thrustLevel`, `firePrimary`, `fireSecondary`, `seq`) at 30Hz. The Colyseus room executes the authoritative physics, asteroid/ship collisions, projectile ray/circle hits, shield break timers, and orb collection at 60Hz, broadcasting delta-compressed `@colyseus/schema` snapshots at 20Hz. The client applies local input prediction for the player's own fighter and smooth linear/angular interpolation (`lerpAngle` + velocity dead-reckoning) for remote pilots.
  - *Why*: Eliminates client-side stat/HP/damage spoofing while keeping mouse/touch steering instantaneous even under 80–120ms network jitter.
- **Decision 2 — Incremental 4-Phase Rollout Preserving Existing Single-Player & UI Flows**:
  - *Chosen Approach*: Layer the Colyseus room engine, `.io` orb/evolution loop, and cosmetic store directly onto the existing `realtimeArena.ts` simulation and `App.tsx` shell in four modular phases, retaining automatic fallback if the network disconnects and supporting 30-second Colyseus `allowReconnection` tokens.
  - *Why*: Guarantees zero regressions to the working 10-screen UI, controls, audio synthesizer, and combat feel.

---

## 4. Technical Architecture & Phased Implementation Roadmap *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     Fleet.io Browser & PWA Client (React 19)                    │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐  │
│  │ Guest Matchmaking &  │  │ 60fps Canvas Renderer │  │ Cosmetic Store &     │  │
│  │ Multi-Room Browser   │  │ • Exhaust Particles   │  │ Rewarded Ad Modal    │  │
│  │ + PWA Install Prompt │  │ • Shield Break & HUD  │  │ (Menu/Hangar Only)   │  │
│  └──────────┬───────────┘  └───────────┬───────────┘  └──────────┬───────────┘  │
│             │                          │                         │              │
│             ▼                          ▼                         ▼              │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │          Colyseus Client Network Adapter & Interpolation Buffer           │  │
│  │  • Sends Validated Input Commands (angle, thrust, firePrimary/Secondary)  │  │
│  │  • Client-Side Prediction (Local Ship) + 20Hz Snapshot Lerp (Remote)      │  │
│  │  • Auto-Reconnection Token Storage (sessionStorage reconnectionToken)     │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │ WebSocket (Colyseus Binary Delta Sync)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│              Node.js + Express + Colyseus Authoritative Server                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     FleetIoRoom (10–20 Max Clients)                       │  │
│  │  • 60Hz Server Simulation Tick & 20Hz @colyseus/schema State Broadcast    │  │
│  │  • Anti-Cheat Input Validator (Rate-Limit, NaN Guard, Thrust/Turn Clamp)  │  │
│  │  • Server-Side Combat, Shield Break, Asteroid Collision & Mothership AI   │  │
│  │  • .io Plasma Orb Spawner, Loot Drop Clusters & Ship Tier Evolution       │  │
│  │  • Live Top-10 Mass Leaderboard Computation & 30s Reconnection Handling   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Phased Implementation Roadmap**:
  - **Phase 1 — Colyseus Server-Authoritative Backend & Schema**:
    - Install `colyseus`, `@colyseus/ws-transport`, `@colyseus/schema`, and `colyseus.js`.
    - Define `@colyseus/schema` state models (`FleetRoomState`, `PlayerSchema`, `ProjectileSchema`, `OrbSchema`, `MothershipSchema`, `LeaderboardEntrySchema`).
    - Implement `FleetIoRoom` mounted alongside Express on port 3000 with `maxClients = 16`, guest matchmaking (`joinOrCreate("fleet_sector")`), custom room creation/joining, server-side AI bot backfill, anti-cheat input validation (clamping thrust to `[0, 1]`, enforcing server-side weapon cooldowns & energy costs, rejecting malformed/NaN packets), and `allowReconnection(client, 30)`.
  - **Phase 2 — Client-Side Prediction, Network Interpolation & Reconnection**:
    - Connect the frontend `colyseus.js` client to the authoritative room, transmitting input frames and reconciling authoritative position/velocity/shield/hull states.
    - Implement snapshot interpolation buffer for remote fighters, projectiles, and motherships so 20Hz server updates render smoothly at 60fps on the HTML5 Canvas.
    - Store Colyseus `reconnectionToken` in `sessionStorage` with an automatic in-game reconnection banner and seamless session recovery if a mobile/desktop connection briefly drops.
  - **Phase 3 — Agar/Starblast `.io` Energy Orbs, Ship Tier Evolution & Live Leaderboard**:
    - Add server-spawned and client-rendered **`.io` Plasma Energy Orbs** across the 3000×2000 sector, plus high-value loot orb bursts when ships are destroyed.
    - Implement automatic **Ship Tier Evolution** (*Tier I Scout* at `0 Mass`, *Tier II Hunter* at `500 Mass`, *Tier III Heavy Frigate* at `1,500 Mass`) with HUD evolution progress bar, audio fanfare, and callout banner.
    - Render the live **Top-10 Sector Mass Leaderboard** overlay in the arena HUD and crown indicator on the `#1` pilot in world space and on the tactical minimap.
  - **Phase 4 — Cosmetic-Only Hangar Store, Rewarded Ad Simulation, PWA Polish & Multiplayer Tests**:
    - Add the **Cosmetic Store** tab in the Hangar/Menu with equippable **Hull Skins**, **Engine Exhaust Trail Colors**, and **Shield Aura Styles** synchronized across Colyseus player schemas so all players in the room see each pilot's equipped cosmetics.
    - Add the non-intrusive **Simulated Rewarded Ad Modal** (`+500 KP`) restricted strictly to menu/hangar screens.
    - Surface the PWA Install prompt button in the main menu header and create an automated multiplayer verification test suite (`tests/multiplayer.test.ts`) that spins up a Colyseus room, connects multiple simulated clients, verifies authoritative movement, combat damage, anti-cheat clamping, orb collection, tier evolution, and reconnection.
