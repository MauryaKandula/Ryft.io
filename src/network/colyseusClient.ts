import { Client, Room } from 'colyseus.js';
import { PublicRoomSummary } from '../components/MultiplayerLobbyModal';
import { FactionId, GameModeId, PilotProfile } from '../game/types';
import type {
  AuthoritativeWorldSnapshot,
  PlayerInputMessage,
  PlayerRefitMessage,
} from '../server/FleetIoRoom';

export type { AuthoritativeWorldSnapshot, PlayerInputMessage, PlayerRefitMessage };

const RECONNECT_TOKEN_KEY = 'fleet_io_reconnection_token_v1';

export interface CombatHitEvent {
  targetId: string;
  attackerId: string;
  x: number;
  y: number;
  shieldDmg: number;
  armorDmg: number;
  isHeavy: boolean;
  shieldBroke: boolean;
  angle: number;
}

export interface ShipDestroyedEvent {
  victimId: string;
  victimName: string;
  killerId: string;
  killerName: string;
  killerTeam: 'ALLY' | 'ENEMY';
  x: number;
  y: number;
}

export interface OrbPickupEvent {
  pilotId: string;
  x: number;
  y: number;
  value: number;
  color: string;
}

export interface PilotEvolvedEvent {
  pilotId: string;
  callsign: string;
  tier: 1 | 2 | 3;
  role: string;
  label: string;
  x: number;
  y: number;
}

export interface KillStreakNetworkEvent {
  pilotId: string;
  callsign: string;
  streak: number;
  title: string;
  subtitle: string;
  badgeText: string;
  voiceoverLine?: string;
  soundCueId?: 'STREAK_3' | 'STREAK_5' | 'STREAK_10' | 'TIER_2' | 'TIER_3';
  accentColor: string;
  glowColor: string;
  x: number;
  y: number;
}

export interface FleetNetworkCallbacks {
  onStatusChange: (
    status: 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE',
    roomCode: string | null,
    sessionId: string | null
  ) => void;
  onRoomsUpdated: (rooms: PublicRoomSummary[]) => void;
  onWorldSnapshot: (snapshot: AuthoritativeWorldSnapshot, localSessionId: string) => void;
  onCombatHit: (ev: CombatHitEvent, localSessionId: string) => void;
  onShipDestroyed: (ev: ShipDestroyedEvent, localSessionId: string) => void;
  onOrbPickup: (ev: OrbPickupEvent, localSessionId: string) => void;
  onPilotEvolved: (ev: PilotEvolvedEvent, localSessionId: string) => void;
  onKillStreak?: (ev: KillStreakNetworkEvent, localSessionId: string) => void;
  onPingMeasured: (pingMs: number) => void;
}

export class FleetColyseusNetwork {
  private client: Client;
  private activeRoom: Room | null = null;
  private callbacks: FleetNetworkCallbacks;
  private inputSeq = 0;
  private latencyMs = 18;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private roomListTimer: ReturnType<typeof setInterval> | null = null;
  private reconnecting = false;

  constructor(callbacks: FleetNetworkCallbacks) {
    this.callbacks = callbacks;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const endpoint = `${protocol}//${window.location.host}`;
    this.client = new Client(endpoint);
  }

  public startRoomListPolling(): void {
    this.fetchRooms();
    if (this.roomListTimer) clearInterval(this.roomListTimer);
    this.roomListTimer = setInterval(() => {
      this.fetchRooms();
    }, 3500);
  }

  public stopAll(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.roomListTimer) clearInterval(this.roomListTimer);
    if (this.activeRoom) {
      this.activeRoom.leave(true).catch(() => {});
      this.activeRoom = null;
    }
  }

  public async fetchRooms(): Promise<void> {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.rooms)) {
        this.callbacks.onRoomsUpdated(data.rooms);
      }
    } catch {
      // Ignore network hiccup during polling
    }
  }

  public getSessionId(): string | null {
    return this.activeRoom?.sessionId || null;
  }

  public getLatencyMs(): number {
    return this.latencyMs;
  }

  public isConnected(): boolean {
    return Boolean(this.activeRoom && this.activeRoom.sessionId);
  }

  public async joinOrCreateSector(
    roomCode: string,
    modeId: GameModeId,
    profile: PilotProfile
  ): Promise<boolean> {
    const cleanCode = (roomCode || 'SECTOR-7').trim().toUpperCase();
    this.callbacks.onStatusChange('CONNECTING', cleanCode, null);

    if (this.activeRoom) {
      try {
        await this.activeRoom.leave(true);
      } catch {
        // Ignore previous room close error
      }
      this.activeRoom = null;
    }

    const activeFaction: FactionId = profile.selectedFaction;
    const activeShipId = profile.selectedShipByFaction[activeFaction] || 'inc_viper';
    const cannonId = profile.selectedCannonByShip[activeShipId] || 'pulse_laser';
    const missileId = profile.selectedMissileByShip[activeShipId] || 'valkyrie_seeker';

    try {
      const room = await this.client.joinOrCreate('fleet_sector', {
        roomCode: cleanCode,
        roomName: `Sector ${cleanCode}`,
        modeId,
        callsign: profile.callsign || 'Pilot',
        faction: activeFaction,
        blueprintId: activeShipId,
        cannonId,
        missileId,
        skinId: profile.selectedSkinId || 'skin_default',
        trailId: profile.selectedTrailId || 'trail_default',
        shieldStyleId: profile.selectedShieldId || 'shield_default',
      });

      this.bindRoomHandlers(room, cleanCode);
      this.fetchRooms();
      return true;
    } catch {
      this.callbacks.onStatusChange('OFFLINE', null, null);
      return false;
    }
  }

  public async attemptReconnect(): Promise<boolean> {
    if (this.reconnecting) return false;
    let savedToken: string | null = null;
    try {
      savedToken = sessionStorage.getItem(RECONNECT_TOKEN_KEY);
    } catch {
      savedToken = null;
    }
    if (!savedToken) return false;

    this.reconnecting = true;
    this.callbacks.onStatusChange('RECONNECTING', null, null);

    try {
      const room = await this.client.reconnect(savedToken);
      this.reconnecting = false;
      this.bindRoomHandlers(room, 'SECTOR-7');
      return true;
    } catch {
      this.reconnecting = false;
      try {
        sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
      } catch {
        // Ignore storage error
      }
      this.callbacks.onStatusChange('OFFLINE', null, null);
      return false;
    }
  }

  private bindRoomHandlers(room: Room, fallbackRoomCode: string): void {
    this.activeRoom = room;

    try {
      if (room.reconnectionToken) {
        sessionStorage.setItem(RECONNECT_TOKEN_KEY, room.reconnectionToken);
      }
    } catch {
      // Ignore storage error
    }

    this.callbacks.onStatusChange('CONNECTED', fallbackRoomCode, room.sessionId);

    room.onMessage('world_snapshot', (snapshot: AuthoritativeWorldSnapshot) => {
      if (room.reconnectionToken) {
        try {
          sessionStorage.setItem(RECONNECT_TOKEN_KEY, room.reconnectionToken);
        } catch {
          // Ignore
        }
      }
      this.callbacks.onWorldSnapshot(snapshot, room.sessionId);
    });

    room.onMessage('combat_hit', (ev: CombatHitEvent) => {
      this.callbacks.onCombatHit(ev, room.sessionId);
    });

    room.onMessage('ship_destroyed', (ev: ShipDestroyedEvent) => {
      this.callbacks.onShipDestroyed(ev, room.sessionId);
    });

    room.onMessage('orb_pickup', (ev: OrbPickupEvent) => {
      this.callbacks.onOrbPickup(ev, room.sessionId);
    });

    room.onMessage('pilot_evolved', (ev: PilotEvolvedEvent) => {
      this.callbacks.onPilotEvolved(ev, room.sessionId);
    });

    room.onMessage('kill_streak', (ev: KillStreakNetworkEvent) => {
      this.callbacks.onKillStreak?.(ev, room.sessionId);
    });

    room.onMessage('pong_check', (msg: { t: number }) => {
      if (msg && typeof msg.t === 'number') {
        const rtt = Math.max(1, Date.now() - msg.t);
        this.latencyMs = rtt;
        this.callbacks.onPingMeasured(rtt);
      }
    });

    room.onLeave((code: number) => {
      this.activeRoom = null;
      // Code 4000 is consented leave; unexpected drop triggers auto-reconnect attempt
      if (code !== 4000 && code !== 1000) {
        this.attemptReconnect();
      } else {
        this.callbacks.onStatusChange('OFFLINE', null, null);
      }
    });

    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.activeRoom && this.activeRoom.sessionId) {
        this.activeRoom.send('ping_check', { t: Date.now() });
      }
    }, 2500);
  }

  public sendInput(input: Omit<PlayerInputMessage, 'seq'>): number {
    if (!this.activeRoom || !this.activeRoom.sessionId) return 0;
    const seq = ++this.inputSeq;
    this.activeRoom.send('input', {
      seq,
      ...input,
    });
    return seq;
  }

  public sendRefit(refit: PlayerRefitMessage): void {
    if (!this.activeRoom || !this.activeRoom.sessionId) return;
    this.activeRoom.send('refit', refit);
  }
}
