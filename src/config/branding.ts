/**
 * Centralized Branding & Project Configuration (Phase 14 / Section 15)
 *
 * Internal database keys, storage keys, authentication identifiers, and
 * infrastructure namespaces use `PROJECT_ID` ("orb_arena_project") so they
 * remain 100% stable across public-facing rebrands.
 */

export const PROJECT_ID = 'orb_arena_project' as const;

export interface BrandingConfig {
  PROJECT_ID: typeof PROJECT_ID;
  GAME_NAME: string;
  GAME_SHORT_NAME: string;
  GAME_DESCRIPTION: string;
  GAME_DOMAIN: string;
  GAME_TITLE: string;
  GAME_META_DESCRIPTION: string;
  GAME_SOCIAL_TITLE: string;
  SUPPORT_EMAIL: string;
}

export const BRANDING: BrandingConfig = {
  PROJECT_ID,
  GAME_NAME: 'RYFT.io',
  GAME_SHORT_NAME: 'RYFT',
  GAME_DESCRIPTION:
    'Real-time server-authoritative multiplayer .io space combat arena. Collect orbital energy mass, evolve your starfighter through 3 survival tiers, customize cannons and homing missiles, and dominate the sector leaderboard.',
  GAME_DOMAIN: 'ryft.io',
  GAME_TITLE: 'RYFT.io — Multiplayer Space Arena',
  GAME_META_DESCRIPTION:
    'Play RYFT.io in your browser — real-time server-authoritative cyberpunk multiplayer .io space combat featuring Vanguard Synapse, Nexus Protocol, and Xeno-Helix starfighters.',
  GAME_SOCIAL_TITLE: 'RYFT.io — Cyberpunk Multiplayer Space .IO Arena',
  SUPPORT_EMAIL: 'support@ryft.io',
};
