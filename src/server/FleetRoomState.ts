import { Schema, MapSchema, ArraySchema, defineTypes } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  declare id: string;
  declare callsign: string;
  declare faction: string;
  declare team: string;
  declare blueprintId: string;
  declare role: string;
  declare cannonId: string;
  declare missileId: string;
  declare skinId: string;
  declare trailId: string;
  declare shieldStyleId: string;
  declare isBot: boolean;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;
  declare angle: number;
  declare targetAngle: number;
  declare radius: number;
  declare hp: number;
  declare maxHp: number;
  declare shield: number;
  declare maxShield: number;
  declare energy: number;
  declare maxEnergy: number;
  declare shieldBrokenTimer: number;
  declare respawnTimer: number;
  declare isThrusting: boolean;
  declare thrustIntensity: number;
  declare carryingOrb: boolean;
  declare isDockedInBay: boolean;
  declare kills: number;
  declare deaths: number;
  declare killStreak: number;
  declare survivalTime: number;
  declare ioScore: number;
  declare ioLevel: number;
  declare lastProcessedSeq: number;

  constructor() {
    super();
    this.id = '';
    this.callsign = 'Pilot';
    this.faction = 'incorruptus';
    this.team = 'ALLY';
    this.blueprintId = 'inc_viper';
    this.role = 'Scout';
    this.cannonId = 'pulse_laser';
    this.missileId = 'valkyrie_seeker';
    this.skinId = 'skin_default';
    this.trailId = 'trail_default';
    this.shieldStyleId = 'shield_default';
    this.isBot = false;
    this.x = 500;
    this.y = 1000;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.targetAngle = 0;
    this.radius = 17;
    this.hp = 135;
    this.maxHp = 135;
    this.shield = 90;
    this.maxShield = 90;
    this.energy = 130;
    this.maxEnergy = 130;
    this.shieldBrokenTimer = 0;
    this.respawnTimer = 0;
    this.isThrusting = false;
    this.thrustIntensity = 0;
    this.carryingOrb = false;
    this.isDockedInBay = false;
    this.kills = 0;
    this.deaths = 0;
    this.killStreak = 0;
    this.survivalTime = 0;
    this.ioScore = 100;
    this.ioLevel = 1;
    this.lastProcessedSeq = 0;
  }
}

defineTypes(PlayerSchema, {
  id: 'string',
  callsign: 'string',
  faction: 'string',
  team: 'string',
  blueprintId: 'string',
  role: 'string',
  cannonId: 'string',
  missileId: 'string',
  skinId: 'string',
  trailId: 'string',
  shieldStyleId: 'string',
  isBot: 'boolean',
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  angle: 'number',
  targetAngle: 'number',
  radius: 'number',
  hp: 'number',
  maxHp: 'number',
  shield: 'number',
  maxShield: 'number',
  energy: 'number',
  maxEnergy: 'number',
  shieldBrokenTimer: 'number',
  respawnTimer: 'number',
  isThrusting: 'boolean',
  thrustIntensity: 'number',
  carryingOrb: 'boolean',
  isDockedInBay: 'boolean',
  kills: 'number',
  deaths: 'number',
  killStreak: 'number',
  survivalTime: 'number',
  ioScore: 'number',
  ioLevel: 'number',
  lastProcessedSeq: 'number',
});

export class OrbPelletSchema extends Schema {
  declare id: string;
  declare x: number;
  declare y: number;
  declare radius: number;
  declare value: number;
  declare color: string;
  declare sides: number;

  constructor() {
    super();
    this.id = '';
    this.x = 0;
    this.y = 0;
    this.radius = 7;
    this.value = 15;
    this.color = '#05FFA1';
    this.sides = 5;
  }
}

defineTypes(OrbPelletSchema, {
  id: 'string',
  x: 'number',
  y: 'number',
  radius: 'number',
  value: 'number',
  color: 'string',
  sides: 'number',
});

export class ProjectileSchema extends Schema {
  declare id: string;
  declare ownerId: string;
  declare team: string;
  declare category: string;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;
  declare angle: number;
  declare damage: number;
  declare color: string;

  constructor() {
    super();
    this.id = '';
    this.ownerId = '';
    this.team = 'ALLY';
    this.category = 'CANNON';
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.damage = 14;
    this.color = '#00F0FF';
  }
}

defineTypes(ProjectileSchema, {
  id: 'string',
  ownerId: 'string',
  team: 'string',
  category: 'string',
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  angle: 'number',
  damage: 'number',
  color: 'string',
});

export class MothershipSchema extends Schema {
  declare id: string;
  declare team: string;
  declare faction: string;
  declare name: string;
  declare x: number;
  declare y: number;
  declare hp: number;
  declare maxHp: number;
  declare shield: number;
  declare maxShield: number;
  declare invulnerable: boolean;
  declare shieldBrokenTimer: number;

  constructor() {
    super();
    this.id = '';
    this.team = 'ALLY';
    this.faction = 'incorruptus';
    this.name = 'Mothership';
    this.x = 500;
    this.y = 1000;
    this.hp = 1500;
    this.maxHp = 1500;
    this.shield = 600;
    this.maxShield = 600;
    this.invulnerable = false;
    this.shieldBrokenTimer = 0;
  }
}

defineTypes(MothershipSchema, {
  id: 'string',
  team: 'string',
  faction: 'string',
  name: 'string',
  x: 'number',
  y: 'number',
  hp: 'number',
  maxHp: 'number',
  shield: 'number',
  maxShield: 'number',
  invulnerable: 'boolean',
  shieldBrokenTimer: 'number',
});

export class LeaderboardEntrySchema extends Schema {
  declare id: string;
  declare callsign: string;
  declare faction: string;
  declare team: string;
  declare ioScore: number;
  declare ioLevel: number;
  declare kills: number;

  constructor() {
    super();
    this.id = '';
    this.callsign = '';
    this.faction = 'incorruptus';
    this.team = 'ALLY';
    this.ioScore = 0;
    this.ioLevel = 1;
    this.kills = 0;
  }
}

defineTypes(LeaderboardEntrySchema, {
  id: 'string',
  callsign: 'string',
  faction: 'string',
  team: 'string',
  ioScore: 'number',
  ioLevel: 'number',
  kills: 'number',
});

export class FleetRoomState extends Schema {
  declare roomCode: string;
  declare roomName: string;
  declare modeId: string;
  declare allyScore: number;
  declare enemyScore: number;
  declare matchWinner: string;
  declare serverTick: number;
  declare orbActive: boolean;
  declare orbX: number;
  declare orbY: number;
  declare orbCarrierId: string;
  declare allyMothership: MothershipSchema;
  declare enemyMothership: MothershipSchema;
  declare players: MapSchema<PlayerSchema>;
  declare pellets: MapSchema<OrbPelletSchema>;
  declare projectiles: MapSchema<ProjectileSchema>;
  declare leaderboard: ArraySchema<LeaderboardEntrySchema>;

  constructor() {
    super();
    this.roomCode = 'SECTOR-ALPHA-1';
    this.roomName = 'Sector Alpha-1';
    this.modeId = 'team_match';
    this.allyScore = 0;
    this.enemyScore = 0;
    this.matchWinner = '';
    this.serverTick = 0;
    this.orbActive = false;
    this.orbX = 1500;
    this.orbY = 1000;
    this.orbCarrierId = '';
    this.allyMothership = new MothershipSchema();
    this.enemyMothership = new MothershipSchema();
    this.players = new MapSchema<PlayerSchema>();
    this.pellets = new MapSchema<OrbPelletSchema>();
    this.projectiles = new MapSchema<ProjectileSchema>();
    this.leaderboard = new ArraySchema<LeaderboardEntrySchema>();
  }
}

defineTypes(FleetRoomState, {
  roomCode: 'string',
  roomName: 'string',
  modeId: 'string',
  allyScore: 'number',
  enemyScore: 'number',
  matchWinner: 'string',
  serverTick: 'number',
  orbActive: 'boolean',
  orbX: 'number',
  orbY: 'number',
  orbCarrierId: 'string',
  allyMothership: MothershipSchema,
  enemyMothership: MothershipSchema,
  players: { map: PlayerSchema },
  pellets: { map: OrbPelletSchema },
  projectiles: { map: ProjectileSchema },
  leaderboard: [LeaderboardEntrySchema],
});
