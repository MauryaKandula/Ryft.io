import { soundEngine } from '../audio/soundEngine';
import {
  COSMETIC_ITEMS,
  FACTIONS,
  SHIP_BLUEPRINTS,
  WEAPONS,
  getBlueprintForFactionAndTier,
  getKillStreakMilestone,
  getShipTierFromMass,
} from './catalog';
import {
  AsteroidObstacle,
  CaptureOrbState,
  FactionId,
  FighterEntity,
  FloatingCombatText,
  GameModeId,
  IoPellet,
  KillFeedItem,
  KillStreakAnnouncement,
  LeaderboardEntry,
  MothershipEntity,
  OffscreenBracketBlip,
  ParticleEffect,
  PilotProfile,
  PowerUpDrop,
  ProjectileEntity,
  ShipBlueprint,
} from './types';
import type {
  AuthoritativeWorldSnapshot,
  CombatHitEvent,
  KillStreakNetworkEvent,
  OrbPickupEvent,
  PilotEvolvedEvent,
  PlayerInputMessage,
  ShipDestroyedEvent,
} from '../network/colyseusClient';

export const WORLD_WIDTH = 4800;
export const WORLD_HEIGHT = 3200;
export const SECTOR_CELL_SIZE = 400; // 12 cols (A..L) x 8 rows (1..8)

const COSMETIC_MAP = new Map(COSMETIC_ITEMS.map((c) => [c.id, c]));

interface StarLayerPoint {
  x: number;
  y: number;
  size: number;
  alpha: number;
  parallax: number;
  color: string;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  colorInner: string;
  colorOuter: string;
  parallax: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

interface ExhaustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  life: number;
  maxLife: number;
  colorCore: string;
  colorMid: string;
  colorTail: string;
}

export class RealtimePocketFleetArena {
  public modeId: GameModeId = 'team_match';
  public fighters: FighterEntity[] = [];
  public motherships: { ALLY: MothershipEntity; ENEMY: MothershipEntity };
  public projectiles: ProjectileEntity[] = [];
  public powerUps: PowerUpDrop[] = [];
  public asteroids: AsteroidObstacle[] = [];
  public particles: ParticleEffect[] = [];
  public exhaustParticles: ExhaustParticle[] = [];
  public shockwaves: ShockwaveRing[] = [];
  public floatingTexts: FloatingCombatText[] = [];
  public killFeed: KillFeedItem[] = [];
  public orb: CaptureOrbState;
  public pellets: IoPellet[] = [];

  public allyScore: number = 0;
  public enemyScore: number = 0;
  public targetScore: number = 20;
  public matchWinner: 'ALLY' | 'ENEMY' | null = null;
  public matchElapsed: number = 0;
  public showTacticalGrid: boolean = true;
  public activeAnnouncement: KillStreakAnnouncement | null = null;

  // Authoritative Colyseus Multiplayer State
  public isAuthoritativeOnline: boolean = false;
  public localSessionId: string | null = null;
  private lastInputSentAt: number = 0;
  private inputSendCallback: ((input: Omit<PlayerInputMessage, 'seq'>) => void) | null = null;

  // Camera & Screen-Shake Trauma / Impulse State
  public camX: number = 550;
  public camY: number = WORLD_HEIGHT * 0.5;
  public shakeTime: number = 0;
  public shakeMag: number = 0;
  public shakeTrauma: number = 0;
  public shakePhase: number = 0;
  public shakeImpulseX: number = 0;
  public shakeImpulseY: number = 0;
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;
  public shakeRot: number = 0;
  public screenFlashAlpha: number = 0;
  public screenFlashColor: string = '#FF2A6D';
  public hitstopTimer: number = 0;

  // Desktop Mouse + Mobile Touch / Tilt Unified Controls
  public mouseScreenX: number = 0;
  public mouseScreenY: number = 0;
  public mouseActive: boolean = false;
  public leftMouseHeld: boolean = false;
  public rightMouseJustPressed: boolean = false;

  // Mobile On-Screen HUD Button States
  public touchThrottleHeld: boolean = false;
  public touchPrimaryHeld: boolean = false;
  public touchSecondaryJustPressed: boolean = false;
  public touchSteerAxis: number = 0;
  public lockedTargetId: string | null = null;

  private stars: StarLayerPoint[] = [];
  private nebulae: NebulaCloud[] = [];
  private fighterTrails: Map<string, { x: number; y: number }[]> = new Map();
  private wsSendCallback: ((payload: unknown) => void) | null = null;
  private bgBlackwallBlueImg: HTMLImageElement | null = null;
  private bgBlackwallRedImg: HTMLImageElement | null = null;

  constructor() {
    if (typeof Image !== 'undefined') {
      const blueImg = new Image();
      blueImg.src = '/assets/blackwall_blue.png';
      this.bgBlackwallBlueImg = blueImg;

      const redImg = new Image();
      redImg.src = '/assets/blackwall_red.png';
      this.bgBlackwallRedImg = redImg;
    }

    const colors = ['#E2E8F0', '#38BDF8', '#00F0FF', '#818CF8', '#FF003C'];
    for (let i = 0; i < 320; i++) {
      this.stars.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        size: (i % 5 === 0 ? 2.1 : 1.3),
        alpha: 0.25 + (i % 4) * 0.18,
        parallax: 0.16 + (i % 4) * 0.18,
        color: colors[i % colors.length],
      });
    }

    // Deep Obsidian-Void & Cyber-Indigo Nebula Pockets (darker atmospheric depth)
    this.nebulae = [
      {
        x: 750,
        y: 1200,
        radius: 820,
        colorInner: 'rgba(6, 28, 42, 0.34)',
        colorOuter: 'rgba(2, 6, 12, 0)',
        parallax: 0.28,
      },
      {
        x: 1950,
        y: 1050,
        radius: 920,
        colorInner: 'rgba(15, 23, 52, 0.32)',
        colorOuter: 'rgba(2, 6, 12, 0)',
        parallax: 0.34,
      },
      {
        x: 2850,
        y: 1950,
        radius: 880,
        colorInner: 'rgba(8, 33, 46, 0.30)',
        colorOuter: 'rgba(2, 6, 12, 0)',
        parallax: 0.31,
      },
      {
        x: 3900,
        y: 1500,
        radius: 820,
        colorInner: 'rgba(30, 12, 38, 0.28)',
        colorOuter: 'rgba(2, 6, 12, 0)',
        parallax: 0.29,
      },
    ];

    this.motherships = {
      ALLY: this.createMothership('ALLY', 'incorruptus', 750, WORLD_HEIGHT * 0.5, false),
      ENEMY: this.createMothership('ENEMY', 'omnitron', WORLD_WIDTH - 750, WORLD_HEIGHT * 0.5, false),
    };

    this.orb = {
      active: false,
      x: WORLD_WIDTH * 0.5,
      y: WORLD_HEIGHT * 0.5,
      homeX: WORLD_WIDTH * 0.5,
      homeY: WORLD_HEIGHT * 0.5,
      carrierId: null,
      carrierTeam: null,
      megaBeamTimer: 0,
      megaBeamSourceX: 0,
      megaBeamSourceY: 0,
      megaBeamTargetX: 0,
      megaBeamTargetY: 0,
    };

    this.initAsteroids();
  }

  public setWebSocketSender(cb: ((payload: unknown) => void) | null): void {
    this.wsSendCallback = cb;
  }

  public setColyseusInputSender(
    cb: ((input: Omit<PlayerInputMessage, 'seq'>) => void) | null
  ): void {
    this.inputSendCallback = cb;
  }

  public setAuthoritativeMode(online: boolean, sessionId: string | null): void {
    this.isAuthoritativeOnline = online;
    this.localSessionId = sessionId;
  }

  public getLeaderboard(): LeaderboardEntry[] {
    const sorted = [...this.fighters].sort((a, b) => (b.ioScore ?? 0) - (a.ioScore ?? 0));
    return sorted.slice(0, 10).map((f, idx) => ({
      id: f.id,
      callsign: f.callsign,
      faction: f.faction,
      team: f.team,
      ioScore: Math.round(f.ioScore ?? 100),
      ioLevel: f.ioLevel ?? 1,
      kills: f.kills,
      killStreak: f.killStreak ?? 0,
      survivalTime: Math.round(f.survivalTime ?? 0),
      isPlayer: Boolean(f.isPlayer),
      isLeader: idx === 0 && (f.ioScore ?? 0) > 100,
    }));
  }

  public applyAuthoritativeSnapshot(
    snapshot: AuthoritativeWorldSnapshot,
    localSessionId: string | null
  ): void {
    this.isAuthoritativeOnline = true;
    this.localSessionId = localSessionId;
    this.allyScore = snapshot.allyScore;
    this.enemyScore = snapshot.enemyScore;
    this.matchWinner =
      snapshot.matchWinner === 'ALLY' || snapshot.matchWinner === 'ENEMY'
        ? snapshot.matchWinner
        : null;

    if (snapshot.allyMothership) {
      this.motherships.ALLY.hp = snapshot.allyMothership.hp;
      this.motherships.ALLY.maxHp = snapshot.allyMothership.maxHp;
      this.motherships.ALLY.shield = snapshot.allyMothership.shield;
      this.motherships.ALLY.maxShield = snapshot.allyMothership.maxShield;
      this.motherships.ALLY.shieldBrokenTimer = snapshot.allyMothership.shieldBrokenTimer;
    }
    if (snapshot.enemyMothership) {
      this.motherships.ENEMY.hp = snapshot.enemyMothership.hp;
      this.motherships.ENEMY.maxHp = snapshot.enemyMothership.maxHp;
      this.motherships.ENEMY.shield = snapshot.enemyMothership.shield;
      this.motherships.ENEMY.maxShield = snapshot.enemyMothership.maxShield;
      this.motherships.ENEMY.shieldBrokenTimer = snapshot.enemyMothership.shieldBrokenTimer;
    }

    if (typeof snapshot.orbActive === 'boolean') {
      this.orb.active = snapshot.orbActive;
      this.orb.carrierId = snapshot.orbCarrierId || null;
      if (Number.isFinite(snapshot.orbX) && Number.isFinite(snapshot.orbY)) {
        const orbDrift = Math.hypot(snapshot.orbX - this.orb.x, snapshot.orbY - this.orb.y);
        if (orbDrift > 180) {
          this.orb.x = snapshot.orbX;
          this.orb.y = snapshot.orbY;
        } else {
          this.orb.x += (snapshot.orbX - this.orb.x) * 0.45;
          this.orb.y += (snapshot.orbY - this.orb.y) * 0.45;
        }
      }
    }

    const seenFighterIds = new Set<string>();
    const now = performance.now();

    for (const pSnap of snapshot.players) {
      seenFighterIds.add(pSnap.id);
      const isLocal = Boolean(localSessionId && pSnap.id === localSessionId);

      let fighter = this.fighters.find(
        (f) => f.id === pSnap.id || (isLocal && f.isPlayer)
      );

      const bp =
        SHIP_BLUEPRINTS.find((b) => b.id === pSnap.blueprintId) ||
        getBlueprintForFactionAndTier(pSnap.faction, pSnap.ioLevel);

      if (!fighter) {
        fighter = this.createFighter(
          pSnap.id,
          pSnap.callsign,
          'Pilot',
          bp.name,
          isLocal,
          pSnap.team,
          pSnap.faction,
          bp,
          pSnap.x,
          pSnap.y,
          0,
          pSnap.cannonId,
          pSnap.missileId
        );
        fighter.isRemoteHuman = !isLocal;
        this.fighters.push(fighter);
      }

      fighter.id = pSnap.id;
      fighter.isPlayer = isLocal;
      fighter.isRemoteHuman = !isLocal;
      fighter.callsign = pSnap.callsign;
      fighter.shipClassLabel = bp.name;
      fighter.team = pSnap.team;
      fighter.faction = pSnap.faction;
      fighter.blueprintId = pSnap.blueprintId;
      fighter.role = pSnap.role as FighterEntity['role'];
      fighter.radius = pSnap.radius;
      fighter.hp = pSnap.hp;
      fighter.maxHp = pSnap.maxHp;
      fighter.shield = pSnap.shield;
      fighter.maxShield = pSnap.maxShield;
      fighter.energy = pSnap.energy;
      fighter.maxEnergy = pSnap.maxEnergy;
      fighter.shieldBrokenTimer = pSnap.shieldBrokenTimer;
      fighter.respawnTimer = pSnap.respawnTimer;
      fighter.carryingOrb = pSnap.carryingOrb;
      fighter.isDockedInBay = pSnap.isDockedInBay;
      fighter.kills = pSnap.kills;
      fighter.deaths = pSnap.deaths;
      fighter.killStreak = pSnap.killStreak ?? 0;
      fighter.survivalTime = pSnap.survivalTime ?? 0;
      fighter.ioScore = pSnap.ioScore;
      fighter.ioLevel = pSnap.ioLevel;
      fighter.skinId = pSnap.skinId;
      fighter.trailId = pSnap.trailId;
      fighter.shieldStyleId = pSnap.shieldStyleId;

      if (isLocal) {
        const drift = Math.hypot(pSnap.x - fighter.x, pSnap.y - fighter.y);
        if (drift > 140 || pSnap.respawnTimer > 0) {
          fighter.x = pSnap.x;
          fighter.y = pSnap.y;
          fighter.vx = pSnap.vx;
          fighter.vy = pSnap.vy;
        } else if (drift > 18) {
          fighter.x += (pSnap.x - fighter.x) * 0.25;
          fighter.y += (pSnap.y - fighter.y) * 0.25;
          fighter.vx += (pSnap.vx - fighter.vx) * 0.25;
          fighter.vy += (pSnap.vy - fighter.vy) * 0.25;
        }
      } else {
        fighter.serverX = pSnap.x;
        fighter.serverY = pSnap.y;
        fighter.serverVx = pSnap.vx;
        fighter.serverVy = pSnap.vy;
        fighter.serverAngle = pSnap.angle;
        fighter.lastServerUpdate = now;
        fighter.isThrusting = pSnap.isThrusting;
        fighter.thrustIntensity = pSnap.thrustIntensity;
      }
    }

    this.fighters = this.fighters.filter((f) => seenFighterIds.has(f.id));

    const existingPelletMap = new Map<string, IoPellet>();
    for (let i = 0; i < this.pellets.length; i++) {
      existingPelletMap.set(this.pellets[i].id, this.pellets[i]);
    }
    const nextPellets: IoPellet[] = [];
    for (let i = 0; i < snapshot.pellets.length; i++) {
      const pl = snapshot.pellets[i];
      const prev = existingPelletMap.get(pl.id);
      if (prev) {
        prev.x += (pl.x - prev.x) * 0.55;
        prev.y += (pl.y - prev.y) * 0.55;
        prev.value = pl.value;
        prev.radius = pl.radius;
        prev.color = pl.color;
        prev.sides = pl.sides;
        nextPellets.push(prev);
      } else {
        nextPellets.push({
          id: pl.id,
          x: pl.x,
          y: pl.y,
          vx: 0,
          vy: 0,
          value: pl.value,
          radius: pl.radius,
          color: pl.color,
          pulsePhase: Math.random() * Math.PI * 2,
          sides: pl.sides,
        });
      }
    }
    this.pellets = nextPellets;

    const existingProjMap = new Map<string, ProjectileEntity>();
    for (let i = 0; i < this.projectiles.length; i++) {
      existingProjMap.set(this.projectiles[i].id, this.projectiles[i]);
    }
    const nextProjs: ProjectileEntity[] = [];
    for (let i = 0; i < snapshot.projectiles.length; i++) {
      const pr = snapshot.projectiles[i];
      const prev = existingProjMap.get(pr.id);
      if (prev) {
        // Gently blend projectile position with authoritative snapshot while keeping 60fps velocity glide
        const drift = Math.hypot(pr.x - prev.x, pr.y - prev.y);
        if (drift > 90) {
          prev.x = pr.x;
          prev.y = pr.y;
        } else {
          prev.x += (pr.x - prev.x) * 0.45;
          prev.y += (pr.y - prev.y) * 0.45;
        }
        prev.vx = pr.vx;
        prev.vy = pr.vy;
        prev.angle = pr.angle;
        prev.color = pr.color;
        nextProjs.push(prev);
      } else {
        nextProjs.push({
          id: pr.id,
          ownerId: pr.ownerId,
          team: pr.team,
          category: pr.category,
          x: pr.x,
          y: pr.y,
          vx: pr.vx,
          vy: pr.vy,
          angle: pr.angle,
          speed: Math.hypot(pr.vx, pr.vy) || 850,
          damage: pr.damage || 18,
          shieldPiercing: 0.1,
          homingTurnRate: 0,
          targetId: null,
          life: 0,
          maxLife: 1.5,
          color: pr.color,
          trail: [{ x: pr.x, y: pr.y }],
        });
      }
    }
    this.projectiles = nextProjs;
  }

  public handleNetworkCombatHit(ev: CombatHitEvent): void {
    const targetFighter = this.fighters.find((f) => f.id === ev.targetId);
    const shooterFighter = this.fighters.find((f) => f.id === ev.attackerId);
    if (targetFighter) {
      targetFighter.hitFlashTimer = 0.14;
      if (ev.shieldDmg > 0) targetFighter.shieldRippleTimer = 0.28;
    }

    const involvesPlayer = Boolean(targetFighter?.isPlayer || shooterFighter?.isPlayer);
    if (involvesPlayer) {
      soundEngine.playHit(ev.shieldDmg > 0, ev.isHeavy);
    }

    const hitOriginX = targetFighter ? targetFighter.x : ev.x;
    const hitOriginY = targetFighter ? targetFighter.y : ev.y;
    const hitRadius = targetFighter ? targetFighter.radius : 18;
    this.spawnDamageNumbers(
      hitOriginX,
      hitOriginY,
      ev.shieldDmg,
      ev.armorDmg,
      ev.isHeavy,
      ev.angle,
      hitRadius
    );
    this.spawnParticles(
      ev.x,
      ev.y,
      ev.shieldDmg > 0 ? '#38BDF8' : '#FB923C',
      ev.isHeavy ? 18 : 8,
      0.85
    );

    const totalDmg = Math.max(1, (ev.shieldDmg || 0) + (ev.armorDmg || 0));

    if (ev.shieldBroke) {
      const shatterColor = targetFighter?.team === 'ALLY' ? '#00F0FF' : '#FF2A6D';
      this.spawnShockwave(ev.x, ev.y, shatterColor, 62);
      this.spawnFloatingText(ev.x, ev.y - 28, 'SHIELD BROKEN!', '#38BDF8', {
        vx: 0,
        vy: -65,
        scale: 1.18,
        kind: 'SHIELD',
      });
    }

    if (targetFighter?.isPlayer) {
      this.triggerDamageShake(totalDmg, ev.angle, ev.shieldDmg, ev.armorDmg, ev.shieldBroke);
    } else {
      const blastYield = totalDmg * (ev.isHeavy ? 1.45 : 0.85) + (ev.shieldBroke ? 32 : 0);
      this.triggerExplosionShake(
        ev.x,
        ev.y,
        blastYield,
        960,
        ev.shieldBroke ? '#00F0FF' : ev.armorDmg > 0 ? '#FB923C' : undefined,
        ev.angle
      );
    }
  }

  public handleNetworkShipDestroyed(ev: ShipDestroyedEvent): void {
    this.pushKillEvent(ev.killerName, ev.victimName, ev.killerTeam);
    this.spawnParticles(ev.x, ev.y, '#FBBF24', 44, 1.4);
    this.spawnShockwave(ev.x, ev.y, '#FBBF24', 115);
    const dist = Math.hypot(ev.x - this.camX, ev.y - this.camY);
    if (dist < 1000) {
      soundEngine.playExplosion();
    }
    this.triggerExplosionShake(ev.x, ev.y, 130, 1220, '#FBBF24');
  }

  public handleNetworkOrbPickup(ev: OrbPickupEvent): void {
    const picker = this.fighters.find((f) => f.id === ev.pilotId);
    if (picker?.isPlayer) {
      soundEngine.playRepair();
      this.spawnFloatingText(ev.x, ev.y - 16, `+${ev.value} MASS`, '#14F1D9', {
        vx: 0,
        vy: -52,
        scale: ev.value >= 70 ? 1.18 : 0.96,
        kind: 'STATUS',
      });
    }
    this.spawnParticles(ev.x, ev.y, '#14F1D9', 6, 0.45);
  }

  public handleNetworkPilotEvolved(ev: PilotEvolvedEvent): void {
    const pilot = this.fighters.find((f) => f.id === ev.pilotId);
    if (pilot) {
      this.spawnShockwave(pilot.x, pilot.y, '#FBBF24', 105);
      this.spawnParticles(pilot.x, pilot.y, '#14F1D9', 28, 1.2);
      this.spawnFloatingText(
        pilot.x,
        pilot.y - 34,
        `TIER ${ev.tier}: ${ev.label.toUpperCase()}!`,
        '#FBBF24',
        {
          vx: 0,
          vy: -68,
          scale: 1.28,
          kind: 'CRITICAL',
        }
      );
      if (pilot.isPlayer) {
        this.triggerShake(5.5, 0.25, undefined, '#14F1D9');
        const survSec = Math.round(pilot.survivalTime || 0);
        const tierAnn: KillStreakAnnouncement = {
          id: `tier_${Date.now()}_${Math.random()}`,
          pilotId: pilot.id,
          callsign: pilot.callsign,
          isPlayer: true,
          kind: 'TIER_UP',
          tierLevel: ev.tier,
          title: `SHIP LEVEL UP · TIER ${ev.tier === 3 ? 'III' : 'II'}`,
          subtitle: `${ev.role.toUpperCase()} CLASS UNLOCKED (${survSec}s SURVIVED)`,
          badgeText: `⬆ TIER ${ev.tier}/3 EVOLUTION`,
          voiceoverLine:
            ev.tier === 3
              ? 'Tier Three Heavy Frigate unlocked! Maximum hull and firepower online!'
              : 'Tier Two Hunter class unlocked! Enhanced shields and thrusters online!',
          soundCueId: ev.tier === 3 ? 'TIER_3' : 'TIER_2',
          accentColor: ev.tier === 3 ? '#FBBF24' : '#14F1D9',
          glowColor:
            ev.tier === 3 ? 'rgba(251, 191, 36, 0.52)' : 'rgba(20, 241, 217, 0.45)',
          createdAt: performance.now(),
          duration: 3200,
        };
        this.activeAnnouncement = tierAnn;
        soundEngine.triggerAnnouncementAudio(tierAnn);
      }
    }
  }

  public handleNetworkKillStreak(ev: KillStreakNetworkEvent): void {
    const pilot = this.fighters.find((f) => f.id === ev.pilotId);
    const isLocalPlayer = Boolean(pilot?.isPlayer || ev.pilotId === 'local_player');

    if (pilot) {
      pilot.killStreak = ev.streak;
      this.spawnShockwave(pilot.x, pilot.y, ev.accentColor, 125);
      this.spawnParticles(pilot.x, pilot.y, ev.accentColor, 36, 1.35);
      this.spawnFloatingText(
        pilot.x,
        pilot.y - 42,
        `${ev.badgeText} · ${ev.title}`,
        ev.accentColor,
        {
          vx: 0,
          vy: -74,
          scale: 1.34,
          kind: 'CRITICAL',
        }
      );
    }

    const milestoneSpec = getKillStreakMilestone(ev.streak);
    const resolvedCueId: KillStreakAnnouncement['soundCueId'] =
      ev.soundCueId ||
      milestoneSpec?.soundCueId ||
      (ev.streak >= 10 ? 'STREAK_10' : ev.streak >= 5 ? 'STREAK_5' : 'STREAK_3');
    const resolvedVoiceover =
      ev.voiceoverLine ||
      milestoneSpec?.voiceoverLine ||
      (ev.streak >= 10
        ? 'Unstoppable! Ten kill streak! Supreme Fleet Ace!'
        : ev.streak >= 5
          ? 'Rampage! Five kill streak! Sector dominance!'
          : 'Killing Spree! Three consecutive kills!');

    const streakAnn: KillStreakAnnouncement = {
      id: `streak_${Date.now()}_${Math.random()}`,
      pilotId: ev.pilotId,
      callsign: ev.callsign,
      isPlayer: isLocalPlayer,
      kind: 'KILL_STREAK',
      streakCount: ev.streak,
      title: isLocalPlayer ? ev.title : `${ev.callsign.toUpperCase()} · ${ev.title}`,
      subtitle: ev.subtitle,
      badgeText: ev.badgeText,
      voiceoverLine: resolvedVoiceover,
      soundCueId: resolvedCueId,
      accentColor: ev.accentColor,
      glowColor: ev.glowColor,
      createdAt: performance.now(),
      duration: 3600,
    };

    if (isLocalPlayer) {
      soundEngine.triggerAnnouncementAudio(streakAnn);
      this.triggerShake(
        ev.streak >= 10 ? 9.5 : ev.streak >= 5 ? 7.5 : 5.5,
        0.28,
        undefined,
        ev.accentColor
      );
    }

    // Show visual notification banner when the player (or any pilot if no player streak banner is active) hits 3, 5, or 10 kills in a row
    if (
      isLocalPlayer ||
      !this.activeAnnouncement ||
      performance.now() - this.activeAnnouncement.createdAt > this.activeAnnouncement.duration
    ) {
      this.activeAnnouncement = streakAnn;
    }
  }

  private createMothership(
    team: 'ALLY' | 'ENEMY',
    faction: FactionId,
    x: number,
    y: number,
    invulnerable: boolean
  ): MothershipEntity {
    return {
      id: `mothership_${team}`,
      team,
      faction,
      name: FACTIONS[faction].mothershipName,
      x,
      y,
      radius: 112,
      dockRadius: 175,
      hp: 1500,
      maxHp: 1500,
      shield: 600,
      maxShield: 600,
      invulnerable,
      rotation: 0,
      turretCooldown: 0,
      hitFlashTimer: 0,
      shieldRippleTimer: 0,
      shieldBrokenTimer: 0,
    };
  }

  private initAsteroids(): void {
    this.asteroids = [];
    const positions = [
      [1400, 620, 62],
      [1400, 2580, 64],
      [1820, 1180, 54],
      [1820, 2020, 56],
      [2120, 520, 70],
      [2120, 2680, 68],
      [2400, 960, 52],
      [2400, 2240, 52],
      [2680, 520, 68],
      [2680, 2680, 70],
      [2980, 1180, 56],
      [2980, 2020, 54],
      [3400, 620, 64],
      [3400, 2580, 62],
      [2080, 1600, 48],
      [2720, 1600, 48],
    ];
    positions.forEach(([x, y, r], idx) => {
      const vertices: { x: number; y: number }[] = [];
      const count = 11;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const rad = r * (0.76 + ((Math.sin(idx * 5 + i * 2.3) + 1) * 0.5) * 0.34);
        vertices.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
      }
      this.asteroids.push({
        id: `ast_${idx}`,
        x,
        y,
        radius: r,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.24,
        vertices,
      });
    });
  }

  public startMatch(modeId: GameModeId, profile: PilotProfile): void {
    this.modeId = modeId;
    this.fighters = [];
    this.projectiles = [];
    this.powerUps = [];
    this.particles = [];
    this.exhaustParticles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.killFeed = [];
    this.allyScore = 0;
    this.enemyScore = 0;
    this.matchWinner = null;
    this.matchElapsed = 0;

    const allyFaction = profile.selectedFaction;
    const enemyFaction: FactionId =
      modeId === 'aerie_invasion'
        ? 'aerie'
        : allyFaction === 'incorruptus'
          ? 'omnitron'
          : 'incorruptus';

    const invulnMotherships = modeId === 'dogfight';
    this.targetScore = modeId === 'capture_orb' ? 3 : modeId === 'dogfight' ? 20 : 1500;

    this.motherships = {
      ALLY: this.createMothership('ALLY', allyFaction, 750, WORLD_HEIGHT * 0.5, invulnMotherships),
      ENEMY: this.createMothership(
        'ENEMY',
        enemyFaction,
        WORLD_WIDTH - 750,
        WORLD_HEIGHT * 0.5,
        invulnMotherships
      ),
    };

    this.orb = {
      active: modeId === 'capture_orb',
      x: WORLD_WIDTH * 0.5,
      y: WORLD_HEIGHT * 0.5,
      homeX: WORLD_WIDTH * 0.5,
      homeY: WORLD_HEIGHT * 0.5,
      carrierId: null,
      carrierTeam: null,
      megaBeamTimer: 0,
      megaBeamSourceX: 0,
      megaBeamSourceY: 0,
      megaBeamTargetX: 0,
      megaBeamTargetY: 0,
    };

    const playerBpId = profile.selectedShipByFaction[allyFaction] || SHIP_BLUEPRINTS[0].id;
    const playerBp =
      SHIP_BLUEPRINTS.find((b) => b.id === playerBpId) ||
      SHIP_BLUEPRINTS.find((b) => b.faction === allyFaction)!;
    const upgradeLvl = profile.shipUpgrades[playerBp.id] || 0;

    const playerFighter = this.createFighter(
      'local_player',
      profile.callsign || 'Kuro-7',
      'Freelancer',
      playerBp.name,
      true,
      'ALLY',
      allyFaction,
      playerBp,
      this.motherships.ALLY.x,
      this.motherships.ALLY.y - 10,
      upgradeLvl,
      profile.selectedCannonByShip[playerBp.id] || playerBp.defaultCannonId,
      profile.selectedMissileByShip[playerBp.id] || playerBp.defaultMissileId
    );
    playerFighter.angle = -Math.PI * 0.5;
    playerFighter.targetAngle = -Math.PI * 0.5;
    this.fighters.push(playerFighter);

    this.camX = playerFighter.x;
    this.camY = playerFighter.y;

    const allyRoster = [
      { name: 'NeonWraith', rank: 'Veteran' },
      { name: 'ZeroCool_X', rank: 'Rookie' },
      { name: 'VoltRunner', rank: 'Novice' },
      { name: 'CipherBlade', rank: 'Captain' },
    ];
    allyRoster.forEach((pilot, i) => {
      const factionShips = SHIP_BLUEPRINTS.filter((b) => b.faction === allyFaction);
      const bp = factionShips[i % factionShips.length];
      const angle = (i / allyRoster.length) * Math.PI * 2;
      this.fighters.push(
        this.createFighter(
          `ally_bot_${i}`,
          pilot.name,
          pilot.rank,
          bp.name,
          false,
          'ALLY',
          allyFaction,
          bp,
          this.motherships.ALLY.x + Math.cos(angle) * 145,
          this.motherships.ALLY.y + Math.sin(angle) * 145,
          0
        )
      );
    });

    const enemyRoster = [
      { name: 'Rookie Cyber Mantis', rank: 'Rookie', bpId: 'omn_spectre', fac: 'omnitron' as FactionId },
      { name: 'Novice Helix Ravager', rank: 'Novice', bpId: 'aer_ravager', fac: 'aerie' as FactionId },
      { name: 'Novice Vector Drone', rank: 'Novice', bpId: 'omn_vector', fac: 'omnitron' as FactionId },
      { name: 'GlitchApex', rank: 'Hunter', bpId: 'omn_spectre', fac: enemyFaction },
      { name: 'Helix-Prime', rank: 'Veteran', bpId: 'aer_stinger', fac: 'aerie' as FactionId },
    ];

    enemyRoster.forEach((ep, i) => {
      const bp =
        SHIP_BLUEPRINTS.find((b) => b.id === ep.bpId) ||
        SHIP_BLUEPRINTS.find((b) => b.faction === enemyFaction)!;
      const offsetY = (i - 2) * 120;
      this.fighters.push(
        this.createFighter(
          `enemy_bot_${i}`,
          ep.name,
          ep.rank,
          bp.name,
          false,
          'ENEMY',
          ep.fac,
          bp,
          this.motherships.ENEMY.x - 180 - (i % 2) * 120,
          this.motherships.ENEMY.y + offsetY,
          0
        )
      );
    });

    this.FloatingTextsResetAndInitPellets(profile, playerFighter);
  }

  private FloatingTextsResetAndInitPellets(
    profile: PilotProfile,
    playerFighter: FighterEntity
  ): void {
    playerFighter.skinId = profile.selectedSkinId || 'skin_default';
    playerFighter.trailId = profile.selectedTrailId || 'trail_default';
    playerFighter.shieldStyleId = profile.selectedShieldId || 'shield_default';
    playerFighter.ioScore = 100;
    playerFighter.ioLevel = 1;

    this.pellets = [];
    for (let i = 0; i < 90; i++) {
      this.spawnLocalPellet(`pellet_${i}`);
    }

    this.killFeed = [
      {
        id: 'kf_1',
        killerName: 'NeonWraith',
        victimName: 'Rookie Cyber Mantis',
        killerTeam: 'ALLY',
        timestamp: Date.now() - 3000,
      },
      {
        id: 'kf_2',
        killerName: 'CipherBlade',
        victimName: 'Novice Helix Ravager',
        killerTeam: 'ALLY',
        timestamp: Date.now() - 1800,
      },
      {
        id: 'kf_3',
        killerName: 'VoltRunner',
        victimName: 'Novice Vector Drone',
        killerTeam: 'ALLY',
        timestamp: Date.now() - 600,
      },
    ];
  }

  private spawnLocalPellet(
    id: string,
    x?: number,
    y?: number,
    value?: number,
    isLootDrop: boolean = false
  ): void {
    const roll = Math.random();
    const val = value ?? (roll > 0.9 ? 100 : roll > 0.65 ? 40 : 15);
    const radius = val >= 100 ? 13 : val >= 40 ? 9.5 : 6.8;
    const colors = ['#14F1D9', '#38BDF8', '#FBBF24', '#A855F7', '#10B981'];
    const color =
      val >= 100
        ? '#FBBF24'
        : val >= 40
          ? '#38BDF8'
          : colors[Math.floor(Math.random() * colors.length)];

    this.pellets.push({
      id,
      x: x ?? 140 + Math.random() * (WORLD_WIDTH - 280),
      y: y ?? 140 + Math.random() * (WORLD_HEIGHT - 280),
      vx: isLootDrop ? (Math.random() - 0.5) * 90 : 0,
      vy: isLootDrop ? (Math.random() - 0.5) * 90 : 0,
      value: val,
      radius,
      color,
      pulsePhase: Math.random() * Math.PI * 2,
      isLootDrop,
    });
  }

  private awardLocalPilotMass(pilot: FighterEntity, amount: number): void {
    pilot.ioScore = (pilot.ioScore ?? 100) + amount;
    pilot.energy = Math.min(pilot.maxEnergy, pilot.energy + amount * 0.45);
    pilot.shield = Math.min(pilot.maxShield, pilot.shield + amount * 0.25);

    const nextTierInfo = getShipTierFromMass(pilot.ioScore, pilot.survivalTime ?? 0);
    const currentTier = pilot.ioLevel ?? 1;
    if (nextTierInfo.tier > currentTier) {
      pilot.ioLevel = nextTierInfo.tier;
      const evolvedBp = getBlueprintForFactionAndTier(pilot.faction, nextTierInfo.tier);
      const tierMult = 1 + (nextTierInfo.tier - 1) * 0.12;
      pilot.blueprintId = evolvedBp.id;
      pilot.shipClassLabel = evolvedBp.name;
      pilot.role = evolvedBp.role;
      pilot.radius =
        evolvedBp.role === 'Heavy Frigate' ? 24 : evolvedBp.role === 'Hunter' ? 20 : 17;
      pilot.maxHp = Math.round(evolvedBp.maxHp * tierMult);
      pilot.hp = pilot.maxHp;
      pilot.maxShield = Math.round(evolvedBp.maxShield * tierMult);
      pilot.shield = pilot.maxShield;
      pilot.maxEnergy = evolvedBp.maxEnergy;
      pilot.energy = evolvedBp.maxEnergy;
      pilot.maxSpeed = evolvedBp.maxSpeed;
      pilot.thrustAccel = evolvedBp.thrustAccel;
      pilot.turnSpeed = evolvedBp.turnSpeed;

      this.handleNetworkPilotEvolved({
        pilotId: pilot.id,
        callsign: pilot.callsign,
        tier: nextTierInfo.tier,
        role: evolvedBp.role,
        label: evolvedBp.name,
        x: pilot.x,
        y: pilot.y,
      });
    }
  }

  private updateLocalPellets(dt: number): void {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const pl = this.pellets[i];
      pl.pulsePhase += dt * 4.2;
      if (this.isAuthoritativeOnline) continue;

      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;
      pl.vx *= Math.pow(0.25, dt);
      pl.vy *= Math.pow(0.25, dt);

      // Magnetic pull toward nearby ships
      for (const f of this.fighters) {
        if (f.respawnTimer > 0) continue;
        const dx = f.x - pl.x;
        const dy = f.y - pl.y;
        const d = Math.hypot(dx, dy);
        if (d < f.radius + pl.radius + 8) {
          this.awardLocalPilotMass(f, pl.value);
          if (f.isPlayer) {
            soundEngine.playRepair();
            this.spawnFloatingText(pl.x, pl.y - 14, `+${pl.value} MASS`, pl.color, {
              vx: 0,
              vy: -52,
              scale: pl.value >= 70 ? 1.16 : 0.96,
              kind: 'STATUS',
            });
          }
          this.spawnParticles(pl.x, pl.y, pl.color, 6, 0.45);
          this.pellets.splice(i, 1);
          if (!pl.isLootDrop) {
            this.spawnLocalPellet(`pellet_${Date.now()}_${Math.random()}`);
          }
          break;
        } else if (d < 130 && d > 1) {
          const pull = (1 - d / 130) * 240;
          pl.x += (dx / d) * pull * dt;
          pl.y += (dy / d) * pull * dt;
        }
      }
    }
  }

  public createFighter(
    id: string,
    callsign: string,
    rankTitle: string,
    shipClassLabel: string,
    isPlayer: boolean,
    team: 'ALLY' | 'ENEMY',
    faction: FactionId,
    bp: ShipBlueprint,
    x: number,
    y: number,
    upgradeLevel: number = 0,
    cannonId?: string,
    missileId?: string
  ): FighterEntity {
    const statMult = 1 + upgradeLevel * 0.08;
    return {
      id,
      callsign,
      rankTitle,
      shipClassLabel,
      isPlayer,
      team,
      faction,
      blueprintId: bp.id,
      role: bp.role,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: team === 'ALLY' ? 0 : Math.PI,
      targetAngle: team === 'ALLY' ? 0 : Math.PI,
      radius: bp.role === 'Heavy Frigate' ? 24 : bp.role === 'Hunter' ? 20 : 17,
      hp: Math.round(bp.maxHp * statMult),
      maxHp: Math.round(bp.maxHp * statMult),
      shield: Math.round(bp.maxShield * statMult),
      maxShield: Math.round(bp.maxShield * statMult),
      energy: bp.maxEnergy,
      maxEnergy: bp.maxEnergy,
      energyRegen: bp.energyRegen * statMult,
      shieldRegen: bp.shieldRegen * statMult,
      hullRegen: bp.hullRegen * statMult,
      maxSpeed: bp.maxSpeed * (1 + upgradeLevel * 0.03),
      thrustAccel: bp.thrustAccel * (1 + upgradeLevel * 0.03),
      turnSpeed: bp.turnSpeed,
      thrusterEnergyDrain: bp.thrusterEnergyDrain,
      cannonId: cannonId || bp.defaultCannonId,
      missileId: missileId || bp.defaultMissileId,
      cannonCooldown: 0,
      missileCooldown: 0,
      isThrusting: false,
      thrustIntensity: 0,
      overchargeTimer: 0,
      hitFlashTimer: 0,
      shieldRippleTimer: 0,
      shieldBrokenTimer: 0,
      respawnTimer: 0,
      carryingOrb: false,
      isDockedInBay: false,
      kills: 0,
      deaths: 0,
      assists: 0,
      killStreak: 0,
      survivalTime: 0,
      aiTargetId: null,
      aiRetreatToDock: false,
      aiStrafeDir: Math.random() > 0.5 ? 1 : -1,
      ioScore: isPlayer ? 100 : 100 + Math.floor(Math.random() * 140),
      ioLevel: 1,
      skinId: 'skin_default',
      trailId: 'trail_default',
      shieldStyleId: 'shield_default',
    };
  }

  public refitPlayerShip(profile: PilotProfile): void {
    const player = this.getPlayer();
    if (!player) return;

    const faction = profile.selectedFaction;
    const bpId = profile.selectedShipByFaction[faction];
    const bp =
      SHIP_BLUEPRINTS.find((b) => b.id === bpId) ||
      SHIP_BLUEPRINTS.find((b) => b.faction === faction)!;
    const upgradeLvl = profile.shipUpgrades[bp.id] || 0;
    const statMult = 1 + upgradeLvl * 0.08;

    player.callsign = profile.callsign || 'Sanuku';
    player.faction = faction;
    player.blueprintId = bp.id;
    player.shipClassLabel = bp.name;
    player.role = bp.role;
    player.radius = bp.role === 'Heavy Frigate' ? 24 : bp.role === 'Hunter' ? 20 : 17;
    player.maxHp = Math.round(bp.maxHp * statMult);
    player.hp = player.maxHp;
    player.maxShield = Math.round(bp.maxShield * statMult);
    player.shield = player.maxShield;
    player.maxEnergy = bp.maxEnergy;
    player.energy = player.maxEnergy;
    player.energyRegen = bp.energyRegen * statMult;
    player.shieldRegen = bp.shieldRegen * statMult;
    player.hullRegen = bp.hullRegen * statMult;
    player.maxSpeed = bp.maxSpeed * (1 + upgradeLvl * 0.03);
    player.thrustAccel = bp.thrustAccel * (1 + upgradeLvl * 0.03);
    player.turnSpeed = bp.turnSpeed;
    player.thrusterEnergyDrain = bp.thrusterEnergyDrain;
    player.cannonId = profile.selectedCannonByShip[bp.id] || bp.defaultCannonId;
    player.missileId = profile.selectedMissileByShip[bp.id] || bp.defaultMissileId;
    player.skinId = profile.selectedSkinId || 'skin_default';
    player.trailId = profile.selectedTrailId || 'trail_default';
    player.shieldStyleId = profile.selectedShieldId || 'shield_default';

    soundEngine.playRepair();
    this.spawnShockwave(player.x, player.y, '#00F0FF', 75);
  }

  public getPlayer(): FighterEntity | undefined {
    return this.fighters.find((f) => f.isPlayer);
  }

  public getSectorCode(x: number, y: number): string {
    const colIdx = Math.max(0, Math.min(11, Math.floor(x / SECTOR_CELL_SIZE)));
    const rowIdx = Math.max(0, Math.min(7, Math.floor(y / SECTOR_CELL_SIZE)));
    const colChar = String.fromCharCode(65 + colIdx);
    return `${colChar}${rowIdx + 1}`;
  }

  public pushKillEvent(
    killerName: string,
    victimName: string,
    killerTeam: 'ALLY' | 'ENEMY' | 'SYSTEM'
  ): void {
    this.killFeed.unshift({
      id: `${Date.now()}_${Math.random()}`,
      killerName,
      victimName,
      killerTeam,
      timestamp: Date.now(),
    });
    if (this.killFeed.length > 4) this.killFeed.pop();
  }

  public triggerShake(
    mag: number,
    duration: number = 0.18,
    dirAngle?: number,
    flashColor?: string
  ): void {
    const tonedMag = mag * 0.35;
    this.shakeMag = Math.max(this.shakeMag, tonedMag);
    this.shakeTime = Math.max(this.shakeTime, Math.min(0.22, duration));
    this.shakeTrauma = Math.min(0.5, this.shakeTrauma + Math.min(0.22, tonedMag / 16));

    if (dirAngle !== undefined) {
      const kick = tonedMag * 4.5;
      this.shakeImpulseX += Math.cos(dirAngle) * kick;
      this.shakeImpulseY += Math.sin(dirAngle) * kick;
    }

    if (flashColor && mag >= 4.0) {
      this.screenFlashColor = flashColor;
      this.screenFlashAlpha = Math.max(
        this.screenFlashAlpha,
        Math.min(0.12, (tonedMag / 14) * 0.14)
      );
    }
  }

  /**
   * Triggers a subtle screen shake scaled by the incoming damage amount on the player's ship.
   */
  public triggerDamageShake(
    damageAmount: number,
    impactAngle?: number,
    shieldAbsorbed: number = 0,
    hullDmg: number = 0,
    shieldBroke: boolean = false
  ): void {
    const rawDmg = Math.max(1, damageAmount);
    const weightedDmg =
      shieldAbsorbed > 0 || hullDmg > 0
        ? shieldAbsorbed * 0.5 + hullDmg * 0.9 + (shieldBroke ? 8 : 0)
        : rawDmg * 0.7 + (shieldBroke ? 8 : 0);

    // Subtle, controlled magnitude (0.8px for light hits up to 6px before triggerShake 0.35x damping)
    const scaledMag = Math.min(6.5, 0.8 + weightedDmg * 0.08);
    const scaledDuration = Math.min(0.2, 0.07 + weightedDmg * 0.002);
    const flashColor = shieldBroke
      ? '#38BDF8'
      : hullDmg > 0
        ? '#FF2A6D'
        : '#00F0FF';

    this.triggerShake(scaledMag, scaledDuration, impactAngle, flashColor);
  }

  /**
   * Triggers a gentle distance-attenuated screen shake for nearby explosions and weapon impacts.
   */
  public triggerExplosionShake(
    sourceX: number,
    sourceY: number,
    explosionDamageYield: number,
    maxRange: number = 550,
    flashColor?: string,
    impactAngle?: number
  ): void {
    const player = this.getPlayer();
    const refX = player && player.respawnTimer <= 0 ? player.x : this.camX;
    const refY = player && player.respawnTimer <= 0 ? player.y : this.camY;
    const dist = Math.hypot(sourceX - refX, sourceY - refY);
    if (dist >= maxRange) return;

    const yieldClamped = Math.max(4, explosionDamageYield);
    const baseMag = Math.min(7.5, 0.9 + yieldClamped * 0.045);
    const baseDuration = Math.min(0.24, 0.08 + yieldClamped * 0.0014);

    this.triggerProximityShake(
      sourceX,
      sourceY,
      baseMag,
      maxRange,
      baseDuration,
      flashColor,
      impactAngle
    );
  }

  /**
   * Triggers distance-attenuated screen shake based on proximity from the camera/player to an explosion or heavy weapon impact.
   */
  public triggerProximityShake(
    sourceX: number,
    sourceY: number,
    baseMag: number,
    maxRange: number = 550,
    duration: number = 0.2,
    flashColor?: string,
    impactAngle?: number
  ): void {
    const player = this.getPlayer();
    const refX = player && player.respawnTimer <= 0 ? player.x : this.camX;
    const refY = player && player.respawnTimer <= 0 ? player.y : this.camY;
    const dist = Math.hypot(sourceX - refX, sourceY - refY);
    if (dist >= maxRange) return;

    // Smooth non-linear proximity attenuation (stronger up close, tapers smoothly to 0 at maxRange)
    const falloff = Math.pow(1 - dist / maxRange, 1.6);
    const effectiveMag = baseMag * falloff;
    if (effectiveMag < 0.35) return;

    // Push camera away from explosion center or along projectile impact vector
    const pushAngle =
      impactAngle !== undefined
        ? impactAngle
        : dist > 1
          ? Math.atan2(refY - sourceY, refX - sourceX)
          : Math.random() * Math.PI * 2;

    this.triggerShake(
      effectiveMag,
      duration * (0.55 + 0.45 * falloff),
      pushAngle,
      falloff > 0.3 ? flashColor : undefined
    );
  }

  public triggerHitstop(duration: number = 0.04): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  public spawnShockwave(x: number, y: number, color: string, maxRadius: number = 95): void {
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius,
      alpha: 0.95,
      color,
      lineWidth: 4,
    });
  }

  public spawnParticles(x: number, y: number, color: string, count: number, speedScale = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (35 + Math.random() * 190) * speedScale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 1.8 + Math.random() * 3.8,
        alpha: 1,
        decay: 1.4 + Math.random() * 1.4,
        color: i % 4 === 0 ? '#FFFFFF' : i % 3 === 0 ? '#FBBF24' : color,
      });
    }
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    options?: {
      vx?: number;
      vy?: number;
      gravity?: number;
      maxAge?: number;
      subText?: string;
      scale?: number;
      kind?: FloatingCombatText['kind'];
    }
  ): void {
    const maxAge = options?.maxAge ?? 1.15;
    this.floatingTexts.push({
      id: `${Date.now()}_${Math.random()}`,
      x,
      y,
      vx: options?.vx ?? (Math.random() - 0.5) * 32,
      vy: options?.vy ?? -68,
      gravity: options?.gravity ?? 42,
      age: 0,
      maxAge,
      text,
      subText: options?.subText,
      color,
      alpha: 1.0,
      scale: options?.scale ?? 1,
      kind: options?.kind ?? 'STATUS',
    });
  }

  /**
   * Particle system that spawns floating, fading damage numbers near hit enemies
   * to provide immediate visual feedback for combat:
   * - Shield hits: Electric Cyan (#38BDF8) with shield chevron badge
   * - Armor/Hull hits: Molten Amber-Orange (#FB923C)
   * - Critical / Missile hits: Neon Crimson (#FF2A6D) with CRIT sub-badge & spark burst
   */
  public spawnDamageNumbers(
    x: number,
    y: number,
    shieldDmg: number,
    armorDmg: number,
    isHeavyOrMissile: boolean,
    impactAngle?: number,
    targetRadius: number = 18
  ): void {
    // Only spawn if within reasonable camera awareness radius to keep canvas crisp
    if (Math.hypot(x - this.camX, y - this.camY) > 1400) return;

    const roundedShield = Math.round(shieldDmg);
    const roundedArmor = Math.round(armorDmg);
    const bothHit = roundedShield > 0 && roundedArmor > 0;

    // Offset slightly outward from the enemy ship hull perimeter so numbers pop cleanly near the hit enemy
    const scatterDir =
      impactAngle !== undefined
        ? impactAngle + (Math.random() - 0.5) * 0.9
        : -Math.PI * 0.5 + (Math.random() - 0.5) * 1.1;
    const baseOffsetX = Math.cos(scatterDir) * (targetRadius * 0.65);
    const baseOffsetY = -Math.max(12, targetRadius * 0.85);

    if (roundedShield > 0) {
      const sx = x + baseOffsetX + (bothHit ? -16 : (Math.random() - 0.5) * 12);
      const sy = y + baseOffsetY;
      this.spawnFloatingText(sx, sy, `-${roundedShield}`, '#38BDF8', {
        vx: (bothHit ? -34 : (Math.random() - 0.5) * 30) + Math.cos(scatterDir) * 16,
        vy: -74 - Math.random() * 18,
        gravity: 54,
        maxAge: isHeavyOrMissile ? 1.25 : 1.05,
        subText: isHeavyOrMissile ? 'SHIELD' : undefined,
        scale: isHeavyOrMissile ? 1.22 : 1.02,
        kind: 'SHIELD',
      });
      this.spawnParticles(sx, sy, '#38BDF8', isHeavyOrMissile ? 6 : 3, 0.42);
    }

    if (roundedArmor > 0) {
      const isCrit = isHeavyOrMissile || roundedArmor >= 24;
      const ax = x + baseOffsetX + (bothHit ? 16 : (Math.random() - 0.5) * 12);
      const ay = y + baseOffsetY - (bothHit ? 8 : 2);
      this.spawnFloatingText(
        ax,
        ay,
        isCrit ? `-${roundedArmor}!` : `-${roundedArmor}`,
        isCrit ? '#FF2A6D' : '#FB923C',
        {
          vx: (bothHit ? 34 : (Math.random() - 0.5) * 32) + Math.cos(scatterDir) * 18,
          vy: isCrit ? -88 - Math.random() * 18 : -76 - Math.random() * 14,
          gravity: isCrit ? 62 : 54,
          maxAge: isCrit ? 1.35 : 1.1,
          subText: isCrit ? 'CRIT HIT' : undefined,
          scale: isCrit ? 1.34 : 1.08,
          kind: isCrit ? 'CRITICAL' : 'ARMOR',
        }
      );
      this.spawnParticles(
        ax,
        ay,
        isCrit ? '#FF2A6D' : '#FB923C',
        isCrit ? 8 : 4,
        isCrit ? 0.58 : 0.42
      );
    }
  }

  public getOffscreenBrackets(viewportW: number, viewportH: number): OffscreenBracketBlip[] {
    const result: OffscreenBracketBlip[] = [];
    const halfW = viewportW * 0.5;
    const halfH = viewportH * 0.5;
    const padX = 56;
    const padY = 38;

    for (const f of this.fighters) {
      if (f.isPlayer || f.respawnTimer > 0) continue;
      const dx = f.x - this.camX;
      const dy = f.y - this.camY;

      if (Math.abs(dx) < halfW - 40 && Math.abs(dy) < halfH - 40) continue;

      const scaleX = (halfW - padX) / Math.max(1, Math.abs(dx));
      const scaleY = (halfH - padY) / Math.max(1, Math.abs(dy));
      const scale = Math.min(scaleX, scaleY);

      const sx = halfW + dx * scale;
      const sy = halfH + dy * scale;

      result.push({
        id: f.id,
        name: f.callsign,
        team: f.team,
        screenX: Math.max(padX, Math.min(viewportW - padX, sx)),
        screenY: Math.max(24, Math.min(viewportH - 36, sy)),
        hpRatio: Math.max(0, Math.min(1, (f.hp + f.shield) / (f.maxHp + f.maxShield))),
      });
    }

    return result.slice(0, 6);
  }

  public update(dt: number, viewportW: number, viewportH: number, isSpectatorMode: boolean): void {
    const clampedDt = Math.min(dt, 0.05);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - clampedDt);
      return;
    }

    // Update physics-based camera shake trauma, spring impulse, and rotational roll (subtle & damped)
    this.shakePhase += clampedDt * 42;
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - clampedDt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - clampedDt * 3.8);
    }
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - clampedDt * 2.4);
    }

    // Fast-settling spring-damper integration for subtle directional recoil
    const springStiffness = 220;
    const springDamping = 24;
    const accelX = -springStiffness * this.shakeOffsetX - springDamping * this.shakeImpulseX;
    const accelY = -springStiffness * this.shakeOffsetY - springDamping * this.shakeImpulseY;
    this.shakeImpulseX += accelX * clampedDt;
    this.shakeImpulseY += accelY * clampedDt;
    this.shakeOffsetX += this.shakeImpulseX * clampedDt;
    this.shakeOffsetY += this.shakeImpulseY * clampedDt;

    const activeShake =
      this.shakeMag * (this.shakeTime > 0 ? 1 : 0) * 0.25 +
      Math.pow(this.shakeTrauma, 2) * 2.5;
    this.shakeRot =
      activeShake > 0.2
        ? Math.sin(this.shakePhase * 0.85) * Math.min(0.004, activeShake * 0.0004)
        : 0;

    this.matchElapsed += clampedDt;

    for (const ms of [this.motherships.ALLY, this.motherships.ENEMY]) {
      ms.rotation += clampedDt * 0.18 * (ms.team === 'ALLY' ? 1 : -1);
      if (ms.hitFlashTimer > 0) ms.hitFlashTimer = Math.max(0, ms.hitFlashTimer - clampedDt);
      if (ms.shieldRippleTimer > 0)
        ms.shieldRippleTimer = Math.max(0, ms.shieldRippleTimer - clampedDt);
      if (ms.shieldBrokenTimer > 0) {
        ms.shieldBrokenTimer = Math.max(0, ms.shieldBrokenTimer - clampedDt);
      } else if (ms.hp > 0 && ms.shield < ms.maxShield) {
        ms.shield = Math.min(ms.maxShield, ms.shield + 6 * clampedDt);
      }

      ms.turretCooldown = Math.max(0, ms.turretCooldown - clampedDt);
      if (ms.hp > 0 && ms.turretCooldown <= 0) {
        const hostiles = this.fighters.filter(
          (f) => f.team !== ms.team && f.respawnTimer <= 0 && Math.hypot(f.x - ms.x, f.y - ms.y) < 540
        );
        if (hostiles.length > 0) {
          const target = hostiles[0];
          const aim = Math.atan2(target.y - ms.y, target.x - ms.x);
          ms.turretCooldown = 0.85;
          this.projectiles.push({
            id: `turret_${Date.now()}_${Math.random()}`,
            ownerId: ms.id,
            team: ms.team,
            category: 'TURRET',
            x: ms.x + Math.cos(aim) * (ms.radius * 0.75),
            y: ms.y + Math.sin(aim) * (ms.radius * 0.75),
            vx: Math.cos(aim) * 800,
            vy: Math.sin(aim) * 800,
            angle: aim,
            speed: 800,
            damage: 16,
            shieldPiercing: 0.1,
            homingTurnRate: 0,
            targetId: null,
            life: 0,
            maxLife: 0.75,
            color: '#00F0FF',
            trail: [],
          });
        }
      }
    }

    for (const ast of this.asteroids) {
      ast.rotation += ast.rotSpeed * clampedDt;
    }

    for (const f of this.fighters) {
      if (f.respawnTimer > 0) {
        f.respawnTimer = Math.max(0, f.respawnTimer - clampedDt);
        if (f.respawnTimer === 0) {
          const base = f.team === 'ALLY' ? this.motherships.ALLY : this.motherships.ENEMY;
          const tier1Bp = getBlueprintForFactionAndTier(f.faction, 1);
          f.blueprintId = tier1Bp.id;
          f.shipClassLabel = tier1Bp.name;
          f.role = tier1Bp.role;
          f.radius = 17;
          f.maxHp = tier1Bp.maxHp;
          f.maxShield = tier1Bp.maxShield;
          f.maxEnergy = tier1Bp.maxEnergy;
          f.maxSpeed = tier1Bp.maxSpeed;
          f.thrustAccel = tier1Bp.thrustAccel;
          f.turnSpeed = tier1Bp.turnSpeed;
          f.x = base.x + (f.team === 'ALLY' ? 85 : -85);
          f.y = base.y + (Math.random() - 0.5) * 90;
          f.vx = 0;
          f.vy = 0;
          f.hp = f.maxHp;
          f.shield = f.maxShield;
          f.energy = f.maxEnergy;
          f.shieldRippleTimer = 0.5;
          f.shieldBrokenTimer = 0;
          f.killStreak = 0;
          f.survivalTime = 0;
          f.ioScore = 100;
          f.ioLevel = 1;
          this.spawnShockwave(f.x, f.y, '#00F0FF', 65);
        }
        continue;
      }

      // Track survival time alive and level up across 3 ship tiers the longer the ship stays alive
      if (!this.isAuthoritativeOnline) {
        const prevFloor = Math.floor(f.survivalTime || 0);
        f.survivalTime = (f.survivalTime || 0) + clampedDt;
        if (Math.floor(f.survivalTime) > prevFloor) {
          this.awardLocalPilotMass(f, 5);
        }
      }

      if (f.isRemoteHuman) {
        if (f.serverX !== undefined && f.serverY !== undefined) {
          const smoothAlpha = 1 - Math.exp(-16 * clampedDt);
          // Dead-reckoning extrapolation + exponential smoothing for butter-smooth 60fps remote ships
          if (f.serverVx !== undefined && f.serverVy !== undefined) {
            f.serverX += f.serverVx * clampedDt * 0.35;
            f.serverY += f.serverVy * clampedDt * 0.35;
            f.vx += (f.serverVx - f.vx) * smoothAlpha;
            f.vy += (f.serverVy - f.vy) * smoothAlpha;
          }
          f.x += (f.serverX - f.x) * smoothAlpha;
          f.y += (f.serverY - f.y) * smoothAlpha;
          if (f.serverAngle !== undefined) {
            let aDiff = f.serverAngle - f.angle;
            while (aDiff > Math.PI) aDiff -= Math.PI * 2;
            while (aDiff < -Math.PI) aDiff += Math.PI * 2;
            f.angle += aDiff * smoothAlpha;
          }
        } else {
          f.x += f.vx * clampedDt;
          f.y += f.vy * clampedDt;
        }
        this.emitShipExhaustParticles(f, clampedDt);
        let rTrail = this.fighterTrails.get(f.id);
        if (!rTrail) {
          rTrail = [];
          this.fighterTrails.set(f.id, rTrail);
        }
        const rTailX = f.x - Math.cos(f.angle) * (f.radius * 0.65);
        const rTailY = f.y - Math.sin(f.angle) * (f.radius * 0.65);
        if (
          rTrail.length === 0 ||
          Math.hypot(
            rTailX - rTrail[rTrail.length - 1].x,
            rTailY - rTrail[rTrail.length - 1].y
          ) > 6
        ) {
          rTrail.push({ x: rTailX, y: rTailY });
          if (rTrail.length > 16) rTrail.shift();
        }
        continue;
      }

      f.cannonCooldown = Math.max(0, f.cannonCooldown - clampedDt);
      f.missileCooldown = Math.max(0, f.missileCooldown - clampedDt);
      if (f.overchargeTimer > 0) f.overchargeTimer = Math.max(0, f.overchargeTimer - clampedDt);
      if (f.hitFlashTimer > 0) f.hitFlashTimer = Math.max(0, f.hitFlashTimer - clampedDt);
      if (f.shieldRippleTimer > 0)
        f.shieldRippleTimer = Math.max(0, f.shieldRippleTimer - clampedDt);
      if (f.shieldBrokenTimer > 0) {
        f.shieldBrokenTimer = Math.max(0, f.shieldBrokenTimer - clampedDt);
      }

      const alliedBase = f.team === 'ALLY' ? this.motherships.ALLY : this.motherships.ENEMY;
      const distToDock = Math.hypot(f.x - alliedBase.x, f.y - alliedBase.y);
      f.isDockedInBay = alliedBase.hp > 0 && distToDock <= alliedBase.dockRadius * 1.3;

      if (f.isDockedInBay) {
        f.shieldBrokenTimer = 0;
        f.shield = Math.min(f.maxShield, f.shield + 140 * clampedDt);
        f.energy = Math.min(f.maxEnergy, f.energy + 260 * clampedDt);
        f.hp = Math.min(f.maxHp, f.hp + 95 * clampedDt);
      } else {
        // Only regenerate shield if shield capacitor is not broken
        if (f.shieldBrokenTimer <= 0) {
          f.shield = Math.min(f.maxShield, f.shield + f.shieldRegen * 1.35 * clampedDt);
        }
        f.hp = Math.min(f.maxHp, f.hp + f.hullRegen * clampedDt);
        // Fast continuous energy regeneration both while coasting and while maneuvering
        if (!f.isThrusting) {
          f.energy = Math.min(f.maxEnergy, f.energy + f.energyRegen * 1.65 * clampedDt);
        } else {
          f.energy = Math.min(f.maxEnergy, f.energy + f.energyRegen * 1.05 * clampedDt);
        }
      }

      if (f.isPlayer && !isSpectatorMode) {
        this.updatePlayerControls(f, clampedDt, viewportW, viewportH);
      } else {
        this.updateAiPilot(f, clampedDt);
      }

      let diff = f.targetAngle - f.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      f.angle += Math.sign(diff) * Math.min(Math.abs(diff), f.turnSpeed * clampedDt);

      if (f.isThrusting && f.energy > 1) {
        const accel = f.thrustAccel * f.thrustIntensity;
        f.vx += Math.cos(f.angle) * accel * clampedDt;
        f.vy += Math.sin(f.angle) * accel * clampedDt;
        f.energy = Math.max(0, f.energy - f.thrusterEnergyDrain * f.thrustIntensity * clampedDt);
      }

      const drag = Math.pow(0.52, clampedDt);
      f.vx *= drag;
      f.vy *= drag;

      const speed = Math.hypot(f.vx, f.vy);
      const effectiveMaxSpeed = f.carryingOrb ? f.maxSpeed * 0.85 : f.maxSpeed;
      if (speed > effectiveMaxSpeed) {
        f.vx = (f.vx / speed) * effectiveMaxSpeed;
        f.vy = (f.vy / speed) * effectiveMaxSpeed;
      }

      f.x += f.vx * clampedDt;
      f.y += f.vy * clampedDt;

      // Emit persistent engine exhaust particles behind each ship
      this.emitShipExhaustParticles(f, clampedDt);

      // Record smooth fighter wake ribbon trail (Screenshots 9 & 10)
      let fTrail = this.fighterTrails.get(f.id);
      if (!fTrail) {
        fTrail = [];
        this.fighterTrails.set(f.id, fTrail);
      }
      const tailAnchorX = f.x - Math.cos(f.angle) * (f.radius * 0.65);
      const tailAnchorY = f.y - Math.sin(f.angle) * (f.radius * 0.65);
      if (
        fTrail.length === 0 ||
        Math.hypot(
          tailAnchorX - fTrail[fTrail.length - 1].x,
          tailAnchorY - fTrail[fTrail.length - 1].y
        ) > 6
      ) {
        fTrail.push({ x: tailAnchorX, y: tailAnchorY });
        if (fTrail.length > 16) fTrail.shift();
      }

      const margin = 45;
      if (f.x < margin) {
        f.x = margin;
        f.vx = Math.abs(f.vx) * 0.6;
      } else if (f.x > WORLD_WIDTH - margin) {
        f.x = WORLD_WIDTH - margin;
        f.vx = -Math.abs(f.vx) * 0.6;
      }
      if (f.y < margin) {
        f.y = margin;
        f.vy = Math.abs(f.vy) * 0.6;
      } else if (f.y > WORLD_HEIGHT - margin) {
        f.y = WORLD_HEIGHT - margin;
        f.vy = -Math.abs(f.vy) * 0.6;
      }

      for (const ast of this.asteroids) {
        const dx = f.x - ast.x;
        const dy = f.y - ast.y;
        const d = Math.hypot(dx, dy);
        const minDist = f.radius + ast.radius;
        if (d < minDist && d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          f.x = ast.x + nx * minDist;
          f.y = ast.y + ny * minDist;
          const dot = f.vx * nx + f.vy * ny;
          if (dot < 0) {
            f.vx -= 1.5 * dot * nx;
            f.vy -= 1.5 * dot * ny;
          }
        }
      }
    }

    this.updateLocalPellets(clampedDt);
    this.updateCaptureOrb(clampedDt);
    this.updatePowerUps(clampedDt);
    if (!this.isAuthoritativeOnline) {
      this.updateProjectiles(clampedDt);
    } else {
      // Smooth 60fps client-side velocity integration for authoritative projectiles between 20Hz snapshots
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.life += clampedDt;
        pr.x += pr.vx * clampedDt;
        pr.y += pr.vy * clampedDt;
        if (
          pr.trail.length === 0 ||
          Math.hypot(
            pr.x - pr.trail[pr.trail.length - 1].x,
            pr.y - pr.trail[pr.trail.length - 1].y
          ) > 8
        ) {
          pr.trail.push({ x: pr.x, y: pr.y });
          if (pr.trail.length > (pr.category === 'MISSILE' ? 14 : 4)) {
            pr.trail.shift();
          }
        }
      }
    }

    // Update persistent engine exhaust particles
    const exhaustDrag = Math.pow(0.22, clampedDt);
    for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
      const ep = this.exhaustParticles[i];
      ep.life += clampedDt;
      if (ep.life >= ep.maxLife) {
        this.exhaustParticles.splice(i, 1);
        continue;
      }
      ep.x += ep.vx * clampedDt;
      ep.y += ep.vy * clampedDt;
      ep.vx *= exhaustDrag;
      ep.vy *= exhaustDrag;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * clampedDt;
      pt.y += pt.vy * clampedDt;
      pt.alpha -= pt.decay * clampedDt;
      if (pt.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, clampedDt * 8.5);
      sw.alpha -= clampedDt * 2.4;
      if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age = (ft.age ?? 0) + clampedDt;
      const maxAge = ft.maxAge ?? 1.15;

      ft.x += (ft.vx || 0) * clampedDt;
      ft.y += ft.vy * clampedDt;

      // Ballistic upward burst followed by soft float deceleration & light gravity arc
      if (ft.gravity !== undefined) {
        ft.vy += ft.gravity * clampedDt;
      }
      ft.vy *= Math.pow(0.32, clampedDt);
      if (ft.vx) ft.vx *= Math.pow(0.28, clampedDt);

      // Smooth fade-out curve over particle lifetime
      const lifeProgress = Math.min(1, ft.age / maxAge);
      ft.alpha =
        lifeProgress < 0.25
          ? 1.0
          : Math.max(0, 1 - Math.pow((lifeProgress - 0.25) / 0.75, 1.35));

      if (ft.age >= maxAge || ft.alpha <= 0.01) {
        this.floatingTexts.splice(i, 1);
      }
    }

    const player = this.getPlayer();
    const camAlpha = 1 - Math.exp(-9.5 * clampedDt);
    if (isSpectatorMode && player) {
      this.camX += (player.x - this.camX) * camAlpha;
      this.camY += (player.y - this.camY) * camAlpha;
    } else if (player) {
      const targetCamX = player.x + player.vx * 0.16;
      const targetCamY = player.y + player.vy * 0.16;
      this.camX += (targetCamX - this.camX) * camAlpha;
      this.camY += (targetCamY - this.camY) * camAlpha;
    }
  }

  private updatePlayerControls(
    player: FighterEntity,
    dt: number,
    viewportW: number,
    viewportH: number
  ): void {
    const worldMouseX = this.camX - viewportW * 0.5 + this.mouseScreenX;
    const worldMouseY = this.camY - viewportH * 0.5 + this.mouseScreenY;

    if (Math.abs(this.touchSteerAxis) > 0.05) {
      player.angle += this.touchSteerAxis * player.turnSpeed * 0.85 * dt;
      player.targetAngle = player.angle;
    } else if (this.mouseActive) {
      const dx = worldMouseX - player.x;
      const dy = worldMouseY - player.y;
      player.targetAngle = Math.atan2(dy, dx);
    }

    const cursorDist = Math.hypot(worldMouseX - player.x, worldMouseY - player.y);
    if (this.touchThrottleHeld && player.energy > 2) {
      player.isThrusting = true;
      player.thrustIntensity = 1.0;
    } else if (this.mouseActive && cursorDist > 68 && player.energy > 3) {
      player.isThrusting = true;
      player.thrustIntensity = Math.min(1, (cursorDist - 68) / 145);
    } else {
      player.isThrusting = false;
      player.thrustIntensity = 0;
    }

    let closestTargetId: string | null = null;
    let bestScore = 99999;

    for (const enemy of this.fighters) {
      if (enemy.team !== player.team && enemy.respawnTimer <= 0) {
        const dToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dToPlayer < 1200) {
          const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          const angleDiff = Math.abs(
            Math.atan2(
              Math.sin(angleToEnemy - player.angle),
              Math.cos(angleToEnemy - player.angle)
            )
          );
          const score = dToPlayer * (0.5 + angleDiff);
          if (score < bestScore) {
            bestScore = score;
            closestTargetId = enemy.id;
          }
        }
      }
    }
    this.lockedTargetId = closestTargetId;

    const firePrimary = Boolean(this.touchPrimaryHeld || this.leftMouseHeld);
    const fireSecondary = Boolean(this.touchSecondaryJustPressed || this.rightMouseJustPressed);

    if (firePrimary) {
      this.fireCannon(player);
    }

    if (fireSecondary) {
      this.touchSecondaryJustPressed = false;
      this.rightMouseJustPressed = false;
      this.fireMissile(player, this.lockedTargetId);
    }

    // Stream 30Hz authoritative input commands to Colyseus room
    if (this.inputSendCallback) {
      const now = performance.now();
      if (now - this.lastInputSentAt >= 33 || fireSecondary) {
        this.lastInputSentAt = now;
        this.inputSendCallback({
          targetAngle: player.targetAngle,
          isThrusting: player.isThrusting,
          thrustIntensity: player.thrustIntensity,
          firePrimary,
          fireSecondary,
          lockedTargetId: this.lockedTargetId,
        });
      }
    }
  }

  private updateAiPilot(bot: FighterEntity, _dt: number): void {
    const alliedBase = bot.team === 'ALLY' ? this.motherships.ALLY : this.motherships.ENEMY;
    const enemyBase = bot.team === 'ALLY' ? this.motherships.ENEMY : this.motherships.ALLY;

    if (bot.hp < bot.maxHp * 0.32 || bot.energy < 15) {
      bot.aiRetreatToDock = true;
    } else if (bot.hp > bot.maxHp * 0.85 && bot.energy > bot.maxEnergy * 0.75) {
      bot.aiRetreatToDock = false;
    }

    if (bot.aiRetreatToDock && alliedBase.hp > 0) {
      bot.targetAngle = Math.atan2(alliedBase.y - bot.y, alliedBase.x - bot.x);
      bot.isThrusting = Math.hypot(alliedBase.x - bot.x, alliedBase.y - bot.y) > 90;
      bot.thrustIntensity = 0.9;
      return;
    }

    if (bot.carryingOrb && alliedBase.hp > 0) {
      bot.targetAngle = Math.atan2(alliedBase.y - bot.y, alliedBase.x - bot.x);
      bot.isThrusting = true;
      bot.thrustIntensity = 1.0;
      return;
    }

    let nearestEnemy: FighterEntity | null = null;
    let nearestDist = 99999;
    for (const other of this.fighters) {
      if (other.team !== bot.team && other.respawnTimer <= 0) {
        const d = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = other;
        }
      }
    }

    if (nearestEnemy && (nearestDist < 950 || enemyBase.invulnerable)) {
      const dist = Math.hypot(nearestEnemy.x - bot.x, nearestEnemy.y - bot.y);
      const aimAngle = Math.atan2(
        nearestEnemy.y + nearestEnemy.vy * 0.16 - bot.y,
        nearestEnemy.x + nearestEnemy.vx * 0.16 - bot.x
      );

      if (dist < 220) {
        bot.targetAngle = aimAngle + bot.aiStrafeDir * 0.45;
        bot.isThrusting = true;
        bot.thrustIntensity = 0.65;
      } else {
        bot.targetAngle = aimAngle;
        bot.isThrusting = dist > 280;
        bot.thrustIntensity = 0.85;
      }

      const angleErr = Math.abs(
        Math.atan2(Math.sin(aimAngle - bot.angle), Math.cos(aimAngle - bot.angle))
      );
      if (dist < 700 && angleErr < 0.28 && bot.energy > 25) {
        this.fireCannon(bot);
      }
      if (dist > 220 && dist < 880 && bot.energy > 45 && Math.random() < 0.035) {
        this.fireMissile(bot, nearestEnemy.id);
      }
    } else if (!enemyBase.invulnerable && enemyBase.hp > 0) {
      const distMs = Math.hypot(enemyBase.x - bot.x, enemyBase.y - bot.y);
      const aimMs = Math.atan2(enemyBase.y - bot.y, enemyBase.x - bot.x);
      bot.targetAngle = distMs < 260 ? aimMs + bot.aiStrafeDir * 0.6 : aimMs;
      bot.isThrusting = distMs > 320;
      bot.thrustIntensity = 0.8;

      if (distMs < 680 && bot.energy > 30) {
        this.fireCannon(bot);
      }
      if (distMs < 850 && bot.energy > 50 && Math.random() < 0.03) {
        this.fireMissile(bot, enemyBase.id);
      }
    }
  }

  public fireCannon(shooter: FighterEntity): void {
    const spec = WEAPONS[shooter.cannonId] || WEAPONS.pulse_laser;
    if (shooter.cannonCooldown > 0 || shooter.energy < spec.energyCost) return;

    const fireRateMult = shooter.overchargeTimer > 0 ? 1.35 : 1;
    const dmgMult = shooter.overchargeTimer > 0 ? 1.35 : 1;

    shooter.cannonCooldown = 1 / (spec.fireRate * fireRateMult);
    shooter.energy = Math.max(0, shooter.energy - spec.energyCost);

    if (shooter.isPlayer) {
      soundEngine.playCannonFire(shooter.faction);
    }

    const count = spec.projectilesPerShot;
    for (let i = 0; i < count; i++) {
      const offsetAngle =
        count === 1
          ? (Math.random() - 0.5) * spec.spreadAngle
          : (i - (count - 1) * 0.5) * spec.spreadAngle;
      const fireAngle = shooter.angle + offsetAngle;
      const muzzleX = shooter.x + Math.cos(shooter.angle) * (shooter.radius + 6);
      const muzzleY = shooter.y + Math.sin(shooter.angle) * (shooter.radius + 6);

      const proj: ProjectileEntity = {
        id: `c_${Date.now()}_${Math.random()}`,
        ownerId: shooter.id,
        team: shooter.team,
        category: 'CANNON',
        x: muzzleX,
        y: muzzleY,
        vx: shooter.vx * 0.25 + Math.cos(fireAngle) * spec.projectileSpeed,
        vy: shooter.vy * 0.25 + Math.sin(fireAngle) * spec.projectileSpeed,
        angle: fireAngle,
        speed: spec.projectileSpeed,
        damage: Math.round(spec.damage * dmgMult),
        shieldPiercing: spec.shieldPiercing,
        homingTurnRate: 0,
        targetId: null,
        life: 0,
        maxLife: spec.range / spec.projectileSpeed,
        color: spec.color,
        trail: [],
      };
      this.projectiles.push(proj);

      if (shooter.isPlayer && this.wsSendCallback) {
        this.wsSendCallback({ type: 'weapon:fired', projectile: proj });
      }
    }
  }

  public fireMissile(shooter: FighterEntity, targetId: string | null): void {
    const spec = WEAPONS[shooter.missileId] || WEAPONS.valkyrie_seeker;
    if (shooter.missileCooldown > 0 || shooter.energy < spec.energyCost) return;

    const dmgMult = shooter.overchargeTimer > 0 ? 1.35 : 1;
    shooter.missileCooldown = 1 / spec.fireRate;
    shooter.energy = Math.max(0, shooter.energy - spec.energyCost);

    if (shooter.isPlayer) {
      soundEngine.playMissileLaunch();
      // Subtle directional launch recoil opposite missile vector
      this.triggerShake(2.8, 0.14, shooter.angle + Math.PI);
    }

    let resolvedTargetId = targetId;
    if (!resolvedTargetId) {
      let bestD = 1150;
      for (const f of this.fighters) {
        if (f.team !== shooter.team && f.respawnTimer <= 0) {
          const d = Math.hypot(f.x - shooter.x, f.y - shooter.y);
          if (d < bestD) {
            bestD = d;
            resolvedTargetId = f.id;
          }
        }
      }
    }

    const count = spec.projectilesPerShot;
    for (let i = 0; i < count; i++) {
      const offsetAngle = count === 1 ? 0 : (i === 0 ? -1 : 1) * spec.spreadAngle;
      const fireAngle = shooter.angle + offsetAngle;
      const muzzleX = shooter.x + Math.cos(fireAngle) * (shooter.radius + 8);
      const muzzleY = shooter.y + Math.sin(fireAngle) * (shooter.radius + 8);

      const proj: ProjectileEntity = {
        id: `m_${Date.now()}_${Math.random()}`,
        ownerId: shooter.id,
        team: shooter.team,
        category: 'MISSILE',
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(fireAngle) * spec.projectileSpeed,
        vy: Math.sin(fireAngle) * spec.projectileSpeed,
        angle: fireAngle,
        speed: spec.projectileSpeed,
        damage: Math.round(spec.damage * dmgMult),
        shieldPiercing: spec.shieldPiercing,
        homingTurnRate: spec.homingTurnRate,
        targetId: resolvedTargetId,
        life: 0,
        maxLife: spec.range / spec.projectileSpeed,
        color: spec.color,
        trail: [],
      };
      this.projectiles.push(proj);

      if (shooter.isPlayer && this.wsSendCallback) {
        this.wsSendCallback({ type: 'weapon:fired', projectile: proj });
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.category === 'MISSILE' && p.targetId && p.homingTurnRate > 0) {
        let tx: number | null = null;
        let ty: number | null = null;

        const targetFighter = this.fighters.find(
          (f) => f.id === p.targetId && f.respawnTimer <= 0
        );
        if (targetFighter) {
          tx = targetFighter.x;
          ty = targetFighter.y;
        } else if (p.targetId === this.motherships.ENEMY.id) {
          tx = this.motherships.ENEMY.x;
          ty = this.motherships.ENEMY.y;
        } else if (p.targetId === this.motherships.ALLY.id) {
          tx = this.motherships.ALLY.x;
          ty = this.motherships.ALLY.y;
        }

        if (tx !== null && ty !== null) {
          const desiredAngle = Math.atan2(ty - p.y, tx - p.x);
          let diff = desiredAngle - p.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.angle += Math.sign(diff) * Math.min(Math.abs(diff), p.homingTurnRate * dt);
          p.vx = Math.cos(p.angle) * p.speed;
          p.vy = Math.sin(p.angle) * p.speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > (p.category === 'MISSILE' ? 20 : 6)) {
        p.trail.shift();
      }

      let hitSomething = false;
      for (const ast of this.asteroids) {
        if (Math.hypot(p.x - ast.x, p.y - ast.y) < ast.radius) {
          this.spawnParticles(
            p.x,
            p.y,
            p.color,
            p.category === 'MISSILE' ? 16 : 6,
            p.category === 'MISSILE' ? 0.85 : 0.5
          );
          if (p.category === 'MISSILE') {
            this.spawnShockwave(p.x, p.y, p.color, 55);
          }
          // Nearby explosion/impact shake scaled by weapon damage
          this.triggerExplosionShake(
            p.x,
            p.y,
            p.damage * (p.category === 'MISSILE' ? 1.45 : 0.55),
            850,
            p.category === 'MISSILE' ? '#F59E0B' : undefined,
            p.angle
          );
          this.projectiles.splice(i, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      for (const target of this.fighters) {
        if (target.team === p.team || target.respawnTimer > 0) continue;
        if (Math.hypot(p.x - target.x, p.y - target.y) <= target.radius + 6) {
          this.applyDamageToFighter(target, p);
          this.projectiles.splice(i, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      const hostileMs = p.team === 'ALLY' ? this.motherships.ENEMY : this.motherships.ALLY;
      if (hostileMs.hp > 0 && Math.hypot(p.x - hostileMs.x, p.y - hostileMs.y) <= hostileMs.radius) {
        this.applyDamageToMothership(hostileMs, p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private applyDamageToFighter(target: FighterEntity, p: ProjectileEntity): void {
    const hadShield = target.shield > 0;
    const directHull = Math.round(p.damage * p.shieldPiercing);
    const shieldPortion = p.damage - directHull;
    const absorbed = Math.min(target.shield, shieldPortion);
    const overflow = Math.max(0, shieldPortion - absorbed);
    const hullDmg = directHull + overflow;

    target.shield = Math.max(0, target.shield - absorbed);
    target.hp = Math.max(0, target.hp - hullDmg);
    target.hitFlashTimer = 0.14;
    if (absorbed > 0) target.shieldRippleTimer = 0.28;

    const shooter = this.fighters.find((f) => f.id === p.ownerId);
    const involvesPlayer = target.isPlayer || shooter?.isPlayer;
    const isHeavyHit = p.category === 'MISSILE' || p.damage >= 22;

    if (involvesPlayer) {
      soundEngine.playHit(absorbed > 0, p.category === 'MISSILE');
    }

    // Spawn distinct floating damage numbers near the hit fighter for Shield (Cyan) vs. Armor/Hull (Orange/Crimson)
    this.spawnDamageNumbers(
      target.x,
      target.y,
      absorbed,
      hullDmg,
      isHeavyHit,
      p.angle,
      target.radius
    );

    const shieldJustBroke = hadShield && target.shield <= 0 && target.hp > 0;
    // Check if Shield just broke from this impact!
    if (shieldJustBroke) {
      target.shield = 0;
      target.shieldBrokenTimer = 4.2;
      const shatterColor = target.team === 'ALLY' ? '#00F0FF' : '#FF2A6D';
      this.spawnShockwave(target.x, target.y, shatterColor, target.radius * 3.1);
      // Radial ring of shattering shield crystal fragments
      for (let s = 0; s < 26; s++) {
        const ang = (s / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const rimX = target.x + Math.cos(ang) * (target.radius * 1.45);
        const rimY = target.y + Math.sin(ang) * (target.radius * 1.45);
        const burstSpd = 95 + Math.random() * 145;
        this.particles.push({
          x: rimX,
          y: rimY,
          vx: target.vx * 0.3 + Math.cos(ang) * burstSpd,
          vy: target.vy * 0.3 + Math.sin(ang) * burstSpd,
          size: 2.2 + Math.random() * 2.8,
          alpha: 1.0,
          decay: 1.6 + Math.random() * 0.8,
          color: s % 3 === 0 ? '#FFFFFF' : shatterColor,
        });
      }
      this.spawnFloatingText(
        target.x,
        target.y - target.radius - 18,
        'SHIELD BROKEN!',
        '#38BDF8',
        {
          vx: 0,
          vy: -68,
          scale: 1.2,
          kind: 'SHIELD',
        }
      );
      if (!target.isPlayer) {
        this.triggerExplosionShake(target.x, target.y, 48 + p.damage, 950, shatterColor);
      }
    }

    // Damage-scaled screen shake when player's ship takes damage or nearby weapon explosion occurs
    if (target.isPlayer) {
      this.triggerDamageShake(p.damage, p.angle, absorbed, hullDmg, shieldJustBroke);
      if (p.category === 'MISSILE') {
        this.spawnShockwave(target.x, target.y, '#FF2A6D', 65);
      }
    } else {
      if (p.category === 'MISSILE') {
        this.spawnShockwave(target.x, target.y, '#FF2A6D', 58);
      }
      this.triggerExplosionShake(
        target.x,
        target.y,
        p.damage * (p.category === 'MISSILE' ? 1.45 : 0.75),
        940,
        p.category === 'MISSILE' ? '#FF2A6D' : undefined,
        p.angle
      );
    }

    this.spawnParticles(p.x, p.y, p.color, p.category === 'MISSILE' ? 22 : 9, 0.85);

    if (target.hp <= 0) {
      target.deaths += 1;
      target.respawnTimer = 4.2;
      if ((target.killStreak ?? 0) >= 3) {
        this.spawnFloatingText(target.x, target.y - 36, 'STREAK ENDED!', '#FF2A6D', {
          vx: 0,
          vy: -60,
          scale: 1.15,
          kind: 'CRITICAL',
        });
      }
      target.killStreak = 0;
      target.survivalTime = 0;

      if (shooter) {
        shooter.kills += 1;
        shooter.killStreak = (shooter.killStreak || 0) + 1;
        const streakSpec = getKillStreakMilestone(shooter.killStreak);
        if (streakSpec) {
          this.awardLocalPilotMass(shooter, streakSpec.bonusMass);
          this.handleNetworkKillStreak({
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
      }

      if (target.carryingOrb) {
        target.carryingOrb = false;
        this.orb.carrierId = null;
        this.orb.carrierTeam = null;
      }

      const dropTypes: PowerUpDrop['type'][] = [
        'SHIELD_ORB',
        'ENERGY_CELL',
        'HULL_NANITES',
        'OVERCHARGE',
      ];
      this.powerUps.push({
        id: `pu_${Date.now()}_${Math.random()}`,
        type: dropTypes[Math.floor(Math.random() * dropTypes.length)],
        x: target.x,
        y: target.y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        radius: 16,
        life: 18,
        pulsePhase: Math.random() * Math.PI * 2,
      });

      this.spawnParticles(target.x, target.y, FACTIONS[target.faction].primaryColor, 48, 1.45);
      this.spawnShockwave(target.x, target.y, '#FBBF24', 120);

      // Proximity explosion shake for any ship exploding near the camera/player, scaled by ship hull + killing blow damage
      const distToCam = Math.hypot(target.x - this.camX, target.y - this.camY);
      if (involvesPlayer || distToCam < 950) {
        soundEngine.playExplosion();
      }
      if (involvesPlayer) {
        this.triggerHitstop(0.05);
      }
      const shipExplosionYield =
        (target.isPlayer ? 135 : 95) + target.maxHp * 0.3 + p.damage * 0.65;
      this.triggerExplosionShake(
        target.x,
        target.y,
        shipExplosionYield,
        1250,
        target.isPlayer ? '#FF2A6D' : '#FBBF24'
      );

      const killerName = shooter ? shooter.callsign : 'Mothership Turret';
      this.pushKillEvent(killerName, target.callsign, p.team);

      // Scatter 5 high-value .io energy loot orbs on ship destruction & award killer mass
      if (shooter) {
        this.awardLocalPilotMass(shooter, 120);
      }
      const victimMass = target.ioScore ?? 150;
      const dropVal = Math.max(35, Math.round((victimMass * 0.4) / 5));
      for (let k = 0; k < 5; k++) {
        this.spawnLocalPellet(
          `loot_${Date.now()}_${k}_${Math.random()}`,
          target.x + (Math.random() - 0.5) * 32,
          target.y + (Math.random() - 0.5) * 32,
          dropVal,
          true
        );
      }
      target.ioScore = 100;
      target.ioLevel = 1;

      if (this.modeId === 'dogfight') {
        if (p.team === 'ALLY') this.allyScore += 1;
        else this.enemyScore += 1;

        if (this.allyScore >= this.targetScore) this.matchWinner = 'ALLY';
        else if (this.enemyScore >= this.targetScore) this.matchWinner = 'ENEMY';
      }
    }
  }

  private applyDamageToMothership(ms: MothershipEntity, p: ProjectileEntity): void {
    if (ms.invulnerable) {
      ms.shieldRippleTimer = 0.25;
      this.spawnParticles(p.x, p.y, '#00F0FF', 6, 0.5);
      return;
    }

    const hadShield = ms.shield > 0;
    const absorbed = Math.min(ms.shield, p.damage * (1 - p.shieldPiercing));
    const hullDmg = Math.max(1, p.damage - absorbed);

    ms.shield = Math.max(0, ms.shield - absorbed);
    ms.hp = Math.max(0, ms.hp - hullDmg);
    ms.hitFlashTimer = 0.1;
    if (absorbed > 0) ms.shieldRippleTimer = 0.22;

    if (hadShield && ms.shield <= 0 && ms.hp > 0) {
      ms.shield = 0;
      ms.shieldBrokenTimer = 5.5;
      const msShatterCol = ms.team === 'ALLY' ? '#14F1D9' : '#FF2A6D';
      this.spawnShockwave(ms.x, ms.y, msShatterCol, ms.radius * 1.9);
      this.spawnParticles(ms.x, ms.y, msShatterCol, 36, 1.4);
      this.spawnFloatingText(ms.x, ms.y - ms.radius - 20, 'MOTHERSHIP SHIELD BROKEN!', '#38BDF8', {
        vx: 0,
        vy: -55,
        scale: 1.25,
        kind: 'SHIELD',
      });
    }

    const isHeavyMsHit = p.category === 'MISSILE' || p.damage >= 22;
    this.spawnDamageNumbers(p.x, p.y, absorbed, hullDmg, isHeavyMsHit);

    this.spawnParticles(p.x, p.y, p.color, p.category === 'MISSILE' ? 20 : 8, 0.75);
    if (p.category === 'MISSILE' || p.damage >= 22) {
      this.spawnShockwave(p.x, p.y, p.color, 72);
      this.triggerProximityShake(
        p.x,
        p.y,
        p.category === 'MISSILE' ? 9.5 : 4.5,
        1050,
        0.3,
        ms.team === 'ALLY' ? '#FF2A6D' : '#00F0FF',
        p.angle
      );
    }

    if (ms.hp <= 0 && !this.matchWinner) {
      this.matchWinner = ms.team === 'ENEMY' ? 'ALLY' : 'ENEMY';
      soundEngine.playExplosion();
      this.triggerHitstop(0.08);
      this.triggerProximityShake(ms.x, ms.y, 24, 2500, 0.85, '#FFFFFF');
      this.spawnParticles(ms.x, ms.y, FACTIONS[ms.faction].primaryColor, 95, 2.1);
      this.spawnShockwave(ms.x, ms.y, '#FFFFFF', 260);
      this.pushKillEvent('Allied Fleet', ms.name, this.matchWinner);
    }
  }

  private updateCaptureOrb(dt: number): void {
    if (!this.orb.active) return;

    if (this.orb.megaBeamTimer > 0) {
      this.orb.megaBeamTimer = Math.max(0, this.orb.megaBeamTimer - dt);
    }

    if (this.isAuthoritativeOnline) {
      if (this.orb.carrierId) {
        const carrier = this.fighters.find(
          (f) => f.id === this.orb.carrierId && f.respawnTimer <= 0
        );
        if (carrier) {
          const anchorX = carrier.x - Math.cos(carrier.angle) * 38;
          const anchorY = carrier.y - Math.sin(carrier.angle) * 38;
          const tetherAlpha = 1 - Math.exp(-14 * dt);
          this.orb.x += (anchorX - this.orb.x) * tetherAlpha;
          this.orb.y += (anchorY - this.orb.y) * tetherAlpha;
        }
      }
      return;
    }

    if (this.orb.carrierId) {
      const carrier = this.fighters.find(
        (f) => f.id === this.orb.carrierId && f.respawnTimer <= 0
      );
      if (carrier) {
        // Magnetic spring tether trailing 38px behind the carrier ship
        const anchorX = carrier.x - Math.cos(carrier.angle) * 38;
        const anchorY = carrier.y - Math.sin(carrier.angle) * 38;
        const tetherAlpha = 1 - Math.exp(-12 * dt);
        this.orb.x += (anchorX - this.orb.x) * tetherAlpha;
        this.orb.y += (anchorY - this.orb.y) * tetherAlpha;

        const base =
          carrier.team === 'ALLY' ? this.motherships.ALLY : this.motherships.ENEMY;
        const enemyBase =
          carrier.team === 'ALLY' ? this.motherships.ENEMY : this.motherships.ALLY;

        if (Math.hypot(carrier.x - base.x, carrier.y - base.y) <= base.dockRadius) {
          carrier.carryingOrb = false;
          this.orb.carrierId = null;
          this.orb.carrierTeam = null;
          this.orb.x = this.orb.homeX;
          this.orb.y = this.orb.homeY;

          this.orb.megaBeamTimer = 1.4;
          this.orb.megaBeamSourceX = base.x;
          this.orb.megaBeamSourceY = base.y;
          this.orb.megaBeamTargetX = enemyBase.x;
          this.orb.megaBeamTargetY = enemyBase.y;

          enemyBase.shield = 0;
          enemyBase.hp = Math.max(0, enemyBase.hp - 500);
          soundEngine.playExplosion();
          this.triggerProximityShake(enemyBase.x, enemyBase.y, 18, 2400, 0.65, '#00F0FF');
          this.spawnShockwave(enemyBase.x, enemyBase.y, '#00F0FF', 200);

          if (carrier.team === 'ALLY') this.allyScore += 1;
          else this.enemyScore += 1;

          this.pushKillEvent(carrier.callsign, 'Captured Quantum Orb', carrier.team);

          if (this.allyScore >= 3 || this.enemyScore >= 3 || enemyBase.hp <= 0) {
            this.matchWinner = carrier.team;
          }
        }
      } else {
        this.orb.carrierId = null;
        this.orb.carrierTeam = null;
      }
    } else {
      for (const f of this.fighters) {
        if (f.respawnTimer <= 0 && Math.hypot(f.x - this.orb.x, f.y - this.orb.y) <= f.radius + 26) {
          f.carryingOrb = true;
          this.orb.carrierId = f.id;
          this.orb.carrierTeam = f.team;
          soundEngine.playRepair();
          this.spawnShockwave(this.orb.x, this.orb.y, '#FBBF24', 80);
          break;
        }
      }
    }
  }

  private updatePowerUps(dt: number): void {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.life -= dt;
      pu.pulsePhase += dt * 4;
      pu.x += pu.vx * dt;
      pu.y += pu.vy * dt;

      if (pu.life <= 0) {
        this.powerUps.splice(i, 1);
        continue;
      }

      for (const f of this.fighters) {
        if (f.respawnTimer <= 0 && Math.hypot(f.x - pu.x, f.y - pu.y) <= f.radius + pu.radius) {
          if (pu.type === 'SHIELD_ORB') {
            f.shield = Math.min(f.maxShield, f.shield + 55);
            if (f.isPlayer) this.spawnFloatingText(f.x, f.y - 20, '+55 SHIELD', '#00F0FF');
          } else if (pu.type === 'ENERGY_CELL') {
            f.energy = Math.min(f.maxEnergy, f.energy + 70);
            if (f.isPlayer) this.spawnFloatingText(f.x, f.y - 20, '+70 ENERGY', '#FBBF24');
          } else if (pu.type === 'HULL_NANITES') {
            f.hp = Math.min(f.maxHp, f.hp + 50);
            if (f.isPlayer) this.spawnFloatingText(f.x, f.y - 20, '+50 HULL', '#05FFA1');
          } else {
            f.overchargeTimer = 8.0;
            f.energy = f.maxEnergy;
            if (f.isPlayer) this.spawnFloatingText(f.x, f.y - 20, 'OVERCHARGE!', '#FF2A6D');
          }

          if (f.isPlayer) soundEngine.playRepair();
          this.spawnShockwave(pu.x, pu.y, '#00F0FF', 45);
          this.powerUps.splice(i, 1);
          break;
        }
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    cyberTheme: boolean = true
  ): void {
    ctx.save();

    // 1. Deep Obsidian-Void Cyberpunk Space Backdrop + Faction-Reactive HD Blackwall Cyberspace Layer
    const localPilot = this.getPlayer();
    const isRedTheme = localPilot?.faction === 'omnitron';
    ctx.fillStyle = isRedTheme ? '#070104' : cyberTheme ? '#02040A' : '#02060C';
    ctx.fillRect(0, 0, viewportW, viewportH);

    // Compute subtle multi-harmonic trauma oscillation + spring-damped directional recoil offset (clamped to max ±4.5px)
    const traumaAmp =
      (this.shakeTime > 0 ? this.shakeMag * 0.24 : 0) + Math.pow(this.shakeTrauma, 2) * 2.4;
    const oscX =
      traumaAmp > 0.04
        ? (Math.sin(this.shakePhase * 1.13) * 0.55 +
            Math.sin(this.shakePhase * 2.41) * 0.25) *
          traumaAmp
        : 0;
    const oscY =
      traumaAmp > 0.04
        ? (Math.cos(this.shakePhase * 1.37) * 0.55 +
            Math.cos(this.shakePhase * 2.69) * 0.25) *
          traumaAmp
        : 0;
    const shakeX = Math.max(-4.5, Math.min(4.5, oscX + this.shakeOffsetX));
    const shakeY = Math.max(-4.5, Math.min(4.5, oscY + this.shakeOffsetY));

    // 1.5. Render Parallax HD Blackwall Cyberspace PNG Backdrop (Blue Net-Grid vs Red Blackwall)
    const bgImg = isRedTheme ? this.bgBlackwallRedImg : this.bgBlackwallBlueImg;
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      const panX = ((this.camX / WORLD_WIDTH) - 0.5) * -90 + shakeX * 0.25;
      const panY = ((this.camY / WORLD_HEIGHT) - 0.5) * -60 + shakeY * 0.25;
      ctx.drawImage(bgImg, panX - 60, panY - 40, viewportW + 120, viewportH + 80);
      ctx.restore();
    }

    // 2. Lightweight Parallax Dark-Abyss Nebula Layers (Solid low-alpha circles — zero gradient allocations)
    for (let i = 0; i < this.nebulae.length; i++) {
      const neb = this.nebulae[i];
      const nx = viewportW * 0.5 + (neb.x - this.camX) * neb.parallax + shakeX * 0.35;
      const ny = viewportH * 0.5 + (neb.y - this.camY) * neb.parallax + shakeY * 0.35;
      if (
        nx + neb.radius < 0 ||
        nx - neb.radius > viewportW ||
        ny + neb.radius < 0 ||
        ny - neb.radius > viewportH
      ) {
        continue;
      }
      ctx.fillStyle = neb.colorInner;
      ctx.beginPath();
      ctx.arc(nx, ny, neb.radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Fast Multi-Layer Parallax Starfield (fillRect instead of 320 arc calls)
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      let sx = (s.x - this.camX * s.parallax + shakeX * s.parallax) % viewportW;
      let sy = (s.y - this.camY * s.parallax + shakeY * s.parallax) % viewportH;
      if (sx < 0) sx += viewportW;
      if (sy < 0) sy += viewportH;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(sx, sy, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Viewport Frustum Bounds in World Space for Strict Culling
    const halfViewW = viewportW * 0.5 + 180;
    const halfViewH = viewportH * 0.5 + 180;

    ctx.save();
    ctx.translate(viewportW * 0.5 + shakeX, viewportH * 0.5 + shakeY);
    if (Math.abs(this.shakeRot) > 0.0002) {
      ctx.rotate(this.shakeRot);
    }
    ctx.translate(-this.camX, -this.camY);

    // 4. Distant Dark Eclipse Planet Behind Allied Sector + Twin Cyber-Moon Behind Enemy Sector
    if (
      Math.abs(680 - this.camX) < halfViewW + 460 &&
      Math.abs(1600 - this.camY) < halfViewH + 460
    ) {
      this.renderBackgroundPlanet(ctx, 680, 1600, 420);
    }
    if (
      Math.abs(WORLD_WIDTH - 680 - this.camX) < halfViewW + 360 &&
      Math.abs(1600 - this.camY) < halfViewH + 360
    ) {
      this.renderBackgroundPlanet(ctx, WORLD_WIDTH - 680, 1600, 320);
    }

    // 5. Central Quantum Rift Anomaly Ring at Arena Core (2400, 1600)
    const centerX = WORLD_WIDTH * 0.5;
    const centerY = WORLD_HEIGHT * 0.5;
    if (
      Math.abs(centerX - this.camX) < halfViewW + 520 &&
      Math.abs(centerY - this.camY) < halfViewH + 520
    ) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.strokeStyle = 'rgba(20, 241, 217, 0.09)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 460, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(this.matchElapsed * 0.12);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([18, 28]);
      ctx.beginPath();
      ctx.arc(0, 0, 320, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Outer World Abyssal Hazard Zones (Dark Crimson-Obsidian Void Beyond Sector Borders)
    ctx.fillStyle = 'rgba(15, 4, 14, 0.72)';
    ctx.fillRect(-700, -500, 700, WORLD_HEIGHT + 1000);
    ctx.fillRect(WORLD_WIDTH, -500, 700, WORLD_HEIGHT + 1000);
    ctx.fillRect(0, -500, WORLD_WIDTH, 500);
    ctx.fillRect(0, WORLD_HEIGHT, WORLD_WIDTH, 500);

    // 6. PROPER TACTICAL SECTOR HOLO-GRID (`A1`..`L8` across 4800x3200 with 400px Cells)
    if (this.showTacticalGrid) {
      this.renderTacticalSpaceGrid(ctx, viewportW, viewportH, cyberTheme);
    }

    // 7. Render Motherships (Frustum-Culled)
    if (
      Math.abs(this.motherships.ALLY.x - this.camX) < halfViewW + 220 &&
      Math.abs(this.motherships.ALLY.y - this.camY) < halfViewH + 220
    ) {
      this.renderMothership(ctx, this.motherships.ALLY);
    }
    if (
      Math.abs(this.motherships.ENEMY.x - this.camX) < halfViewW + 220 &&
      Math.abs(this.motherships.ENEMY.y - this.camY) < halfViewH + 220
    ) {
      this.renderMothership(ctx, this.motherships.ENEMY);
    }

    // 7.5. Render Orbital Mega-Beam if active
    if (this.orb.megaBeamTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 28 * (this.orb.megaBeamTimer / 1.4);
      ctx.beginPath();
      ctx.moveTo(this.orb.megaBeamSourceX, this.orb.megaBeamSourceY);
      ctx.lineTo(this.orb.megaBeamTargetX, this.orb.megaBeamTargetY);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 10 * (this.orb.megaBeamTimer / 1.4);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Render Obsidian Cyber-Vein Asteroids (Frustum-Culled & Zero Gradient Allocations)
    for (let i = 0; i < this.asteroids.length; i++) {
      const ast = this.asteroids[i];
      if (
        Math.abs(ast.x - this.camX) > halfViewW + ast.radius ||
        Math.abs(ast.y - this.camY) > halfViewH + ast.radius
      ) {
        continue;
      }
      this.renderAsteroid(ctx, ast);
    }

    // 9. Render Power-Up Drops (Frustum-Culled)
    for (let i = 0; i < this.powerUps.length; i++) {
      const pu = this.powerUps[i];
      if (
        Math.abs(pu.x - this.camX) > halfViewW ||
        Math.abs(pu.y - this.camY) > halfViewH
      ) {
        continue;
      }
      const pulse = 1 + 0.14 * Math.sin(pu.pulsePhase);
      const color =
        pu.type === 'SHIELD_ORB'
          ? '#00F0FF'
          : pu.type === 'ENERGY_CELL'
            ? '#FBBF24'
            : pu.type === 'HULL_NANITES'
              ? '#05FFA1'
              : '#FF2A6D';
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9.5. Render Collectible .io Plasma / Energy Pellets (Zero-Gradient Layered Vector Glow)
    ctx.save();
    for (let i = 0; i < this.pellets.length; i++) {
      const pl = this.pellets[i];
      if (
        Math.abs(pl.x - this.camX) > halfViewW ||
        Math.abs(pl.y - this.camY) > halfViewH
      ) {
        continue;
      }
      const pulse = 1 + 0.15 * Math.sin(pl.pulsePhase);
      const r = pl.radius * pulse;

      // Outer soft plasma halo
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = pl.color;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, r * 1.75, 0, Math.PI * 2);
      ctx.fill();

      // Mid saturated core
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, r * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // Bright white center spark
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 10. Render Capture the Orb Pedestal, Magnetic Tether Beam & Quantum Orb
    if (this.orb.active) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(this.orb.homeX, this.orb.homeY, 54, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (this.orb.carrierId) {
        const carrier = this.fighters.find(
          (f) => f.id === this.orb.carrierId && f.respawnTimer <= 0
        );
        if (carrier) {
          ctx.strokeStyle = carrier.team === 'ALLY' ? '#14F1D9' : '#FF2A6D';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(carrier.x, carrier.y);
          ctx.lineTo(this.orb.x, this.orb.y);
          ctx.stroke();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(carrier.x, carrier.y);
          ctx.lineTo(this.orb.x, this.orb.y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(this.orb.x, this.orb.y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.orb.x, this.orb.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 11. Render Shockwave Rings (Frustum-Culled)
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (
        Math.abs(sw.x - this.camX) > halfViewW + sw.radius ||
        Math.abs(sw.y - this.camY) > halfViewH + sw.radius
      ) {
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, sw.alpha));
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 12. Render Projectiles with Crisp Vector Core (Frustum-Culled)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (
        Math.abs(p.x - this.camX) > halfViewW ||
        Math.abs(p.y - this.camY) > halfViewH
      ) {
        continue;
      }
      if (p.category === 'MISSILE') {
        if (p.trail.length > 1) {
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let j = 1; j < p.trail.length; j++) {
            ctx.lineTo(p.trail[j].x, p.trail[j].y);
          }
          ctx.stroke();
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-7, -3, 14, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(3, -2, 5, 4);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-13, -3, 26, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-9, -1.4, 18, 2.8);
        ctx.restore();
      }
    }
    ctx.restore();

    // 13. Render Player Tactical Radar Ring & Lead-Target Reticle
    const player = this.getPlayer();
    if (player && player.respawnTimer <= 0 && this.showTacticalGrid) {
      this.renderPlayerTacticalOverlay(ctx, player);
    }

    // 13.5. Render Persistent Multi-Stage Engine Exhaust Plumes Behind Ships (Frustum-Culled)
    this.renderExhaustParticles(ctx, halfViewW, halfViewH);

    // Pre-calculate top sector leader ID once per frame instead of O(N^2) inside renderFighter
    let topLeaderId: string | null = null;
    let bestIoScore = 140;
    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i];
      const sc = f.ioScore ?? 0;
      if (sc > bestIoScore) {
        bestIoScore = sc;
        topLeaderId = f.id;
      }
    }

    // 14. Render Fighters (Frustum-Culled)
    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i];
      if (f.respawnTimer > 0) continue;
      if (
        Math.abs(f.x - this.camX) > halfViewW + 90 ||
        Math.abs(f.y - this.camY) > halfViewH + 90
      ) {
        continue;
      }
      this.renderFighter(ctx, f, f.id === topLeaderId);
    }

    // 15. Render Additive Particles (Frustum-Culled)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (
        Math.abs(pt.x - this.camX) > halfViewW ||
        Math.abs(pt.y - this.camY) > halfViewH
      ) {
        continue;
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha));
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size, pt.y - pt.size, pt.size * 2, pt.size * 2);
    }
    ctx.restore();

    // 16. Render Floating Combat Damage Numbers & Status Texts (Shield vs Armor Color-Coded Particle System)
    for (const ft of this.floatingTexts) {
      ctx.save();
      const clampedAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.globalAlpha = clampedAlpha;

      // Elastic pop-in scale during the first 120ms of the damage particle's lifetime
      const age = ft.age ?? 0.2;
      const popBoost =
        age < 0.08
          ? 0.65 + (age / 0.08) * 0.65
          : age < 0.18
            ? 1.3 - ((age - 0.08) / 0.1) * 0.3
            : 1.0;
      const totalScale = (ft.scale || 1) * popBoost;

      ctx.translate(ft.x, ft.y);
      if (totalScale !== 1) {
        ctx.scale(totalScale, totalScale);
      }

      const isDamage = ft.kind === 'SHIELD' || ft.kind === 'ARMOR' || ft.kind === 'CRITICAL';
      ctx.font = isDamage
        ? '800 14px "Orbitron", "Share Tech Mono", monospace'
        : '700 13px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Prefix badge so Shield (◈) and Armor (⬢) hits are unmistakably distinct
      const displayLabel =
        ft.kind === 'SHIELD'
          ? `◈ ${ft.text}`
          : ft.kind === 'ARMOR' || ft.kind === 'CRITICAL'
            ? `⬢ ${ft.text}`
            : ft.text;

      // Optional micro-tag above critical/heavy damage numbers
      if (ft.subText) {
        ctx.save();
        ctx.font = '700 8.5px "Share Tech Mono", monospace';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(10, 6, 2, 0.95)';
        ctx.strokeText(ft.subText, 0, -12);
        ctx.fillStyle = ft.kind === 'CRITICAL' ? '#FDE047' : '#BAE6FD';
        ctx.fillText(ft.subText, 0, -12);
        ctx.restore();
      }

      // High-contrast dark outline + colored glow
      ctx.lineWidth = 3.6;
      ctx.strokeStyle =
        ft.kind === 'SHIELD'
          ? 'rgba(3, 28, 48, 0.96)'
          : ft.kind === 'CRITICAL'
            ? 'rgba(48, 4, 20, 0.96)'
            : 'rgba(28, 10, 2, 0.96)';
      ctx.strokeText(displayLabel, 0, 0);

      ctx.fillStyle = ft.color;
      ctx.fillText(displayLabel, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    // 17. Render Heavy Impact / Explosion Screen-Edge Vignette Flash & Shock Frame
    if (this.screenFlashAlpha > 0.01 || traumaAmp > 1.2) {
      ctx.save();
      const flashAlpha = Math.max(
        this.screenFlashAlpha,
        Math.min(0.32, (traumaAmp / 22) * 0.26)
      );
      ctx.globalAlpha = Math.max(0, Math.min(0.48, flashAlpha));
      const flashGrad = ctx.createRadialGradient(
        viewportW * 0.5,
        viewportH * 0.5,
        Math.min(viewportW, viewportH) * 0.24,
        viewportW * 0.5,
        viewportH * 0.5,
        Math.max(viewportW, viewportH) * 0.74
      );
      flashGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      flashGrad.addColorStop(1, this.screenFlashColor);
      ctx.fillStyle = flashGrad;
      ctx.fillRect(0, 0, viewportW, viewportH);

      // Kinetic shock border ring scaled by trauma intensity
      if (traumaAmp > 1.5) {
        ctx.strokeStyle = this.screenFlashColor;
        ctx.lineWidth = Math.min(6, 1.5 + traumaAmp * 0.25);
        ctx.strokeRect(2, 2, viewportW - 4, viewportH - 4);
      }
      ctx.restore();
    }

    // 18. Top-Right Tactical Sector Minimap Overlay
    this.renderTacticalMinimap(ctx, viewportW, viewportH, cyberTheme);

    // 19. Top-Center Kill Streak (3 / 5 / 10) & 3-Tier Survival Evolution Announcer Banner
    this.renderKillStreakAndTierAnnouncer(ctx, viewportW, viewportH);

    ctx.restore();
  }

  private renderKillStreakAndTierAnnouncer(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    _viewportH: number
  ): void {
    const ann = this.activeAnnouncement;
    if (!ann) return;

    const elapsed = performance.now() - ann.createdAt;
    if (elapsed >= ann.duration) {
      this.activeAnnouncement = null;
      return;
    }

    const lifeRatio = 1 - elapsed / ann.duration;
    const fadeIn = Math.min(1, elapsed / 180);
    const fadeOut = Math.min(1, (ann.duration - elapsed) / 380);
    const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const popScale = elapsed < 220 ? 0.86 + (elapsed / 220) * 0.18 : 1.0;

    const bannerW = Math.min(416, viewportW - 32);
    const bannerH = ann.voiceoverLine ? 82 : 66;
    const centerX = viewportW * 0.5;
    const centerY = 98;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(centerX, centerY);
    ctx.scale(popScale, popScale);

    // Outer tactical glow & dark glass chassis
    ctx.shadowColor = ann.glowColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(10, 6, 2, 0.94)';
    ctx.fillRect(-bannerW * 0.5, -bannerH * 0.5, bannerW, bannerH);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = ann.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-bannerW * 0.5, -bannerH * 0.5, bannerW, bannerH);

    // Top badge pill + sound cue tag
    ctx.font = '700 10px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ann.accentColor;
    const cueTag = ann.soundCueId ? ` · [${ann.soundCueId}]` : '';
    ctx.fillText(`${ann.badgeText}${cueTag}`, 0, -bannerH * 0.5 + 12);

    // Main Announcer Title ("KILLING SPREE!" / "RAMPAGE!" / "UNSTOPPABLE · FLEET ACE!")
    ctx.font = '900 18px "Orbitron", "Share Tech Mono", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(ann.title, 0, ann.voiceoverLine ? -5 : 2);

    // Subtitle ("3 CONSECUTIVE KILLS WITHOUT DYING" / "HUNTER CLASS UNLOCKED")
    ctx.font = '600 10px "Share Tech Mono", monospace';
    ctx.fillStyle = '#FDE68A';
    ctx.fillText(ann.subtitle, 0, ann.voiceoverLine ? 13 : bannerH * 0.5 - 14);

    // Announcer Voiceover Transmission Line + Animated Waveform Bars
    if (ann.voiceoverLine) {
      ctx.font = '600 9.5px "Share Tech Mono", monospace';
      ctx.fillStyle = '#5EEAD4';
      const wavePulse = Math.sin(elapsed * 0.025) > 0 ? '🔊' : '📡';
      ctx.fillText(
        `${wavePulse} VOX: "${ann.voiceoverLine.toUpperCase()}"`,
        0,
        bannerH * 0.5 - 13
      );
    }

    // Bottom timer progress bar
    const barW = bannerW - 16;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(-barW * 0.5, bannerH * 0.5 - 4.5, barW, 2.5);
    ctx.fillStyle = ann.accentColor;
    ctx.fillRect(-barW * 0.5, bannerH * 0.5 - 4.5, barW * lifeRatio, 2.5);

    ctx.restore();
  }

  /**
   * Renders a small-scale tactical minimap in the top-right corner of the canvas
   * showing the entire 12x8 sector grid (A1..L8), Motherships, camera frustum,
   * and live ally/enemy/player positions.
   */
  private renderTacticalMinimap(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    cyberTheme: boolean
  ): void {
    const isCompact = viewportW < 640;
    const mapW = isCompact ? 138 : 186;
    const mapH = Math.round(mapW * (WORLD_HEIGHT / WORLD_WIDTH)); // Exact 3:2 ratio (92 or 124)
    const headerH = 18;
    // Positioned in top-right corner just to the left of the top-right gear button
    const mapX = Math.max(12, viewportW - mapW - 58);
    const mapY = 12 + headerH;

    const scaleX = mapW / WORLD_WIDTH;
    const scaleY = mapH / WORLD_HEIGHT;

    const player = this.getPlayer();
    const isRed = player?.faction === 'omnitron';
    const primaryAccent = isRed ? '#FF003C' : '#00F0FF';
    const secondaryAccent = isRed ? '#FF2A6D' : '#38BDF8';
    const colIdx = player
      ? Math.max(0, Math.min(11, Math.floor(player.x / SECTOR_CELL_SIZE)))
      : 2;
    const rowIdx = player
      ? Math.max(0, Math.min(7, Math.floor(player.y / SECTOR_CELL_SIZE)))
      : 3;
    const currentSectorCode = `SEC-${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;

    ctx.save();

    // 1. Header Strip ("RADAR · SEC-C4")
    ctx.fillStyle = isRed ? 'rgba(22, 3, 9, 0.90)' : 'rgba(3, 10, 24, 0.90)';
    ctx.fillRect(mapX, mapY - headerH, mapW, headerH);
    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mapX, mapY - headerH, mapW, headerH);

    ctx.font = '700 10px "Share Tech Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = primaryAccent;
    ctx.fillText(`SECTOR MAP`, mapX + 6, mapY - headerH * 0.5);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(currentSectorCode, mapX + mapW - 6, mapY - headerH * 0.5);

    // 2. Minimap Background & Clip Region
    ctx.fillStyle = isRed ? 'rgba(14, 2, 6, 0.86)' : 'rgba(2, 8, 18, 0.86)';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    // 3. Highlight Player's Current Active Sector Cell
    const cellW = SECTOR_CELL_SIZE * scaleX;
    const cellH = SECTOR_CELL_SIZE * scaleY;
    ctx.fillStyle = isRed
      ? 'rgba(255, 0, 60, 0.16)'
      : 'rgba(0, 240, 255, 0.14)';
    ctx.fillRect(mapX + colIdx * cellW, mapY + rowIdx * cellH, cellW, cellH);

    // 4. 12x8 Sector Grid Lines (A..L x 1..8)
    ctx.strokeStyle = isRed
      ? 'rgba(255, 42, 109, 0.22)'
      : 'rgba(56, 189, 248, 0.20)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let c = 1; c < 12; c++) {
      const gx = mapX + c * cellW;
      ctx.moveTo(gx, mapY);
      ctx.lineTo(gx, mapY + mapH);
    }
    for (let r = 1; r < 8; r++) {
      const gy = mapY + r * cellH;
      ctx.moveTo(mapX, gy);
      ctx.lineTo(mapX + mapW, gy);
    }
    ctx.stroke();

    // 5. Asteroid Obstacles on Minimap
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    for (const ast of this.asteroids) {
      const ax = mapX + ast.x * scaleX;
      const ay = mapY + ast.y * scaleY;
      const ar = Math.max(1.4, ast.radius * scaleX);
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Allied & Enemy Motherships
    const mothershipList: MothershipEntity[] = [this.motherships.ALLY, this.motherships.ENEMY];
    for (const ms of mothershipList) {
      if (ms.hp <= 0) continue;
      const mx = mapX + ms.x * scaleX;
      const my = mapY + ms.y * scaleY;
      const isAlly = ms.team === 'ALLY';
      const msColor = isAlly ? '#00F0FF' : '#FF003C';

      ctx.strokeStyle = isAlly ? 'rgba(0, 240, 255, 0.38)' : 'rgba(255, 0, 60, 0.38)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(6, ms.dockRadius * scaleX), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = msColor;
      ctx.beginPath();
      ctx.arc(mx, my, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 7. Capture the Orb Objective (if active)
    if (this.orb.active) {
      const ox = mapX + this.orb.x * scaleX;
      const oy = mapY + this.orb.y * scaleY;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = primaryAccent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ox, oy, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 8. Camera Viewport Frustum Box
    const viewLeft = mapX + (this.camX - viewportW * 0.5) * scaleX;
    const viewTop = mapY + (this.camY - viewportH * 0.5) * scaleY;
    const viewW = viewportW * scaleX;
    const viewH = viewportH * scaleY;
    ctx.strokeStyle = isRed ? 'rgba(255, 0, 60, 0.45)' : 'rgba(0, 240, 255, 0.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(viewLeft, viewTop, viewW, viewH);

    // 9. Ally & Enemy Fighters
    for (const f of this.fighters) {
      if (f.respawnTimer > 0) continue;
      const fx = mapX + f.x * scaleX;
      const fy = mapY + f.y * scaleY;

      if (f.isPlayer) {
        const pulseR = 5.5 + (Math.sin(this.matchElapsed * 6) * 0.5 + 0.5) * 3;
        ctx.strokeStyle = primaryAccent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fx, fy, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(f.angle);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = primaryAccent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(5.2, 0);
        ctx.lineTo(-3.6, -3.4);
        ctx.lineTo(-2.2, 0);
        ctx.lineTo(-3.6, 3.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        const isAlly = f.team === 'ALLY';
        const isLocked = f.id === this.lockedTargetId;
        const blipColor = isAlly ? '#00F0FF' : '#FF003C';

        ctx.strokeStyle = isAlly
          ? 'rgba(0, 240, 255, 0.65)'
          : 'rgba(255, 0, 60, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(f.angle) * 4.5, fy + Math.sin(f.angle) * 4.5);
        ctx.stroke();

        ctx.fillStyle = blipColor;
        ctx.beginPath();
        ctx.arc(fx, fy, isLocked ? 3.0 : 2.3, 0, Math.PI * 2);
        ctx.fill();

        if (isLocked) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.1;
          ctx.strokeRect(fx - 4.2, fy - 4.2, 8.4, 8.4);
        }
      }
    }

    ctx.restore(); // End clip

    // 10. Outer Tactical Bezel Frame & Corner Brackets
    ctx.strokeStyle = secondaryAccent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Glowing Corner Accents
    const cornerLen = 7;
    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mapX, mapY + cornerLen);
    ctx.lineTo(mapX, mapY);
    ctx.lineTo(mapX + cornerLen, mapY);
    ctx.moveTo(mapX + mapW - cornerLen, mapY);
    ctx.lineTo(mapX + mapW, mapY);
    ctx.lineTo(mapX + mapW, mapY + cornerLen);
    ctx.moveTo(mapX, mapY + mapH - cornerLen);
    ctx.lineTo(mapX, mapY + mapH);
    ctx.lineTo(mapX + cornerLen, mapY + mapH);
    ctx.moveTo(mapX + mapW - cornerLen, mapY + mapH);
    ctx.lineTo(mapX + mapW, mapY + mapH);
    ctx.lineTo(mapX + mapW, mapY + mapH - cornerLen);
    ctx.stroke();

    // 11. Bottom Legend Strip (ALLY vs ENEMY count)
    let allyCount = 0;
    let enemyCount = 0;
    for (const f of this.fighters) {
      if (f.respawnTimer <= 0) {
        if (f.team === 'ALLY') allyCount++;
        else enemyCount++;
      }
    }
    ctx.fillStyle = isRed ? 'rgba(22, 3, 9, 0.88)' : 'rgba(3, 10, 24, 0.88)';
    ctx.fillRect(mapX, mapY + mapH, mapW, 14);
    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY + mapH, mapW, 14);

    ctx.font = '600 9px "Share Tech Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00F0FF';
    ctx.fillText(`● ALLY: ${allyCount}`, mapX + 5, mapY + mapH + 7);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FF003C';
    ctx.fillText(`ENEMY: ${enemyCount} ●`, mapX + mapW - 5, mapY + mapH + 7);

    ctx.restore();
  }

  /**
   * Renders a multi-layered Tactical Space Grid (Major 400px Sector Squares A1..L8 + 100px Sub-Grid + Crosshairs)
   */
  private renderTacticalSpaceGrid(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    _cyberTheme: boolean
  ): void {
    const isRed = this.getPlayer()?.faction === 'omnitron';
    const subStep = 100;
    const minX = Math.max(0, Math.floor((this.camX - viewportW * 0.55) / subStep) * subStep);
    const maxX = Math.min(WORLD_WIDTH, Math.ceil((this.camX + viewportW * 0.55) / subStep) * subStep);
    const minY = Math.max(0, Math.floor((this.camY - viewportH * 0.55) / subStep) * subStep);
    const maxY = Math.min(WORLD_HEIGHT, Math.ceil((this.camY + viewportH * 0.55) / subStep) * subStep);

    ctx.save();

    // 1. Fine 100px Sub-Grid Matrix
    ctx.strokeStyle = isRed
      ? 'rgba(255, 0, 60, 0.045)'
      : 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = minX; x <= maxX; x += subStep) {
      if (x % SECTOR_CELL_SIZE === 0) continue;
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
    }
    for (let y = minY; y <= maxY; y += subStep) {
      if (y % SECTOR_CELL_SIZE === 0) continue;
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
    }
    ctx.stroke();

    // 2. Major 400px Sector Grid Lines
    const majorStartCol = Math.floor(minX / SECTOR_CELL_SIZE);
    const majorEndCol = Math.ceil(maxX / SECTOR_CELL_SIZE);
    const majorStartRow = Math.floor(minY / SECTOR_CELL_SIZE);
    const majorEndRow = Math.ceil(maxY / SECTOR_CELL_SIZE);

    ctx.strokeStyle = isRed
      ? 'rgba(255, 0, 60, 0.14)'
      : 'rgba(0, 240, 255, 0.13)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let c = majorStartCol; c <= majorEndCol; c++) {
      const x = c * SECTOR_CELL_SIZE;
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
    }
    for (let r = majorStartRow; r <= majorEndRow; r++) {
      const y = r * SECTOR_CELL_SIZE;
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
    }
    ctx.stroke();

    // 3. Sector Intersection Crosshairs (`+`) & Coordinate Labels (`SEC-B4`)
    ctx.font = '600 10px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    ctx.strokeStyle = isRed ? 'rgba(255, 0, 60, 0.38)' : 'rgba(0, 240, 255, 0.34)';
    ctx.fillStyle = isRed ? 'rgba(255, 42, 109, 0.34)' : 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();

    for (let r = majorStartRow; r <= majorEndRow; r++) {
      for (let c = majorStartCol; c <= majorEndCol; c++) {
        const gx = c * SECTOR_CELL_SIZE;
        const gy = r * SECTOR_CELL_SIZE;

        ctx.moveTo(gx - 6, gy);
        ctx.lineTo(gx + 6, gy);
        ctx.moveTo(gx, gy - 6);
        ctx.lineTo(gx, gy + 6);

        if (c < 12 && r < 8) {
          const code = `${String.fromCharCode(65 + c)}${r + 1}`;
          ctx.fillText(`SEC-${code}`, gx + 8, gy + 15);
        }
      }
    }
    ctx.stroke();

    // 4. Outer Sector Cyber-Perimeter Barrier Frame
    ctx.strokeStyle = isRed ? '#FF003C' : '#00F0FF';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.restore();
  }

  /**
   * Renders tactical range rings around the player's ship and a Lead-Target Prediction Reticle on locked enemies
   */
  private renderPlayerTacticalOverlay(
    ctx: CanvasRenderingContext2D,
    player: FighterEntity
  ): void {
    ctx.save();

    // Subtle 220px Tactical Compass Ring around Player Fighter
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 190, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Forward Heading Vector Line with Distance Ticks
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(player.angle) * 32, Math.sin(player.angle) * 32);
    ctx.lineTo(Math.cos(player.angle) * 190, Math.sin(player.angle) * 190);
    ctx.stroke();
    ctx.restore();

    // Lead-Target Prediction Reticle on Locked Enemy
    if (this.lockedTargetId) {
      const target = this.fighters.find(
        (f) => f.id === this.lockedTargetId && f.respawnTimer <= 0
      );
      if (target) {
        const cannon = WEAPONS[player.cannonId] || WEAPONS.pulse_laser;
        const dist = Math.hypot(target.x - player.x, target.y - player.y);
        const flightTime = dist / cannon.projectileSpeed;
        const leadX = target.x + target.vx * flightTime;
        const leadY = target.y + target.vy * flightTime;

        ctx.save();
        //Target box on enemy
        ctx.strokeStyle = 'rgba(255, 42, 109, 0.75)';
        ctx.lineWidth = 1.5;
        const r = target.radius + 10;
        ctx.strokeRect(target.x - r, target.y - r, r * 2, r * 2);

        // Lead reticle ahead of enemy velocity
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(leadX, leadY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(leadX, leadY, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderBackgroundPlanet(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    radius: number
  ): void {
    ctx.save();
    // Outer dark atmospheric rim (no per-frame gradient allocation)
    ctx.fillStyle = 'rgba(6, 78, 92, 0.14)';
    ctx.beginPath();
    ctx.arc(px, py, radius * 1.04, 0, Math.PI * 2);
    ctx.fill();

    // Dark Obsidian Eclipse Planet Body
    ctx.fillStyle = '#040B14';
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Subtle illuminated crescent & cyber-grid rim
    ctx.strokeStyle = 'rgba(20, 241, 217, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.88, -Math.PI * 0.35, Math.PI * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  private renderAsteroid(ctx: CanvasRenderingContext2D, ast: AsteroidObstacle): void {
    ctx.save();
    ctx.translate(ast.x, ast.y);
    ctx.rotate(ast.rotation);

    // Dark Obsidian-Basalt Polygon (Zero per-frame gradient allocation)
    ctx.fillStyle = '#0B1322';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < ast.vertices.length; i++) {
      const v = ast.vertices[i];
      if (i === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner faceted dark core & glowing cyberpunk mineral vein
    ctx.fillStyle = '#131F33';
    ctx.beginPath();
    for (let i = 0; i < ast.vertices.length; i += 2) {
      const v = ast.vertices[i];
      if (i === 0) ctx.moveTo(v.x * 0.55, v.y * 0.55);
      else ctx.lineTo(v.x * 0.55, v.y * 0.55);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(20, 241, 217, 0.32)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-ast.radius * 0.35, -ast.radius * 0.15);
    ctx.lineTo(0, ast.radius * 0.1);
    ctx.lineTo(ast.radius * 0.32, -ast.radius * 0.22);
    ctx.stroke();

    ctx.restore();
  }

  private renderMothership(ctx: CanvasRenderingContext2D, ms: MothershipEntity): void {
    if (ms.hp <= 0) return;
    const isAlly = ms.team === 'ALLY';
    const ringGlow = isAlly ? '#14F1D9' : '#FF2A6D';

    ctx.save();
    ctx.translate(ms.x, ms.y);

    // Subtle Docking Bay Perimeter Ring
    ctx.strokeStyle = isAlly
      ? 'rgba(20, 241, 217, 0.22)'
      : 'rgba(255, 42, 109, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, ms.dockRadius, -ms.rotation * 0.3, -ms.rotation * 0.3 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.rotate(ms.rotation * 0.35);

    // 1. 3 Spherical Outer Docking Pods Connected by Twin V-Truss Struts (Exact match to Screenshots 6, 7, 8!)
    const podAngles = [2.15, 1.45, -0.85];
    for (const pa of podAngles) {
      const px = Math.cos(pa) * (ms.radius * 1.15);
      const py = Math.sin(pa) * (ms.radius * 1.15);

      // Twin Metallic V-Struts connecting Hub to Spherical Pod
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(pa - 0.25) * (ms.radius * 0.58), Math.sin(pa - 0.25) * (ms.radius * 0.58));
      ctx.lineTo(px - Math.sin(pa) * 10, py + Math.cos(pa) * 10);
      ctx.moveTo(Math.cos(pa + 0.25) * (ms.radius * 0.58), Math.sin(pa + 0.25) * (ms.radius * 0.58));
      ctx.lineTo(px + Math.sin(pa) * 10, py - Math.cos(pa) * 10);
      ctx.stroke();

      // Spherical Docking Pod Outer Shell
      const podGrad = ctx.createRadialGradient(px - 8, py - 8, 4, px, py, 32);
      podGrad.addColorStop(0, '#E2E8F0');
      podGrad.addColorStop(0.65, '#94A3B8');
      podGrad.addColorStop(1, '#475569');
      ctx.fillStyle = podGrad;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Recessed Inner Pod Dome
      ctx.fillStyle = '#64748B';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2. 3 Glowing Cyan/Turquoise Triangular Stabilizer Fins (Screenshots 6, 7, 8)
    const finAngles = [0.55, 2.75, -1.75];
    for (const fa of finAngles) {
      ctx.save();
      ctx.rotate(fa);
      // Base white fin mount
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(ms.radius * 0.55, -22);
      ctx.lineTo(ms.radius * 0.92, -12);
      ctx.lineTo(ms.radius * 0.92, 12);
      ctx.lineTo(ms.radius * 0.55, 22);
      ctx.closePath();
      ctx.fill();

      // Glowing Cyan Tip Cone
      ctx.fillStyle = ringGlow;
      ctx.beginPath();
      ctx.moveTo(ms.radius * 0.88, -13);
      ctx.lineTo(ms.radius * 1.24, 0);
      ctx.lineTo(ms.radius * 0.88, 13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Main 3D Faceted C-Shaped Architectural Command Hull (Screenshots 6, 7, 8)
    const hullGrad = ctx.createRadialGradient(-25, -25, 12, 0, 0, ms.radius * 0.88);
    hullGrad.addColorStop(0, ms.hitFlashTimer > 0 ? '#FFFFFF' : '#F8FAFC');
    hullGrad.addColorStop(0.55, '#CBD5E1');
    hullGrad.addColorStop(1, '#64748B');

    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, ms.radius * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Faceted 3D Architectural Bevel Planes on Main Hull
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (ms.radius * 0.38), Math.sin(a) * (ms.radius * 0.38));
      ctx.lineTo(Math.cos(a) * (ms.radius * 0.78), Math.sin(a) * (ms.radius * 0.78));
      ctx.stroke();
    }

    // Glowing Turquoise-Cyan Inner C-Ring Stripe (Exact match to Screenshots 6, 7, 8)
    ctx.strokeStyle = ringGlow;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, ms.radius * 0.52, 0.35, Math.PI * 1.85);
    ctx.stroke();

    // Dark Inner Command Trench & Right-Side Circular Command Dome
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(0, 0, ms.radius * 0.36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94A3B8';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ms.radius * 0.42, 12, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Cyan Docking Bay Target Cross `[ ✖ ]` over Allied Mothership (Screenshots 6, 7, 8)
    if (isAlly) {
      ctx.save();
      ctx.translate(-8, -14);
      ctx.fillStyle = 'rgba(20, 241, 217, 0.85)';
      ctx.fillRect(-16, -24, 32, 6);
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-4, -10);
      ctx.lineTo(10, 8);
      ctx.lineTo(4, 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.lineTo(4, -10);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shield Impact & Progressive Transparency Dome on Mothership
    const msShieldRatio = Math.max(0, Math.min(1, ms.shield / Math.max(1, ms.maxShield)));
    if ((ms.shield > 0 && ms.shieldBrokenTimer <= 0) || ms.invulnerable) {
      const rippleBoost = ms.shieldRippleTimer > 0 ? 0.45 : 0;
      const domeAlpha = ms.invulnerable
        ? 0.75
        : Math.min(0.9, 0.1 + 0.55 * msShieldRatio + rippleBoost);
      ctx.save();
      ctx.globalAlpha = domeAlpha;
      ctx.strokeStyle = ringGlow;
      ctx.lineWidth = ms.shieldRippleTimer > 0 ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, ms.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Mothership Health & Shield Bar
    const barW = 116;
    const barY = -ms.radius - 28;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(-barW * 0.5 - 1, barY - 1, barW + 2, 9);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-barW * 0.5, barY, barW * (ms.shield / ms.maxShield), 3);
    ctx.fillStyle = isAlly ? '#14F1D9' : '#FF2A6D';
    ctx.fillRect(-barW * 0.5, barY + 4, barW * (ms.hp / ms.maxHp), 4);

    ctx.restore();
  }

  /**
   * Emits persistent engine exhaust particles behind a fighter based on its velocity,
   * thrust intensity, faction color palette, and nozzle geometry.
   */
  private emitShipExhaustParticles(f: FighterEntity, dt: number): void {
    const speed = Math.hypot(f.vx, f.vy);
    const speedRatio = Math.min(1, speed / Math.max(1, f.maxSpeed));
    const thrustPower = f.isThrusting ? Math.max(0.55, f.thrustIntensity) : speedRatio * 0.45;
    if (thrustPower < 0.08) return;

    // Keep particle count bounded for smooth 60fps
    if (this.exhaustParticles.length > 360) {
      this.exhaustParticles.splice(0, 24);
    }

    // Twin nozzles for Hunters & Heavy Frigates, single focused nozzle for Scouts
    const nozzleOffsets =
      f.role === 'Heavy Frigate'
        ? [-6.5, 6.5]
        : f.role === 'Hunter'
          ? [-4.2, 4.2]
          : [0];

    const backwardX = -Math.cos(f.angle);
    const backwardY = -Math.sin(f.angle);
    const perpX = -Math.sin(f.angle);
    const perpY = Math.cos(f.angle);

    const trailCosmetic = f.trailId ? COSMETIC_MAP.get(f.trailId) : undefined;
    const colorCore = '#FFFFFF';
    const colorMid = trailCosmetic
      ? trailCosmetic.previewPrimary
      : f.faction === 'aerie'
        ? '#05FFA1'
        : f.team === 'ALLY'
          ? '#00F0FF'
          : '#FF2A6D';
    const colorTail = trailCosmetic
      ? trailCosmetic.previewSecondary
      : f.faction === 'aerie'
        ? '#047857'
        : f.team === 'ALLY'
          ? '#0284C7'
          : '#D97706';

    // Spawn exhaust particles per active nozzle
    const emitProb = Math.min(0.85, (0.35 + thrustPower * 0.55) * (dt * 60));
    for (const latOffset of nozzleOffsets) {
      if (Math.random() > emitProb) continue;

      const nozzleDist = f.radius * 0.88;
      const spawnX =
        f.x + backwardX * nozzleDist + perpX * latOffset + (Math.random() - 0.5) * 2.2;
      const spawnY =
        f.y + backwardY * nozzleDist + perpY * latOffset + (Math.random() - 0.5) * 2.2;

      const ejectSpeed = (75 + thrustPower * 155) + (Math.random() - 0.5) * 35;
      const spreadAngle = (Math.random() - 0.5) * (f.isThrusting ? 0.24 : 0.15);
      const ejectAngle = f.angle + Math.PI + spreadAngle;

      const baseSize =
        (f.role === 'Heavy Frigate' ? 3.2 : f.role === 'Hunter' ? 2.6 : 2.3) *
        (0.75 + thrustPower * 0.55);

      this.exhaustParticles.push({
        x: spawnX,
        y: spawnY,
        vx: f.vx * 0.32 + Math.cos(ejectAngle) * ejectSpeed,
        vy: f.vy * 0.32 + Math.sin(ejectAngle) * ejectSpeed,
        size: baseSize,
        maxSize: baseSize * 2.2,
        life: 0,
        maxLife: 0.32 + thrustPower * 0.28 + Math.random() * 0.12,
        colorCore,
        colorMid,
        colorTail,
      });
    }
  }

  /**
   * Renders persistent engine exhaust particles with thermal color transitions and frustum culling.
   */
  private renderExhaustParticles(
    ctx: CanvasRenderingContext2D,
    halfViewW: number,
    halfViewH: number
  ): void {
    if (this.exhaustParticles.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.exhaustParticles.length; i++) {
      const ep = this.exhaustParticles[i];
      if (
        Math.abs(ep.x - this.camX) > halfViewW ||
        Math.abs(ep.y - this.camY) > halfViewH
      ) {
        continue;
      }
      const progress = Math.max(0, Math.min(1, ep.life / ep.maxLife));
      const alpha = (1 - progress) * 0.8;
      if (alpha <= 0.03) continue;

      const currentRadius = ep.size + (ep.maxSize - ep.size) * progress;
      const color =
        progress < 0.22 ? ep.colorCore : progress < 0.62 ? ep.colorMid : ep.colorTail;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(
        ep.x - currentRadius,
        ep.y - currentRadius,
        currentRadius * 2,
        currentRadius * 2
      );
    }

    ctx.restore();
  }

  private renderFighter(
    ctx: CanvasRenderingContext2D,
    f: FighterEntity,
    isSectorLeader: boolean = false
  ): void {
    // 1. Fast 2-Pass Batched Wake Ribbon Trail Behind Fighter
    const fTrail = this.fighterTrails.get(f.id);
    if (fTrail && fTrail.length > 2) {
      ctx.save();
      const midIdx = Math.floor(fTrail.length * 0.5);
      ctx.strokeStyle =
        f.team === 'ALLY' ? 'rgba(45, 212, 191, 0.28)' : 'rgba(251, 113, 133, 0.26)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(fTrail[0].x, fTrail[0].y);
      for (let i = 1; i <= midIdx; i++) {
        ctx.lineTo(fTrail[i].x, fTrail[i].y);
      }
      ctx.stroke();

      ctx.strokeStyle =
        f.team === 'ALLY' ? 'rgba(45, 212, 191, 0.72)' : 'rgba(251, 113, 133, 0.68)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(fTrail[midIdx].x, fTrail[midIdx].y);
      for (let i = midIdx + 1; i < fTrail.length; i++) {
        ctx.lineTo(fTrail[i].x, fTrail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(f.x, f.y);

    // 2. Dynamic Energy Shield Aura (Zero per-frame gradient allocation!)
    const auraOuter = f.radius * 1.48;
    const shieldRatio = Math.max(0, Math.min(1, f.shield / Math.max(1, f.maxShield)));
    const isShieldActive = f.shield > 0 && f.shieldBrokenTimer <= 0;

    if (isShieldActive) {
      const rippleFlare = f.shieldRippleTimer > 0 ? (f.shieldRippleTimer / 0.28) * 0.35 : 0;
      const lowFlicker =
        shieldRatio < 0.25 ? 0.75 + 0.25 * Math.sin(this.matchElapsed * 28) : 1.0;
      const opacityScale = Math.min(
        1.0,
        (0.12 + 0.88 * Math.pow(shieldRatio, 0.85) + rippleFlare) * lowFlicker
      );

      const shieldCosmetic =
        f.shieldStyleId && f.shieldStyleId !== 'shield_default'
          ? COSMETIC_MAP.get(f.shieldStyleId)
          : undefined;
      const primaryRingColor = shieldCosmetic
        ? shieldCosmetic.previewPrimary
        : f.team === 'ALLY'
          ? '#2DD4BF'
          : '#FF2A6D';

      ctx.save();
      ctx.fillStyle = primaryRingColor;
      ctx.globalAlpha = 0.14 * opacityScale;
      ctx.beginPath();
      ctx.arc(0, 0, auraOuter, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = primaryRingColor;
      ctx.globalAlpha = 0.62 * opacityScale;
      ctx.lineWidth = f.shieldRippleTimer > 0 ? 2.6 : 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, auraOuter, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (shieldRatio < 0.45) {
        ctx.save();
        ctx.strokeStyle = primaryRingColor;
        ctx.globalAlpha = 0.55 * opacityScale;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          auraOuter * 0.9,
          this.matchElapsed * 1.5,
          this.matchElapsed * 1.5 + Math.PI * 1.65
        );
        ctx.stroke();
        ctx.restore();
      }
    } else if (f.shieldBrokenTimer > 0) {
      if (Math.random() < 0.35) {
        const sparkAng = Math.random() * Math.PI * 2;
        const sr = f.radius * (0.95 + Math.random() * 0.25);
        ctx.strokeStyle =
          f.team === 'ALLY' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(251, 113, 133, 0.55)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sparkAng) * sr, Math.sin(sparkAng) * sr);
        ctx.lineTo(
          Math.cos(sparkAng + 0.35) * (sr + 3),
          Math.sin(sparkAng + 0.35) * (sr + 3)
        );
        ctx.stroke();
      }
    }

    // 3. Detailed Starfighter Sprite Inside Aura (Zero per-frame gradient allocation)
    ctx.save();
    ctx.rotate(f.angle);
    const r = f.radius * 0.88;

    // Bright Thruster Core Flame Jet
    if (f.isThrusting || Math.hypot(f.vx, f.vy) > 35) {
      const jetLen = f.isThrusting ? r * (0.65 + f.thrustIntensity * 0.55) : r * 0.38;
      ctx.fillStyle = f.team === 'ALLY' ? '#5EEAD4' : '#FDA4AF';
      ctx.beginPath();
      ctx.moveTo(-r * 0.68, -3.4);
      ctx.lineTo(-r * 0.68 - jetLen, 0);
      ctx.lineTo(-r * 0.68, 3.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-r * 0.72, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const skinCosmetic =
      f.skinId && f.skinId !== 'skin_default' ? COSMETIC_MAP.get(f.skinId) : undefined;
    ctx.fillStyle =
      f.hitFlashTimer > 0
        ? '#FFFFFF'
        : skinCosmetic
          ? skinCosmetic.previewPrimary
          : '#E2E8F0';
    ctx.strokeStyle = skinCosmetic ? skinCosmetic.previewAccent : '#1E293B';
    ctx.lineWidth = 1.3;

    if (f.faction === 'incorruptus') {
      ctx.beginPath();
      ctx.moveTo(r * 1.15, 0);
      ctx.lineTo(r * 0.2, -r * 0.28);
      ctx.lineTo(-r * 0.35, -r * 0.92);
      ctx.lineTo(-r * 0.55, -r * 0.32);
      ctx.lineTo(-r * 0.88, -r * 0.45);
      ctx.lineTo(-r * 0.72, 0);
      ctx.lineTo(-r * 0.88, r * 0.45);
      ctx.lineTo(-r * 0.55, r * 0.32);
      ctx.lineTo(-r * 0.35, r * 0.92);
      ctx.lineTo(r * 0.2, r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.faction === 'omnitron') {
      ctx.beginPath();
      ctx.moveTo(r * 1.15, -r * 0.22);
      ctx.lineTo(r * 0.25, -r * 0.88);
      ctx.lineTo(-r * 0.85, -r * 0.52);
      ctx.lineTo(-r * 0.48, 0);
      ctx.lineTo(-r * 0.85, r * 0.52);
      ctx.lineTo(r * 0.25, r * 0.88);
      ctx.lineTo(r * 1.15, r * 0.22);
      ctx.lineTo(r * 0.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(r * 1.15, 0);
      ctx.quadraticCurveTo(r * 0.25, -r * 0.95, -r * 0.85, -r * 0.65);
      ctx.quadraticCurveTo(-r * 0.35, 0, -r * 0.85, r * 0.65);
      ctx.quadraticCurveTo(r * 0.25, r * 0.95, r * 1.15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Dark Cockpit Slit
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(r * 0.12, 0, r * 0.28, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Bracketed Pilot Callsign, Tier Badge & Shield/Health Bars
    if (isSectorLeader) {
      ctx.save();
      ctx.font = '700 11px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText('👑 #1 LEADER', 0, -f.radius - 23);
      ctx.restore();
    }

    if (!f.isPlayer) {
      ctx.font = '600 11px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.team === 'ALLY' ? '#5EEAD4' : '#FDA4AF';
      const tierRoman = f.ioLevel === 3 ? 'III' : f.ioLevel === 2 ? 'II' : 'I';
      const streakTag = (f.killStreak ?? 0) >= 3 ? ` · 🔥${f.killStreak}` : '';
      ctx.fillText(`[ ${f.callsign} · T${tierRoman}${streakTag} ]`, 0, f.radius + 17);

      const bw = 36;
      const by = -f.radius - 15;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(-bw * 0.5, by, bw, 6);
      if (f.shield > 0 && f.shieldBrokenTimer <= 0) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-bw * 0.5, by, bw * shieldRatio, 2);
      }
      ctx.fillStyle = f.team === 'ALLY' ? '#2DD4BF' : '#FB7185';
      ctx.fillRect(-bw * 0.5, by + 2.5, bw * (f.hp / f.maxHp), 3.5);
    } else {
      const tierStars =
        f.ioLevel === 3 ? '★★★ TIER III' : f.ioLevel === 2 ? '★★☆ TIER II' : '★☆☆ TIER I';
      const streakBadge = (f.killStreak ?? 0) >= 1 ? ` · 🔥${f.killStreak}` : '';
      ctx.font = '700 10px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.ioLevel === 3 ? '#FBBF24' : f.ioLevel === 2 ? '#14F1D9' : '#38BDF8';
      ctx.fillText(`[ ${tierStars}${streakBadge} ]`, 0, f.radius + 18);
    }

    ctx.restore();
  }
}
