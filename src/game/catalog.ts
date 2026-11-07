import {
  CosmeticItemSpec,
  FactionId,
  GameModeSpec,
  ShipBlueprint,
  ShipRole,
  WeaponSpec,
} from './types';

export interface FactionMeta {
  id: FactionId;
  name: string;
  shortName: string;
  symbol: string;
  mothershipName: string;
  commanderTitle: string;
  commanderSpeech: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentHex: string;
  traitSummary: string;
}

export const FACTIONS: Record<FactionId, FactionMeta> = {
  incorruptus: {
    id: 'incorruptus',
    name: 'VANGUARD SYNAPSE',
    shortName: 'Vanguard',
    symbol: '⬡',
    mothershipName: 'VNS Aegis Core',
    commanderTitle: 'High Director · Vanguard Synapse',
    commanderSpeech:
      'Signal locked, Freelancer! I am the High Director of the Vanguard Synapse. Neo-Terran humanity will breach the corporate blockade and claim the cyber-grid—with your neural link at the helm.',
    tagline: 'Neural-Linked Terran Armada · Kinetic Rail & Pulse Ordnance',
    primaryColor: '#38BDF8',
    secondaryColor: '#F59E0B',
    accentHex: '#00F0FF',
    traitSummary: '+15% Hull Plating · High-velocity Rail Repeaters & Smart Seekers',
  },
  omnitron: {
    id: 'omnitron',
    name: 'NEXUS PROTOCOL',
    shortName: 'Nexus',
    symbol: '△',
    mothershipName: 'Zero-One Mainframe',
    commanderTitle: 'Prime Daemon · Nexus Protocol',
    commanderSpeech:
      'Connection established, Node-01. Organic reflexes are obsolete. Synchronize your consciousness with the Nexus Protocol and purge biological entropy from every sector.',
    tagline: 'Autonomous AI Grid · Tachyon Lances & Micro-Swarm Pods',
    primaryColor: '#EF4444',
    secondaryColor: '#F97316',
    accentHex: '#FF2A6D',
    traitSummary: '+20% Shield Matrix · Rapid Energy Recharge & Agile Mantis Hulls',
  },
  aerie: {
    id: 'aerie',
    name: 'XENO-HELIX',
    shortName: 'Xeno-Helix',
    symbol: '☣',
    mothershipName: 'Helix Bio-Spire',
    commanderTitle: 'Helix Matriarch · Bio-Swarm',
    commanderSpeech:
      'We are the spliced void. Bond with the Xeno-Helix collective, regenerate your synth-chitin hull in deep space, and consume every corporate and machine dreadnought.',
    tagline: 'Cyber-Mutant Symbiont Swarm · Living Hulls & Corrosive Spores',
    primaryColor: '#10B981',
    secondaryColor: '#A3E635',
    accentHex: '#05FFA1',
    traitSummary: 'Passive Hull Regeneration · Top Thruster Speed & Shield-Piercing Bio-Plasma',
  },
};

export const WEAPONS: Record<string, WeaponSpec> = {
  // PRIMARY WEAPONS (Middle-Right Triangle-in-Circle Button / Left-Click)
  pulse_laser: {
    id: 'pulse_laser',
    name: 'Kinetic Rail Repeater',
    shortLabel: 'RAIL REPEATER',
    category: 'CANNON',
    damage: 15,
    fireRate: 8.5,
    energyCost: 1.8,
    projectileSpeed: 1120,
    range: 860,
    homingTurnRate: 0,
    shieldPiercing: 0.15,
    spreadAngle: 0.03,
    projectilesPerShot: 1,
    color: '#FEF08A',
    unlockCost: 0,
    requiredLevel: 1,
    description: 'High-rate cybernetic kinetic tracer stream with zero spin-up delay.',
  },
  vulcan_repeater: {
    id: 'vulcan_repeater',
    name: 'Twin Neon Pulse',
    shortLabel: 'NEON PULSE',
    category: 'CANNON',
    damage: 19,
    fireRate: 6.8,
    energyCost: 2.2,
    projectileSpeed: 1160,
    range: 880,
    homingTurnRate: 0,
    shieldPiercing: 0.2,
    spreadAngle: 0.02,
    projectilesPerShot: 1,
    color: '#00F0FF',
    unlockCost: 300,
    requiredLevel: 1,
    description: 'Rapid cyber-cyan laser bolts that shred enemy fighter shields.',
  },
  tachyon_beam: {
    id: 'tachyon_beam',
    name: 'Tachyon Phase Lance',
    shortLabel: 'TACHYON LANCE',
    category: 'CANNON',
    damage: 25,
    fireRate: 5.0,
    energyCost: 2.8,
    projectileSpeed: 1340,
    range: 950,
    homingTurnRate: 0,
    shieldPiercing: 0.25,
    spreadAngle: 0.01,
    projectilesPerShot: 1,
    color: '#FF2A6D',
    unlockCost: 0,
    requiredLevel: 1,
    description: 'Nexus Protocol high-velocity particle lance for long-range precision hits.',
  },
  bio_spitter: {
    id: 'bio_spitter',
    name: 'Helix Acid Spitter',
    shortLabel: 'HELIX CANNON',
    category: 'CANNON',
    damage: 18,
    fireRate: 6.8,
    energyCost: 2.0,
    projectileSpeed: 980,
    range: 780,
    homingTurnRate: 0,
    shieldPiercing: 0.45,
    spreadAngle: 0.035,
    projectilesPerShot: 1,
    color: '#05FFA1',
    unlockCost: 0,
    requiredLevel: 1,
    description: 'Corrosive bio-cyber bolts that bypass 45% of enemy shield matrices.',
  },
  ion_scatter: {
    id: 'ion_scatter',
    name: 'Cyber Tri-Scatter',
    shortLabel: 'TRI-SCATTER',
    category: 'CANNON',
    damage: 13,
    fireRate: 4.4,
    energyCost: 3.6,
    projectileSpeed: 960,
    range: 650,
    homingTurnRate: 0,
    shieldPiercing: 0.2,
    spreadAngle: 0.15,
    projectilesPerShot: 3,
    color: '#FBBF24',
    unlockCost: 500,
    requiredLevel: 2,
    description: 'Fires a 3-bolt spread fan ideal for close-quarters dogfights.',
  },

  // SECONDARY WEAPONS (Bottom-Right Crosshair-Missile Button / Right-Click)
  valkyrie_seeker: {
    id: 'valkyrie_seeker',
    name: 'Smart Seeker Mk-I',
    shortLabel: 'SMART MISSILE',
    category: 'MISSILE',
    damage: 48,
    fireRate: 1.35,
    energyCost: 12,
    projectileSpeed: 720,
    range: 1240,
    homingTurnRate: 4.4,
    shieldPiercing: 0.25,
    spreadAngle: 0,
    projectilesPerShot: 1,
    color: '#F59E0B',
    unlockCost: 0,
    requiredLevel: 1,
    description: 'Neural target-locking homing missile with high-visibility contrail.',
  },
  omnitron_swarmer: {
    id: 'omnitron_swarmer',
    name: 'Mantis Swarm Pod',
    shortLabel: 'SWARM MISSILE',
    category: 'MISSILE',
    damage: 30,
    fireRate: 1.45,
    energyCost: 14,
    projectileSpeed: 760,
    range: 1240,
    homingTurnRate: 5.2,
    shieldPiercing: 0.2,
    spreadAngle: 0.22,
    projectilesPerShot: 2,
    color: '#FF2A6D',
    unlockCost: 0,
    requiredLevel: 1,
    description: 'Launches twin homing micro-missiles that aggressively track agile targets.',
  },
  aerie_leech_pod: {
    id: 'aerie_leech_pod',
    name: 'Helix Spore Torpedo',
    shortLabel: 'SPORE TORPEDO',
    category: 'MISSILE',
    damage: 50,
    fireRate: 1.2,
    energyCost: 14,
    projectileSpeed: 680,
    range: 1150,
    homingTurnRate: 4.5,
    shieldPiercing: 0.55,
    spreadAngle: 0,
    projectilesPerShot: 1,
    color: '#05FFA1',
    unlockCost: 0,
    requiredLevel: 1,
    description: 'Spliced homing warhead that burrows directly through shields into hull armor.',
  },
  hellfire_torpedo: {
    id: 'hellfire_torpedo',
    name: 'Nova Heavy Warhead',
    shortLabel: 'NOVA WARHEAD',
    category: 'MISSILE',
    damage: 80,
    fireRate: 0.9,
    energyCost: 18,
    projectileSpeed: 620,
    range: 1320,
    homingTurnRate: 3.4,
    shieldPiercing: 0.35,
    spreadAngle: 0,
    projectilesPerShot: 1,
    color: '#00F0FF',
    unlockCost: 600,
    requiredLevel: 2,
    description: 'High-yield capital warhead engineered to shatter enemy Motherships.',
  },
};

export const SHIP_BLUEPRINTS: ShipBlueprint[] = [
  // VANGUARD SYNAPSE (internal key: incorruptus)
  {
    id: 'inc_viper',
    name: 'Synapse Striker',
    shortLabel: 'STRIKER',
    faction: 'incorruptus',
    role: 'Hunter',
    maxHp: 145,
    maxShield: 95,
    maxEnergy: 150,
    energyRegen: 64,
    shieldRegen: 14,
    hullRegen: 0,
    maxSpeed: 435,
    thrustAccel: 680,
    turnSpeed: 5.6,
    thrusterEnergyDrain: 3.6,
    defaultCannonId: 'pulse_laser',
    defaultMissileId: 'valkyrie_seeker',
    unlockCost: 0,
    requiredLevel: 1,
    lore: 'Signature swept-wing Vanguard strike fighter with neural targeting arrays.',
  },
  {
    id: 'inc_paladin',
    name: 'Synapse Recon',
    shortLabel: 'RECON',
    faction: 'incorruptus',
    role: 'Scout',
    maxHp: 115,
    maxShield: 90,
    maxEnergy: 165,
    energyRegen: 74,
    shieldRegen: 16,
    hullRegen: 0,
    maxSpeed: 485,
    thrustAccel: 750,
    turnSpeed: 6.4,
    thrusterEnergyDrain: 3.2,
    defaultCannonId: 'vulcan_repeater',
    defaultMissileId: 'valkyrie_seeker',
    unlockCost: 400,
    requiredLevel: 1,
    lore: 'Ultra-agile cyber-reconnaissance interceptor built for Orb runs and rapid dogfights.',
  },
  {
    id: 'inc_hyperion',
    name: 'Synapse Dreadnought',
    shortLabel: 'DREADNOUGHT',
    faction: 'incorruptus',
    role: 'Heavy Frigate',
    maxHp: 250,
    maxShield: 160,
    maxEnergy: 190,
    energyRegen: 72,
    shieldRegen: 18,
    hullRegen: 0,
    maxSpeed: 355,
    thrustAccel: 520,
    turnSpeed: 4.2,
    thrusterEnergyDrain: 4.4,
    defaultCannonId: 'ion_scatter',
    defaultMissileId: 'hellfire_torpedo',
    unlockCost: 800,
    requiredLevel: 2,
    lore: 'Heavily armored gunship built to siege enemy Mothership stations.',
  },

  // NEXUS PROTOCOL (internal key: omnitron)
  {
    id: 'omn_spectre',
    name: 'Cyber Mantis',
    shortLabel: 'CYBER MANTIS',
    faction: 'omnitron',
    role: 'Hunter',
    maxHp: 125,
    maxShield: 130,
    maxEnergy: 165,
    energyRegen: 70,
    shieldRegen: 18,
    hullRegen: 0,
    maxSpeed: 450,
    thrustAccel: 690,
    turnSpeed: 6.0,
    thrusterEnergyDrain: 3.5,
    defaultCannonId: 'tachyon_beam',
    defaultMissileId: 'omnitron_swarmer',
    unlockCost: 0,
    requiredLevel: 1,
    lore: 'Autonomous Nexus strike frame engineered for high-frequency shield disruption.',
  },
  {
    id: 'omn_vector',
    name: 'Vector Drone',
    shortLabel: 'VECTOR DRONE',
    faction: 'omnitron',
    role: 'Scout',
    maxHp: 105,
    maxShield: 125,
    maxEnergy: 175,
    energyRegen: 80,
    shieldRegen: 20,
    hullRegen: 0,
    maxSpeed: 495,
    thrustAccel: 760,
    turnSpeed: 6.5,
    thrusterEnergyDrain: 3.0,
    defaultCannonId: 'tachyon_beam',
    defaultMissileId: 'omnitron_swarmer',
    unlockCost: 400,
    requiredLevel: 1,
    lore: 'High-velocity synthetic interceptor with overclocked ion thrusters.',
  },
  {
    id: 'omn_monolith',
    name: 'Nexus Monolith',
    shortLabel: 'MONOLITH',
    faction: 'omnitron',
    role: 'Heavy Frigate',
    maxHp: 205,
    maxShield: 230,
    maxEnergy: 205,
    energyRegen: 82,
    shieldRegen: 25,
    hullRegen: 0,
    maxSpeed: 360,
    thrustAccel: 530,
    turnSpeed: 4.4,
    thrusterEnergyDrain: 4.2,
    defaultCannonId: 'ion_scatter',
    defaultMissileId: 'hellfire_torpedo',
    unlockCost: 800,
    requiredLevel: 2,
    lore: 'Heavy synthetic dreadnought protected by multi-phase quantum shields.',
  },

  // XENO-HELIX (internal key: aerie)
  {
    id: 'aer_stinger',
    name: 'Helix Stinger',
    shortLabel: 'STINGER',
    faction: 'aerie',
    role: 'Scout',
    maxHp: 150,
    maxShield: 75,
    maxEnergy: 155,
    energyRegen: 68,
    shieldRegen: 12,
    hullRegen: 10,
    maxSpeed: 480,
    thrustAccel: 730,
    turnSpeed: 6.3,
    thrusterEnergyDrain: 3.2,
    defaultCannonId: 'bio_spitter',
    defaultMissileId: 'aerie_leech_pod',
    unlockCost: 0,
    requiredLevel: 1,
    lore: 'Fastest spliced bio-fighter with self-regenerating synth-chitin hull.',
  },
  {
    id: 'aer_ravager',
    name: 'Helix Ravager',
    shortLabel: 'RAVAGER',
    faction: 'aerie',
    role: 'Hunter',
    maxHp: 210,
    maxShield: 90,
    maxEnergy: 170,
    energyRegen: 72,
    shieldRegen: 14,
    hullRegen: 14,
    maxSpeed: 415,
    thrustAccel: 610,
    turnSpeed: 5.2,
    thrusterEnergyDrain: 3.8,
    defaultCannonId: 'bio_spitter',
    defaultMissileId: 'aerie_leech_pod',
    unlockCost: 400,
    requiredLevel: 1,
    lore: 'Mutant bio-cruiser with adaptive hull tissue and corrosive ordnance.',
  },
  {
    id: 'aer_leviathan',
    name: 'Helix Leviathan',
    shortLabel: 'LEVIATHAN',
    faction: 'aerie',
    role: 'Heavy Frigate',
    maxHp: 285,
    maxShield: 115,
    maxEnergy: 195,
    energyRegen: 76,
    shieldRegen: 16,
    hullRegen: 18,
    maxSpeed: 365,
    thrustAccel: 530,
    turnSpeed: 4.4,
    thrusterEnergyDrain: 4.5,
    defaultCannonId: 'bio_spitter',
    defaultMissileId: 'hellfire_torpedo',
    unlockCost: 800,
    requiredLevel: 2,
    lore: 'Massive symbiotic dreadnought that devours enemy shields and regenerates in combat.',
  },
];

export const GAME_MODES: GameModeSpec[] = [
  {
    id: 'team_match',
    name: 'Team Match',
    subtitle: 'Mothership Siege & Dogfight',
    objective: 'Launch from your Mothership, dogfight enemy pilots, and destroy the rival Mothership.',
    winConditionText: 'Destroy Enemy Mothership',
    rewardCredits: 400,
    rewardKp: 500,
  },
  {
    id: 'capture_orb',
    name: 'Capture the Orb',
    subtitle: 'Quantum Orb Mega-Beam',
    objective: 'Grab the central Orb and dock at your Mothership to fire the Orbital Mega-Beam.',
    winConditionText: '3 Orb Captures or Mothership Kill',
    rewardCredits: 450,
    rewardKp: 600,
  },
  {
    id: 'dogfight',
    name: 'Dogfight',
    subtitle: 'Pure Frag Arena',
    objective: 'Mothership shields are indestructible! Dock to recharge energy and reach 20 kills.',
    winConditionText: 'First Team to 20 Kills',
    rewardCredits: 350,
    rewardKp: 450,
  },
  {
    id: 'aerie_invasion',
    name: 'Helix Incursion',
    subtitle: 'Co-Op Bio-Swarm Defense',
    objective: 'Vanguard & Nexus pilots unite to repel waves of Xeno-Helix Stingers and Ravagers.',
    winConditionText: 'Destroy the Helix Bio-Spire',
    rewardCredits: 550,
    rewardKp: 750,
  },
];

export function getRankFromKillpoints(kp: number): {
  title: string;
  roman: string;
  nextKp: number;
  progressRatio: number;
} {
  if (kp < 2000) {
    return {
      title: 'FREELANCER',
      roman: 'II',
      nextKp: 2000,
      progressRatio: Math.max(0.08, kp / 2000),
    };
  }
  if (kp < 4000) {
    return {
      title: 'VANGUARD',
      roman: 'III',
      nextKp: 4000,
      progressRatio: (kp - 2000) / 2000,
    };
  }
  if (kp < 7000) {
    return {
      title: 'CYBER-ACE',
      roman: 'IV',
      nextKp: 7000,
      progressRatio: (kp - 4000) / 3000,
    };
  }
  return {
    title: 'OVERLORD',
    roman: 'V',
    nextKp: 12000,
    progressRatio: Math.min(1, (kp - 7000) / 5000),
  };
}

export const COSMETIC_ITEMS: CosmeticItemSpec[] = [
  // HULL SKINS (100% Cosmetic)
  {
    id: 'skin_default',
    name: 'Standard Chrome Alloy',
    category: 'SKIN',
    costKp: 0,
    previewPrimary: '#F8FAFC',
    previewSecondary: '#CBD5E1',
    previewAccent: '#64748B',
    description: 'Factory-issue titanium-chrome hull plating.',
  },
  {
    id: 'skin_solar_gold',
    name: 'Solar Sovereign Gold',
    category: 'SKIN',
    costKp: 600,
    previewPrimary: '#FEF08A',
    previewSecondary: '#F59E0B',
    previewAccent: '#92400E',
    description: 'Gilded command hull plating with warm amber specular highlights.',
  },
  {
    id: 'skin_void_crimson',
    name: 'Crimson Netrunner',
    category: 'SKIN',
    costKp: 750,
    previewPrimary: '#FECDD3',
    previewSecondary: '#F43F5E',
    previewAccent: '#881337',
    description: 'Anodized crimson stealth armor worn by sector interceptors.',
  },
  {
    id: 'skin_nebula_violet',
    name: 'Synthwave Phantom',
    category: 'SKIN',
    costKp: 900,
    previewPrimary: '#E9D5FF',
    previewSecondary: '#A855F7',
    previewAccent: '#4C1D95',
    description: 'Deep-space ultraviolet hull coating with neon plasma sheen.',
  },
  {
    id: 'skin_cyber_emerald',
    name: 'Bio-Cyber Emerald',
    category: 'SKIN',
    costKp: 1100,
    previewPrimary: '#A7F3D0',
    previewSecondary: '#10B981',
    previewAccent: '#064E3B',
    description: 'Iridescent emerald-jade alloy inspired by Xeno-Helix synth-chitin tech.',
  },

  // ENGINE EXHAUST TRAILS (100% Cosmetic)
  {
    id: 'trail_default',
    name: 'Standard Ion Plume',
    category: 'TRAIL',
    costKp: 0,
    previewPrimary: '#FFFFFF',
    previewSecondary: '#00F0FF',
    previewAccent: '#0284C7',
    description: 'Standard faction-tuned ion thruster exhaust.',
  },
  {
    id: 'trail_plasma_violet',
    name: 'Ultraviolet Nova Wake',
    category: 'TRAIL',
    costKp: 500,
    previewPrimary: '#FFFFFF',
    previewSecondary: '#D946EF',
    previewAccent: '#6B21A8',
    description: 'Leaves a vibrant magenta-violet particle wake across the sector.',
  },
  {
    id: 'trail_solar_flare',
    name: 'Solar Flare Afterburner',
    category: 'TRAIL',
    costKp: 650,
    previewPrimary: '#FFFBEB',
    previewSecondary: '#FBBF24',
    previewAccent: '#B45309',
    description: 'Blazing golden-amber thruster particles with molten core.',
  },
  {
    id: 'trail_emerald_ion',
    name: 'Emerald Warp Wake',
    category: 'TRAIL',
    costKp: 800,
    previewPrimary: '#ECFDF5',
    previewSecondary: '#05FFA1',
    previewAccent: '#065F46',
    description: 'Bioluminescent emerald warp exhaust particles.',
  },
  {
    id: 'trail_crimson_burn',
    name: 'Overdrive Ruby Burn',
    category: 'TRAIL',
    costKp: 950,
    previewPrimary: '#FFF1F2',
    previewSecondary: '#FF2A6D',
    previewAccent: '#9F1239',
    description: 'High-contrast ruby-red plasma exhaust plume.',
  },

  // SHIELD AURA STYLES (100% Cosmetic)
  {
    id: 'shield_default',
    name: 'Tactical Phase Dome',
    category: 'SHIELD',
    costKp: 0,
    previewPrimary: '#2DD4BF',
    previewSecondary: '#00F0FF',
    previewAccent: '#0F766E',
    description: 'Standard radial energy barrier with progressive damage opacity.',
  },
  {
    id: 'shield_prismatic',
    name: 'Prismatic Hex Lattice',
    category: 'SHIELD',
    costKp: 600,
    previewPrimary: '#38BDF8',
    previewSecondary: '#E879F9',
    previewAccent: '#6366F1',
    description: 'Projects a rotating geometric hex lattice inside the shield dome.',
  },
  {
    id: 'shield_golden_aegis',
    name: 'Golden Aegis Halo',
    category: 'SHIELD',
    costKp: 850,
    previewPrimary: '#FEF08A',
    previewSecondary: '#F59E0B',
    previewAccent: '#B45309',
    description: 'Radiant golden-amber energy barrier with solar flare ripples.',
  },
  {
    id: 'shield_void_pulse',
    name: 'Void Singularity Field',
    category: 'SHIELD',
    costKp: 1100,
    previewPrimary: '#C084FC',
    previewSecondary: '#9333EA',
    previewAccent: '#4C1D95',
    description: 'Ultraviolet harmonic shield matrix around your starfighter.',
  },
];

export const SURVIVAL_TIER_2_SECONDS = 30;
export const SURVIVAL_TIER_3_SECONDS = 75;

export interface KillStreakMilestoneSpec {
  streak: 3 | 5 | 10;
  title: string;
  subtitle: string;
  badgeText: string;
  voiceoverLine: string;
  soundCueId: 'STREAK_3' | 'STREAK_5' | 'STREAK_10';
  accentColor: string;
  glowColor: string;
  bonusMass: number;
}

export function getKillStreakMilestone(streak: number): KillStreakMilestoneSpec | null {
  if (streak === 3) {
    return {
      streak: 3,
      title: 'KILLING SPREE!',
      subtitle: '3 CONSECUTIVE KILLS WITHOUT DYING',
      badgeText: '🔥 3X KILL STREAK',
      voiceoverLine: 'Killing Spree! Three consecutive kills!',
      soundCueId: 'STREAK_3',
      accentColor: '#00F0FF',
      glowColor: 'rgba(0, 240, 255, 0.45)',
      bonusMass: 90,
    };
  }
  if (streak === 5) {
    return {
      streak: 5,
      title: 'RAMPAGE!',
      subtitle: '5 CONSECUTIVE KILLS · SECTOR DOMINANCE',
      badgeText: '⚡ 5X KILL STREAK',
      voiceoverLine: 'Rampage! Five kill streak! Sector dominance!',
      soundCueId: 'STREAK_5',
      accentColor: '#F59E0B',
      glowColor: 'rgba(245, 158, 11, 0.52)',
      bonusMass: 180,
    };
  }
  if (streak === 10) {
    return {
      streak: 10,
      title: 'UNSTOPPABLE · FLEET ACE!',
      subtitle: '10 CONSECUTIVE KILLS · SUPREME COMMANDER',
      badgeText: '👑 10X KILL STREAK',
      voiceoverLine: 'Unstoppable! Ten kill streak! Supreme Fleet Ace!',
      soundCueId: 'STREAK_10',
      accentColor: '#FF2A6D',
      glowColor: 'rgba(255, 42, 109, 0.58)',
      bonusMass: 350,
    };
  }
  return null;
}

export function getShipTierFromMass(
  mass: number,
  survivalTime: number = 0
): {
  tier: 1 | 2 | 3;
  role: ShipRole;
  label: string;
  nextMass: number;
  nextSurvivalSec: number | null;
  progressRatio: number;
} {
  const isTier3 = mass >= 1500 || survivalTime >= SURVIVAL_TIER_3_SECONDS;
  if (isTier3) {
    return {
      tier: 3,
      role: 'Heavy Frigate',
      label: 'TIER III · HEAVY FRIGATE (MAX)',
      nextMass: 3000,
      nextSurvivalSec: null,
      progressRatio: 1,
    };
  }

  const isTier2 = mass >= 500 || survivalTime >= SURVIVAL_TIER_2_SECONDS;
  if (isTier2) {
    const massRatio = Math.max(0, Math.min(1, (mass - 500) / 1000));
    const timeRatio = Math.max(
      0,
      Math.min(
        1,
        (survivalTime - SURVIVAL_TIER_2_SECONDS) /
          (SURVIVAL_TIER_3_SECONDS - SURVIVAL_TIER_2_SECONDS)
      )
    );
    return {
      tier: 2,
      role: 'Hunter',
      label: 'TIER II · HUNTER',
      nextMass: 1500,
      nextSurvivalSec: SURVIVAL_TIER_3_SECONDS,
      progressRatio: Math.max(massRatio, timeRatio),
    };
  }

  const massRatio = Math.max(0, Math.min(1, (mass - 100) / 400));
  const timeRatio = Math.max(0, Math.min(1, survivalTime / SURVIVAL_TIER_2_SECONDS));
  return {
    tier: 1,
    role: 'Scout',
    label: 'TIER I · SCOUT',
    nextMass: 500,
    nextSurvivalSec: SURVIVAL_TIER_2_SECONDS,
    progressRatio: Math.max(massRatio, timeRatio),
  };
}

export function getBlueprintForFactionAndTier(
  faction: FactionId,
  tier: 1 | 2 | 3
): ShipBlueprint {
  const role: ShipRole =
    tier === 1 ? 'Scout' : tier === 2 ? 'Hunter' : 'Heavy Frigate';
  return (
    SHIP_BLUEPRINTS.find((b) => b.faction === faction && b.role === role) ||
    SHIP_BLUEPRINTS.find((b) => b.faction === faction)!
  );
}


