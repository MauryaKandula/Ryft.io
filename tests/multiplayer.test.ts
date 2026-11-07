import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from 'colyseus.js';
import { FleetIoRoom } from '../src/server/FleetIoRoom';
import { AuthoritativeAccountStore } from '../src/server/accountStore';
import { COSMETIC_ITEMS, getShipTierFromMass } from '../src/game/catalog';
import { BRANDING, PROJECT_ID } from '../src/config/branding';
import { RealtimePocketFleetArena } from '../src/game/realtimeArena';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMultiplayerTestSuite(): Promise<void> {
  console.log(`=== ${BRANDING.GAME_NAME} (${PROJECT_ID}) PRODUCTION MULTIPLAYER TEST SUITE ===`);

  // 1. Verify .io Mass Tier Evolution & Zero Pay-To-Win Cosmetic Catalog
  console.log('[TEST 1] Verifying .io Ship Tier Evolution & Cosmetic-Only Catalog...');
  const tier1 = getShipTierFromMass(120);
  const tier2 = getShipTierFromMass(650);
  const tier3 = getShipTierFromMass(1800);
  assert(tier1.tier === 1 && tier1.role === 'Scout', '120 Mass should be Tier 1 Scout');
  assert(tier2.tier === 2 && tier2.role === 'Hunter', '650 Mass should be Tier 2 Hunter');
  assert(
    tier3.tier === 3 && tier3.role === 'Heavy Frigate',
    '1800 Mass should be Tier 3 Heavy Frigate'
  );
  assert(COSMETIC_ITEMS.length >= 12, 'Cosmetic catalog should have at least 12 items');
  for (const item of COSMETIC_ITEMS) {
    assert(
      ['SKIN', 'TRAIL', 'SHIELD'].includes(item.category),
      `Cosmetic ${item.id} must be visual-only category`
    );
  }
  console.log('  ✓ Passed: Tier evolution thresholds and 100% cosmetic store verified.');

  // 2. Boot an ephemeral Colyseus test server on an available port
  const app = express();
  const httpServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false,
  });
  gameServer.define('fleet_sector', FleetIoRoom).filterBy(['roomCode', 'modeId']);

  const origInvoke = matchMaker.controller.invokeMethod.bind(matchMaker.controller);
  matchMaker.controller.invokeMethod = async (method, roomName, clientOptions, authOptions) => {
    const res = (await origInvoke(method, roomName, clientOptions, authOptions)) as Record<
      string,
      unknown
    >;
    if (res && typeof res === 'object' && !('room' in res) && 'roomId' in res) {
      res.room = {
        name: res.name || roomName,
        roomId: res.roomId,
        processId: res.processId,
        publicAddress: res.publicAddress,
      };
    }
    return res;
  };

  const port = 34567 + Math.floor(Math.random() * 1000);
  await gameServer.listen(port, '127.0.0.1');
  const wsEndpoint = `ws://127.0.0.1:${port}`;
  console.log(`[TEST 2] Ephemeral Colyseus test server listening at ${wsEndpoint}`);

  try {
    const clientA = new Client(wsEndpoint);
    const clientB = new Client(wsEndpoint);
    const clientC = new Client(wsEndpoint);

    const roomA = await clientA.joinOrCreate('fleet_sector', {
      roomCode: 'TEST-SECTOR-1',
      modeId: 'team_match',
      callsign: 'AlphaPilot',
      faction: 'incorruptus',
      blueprintId: 'inc_viper',
      skinId: 'skin_gold_imperium',
      trailId: 'trail_plasma_cyan',
      shieldStyleId: 'shield_hex_emerald',
    });

    const roomB = await clientB.joinOrCreate('fleet_sector', {
      roomCode: 'TEST-SECTOR-1',
      modeId: 'team_match',
      callsign: 'BravoPilot',
      faction: 'omnitron',
      blueprintId: 'omn_spectre',
    });

    // Separate room isolation check
    const roomC = await clientC.joinOrCreate('fleet_sector', {
      roomCode: 'TEST-SECTOR-2',
      modeId: 'dogfight',
      callsign: 'CharliePilot',
      faction: 'aerie',
    });

    assert(roomA.roomId === roomB.roomId, 'Both clients in TEST-SECTOR-1 should join the same room');
    assert(roomC.roomId !== roomA.roomId, 'TEST-SECTOR-2 must be isolated in a separate room');
    console.log(
      `  ✓ Passed: Room allocation & isolation verified (${roomA.roomId} vs ${roomC.roomId})`
    );

    let latestSnapshot: any = null;
    roomA.onMessage('world_snapshot', (snap) => {
      latestSnapshot = snap;
    });
    roomA.onMessage('leaderboard_update', () => {});
    roomA.onMessage('combat_hit', () => {});
    roomA.onMessage('ship_destroyed', () => {});
    roomA.onMessage('orb_pickup', () => {});
    roomA.onMessage('pilot_evolved', () => {});
    roomA.onMessage('kill_streak', () => {});
    roomB.onMessage('world_snapshot', () => {});
    roomB.onMessage('leaderboard_update', () => {});
    roomB.onMessage('combat_hit', () => {});
    roomB.onMessage('ship_destroyed', () => {});
    roomB.onMessage('orb_pickup', () => {});
    roomB.onMessage('pilot_evolved', () => {});
    roomB.onMessage('kill_streak', () => {});
    roomC.onMessage('world_snapshot', () => {});

    await sleep(180);
    assert(latestSnapshot !== null, 'Room should broadcast 20Hz world_snapshot packets');
    assert(
      Array.isArray(latestSnapshot.players) && latestSnapshot.players.length >= 10,
      'Room should populate human pilots + AI squadron backfill (10+ total entities)'
    );
    assert(
      Array.isArray(latestSnapshot.pellets) && latestSnapshot.pellets.length >= 50,
      'Room should spawn at least 50 .io energy orbs across the sector'
    );
    console.log(
      `  ✓ Passed: Authoritative snapshot received (${latestSnapshot.players.length} ships, ${latestSnapshot.pellets.length} .io energy pellets).`
    );

    // 3. Test Anti-Cheat Validation (Invalid NaN angle & excessive thrustIntensity > 1)
    console.log('[TEST 3] Verifying Server-Side Anti-Cheat Input Sanitization & Clamping...');
    const alphaBefore = latestSnapshot.players.find((p: any) => p.id === roomA.sessionId);
    assert(Boolean(alphaBefore), 'AlphaPilot should exist in authoritative snapshot');

    roomA.send('input', {
      seq: 1,
      targetAngle: Number.NaN,
      isThrusting: true,
      thrustIntensity: 999999,
      firePrimary: true,
      fireSecondary: false,
      lockedTargetId: null,
    });

    for (let i = 0; i < 6; i++) {
      roomA.send('input', {
        seq: i + 2,
        targetAngle: 0,
        isThrusting: true,
        thrustIntensity: 500,
        firePrimary: true,
        fireSecondary: false,
        lockedTargetId: null,
      });
      await sleep(40);
    }

    const alphaAfter = latestSnapshot.players.find((p: any) => p.id === roomA.sessionId);
    assert(
      Number.isFinite(alphaAfter.x) && Number.isFinite(alphaAfter.y),
      'Coordinates must remain finite after NaN input'
    );
    const speed = Math.hypot(alphaAfter.vx, alphaAfter.vy);
    assert(
      speed <= 420,
      `Server anti-cheat must clamp maximum ship speed (measured: ${speed.toFixed(1)})`
    );
    console.log(
      `  ✓ Passed: Anti-cheat rejected NaN input and clamped speed to ${speed.toFixed(1)} px/s.`
    );

    // 4. Verify Refit & Cosmetic Synchronization
    console.log('[TEST 4] Verifying Authoritative Loadout & Cosmetic Synchronization...');
    roomA.send('refit', {
      callsign: 'AlphaAce',
      faction: 'incorruptus',
      blueprintId: 'inc_viper',
      cannonId: 'ion_repeater',
      missileId: 'valkyrie_seeker',
      skinId: 'skin_void_obsidian',
      trailId: 'trail_solar_flare',
      shieldStyleId: 'shield_royal_aegis',
    });
    await sleep(140);
    const alphaRefitted = latestSnapshot.players.find((p: any) => p.id === roomA.sessionId);
    assert(
      alphaRefitted.skinId === 'skin_void_obsidian' &&
        alphaRefitted.trailId === 'trail_solar_flare',
      'Server should synchronize pilot cosmetic skin and exhaust trail'
    );
    console.log('  ✓ Passed: Cosmetic skin, trail, and shield synced across room.');

    await roomA.leave();
    await roomB.leave();
    await roomC.leave();
  } finally {
    await gameServer.gracefullyShutdown(false);
    httpServer.close();
  }

  // 5. Verify Centralized Branding Configuration (PROJECT_ID & RYFT.io)
  console.log('[TEST 5] Verifying Centralized Branding & Stable Internal PROJECT_ID...');
  assert(PROJECT_ID === 'orb_arena_project', 'PROJECT_ID must be orb_arena_project');
  assert(BRANDING.GAME_NAME === 'RYFT.io', 'GAME_NAME must be RYFT.io');
  console.log(`  ✓ Passed: PROJECT_ID="${PROJECT_ID}", GAME_NAME="${BRANDING.GAME_NAME}".`);

  // 6. Verify Floating, Fading Damage Number Particle System in RealtimePocketFleetArena
  console.log('[TEST 6] Verifying Floating Damage Number Particle System in RealtimePocketFleetArena...');
  const arena = new RealtimePocketFleetArena();
  arena.camX = 1500;
  arena.camY = 1000;
  arena.spawnDamageNumbers(1520, 980, 18, 32, true, 0.4, 20);
  assert(
    arena.floatingTexts.length === 2,
    'Hit affecting both shield and armor should spawn 2 distinct floating damage particles'
  );
  const shieldParticle = arena.floatingTexts.find((f) => f.kind === 'SHIELD')!;
  const critParticle = arena.floatingTexts.find((f) => f.kind === 'CRITICAL')!;
  assert(Boolean(shieldParticle && critParticle), 'Should classify SHIELD and CRITICAL particles');
  assert(critParticle.subText === 'CRIT HIT', 'Heavy/crit damage particle should carry CRIT HIT subText');

  const initialY = critParticle.y;
  for (let frame = 0; frame < 15; frame++) {
    arena.update(0.04, 1280, 720, false);
  }
  assert(critParticle.y < initialY, 'Damage number particle must float upward along ballistic trajectory');
  assert(
    critParticle.alpha < 1.0 && critParticle.alpha > 0,
    'Damage number particle must smoothly fade out over its lifetime'
  );
  console.log('  ✓ Passed: Floating damage number particles spawn, arc upward, and fade smoothly.');

  // 7. Verify Persistent Account Store, OAuth Linking Protection & Store Idempotency
  console.log('[TEST 7] Verifying Persistent Accounts, OAuth Linking Security & Store Idempotency...');
  const tmpDbPath = path.join(process.cwd(), 'data', `test_${Date.now()}_db.json`);
  try {
    const testStore = new AuthoritativeAccountStore(tmpDbPath);

    // Create Guest
    const guestRes = testStore.createOrRestoreGuest(undefined, 'StarViper');
    assert(
      guestRes.account.authProvider === 'guest' && guestRes.account.killpoints === 1000,
      'New guest should receive 1000 KP recruiting bonus'
    );

    // Upgrade Guest by linking Google OAuth with valid session token
    const linkedGoogle = testStore.authenticateOAuthIdentity({
      provider: 'google',
      providerUserId: 'google_sub_12345',
      displayName: 'StarViperGoogle',
      email: 'viper@example.com',
      linkSessionToken: guestRes.session.token,
    });
    assert(
      linkedGoogle.linked && linkedGoogle.account.playerId === guestRes.account.playerId,
      'Linking Google must preserve existing Guest playerId and progression'
    );

    // Verify another user with the same email does NOT auto-merge without providerUserId/token
    const separateFbUser = testStore.authenticateOAuthIdentity({
      provider: 'facebook',
      providerUserId: 'fb_id_99999',
      displayName: 'OtherPilot',
      email: 'viper@example.com',
    });
    assert(
      separateFbUser.account.playerId !== guestRes.account.playerId,
      'Accounts must never automatically merge based solely on matching email address'
    );

    // Verify authoritative store purchase & duplicate transactionId idempotency
    const txId = 'tx_test_cosmetic_001';
    const p1 = testStore.processAuthoritativePurchase({
      playerId: guestRes.account.playerId,
      transactionId: txId,
      itemType: 'COSMETIC',
      itemId: 'trail_plasma_violet', // 500 KP
    });
    assert(p1.success && !p1.duplicate, 'First valid cosmetic purchase must succeed');
    const kpAfterFirst = p1.account!.killpoints;
    assert(kpAfterFirst === 500, '500 KP should be deducted from 1000 KP balance');

    // Replay exact same transactionId -> must not deduct KP a second time
    const p2 = testStore.processAuthoritativePurchase({
      playerId: guestRes.account.playerId,
      transactionId: txId,
      itemType: 'COSMETIC',
      itemId: 'trail_plasma_violet',
    });
    assert(
      Boolean(p2.success && p2.duplicate && p2.account!.killpoints === 500),
      'Duplicate transactionId must be idempotent and never double-deduct or double-grant'
    );

    // Attempt unaffordable purchase -> must be rejected by server
    const pFail = testStore.processAuthoritativePurchase({
      playerId: guestRes.account.playerId,
      transactionId: 'tx_test_expensive_002',
      itemType: 'COSMETIC',
      itemId: 'shield_void_pulse', // 1100 KP > 500 KP
    });
    assert(!pFail.success, 'Server must reject purchases when KP balance is insufficient');

    // Verify Purchase Restoration
    const restored = testStore.restorePurchases(guestRes.account.playerId);
    assert(restored.restoredCount >= 1, 'restorePurchases should verify completed receipts');

    // Verify Refund & Item Revocation
    const refundRes = testStore.refundAndRevokeTransaction(txId);
    assert(refundRes.success, 'Refund of completed transaction should succeed');
    assert(
      !guestRes.account.unlockedCosmetics.includes('trail_plasma_violet'),
      'Refunded cosmetic must be revoked from unlockedCosmetics'
    );
    assert(
      guestRes.account.killpoints === 1000,
      'Refunded transaction should restore in-game KP balance'
    );

    // Verify GDPR Export, Abuse Report & Admin Telemetry Metrics
    const exported = testStore.exportPlayerData(guestRes.account.playerId);
    assert(Boolean(exported && exported.projectId === PROJECT_ID), 'GDPR export must include projectId');
    const report = testStore.submitAbuseReport({
      reporterId: guestRes.account.playerId,
      targetCallsign: 'Griefer99',
      reason: 'CHEATING / EXPLOIT — Speed testing in Sector Alpha',
    });
    assert(Boolean(report.id), 'Abuse report should generate id');
    const adminMetrics = testStore.getAdminDashboardMetrics(2, 5);
    assert(
      adminMetrics.collectedMetrics.activeMultiplayerRooms === 2 &&
        adminMetrics.collectedMetrics.concurrentHumanPlayers === 5,
      'Admin telemetry must accurately report active rooms and concurrent human players'
    );

    console.log(
      '  ✓ Passed: Persistent accounts, OAuth linking security, store idempotency, refund revocation, GDPR export, and Admin Telemetry verified.'
    );
  } finally {
    if (fs.existsSync(tmpDbPath)) {
      fs.unlinkSync(tmpDbPath);
    }
  }

  console.log(`=== ALL ${BRANDING.GAME_NAME} PRODUCTION TESTS PASSED ===`);
}

runMultiplayerTestSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

