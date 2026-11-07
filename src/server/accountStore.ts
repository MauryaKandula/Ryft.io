import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  SHIP_BLUEPRINTS,
  WEAPONS,
  COSMETIC_ITEMS,
} from '../game/catalog';
import { PROJECT_ID } from '../config/branding';
import type { FactionId, PilotProfile } from '../game/types';

export interface PurchaseReceipt {
  transactionId: string;
  itemType: 'SHIP' | 'WEAPON' | 'UPGRADE' | 'COSMETIC' | 'EXPANSION_PACK' | 'REWARDED_AD' | 'SUPPORTER_PASS';
  itemId: string;
  costKp: number;
  timestamp: string;
  status: 'COMPLETED' | 'REFUNDED';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: string;
  playerId?: string;
  details: string;
}

export interface AbuseReportEntry {
  id: string;
  timestamp: string;
  reporterId: string;
  targetCallsign: string;
  reason: string;
  status: 'OPEN' | 'REVIEWED';
}

export interface StoredPlayerAccount {
  playerId: string;
  callsign: string;
  email: string;
  passwordHash?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  authProvider: 'guest' | 'google' | 'facebook' | 'legacy';
  linkedProviders: ('guest' | 'google' | 'facebook' | 'legacy')[];
  googleSub?: string;
  facebookId?: string;
  totalMatches: number;
  totalVictories: number;
  totalKills: number;
  totalDeaths: number;
  highestMass: number;
  bestSurvivalSec?: number;
  orbCaptures?: number;
  killpoints: number;
  credits: number;
  level: number;
  cyberTheme: boolean;
  sandboxUnlockAll: boolean;
  tutorialCompleted: boolean;
  unlockedShips: string[];
  unlockedWeapons: string[];
  unlockedCosmetics: string[];
  shipUpgrades: Record<string, number>;
  selectedFaction: FactionId;
  selectedShipByFaction: Record<FactionId, string>;
  selectedCannonByShip: Record<string, string>;
  selectedMissileByShip: Record<string, string>;
  selectedSkinId: string;
  selectedTrailId: string;
  selectedShieldId: string;
  adsWatchedCount: number;
  supporterTier?: 'FREE' | 'COMMANDER_PASS';
  purchaseHistory: PurchaseReceipt[];
}

export interface StoredSession {
  token: string;
  playerId: string;
  createdAt: number;
  expiresAt: number;
}

interface DatabaseSchema {
  projectId: string;
  schemaVersion: number;
  accounts: Record<string, StoredPlayerAccount>;
  sessions: Record<string, StoredSession>;
  processedTransactions: Record<string, PurchaseReceipt>;
  auditLogs?: AuditLogEntry[];
  abuseReports?: AbuseReportEntry[];
  modeMatchCounts?: Record<string, number>;
}

const BLOCKED_CALLSIGN_TERMS = ['admin', 'moderator', 'system', 'support', 'root', 'fuck', 'shit', 'nazi', 'slur'];

export function sanitizeCallsign(raw?: string, fallback = 'Pilot'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[^\w\-. ]/g, '').trim().slice(0, 18);
  if (!cleaned) return fallback;
  const lower = cleaned.toLowerCase();
  for (const term of BLOCKED_CALLSIGN_TERMS) {
    if (lower.includes(term)) {
      return `Pilot-${Math.floor(100 + Math.random() * 900)}`;
    }
  }
  return cleaned;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export class AuthoritativeAccountStore {
  private dbFilePath: string;
  private db: DatabaseSchema;

  constructor(customPath?: string) {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbFilePath = customPath || path.join(dataDir, `${PROJECT_ID}_db.json`);
    this.db = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
        if (parsed && typeof parsed === 'object' && parsed.accounts) {
          return {
            projectId: PROJECT_ID,
            schemaVersion: parsed.schemaVersion || 2,
            accounts: parsed.accounts || {},
            sessions: parsed.sessions || {},
            processedTransactions: parsed.processedTransactions || {},
            auditLogs: parsed.auditLogs || [],
            abuseReports: parsed.abuseReports || [],
            modeMatchCounts: parsed.modeMatchCounts || {
              team_match: 0,
              dogfight: 0,
              capture_orb: 0,
              aerie_invasion: 0,
            },
          };
        }
      }
    } catch {
      // Fallback to fresh schema if file is unreadable
    }
    return {
      projectId: PROJECT_ID,
      schemaVersion: 2,
      accounts: {},
      sessions: {},
      processedTransactions: {},
      auditLogs: [],
      abuseReports: [],
      modeMatchCounts: {
        team_match: 0,
        dogfight: 0,
        capture_orb: 0,
        aerie_invasion: 0,
      },
    };
  }

  private appendAuditLog(event: string, details: string, playerId?: string): void {
    if (!this.db.auditLogs) this.db.auditLogs = [];
    this.db.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      event,
      playerId,
      details,
    });
    if (this.db.auditLogs.length > 150) {
      this.db.auditLogs.length = 150;
    }
  }

  private saveToDisk(): void {
    try {
      const tmpPath = `${this.dbFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.db, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.dbFilePath);
    } catch {
      // Ignore write error in read-only test containers
    }
  }

  private createDefaultAccount(
    callsign: string,
    email: string,
    provider: 'guest' | 'google' | 'facebook' | 'legacy',
    avatarUrl?: string
  ): StoredPlayerAccount {
    const playerId = `plr_${crypto.randomBytes(8).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const defaultCannons: Record<string, string> = {};
    const defaultMissiles: Record<string, string> = {};
    for (const bp of SHIP_BLUEPRINTS) {
      defaultCannons[bp.id] = bp.defaultCannonId;
      defaultMissiles[bp.id] = bp.defaultMissileId;
    }

    return {
      playerId,
      callsign: sanitizeCallsign(callsign, 'Pilot'),
      email: (email || '').trim().toLowerCase(),
      avatarUrl,
      createdAt: nowIso,
      updatedAt: nowIso,
      authProvider: provider,
      linkedProviders: [provider],
      totalMatches: 0,
      totalVictories: 0,
      totalKills: 0,
      totalDeaths: 0,
      highestMass: 100,
      bestSurvivalSec: 0,
      orbCaptures: 0,
      killpoints: 1000, // Recruiting bonus preserved from original game
      credits: 1000,
      level: 1,
      cyberTheme: true,
      sandboxUnlockAll: false,
      tutorialCompleted: false,
      unlockedShips: ['inc_viper', 'omn_spectre', 'aer_stinger'],
      unlockedWeapons: [
        'pulse_laser',
        'tachyon_beam',
        'bio_spitter',
        'valkyrie_seeker',
        'omnitron_swarmer',
        'aerie_leech_pod',
      ],
      unlockedCosmetics: ['skin_default', 'trail_default', 'shield_default'],
      shipUpgrades: {},
      selectedFaction: 'incorruptus',
      selectedShipByFaction: {
        incorruptus: 'inc_viper',
        omnitron: 'omn_spectre',
        aerie: 'aer_stinger',
      },
      selectedCannonByShip: defaultCannons,
      selectedMissileByShip: defaultMissiles,
      selectedSkinId: 'skin_default',
      selectedTrailId: 'trail_default',
      selectedShieldId: 'shield_default',
      adsWatchedCount: 0,
      purchaseHistory: [],
    };
  }

  public createSession(playerId: string): StoredSession {
    const token = `sess_${crypto.randomBytes(20).toString('hex')}`;
    const now = Date.now();
    const session: StoredSession = {
      token,
      playerId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    this.db.sessions[token] = session;
    this.saveToDisk();
    return session;
  }

  public verifySession(token?: string | null): StoredPlayerAccount | null {
    if (!token) return null;
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    const sess = this.db.sessions[clean];
    if (!sess) return null;
    if (Date.now() > sess.expiresAt) {
      delete this.db.sessions[clean];
      this.saveToDisk();
      return null;
    }
    return this.db.accounts[sess.playerId] || null;
  }

  public invalidateSession(token?: string | null): boolean {
    if (!token) return false;
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    if (this.db.sessions[clean]) {
      delete this.db.sessions[clean];
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public deleteAccount(playerId: string): boolean {
    if (!this.db.accounts[playerId]) return false;
    delete this.db.accounts[playerId];
    for (const [tok, sess] of Object.entries(this.db.sessions)) {
      if (sess.playerId === playerId) {
        delete this.db.sessions[tok];
      }
    }
    this.saveToDisk();
    return true;
  }

  public createOrRestoreGuest(
    existingToken?: string,
    callsign?: string
  ): { account: StoredPlayerAccount; session: StoredSession } {
    const existing = this.verifySession(existingToken);
    if (existing) {
      if (callsign && callsign.trim()) {
        existing.callsign = callsign.trim().slice(0, 18);
        existing.updatedAt = new Date().toISOString();
        this.saveToDisk();
      }
      const clean = existingToken!.replace(/^Bearer\s+/i, '').trim();
      return { account: existing, session: this.db.sessions[clean] };
    }

    const guestCallsign =
      callsign && callsign.trim()
        ? callsign.trim().slice(0, 18)
        : `Pilot-${Math.floor(100 + Math.random() * 900)}`;
    const acc = this.createDefaultAccount(guestCallsign, '', 'guest');
    this.db.accounts[acc.playerId] = acc;
    const session = this.createSession(acc.playerId);
    return { account: acc, session };
  }

  public loginOrRegisterLegacy(
    callsign: string,
    email: string,
    existingToken?: string,
    password?: string
  ): { account: StoredPlayerAccount; session: StoredSession } {
    const passwordHash =
      password && password.trim()
        ? crypto.createHash('sha256').update(`ryft_salt_${password.trim()}`).digest('hex')
        : undefined;

    // If upgrading an active guest session, preserve guest progression
    const currentGuest = this.verifySession(existingToken);
    if (currentGuest) {
      currentGuest.callsign = sanitizeCallsign(callsign || currentGuest.callsign, currentGuest.callsign);
      if (email && email.trim()) {
        currentGuest.email = email.trim().toLowerCase();
      }
      if (passwordHash) {
        currentGuest.passwordHash = passwordHash;
      }
      if (!currentGuest.linkedProviders.includes('legacy')) {
        currentGuest.linkedProviders.push('legacy');
      }
      currentGuest.updatedAt = new Date().toISOString();
      this.appendAuditLog('ACCOUNT_UPGRADED', `Guest upgraded to registered pilot (${currentGuest.callsign})`, currentGuest.playerId);
      this.saveToDisk();
      const clean = existingToken!.replace(/^Bearer\s+/i, '').trim();
      return { account: currentGuest, session: this.db.sessions[clean] };
    }

    // Check if an existing legacy account matches both callsign + email
    const normEmail = (email || '').trim().toLowerCase();
    const normCallsign = sanitizeCallsign(callsign, 'Kuro-7');
    const matched = Object.values(this.db.accounts).find(
      (a) =>
        a.authProvider === 'legacy' &&
        a.callsign.toLowerCase() === normCallsign.toLowerCase() &&
        (!normEmail || a.email === normEmail)
    );

    if (matched) {
      // Never authenticate an existing legacy account without proof of ownership.
      // Legacy accounts with no password require an authenticated recovery or account-linking flow.
      if (!matched.passwordHash || !passwordHash || matched.passwordHash !== passwordHash) {
        throw new Error('Invalid credentials. Please use your linked sign-in provider or account recovery.');
      }
      const session = this.createSession(matched.playerId);
      return { account: matched, session };
    }

    const acc = this.createDefaultAccount(normCallsign, normEmail, 'legacy');
    if (passwordHash) {
      acc.passwordHash = passwordHash;
    }
    this.db.accounts[acc.playerId] = acc;
    this.appendAuditLog('ACCOUNT_CREATED', `Registered pilot ${acc.callsign}`, acc.playerId);
    const session = this.createSession(acc.playerId);
    return { account: acc, session };
  }

  /**
   * Authenticates or links a verified OAuth identity (Google or Facebook).
   * CRITICAL SECURITY RULE:
   * - Never automatically merges accounts based solely on matching email addresses.
   * - Only links to an existing account if the user proves ownership via an active `linkSessionToken`.
   */
  public authenticateOAuthIdentity(params: {
    provider: 'google' | 'facebook';
    providerUserId: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    linkSessionToken?: string;
  }): { account: StoredPlayerAccount; session: StoredSession; linked: boolean } {
    const {
      provider,
      providerUserId,
      displayName,
      email,
      avatarUrl,
      linkSessionToken,
    } = params;

    // 1. Check if this exact OAuth providerUserId is already bound to an account
    const existingByProviderId = Object.values(this.db.accounts).find((a) =>
      provider === 'google'
        ? a.googleSub === providerUserId
        : a.facebookId === providerUserId
    );

    // 2. If user supplied a valid `linkSessionToken` to link their current account:
    const ownedAccount = this.verifySession(linkSessionToken);
    if (ownedAccount) {
      // Do not allow linking to overwrite another user's progression
      if (
        existingByProviderId &&
        existingByProviderId.playerId !== ownedAccount.playerId
      ) {
        throw new Error(
          `This ${provider} account is already linked to another player profile.`
        );
      }

      if (provider === 'google') ownedAccount.googleSub = providerUserId;
      if (provider === 'facebook') ownedAccount.facebookId = providerUserId;
      if (!ownedAccount.linkedProviders.includes(provider)) {
        ownedAccount.linkedProviders.push(provider);
      }
      ownedAccount.authProvider = provider;
      if (avatarUrl && !ownedAccount.avatarUrl) {
        ownedAccount.avatarUrl = avatarUrl;
      }
      if (email && !ownedAccount.email) {
        ownedAccount.email = email.toLowerCase();
      }
      ownedAccount.updatedAt = new Date().toISOString();
      this.saveToDisk();

      const session = this.createSession(ownedAccount.playerId);
      return { account: ownedAccount, session, linked: true };
    }

    // 3. Returning OAuth player recognition by verified provider ID
    if (existingByProviderId) {
      if (avatarUrl) existingByProviderId.avatarUrl = avatarUrl;
      existingByProviderId.updatedAt = new Date().toISOString();
      this.saveToDisk();
      const session = this.createSession(existingByProviderId.playerId);
      return { account: existingByProviderId, session, linked: false };
    }

    // 4. Create new account for this verified OAuth identity (never auto-merging by email)
    const acc = this.createDefaultAccount(
      displayName || 'Pilot',
      email || '',
      provider,
      avatarUrl
    );
    if (provider === 'google') acc.googleSub = providerUserId;
    if (provider === 'facebook') acc.facebookId = providerUserId;
    this.db.accounts[acc.playerId] = acc;
    const session = this.createSession(acc.playerId);
    return { account: acc, session, linked: false };
  }

  /**
   * Server-authoritative purchase & unlock verification.
   * Preserves all existing prices from catalog.ts and prevents client-side forgery or duplicate replay.
   */
  public processAuthoritativePurchase(params: {
    playerId: string;
    transactionId: string;
    itemType: PurchaseReceipt['itemType'];
    itemId: string;
  }): {
    success: boolean;
    error?: string;
    duplicate?: boolean;
    account?: StoredPlayerAccount;
    receipt?: PurchaseReceipt;
  } {
    const { playerId, transactionId, itemType, itemId } = params;
    const acc = this.db.accounts[playerId];
    if (!acc) {
      return { success: false, error: 'Account not found' };
    }
    if (!transactionId || typeof transactionId !== 'string') {
      return { success: false, error: 'Missing transactionId' };
    }

    // Idempotency protection: duplicate payment/purchase events never grant duplicate rewards
    const existingReceipt = this.db.processedTransactions[transactionId];
    if (existingReceipt) {
      return {
        success: true,
        duplicate: true,
        account: acc,
        receipt: existingReceipt,
      };
    }

    let costKp = 0;

    if (itemType === 'SHIP') {
      const bp = SHIP_BLUEPRINTS.find((s) => s.id === itemId);
      if (!bp) return { success: false, error: 'Invalid ship blueprint ID' };
      if (acc.unlockedShips.includes(itemId)) {
        return { success: false, error: 'Ship already unlocked' };
      }
      costKp = bp.unlockCost;
      if (acc.killpoints < costKp) {
        return { success: false, error: 'Insufficient Killpoints (KP)' };
      }
      acc.killpoints -= costKp;
      acc.unlockedShips.push(itemId);
    } else if (itemType === 'WEAPON') {
      const wp = WEAPONS[itemId];
      if (!wp) return { success: false, error: 'Invalid weapon ID' };
      if (acc.unlockedWeapons.includes(itemId)) {
        return { success: false, error: 'Weapon already unlocked' };
      }
      costKp = wp.unlockCost;
      if (acc.killpoints < costKp) {
        return { success: false, error: 'Insufficient Killpoints (KP)' };
      }
      acc.killpoints -= costKp;
      acc.unlockedWeapons.push(itemId);
    } else if (itemType === 'UPGRADE') {
      const bp = SHIP_BLUEPRINTS.find((s) => s.id === itemId);
      if (!bp) return { success: false, error: 'Invalid ship blueprint for upgrade' };
      const currentLevel = acc.shipUpgrades[itemId] || 0;
      if (currentLevel >= 5) {
        return { success: false, error: 'Ship already at maximum upgrade level (5)' };
      }
      costKp = 250 * (currentLevel + 1);
      if (acc.killpoints < costKp) {
        return { success: false, error: 'Insufficient Killpoints (KP)' };
      }
      acc.killpoints -= costKp;
      acc.shipUpgrades[itemId] = currentLevel + 1;
    } else if (itemType === 'COSMETIC') {
      const cos = COSMETIC_ITEMS.find((c) => c.id === itemId);
      if (!cos) return { success: false, error: 'Invalid cosmetic item ID' };
      if (acc.unlockedCosmetics.includes(itemId)) {
        return { success: false, error: 'Cosmetic item already unlocked' };
      }
      costKp = cos.costKp;
      if (acc.killpoints < costKp) {
        return { success: false, error: 'Insufficient Killpoints (KP)' };
      }
      acc.killpoints -= costKp;
      acc.unlockedCosmetics.push(itemId);
    } else if (itemType === 'EXPANSION_PACK') {
      acc.killpoints += 1000;
      for (const s of SHIP_BLUEPRINTS) {
        if (!acc.unlockedShips.includes(s.id)) acc.unlockedShips.push(s.id);
      }
      for (const w of Object.keys(WEAPONS)) {
        if (!acc.unlockedWeapons.includes(w)) acc.unlockedWeapons.push(w);
      }
    } else if (itemType === 'REWARDED_AD') {
      acc.killpoints += 250;
      acc.adsWatchedCount = (acc.adsWatchedCount || 0) + 1;
    } else {
      return { success: false, error: 'Unsupported itemType' };
    }

    const receipt: PurchaseReceipt = {
      transactionId,
      itemType,
      itemId,
      costKp,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
    };

    acc.purchaseHistory.push(receipt);
    acc.updatedAt = receipt.timestamp;
    this.db.processedTransactions[transactionId] = receipt;
    this.saveToDisk();

    return {
      success: true,
      duplicate: false,
      account: acc,
      receipt,
    };
  }

  public syncSafeLoadoutPreferences(
    playerId: string,
    prefs: Partial<
      Pick<
        PilotProfile,
        | 'callsign'
        | 'selectedFaction'
        | 'selectedShipByFaction'
        | 'selectedCannonByShip'
        | 'selectedMissileByShip'
        | 'selectedSkinId'
        | 'selectedTrailId'
        | 'selectedShieldId'
        | 'cyberTheme'
        | 'tutorialCompleted'
      >
    >
  ): StoredPlayerAccount | null {
    const acc = this.db.accounts[playerId];
    if (!acc) return null;

    if (typeof prefs.callsign === 'string' && prefs.callsign.trim()) {
      acc.callsign = prefs.callsign.trim().slice(0, 18);
    }
    if (
      prefs.selectedFaction === 'incorruptus' ||
      prefs.selectedFaction === 'omnitron' ||
      prefs.selectedFaction === 'aerie'
    ) {
      acc.selectedFaction = prefs.selectedFaction;
    }
    if (typeof prefs.cyberTheme === 'boolean') acc.cyberTheme = prefs.cyberTheme;
    if (typeof prefs.tutorialCompleted === 'boolean') {
      acc.tutorialCompleted = prefs.tutorialCompleted;
    }
    if (prefs.selectedShipByFaction) {
      acc.selectedShipByFaction = {
        ...acc.selectedShipByFaction,
        ...prefs.selectedShipByFaction,
      };
    }
    if (prefs.selectedCannonByShip) {
      acc.selectedCannonByShip = {
        ...acc.selectedCannonByShip,
        ...prefs.selectedCannonByShip,
      };
    }
    if (prefs.selectedMissileByShip) {
      acc.selectedMissileByShip = {
        ...acc.selectedMissileByShip,
        ...prefs.selectedMissileByShip,
      };
    }
    if (prefs.selectedSkinId && acc.unlockedCosmetics.includes(prefs.selectedSkinId)) {
      acc.selectedSkinId = prefs.selectedSkinId;
    }
    if (prefs.selectedTrailId && acc.unlockedCosmetics.includes(prefs.selectedTrailId)) {
      acc.selectedTrailId = prefs.selectedTrailId;
    }
    if (
      prefs.selectedShieldId &&
      acc.unlockedCosmetics.includes(prefs.selectedShieldId)
    ) {
      acc.selectedShieldId = prefs.selectedShieldId;
    }

    acc.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return acc;
  }

  /**
   * Called ONLY by the authoritative Colyseus server when real combat events occur.
   * Never callable from client endpoints.
   */
  public recordAuthoritativeCombatStats(params: {
    callsign: string;
    playerId?: string;
    killsDelta?: number;
    deathsDelta?: number;
    victoriesDelta?: number;
    matchesDelta?: number;
    kpAward?: number;
    peakMass?: number;
    survivalSec?: number;
    orbCapturesDelta?: number;
    modeId?: string;
  }): void {
    const {
      callsign,
      playerId,
      killsDelta = 0,
      deathsDelta = 0,
      victoriesDelta = 0,
      matchesDelta = 0,
      kpAward = 0,
      peakMass = 100,
      survivalSec = 0,
      orbCapturesDelta = 0,
      modeId,
    } = params;

    if (modeId && matchesDelta > 0) {
      if (!this.db.modeMatchCounts) this.db.modeMatchCounts = {};
      this.db.modeMatchCounts[modeId] = (this.db.modeMatchCounts[modeId] || 0) + matchesDelta;
    }

    let acc = playerId ? this.db.accounts[playerId] : undefined;
    if (!acc && callsign) {
      acc = Object.values(this.db.accounts).find(
        (a) => a.callsign.toLowerCase() === callsign.toLowerCase()
      );
    }
    if (!acc) return;

    acc.totalKills += Math.max(0, killsDelta);
    acc.totalDeaths += Math.max(0, deathsDelta);
    acc.totalVictories += Math.max(0, victoriesDelta);
    acc.totalMatches += Math.max(0, matchesDelta);
    acc.orbCaptures = (acc.orbCaptures || 0) + Math.max(0, orbCapturesDelta);
    acc.killpoints += Math.max(0, kpAward);
    if (peakMass > acc.highestMass) {
      acc.highestMass = Math.round(peakMass);
    }
    if (survivalSec > (acc.bestSurvivalSec || 0)) {
      acc.bestSurvivalSec = Math.round(survivalSec);
    }
    acc.updatedAt = new Date().toISOString();
    this.saveToDisk();
  }

  public restorePurchases(playerId: string): {
    success: boolean;
    restoredCount: number;
    receipts: PurchaseReceipt[];
    account?: StoredPlayerAccount;
  } {
    const acc = this.db.accounts[playerId];
    if (!acc) return { success: false, restoredCount: 0, receipts: [] };

    let restoredCount = 0;
    for (const r of acc.purchaseHistory) {
      if (r.status !== 'COMPLETED') continue;
      restoredCount++;
      if (r.itemType === 'COSMETIC' && !acc.unlockedCosmetics.includes(r.itemId)) {
        acc.unlockedCosmetics.push(r.itemId);
      } else if (r.itemType === 'SHIP' && !acc.unlockedShips.includes(r.itemId)) {
        acc.unlockedShips.push(r.itemId);
      } else if (r.itemType === 'WEAPON' && !acc.unlockedWeapons.includes(r.itemId)) {
        acc.unlockedWeapons.push(r.itemId);
      }
    }
    this.appendAuditLog('PURCHASES_RESTORED', `Restored ${restoredCount} items`, playerId);
    this.saveToDisk();
    return {
      success: true,
      restoredCount,
      receipts: acc.purchaseHistory,
      account: acc,
    };
  }

  public refundAndRevokeTransaction(transactionId: string): {
    success: boolean;
    error?: string;
    receipt?: PurchaseReceipt;
  } {
    const receipt = this.db.processedTransactions[transactionId];
    if (!receipt) return { success: false, error: 'Transaction not found' };
    if (receipt.status === 'REFUNDED') {
      return { success: false, error: 'Transaction already refunded' };
    }

    receipt.status = 'REFUNDED';
    for (const acc of Object.values(this.db.accounts)) {
      const match = acc.purchaseHistory.find((p) => p.transactionId === transactionId);
      if (match) {
        match.status = 'REFUNDED';
        if (receipt.itemType === 'COSMETIC') {
          acc.unlockedCosmetics = acc.unlockedCosmetics.filter((id) => id !== receipt.itemId);
          if (acc.selectedSkinId === receipt.itemId) acc.selectedSkinId = 'skin_default';
          if (acc.selectedTrailId === receipt.itemId) acc.selectedTrailId = 'trail_default';
          if (acc.selectedShieldId === receipt.itemId) acc.selectedShieldId = 'shield_default';
        } else if (receipt.itemType === 'SHIP') {
          acc.unlockedShips = acc.unlockedShips.filter((id) => id !== receipt.itemId);
        } else if (receipt.itemType === 'WEAPON') {
          acc.unlockedWeapons = acc.unlockedWeapons.filter((id) => id !== receipt.itemId);
        }
        acc.killpoints += receipt.costKp;
        this.appendAuditLog(
          'TRANSACTION_REFUNDED',
          `Revoked ${receipt.itemId} (${transactionId}) and refunded ${receipt.costKp} KP`,
          acc.playerId
        );
      }
    }
    this.saveToDisk();
    return { success: true, receipt };
  }

  public submitAbuseReport(params: {
    reporterId: string;
    targetCallsign: string;
    reason: string;
  }): AbuseReportEntry {
    if (!this.db.abuseReports) this.db.abuseReports = [];
    const entry: AbuseReportEntry = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      reporterId: params.reporterId,
      targetCallsign: sanitizeCallsign(params.targetCallsign, 'Unknown'),
      reason: (params.reason || 'Unsportsmanlike conduct').trim().slice(0, 240),
      status: 'OPEN',
    };
    this.db.abuseReports.unshift(entry);
    if (this.db.abuseReports.length > 100) this.db.abuseReports.length = 100;
    this.appendAuditLog('ABUSE_REPORT', `Report against ${entry.targetCallsign}: ${entry.reason}`, params.reporterId);
    this.saveToDisk();
    return entry;
  }

  public exportPlayerData(playerId: string): Record<string, unknown> | null {
    const acc = this.db.accounts[playerId];
    if (!acc) return null;
    const { passwordHash: _omitted, ...safeAccount } = acc;
    return {
      exportedAt: new Date().toISOString(),
      projectId: PROJECT_ID,
      account: safeAccount,
    };
  }

  public getAdminDashboardMetrics(activeRoomsCount: number, concurrentHumanPlayers: number) {
    const accounts = Object.values(this.db.accounts);
    const now = Date.now();
    const dayMs = 86_400_000;
    const dau = accounts.filter((a) => now - new Date(a.updatedAt).getTime() <= dayMs).length;
    const mau = accounts.filter((a) => now - new Date(a.updatedAt).getTime() <= 30 * dayMs).length;

    let totalMatches = 0;
    let totalKills = 0;
    let totalAdsWatched = 0;
    let totalKpSpent = 0;
    const completedReceipts: PurchaseReceipt[] = [];

    for (const a of accounts) {
      totalMatches += a.totalMatches || 0;
      totalKills += a.totalKills || 0;
      totalAdsWatched += a.adsWatchedCount || 0;
      for (const r of a.purchaseHistory || []) {
        if (r.status === 'COMPLETED') {
          totalKpSpent += r.costKp || 0;
        }
        completedReceipts.push(r);
      }
    }

    return {
      collectedMetrics: {
        totalRegisteredAccounts: accounts.length,
        dailyActiveUsers: dau,
        monthlyActiveUsers: mau,
        concurrentHumanPlayers,
        activeMultiplayerRooms: activeRoomsCount,
        totalMatchesRecorded: totalMatches,
        totalEliminationsRecorded: totalKills,
        totalRewardedAdsCompleted: totalAdsWatched,
        totalCosmeticKpVolume: totalKpSpent,
        activeSessionsCount: Object.keys(this.db.sessions).length,
        modePopularity: this.db.modeMatchCounts || {
          team_match: 0,
          dogfight: 0,
          capture_orb: 0,
          aerie_invasion: 0,
        },
      },
      externalMonetizationStatus: {
        adNetworkConnected: Boolean(process.env.AD_PROVIDER_ENABLED === 'true'),
        paymentGatewayConnected: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        verifiedRealMoneyRevenueUsd: 0,
        note: 'Real-money ad & IAP revenue metrics remain 0 until live publisher credentials (AdMob / H5 Ads / Stripe / Play Billing) are configured in environment variables.',
      },
      recentTransactions: completedReceipts.slice(-20).reverse(),
      recentAuditLogs: (this.db.auditLogs || []).slice(0, 25),
      abuseReports: (this.db.abuseReports || []).slice(0, 20),
    };
  }

  public getGlobalLeaderboards(limit: number = 25) {
    const all = Object.values(this.db.accounts);
    const byScore = [...all]
      .sort((a, b) => b.highestMass - a.highestMass || b.killpoints - a.killpoints)
      .slice(0, limit)
      .map((a, idx) => ({
        rank: idx + 1,
        playerId: a.playerId,
        callsign: a.callsign,
        faction: a.selectedFaction,
        highestMass: a.highestMass,
        killpoints: a.killpoints,
        totalKills: a.totalKills,
        totalDeaths: a.totalDeaths,
        totalVictories: a.totalVictories,
        totalMatches: a.totalMatches,
      }));

    const byEliminations = [...all]
      .sort((a, b) => b.totalKills - a.totalKills || b.highestMass - a.highestMass)
      .slice(0, limit)
      .map((a, idx) => ({
        rank: idx + 1,
        playerId: a.playerId,
        callsign: a.callsign,
        faction: a.selectedFaction,
        totalKills: a.totalKills,
        totalDeaths: a.totalDeaths,
        highestMass: a.highestMass,
        killpoints: a.killpoints,
      }));

    return {
      byScore,
      byEliminations,
      totalRegisteredPilots: all.length,
    };
  }

  public toClientProfile(acc: StoredPlayerAccount, sessionToken?: string): PilotProfile {
    return {
      playerId: acc.playerId,
      callsign: acc.callsign,
      email: acc.email,
      avatarUrl: acc.avatarUrl,
      createdAt: acc.createdAt,
      totalMatches: acc.totalMatches,
      totalVictories: acc.totalVictories,
      highestMass: acc.highestMass,
      authProvider: acc.authProvider,
      linkedProviders: acc.linkedProviders,
      sessionToken,
      killpoints: acc.killpoints,
      totalKills: acc.totalKills,
      totalDeaths: acc.totalDeaths,
      level: acc.level,
      credits: acc.credits,
      cyberTheme: acc.cyberTheme,
      sandboxUnlockAll: acc.sandboxUnlockAll,
      tutorialCompleted: acc.tutorialCompleted,
      unlockedShips: acc.unlockedShips,
      unlockedWeapons: acc.unlockedWeapons,
      unlockedCosmetics: acc.unlockedCosmetics,
      shipUpgrades: acc.shipUpgrades,
      selectedFaction: acc.selectedFaction,
      selectedShipByFaction: acc.selectedShipByFaction,
      selectedCannonByShip: acc.selectedCannonByShip,
      selectedMissileByShip: acc.selectedMissileByShip,
      selectedSkinId: acc.selectedSkinId,
      selectedTrailId: acc.selectedTrailId,
      selectedShieldId: acc.selectedShieldId,
      adsWatchedCount: acc.adsWatchedCount,
    };
  }
}

export const accountStore = new AuthoritativeAccountStore();
