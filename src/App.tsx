import React, { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { CosmeticStoreModal } from './components/CosmeticStoreModal';
import {
  MultiplayerLobbyModal,
  PublicRoomSummary,
} from './components/MultiplayerLobbyModal';
import {
  OfflineIndicator,
  PWAInstallButton,
} from './components/PWAInstallButton';
import {
  EquipmentPreviewIcon,
  FactionCommanderAvatar,
  PocketFleetSplashLogo,
  PocketFleetWingHeader,
  RankHexagonBadge,
  TutorialNavigatorAvatar,
  TutorialTiltDevicesIllustration,
} from './components/PocketFleetArt';
import {
  FACTIONS,
  GAME_MODES,
  getRankFromKillpoints,
  getShipTierFromMass,
  SHIP_BLUEPRINTS,
  WEAPONS,
} from './game/catalog';
import {
  SECTOR_CELL_SIZE,
  RealtimePocketFleetArena,
} from './game/realtimeArena';
import {
  FactionId,
  GameModeId,
  GameShellState,
  KillFeedItem,
  KillStreakAnnouncement,
  LeaderboardEntry,
  OffscreenBracketBlip,
  PilotProfile,
} from './game/types';
import { FleetColyseusNetwork } from './network/colyseusClient';
import { BRANDING, PROJECT_ID } from './config/branding';
import { LegalAndIpModal, LegalTabId } from './components/LegalAndIpModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { mobileBridge } from './platform/mobileBridge';

const STORAGE_KEY = `${PROJECT_ID}_profile_v3`;
const LEGACY_STORAGE_KEY = 'ryft_cyber_mobile_v3';

const INITIAL_PROFILE: PilotProfile = {
  callsign: 'Kuro-7',
  email: 'kuro7@ryft.io',
  killpoints: 1000,
  totalKills: 0,
  totalDeaths: 0,
  level: 1,
  credits: 1000,
  cyberTheme: true,
  sandboxUnlockAll: true,
  tutorialCompleted: false,
  unlockedShips: [
    'inc_viper',
    'inc_paladin',
    'inc_hyperion',
    'omn_spectre',
    'omn_vector',
    'omn_monolith',
    'aer_stinger',
    'aer_ravager',
    'aer_leviathan',
  ],
  unlockedWeapons: Object.keys(WEAPONS),
  shipUpgrades: {},
  selectedFaction: 'incorruptus',
  selectedShipByFaction: {
    incorruptus: 'inc_viper',
    omnitron: 'omn_spectre',
    aerie: 'aer_stinger',
  },
  selectedCannonByShip: {},
  selectedMissileByShip: {},
  unlockedCosmetics: ['skin_default', 'trail_default', 'shield_default'],
  selectedSkinId: 'skin_default',
  selectedTrailId: 'trail_default',
  selectedShieldId: 'shield_default',
  adsWatchedCount: 0,
};

function loadSavedProfile(): PilotProfile {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return INITIAL_PROFILE;
    return { ...INITIAL_PROFILE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_PROFILE;
  }
}

export default function App() {
  const [shellState, setShellState] = useState<GameShellState>('SPLASH');
  const [selectedMode, setSelectedMode] = useState<GameModeId>('team_match');
  const [profile, setProfile] = useState<PilotProfile>(loadSavedProfile);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.muted);
  const [musicVolume, setMusicVolume] = useState<number>(() => soundEngine.musicVolume);
  const [sfxVolume, setSfxVolume] = useState<number>(() => soundEngine.sfxVolume);
  const [uiVolume, setUiVolume] = useState<number>(() => soundEngine.uiVolume);
  const [showSoundSubMenu, setShowSoundSubMenu] = useState<boolean>(false);

  // Login & User Details interactive fields
  const [loginName, setLoginName] = useState<string>(profile.callsign);
  const [loginPassword, setLoginPassword] = useState<string>('••••••••••');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [userDetailModalNote, setUserDetailModalNote] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{
    googleConfigured: boolean;
    facebookConfigured: boolean;
    googleCallback: string;
    facebookCallback: string;
  }>({
    googleConfigured: false,
    facebookConfigured: false,
    googleCallback: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/google/callback`,
    facebookCallback: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/facebook/callback`,
  });
  const [legalModalTab, setLegalModalTab] = useState<LegalTabId | null>(null);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    {
      rank: number;
      callsign: string;
      faction: FactionId;
      highestMass: number;
      killpoints: number;
      totalKills: number;
    }[]
  >([]);

  // Pre-Launch Countdown & Tutorial Step (0 = off, 1 = Step 1 Controls, 2 = Step 2 Tilt & Energy)
  const [launchCountdown, setLaunchCountdown] = useState<number>(6);
  const [tutorialStep, setTutorialStep] = useState<0 | 1 | 2>(0);

  // Multiplayer Colyseus state
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>('SECTOR-ALPHA');
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'CONNECTING' | 'OFFLINE'>('CONNECTING');
  const colyseusNetRef = useRef<FleetColyseusNetwork | null>(null);

  // Live HUD Telemetry snapshots (~12Hz)
  const [showTacticalGrid, setShowTacticalGrid] = useState<boolean>(true);
  const [hudState, setHudState] = useState({
    hp: 135,
    maxHp: 135,
    shield: 90,
    maxShield: 90,
    energy: 130,
    maxEnergy: 130,
    missileChargeRatio: 1,
    isDockedInBay: true,
    respawnTimer: 0,
    kills: 0,
    deaths: 0,
    killStreak: 0,
    survivalTime: 0,
    ioScore: 100,
    ioLevel: 1,
    allyScore: 0,
    enemyScore: 0,
    allyMothershipHp: 1500,
    enemyMothershipHp: 1500,
    sectorCode: 'SEC-C4',
    playerX: 500,
    playerY: 1000,
    radarBlips: [] as { id: string; x: number; y: number; team: 'ALLY' | 'ENEMY'; isPlayer: boolean }[],
    killFeed: [] as KillFeedItem[],
    brackets: [] as OffscreenBracketBlip[],
    leaderboard: [] as LeaderboardEntry[],
    activeAnnouncement: null as KillStreakAnnouncement | null,
    fps: 322,
    ping: 20,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaRef = useRef<RealtimePocketFleetArena>(new RealtimePocketFleetArena());
  const shellStateRef = useRef<GameShellState>(shellState);
  const profileRef = useRef<PilotProfile>(profile);
  const tutorialStepRef = useRef<0 | 1 | 2>(tutorialStep);

  useEffect(() => {
    shellStateRef.current = shellState;
  }, [shellState]);

  useEffect(() => {
    tutorialStepRef.current = tutorialStep;
  }, [tutorialStep]);

  useEffect(() => {
    profileRef.current = profile;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota
    }
  }, [profile]);

  // Initialize arena on mount, lifecycle bridge, and check for ?room= invite link
  useEffect(() => {
    mobileBridge.initLifecycleListeners();
    arenaRef.current.startMatch('team_match', profileRef.current);
    const params = new URLSearchParams(window.location.search);
    const invitedRoom = params.get('room');
    if (invitedRoom && invitedRoom.trim()) {
      setActiveRoomId(invitedRoom.trim().toUpperCase());
      setShellState('LOADOUT_OVERLAY');
    }
  }, []);

  // Pre-Launch Countdown Timer when on LOADOUT_OVERLAY (Screenshot 6: "ENTERING MATCH 6")
  useEffect(() => {
    if (shellState !== 'LOADOUT_OVERLAY') return;
    setLaunchCountdown(6);
    const interval = setInterval(() => {
      setLaunchCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [shellState]);

  // DeviceOrientation Gyroscope Tilt Support for Mobile Devices (Screenshot 8: "TILT YOUR DEVICE TO ROTATE YOUR SHIP")
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (shellStateRef.current !== 'PLAYING') return;
      const tilt = e.gamma || 0; // -90 to 90 degrees
      if (Math.abs(tilt) > 4) {
        arenaRef.current.touchSteerAxis = Math.max(-1, Math.min(1, tilt / 28));
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // Keyboard Fallback Support (WASD / Arrows + Space / E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shellStateRef.current !== 'PLAYING') return;
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        arenaRef.current.touchThrottleHeld = true;
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        arenaRef.current.touchSteerAxis = -1;
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        arenaRef.current.touchSteerAxis = 1;
      } else if (e.key === ' ') {
        arenaRef.current.touchPrimaryHeld = true;
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'Shift') {
        arenaRef.current.touchSecondaryJustPressed = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        arenaRef.current.touchThrottleHeld = false;
      } else if (
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'ArrowLeft' ||
        e.key === 'd' ||
        e.key === 'D' ||
        e.key === 'ArrowRight'
      ) {
        arenaRef.current.touchSteerAxis = 0;
      } else if (e.key === ' ') {
        arenaRef.current.touchPrimaryHeld = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize Server-Authoritative Guest/Session Account & OAuth Message Listener
  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setOauthProviders({
            googleConfigured: Boolean(data.googleConfigured),
            facebookConfigured: Boolean(data.facebookConfigured),
            googleCallback:
              data.callbacks?.google || `${window.location.origin}/auth/google/callback`,
            facebookCallback:
              data.callbacks?.facebook || `${window.location.origin}/auth/facebook/callback`,
          });
        }
      })
      .catch(() => {});

    // Establish or restore persistent Guest/Player session on server
    fetch('/api/auth/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(profileRef.current.sessionToken
          ? { Authorization: `Bearer ${profileRef.current.sessionToken}` }
          : {}),
      },
      body: JSON.stringify({ callsign: profileRef.current.callsign }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile) {
          setProfile((prev) => ({
            ...prev,
            playerId: data.profile.playerId,
            authProvider: data.profile.authProvider,
            linkedProviders: data.profile.linkedProviders,
            sessionToken: data.sessionToken,
          }));
        }
      })
      .catch(() => {});

    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.profile) {
        soundEngine.playRepair();
        const srvProfile = event.data.profile as PilotProfile;
        setProfile((prev) => ({
          ...prev,
          ...srvProfile,
          sessionToken: event.data.sessionToken || srvProfile.sessionToken,
        }));
        setLoginName(srvProfile.callsign);
        setAuthNotice(
          `VERIFIED ${(event.data.provider || 'OAUTH').toUpperCase()} IDENTITY: ${srvProfile.callsign}`
        );
        setShellState('USER_DETAILS');
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setAuthNotice(`OAUTH ERROR: ${event.data.error || 'Authentication failed'}`);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Fetch Global Leaderboards when viewing HIGHSCORE
  useEffect(() => {
    if (shellState !== 'HIGHSCORE') return;
    fetch('/api/leaderboards')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.byScore) {
          setGlobalLeaderboard(data.byScore);
        }
      })
      .catch(() => {});
  }, [shellState]);

  const handleOAuthPopupSignIn = async (provider: 'google' | 'facebook') => {
    soundEngine.playSelect();
    setAuthNotice(null);
    try {
      const redirectUri = `${window.location.origin}/auth/${provider}/callback`;
      const linkToken = profile.sessionToken || '';
      const res = await fetch(
        `/api/auth/${provider}/url?redirectUri=${encodeURIComponent(
          redirectUri
        )}&linkToken=${encodeURIComponent(linkToken)}`
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        setAuthNotice(
          data.error ||
            `${provider.toUpperCase()} OAuth requires server credentials in .env (see LEGAL / OAUTH settings).`
        );
        return;
      }
      window.open(data.url, `${provider}_oauth_popup`, 'width=560,height=680');
    } catch {
      setAuthNotice(`Unable to reach /api/auth/${provider}/url.`);
    }
  };

  // Connect to Authoritative Colyseus Server on Port 3000
  useEffect(() => {
    const net = new FleetColyseusNetwork({
      onStatusChange: (status) => {
        setWsStatus(status === 'RECONNECTING' ? 'CONNECTING' : status);
        if (status === 'OFFLINE') {
          arenaRef.current.setAuthoritativeMode(false, null);
        }
      },
      onRoomsUpdated: (roomList) => {
        setRooms(roomList);
      },
      onWorldSnapshot: (snapshot, localSessionId) => {
        arenaRef.current.applyAuthoritativeSnapshot(snapshot, localSessionId);
      },
      onCombatHit: (ev) => {
        arenaRef.current.handleNetworkCombatHit(ev);
      },
      onShipDestroyed: (ev) => {
        arenaRef.current.handleNetworkShipDestroyed(ev);
      },
      onOrbPickup: (ev) => {
        arenaRef.current.handleNetworkOrbPickup(ev);
      },
      onPilotEvolved: (ev) => {
        arenaRef.current.handleNetworkPilotEvolved(ev);
      },
      onKillStreak: (ev) => {
        arenaRef.current.handleNetworkKillStreak(ev);
      },
      onPingMeasured: () => {},
    });

    colyseusNetRef.current = net;
    net.startRoomListPolling();

    arenaRef.current.setColyseusInputSender((input) => {
      net.sendInput(input);
    });

    const params = new URLSearchParams(window.location.search);
    const initialRoomCode = (params.get('room') || 'SECTOR-ALPHA').trim().toUpperCase();
    setActiveRoomId(initialRoomCode);

    void net.joinOrCreateSector(initialRoomCode, selectedMode, profileRef.current);

    return () => {
      arenaRef.current.setColyseusInputSender(null);
      net.stopAll();
    };
  }, []);

  const syncColyseusRefit = useCallback((updatedProfile: PilotProfile) => {
    const net = colyseusNetRef.current;
    if (!net || !net.isConnected()) return;
    const fac = updatedProfile.selectedFaction;
    const bpId =
      updatedProfile.selectedShipByFaction[fac] ||
      SHIP_BLUEPRINTS.find((b) => b.faction === fac)!.id;
    const bp =
      SHIP_BLUEPRINTS.find((b) => b.id === bpId) ||
      SHIP_BLUEPRINTS.find((b) => b.faction === fac)!;
    net.sendRefit({
      callsign: updatedProfile.callsign,
      faction: fac,
      blueprintId: bp.id,
      cannonId: updatedProfile.selectedCannonByShip[bp.id] || bp.defaultCannonId,
      missileId: updatedProfile.selectedMissileByShip[bp.id] || bp.defaultMissileId,
      skinId: updatedProfile.selectedSkinId || 'skin_default',
      trailId: updatedProfile.selectedTrailId || 'trail_default',
      shieldStyleId: updatedProfile.selectedShieldId || 'shield_default',
    });
  }, []);

  // Enter Pre-Launch Hangar Over Live Space Arena (Screenshot 6)
  const handleEnterBattleLoadout = useCallback(
    (modeToStart: GameModeId = selectedMode) => {
      soundEngine.playSelect();
      arenaRef.current.startMatch(modeToStart, profileRef.current);
      setShellState('LOADOUT_OVERLAY');
      if (colyseusNetRef.current) {
        void colyseusNetRef.current.joinOrCreateSector(
          activeRoomId || 'SECTOR-ALPHA',
          modeToStart,
          profileRef.current
        );
      }
    },
    [selectedMode, activeRoomId]
  );

  // Launch from Pre-Launch Loadout into Active Flight
  const handleLaunchFromHangar = useCallback(() => {
    soundEngine.playTurnStart(true);
    arenaRef.current.refitPlayerShip(profileRef.current);
    syncColyseusRefit(profileRef.current);
    setShellState('PLAYING');
    if (!profileRef.current.tutorialCompleted) {
      setTutorialStep(1);
    }
  }, [syncColyseusRefit]);

  // Cycle Ship / Cannon / Missile in the 3-card Loadout Overlay (Screenshot 6 "SELECT" buttons)
  const handleCycleShip = () => {
    soundEngine.playSelect();
    const faction = profile.selectedFaction;
    const pool = SHIP_BLUEPRINTS.filter((b) => b.faction === faction);
    const currentId = profile.selectedShipByFaction[faction] || pool[0].id;
    const idx = pool.findIndex((b) => b.id === currentId);
    const nextBp = pool[(idx + 1) % pool.length];

    setProfile((prev) => {
      const updated: PilotProfile = {
        ...prev,
        selectedShipByFaction: {
          ...prev.selectedShipByFaction,
          [faction]: nextBp.id,
        },
      };
      arenaRef.current.refitPlayerShip(updated);
      syncColyseusRefit(updated);
      return updated;
    });
  };

  const handleCycleCannon = () => {
    soundEngine.playSelect();
    const faction = profile.selectedFaction;
    const shipId =
      profile.selectedShipByFaction[faction] ||
      SHIP_BLUEPRINTS.find((b) => b.faction === faction)!.id;
    const shipBp =
      SHIP_BLUEPRINTS.find((b) => b.id === shipId) || SHIP_BLUEPRINTS[0];
    const cannons = Object.values(WEAPONS).filter((w) => w.category === 'CANNON');
    const currentId = profile.selectedCannonByShip[shipBp.id] || shipBp.defaultCannonId;
    const idx = cannons.findIndex((w) => w.id === currentId);
    const nextW = cannons[(idx + 1) % cannons.length];

    setProfile((prev) => {
      const updated: PilotProfile = {
        ...prev,
        selectedCannonByShip: {
          ...prev.selectedCannonByShip,
          [shipBp.id]: nextW.id,
        },
      };
      arenaRef.current.refitPlayerShip(updated);
      syncColyseusRefit(updated);
      return updated;
    });
  };

  const handleCycleMissile = () => {
    soundEngine.playSelect();
    const faction = profile.selectedFaction;
    const shipId =
      profile.selectedShipByFaction[faction] ||
      SHIP_BLUEPRINTS.find((b) => b.faction === faction)!.id;
    const shipBp =
      SHIP_BLUEPRINTS.find((b) => b.id === shipId) || SHIP_BLUEPRINTS[0];
    const missiles = Object.values(WEAPONS).filter((w) => w.category === 'MISSILE');
    const currentId = profile.selectedMissileByShip[shipBp.id] || shipBp.defaultMissileId;
    const idx = missiles.findIndex((w) => w.id === currentId);
    const nextW = missiles[(idx + 1) % missiles.length];

    setProfile((prev) => {
      const updated: PilotProfile = {
        ...prev,
        selectedMissileByShip: {
          ...prev.selectedMissileByShip,
          [shipBp.id]: nextW.id,
        },
      };
      arenaRef.current.refitPlayerShip(updated);
      syncColyseusRefit(updated);
      return updated;
    });
  };

  // Join a multiplayer room via Colyseus
  const handleJoinMultiplayerRoom = useCallback(
    (roomId: string, _roomName: string, modeId: GameModeId) => {
      setSelectedMode(modeId);
      setActiveRoomId(roomId);
      arenaRef.current.startMatch(modeId, profileRef.current);
      setShellState('PLAYING');
      if (colyseusNetRef.current) {
        void colyseusNetRef.current.joinOrCreateSector(roomId, modeId, profileRef.current);
      }
    },
    []
  );

  // 60fps Isolated Canvas Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let hudSyncAccumulator = 0;
    let smoothedFps = 60;
    let currentDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;

    const handleResize = () => {
      if (!canvas) return;
      currentDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      canvas.width = Math.round(viewW * currentDpr);
      canvas.height = Math.round(viewH * currentDpr);
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${viewH}px`;
    };

    const handleBlur = () => {
      arenaRef.current.leftMouseHeld = false;
      arenaRef.current.touchThrottleHeld = false;
      arenaRef.current.touchPrimaryHeld = false;
      arenaRef.current.touchSteerAxis = 0;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('blur', handleBlur);

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      if (rawDt > 0.001 && rawDt < 0.25) {
        smoothedFps = smoothedFps * 0.9 + (1 / rawDt) * 0.1;
      }

      const currentShell = shellStateRef.current;
      const arena = arenaRef.current;
      const isCanvasVisible =
        currentShell === 'PLAYING' ||
        currentShell === 'LOADOUT_OVERLAY' ||
        currentShell === 'WATCH_TRAILER' ||
        currentShell === 'PAUSED' ||
        currentShell === 'MATCH_OVER';

      if (!isCanvasVisible) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const isSpectator =
        currentShell === 'LOADOUT_OVERLAY' ||
        currentShell === 'WATCH_TRAILER' ||
        tutorialStepRef.current > 0;

      if (
        currentShell === 'PLAYING' ||
        currentShell === 'LOADOUT_OVERLAY' ||
        currentShell === 'WATCH_TRAILER'
      ) {
        arena.update(rawDt, viewW, viewH, isSpectator);

        if (currentShell === 'PLAYING' && arena.matchWinner) {
          const won = arena.matchWinner === 'ALLY';
          const modeSpec =
            GAME_MODES.find((m) => m.id === arena.modeId) || GAME_MODES[0];
          const player = arena.getPlayer();
          const pKills = player?.kills || 0;
          const pDeaths = player?.deaths || 0;
          const earnedCredits = (won ? modeSpec.rewardCredits : 150) + pKills * 30;
          const earnedKp = (won ? modeSpec.rewardKp : 150) + pKills * 100;

          setProfile((prev) => ({
            ...prev,
            credits: prev.credits + earnedCredits,
            killpoints: prev.killpoints + earnedKp,
            totalKills: prev.totalKills + pKills,
            totalDeaths: prev.totalDeaths + pDeaths,
          }));

          soundEngine.playVictory(won);
          setShellState('MATCH_OVER');
        }
      }

      ctx.save();
      ctx.scale(currentDpr, currentDpr);
      arena.render(ctx, viewW, viewH, profileRef.current.cyberTheme);
      ctx.restore();

      hudSyncAccumulator += rawDt;
      if (hudSyncAccumulator >= 0.1) {
        hudSyncAccumulator = 0;
        const p = arena.getPlayer();
        if (p) {
          const missileSpec = WEAPONS[p.missileId] || WEAPONS.valkyrie_seeker;
          const maxCd = 1 / missileSpec.fireRate;
          const chargeRatio = Math.max(0, Math.min(1, 1 - p.missileCooldown / maxCd));

          const colIdx = Math.max(0, Math.min(11, Math.floor(p.x / SECTOR_CELL_SIZE)));
          const rowIdx = Math.max(0, Math.min(7, Math.floor(p.y / SECTOR_CELL_SIZE)));
          const sectorCode = `SEC-${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;

          setHudState({
            hp: Math.ceil(p.hp),
            maxHp: p.maxHp,
            shield: Math.ceil(p.shield),
            maxShield: p.maxShield,
            energy: Math.ceil(p.energy),
            maxEnergy: p.maxEnergy,
            missileChargeRatio: chargeRatio,
            isDockedInBay: p.isDockedInBay,
            respawnTimer: p.respawnTimer,
            kills: p.kills,
            deaths: p.deaths,
            killStreak: p.killStreak ?? 0,
            survivalTime: Math.floor(p.survivalTime ?? 0),
            ioScore: Math.round(p.ioScore ?? 100),
            ioLevel: p.ioLevel ?? 1,
            allyScore: arena.allyScore,
            enemyScore: arena.enemyScore,
            allyMothershipHp: Math.ceil(arena.motherships.ALLY.hp),
            enemyMothershipHp: Math.ceil(arena.motherships.ENEMY.hp),
            sectorCode,
            playerX: Math.round(p.x),
            playerY: Math.round(p.y),
            radarBlips: arena.fighters
              .filter((f) => f.respawnTimer <= 0)
              .map((f) => ({
                id: f.id,
                x: f.x,
                y: f.y,
                team: f.team,
                isPlayer: f.isPlayer,
              })),
            killFeed: [...arena.killFeed],
            brackets: arena.getOffscreenBrackets(viewW, viewH),
            leaderboard: arena.getLeaderboard(),
            activeAnnouncement: arena.activeAnnouncement ? { ...arena.activeAnnouncement } : null,
            fps: Math.min(240, Math.max(30, Math.round(smoothedFps))),
            ping: colyseusNetRef.current?.getLatencyMs() || 18,
          });
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Canvas Mouse Handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    arenaRef.current.mouseScreenX = e.clientX;
    arenaRef.current.mouseScreenY = e.clientY;
    arenaRef.current.mouseActive = true;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (shellState !== 'PLAYING' || tutorialStep > 0) return;
    arenaRef.current.mouseActive = true;
    if (e.button === 0) {
      arenaRef.current.leftMouseHeld = true;
    } else if (e.button === 2) {
      e.preventDefault();
      arenaRef.current.rightMouseJustPressed = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      arenaRef.current.leftMouseHeld = false;
    }
  };

  // Current Equipped Loadout Info & Dynamic Blue vs Red Faction Theme
  const activeFaction = profile.selectedFaction;
  const isRedFaction = activeFaction === 'omnitron';
  const factionThemeAttr = isRedFaction ? 'red' : 'blue';
  const factionPrimaryHex = isRedFaction ? '#FF003C' : '#00F0FF';
  const factionSecondaryHex = isRedFaction ? '#FF2A6D' : '#38BDF8';
  const activeShipId =
    profile.selectedShipByFaction[activeFaction] ||
    SHIP_BLUEPRINTS.find((b) => b.faction === activeFaction)!.id;
  const activeShipBp =
    SHIP_BLUEPRINTS.find((b) => b.id === activeShipId) ||
    SHIP_BLUEPRINTS.find((b) => b.faction === activeFaction)!;
  const activeCannonId =
    profile.selectedCannonByShip[activeShipBp.id] || activeShipBp.defaultCannonId;
  const activeMissileId =
    profile.selectedMissileByShip[activeShipBp.id] || activeShipBp.defaultMissileId;
  const activeCannonSpec = WEAPONS[activeCannonId] || WEAPONS.pulse_laser;
  const activeMissileSpec = WEAPONS[activeMissileId] || WEAPONS.valkyrie_seeker;
  const rankInfo = getRankFromKillpoints(profile.killpoints);
  const hexBgClass = profile.cyberTheme ? 'pf-hex-bg-cyber' : 'pf-hex-bg';

  return (
    <div
      data-faction-theme={factionThemeAttr}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-screen h-screen overflow-hidden bg-[#02040A] select-none"
    >
      {/* Isolated 60fps Space Battlefield Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full h-full cursor-crosshair"
      />

      {/* =====================================================================
          SCREEN 1: SPLASH SCREEN ("TOUCH THE SCREEN TO START")
      ===================================================================== */}
      {shellState === 'SPLASH' && (
        <div
          onClick={() => {
            soundEngine.playSelect();
            setShellState('MAIN_MENU');
          }}
          className={`fixed inset-0 z-30 flex flex-col items-center justify-between py-12 px-6 cursor-pointer ${hexBgClass}`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs tracking-[0.25em] text-cyan-400/90 uppercase font-bold">
              {BRANDING.GAME_NAME.toUpperCase()} · CYBERPUNK 2077 BLACKWALL &amp; EDGERUNNERS EDITION
            </div>
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 bg-black/70 border border-cyan-500/60 px-3 py-1"
            >
              <span className="text-[11px] tracking-widest text-cyan-200 uppercase">
                FACTION PROTOCOL:
              </span>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setProfile((p) => ({ ...p, selectedFaction: 'incorruptus' }));
                }}
                className={`px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase cursor-pointer border transition-all ${
                  !isRedFaction
                    ? 'bg-[#00F0FF] text-slate-950 border-[#A5F3FC] shadow-[0_0_12px_#00F0FF]'
                    : 'bg-[#030A1C] text-[#38BDF8] border-[#00F0FF]/50 hover:border-[#00F0FF]'
                }`}
              >
                ⬡ BLUE NET-GRID
              </button>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setProfile((p) => ({ ...p, selectedFaction: 'omnitron' }));
                }}
                className={`px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase cursor-pointer border transition-all ${
                  isRedFaction
                    ? 'bg-[#FF003C] text-white border-[#FDA4AF] shadow-[0_0_12px_#FF003C]'
                    : 'bg-[#19030A] text-[#FF2A6D] border-[#FF003C]/50 hover:border-[#FF003C]'
                }`}
              >
                △ RED BLACKWALL
              </button>
            </div>
          </div>

          <div className="my-auto w-full flex flex-col items-center">
            <PocketFleetSplashLogo
              cyberMode={profile.cyberTheme}
              faction={profile.selectedFaction}
            />
          </div>

          <div className="text-lg md:text-2xl tracking-[0.22em] text-cyan-300 animate-pulse uppercase font-bold drop-shadow-[0_0_12px_rgba(0,240,255,0.6)]">
            TOUCH THE SCREEN TO START
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: MAIN MENU (START / HIGHSCORE / WATCH TRAILER / CREDITS)
      ===================================================================== */}
      {shellState === 'MAIN_MENU' && (
        <div
          className={`fixed inset-0 z-30 flex flex-col items-center justify-between p-4 md:p-6 overflow-y-auto ${hexBgClass}`}
        >
          <PocketFleetWingHeader
            faction={profile.selectedFaction}
            rightSlot={
              <div className="flex flex-wrap items-center gap-2">
                <PWAInstallButton compact />
                {/* Direct Blue vs Red Blackwall Faction Theme Toggle */}
                <div className="flex items-center border border-cyan-500/70 bg-black/75 p-0.5">
                  <button
                    onClick={() => {
                      soundEngine.playSelect();
                      setProfile((p) => ({ ...p, selectedFaction: 'incorruptus' }));
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase cursor-pointer transition-all ${
                      !isRedFaction
                        ? 'bg-[#00F0FF] text-slate-950 shadow-[0_0_10px_#00F0FF]'
                        : 'text-[#38BDF8] hover:text-white'
                    }`}
                  >
                    ⬡ BLUE
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playSelect();
                      setProfile((p) => ({ ...p, selectedFaction: 'omnitron' }));
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase cursor-pointer transition-all ${
                      isRedFaction
                        ? 'bg-[#FF003C] text-white shadow-[0_0_10px_#FF003C]'
                        : 'text-[#FF2A6D] hover:text-white'
                    }`}
                  >
                    △ RED BLACKWALL
                  </button>
                </div>
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('COSMETIC_STORE');
                  }}
                  className="pf-grid-btn-cyan px-3 py-1 text-xs tracking-wider uppercase font-bold cursor-pointer"
                >
                  🎨 COSMETICS
                </button>
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setProfile((p) => ({ ...p, cyberTheme: !p.cyberTheme }));
                  }}
                  className="pf-grid-btn px-3 py-1 text-xs tracking-wider uppercase cursor-pointer"
                >
                  {profile.cyberTheme ? 'BLACKWALL HD' : 'GRID MODE'}
                </button>
              </div>
            }
          />

          <div className="w-full max-w-xl my-auto flex flex-col gap-3 px-2">
            {/* Instant Web Quick-Play Bar */}
            <div className="pf-panel p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center border border-cyan-500/80 bg-[#030A1C] px-3 py-1.5">
                <span className="text-xs text-cyan-400 mr-2 whitespace-nowrap">EDGERUNNER:</span>
                <input
                  type="text"
                  value={profile.callsign}
                  maxLength={16}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLoginName(val);
                    setProfile((p) => ({ ...p, callsign: val || 'Pilot' }));
                  }}
                  className="w-full bg-transparent text-cyan-100 text-sm font-bold tracking-wider focus:outline-none"
                  placeholder="Callsign"
                />
              </div>

              <button
                onClick={() => {
                  soundEngine.playSelect();
                  const nextF: FactionId =
                    profile.selectedFaction === 'incorruptus' ? 'omnitron' : 'incorruptus';
                  setProfile((p) => ({ ...p, selectedFaction: nextF }));
                }}
                className="px-3 py-1.5 border border-cyan-500/80 bg-[#051229] text-xs font-bold tracking-wider text-sky-300 uppercase cursor-pointer whitespace-nowrap"
                title="Click to switch between Blue Net-Grid and Red Blackwall Factions"
              >
                {FACTIONS[profile.selectedFaction].symbol} {FACTIONS[profile.selectedFaction].name}
              </button>

              <button
                onClick={() => handleEnterBattleLoadout(selectedMode)}
                className="pf-grid-btn-cyan px-4 py-1.5 text-sm tracking-widest uppercase font-bold cursor-pointer whitespace-nowrap"
              >
                ⚡ INSTANT PLAY (.IO)
              </button>
            </div>

            <button
              onClick={() => {
                soundEngine.playSelect();
                setShellState('LOGIN');
              }}
              className="pf-grid-btn w-full py-3 text-2xl md:text-3xl tracking-[0.2em] uppercase font-bold cursor-pointer"
            >
              START
            </button>

            <button
              onClick={() => {
                soundEngine.playSelect();
                setShellState('HIGHSCORE');
              }}
              className="pf-grid-btn w-full py-3 text-2xl md:text-3xl tracking-[0.2em] uppercase font-bold cursor-pointer"
            >
              HIGHSCORE
            </button>

            <button
              onClick={() => {
                soundEngine.playSelect();
                arenaRef.current.startMatch('team_match', profile);
                setShellState('WATCH_TRAILER');
              }}
              className="pf-grid-btn w-full py-3 text-2xl md:text-3xl tracking-[0.2em] uppercase font-bold cursor-pointer"
            >
              WATCH TRAILER
            </button>

            <button
              onClick={() => {
                soundEngine.playSelect();
                setShellState('CREDITS');
              }}
              className="pf-grid-btn w-full py-3 text-2xl md:text-3xl tracking-[0.2em] uppercase font-bold cursor-pointer"
            >
              CREDITS
            </button>
          </div>

          <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 text-xs text-sky-400/80 px-2">
            <span>
              ACTIVE THEME:{' '}
              {isRedFaction
                ? 'RED BLACKWALL AI (NEXUS PROTOCOL)'
                : 'BLUE EDGERUNNER NET-GRID (VANGUARD SYNAPSE)'}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setLegalModalTab('IP_AUDIT');
                }}
                className="text-cyan-300 hover:text-cyan-100 underline tracking-wider uppercase cursor-pointer"
              >
                ⚖ LEGAL / IP AUDIT / PRIVACY
              </button>
              <span>{BRANDING.GAME_NAME.toUpperCase()} · WEB &amp; MOBILE ARENA</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: LOG IN / CREATE CHARACTER
      ===================================================================== */}
      {shellState === 'LOGIN' && (
        <div
          className={`fixed inset-0 z-30 flex flex-col items-center justify-between p-4 md:p-6 overflow-y-auto ${hexBgClass}`}
        >
          <PocketFleetWingHeader
            faction={profile.selectedFaction}
            showBackToMenu
            onBackToMenu={() => {
              soundEngine.playSelect();
              setShellState('MAIN_MENU');
            }}
          />

          <div className="w-full max-w-3xl my-auto flex flex-col gap-4 px-2">
            <div className="text-lg tracking-[0.18em] text-cyan-300 uppercase">
              LOG IN
            </div>

            {/* NAME & PASSWORD Inputs Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between border-2 border-cyan-500 bg-[#030A1C]/95 px-4 py-2.5 shadow-[0_0_14px_rgba(0,240,255,0.28)]">
                <span className="text-cyan-400 tracking-wider mr-2 whitespace-nowrap">
                  NAME :
                </span>
                <input
                  type="text"
                  value={loginName}
                  maxLength={16}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full bg-transparent text-cyan-100 text-xl tracking-wider focus:outline-none"
                />
                <span className="ml-2 px-1.5 py-0.5 border border-cyan-400 text-xs text-cyan-200 font-bold">
                  A
                </span>
              </div>

              <div className="flex items-center justify-between border-2 border-cyan-500 bg-[#030A1C]/95 px-4 py-2.5 shadow-[0_0_14px_rgba(0,240,255,0.28)]">
                <span className="text-cyan-400 tracking-wider mr-2 whitespace-nowrap">
                  PASSWORD :
                </span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-transparent text-cyan-300 text-xl tracking-widest focus:outline-none"
                />
                <span className="ml-2 px-1.5 py-0.5 border border-cyan-400 text-xs text-cyan-200 font-bold">
                  A
                </span>
              </div>
            </div>

            {/* LOG IN Gridded Button */}
            <button
              onClick={async () => {
                soundEngine.playSelect();
                const cleanName = loginName.trim() || 'Kuro-7';
                setProfile((p) => ({
                  ...p,
                  callsign: cleanName,
                }));
                try {
                  const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(profile.sessionToken
                        ? { Authorization: `Bearer ${profile.sessionToken}` }
                        : {}),
                    },
                    body: JSON.stringify({ callsign: cleanName, email: profile.email }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data?.profile) {
                      setProfile((prev) => ({
                        ...prev,
                        playerId: data.profile.playerId,
                        authProvider: data.profile.authProvider,
                        linkedProviders: data.profile.linkedProviders,
                        sessionToken: data.sessionToken,
                      }));
                    }
                  }
                } catch {
                  // Continue offline if needed
                }
                setShellState('USER_DETAILS');
              }}
              className="pf-grid-btn w-full py-3 text-2xl md:text-3xl tracking-[0.22em] uppercase font-bold cursor-pointer"
            >
              LOG IN
            </button>

            {/* THIRD-PARTY OAUTH 2.0 (GOOGLE & FACEBOOK) + GUEST ACCOUNT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                onClick={() => handleOAuthPopupSignIn('google')}
                className="pf-grid-btn-cyan py-2.5 px-3 text-xs md:text-sm tracking-wider uppercase font-bold cursor-pointer flex items-center justify-center gap-2"
              >
                <span>G</span>
                <span>CONTINUE WITH GOOGLE</span>
              </button>

              <button
                onClick={() => handleOAuthPopupSignIn('facebook')}
                className="pf-grid-btn-cyan py-2.5 px-3 text-xs md:text-sm tracking-wider uppercase font-bold cursor-pointer flex items-center justify-center gap-2"
              >
                <span>f</span>
                <span>CONTINUE WITH FACEBOOK</span>
              </button>

              <button
                onClick={async () => {
                  soundEngine.playSelect();
                  const cleanName =
                    loginName.trim() || `Guest-${Math.floor(100 + Math.random() * 900)}`;
                  setLoginName(cleanName);
                  try {
                    const res = await fetch('/api/auth/guest', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(profile.sessionToken
                          ? { Authorization: `Bearer ${profile.sessionToken}` }
                          : {}),
                      },
                      body: JSON.stringify({ callsign: cleanName }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data?.profile) {
                        setProfile((prev) => ({
                          ...prev,
                          callsign: cleanName,
                          playerId: data.profile.playerId,
                          authProvider: 'guest',
                          linkedProviders: data.profile.linkedProviders,
                          sessionToken: data.sessionToken,
                        }));
                      }
                    }
                  } catch {
                    // Fallback local guest
                  }
                  setShellState('USER_DETAILS');
                }}
                className="pf-grid-btn py-2.5 px-3 text-xs md:text-sm tracking-wider uppercase font-bold cursor-pointer"
              >
                ⚡ PLAY AS GUEST
              </button>
            </div>

            {authNotice && (
              <div className="border border-cyan-500/70 bg-[#051229] px-3 py-2 text-xs text-cyan-200 flex items-center justify-between gap-2">
                <span>{authNotice}</span>
                <button
                  onClick={() => setLegalModalTab('DATA_DELETION')}
                  className="text-sky-300 underline uppercase whitespace-nowrap cursor-pointer"
                >
                  OAUTH SETUP INFO
                </button>
              </div>
            )}

            {/* FORGOT PASSWORD & REMEMBER ME Row */}
            <div className="flex items-center justify-between text-sm md:text-base text-cyan-300 tracking-wider py-1">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setLoginPassword('••••••••••');
                }}
                className="hover:text-cyan-100 cursor-pointer"
              >
                ▸ FORGOT PASSWORD
              </button>

              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setRememberMe(!rememberMe);
                }}
                className="flex items-center gap-3 cursor-pointer"
              >
                <span>REMEMBER ME</span>
                <span className="w-8 h-8 border-2 border-cyan-400 bg-[#030A1C] flex items-center justify-center">
                  {rememberMe && <span className="w-3.5 h-3.5 bg-cyan-400 block" />}
                </span>
              </button>
            </div>

            {/* CREATE A NEW CHARACTER Section */}
            <div className="mt-1">
              <div className="text-base md:text-lg tracking-[0.18em] text-cyan-300 uppercase mb-2">
                CREATE A NEW CHARACTER
              </div>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setProfile((p) => ({
                    ...p,
                    callsign: loginName.trim() || 'Kuro-7',
                  }));
                  setShellState('CHOOSE_SIDE');
                }}
                className="pf-grid-btn w-full py-3.5 text-2xl md:text-3xl tracking-[0.22em] uppercase font-bold cursor-pointer"
              >
                CREATE CHARACTER
              </button>
            </div>
          </div>

          <div className="h-2" />
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: CHOOSE YOUR SIDE WISELY (BLUE NETRUNNER VS RED BLACKWALL)
      ===================================================================== */}
      {shellState === 'CHOOSE_SIDE' && (
        <div
          className={`fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 overflow-y-auto ${hexBgClass}`}
        >
          <div className="pf-panel w-full max-w-3xl p-4 md:p-6 flex flex-col justify-between gap-4">
            <div className="text-center text-lg md:text-xl tracking-[0.2em] text-cyan-300 uppercase font-bold">
              CHOOSE YOUR FACTION PROTOCOL · BLUE NET-GRID OR RED BLACKWALL
            </div>

            {/* Recruiting +1000 Bonus KP Callout Banner & Faction Checkboxes */}
            <div className="flex flex-col gap-2">
              <div className="inline-block self-start border border-cyan-400 bg-[#051229]">
                <div className="px-2.5 py-0.5 text-xs tracking-widest text-cyan-300 flex items-center gap-1.5">
                  <span>{isRedFaction ? '△' : '⬡'}</span>
                  <span>RECRUITING</span>
                </div>
                <div className="bg-cyan-400 text-slate-950 font-bold px-2.5 py-1 text-xs md:text-sm tracking-wider">
                  JOIN FOR 1000 BONUS KP
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                {/* BLUE FACTION: VANGUARD SYNAPSE Selector (Always styled in Electric Blue) */}
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setProfile((p) => ({ ...p, selectedFaction: 'incorruptus' }));
                  }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <span
                    style={{
                      borderColor: '#00F0FF',
                      backgroundColor: '#030A1C',
                      boxShadow:
                        profile.selectedFaction === 'incorruptus'
                          ? '0 0 14px rgba(0,240,255,0.75)'
                          : 'none',
                    }}
                    className="w-9 h-9 border-2 flex items-center justify-center"
                  >
                    {profile.selectedFaction === 'incorruptus' && (
                      <span style={{ backgroundColor: '#00F0FF' }} className="w-4 h-4 block" />
                    )}
                  </span>
                  <span
                    style={{ color: '#00F0FF', textShadow: '0 0 12px rgba(0,240,255,0.55)' }}
                    className="text-xl md:text-2xl font-bold tracking-wider flex items-center gap-2"
                  >
                    <span>⬡</span>
                    <span>{FACTIONS.incorruptus.name} (BLUE)</span>
                  </span>
                </button>

                <span className="text-cyan-500/60 text-2xl hidden sm:inline">|</span>

                {/* RED FACTION: NEXUS PROTOCOL Selector (Always styled in Blackwall Crimson Red) */}
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setProfile((p) => ({ ...p, selectedFaction: 'omnitron' }));
                  }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <span
                    style={{ color: '#FF003C', textShadow: '0 0 12px rgba(255,0,60,0.65)' }}
                    className="text-xl md:text-2xl font-bold tracking-wider flex items-center gap-2"
                  >
                    <span>△</span>
                    <span>{FACTIONS.omnitron.name} (RED)</span>
                  </span>
                  <span
                    style={{
                      borderColor: '#FF003C',
                      backgroundColor: '#19030A',
                      boxShadow:
                        profile.selectedFaction === 'omnitron'
                          ? '0 0 14px rgba(255,0,60,0.8)'
                          : 'none',
                    }}
                    className="w-9 h-9 border-2 flex items-center justify-center"
                  >
                    {profile.selectedFaction === 'omnitron' && (
                      <span style={{ backgroundColor: '#FF003C' }} className="w-4 h-4 block" />
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Commander Portraits & Speech Bubble */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-1">
              <div
                onClick={() => setProfile((p) => ({ ...p, selectedFaction: 'incorruptus' }))}
                className="cursor-pointer shrink-0"
              >
                <FactionCommanderAvatar
                  faction="incorruptus"
                  active={profile.selectedFaction === 'incorruptus'}
                />
              </div>

              <div className="relative flex-1 border-2 border-cyan-500/80 bg-[#041026]/90 p-4 text-cyan-100 text-sm md:text-base leading-relaxed tracking-wide shadow-inner">
                {FACTIONS[profile.selectedFaction].commanderSpeech}
              </div>

              <div
                onClick={() => setProfile((p) => ({ ...p, selectedFaction: 'omnitron' }))}
                className="cursor-pointer shrink-0"
              >
                <FactionCommanderAvatar
                  faction="omnitron"
                  active={profile.selectedFaction === 'omnitron'}
                />
              </div>
            </div>

            {/* CONTINUE Gridded Button */}
            <button
              onClick={() => {
                soundEngine.playRepair();
                setProfile((p) => ({
                  ...p,
                  killpoints: Math.max(1000, p.killpoints),
                }));
                setShellState('USER_DETAILS');
              }}
              className="pf-grid-btn w-full py-3 text-2xl md:text-3xl tracking-[0.22em] uppercase font-bold cursor-pointer"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 5: USER DETAILS
      ===================================================================== */}
      {shellState === 'USER_DETAILS' && (
        <div
          className={`fixed inset-0 z-30 flex flex-col items-center justify-between p-3 md:p-6 overflow-y-auto ${hexBgClass}`}
        >
          <div className="w-full max-w-4xl my-auto flex flex-col gap-3">
            {/* Top Tabs: MAIN MENU | USER DETAILS + Direct Blue/Red Faction Switcher */}
            <div className="flex flex-wrap items-end justify-between border-b-2 border-cyan-400 gap-2">
              <div className="flex items-end">
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('MAIN_MENU');
                  }}
                  className="pf-grid-btn px-6 py-2 text-sm md:text-base tracking-widest uppercase cursor-pointer border-b-0"
                >
                  MAIN MENU
                </button>
                <div
                  className="bg-cyan-400 text-slate-950 font-bold px-8 py-2 text-sm md:text-base tracking-widest uppercase shadow-[0_0_16px_rgba(0,240,255,0.45)]"
                  style={{
                    clipPath: 'polygon(0 0, 88% 0, 100% 100%, 0% 100%)',
                  }}
                >
                  USER DETAILS
                </div>
              </div>

              <div className="flex items-center gap-1.5 pb-1.5">
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setProfile((p) => ({ ...p, selectedFaction: 'incorruptus' }));
                  }}
                  style={{
                    borderColor: '#00F0FF',
                    backgroundColor: !isRedFaction ? '#00F0FF' : '#030A1C',
                    color: !isRedFaction ? '#020617' : '#38BDF8',
                  }}
                  className="px-3 py-1 border text-xs font-bold tracking-wider uppercase cursor-pointer"
                >
                  ⬡ BLUE FACTION
                </button>
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setProfile((p) => ({ ...p, selectedFaction: 'omnitron' }));
                  }}
                  style={{
                    borderColor: '#FF003C',
                    backgroundColor: isRedFaction ? '#FF003C' : '#19030A',
                    color: isRedFaction ? '#FFFFFF' : '#FF2A6D',
                  }}
                  className="px-3 py-1 border text-xs font-bold tracking-wider uppercase cursor-pointer"
                >
                  △ RED FACTION
                </button>
              </div>
            </div>

            {/* Middle Split: Striped User Stats Table (Left) + Rank Hexagon Badge (Right) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2">
              {/* Left Striped Table */}
              <div className="md:col-span-7 border-2 border-cyan-500/80 bg-[#030A1C]/90 overflow-hidden shadow-[0_0_24px_rgba(0,240,255,0.22)]">
                <div className="pf-table-row flex items-center justify-between px-4 py-2.5 text-base md:text-lg">
                  <span className="text-cyan-400 tracking-wider">NAME</span>
                  <span className="text-cyan-100 font-bold uppercase tracking-wider">
                    {profile.callsign}
                  </span>
                </div>
                <div className="pf-table-row flex items-center justify-between px-4 py-2.5 text-base md:text-lg tabular-nums">
                  <span className="text-cyan-400 tracking-wider">KILLPOINTS</span>
                  <span className="text-cyan-100 font-bold">
                    {profile.killpoints.toLocaleString('en-US').replace(',', ' ')}
                  </span>
                </div>
                <div className="pf-table-row flex items-center justify-between px-4 py-2.5 text-base md:text-lg tabular-nums">
                  <span className="text-cyan-400 tracking-wider">DEATHCOUNT</span>
                  <span className="text-cyan-100 font-bold">{profile.totalDeaths}</span>
                </div>
                <div className="pf-table-row flex items-center justify-between px-4 py-2.5 text-base md:text-lg tabular-nums">
                  <span className="text-cyan-400 tracking-wider">KILLCOUNT</span>
                  <span className="text-cyan-100 font-bold">{profile.totalKills}</span>
                </div>
                <div
                  onClick={() => {
                    soundEngine.playSelect();
                    const nextF: FactionId =
                      profile.selectedFaction === 'incorruptus' ? 'omnitron' : 'incorruptus';
                    setProfile((p) => ({ ...p, selectedFaction: nextF }));
                  }}
                  className="pf-table-row flex items-center justify-between px-4 py-2.5 text-sm md:text-base cursor-pointer hover:bg-cyan-500/15"
                >
                  <span className="text-cyan-400 tracking-wider">FACTION (TAP TO SWITCH)</span>
                  <span className="text-sky-300 font-bold">
                    {FACTIONS[profile.selectedFaction].symbol}{' '}
                    {FACTIONS[profile.selectedFaction].name}
                  </span>
                </div>
                <div
                  onClick={() => {
                    soundEngine.playSelect();
                    const idx = GAME_MODES.findIndex((m) => m.id === selectedMode);
                    setSelectedMode(GAME_MODES[(idx + 1) % GAME_MODES.length].id);
                  }}
                  className="pf-table-row flex items-center justify-between px-4 py-2.5 text-sm md:text-base cursor-pointer hover:bg-cyan-500/15"
                >
                  <span className="text-cyan-400 tracking-wider">SECTOR MODE (TAP)</span>
                  <span className="text-indigo-300 font-bold uppercase">
                    {GAME_MODES.find((m) => m.id === selectedMode)?.name}
                  </span>
                </div>
              </div>

              {/* Right Rank Insignia & Segmented Progress Bar */}
              <div className="md:col-span-5 flex flex-col items-center justify-center gap-2">
                <div className="text-lg md:text-xl tracking-[0.22em] text-cyan-300 uppercase">
                  {rankInfo.title}
                </div>

                <RankHexagonBadge
                  numeral={rankInfo.roman}
                  faction={profile.selectedFaction}
                />

                <div className="text-sm md:text-base tracking-[0.18em] text-cyan-300 tabular-nums mt-1">
                  NEXT-{rankInfo.nextKp}KP
                </div>

                {/* Vertical Segmented Progress Bar */}
                <div className="w-full max-w-xs grid grid-cols-20 gap-1 p-1.5 bg-[#030A1C] border border-cyan-500/50">
                  {Array.from({ length: 20 }).map((_, idx) => {
                    const filled = idx / 20 < rankInfo.progressRatio;
                    return (
                      <div
                        key={idx}
                        className={`h-7 ${
                          filled ? 'bg-cyan-300 shadow-[0_0_8px_#00f0ff]' : 'bg-[#081A38]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {userDetailModalNote && (
              <div className="text-center text-xs text-cyan-300 py-1">
                {userDetailModalNote}
              </div>
            )}

            {/* 4 Action Buttons: CHANGE EMAIL | CHANGE PASSWORD | COSMETIC HANGAR | EXPANSION PACKS */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setUserDetailModalNote(
                    `PILOT COMMS LINKED: ${profile.callsign.toLowerCase()}@ryft.io`
                  );
                }}
                className="pf-grid-btn md:col-span-3 py-2 text-xs md:text-sm tracking-widest uppercase leading-tight cursor-pointer"
              >
                CHANGE
                <br />
                EMAIL
              </button>

              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setUserDetailModalNote('SECURITY KEY ROTATED · ENCRYPTION VERIFIED');
                }}
                className="pf-grid-btn md:col-span-3 py-2 text-xs md:text-sm tracking-widest uppercase leading-tight cursor-pointer"
              >
                CHANGE
                <br />
                PASSWORD
              </button>

              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('COSMETIC_STORE');
                }}
                className="pf-grid-btn col-span-1 md:col-span-3 py-2 text-xs md:text-sm tracking-widest uppercase font-bold leading-tight cursor-pointer text-cyan-200"
              >
                COSMETIC
                <br />
                HANGAR
              </button>

              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('EXPANSION_PACKS');
                }}
                className="pf-grid-btn-cyan col-span-1 md:col-span-3 py-2 text-xs md:text-sm tracking-[0.16em] uppercase font-bold leading-tight cursor-pointer"
              >
                EXPANSION
                <br />
                PACKS
              </button>
            </div>

            {/* Bottom Primary CTA: GO TO BATTLE */}
            <button
              onClick={() => handleEnterBattleLoadout(selectedMode)}
              className="pf-grid-btn w-full py-3.5 text-2xl md:text-4xl tracking-[0.24em] uppercase font-bold cursor-pointer mt-1"
            >
              GO TO BATTLE
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          EXPANSION PACKS & SANDBOX ARMORY MODAL
      ===================================================================== */}
      {shellState === 'EXPANSION_PACKS' && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${hexBgClass}`}
        >
          <div className="pf-panel w-full max-w-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-cyan-500/50 pb-3">
              <h2 className="text-xl font-bold tracking-widest text-cyan-300 uppercase">
                CYBERPUNK & XENO-HELIX EXPANSION PACKS
              </h2>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('USER_DETAILS');
                }}
                className="pf-grid-btn px-4 py-1 text-xs uppercase cursor-pointer"
              >
                BACK
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="pf-card-grid p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-emerald-400">
                    ☣ XENO-HELIX BIO-SWARM EXPANSION
                  </div>
                  <p className="text-xs text-sky-100/80 mt-1">
                    Unlocks the spliced Helix Stinger, Helix Ravager, and Helix Leviathan with
                    passive synth-chitin regeneration and shield-piercing Spore Torpedoes.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundEngine.playRepair();
                    setProfile((p) => ({ ...p, selectedFaction: 'aerie' }));
                    setShellState('USER_DETAILS');
                  }}
                  className="pf-grid-btn-cyan py-2 text-xs font-bold uppercase cursor-pointer"
                >
                  EQUIP XENO-HELIX FLEET
                </button>
              </div>

              <div className="pf-card-grid p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-cyan-300">
                    ⚡ CYBERPUNK OVERDRIVE & SANDBOX
                  </div>
                  <p className="text-xs text-sky-100/80 mt-1">
                    Unlocks all 9 starships, Tri-Scatter Cannons, and Nova Heavy Warheads across
                    every faction with +2,000 Bonus Killpoints.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundEngine.playRepair();
                    setProfile((p) => ({
                      ...p,
                      sandboxUnlockAll: true,
                      killpoints: p.killpoints + 1000,
                    }));
                  }}
                  className="pf-grid-btn py-2 text-xs font-bold uppercase cursor-pointer"
                >
                  CLAIM +1000 KP & UNLOCK ALL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          HIGHSCORE & CREDITS & TRAILER SCREENS
      ===================================================================== */}
      {(shellState === 'HIGHSCORE' || shellState === 'CREDITS') && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${hexBgClass}`}
        >
          <div className="pf-panel w-full max-w-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-cyan-500/50 pb-3">
              <h2 className="text-xl font-bold tracking-widest text-cyan-300 uppercase">
                {shellState === 'HIGHSCORE'
                  ? `${BRANDING.GAME_NAME.toUpperCase()} · SECTOR & GLOBAL HIGHSCORES`
                  : `${BRANDING.GAME_NAME.toUpperCase()} · CREDITS & LEGAL`}
              </h2>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('MAIN_MENU');
                }}
                className="pf-grid-btn px-4 py-1.5 text-xs uppercase cursor-pointer"
              >
                MAIN MENU
              </button>
            </div>

            {shellState === 'HIGHSCORE' ? (
              <div className="border border-cyan-500/60 divide-y divide-cyan-500/30">
                {(globalLeaderboard.length > 0
                  ? globalLeaderboard.map((g) => ({
                      name: g.callsign,
                      kp: g.killpoints,
                      kills: g.totalKills,
                      mass: g.highestMass,
                      faction: `${FACTIONS[g.faction].symbol} ${FACTIONS[g.faction].name}`,
                    }))
                  : [
                      {
                        name: profile.callsign,
                        kp: profile.killpoints,
                        kills: profile.totalKills,
                        mass: profile.highestMass || 100,
                        faction: '⬡ VANGUARD SYNAPSE',
                      },
                      {
                        name: 'CipherBlade',
                        kp: 8450,
                        kills: 42,
                        mass: 1850,
                        faction: '⬡ VANGUARD SYNAPSE',
                      },
                      {
                        name: 'NeonWraith',
                        kp: 6200,
                        kills: 31,
                        mass: 1420,
                        faction: '△ NEXUS PROTOCOL',
                      },
                      {
                        name: 'VoltRunner',
                        kp: 4900,
                        kills: 24,
                        mass: 1180,
                        faction: '⬡ VANGUARD SYNAPSE',
                      },
                      {
                        name: 'ZeroCool_X',
                        kp: 3150,
                        kills: 15,
                        mass: 890,
                        faction: '☣ XENO-HELIX',
                      },
                    ]
                )
                  .sort((a, b) => b.kp - a.kp)
                  .slice(0, 8)
                  .map((row, idx) => (
                    <div
                      key={idx}
                      className="pf-table-row flex items-center justify-between px-4 py-2.5 text-sm md:text-base tabular-nums"
                    >
                      <span className="text-cyan-100">
                        0{idx + 1}. <strong>{row.name}</strong> ({row.faction})
                      </span>
                      <span className="text-cyan-300 font-bold">
                        {row.kp} KP · {row.kills} KILLS
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="space-y-3 text-sm md:text-base text-sky-100 leading-relaxed">
                <p>
                  <strong className="text-cyan-300">
                    {BRANDING.GAME_NAME.toUpperCase()} EDITION:
                  </strong>{' '}
                  {BRANDING.GAME_DESCRIPTION}
                </p>
                <p>
                  <strong className="text-indigo-300">AUTHORITATIVE MULTIPLAYER ENGINE:</strong>{' '}
                  Built as a 60fps Canvas 2D + Colyseus WebSocket server-authoritative game with
                  automatic AI squadron fallback, Mothership docking bay mechanics, 3-Tier survival
                  ship evolution, persistent accounts, and shareable sector room links.
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setLegalModalTab('IP_AUDIT')}
                    className="pf-grid-btn-cyan px-4 py-2 text-xs font-bold uppercase cursor-pointer"
                  >
                    ⚖ VIEW IP AUDIT REPORT
                  </button>
                  <button
                    onClick={() => setLegalModalTab('TOS')}
                    className="pf-grid-btn px-4 py-2 text-xs font-bold uppercase cursor-pointer"
                  >
                    📜 TERMS &amp; PRIVACY POLICY
                  </button>
                  <button
                    onClick={() => setLegalModalTab('DATA_DELETION')}
                    className="pf-grid-btn px-4 py-2 text-xs font-bold uppercase cursor-pointer"
                  >
                    🔐 OAUTH &amp; ACCOUNT DELETION
                  </button>
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="pf-grid-btn-cyan px-4 py-2 text-xs font-bold uppercase cursor-pointer"
                  >
                    📊 SERVER TELEMETRY &amp; REVENUE
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {shellState === 'WATCH_TRAILER' && (
        <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <div className="bg-[#030A1C]/90 border border-cyan-400 px-4 py-1.5 text-xs tracking-widest text-cyan-300">
              LIVE BATTLE TRAILER · REAL-TIME ENGINE PREVIEW
            </div>
            <button
              onClick={() => {
                soundEngine.playSelect();
                setShellState('MAIN_MENU');
              }}
              className="pointer-events-auto pf-grid-btn px-5 py-2 text-xs font-bold uppercase cursor-pointer"
            >
              EXIT TRAILER
            </button>
          </div>
          <div className="self-center bg-[#030A1C]/90 border border-sky-400 px-6 py-3 text-center">
            <div className="text-lg font-bold tracking-widest text-cyan-300">
              DOCK AT YOUR MOTHERSHIP · CUSTOMIZE SHIPS & WEAPONS · CONQUER THE SECTOR
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 6: PRE-LAUNCH / DOCKED 3-CARD LOADOUT OVERLAY
      ===================================================================== */}
      {shellState === 'LOADOUT_OVERLAY' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 md:p-5 bg-[#010510]/45">
          {/* Top Faction-Reactive Banner */}
          <div className="relative w-full max-w-4xl mx-auto">
            <div className="flex items-center justify-between bg-[#030A1C]/90 border-b-2 border-cyan-400 px-4 py-2 shadow-[0_4px_20px_rgba(0,240,255,0.35)]">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('MULTIPLAYER_LOBBY');
                }}
                className="w-8 h-8 rounded-full bg-cyan-600/80 hover:bg-cyan-500 border border-cyan-300/60 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                title="Chat / Rooms"
              >
                💬
              </button>

              <div className="text-center">
                <div className="text-xs md:text-sm tracking-[0.22em] text-cyan-300 uppercase">
                  JOINED THE GAME AS
                </div>
                <div className="text-xl md:text-3xl font-bold tracking-[0.18em] text-cyan-200 flex items-center justify-center gap-2">
                  <span>{FACTIONS[activeFaction].symbol}</span>
                  <span>{FACTIONS[activeFaction].name}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('USER_DETAILS');
                }}
                className="w-8 h-8 rounded-full bg-indigo-700/90 hover:bg-indigo-600 border border-indigo-400/60 flex items-center justify-center text-white text-sm cursor-pointer"
                title="Back to User Details"
              >
                ⚙
              </button>
            </div>
          </div>

          {/* Center 3-Card Equipment Selector + LAUNCH Button */}
          <div className="relative w-full max-w-2xl mx-auto my-auto pf-panel p-3 md:p-4">
            {/* 3 Side-by-Side Gridded Cards */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4 mb-3">
              {/* Card 1: Ship Hull */}
              <div className="pf-card-grid flex flex-col justify-between p-2 md:p-3">
                <div className="py-2">
                  <EquipmentPreviewIcon
                    type="SHIP"
                    faction={activeFaction}
                    itemId={activeShipBp.id}
                  />
                </div>
                <div>
                  <div className="bg-cyan-400 text-slate-950 font-bold text-xs md:text-sm px-2 py-0.5 tracking-wider uppercase truncate">
                    {activeShipBp.shortLabel}
                  </div>
                  <button
                    onClick={handleCycleShip}
                    className="w-full mt-1.5 py-1.5 border border-cyan-400/80 bg-[#030A1C] hover:bg-cyan-500/20 text-cyan-200 text-xs md:text-sm tracking-widest uppercase cursor-pointer"
                  >
                    SELECT
                  </button>
                </div>
              </div>

              {/* Card 2: Primary Cannon */}
              <div className="pf-card-grid flex flex-col justify-between p-2 md:p-3">
                <div className="py-2">
                  <EquipmentPreviewIcon
                    type="CANNON"
                    faction={activeFaction}
                    itemId={activeCannonSpec.id}
                  />
                </div>
                <div>
                  <div className="bg-cyan-400 text-slate-950 font-bold text-xs md:text-sm px-2 py-0.5 tracking-wider uppercase truncate">
                    {activeCannonSpec.shortLabel}
                  </div>
                  <button
                    onClick={handleCycleCannon}
                    className="w-full mt-1.5 py-1.5 border border-cyan-400/80 bg-[#030A1C] hover:bg-cyan-500/20 text-cyan-200 text-xs md:text-sm tracking-widest uppercase cursor-pointer"
                  >
                    SELECT
                  </button>
                </div>
              </div>

              {/* Card 3: Secondary Homing Missile */}
              <div className="pf-card-grid flex flex-col justify-between p-2 md:p-3">
                <div className="py-2">
                  <EquipmentPreviewIcon
                    type="MISSILE"
                    faction={activeFaction}
                    itemId={activeMissileSpec.id}
                  />
                </div>
                <div>
                  <div className="bg-cyan-400 text-slate-950 font-bold text-xs md:text-sm px-2 py-0.5 tracking-wider uppercase truncate">
                    {activeMissileSpec.shortLabel}
                  </div>
                  <button
                    onClick={handleCycleMissile}
                    className="w-full mt-1.5 py-1.5 border border-cyan-400/80 bg-[#030A1C] hover:bg-cyan-500/20 text-cyan-200 text-xs md:text-sm tracking-widest uppercase cursor-pointer"
                  >
                    SELECT
                  </button>
                </div>
              </div>
            </div>

            {/* Center Floating "ENTERING MATCH" Countdown Banner */}
            {launchCountdown > 0 && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#030A1C]/90 border border-cyan-400/70 px-8 py-3 text-center rounded shadow-2xl">
                <div className="text-sm md:text-base tracking-[0.2em] text-cyan-100 uppercase">
                  ENTERING MATCH
                </div>
                <div className="text-xl md:text-2xl font-bold text-cyan-300 tabular-nums mt-0.5">
                  {launchCountdown}
                </div>
              </div>
            )}

            {/* Full-Width LAUNCH Gridded Button + Cosmetics Quick-Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('COSMETIC_STORE');
                }}
                className="pf-grid-btn-cyan px-4 py-3 text-xs md:text-sm tracking-widest uppercase font-bold cursor-pointer whitespace-nowrap"
              >
                🎨 SKINS &amp; TRAILS
              </button>
              <button
                onClick={handleLaunchFromHangar}
                className="pf-grid-btn flex-1 py-3 text-2xl md:text-4xl tracking-[0.25em] uppercase font-bold cursor-pointer"
              >
                LAUNCH
              </button>
            </div>
          </div>

          {/* Bottom Preview of Killfeed & Energy Bar */}
          <div className="w-full flex items-end justify-between text-xs">
            <div className="font-mono text-cyan-400/80 tabular-nums">
              <div>{hudState.fps}</div>
              <div>{hudState.ping}</div>
            </div>

            <div className="flex-1 mx-4">
              <div className="flex flex-col items-start gap-0.5 mb-1">
                <div className="bg-black/80 px-2 py-0.5 text-sky-400 text-xs">
                  [=] ZeroCool_X
                </div>
                <div className="bg-black/80 px-2 py-0.5 text-cyan-300 text-xs">
                  [=] Rookie Cyber Mantis
                </div>
                <div className="bg-black/80 px-2 py-0.5 text-indigo-300 text-xs">
                  [=] NeonWraith
                </div>
              </div>
              <div className="w-full h-1.5 bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums">
              <div className="border border-cyan-500/70 bg-[#030A1C] px-3 py-0.5 text-cyan-200">
                🗡 {hudState.kills}
              </div>
              <div className="border border-cyan-500/70 bg-[#030A1C] px-3 py-0.5 text-cyan-200">
                ☠ {hudState.deaths}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREENS 7, 8, 9, 10: ACTIVE MOBILE GAMEPLAY HUD & 2-STEP TUTORIAL
      ===================================================================== */}
      {shellState === 'PLAYING' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3">
          {/* Edge-of-Screen Bracket Pilot Indicators */}
          {hudState.brackets.map((b) => (
            <div
              key={b.id}
              style={{
                left: `${b.screenX}px`,
                top: `${b.screenY}px`,
              }}
              className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1 text-xs font-mono whitespace-nowrap"
            >
              <span
                className={
                  b.team === 'ALLY'
                    ? 'text-cyan-400 font-bold'
                    : 'text-rose-500 font-bold'
                }
              >
                [
              </span>
              <span
                className={
                  b.team === 'ALLY'
                    ? 'text-cyan-200/90 bg-black/50 px-1'
                    : 'text-rose-300/90 bg-black/50 px-1'
                }
              >
                {b.name}
              </span>
              <span
                className={
                  b.team === 'ALLY'
                    ? 'text-cyan-400 font-bold'
                    : 'text-rose-500 font-bold'
                }
              >
                ]
              </span>
            </div>
          ))}

          {/* TOP BAR: Faction-Reactive Chat Icon (Left), Dock Refit Prompt (Center), Menu Gear Icon (Right) */}
          <div className="flex items-start justify-between gap-2">
            {/* Top-Left Speech Bubble + Optional Tutorial Callout */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setShellState('MULTIPLAYER_LOBBY');
                }}
                style={{
                  borderColor: factionPrimaryHex,
                  boxShadow: `0 0 12px ${factionPrimaryHex}55`,
                }}
                className="w-10 h-10 rounded-full bg-[#030A1C]/90 border flex items-center justify-center text-white shadow-lg cursor-pointer shrink-0"
                aria-label="Chat and Multiplayer Rooms"
              >
                💬
              </button>
              {tutorialStep === 1 && (
                <div className="relative border-2 border-cyan-400 bg-[#030A1C] px-5 py-1 text-cyan-300 text-sm tracking-widest uppercase font-bold">
                  <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-y-6 border-y-transparent border-r-8 border-r-cyan-400" />
                  CHAT
                </div>
              )}

              {/* Live .io Top-10 Sector Mass Leaderboard & Ship Tier Evolution Strip */}
              {tutorialStep === 0 && (
                <div className="hidden sm:flex flex-col bg-[#030A1C]/88 border border-cyan-500/60 px-2.5 py-1.5 text-[11px] font-mono w-56 shadow-lg">
                  <div className="flex items-center justify-between border-b border-cyan-500/35 pb-0.5 mb-1">
                    <span className="text-cyan-300 font-bold tracking-wider">
                      🏆 SECTOR MASS (.IO)
                    </span>
                    <span className="text-[10px] text-cyan-200">
                      {wsStatus === 'CONNECTED' ? '● LIVE' : '● LOCAL'}
                    </span>
                  </div>
                  {hudState.leaderboard.slice(0, 5).map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between py-0.5 tabular-nums ${
                        entry.isPlayer
                          ? 'text-cyan-100 font-bold'
                          : entry.team === 'ALLY'
                            ? 'text-sky-300/90'
                            : 'text-rose-400/90'
                      }`}
                    >
                      <span className="truncate max-w-[125px]">
                        {idx === 0 ? '👑' : `${idx + 1}.`} {entry.callsign}
                      </span>
                      <span className="text-cyan-300/95">
                        T{entry.ioLevel} · {entry.ioScore}
                      </span>
                    </div>
                  ))}
                  {(() => {
                    const tierSpec = getShipTierFromMass(hudState.ioScore, hudState.survivalTime);
                    const mm = String(Math.floor(hudState.survivalTime / 60)).padStart(2, '0');
                    const ss = String(hudState.survivalTime % 60).padStart(2, '0');
                    return (
                      <div className="mt-1 pt-1 border-t border-cyan-500/35 flex flex-col gap-1">
                        {/* 3-Tier Ship Level Pips + Time Alive */}
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1">
                            {([1, 2, 3] as const).map((t) => (
                              <span
                                key={t}
                                className={`px-1 py-0.2 border text-[9px] font-bold ${
                                  hudState.ioLevel >= t
                                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                                    : 'border-slate-700 bg-slate-900/80 text-slate-500'
                                }`}
                              >
                                T{t}
                              </span>
                            ))}
                          </div>
                          <span className="text-cyan-300 font-bold tabular-nums">
                            ⏱ {mm}:{ss} ALIVE
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-sky-300">
                          <span>{tierSpec.label}</span>
                          <span>
                            {tierSpec.nextSurvivalSec
                              ? `${hudState.survivalTime}s/${tierSpec.nextSurvivalSec}s`
                              : `MAX TIER`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 overflow-hidden border border-cyan-500/40">
                          <div
                            className="h-full bg-cyan-400 transition-all duration-150"
                            style={{ width: `${Math.round(tierSpec.progressRatio * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Center Docked Refit Button when over Allied Mothership */}
            {hudState.isDockedInBay && tutorialStep === 0 && (
              <div className="pointer-events-auto flex items-center gap-2.5 bg-[#030A1C]/90 border border-cyan-400/80 px-3 py-1 rounded shadow-lg">
                <span className="text-xs text-cyan-300 tracking-wider uppercase font-bold">
                  MOTHERSHIP BAY · RECHARGED
                </span>
                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('LOADOUT_OVERLAY');
                  }}
                  className="pf-grid-btn px-2.5 py-0.5 text-xs font-bold uppercase cursor-pointer"
                >
                  LOADOUT
                </button>
              </div>
            )}

            {/* Top-Right Menu Gear Icon + Optional Tutorial Callout */}
            <div className="pointer-events-auto flex items-center gap-2">
              {tutorialStep === 1 && (
                <div className="relative border-2 border-cyan-400 bg-[#030A1C] px-5 py-1 text-cyan-300 text-sm tracking-widest uppercase font-bold">
                  <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-y-6 border-y-transparent border-l-8 border-l-cyan-400" />
                  MENU
                </div>
              )}
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  arenaRef.current.leftMouseHeld = false;
                  arenaRef.current.touchThrottleHeld = false;
                  arenaRef.current.touchPrimaryHeld = false;
                  setShellState('PAUSED');
                }}
                style={{
                  borderColor: factionPrimaryHex,
                  boxShadow: `0 0 12px ${factionPrimaryHex}55`,
                }}
                className="w-10 h-10 rounded-full bg-[#030A1C]/90 border flex items-center justify-center text-white text-xl shadow-lg cursor-pointer"
                aria-label="Menu"
              >
                ⚙
              </button>
            </div>
          </div>

          {/* =================================================================
              INTERACTIVE 2-STEP TUTORIAL OVERLAY WITH WINGED-HELMET NAVIGATOR
          ================================================================= */}
          {tutorialStep > 0 && (
            <div className="pointer-events-auto relative w-full max-w-2xl mx-auto my-auto flex items-start justify-center gap-3 px-2">
              <div className="mt-4">
                <TutorialNavigatorAvatar />
              </div>

              <div className="relative flex-1 pf-panel p-4 md:p-5 text-cyan-100 shadow-2xl">
                <span className="-left-3 top-9 w-0 h-0 border-y-10 border-y-transparent border-r-12 border-r-cyan-400 absolute" />

                {tutorialStep === 1 ? (
                  <>
                    <div className="text-base md:text-lg tracking-widest text-cyan-300 uppercase leading-relaxed mb-6">
                      LET ME SHOW YOU HOW TO PLAY THE GAME. IT IS SO SIMPLE.
                    </div>
                    <button
                      onClick={() => {
                        soundEngine.playSelect();
                        setTutorialStep(2);
                      }}
                      className="pf-grid-btn w-full py-2.5 text-2xl tracking-[0.2em] uppercase font-bold cursor-pointer"
                    >
                      OK
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-center text-base md:text-lg tracking-widest text-cyan-300 uppercase">
                      TILT YOUR DEVICE
                      <br />
                      TO ROTATE YOUR SHIP
                    </div>
                    <TutorialTiltDevicesIllustration />
                    <button
                      onClick={() => {
                        soundEngine.playSelect();
                        setTutorialStep(0);
                        setProfile((p) => ({ ...p, tutorialCompleted: true }));
                      }}
                      className="pf-grid-btn w-full py-2.5 text-2xl tracking-[0.2em] uppercase font-bold cursor-pointer"
                    >
                      OK
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              BOTTOM MOBILE TOUCH CONTROLS & TELEMETRY
          ================================================================= */}
          <div className="relative w-full flex flex-col gap-1">
            {/* Middle-Bottom Row: Left Diamond Throttle + Right Primary & Secondary Weapon Circles */}
            <div className="flex items-end justify-between px-2 pb-1">
              {/* Bottom-Left Pure Iconic Diamond Throttle Control */}
              <div className="pointer-events-auto relative flex flex-col items-start">
                {tutorialStep === 1 && (
                  <div className="relative mb-2 border-2 border-cyan-400 bg-[#030A1C] w-52 shadow-xl">
                    <div className="px-3 py-1 text-cyan-300 text-xs tracking-widest uppercase">
                      THROTTLE
                    </div>
                    <div className="bg-cyan-400 text-slate-950 font-bold px-3 py-1 text-xs tracking-wider uppercase">
                      TO GO FORWARD
                    </div>
                  </div>
                )}

                <button
                  onPointerDown={(e) => {
                    arenaRef.current.touchThrottleHeld = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = (e.clientX - (rect.left + rect.width * 0.5)) / (rect.width * 0.5);
                    arenaRef.current.touchSteerAxis =
                      Math.abs(relX) > 0.28 ? Math.sign(relX) * 0.85 : 0;
                  }}
                  onPointerMove={(e) => {
                    if (!arenaRef.current.touchThrottleHeld) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = (e.clientX - (rect.left + rect.width * 0.5)) / (rect.width * 0.5);
                    arenaRef.current.touchSteerAxis =
                      Math.abs(relX) > 0.25 ? Math.max(-1, Math.min(1, relX)) : 0;
                  }}
                  onPointerUp={() => {
                    arenaRef.current.touchThrottleHeld = false;
                    arenaRef.current.touchSteerAxis = 0;
                  }}
                  onPointerLeave={() => {
                    arenaRef.current.touchThrottleHeld = false;
                    arenaRef.current.touchSteerAxis = 0;
                  }}
                  className="relative w-28 h-28 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  aria-label="Throttle Forward"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full overflow-visible"
                    style={{ filter: `drop-shadow(0 0 10px ${factionPrimaryHex}88)` }}
                  >
                    <polygon
                      points="50,6 94,50 50,94 6,50"
                      fill="rgba(3, 10, 26, 0.65)"
                      stroke={factionPrimaryHex}
                      strokeWidth="3.5"
                    />
                    <polygon points="43,20 50,9 57,20 57,74 43,74" fill={factionPrimaryHex} />
                    <polygon points="43,78 57,78 50,90" fill={factionSecondaryHex} />
                  </svg>
                </button>
              </div>

              {/* Right-Side Primary Weapon & Secondary Weapon */}
              <div className="pointer-events-auto flex flex-col items-end gap-4">
                {/* Upper-Right Primary Weapon Button */}
                <div className="flex items-center gap-3">
                  {tutorialStep === 1 && (
                    <div className="border-2 border-cyan-400 bg-[#030A1C] px-4 py-1.5 text-cyan-300 text-sm tracking-widest uppercase font-bold">
                      PRIMARY WEAPON
                    </div>
                  )}
                  <button
                    onPointerDown={() => {
                      arenaRef.current.touchPrimaryHeld = true;
                    }}
                    onPointerUp={() => {
                      arenaRef.current.touchPrimaryHeld = false;
                    }}
                    onPointerLeave={() => {
                      arenaRef.current.touchPrimaryHeld = false;
                    }}
                    className="w-20 h-20 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    aria-label="Fire Primary Weapon"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="rgba(3, 10, 26, 0.78)"
                        stroke={factionPrimaryHex}
                        strokeWidth="3.5"
                      />
                      <polygon
                        points="50,14 82,76 18,76"
                        fill="none"
                        stroke={factionPrimaryHex}
                        strokeWidth="2.5"
                      />
                      <line
                        x1="50"
                        y1="6"
                        x2="50"
                        y2="94"
                        stroke={factionPrimaryHex}
                        strokeWidth="1.5"
                      />
                      <line
                        x1="6"
                        y1="54"
                        x2="94"
                        y2="54"
                        stroke={factionPrimaryHex}
                        strokeWidth="1.5"
                      />
                      <circle cx="50" cy="54" r="6" fill={factionSecondaryHex} />
                    </svg>
                  </button>
                </div>

                {/* Lower-Right Secondary Weapon (Homing Missile) + Vertical Charge Bar */}
                <div className="flex items-center gap-3">
                  {tutorialStep === 1 && (
                    <div className="border-2 border-cyan-400 bg-[#030A1C] px-4 py-1.5 text-cyan-300 text-sm tracking-widest uppercase font-bold">
                      SECONDARY WEAPON
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onPointerDown={() => {
                        arenaRef.current.touchSecondaryJustPressed = true;
                      }}
                      className="w-20 h-20 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                      aria-label="Fire Homing Missile"
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="rgba(3, 10, 26, 0.78)"
                          stroke={factionPrimaryHex}
                          strokeWidth="3.5"
                        />
                        <line
                          x1="50"
                          y1="8"
                          x2="50"
                          y2="26"
                          stroke={factionPrimaryHex}
                          strokeWidth="3"
                        />
                        <line
                          x1="50"
                          y1="74"
                          x2="50"
                          y2="92"
                          stroke={factionPrimaryHex}
                          strokeWidth="3"
                        />
                        <line
                          x1="8"
                          y1="50"
                          x2="26"
                          y2="50"
                          stroke={factionPrimaryHex}
                          strokeWidth="3"
                        />
                        <line
                          x1="74"
                          y1="50"
                          x2="92"
                          y2="50"
                          stroke={factionPrimaryHex}
                          strokeWidth="3"
                        />
                        <path
                          d="M50,30 L56,42 L56,62 L62,68 L38,68 L44,62 L44,42 Z"
                          fill={factionSecondaryHex}
                        />
                      </svg>
                    </button>

                    {/* Vertical Missile Charge Bar */}
                    <div className="w-2.5 h-20 bg-[#030A1C] border border-cyan-500/60 flex flex-col justify-end overflow-hidden">
                      <div
                        className="w-full bg-cyan-400 transition-all duration-75"
                        style={{ height: `${hudState.missileChargeRatio * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 Tutorial Energy Bar Callout */}
            {tutorialStep === 2 && (
              <div className="mx-auto w-full max-w-xl border-2 border-cyan-400 bg-[#030A1C] mb-1 shadow-2xl">
                <div className="px-3 py-1 text-cyan-300 text-sm tracking-widest uppercase">
                  ENERGY BAR
                </div>
                <div className="bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 text-xs md:text-sm tracking-wider uppercase">
                  YOU WILL LOSE ENERGY AS YOU MOVE AND FIRE. YOU CAN RECHARGE BY DOCKING YOUR
                  SHIP.
                </div>
              </div>
            )}

            {/* Bottom Perimeter Strip: FPS/Ping (Left) + Killfeed & Long Energy Bar (Center) + Kills/Deaths Boxes (Right) */}
            <div className="w-full flex items-end justify-between gap-3">
              {/* Bottom-Left FPS/Ping & Player Mini Health */}
              <div className="flex items-end gap-2 font-mono text-xs tabular-nums">
                <div className="text-cyan-400/90 leading-tight">
                  <div>{hudState.fps}</div>
                  <div>{hudState.ping}</div>
                </div>
                <div className="hidden sm:flex flex-col">
                  <div
                    className="h-1.5 bg-cyan-400 mb-0.5"
                    style={{
                      width: `${Math.max(12, (hudState.hp / hudState.maxHp) * 56)}px`,
                    }}
                  />
                  <span className="text-[11px] text-cyan-200">
                    [✖] {profile.callsign}
                  </span>
                </div>
              </div>

              {/* Bottom-Center Stacked Killfeed + Long Horizontal Faction-Reactive Energy Bar */}
              <div className="flex-1 flex flex-col items-start">
                <div className="flex flex-col gap-0.5 mb-1">
                  {hudState.killFeed.slice(0, 3).map((kf) => (
                    <div
                      key={kf.id}
                      className="bg-black/85 px-2.5 py-0.5 text-xs tracking-wider flex items-center gap-2"
                    >
                      <span
                        className={
                          kf.killerTeam === 'ALLY' ? 'text-cyan-300' : 'text-rose-400'
                        }
                      >
                        {kf.killerName}
                      </span>
                      <span className="text-cyan-400">←</span>
                      <span
                        className={
                          kf.killerTeam === 'ALLY' ? 'text-sky-300' : 'text-rose-300'
                        }
                      >
                        {kf.victimName}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Full-Width Horizontal Energy Bar */}
                <div className="w-full flex items-center gap-1">
                  <div className="flex-1 h-1.5 bg-[#030A1C] border border-cyan-500/45 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-75"
                      style={{
                        width: `${Math.max(0, Math.min(100, (hudState.energy / hudState.maxEnergy) * 100))}%`,
                        boxShadow: `0 0 8px ${factionPrimaryHex}`,
                      }}
                    />
                  </div>
                  <span className="w-2.5 h-2.5 bg-cyan-400 inline-block shrink-0" />
                </div>
              </div>

              {/* Bottom-Right Streak (Consecutive Kills), Sword (Kills) & Skull (Deaths) Boxes */}
              <div className="flex items-center gap-2 font-mono tabular-nums text-sm">
                <div
                  className={`flex items-center gap-1.5 border px-2.5 py-0.5 transition-colors ${
                    hudState.killStreak >= 10
                      ? 'border-rose-400 bg-rose-950/90 text-rose-200 shadow-[0_0_12px_rgba(255,42,109,0.5)]'
                      : hudState.killStreak >= 5
                        ? 'border-indigo-400 bg-indigo-950/90 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.45)]'
                        : 'border-cyan-400/80 bg-[#030A1C]/90 text-cyan-200'
                  }`}
                  title="Consecutive Kills Without Dying (3 / 5 / 10 Kill Streak Milestones)"
                >
                  <span>🔥</span>
                  <span>{hudState.killStreak}</span>
                </div>
                <div className="flex items-center gap-1.5 border border-cyan-500 bg-[#030A1C]/90 px-3 py-0.5 text-cyan-200">
                  <span>🗡</span>
                  <span>{hudState.kills}</span>
                </div>
                <div className="flex items-center gap-1.5 border border-cyan-500 bg-[#030A1C]/90 px-3 py-0.5 text-cyan-200">
                  <span>☠</span>
                  <span>{hudState.deaths}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MULTIPLAYER LOBBY / CHAT MODAL
      ===================================================================== */}
      {shellState === 'MULTIPLAYER_LOBBY' && (
        <MultiplayerLobbyModal
          callsign={profile.callsign}
          selectedMode={selectedMode}
          rooms={rooms}
          activeRoomId={activeRoomId}
          connectedStatus={wsStatus}
          onChangeCallsign={(name) => setProfile((prev) => ({ ...prev, callsign: name }))}
          onJoinRoom={handleJoinMultiplayerRoom}
          onClose={() => setShellState('PLAYING')}
        />
      )}

      {/* =====================================================================
          IN-GAME PAUSE / MATCH OVER MODAL (WITH EXPANDED SOUND SETTINGS SUB-MENU)
      ===================================================================== */}
      {(shellState === 'PAUSED' || shellState === 'MATCH_OVER') && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#010510]/85 backdrop-blur-md p-4">
          <div className="pf-panel w-full max-w-md p-6 text-center flex flex-col gap-3 max-h-[92vh] overflow-y-auto">
            <h2 className="text-2xl font-bold tracking-[0.2em] text-cyan-300 uppercase">
              {showSoundSubMenu
                ? 'SOUND SETTINGS · AUDIO MIXER'
                : shellState === 'MATCH_OVER'
                  ? arenaRef.current.matchWinner === 'ALLY'
                    ? 'VICTORY · SECTOR SECURED'
                    : 'DEFEAT · MOTHERSHIP LOST'
                  : 'SYSTEM MENU'}
            </h2>

            {showSoundSubMenu ? (
              <div className="flex flex-col gap-3 text-left">
                {/* Master Mute Toggle */}
                <div className="flex items-center justify-between border border-cyan-500/60 bg-[#030A1C] px-3.5 py-2.5">
                  <div>
                    <div className="text-xs font-bold tracking-widest text-cyan-200 uppercase">
                      MASTER AUDIO OUTPUT
                    </div>
                    <div className="text-[11px] text-sky-200/75">
                      {isMuted ? 'All game audio channels muted' : 'Multi-channel Web Audio active'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const nextMuted = soundEngine.toggleMute();
                      setIsMuted(nextMuted);
                      if (!nextMuted) soundEngine.playSelect();
                    }}
                    className={`px-3.5 py-1.5 text-xs font-bold tracking-widest uppercase cursor-pointer ${
                      isMuted ? 'pf-grid-btn text-rose-400' : 'pf-grid-btn-cyan'
                    }`}
                  >
                    {isMuted ? '🔇 MUTED' : '🔊 ACTIVE'}
                  </button>
                </div>

                {/* 1. Music Volume Channel */}
                <div className="border border-cyan-500/60 bg-[#030A1C]/95 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold tracking-widest text-cyan-300 uppercase">
                        🎵 MUSIC VOLUME
                      </span>
                      <div className="text-[11px] text-sky-200/75">
                        Ambient Sector Synth & Battle Soundtrack
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-cyan-200 tabular-nums">
                      {Math.round(musicVolume * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const v = Math.max(0, Math.round((musicVolume - 0.1) * 100) / 100);
                        soundEngine.setMusicVolume(v);
                        setMusicVolume(v);
                        soundEngine.playSelect();
                      }}
                      className="pf-grid-btn px-2.5 py-1 text-xs font-bold cursor-pointer"
                      aria-label="Decrease Music Volume"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(musicVolume * 100)}
                      onChange={(e) => {
                        const v = Number(e.target.value) / 100;
                        soundEngine.setMusicVolume(v);
                        setMusicVolume(v);
                      }}
                      aria-label="Music Volume"
                      className="flex-1 accent-cyan-400 cursor-pointer h-2 bg-slate-900"
                    />
                    <button
                      onClick={() => {
                        const v = Math.min(1, Math.round((musicVolume + 0.1) * 100) / 100);
                        soundEngine.setMusicVolume(v);
                        setMusicVolume(v);
                        soundEngine.playSelect();
                      }}
                      className="pf-grid-btn px-2.5 py-1 text-xs font-bold cursor-pointer"
                      aria-label="Increase Music Volume"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 2. Combat SFX Volume Channel */}
                <div className="border border-cyan-500/60 bg-[#030A1C]/95 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold tracking-widest text-indigo-300 uppercase">
                        💥 COMBAT SFX VOLUME
                      </span>
                      <div className="text-[11px] text-sky-200/75">
                        Cannons, Homing Missiles, Shield Hits & Explosions
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => soundEngine.playCannonFire(profile.selectedFaction)}
                        className="pf-grid-btn px-2 py-0.5 text-[10px] tracking-wider uppercase cursor-pointer"
                      >
                        TEST SFX
                      </button>
                      <span className="font-mono text-sm font-bold text-cyan-200 tabular-nums">
                        {Math.round(sfxVolume * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const v = Math.max(0, Math.round((sfxVolume - 0.1) * 100) / 100);
                        soundEngine.setSfxVolume(v);
                        setSfxVolume(v);
                        soundEngine.playCannonFire(profile.selectedFaction);
                      }}
                      className="pf-grid-btn px-2.5 py-1 text-xs font-bold cursor-pointer"
                      aria-label="Decrease SFX Volume"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(sfxVolume * 100)}
                      onChange={(e) => {
                        const v = Number(e.target.value) / 100;
                        soundEngine.setSfxVolume(v);
                        setSfxVolume(v);
                      }}
                      onMouseUp={() => soundEngine.playCannonFire(profile.selectedFaction)}
                      onTouchEnd={() => soundEngine.playCannonFire(profile.selectedFaction)}
                      aria-label="SFX Volume"
                      className="flex-1 accent-indigo-400 cursor-pointer h-2 bg-slate-900"
                    />
                    <button
                      onClick={() => {
                        const v = Math.min(1, Math.round((sfxVolume + 0.1) * 100) / 100);
                        soundEngine.setSfxVolume(v);
                        setSfxVolume(v);
                        soundEngine.playCannonFire(profile.selectedFaction);
                      }}
                      className="pf-grid-btn px-2.5 py-1 text-xs font-bold cursor-pointer"
                      aria-label="Increase SFX Volume"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. UI Feedback Tones Volume Channel */}
                <div className="border border-cyan-500/60 bg-[#030A1C]/95 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold tracking-widest text-teal-300 uppercase">
                        🎛 UI FEEDBACK TONES
                      </span>
                      <div className="text-[11px] text-sky-200/75">
                        HUD Alerts, Button Clicks, Dock Repair & Tier Chimes
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => soundEngine.playRepair()}
                        className="pf-grid-btn px-2 py-0.5 text-[10px] tracking-wider uppercase cursor-pointer"
                      >
                        TEST UI
                      </button>
                      <span className="font-mono text-sm font-bold text-cyan-200 tabular-nums">
                        {Math.round(uiVolume * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const v = Math.max(0, Math.round((uiVolume - 0.1) * 100) / 100);
                        soundEngine.setUiVolume(v);
                        setUiVolume(v);
                        soundEngine.playSelect();
                      }}
                      className="pf-grid-btn px-2.5 py-1 text-xs font-bold cursor-pointer"
                      aria-label="Decrease UI Volume"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(uiVolume * 100)}
                      onChange={(e) => {
                        const v = Number(e.target.value) / 100;
                        soundEngine.setUiVolume(v);
                        setUiVolume(v);
                      }}
                      onMouseUp={() => soundEngine.playSelect()}
                      onTouchEnd={() => soundEngine.playSelect()}
                      aria-label="UI Feedback Tones Volume"
                      className="flex-1 accent-teal-400 cursor-pointer h-2 bg-slate-900"
                    />
                    <button
                      onClick={() => {
                        const v = Math.min(1, Math.round((uiVolume + 0.1) * 100) / 100);
                        soundEngine.setUiVolume(v);
                        setUiVolume(v);
                        soundEngine.playSelect();
                      }}
                      className="pf-grid-btn px-2.5 py-1 text-xs font-bold cursor-pointer"
                      aria-label="Increase UI Volume"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-cyan-500/25">
                    <span className="text-[10px] text-cyan-300/90 tracking-wider uppercase">
                      KILL STREAK ANNOUNCER PREVIEW:
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => soundEngine.playKillStreak(3)}
                        className="pf-grid-btn px-2 py-0.5 text-[10px] tracking-wider uppercase cursor-pointer"
                      >
                        🔥 3X SPREE
                      </button>
                      <button
                        onClick={() => soundEngine.playKillStreak(5)}
                        className="pf-grid-btn px-2 py-0.5 text-[10px] tracking-wider uppercase cursor-pointer"
                      >
                        ⚡ 5X RAMPAGE
                      </button>
                      <button
                        onClick={() => soundEngine.playKillStreak(10)}
                        className="pf-grid-btn-cyan px-2 py-0.5 text-[10px] tracking-wider uppercase cursor-pointer"
                      >
                        👑 10X ACE
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Audio Mixer Presets */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      const next = soundEngine.applyPreset('BALANCED');
                      setIsMuted(next.muted);
                      setMusicVolume(next.musicVolume);
                      setSfxVolume(next.sfxVolume);
                      setUiVolume(next.uiVolume);
                      soundEngine.playSelect();
                    }}
                    className="pf-grid-btn py-1.5 text-[11px] tracking-wider uppercase font-bold cursor-pointer"
                  >
                    BALANCED
                  </button>
                  <button
                    onClick={() => {
                      const next = soundEngine.applyPreset('COMBAT');
                      setIsMuted(next.muted);
                      setMusicVolume(next.musicVolume);
                      setSfxVolume(next.sfxVolume);
                      setUiVolume(next.uiVolume);
                      soundEngine.playCannonFire(profile.selectedFaction);
                    }}
                    className="pf-grid-btn py-1.5 text-[11px] tracking-wider uppercase font-bold cursor-pointer"
                  >
                    COMBAT FOCUS
                  </button>
                  <button
                    onClick={() => {
                      const next = soundEngine.applyPreset('QUIET');
                      setIsMuted(next.muted);
                      setMusicVolume(next.musicVolume);
                      setSfxVolume(next.sfxVolume);
                      setUiVolume(next.uiVolume);
                      soundEngine.playSelect();
                    }}
                    className="pf-grid-btn py-1.5 text-[11px] tracking-wider uppercase font-bold cursor-pointer"
                  >
                    NIGHT / QUIET
                  </button>
                </div>

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShowSoundSubMenu(false);
                  }}
                  className="pf-grid-btn-cyan py-2.5 text-sm tracking-widest uppercase font-bold cursor-pointer text-center mt-1"
                >
                  ◂ BACK TO SYSTEM MENU
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 border border-cyan-500/60 bg-[#030A1C] p-3 tabular-nums">
                  <div>
                    <div className="text-xs text-cyan-400">KILLS</div>
                    <div className="text-lg font-bold text-cyan-100">{hudState.kills}</div>
                  </div>
                  <div>
                    <div className="text-xs text-cyan-400">DEATHS</div>
                    <div className="text-lg font-bold text-cyan-100">{hudState.deaths}</div>
                  </div>
                  <div>
                    <div className="text-xs text-cyan-400">KILLPOINTS</div>
                    <div className="text-lg font-bold text-sky-300">{profile.killpoints}</div>
                  </div>
                </div>

                {shellState === 'PAUSED' && (
                  <button
                    onClick={() => {
                      soundEngine.playSelect();
                      setShellState('PLAYING');
                    }}
                    className="pf-grid-btn py-2.5 text-lg tracking-widest uppercase font-bold cursor-pointer"
                  >
                    RESUME BATTLE
                  </button>
                )}

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('LOADOUT_OVERLAY');
                  }}
                  className="pf-grid-btn py-2.5 text-lg tracking-widest uppercase font-bold cursor-pointer"
                >
                  CHANGE SHIP / WEAPONS
                </button>

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    const next = !showTacticalGrid;
                    setShowTacticalGrid(next);
                    arenaRef.current.showTacticalGrid = next;
                  }}
                  className="pf-grid-btn-cyan py-2 text-sm tracking-widest uppercase font-bold cursor-pointer"
                >
                  TACTICAL SPACE GRID: {showTacticalGrid ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShowSoundSubMenu(true);
                  }}
                  className="pf-grid-btn py-2 text-sm tracking-widest uppercase font-bold cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>🔊 SOUND SETTINGS (MUSIC / SFX / UI)</span>
                  <span className="text-xs text-cyan-300">▸</span>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('PLAYING');
                    setTutorialStep(1);
                  }}
                  className="pf-grid-btn py-2 text-sm tracking-widest uppercase font-bold cursor-pointer"
                >
                  REPLAY HOW TO PLAY TUTORIAL
                </button>

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('COSMETIC_STORE');
                  }}
                  className="pf-grid-btn-cyan py-2 text-sm tracking-widest uppercase font-bold cursor-pointer"
                >
                  🎨 COSMETIC SKINS & TRAILS STORE
                </button>

                <button
                  onClick={() => {
                    soundEngine.playSelect();
                    setShellState('USER_DETAILS');
                  }}
                  className="pf-grid-btn py-2 text-sm tracking-widest uppercase cursor-pointer"
                >
                  USER DETAILS / MAIN MENU
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          COSMETIC-ONLY SKINS, TRAILS & SHIELD EFFECTS STORE + OPTIONAL REWARDED AD
      ===================================================================== */}
      {shellState === 'COSMETIC_STORE' && (
        <CosmeticStoreModal
          profile={profile}
          onUnlockCosmetic={(item) => {
            if (profile.sessionToken) {
              fetch('/api/store/purchase', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${profile.sessionToken}`,
                },
                body: JSON.stringify({
                  transactionId: `tx_cos_${item.id}_${Date.now()}`,
                  itemType: 'COSMETIC',
                  itemId: item.id,
                }),
              }).catch(() => {});
            }
            setProfile((prev) => {
              if (prev.killpoints < item.costKp) return prev;
              const unlocked = Array.from(
                new Set([...(prev.unlockedCosmetics || []), item.id])
              );
              const updated: PilotProfile = {
                ...prev,
                killpoints: prev.killpoints - item.costKp,
                unlockedCosmetics: unlocked,
                selectedSkinId:
                  item.category === 'SKIN' ? item.id : prev.selectedSkinId,
                selectedTrailId:
                  item.category === 'TRAIL' ? item.id : prev.selectedTrailId,
                selectedShieldId:
                  item.category === 'SHIELD' ? item.id : prev.selectedShieldId,
              };
              arenaRef.current.refitPlayerShip(updated);
              syncColyseusRefit(updated);
              return updated;
            });
          }}
          onEquipCosmetic={(item) => {
            setProfile((prev) => {
              const updated: PilotProfile = {
                ...prev,
                selectedSkinId:
                  item.category === 'SKIN' ? item.id : prev.selectedSkinId,
                selectedTrailId:
                  item.category === 'TRAIL' ? item.id : prev.selectedTrailId,
                selectedShieldId:
                  item.category === 'SHIELD' ? item.id : prev.selectedShieldId,
              };
              arenaRef.current.refitPlayerShip(updated);
              syncColyseusRefit(updated);
              return updated;
            });
          }}
          onClaimRewardedAd={(kpReward) => {
            if (profile.sessionToken) {
              fetch('/api/store/purchase', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${profile.sessionToken}`,
                },
                body: JSON.stringify({
                  transactionId: `tx_ad_${Date.now()}`,
                  itemType: 'REWARDED_AD',
                  itemId: 'rewarded_broadcast',
                }),
              }).catch(() => {});
            }
            setProfile((prev) => ({
              ...prev,
              killpoints: prev.killpoints + kpReward,
              adsWatchedCount: (prev.adsWatchedCount || 0) + 1,
            }));
          }}
          onRestorePurchases={async () => {
            if (!profile.sessionToken) {
              return (profile.unlockedCosmetics || []).length;
            }
            try {
              const res = await fetch('/api/store/restore', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${profile.sessionToken}`,
                },
              });
              if (!res.ok) return 0;
              const data = (await res.json()) as {
                restoredCount?: number;
                profile?: Partial<PilotProfile>;
              };
              if (data.profile) {
                setProfile((prev) => ({ ...prev, ...data.profile }));
              }
              return data.restoredCount || 0;
            } catch {
              return 0;
            }
          }}
          onClose={() => setShellState('LOADOUT_OVERLAY')}
        />
      )}

      {legalModalTab && (
        <LegalAndIpModal
          initialTab={legalModalTab}
          playerId={profile.playerId}
          sessionToken={profile.sessionToken}
          callsign={profile.callsign}
          authProvider={profile.authProvider}
          linkedProviders={profile.linkedProviders}
          googleConfigured={oauthProviders.googleConfigured}
          facebookConfigured={oauthProviders.facebookConfigured}
          googleCallbackUrl={oauthProviders.googleCallback}
          facebookCallbackUrl={oauthProviders.facebookCallback}
          onDeleteAccount={async () => {
            if (profile.sessionToken) {
              await fetch('/api/account', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${profile.sessionToken}` },
              }).catch(() => {});
            }
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            setProfile(INITIAL_PROFILE);
          }}
          onOpenAdminDashboard={() => {
            setLegalModalTab(null);
            setShowAdminModal(true);
          }}
          onClose={() => setLegalModalTab(null)}
        />
      )}

      {showAdminModal && (
        <AdminDashboardModal onClose={() => setShowAdminModal(false)} />
      )}

      <OfflineIndicator />
    </div>
  );
}
