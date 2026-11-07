export type FactionId = 'incorruptus' | 'omnitron' | 'aerie';

export type ShipRole = 'Scout' | 'Hunter' | 'Heavy Frigate';

export type GameModeId = 'team_match' | 'capture_orb' | 'dogfight' | 'aerie_invasion';

export type CosmeticCategory = 'SKIN' | 'TRAIL' | 'SHIELD';

export interface CosmeticItemSpec {
  id: string;
  name: string;
  category: CosmeticCategory;
  costKp: number;
  previewPrimary: string;
  previewSecondary: string;
  previewAccent: string;
  description: string;
}

export interface LeaderboardEntry {
  id: string;
  callsign: string;
  faction: FactionId;
  team: 'ALLY' | 'ENEMY';
  ioScore: number;
  ioLevel: number;
  kills: number;
  killStreak?: number;
  survivalTime?: number;
  isPlayer: boolean;
  isLeader: boolean;
}

export interface KillStreakAnnouncement {
  id: string;
  pilotId: string;
  callsign: string;
  isPlayer: boolean;
  kind: 'KILL_STREAK' | 'TIER_UP';
  streakCount?: number;
  tierLevel?: 1 | 2 | 3;
  title: string;
  subtitle: string;
  badgeText: string;
  voiceoverLine?: string;
  soundCueId?: 'STREAK_3' | 'STREAK_5' | 'STREAK_10' | 'TIER_2' | 'TIER_3';
  accentColor: string;
  glowColor: string;
  createdAt: number;
  duration: number;
}

export type GameShellState =
  | 'SPLASH'
  | 'MAIN_MENU'
  | 'HIGHSCORE'
  | 'WATCH_TRAILER'
  | 'CREDITS'
  | 'LOGIN'
  | 'CHOOSE_SIDE'
  | 'USER_DETAILS'
  | 'EXPANSION_PACKS'
  | 'COSMETIC_STORE'
  | 'LOADOUT_OVERLAY'
  | 'PLAYING'
  | 'MULTIPLAYER_LOBBY'
  | 'PAUSED'
  | 'MATCH_OVER';

export interface WeaponSpec {
  id: string;
  name: string;
  shortLabel: string;
  category: 'CANNON' | 'MISSILE';
  damage: number;
  fireRate: number;
  energyCost: number;
  projectileSpeed: number;
  range: number;
  homingTurnRate: number;
  shieldPiercing: number;
  spreadAngle: number;
  projectilesPerShot: number;
  color: string;
  unlockCost: number;
  requiredLevel: number;
  description: string;
}

export interface ShipBlueprint {
  id: string;
  name: string;
  shortLabel: string;
  faction: FactionId;
  role: ShipRole;
  maxHp: number;
  maxShield: number;
  maxEnergy: number;
  energyRegen: number;
  shieldRegen: number;
  hullRegen: number;
  maxSpeed: number;
  thrustAccel: number;
  turnSpeed: number;
  thrusterEnergyDrain: number;
  defaultCannonId: string;
  defaultMissileId: string;
  unlockCost: number;
  requiredLevel: number;
  lore: string;
}

export interface FighterEntity {
  id: string;
  callsign: string;
  rankTitle: string;
  shipClassLabel: string;
  isPlayer: boolean;
  isRemoteHuman?: boolean;
  team: 'ALLY' | 'ENEMY';
  faction: FactionId;
  blueprintId: string;
  role: ShipRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  radius: number;

  // Authoritative network interpolation targets
  serverX?: number;
  serverY?: number;
  serverVx?: number;
  serverVy?: number;
  serverAngle?: number;
  lastServerUpdate?: number;

  // Vitals
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  energyRegen: number;
  shieldRegen: number;
  hullRegen: number;
  maxSpeed: number;
  thrustAccel: number;
  turnSpeed: number;
  thrusterEnergyDrain: number;

  // Weapons
  cannonId: string;
  missileId: string;
  cannonCooldown: number;
  missileCooldown: number;

  // Cosmetics (100% visual only)
  skinId?: string;
  trailId?: string;
  shieldStyleId?: string;

  // Active status
  isThrusting: boolean;
  thrustIntensity: number;
  overchargeTimer: number;
  hitFlashTimer: number;
  shieldRippleTimer: number;
  shieldBrokenTimer: number;
  respawnTimer: number;
  carryingOrb: boolean;
  isDockedInBay: boolean;

  // Match telemetry, Kill Streak & 3-Tier Survival/Mass progression
  kills: number;
  deaths: number;
  assists: number;
  killStreak: number;
  survivalTime: number;
  ioScore: number;
  ioLevel: number;

  // AI Pilot state
  aiTargetId: string | null;
  aiRetreatToDock: boolean;
  aiStrafeDir: number;
}

export interface IoPellet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  value: number;
  color: string;
  pulsePhase: number;
  sides?: number;
  isLootDrop?: boolean;
}

export interface MothershipEntity {
  id: string;
  team: 'ALLY' | 'ENEMY';
  faction: FactionId;
  name: string;
  x: number;
  y: number;
  radius: number;
  dockRadius: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  invulnerable: boolean;
  rotation: number;
  turretCooldown: number;
  hitFlashTimer: number;
  shieldRippleTimer: number;
  shieldBrokenTimer: number;
}

export interface ProjectileEntity {
  id: string;
  ownerId: string;
  team: 'ALLY' | 'ENEMY';
  category: 'CANNON' | 'MISSILE' | 'TURRET';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  damage: number;
  shieldPiercing: number;
  homingTurnRate: number;
  targetId: string | null;
  life: number;
  maxLife: number;
  color: string;
  trail: { x: number; y: number }[];
}

export interface PowerUpDrop {
  id: string;
  type: 'SHIELD_ORB' | 'ENERGY_CELL' | 'HULL_NANITES' | 'OVERCHARGE';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  pulsePhase: number;
}

export interface CaptureOrbState {
  active: boolean;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  carrierId: string | null;
  carrierTeam: 'ALLY' | 'ENEMY' | null;
  megaBeamTimer: number;
  megaBeamSourceX: number;
  megaBeamSourceY: number;
  megaBeamTargetX: number;
  megaBeamTargetY: number;
}

export interface AsteroidObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  vertices: { x: number; y: number }[];
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

export interface FloatingCombatText {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy: number;
  gravity?: number;
  age?: number;
  maxAge?: number;
  text: string;
  subText?: string;
  color: string;
  alpha: number;
  scale?: number;
  kind?: 'SHIELD' | 'ARMOR' | 'CRITICAL' | 'STATUS';
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  victimName: string;
  killerTeam: 'ALLY' | 'ENEMY' | 'SYSTEM';
  timestamp: number;
}

export interface OffscreenBracketBlip {
  id: string;
  name: string;
  team: 'ALLY' | 'ENEMY';
  screenX: number;
  screenY: number;
  hpRatio: number;
}

export interface PilotProfile {
  playerId?: string;
  callsign: string;
  email: string;
  avatarUrl?: string;
  createdAt?: string;
  totalMatches?: number;
  totalVictories?: number;
  highestMass?: number;
  authProvider?: 'guest' | 'google' | 'facebook' | 'legacy';
  linkedProviders?: ('guest' | 'google' | 'facebook' | 'legacy')[];
  sessionToken?: string;
  killpoints: number; // KP (starts at 1000 with Recruiting bonus!)
  totalKills: number;
  totalDeaths: number;
  level: number;
  credits: number;
  cyberTheme: boolean;
  sandboxUnlockAll: boolean;
  tutorialCompleted: boolean;
  unlockedShips: string[];
  unlockedWeapons: string[];
  shipUpgrades: Record<string, number>;
  selectedFaction: FactionId;
  selectedShipByFaction: Record<FactionId, string>;
  selectedCannonByShip: Record<string, string>;
  selectedMissileByShip: Record<string, string>;
  unlockedCosmetics?: string[];
  selectedSkinId?: string;
  selectedTrailId?: string;
  selectedShieldId?: string;
  adsWatchedCount?: number;
}

export interface GameModeSpec {
  id: GameModeId;
  name: string;
  subtitle: string;
  objective: string;
  winConditionText: string;
  rewardCredits: number;
  rewardKp: number;
}
