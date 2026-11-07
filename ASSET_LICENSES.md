# RYFT.io (`PROJECT_ID = 'orb_arena_project'`) — Asset Provenance, IP Clearance & Store Publishing Kit

## 1. Asset Provenance & Intellectual Property Clearance Report

| Asset Category | Source / Implementation File | License / Ownership Status | Commercial Release Ready |
| :--- | :--- | :--- | :--- |
| **Game Display Title & Branding** | `src/config/branding.ts` (`RYFT.io`, internal ID `orb_arena_project`) | 100% Original Brand Identity | YES |
| **Starfighter Hulls & Motherships** | `src/game/realtimeArena.ts`, `src/components/PocketFleetArt.tsx` | 100% Original Procedural Canvas 2D & SVG Vector Geometry | YES |
| **Cyberpunk Factions & Lore** | `src/game/catalog.ts` (*Vanguard Synapse*, *Nexus Protocol*, *Xeno-Helix*) | 100% Original Cyberpunk Nomenclature & Briefings | YES |
| **Obsidian-Void Nebula & Starfield** | `src/game/realtimeArena.ts` (3-layer parallax starfield + sector grid) | 100% Original Procedural Canvas Rendering | YES |
| **Sound Effects & Combat Music** | `src/audio/soundEngine.ts` (Web Audio API oscillators & filters) | 100% Original Real-Time Procedural Synthesis (Zero external `.mp3`/`.wav` samples) | YES |
| **PWA Icons & Social Cards** | `public/icon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/og-image.svg` | 100% Original Generated Vector/PNG Artwork | YES |
| **Typography** | Google Fonts (`Chakra Petch`, `Rajdhani`, `Share Tech Mono`) | SIL Open Font License (OFL 1.1) — Free for commercial web & mobile embedding | YES |
| **Runtime Libraries** | React 19, Colyseus 0.16, Express, Tailwind CSS, Vite | MIT / Apache-2.0 Open Source Licenses | YES |

---

## 2. Google Play Store & Apple App Store Listing Metadata

### App Title
- **Title:** `RYFT.io — Cyberpunk Space Arena`
- **Short Title (App Icon / Home Screen):** `RYFT.io`
- **Package ID / Bundle ID:** `com.ryftio.spacearena`
- **Category:** Games → Action / Arcade (Multiplayer `.io`)

### Short Description (80 Characters Max — Google Play)
Real-time multiplayer cyberpunk space arena. Evolve your ship & capture the Orb!

### Full Store Description (Play Store & App Store)
Enter the Obsidian Void in **RYFT.io**, a fast-paced 60fps real-time multiplayer cyberpunk space combat `.io` arena. Choose your syndicate—**Vanguard Synapse**, **Nexus Protocol**, or **Xeno-Helix**—and launch from your orbital Mothership into massive 4800×3200 sector warfare.

**KEY FEATURES:**
- **Real-Time Online Multiplayer:** Jump into public sector rooms or create private squad rooms with instant 6-character invite codes.
- **4 Action-Packed Game Modes:**
  - **Capital Clash (Team Match):** Defend your Mothership while bombarding the enemy flagship.
  - **Capture the Orb:** Seize the unstable Quantum Orb using spring-magnetic tether physics and haul it back to your Mothership to unleash a 500-damage orbital mega-beam!
  - **Timed Dogfight (5:00):** High-intensity 5-minute squadron blitz.
  - **Sector Survival (.IO):** Free-for-all plasma harvesting—absorb energy cores to evolve from a Tier 1 Scout into a Tier 3 Heavy Frigate.
- **100% Fair Play Customization:** Unlock 9 unique starfighter hulls, 10 weapons, and neon hull skins, exhaust trails, and shield auras using earned Killpoints (KP). Zero pay-to-win stat boosts.
- **Cross-Platform Controls:** Precision mouse/keyboard controls on desktop plus responsive dual-touch controls and optional gyroscope tilt steering on mobile.

### Keywords (App Store SEO — 100 Characters Max)
`space,io,multiplayer,cyberpunk,arena,starfighter,arcade,shooter,orbital,dogfight,galaga,cosmos`

---

## 3. Promotional Trailer Storyboard (30-Second App Preview / YouTube Short)

- **0:00–0:04 (Hook):** Cold open on the dark Obsidian-Void sector grid (`SEC-F4`). A Tier 1 *Vanguard Viper* boosts through an asteroid field as neon cyan exhaust trails ignite (`"ENTER THE OBSIDIAN VOID"`).
- **0:04–0:10 (Evolution Loop):** Rapid montage of harvesting glowing `.io` plasma cores and destroying rival ships; floating damage numbers pop as the ship levels up from **Tier 1 Scout → Tier 2 Interceptor → Tier 3 Heavy Frigate** (`"HARVEST MASS · EVOLVE YOUR STARFIGHTER"`).
- **0:10–0:18 (Capture the Orb):** Player latches onto the central **Quantum Orb** with a pulsing golden magnetic tether beam, dodging enemy homing missiles while towing the orb into the friendly Mothership bay—triggering the massive orbital mega-beam (`"CAPTURE THE QUANTUM ORB"`).
- **0:18–0:24 (Customization & Hangar):** Quick cuts of the Mothership Docking Bay, refitting weapons and equipping the *Cyberpunk Synth* hull skin and *Golden Nova* exhaust trail (`"9 STARFIGHTERS · 100% COSMETIC SKINS"`).
- **0:24–0:30 (Call to Action):** Full squadron clash around the *Zero-One Mainframe* Mothership, resolving into the **RYFT.io** emblem (`"PLAY INSTANTLY ON WEB, ANDROID & iOS — RYFT.IO"`).

---

## 4. Age Rating & Content Questionnaire Checklist (IARC / ESRB / PEGI)

- **Violence:** Mild Arcade Sci-Fi / Fantasy Violence (spaceships firing laser beams and missiles at other spaceships; ships dissolve into geometric shockwaves and plasma orbs; **zero** human blood, gore, or realistic violence).
- **Suggested Rating:** **ESRB Everyone 10+ (E10+)** / **PEGI 7** / **App Store 9+**.
- **User Interaction:** Online multiplayer scoreboard & sanitized pilot callsigns (`sanitizeCallsign` profanity filter active; no unmoderated open voice/text chat).
- **In-App Purchases / Monetization Disclosure:** Contains optional virtual cosmetic items and optional opt-in sponsored broadcast rewards.
