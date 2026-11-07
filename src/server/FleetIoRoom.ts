import { Client, Room } from 'colyseus';
import {
  FACTIONS,
  getBlueprintForFactionAndTier,
  getKillStreakMilestone,
  getShipTierFromMass,
  SHIP_BLUEPRINTS,
  WEAPONS,
} from '../game/catalog';
import { FactionId, GameModeId, ShipBlueprint, WeaponSpec } from '../game/types';
import {
  FleetRoomState,
  LeaderboardEntrySchema,
  MothershipSchema,
  OrbPelletSchema,
  PlayerSchema,
  ProjectileSchema,
} from './FleetRoomState';
import { accountStore } from './accountStore';

const WORLD_WIDTH = 4800;
const WORLD_HEIGHT = 3200;
const TARGET_TOTAL_PILOTS = 12; // 10-20 total active pilots per room with AI backfill
const TARGET_PELLETS = 90;

export interface PlayerInputMessage {
  seq: number;
  targetAngle: number;
  isThrusting: boolean;
  thrustIntensity: number;
  firePrimary: boolean;
  fireSecondary: boolean;
  lockedTargetId: string | null;
}

export interface PlayerRefitMessage {
  callsign?: string;
  faction?: FactionId;
  blueprintId?: string;
  cannonId?: string;
  missileId?: string;
  skinId?: string;
  trailId?: string;
  shieldStyleId?: string;
}

export interface AuthoritativeWorldSnapshot {
  roomCode: string;
  roomName: string;
  modeId: GameModeId;
  allyScore: number;
  enemyScore: number;
  matchWinner: '' | 'ALLY' | 'ENEMY';
  matchRemainingSec?: number;
  serverTick: number;
  orbActive: boolean;
  orbX: number;
  orbY: number;
  orbCarrierId: string;
  allyMothership: {
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    shieldBrokenTimer: number;
  };
  enemyMothership: {
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    shieldBrokenTimer: number;
  };
  players: {
    id: string;
    callsign: string;
    faction: FactionId;
    team: 'ALLY' | 'ENEMY';
    blueprintId: string;
    role: string;
    cannonId: string;
    missileId: string;
    skinId: string;
    trailId: string;
    shieldStyleId: string;
    isBot: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    radius: number;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    energy: number;
    maxEnergy: number;
    shieldBrokenTimer: number;
    respawnTimer: number;
    isThrusting: boolean;
    thrustIntensity: number;
    carryingOrb: boolean;
    isDockedInBay: boolean;
    kills: number;
    deaths: number;
    killStreak: number;
    survivalTime: number;
    ioScore: number;
    ioLevel: 1 | 2 | 3;
    lastProcessedSeq: number;
  }[];
  pellets: {
    id: string;
    x: number;
    y: number;
    radius: number;
    value: number;
    color: string;
    sides: number;
  }[];
  projectiles: {
    id: string;
    ownerId: string;
    team: 'ALLY' | 'ENEMY';
    category: 'CANNON' | 'MISSILE' | 'TURRET';
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    damage: number;
    color: string;
  }[];
  leaderboard: {
    id: string;
    callsign: string;
    faction: FactionId;
    team: 'ALLY' | 'ENEMY';
    ioScore: number;
    ioLevel: number;
    kills: number;
  }[];
}

interface InternalPilotExtras {
  cannonCooldown: number;
  missileCooldown: number;
  energyRegen: number;
  shieldRegen: number;
  hullRegen: number;
  maxSpeed: number;
  thrustAccel: number;
  turnSpeed: number;
  thrusterEnergyDrain: number;
  firePrimaryHeld: boolean;
  fireSecondaryQueued: boolean;
  lockedTargetId: string | null;
  aiStrafeDir: number;
  aiRetreatToDock: boolean;
  inputCountThisSecond: number;
  lastRateResetTime: number;
}

interface InternalProjectileExtras {
  speed: number;
  shieldPiercing: number;
  homingTurnRate: number;
  targetId: string | null;
  life: number;
  maxLife: number;
}

const ASTEROID_POSITIONS: [number, number, number][] = [
  [1450, 680, 64],
  [1450, 2520, 68],
  [1850, 1220, 54],
  [1850, 1980, 54],
  [2400, 560, 74],
  [2400, 2640, 74],
  [2120, 1600, 48],
  [2680, 1600, 48],
  [2400, 1260, 52],
  [2400, 1940, 52],
  [2950, 1220, 54],
  [2950, 1980, 54],
  [3350, 680, 64],
  [3350, 2520, 68],
  [1180, 1600, 58],
  [3620, 1600, 58],
];

const BOT_CALLSIGNS = [
  'ZeroCool_X',
  'NeonWraith',
  'CipherBlade',
  'VoltRunner',
  'Valkyrie-9',
  'NovaStrike',
  'CyberWraith',
  'Kestrel-IX',
  'OrionPulse',
  'VortexZero',
  'AegisPrime',
  'HyperionX',
];

export class FleetIoRoom extends Room {
  public maxClients = 16;
  public roomState: FleetRoomState = new FleetRoomState();
  private pilotExtras = new Map<string, InternalPilotExtras>();
  private projExtras = new Map<string, InternalProjectileExtras>();
  private snapshotAccum = 0;
  private leaderboardAccum = 0;
  private allyTurretCd = 0;
  private enemyTurretCd = 0;
  private matchRemainingSec = 300; // 5-minute default countdown for Dogfight mode
  private orbVx = 0;
  private orbVy = 0;

  onCreate(options: {
    roomCode?: string;
    roomName?: string;
    modeId?: GameModeId;
  }) {
    const cleanCode = (options.roomCode || 'SECTOR-7').trim().toUpperCase();
    const modeId: GameModeId = options.modeId || 'team_match';

    this.roomState.roomCode = cleanCode;
    this.roomState.roomName = options.roomName || `Sector ${cleanCode}`;
    this.roomState.modeId = modeId;
    this.matchRemainingSec = modeId === 'dogfight' ? 300 : 900;

    this.setMetadata({
      roomCode: cleanCode,
      roomName: this.roomState.roomName,
      modeId,
      allyScore: 0,
      enemyScore: 0,
    });

    this.initMotherships(modeId);
    this.initPellets();
    this.syncAiBotPopulation();

    // Register client message handlers with anti-cheat validation
    this.onMessage('input', (client, payload: PlayerInputMessage) => {
      this.handlePlayerInput(client.sessionId, payload);
    });

    this.onMessage('refit', (client, payload: PlayerRefitMessage) => {
      this.handlePlayerRefit(client.sessionId, payload);
    });

    this.onMessage('ping_check', (client, payload: { t: number }) => {
      client.send('pong_check', { t: payload?.t || Date.now(), serverTime: Date.now() });
    });

    // 60Hz authoritative server physics & combat loop
    this.setSimulationInterval((dtMs) => {
      this.updateSimulation(Math.min(0.05, dtMs / 1000));
    }, 1000 / 60);
  }

  onJoin(
    client: Client,
    options: {
      callsign?: string;
      faction?: FactionId;
      blueprintId?: string;
      cannonId?: string;
      missileId?: string;
      skinId?: string;
      trailId?: string;
      shieldStyleId?: string;
    }
  ) {
    const faction: FactionId =
      options?.faction === 'omnitron' || options?.faction === 'aerie'
        ? options.faction
        : 'incorruptus';

    // Balance human teams
    let allyHumans = 0;
    let enemyHumans = 0;
    this.roomState.players.forEach((p) => {
      if (!p.isBot) {
        if (p.team === 'ALLY') allyHumans++;
        else enemyHumans++;
      }
    });
    const team: 'ALLY' | 'ENEMY' =
      this.roomState.modeId === 'aerie_invasion'
        ? 'ALLY'
        : allyHumans <= enemyHumans
          ? 'ALLY'
          : 'ENEMY';

    const bp =
      SHIP_BLUEPRINTS.find((b) => b.id === options?.blueprintId) ||
      getBlueprintForFactionAndTier(faction, 1);

    const base = team === 'ALLY' ? this.roomState.allyMothership : this.roomState.enemyMothership;
    const spawnX = base.x + (team === 'ALLY' ? 95 : -95);
    const spawnY = base.y + (Math.random() - 0.5) * 140;

    const p = this.spawnPilotSchema(
      client.sessionId,
      (options?.callsign || 'Pilot').slice(0, 18),
      faction,
      team,
      bp,
       false,
      spawnX,
      spawnY,
      options?.cannonId || bp.defaultCannonId,
      options?.missileId || bp.defaultMissileId,
      options?.skinId || 'skin_default',
      options?.trailId || 'trail_default',
      options?.shieldStyleId || 'shield_default'
    );

    this.roomState.players.set(client.sessionId, p);
    this.syncAiBotPopulation();
    this.recomputeLeaderboard();

    // Send immediate initial world snapshot on join
    client.send('world_snapshot', this.buildSnapshot());
  }

  async onDrop(client: Client, _code?: number) {
    try {
      // Allow 30 seconds for mobile/browser pilot reconnection
      await this.allowReconnection(client, 30);
    } catch {
      this.removePilot(client.sessionId);
    }
  }

  onReconnect(_client: Client) {
    // Player reconnected within 30s window; ship state is preserved
  }

  onLeave(client: Client, _code?: number) {
    this.removePilot(client.sessionId);
  }

  private removePilot(sessionId: string): void {
    const p = this.roomState.players.get(sessionId);
    if (p && p.carryingOrb) {
      this.roomState.orbCarrierId = '';
    }
    this.roomState.players.delete(sessionId);
    this.pilotExtras.delete(sessionId);
    this.syncAiBotPopulation();
    this.recomputeLeaderboard();
  }

  private initMotherships(modeId: GameModeId): void {
    const invuln = modeId === 'dogfight';

    const allyMs = new MothershipSchema();
    allyMs.id = 'mothership_ALLY';
    allyMs.team = 'ALLY';
    allyMs.faction = 'incorruptus';
    allyMs.name = FACTIONS.incorruptus.mothershipName;
    allyMs.x = 750;
    allyMs.y = WORLD_HEIGHT * 0.5;
    allyMs.hp = 1500;
    allyMs.maxHp = 1500;
    allyMs.shield = 600;
    allyMs.maxShield = 600;
    allyMs.invulnerable = invuln;
    this.roomState.allyMothership = allyMs;

    const enemyFaction: FactionId = modeId === 'aerie_invasion' ? 'aerie' : 'omnitron';
    const enemyMs = new MothershipSchema();
    enemyMs.id = 'mothership_ENEMY';
    enemyMs.team = 'ENEMY';
    enemyMs.faction = enemyFaction;
    enemyMs.name = FACTIONS[enemyFaction].mothershipName;
    enemyMs.x = WORLD_WIDTH - 750;
    enemyMs.y = WORLD_HEIGHT * 0.5;
    enemyMs.hp = 1500;
    enemyMs.maxHp = 1500;
    enemyMs.shield = 600;
    enemyMs.maxShield = 600;
    enemyMs.invulnerable = invuln;
    this.roomState.enemyMothership = enemyMs;

    this.roomState.orbActive = modeId === 'capture_orb';
    this.roomState.orbX = WORLD_WIDTH * 0.5;
    this.roomState.orbY = WORLD_HEIGHT * 0.5;
    this.roomState.orbCarrierId = '';
  }

  private initPellets(): void {
    this.roomState.pellets.clear();
    for (let i = 0; i < TARGET_PELLETS; i++) {
      this.spawnPellet();
    }
  }

  private spawnPellet(customX?: number, customY?: number, customValue?: number): void {
    const id = `orb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const roll = Math.random();
    const val =
      customValue !== undefined
        ? customValue
        : roll > 0.88
          ? 100
          : roll > 0.55
            ? 40
            : 15;
    const pel = new OrbPelletSchema();
    pel.id = id;
    pel.x = customX ?? 160 + Math.random() * (WORLD_WIDTH - 320);
    pel.y = customY ?? 140 + Math.random() * (WORLD_HEIGHT - 280);
    pel.value = val;
    pel.radius = val >= 80 ? 13 : val >= 35 ? 9.5 : 7;
    pel.color = val >= 80 ? '#FBBF24' : val >= 35 ? '#00F0FF' : '#05FFA1';
    pel.sides = val >= 80 ? 8 : val >= 35 ? 6 : 5;
    this.roomState.pellets.set(id, pel);
  }

  private spawnPilotSchema(
    id: string,
    callsign: string,
    faction: FactionId,
    team: 'ALLY' | 'ENEMY',
    bp: ShipBlueprint,
    isBot: boolean,
    x: number,
    y: number,
    cannonId: string,
    missileId: string,
    skinId = 'skin_default',
    trailId = 'trail_default',
    shieldStyleId = 'shield_default'
  ): PlayerSchema {
    const p = new PlayerSchema();
    p.id = id;
    p.callsign = callsign;
    p.faction = faction;
    p.team = team;
    p.blueprintId = bp.id;
    p.role = bp.role;
    p.cannonId = cannonId;
    p.missileId = missileId;
    p.skinId = skinId;
    p.trailId = trailId;
    p.shieldStyleId = shieldStyleId;
    p.isBot = isBot;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.angle = team === 'ALLY' ? 0 : Math.PI;
    p.targetAngle = p.angle;
    p.radius = bp.role === 'Heavy Frigate' ? 24 : bp.role === 'Hunter' ? 20 : 17;
    p.hp = bp.maxHp;
    p.maxHp = bp.maxHp;
    p.shield = bp.maxShield;
    p.maxShield = bp.maxShield;
    p.energy = bp.maxEnergy;
    p.maxEnergy = bp.maxEnergy;
    p.ioScore = isBot ? 100 + Math.floor(Math.random() * 260) : 100;
    p.ioLevel = getShipTierFromMass(p.ioScore).tier;

    this.pilotExtras.set(id, {
      cannonCooldown: 0,
      missileCooldown: 0,
      energyRegen: bp.energyRegen,
      shieldRegen: bp.shieldRegen,
      hullRegen: bp.hullRegen,
      maxSpeed: bp.maxSpeed,
      thrustAccel: bp.thrustAccel,
      turnSpeed: bp.turnSpeed,
      thrusterEnergyDrain: bp.thrusterEnergyDrain,
      firePrimaryHeld: false,
      fireSecondaryQueued: false,
      lockedTargetId: null,
      aiStrafeDir: Math.random() > 0.5 ? 1 : -1,
      aiRetreatToDock: false,
      inputCountThisSecond: 0,
      lastRateResetTime: Date.now(),
    });

    return p;
  }

  private syncAiBotPopulation(): void {
    let totalCount = this.roomState.players.size;

    // Remove excess AI bots if humans joined
    if (totalCount > TARGET_TOTAL_PILOTS) {
      const botIds: string[] = [];
      this.roomState.players.forEach((p, id) => {
        if (p.isBot) botIds.push(id);
      });
      while (totalCount > TARGET_TOTAL_PILOTS && botIds.length > 0) {
        const removeId = botIds.pop()!;
        this.roomState.players.delete(removeId);
        this.pilotExtras.delete(removeId);
        totalCount--;
      }
    }

    // Backfill with AI squadrons up to TARGET_TOTAL_PILOTS
    let botIndex = 0;
    while (this.roomState.players.size < TARGET_TOTAL_PILOTS) {
      let allyCount = 0;
      let enemyCount = 0;
      this.roomState.players.forEach((p) => {
        if (p.team === 'ALLY') allyCount++;
        else enemyCount++;
      });

      const team: 'ALLY' | 'ENEMY' = allyCount <= enemyCount ? 'ALLY' : 'ENEMY';
      const faction: FactionId =
        team === 'ALLY'
          ? 'incorruptus'
          : this.roomState.modeId === 'aerie_invasion'
            ? 'aerie'
            : 'omnitron';
      const bp = getBlueprintForFactionAndTier(faction, 1);
      const base =
        team === 'ALLY' ? this.roomState.allyMothership : this.roomState.enemyMothership;
      const botId = `bot_${team}_${Date.now()}_${botIndex++}`;
      const callsign = BOT_CALLSIGNS[botIndex % BOT_CALLSIGNS.length];

      const bot = this.spawnPilotSchema(
        botId,
        callsign,
        faction,
        team,
        bp,
        true,
        base.x + (team === 'ALLY' ? 120 : -120) + (Math.random() - 0.5) * 140,
        base.y + (Math.random() - 0.5) * 260,
        bp.defaultCannonId,
        bp.defaultMissileId
      );
      this.roomState.players.set(botId, bot);
    }
  }

  private handlePlayerInput(sessionId: string, input: PlayerInputMessage): void {
    const p = this.roomState.players.get(sessionId);
    const ex = this.pilotExtras.get(sessionId);
    if (!p || !ex || !input || typeof input !== 'object') return;

    // Anti-cheat packet flood protection (max 90 input packets/sec)
    const now = Date.now();
    if (now - ex.lastRateResetTime > 1000) {
      ex.lastRateResetTime = now;
      ex.inputCountThisSecond = 0;
    }
    ex.inputCountThisSecond++;
    if (ex.inputCountThisSecond > 90) return;

    // Anti-cheat NaN & bounds clamping
    if (typeof input.targetAngle === 'number' && Number.isFinite(input.targetAngle)) {
      p.targetAngle = Math.atan2(Math.sin(input.targetAngle), Math.cos(input.targetAngle));
    }
    p.isThrusting = Boolean(input.isThrusting);
    const rawIntensity =
      typeof input.thrustIntensity === 'number' && Number.isFinite(input.thrustIntensity)
        ? input.thrustIntensity
        : 0;
    p.thrustIntensity = Math.max(0, Math.min(1, rawIntensity));

    ex.firePrimaryHeld = Boolean(input.firePrimary);
    if (input.fireSecondary) {
      ex.fireSecondaryQueued = true;
    }
    if (typeof input.lockedTargetId === 'string' || input.lockedTargetId === null) {
      ex.lockedTargetId = input.lockedTargetId;
    }
    if (typeof input.seq === 'number' && Number.isFinite(input.seq)) {
      p.lastProcessedSeq = input.seq;
    }
  }

  private handlePlayerRefit(sessionId: string, refit: PlayerRefitMessage): void {
    const p = this.roomState.players.get(sessionId);
    const ex = this.pilotExtras.get(sessionId);
    if (!p || !ex || !refit) return;

    if (refit.callsign && typeof refit.callsign === 'string') {
      p.callsign = refit.callsign.trim().slice(0, 18) || p.callsign;
    }
    if (
      refit.faction === 'incorruptus' ||
      refit.faction === 'omnitron' ||
      refit.faction === 'aerie'
    ) {
      p.faction = refit.faction;
    }
    if (refit.blueprintId) {
      const bp = SHIP_BLUEPRINTS.find((b) => b.id === refit.blueprintId);
      if (bp) {
        p.blueprintId = bp.id;
        p.role = bp.role;
        p.radius = bp.role === 'Heavy Frigate' ? 24 : bp.role === 'Hunter' ? 20 : 17;
        p.maxHp = bp.maxHp;
        p.hp = bp.maxHp;
        p.maxShield = bp.maxShield;
        p.shield = bp.maxShield;
        p.maxEnergy = bp.maxEnergy;
        p.energy = bp.maxEnergy;
        ex.energyRegen = bp.energyRegen;
        ex.shieldRegen = bp.shieldRegen;
        ex.hullRegen = bp.hullRegen;
        ex.maxSpeed = bp.maxSpeed;
        ex.thrustAccel = bp.thrustAccel;
        ex.turnSpeed = bp.turnSpeed;
        ex.thrusterEnergyDrain = bp.thrusterEnergyDrain;
      }
    }
    if (refit.cannonId && WEAPONS[refit.cannonId]?.category === 'CANNON') {
      p.cannonId = refit.cannonId;
    }
    if (refit.missileId && WEAPONS[refit.missileId]?.category === 'MISSILE') {
      p.missileId = refit.missileId;
    }
    if (refit.skinId) p.skinId = refit.skinId;
    if (refit.trailId) p.trailId = refit.trailId;
    if (refit.shieldStyleId) p.shieldStyleId = refit.shieldStyleId;
  }

  private awardMassAndCheckEvolution(p: PlayerSchema, massDelta: number): void {
    const ex = this.pilotExtras.get(p.id);
    if (!ex) return;

    const prevTier = p.ioLevel as 1 | 2 | 3;
    p.ioScore = Math.max(100, p.ioScore + Math.round(massDelta));
    const tierInfo = getShipTierFromMass(p.ioScore, p.survivalTime);

    if (tierInfo.tier > prevTier) {
      p.ioLevel = tierInfo.tier;
      const evolvedBp = getBlueprintForFactionAndTier(p.faction as FactionId, tierInfo.tier);
      const tierMult = 1 + (tierInfo.tier - 1) * 0.12;
      p.blueprintId = evolvedBp.id;
      p.role = evolvedBp.role;
      p.radius =
        evolvedBp.role === 'Heavy Frigate' ? 24 : evolvedBp.role === 'Hunter' ? 20 : 17;
      p.maxHp = Math.round(evolvedBp.maxHp * tierMult);
      p.hp = Math.min(p.maxHp, p.hp + 55);
      p.maxShield = Math.round(evolvedBp.maxShield * tierMult);
      p.shield = Math.min(p.maxShield, p.shield + 55);
      ex.maxSpeed = evolvedBp.maxSpeed;
      ex.thrustAccel = evolvedBp.thrustAccel;
      ex.turnSpeed = evolvedBp.turnSpeed;

      this.broadcast('pilot_evolved', {
        pilotId: p.id,
        callsign: p.callsign,
        tier: tierInfo.tier,
        role: evolvedBp.role,
        label: tierInfo.label,
        x: p.x,
        y: p.y,
      });
    }
  }

  private updateSimulation(dt: number): void {
    this.roomState.serverTick++;

    // 1. Update Motherships & Defensive Turrets
    this.updateMothership(this.roomState.allyMothership, dt, true);
    this.updateMothership(this.roomState.enemyMothership, dt, false);

    // 2. Update All Pilots (Human + AI)
    this.roomState.players.forEach((p, id) => {
      const ex = this.pilotExtras.get(id);
      if (!ex) return;

      if (p.respawnTimer > 0) {
        p.respawnTimer = Math.max(0, p.respawnTimer - dt);
        if (p.respawnTimer === 0) {
          const base =
            p.team === 'ALLY' ? this.roomState.allyMothership : this.roomState.enemyMothership;
          const resetBp = getBlueprintForFactionAndTier(p.faction as FactionId, 1);
          p.blueprintId = resetBp.id;
          p.role = resetBp.role;
          p.radius = 17;
          p.maxHp = resetBp.maxHp;
          p.maxShield = resetBp.maxShield;
          p.maxEnergy = resetBp.maxEnergy;
          ex.maxSpeed = resetBp.maxSpeed;
          ex.thrustAccel = resetBp.thrustAccel;
          ex.turnSpeed = resetBp.turnSpeed;
          p.x = base.x + (p.team === 'ALLY' ? 90 : -90);
          p.y = base.y + (Math.random() - 0.5) * 110;
          p.vx = 0;
          p.vy = 0;
          p.hp = p.maxHp;
          p.shield = p.maxShield;
          p.energy = p.maxEnergy;
          p.shieldBrokenTimer = 0;
          p.killStreak = 0;
          p.survivalTime = 0;
          p.ioLevel = 1;
        }
        return;
      }

      // Accumulate survival time alive & check 3-tier survival progression
      const prevSurvFloor = Math.floor(p.survivalTime);
      p.survivalTime += dt;
      if (Math.floor(p.survivalTime) > prevSurvFloor) {
        this.awardMassAndCheckEvolution(p, 5);
      }

      ex.cannonCooldown = Math.max(0, ex.cannonCooldown - dt);
      ex.missileCooldown = Math.max(0, ex.missileCooldown - dt);
      if (p.shieldBrokenTimer > 0) {
        p.shieldBrokenTimer = Math.max(0, p.shieldBrokenTimer - dt);
      }

      const alliedBase =
        p.team === 'ALLY' ? this.roomState.allyMothership : this.roomState.enemyMothership;
      const distToDock = Math.hypot(p.x - alliedBase.x, p.y - alliedBase.y);
      p.isDockedInBay = alliedBase.hp > 0 && distToDock <= 225;

      if (p.isDockedInBay) {
        p.shieldBrokenTimer = 0;
        p.shield = Math.min(p.maxShield, p.shield + 140 * dt);
        p.energy = Math.min(p.maxEnergy, p.energy + 260 * dt);
        p.hp = Math.min(p.maxHp, p.hp + 95 * dt);
      } else {
        if (p.shieldBrokenTimer <= 0) {
          p.shield = Math.min(p.maxShield, p.shield + ex.shieldRegen * 1.35 * dt);
        }
        p.hp = Math.min(p.maxHp, p.hp + ex.hullRegen * dt);
        p.energy = Math.min(
          p.maxEnergy,
          p.energy + ex.energyRegen * (p.isThrusting ? 1.05 : 1.65) * dt
        );
      }

      if (p.isBot) {
        this.updateAiPilotLogic(p, ex);
      } else {
        if (ex.firePrimaryHeld) {
          this.fireProjectile(p, ex, 'CANNON', null);
        }
        if (ex.fireSecondaryQueued) {
          ex.fireSecondaryQueued = false;
          this.fireProjectile(p, ex, 'MISSILE', ex.lockedTargetId);
        }
      }

      // Server-enforced turn rate
      let diff = p.targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += Math.sign(diff) * Math.min(Math.abs(diff), ex.turnSpeed * dt);

      // Server-enforced thrust acceleration & energy drain
      if (p.isThrusting && p.energy > 1) {
        const accel = ex.thrustAccel * p.thrustIntensity;
        p.vx += Math.cos(p.angle) * accel * dt;
        p.vy += Math.sin(p.angle) * accel * dt;
        p.energy = Math.max(0, p.energy - ex.thrusterEnergyDrain * p.thrustIntensity * dt);
      }

      const drag = Math.pow(0.52, dt);
      p.vx *= drag;
      p.vy *= drag;

      // Server-enforced speed cap (anti-cheat)
      const speed = Math.hypot(p.vx, p.vy);
      const effectiveMaxSpeed = p.carryingOrb ? ex.maxSpeed * 0.85 : ex.maxSpeed;
      if (speed > effectiveMaxSpeed) {
        p.vx = (p.vx / speed) * effectiveMaxSpeed;
        p.vy = (p.vy / speed) * effectiveMaxSpeed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // World boundaries
      const margin = 45;
      if (p.x < margin) {
        p.x = margin;
        p.vx = Math.abs(p.vx) * 0.6;
      } else if (p.x > WORLD_WIDTH - margin) {
        p.x = WORLD_WIDTH - margin;
        p.vx = -Math.abs(p.vx) * 0.6;
      }
      if (p.y < margin) {
        p.y = margin;
        p.vy = Math.abs(p.vy) * 0.6;
      } else if (p.y > WORLD_HEIGHT - margin) {
        p.y = WORLD_HEIGHT - margin;
        p.vy = -Math.abs(p.vy) * 0.6;
      }

      // Asteroid collisions
      for (const [ax, ay, ar] of ASTEROID_POSITIONS) {
        const dx = p.x - ax;
        const dy = p.y - ay;
        const d = Math.hypot(dx, dy);
        const minDist = p.radius + ar;
        if (d < minDist && d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          p.x = ax + nx * minDist;
          p.y = ay + ny * minDist;
          const dot = p.vx * nx + p.vy * ny;
          if (dot < 0) {
            p.vx -= 1.5 * dot * nx;
            p.vy -= 1.5 * dot * ny;
          }
        }
      }
    });

    // 3. Update .io Energy Pellets (Magnetic Pull & Collection)
    const pickedPelletIds: string[] = [];
    this.roomState.pellets.forEach((pel, pelId) => {
      let nearestPilot: PlayerSchema | null = null;
      let nearestD = 125;

      this.roomState.players.forEach((p) => {
        if (p.respawnTimer > 0) return;
        const d = Math.hypot(p.x - pel.x, p.y - pel.y);
        if (d < nearestD) {
          nearestD = d;
          nearestPilot = p;
        }
      });

      if (nearestPilot) {
        const collector = nearestPilot as PlayerSchema;
        const pullAngle = Math.atan2(collector.y - pel.y, collector.x - pel.x);
        pel.x += Math.cos(pullAngle) * 260 * dt;
        pel.y += Math.sin(pullAngle) * 260 * dt;

        if (nearestD <= collector.radius + pel.radius + 8) {
          pickedPelletIds.push(pelId);
          collector.energy = Math.min(collector.maxEnergy, collector.energy + pel.value * 0.45);
          this.awardMassAndCheckEvolution(collector, pel.value);
          this.broadcast('orb_pickup', {
            pilotId: collector.id,
            x: pel.x,
            y: pel.y,
            value: pel.value,
            color: pel.color,
          });
        }
      }
    });

    for (const id of pickedPelletIds) {
      this.roomState.pellets.delete(id);
    }
    while (this.roomState.pellets.size < TARGET_PELLETS) {
      this.spawnPellet();
    }

    // 4. Update Projectiles & Server-Side Hit Detection
    this.updateProjectiles(dt);

    // 4.5. Update Server-Authoritative Capture the Orb Magnetic Tether & Timed Dogfight Countdown
    this.updateCaptureOrbServer(dt);
    if (!this.roomState.matchWinner && this.roomState.modeId === 'dogfight') {
      this.matchRemainingSec = Math.max(0, this.matchRemainingSec - dt);
      if (
        this.matchRemainingSec <= 0 ||
        this.roomState.allyScore >= 20 ||
        this.roomState.enemyScore >= 20
      ) {
        this.roomState.matchWinner =
          this.roomState.allyScore >= this.roomState.enemyScore ? 'ALLY' : 'ENEMY';
      }
    }

    // 5. Recompute Top-10 Leaderboard periodically
    this.leaderboardAccum += dt;
    if (this.leaderboardAccum >= 0.5) {
      this.leaderboardAccum = 0;
      this.recomputeLeaderboard();
    }

    // 6. Broadcast 20Hz Authoritative Snapshot
    this.snapshotAccum += dt;
    if (this.snapshotAccum >= 0.05) {
      this.snapshotAccum = 0;
      this.broadcast('world_snapshot', this.buildSnapshot());
    }
  }

  private updateCaptureOrbServer(dt: number): void {
    if (!this.roomState.orbActive || this.roomState.matchWinner) return;

    const carrierId = this.roomState.orbCarrierId;
    if (carrierId) {
      const carrier = this.roomState.players.get(carrierId);
      if (carrier && carrier.respawnTimer <= 0) {
        // Spring-damper magnetic tether trailing 38px behind the carrier ship
        const anchorX = carrier.x - Math.cos(carrier.angle) * 38;
        const anchorY = carrier.y - Math.sin(carrier.angle) * 38;
        const dx = anchorX - this.roomState.orbX;
        const dy = anchorY - this.roomState.orbY;
        this.orbVx = (this.orbVx + dx * 18 * dt) * Math.pow(0.18, dt);
        this.orbVy = (this.orbVy + dy * 18 * dt) * Math.pow(0.18, dt);
        this.roomState.orbX += this.orbVx * dt;
        this.roomState.orbY += this.orbVy * dt;

        const base =
          carrier.team === 'ALLY'
            ? this.roomState.allyMothership
            : this.roomState.enemyMothership;
        const enemyBase =
          carrier.team === 'ALLY'
            ? this.roomState.enemyMothership
            : this.roomState.allyMothership;

        // Server-validated capture zone check
        if (Math.hypot(carrier.x - base.x, carrier.y - base.y) <= 185) {
          carrier.carryingOrb = false;
          this.roomState.orbCarrierId = '';
          this.roomState.orbX = WORLD_WIDTH * 0.5;
          this.roomState.orbY = WORLD_HEIGHT * 0.5;
          this.orbVx = 0;
          this.orbVy = 0;

          enemyBase.shield = 0;
          enemyBase.hp = Math.max(0, enemyBase.hp - 500);
          if (carrier.team === 'ALLY') this.roomState.allyScore += 1;
          else this.roomState.enemyScore += 1;

          this.awardMassAndCheckEvolution(carrier, 250);
          if (!carrier.isBot) {
            accountStore.recordAuthoritativeCombatStats({
              callsign: carrier.callsign,
              orbCapturesDelta: 1,
              kpAward: 150,
              peakMass: carrier.ioScore,
              modeId: this.roomState.modeId,
            });
          }

          if (
            this.roomState.allyScore >= 3 ||
            this.roomState.enemyScore >= 3 ||
            enemyBase.hp <= 0
          ) {
            this.roomState.matchWinner = carrier.team;
          }
        }
      } else {
        this.roomState.orbCarrierId = '';
      }
    } else {
      // Decelerate free-floating orb and check for ship magnetic tether pickup / steal
      this.orbVx *= Math.pow(0.35, dt);
      this.orbVy *= Math.pow(0.35, dt);
      this.roomState.orbX = Math.max(
        80,
        Math.min(WORLD_WIDTH - 80, this.roomState.orbX + this.orbVx * dt)
      );
      this.roomState.orbY = Math.max(
        80,
        Math.min(WORLD_HEIGHT - 80, this.roomState.orbY + this.orbVy * dt)
      );

      this.roomState.players.forEach((p) => {
        if (this.roomState.orbCarrierId || p.respawnTimer > 0) return;
        if (Math.hypot(p.x - this.roomState.orbX, p.y - this.roomState.orbY) <= p.radius + 28) {
          p.carryingOrb = true;
          this.roomState.orbCarrierId = p.id;
        }
      });
    }
  }

  private updateMothership(ms: MothershipSchema, dt: number, isAlly: boolean): void {
    if (ms.hp <= 0) return;
    if (ms.shieldBrokenTimer > 0) {
      ms.shieldBrokenTimer = Math.max(0, ms.shieldBrokenTimer - dt);
    } else {
      ms.shield = Math.min(ms.maxShield, ms.shield + 14 * dt);
    }

    if (isAlly) this.allyTurretCd = Math.max(0, this.allyTurretCd - dt);
    else this.enemyTurretCd = Math.max(0, this.enemyTurretCd - dt);

    const cd = isAlly ? this.allyTurretCd : this.enemyTurretCd;
    if (cd <= 0) {
      let target: PlayerSchema | null = null;
      let bestDist = 560;
      this.roomState.players.forEach((p) => {
        if (p.team !== ms.team && p.respawnTimer <= 0) {
          const d = Math.hypot(p.x - ms.x, p.y - ms.y);
          if (d < bestDist) {
            bestDist = d;
            target = p;
          }
        }
      });

      if (target) {
        const tgt = target as PlayerSchema;
        if (isAlly) this.allyTurretCd = 0.85;
        else this.enemyTurretCd = 0.85;
        const aim = Math.atan2(tgt.y - ms.y, tgt.x - ms.x);
        const proj = new ProjectileSchema();
        proj.id = `tur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        proj.ownerId = ms.id;
        proj.team = ms.team;
        proj.category = 'TURRET';
        proj.x = ms.x + Math.cos(aim) * 84;
        proj.y = ms.y + Math.sin(aim) * 84;
        proj.vx = Math.cos(aim) * 780;
        proj.vy = Math.sin(aim) * 780;
        proj.angle = aim;
        proj.damage = 16;
        proj.color = '#00F0FF';
        this.roomState.projectiles.set(proj.id, proj);
        this.projExtras.set(proj.id, {
          speed: 780,
          shieldPiercing: 0.1,
          homingTurnRate: 0,
          targetId: null,
          life: 0,
          maxLife: 0.75,
        });
      }
    }
  }

  private updateAiPilotLogic(bot: PlayerSchema, ex: InternalPilotExtras): void {
    const alliedBase =
      bot.team === 'ALLY' ? this.roomState.allyMothership : this.roomState.enemyMothership;
    const enemyBase =
      bot.team === 'ALLY' ? this.roomState.enemyMothership : this.roomState.allyMothership;

    if (bot.hp < bot.maxHp * 0.32 || bot.energy < 15) {
      ex.aiRetreatToDock = true;
    } else if (bot.hp > bot.maxHp * 0.85 && bot.energy > bot.maxEnergy * 0.75) {
      ex.aiRetreatToDock = false;
    }

    if (ex.aiRetreatToDock && alliedBase.hp > 0) {
      bot.targetAngle = Math.atan2(alliedBase.y - bot.y, alliedBase.x - bot.x);
      bot.isThrusting = Math.hypot(alliedBase.x - bot.x, alliedBase.y - bot.y) > 90;
      bot.thrustIntensity = 0.9;
      return;
    }

    let nearestEnemy: PlayerSchema | null = null;
    let nearestDist = 99999;
    this.roomState.players.forEach((other) => {
      if (other.team !== bot.team && other.respawnTimer <= 0) {
        const d = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = other;
        }
      }
    });

    if (nearestEnemy && (nearestDist < 920 || enemyBase.invulnerable)) {
      const enemy = nearestEnemy as PlayerSchema;
      const aimAngle = Math.atan2(
        enemy.y + enemy.vy * 0.15 - bot.y,
        enemy.x + enemy.vx * 0.15 - bot.x
      );
      if (nearestDist < 220) {
        bot.targetAngle = aimAngle + ex.aiStrafeDir * 0.45;
        bot.isThrusting = true;
        bot.thrustIntensity = 0.65;
      } else {
        bot.targetAngle = aimAngle;
        bot.isThrusting = nearestDist > 260;
        bot.thrustIntensity = 0.85;
      }

      const angleErr = Math.abs(
        Math.atan2(Math.sin(aimAngle - bot.angle), Math.cos(aimAngle - bot.angle))
      );
      if (nearestDist < 680 && angleErr < 0.28 && bot.energy > 25) {
        this.fireProjectile(bot, ex, 'CANNON', null);
      }
      if (nearestDist > 220 && nearestDist < 850 && bot.energy > 45 && Math.random() < 0.025) {
        this.fireProjectile(bot, ex, 'MISSILE', enemy.id);
      }
    } else if (!enemyBase.invulnerable && enemyBase.hp > 0) {
      const distMs = Math.hypot(enemyBase.x - bot.x, enemyBase.y - bot.y);
      const aimMs = Math.atan2(enemyBase.y - bot.y, enemyBase.x - bot.x);
      bot.targetAngle = distMs < 260 ? aimMs + ex.aiStrafeDir * 0.6 : aimMs;
      bot.isThrusting = distMs > 320;
      bot.thrustIntensity = 0.8;
      if (distMs < 680 && bot.energy > 30) {
        this.fireProjectile(bot, ex, 'CANNON', null);
      }
    }
  }

  private fireProjectile(
    shooter: PlayerSchema,
    ex: InternalPilotExtras,
    category: 'CANNON' | 'MISSILE',
    targetId: string | null
  ): void {
    const spec: WeaponSpec =
      category === 'CANNON'
        ? WEAPONS[shooter.cannonId] || WEAPONS.pulse_laser
        : WEAPONS[shooter.missileId] || WEAPONS.valkyrie_seeker;

    const cd = category === 'CANNON' ? ex.cannonCooldown : ex.missileCooldown;
    if (cd > 0 || shooter.energy < spec.energyCost) return;

    if (category === 'CANNON') ex.cannonCooldown = 1 / spec.fireRate;
    else ex.missileCooldown = 1 / spec.fireRate;

    shooter.energy = Math.max(0, shooter.energy - spec.energyCost);

    const count = spec.projectilesPerShot;
    for (let i = 0; i < count; i++) {
      const offsetAngle =
        count === 1
          ? (Math.random() - 0.5) * spec.spreadAngle
          : (i - (count - 1) * 0.5) * spec.spreadAngle;
      const fireAngle = shooter.angle + offsetAngle;
      const proj = new ProjectileSchema();
      proj.id = `${category === 'CANNON' ? 'c' : 'm'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      proj.ownerId = shooter.id;
      proj.team = shooter.team;
      proj.category = category;
      proj.x = shooter.x + Math.cos(fireAngle) * (shooter.radius + 7);
      proj.y = shooter.y + Math.sin(fireAngle) * (shooter.radius + 7);
      proj.vx =
        (category === 'CANNON' ? shooter.vx * 0.25 : 0) +
        Math.cos(fireAngle) * spec.projectileSpeed;
      proj.vy =
        (category === 'CANNON' ? shooter.vy * 0.25 : 0) +
        Math.sin(fireAngle) * spec.projectileSpeed;
      proj.angle = fireAngle;
      proj.damage = spec.damage;
      proj.color = spec.color;

      this.roomState.projectiles.set(proj.id, proj);
      this.projExtras.set(proj.id, {
        speed: spec.projectileSpeed,
        shieldPiercing: spec.shieldPiercing,
        homingTurnRate: spec.homingTurnRate,
        targetId,
        life: 0,
        maxLife: spec.range / spec.projectileSpeed,
      });
    }
  }

  private updateProjectiles(dt: number): void {
    const expiredIds: string[] = [];

    this.roomState.projectiles.forEach((p, id) => {
      const pex = this.projExtras.get(id);
      if (!pex) {
        expiredIds.push(id);
        return;
      }

      pex.life += dt;
      if (pex.life >= pex.maxLife) {
        expiredIds.push(id);
        return;
      }

      if (p.category === 'MISSILE' && pex.targetId && pex.homingTurnRate > 0) {
        const targetFighter = this.roomState.players.get(pex.targetId);
        if (targetFighter && targetFighter.respawnTimer <= 0) {
          const desired = Math.atan2(targetFighter.y - p.y, targetFighter.x - p.x);
          let diff = desired - p.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.angle += Math.sign(diff) * Math.min(Math.abs(diff), pex.homingTurnRate * dt);
          p.vx = Math.cos(p.angle) * pex.speed;
          p.vy = Math.sin(p.angle) * pex.speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Asteroid obstacle collision
      for (const [ax, ay, ar] of ASTEROID_POSITIONS) {
        if (Math.hypot(p.x - ax, p.y - ay) < ar) {
          expiredIds.push(id);
          return;
        }
      }

      // Fighter hit validation
      let hitFighter = false;
      this.roomState.players.forEach((target) => {
        if (hitFighter || target.team === p.team || target.respawnTimer > 0) return;
        if (Math.hypot(p.x - target.x, p.y - target.y) <= target.radius + 6) {
          hitFighter = true;
          this.applyAuthoritativeHit(target, p, pex);
          expiredIds.push(id);
        }
      });
      if (hitFighter) return;

      // Mothership hit validation
      const hostileMs =
        p.team === 'ALLY' ? this.roomState.enemyMothership : this.roomState.allyMothership;
      if (!hostileMs.invulnerable && hostileMs.hp > 0) {
        if (Math.hypot(p.x - hostileMs.x, p.y - hostileMs.y) <= 112) {
          const absorbed = Math.min(hostileMs.shield, Math.round(p.damage * 0.8));
          const hullDmg = Math.max(1, p.damage - absorbed);
          hostileMs.shield = Math.max(0, hostileMs.shield - absorbed);
          hostileMs.hp = Math.max(0, hostileMs.hp - hullDmg);
          if (hostileMs.hp <= 0 && !this.roomState.matchWinner) {
            this.roomState.matchWinner = p.team;
          }
          expiredIds.push(id);
        }
      }
    });

    for (const id of expiredIds) {
      this.roomState.projectiles.delete(id);
      this.projExtras.delete(id);
    }
  }

  private applyAuthoritativeHit(
    target: PlayerSchema,
    p: ProjectileSchema,
    pex: InternalProjectileExtras
  ): void {
    const hadShield = target.shield > 0;
    const directHull = Math.round(p.damage * pex.shieldPiercing);
    const shieldPortion = p.damage - directHull;
    const absorbed = Math.min(target.shield, shieldPortion);
    const overflow = Math.max(0, shieldPortion - absorbed);
    const hullDmg = directHull + overflow;

    target.shield = Math.max(0, target.shield - absorbed);
    target.hp = Math.max(0, target.hp - hullDmg);

    const shieldBroke = hadShield && target.shield <= 0 && target.hp > 0;
    if (shieldBroke) {
      target.shieldBrokenTimer = 4.2;
    }

    this.broadcast('combat_hit', {
      targetId: target.id,
      attackerId: p.ownerId,
      x: p.x,
      y: p.y,
      shieldDmg: absorbed,
      armorDmg: hullDmg,
      isHeavy: p.category === 'MISSILE' || p.damage >= 22,
      shieldBroke,
      angle: p.angle,
    });

    if (target.hp <= 0) {
      target.deaths += 1;
      target.respawnTimer = 4.2;
      target.killStreak = 0;
      if (target.carryingOrb) {
        target.carryingOrb = false;
        if (this.roomState.orbCarrierId === target.id) {
          this.roomState.orbCarrierId = '';
          this.orbVx = target.vx * 0.4;
          this.orbVy = target.vy * 0.4;
        }
      }
      const survivedSec = target.survivalTime || 0;
      target.survivalTime = 0;
      if (!target.isBot) {
        accountStore.recordAuthoritativeCombatStats({
          callsign: target.callsign,
          deathsDelta: 1,
          peakMass: target.ioScore,
          survivalSec: survivedSec,
          modeId: this.roomState.modeId,
        });
      }
      const shooter = this.roomState.players.get(p.ownerId);
      if (shooter) {
        shooter.kills += 1;
        shooter.killStreak = (shooter.killStreak || 0) + 1;
        const streakSpec = getKillStreakMilestone(shooter.killStreak);
        if (streakSpec) {
          this.awardMassAndCheckEvolution(shooter, streakSpec.bonusMass);
          this.broadcast('kill_streak', {
            pilotId: shooter.id,
            callsign: shooter.callsign,
            streak: shooter.killStreak,
            title: streakSpec.title,
            subtitle: streakSpec.subtitle,
            badgeText: streakSpec.badgeText,
            voiceoverLine: streakSpec.voiceoverLine,
            soundCueId: streakSpec.soundCueId,
            accentColor: streakSpec.accentColor,
            glowColor: streakSpec.glowColor,
            x: shooter.x,
            y: shooter.y,
          });
        }
        this.awardMassAndCheckEvolution(shooter, 120 + Math.round(target.ioScore * 0.25));
        if (!shooter.isBot) {
          accountStore.recordAuthoritativeCombatStats({
            callsign: shooter.callsign,
            killsDelta: 1,
            kpAward: 50 + (streakSpec ? Math.round(streakSpec.bonusMass * 0.5) : 0),
            peakMass: shooter.ioScore,
          });
        }
      }

      // Drop 5 high-value .io loot orbs on ship destruction
      for (let i = 0; i < 5; i++) {
        this.spawnPellet(
          target.x + (Math.random() - 0.5) * 60,
          target.y + (Math.random() - 0.5) * 60,
          50
        );
      }
      target.ioScore = 100;
      target.ioLevel = 1;

      if (p.team === 'ALLY') this.roomState.allyScore += 1;
      else this.roomState.enemyScore += 1;

      this.broadcast('ship_destroyed', {
        victimId: target.id,
        victimName: target.callsign,
        killerId: shooter ? shooter.id : p.ownerId,
        killerName: shooter ? shooter.callsign : 'Mothership Turret',
        killerTeam: p.team as 'ALLY' | 'ENEMY',
        x: target.x,
        y: target.y,
      });
    }
  }

  private recomputeLeaderboard(): void {
    const all: PlayerSchema[] = [];
    this.roomState.players.forEach((p) => all.push(p));
    all.sort((a, b) => b.ioScore - a.ioScore || b.kills - a.kills);

    this.roomState.leaderboard.clear();
    for (const p of all.slice(0, 10)) {
      const entry = new LeaderboardEntrySchema();
      entry.id = p.id;
      entry.callsign = p.callsign;
      entry.faction = p.faction;
      entry.team = p.team;
      entry.ioScore = p.ioScore;
      entry.ioLevel = p.ioLevel;
      entry.kills = p.kills;
      this.roomState.leaderboard.push(entry);
    }

    this.setMetadata({
      roomCode: this.roomState.roomCode,
      roomName: this.roomState.roomName,
      modeId: this.roomState.modeId,
      allyScore: this.roomState.allyScore,
      enemyScore: this.roomState.enemyScore,
    });
  }

  private buildSnapshot(): AuthoritativeWorldSnapshot {
    const players: AuthoritativeWorldSnapshot['players'] = [];
    this.roomState.players.forEach((p) => {
      players.push({
        id: p.id,
        callsign: p.callsign,
        faction: p.faction as FactionId,
        team: p.team as 'ALLY' | 'ENEMY',
        blueprintId: p.blueprintId,
        role: p.role,
        cannonId: p.cannonId,
        missileId: p.missileId,
        skinId: p.skinId,
        trailId: p.trailId,
        shieldStyleId: p.shieldStyleId,
        isBot: p.isBot,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vy: Math.round(p.vy * 10) / 10,
        angle: Math.round(p.angle * 1000) / 1000,
        radius: p.radius,
        hp: Math.round(p.hp),
        maxHp: p.maxHp,
        shield: Math.round(p.shield),
        maxShield: p.maxShield,
        energy: Math.round(p.energy),
        maxEnergy: p.maxEnergy,
        shieldBrokenTimer: Math.round(p.shieldBrokenTimer * 10) / 10,
        respawnTimer: Math.round(p.respawnTimer * 10) / 10,
        isThrusting: p.isThrusting,
        thrustIntensity: Math.round(p.thrustIntensity * 100) / 100,
        carryingOrb: p.carryingOrb,
        isDockedInBay: p.isDockedInBay,
        kills: p.kills,
        deaths: p.deaths,
        killStreak: p.killStreak || 0,
        survivalTime: Math.round((p.survivalTime || 0) * 10) / 10,
        ioScore: p.ioScore,
        ioLevel: (p.ioLevel as 1 | 2 | 3) || 1,
        lastProcessedSeq: p.lastProcessedSeq,
      });
    });

    const pellets: AuthoritativeWorldSnapshot['pellets'] = [];
    this.roomState.pellets.forEach((pel) => {
      pellets.push({
        id: pel.id,
        x: Math.round(pel.x),
        y: Math.round(pel.y),
        radius: pel.radius,
        value: pel.value,
        color: pel.color,
        sides: pel.sides,
      });
    });

    const projectiles: AuthoritativeWorldSnapshot['projectiles'] = [];
    this.roomState.projectiles.forEach((pr) => {
      projectiles.push({
        id: pr.id,
        ownerId: pr.ownerId,
        team: pr.team as 'ALLY' | 'ENEMY',
        category: pr.category as 'CANNON' | 'MISSILE' | 'TURRET',
        x: Math.round(pr.x),
        y: Math.round(pr.y),
        vx: Math.round(pr.vx),
        vy: Math.round(pr.vy),
        angle: Math.round(pr.angle * 100) / 100,
        damage: pr.damage,
        color: pr.color,
      });
    });

    const leaderboard: AuthoritativeWorldSnapshot['leaderboard'] = [];
    this.roomState.leaderboard.forEach((lb) => {
      leaderboard.push({
        id: lb.id,
        callsign: lb.callsign,
        faction: lb.faction as FactionId,
        team: lb.team as 'ALLY' | 'ENEMY',
        ioScore: lb.ioScore,
        ioLevel: lb.ioLevel,
        kills: lb.kills,
      });
    });

    return {
      roomCode: this.roomState.roomCode,
      roomName: this.roomState.roomName,
      modeId: this.roomState.modeId as GameModeId,
      allyScore: this.roomState.allyScore,
      enemyScore: this.roomState.enemyScore,
      matchWinner: (this.roomState.matchWinner as '' | 'ALLY' | 'ENEMY') || '',
      matchRemainingSec: Math.ceil(this.matchRemainingSec),
      serverTick: this.roomState.serverTick,
      orbActive: this.roomState.orbActive,
      orbX: Math.round(this.roomState.orbX),
      orbY: Math.round(this.roomState.orbY),
      orbCarrierId: this.roomState.orbCarrierId,
      allyMothership: {
        hp: Math.round(this.roomState.allyMothership.hp),
        maxHp: this.roomState.allyMothership.maxHp,
        shield: Math.round(this.roomState.allyMothership.shield),
        maxShield: this.roomState.allyMothership.maxShield,
        shieldBrokenTimer: this.roomState.allyMothership.shieldBrokenTimer,
      },
      enemyMothership: {
        hp: Math.round(this.roomState.enemyMothership.hp),
        maxHp: this.roomState.enemyMothership.maxHp,
        shield: Math.round(this.roomState.enemyMothership.shield),
        maxShield: this.roomState.enemyMothership.maxShield,
        shieldBrokenTimer: this.roomState.enemyMothership.shieldBrokenTimer,
      },
      players,
      pellets,
      projectiles,
      leaderboard,
    };
  }
}
