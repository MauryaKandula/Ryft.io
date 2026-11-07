import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as ColyseusServer, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { FleetIoRoom } from './src/server/FleetIoRoom';
import { accountStore } from './src/server/accountStore';
import { BRANDING, PROJECT_ID } from './src/config/branding';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Per-IP API rate limiter (Anti-abuse protection)
const apiRateBuckets = new Map<string, { count: number; resetAt: number }>();
function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
  const now = Date.now();
  const bucket = apiRateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    apiRateBuckets.set(ip, { count: 1, resetAt: now + 10_000 });
    return next();
  }
  bucket.count++;
  if (bucket.count > 120) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  next();
}

function getBaseOrigin(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000');
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Production security headers & CORS support for Web / Mobile Capacitor origins
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use('/api', apiRateLimit);

  const httpServer = createServer(app);

  // Mount Server-Authoritative Colyseus Multiplayer Server on Port 3000
  const wsTransport = new WebSocketTransport({
    noServer: true,
    pingInterval: 5000,
    pingMaxRetries: 3,
  });
  wsTransport.attachToServer(httpServer, {
    filter: (req) => req.headers['sec-websocket-protocol'] !== 'vite-hmr',
  });

  const gameServer = new ColyseusServer({
    transport: wsTransport,
    greet: false,
  });

  gameServer.define('fleet_sector', FleetIoRoom).filterBy(['roomCode', 'modeId']);

  // Ensure seat reservation payload includes `room` object for colyseus.js@0.16 compatibility
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

  // ===========================================================================
  // MATCHMAKING & ROOMS API
  // ===========================================================================
  app.get('/api/rooms', async (_req, res) => {
    try {
      const activeRooms = await matchMaker.query({ name: 'fleet_sector' });
      const list = activeRooms.map((r) => {
        const meta = (r.metadata || {}) as Record<string, unknown>;
        return {
          roomId: String(meta.roomCode || r.roomId).toUpperCase(),
          roomName: String(meta.roomName || `Sector ${r.roomId}`),
          modeId: String(meta.modeId || 'team_match'),
          pilotCount: r.clients || 0,
          allyScore: Number(meta.allyScore || 0),
          enemyScore: Number(meta.enemyScore || 0),
        };
      });
      res.json({ rooms: list });
    } catch {
      res.json({ rooms: [] });
    }
  });

  // ===========================================================================
  // AUTHENTICATION, OAUTH 2.0 (GOOGLE & FACEBOOK), GUEST & ACCOUNT LINKING
  // ===========================================================================
  app.get('/api/auth/providers', (req, res) => {
    const origin = getBaseOrigin(req);
    res.json({
      projectId: PROJECT_ID,
      gameName: BRANDING.GAME_NAME,
      googleConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      facebookConfigured: Boolean(
        process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET
      ),
      guestEnabled: true,
      callbacks: {
        google: `${origin}/auth/google/callback`,
        facebook: `${origin}/auth/facebook/callback`,
      },
    });
  });

  app.post('/api/auth/guest', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { callsign } = (req.body || {}) as { callsign?: string };
      const { account, session } = accountStore.createOrRestoreGuest(authHeader, callsign);
      res.json({
        profile: accountStore.toClientProfile(account, session.token),
        sessionToken: session.token,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { callsign, email, password } = (req.body || {}) as {
        callsign?: string;
        email?: string;
        password?: string;
      };
      const { account, session } = accountStore.loginOrRegisterLegacy(
        callsign || 'Kuro-7',
        email || '',
        authHeader,
        password
      );
      res.json({
        profile: accountStore.toClientProfile(account, session.token),
        sessionToken: session.token,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    accountStore.invalidateSession(authHeader);
    res.json({ success: true });
  });

  // Google OAuth 2.0 Authorization URL Builder (Popup Flow)
  app.get('/api/auth/google/url', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({
        configured: false,
        error:
          'Google OAuth is not yet configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.',
      });
    }
    const redirectUri =
      typeof req.query.redirectUri === 'string' && req.query.redirectUri
        ? req.query.redirectUri
        : `${getBaseOrigin(req)}/auth/google/callback`;
    const linkToken =
      typeof req.query.linkToken === 'string' ? req.query.linkToken : '';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state: JSON.stringify({ redirectUri, linkToken }),
    });

    res.json({
      configured: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  });

  // Google OAuth 2.0 Callback Handler (postMessage to opener window)
  const googleCallbackHandler = async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code || '');
      const rawState = String(req.query.state || '{}');
      let parsedState: { redirectUri?: string; linkToken?: string } = {};
      try {
        parsedState = JSON.parse(rawState);
      } catch {
        // Ignore state parse error
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret || !code) {
        throw new Error('Missing Google OAuth credentials or authorization code.');
      }

      const redirectUri =
        parsedState.redirectUri || `${getBaseOrigin(req)}/auth/google/callback`;

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        throw new Error('Failed to exchange Google authorization code.');
      }
      const tokenData = (await tokenRes.json()) as { access_token: string };

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) {
        throw new Error('Failed to verify Google user identity.');
      }
      const userInfo = (await userRes.json()) as {
        sub: string;
        name?: string;
        email?: string;
        picture?: string;
      };

      const { account, session } = accountStore.authenticateOAuthIdentity({
        provider: 'google',
        providerUserId: userInfo.sub,
        displayName: userInfo.name || 'GooglePilot',
        email: userInfo.email,
        avatarUrl: userInfo.picture,
        linkSessionToken: parsedState.linkToken,
      });

      const payload = JSON.stringify({
        type: 'OAUTH_AUTH_SUCCESS',
        provider: 'google',
        sessionToken: session.token,
        profile: accountStore.toClientProfile(account, session.token),
      });

      res.send(`<!doctype html><html><body style="background:#070B14;color:#F8FAFC;font-family:monospace;padding:24px;text-align:center;">
        <script>
          if (window.opener) {
            window.opener.postMessage(${payload}, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Google authentication verified. Closing window...</p>
      </body></html>`);
    } catch (err) {
      const errMsg = JSON.stringify((err as Error).message || 'OAuth failed');
      res.status(400).send(`<!doctype html><html><body style="background:#070B14;color:#FDA4AF;font-family:monospace;padding:24px;text-align:center;">
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${errMsg} }, '*');
            window.close();
          }
        </script>
        <p>Authentication error: ${(err as Error).message}</p>
      </body></html>`);
    }
  };
  app.get(['/auth/google/callback', '/auth/google/callback/'], googleCallbackHandler);

  // Facebook OAuth 2.0 Authorization URL Builder (Popup Flow)
  app.get('/api/auth/facebook/url', (req, res) => {
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      return res.status(503).json({
        configured: false,
        error:
          'Facebook Login is not yet configured on this server. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in environment variables.',
      });
    }
    const redirectUri =
      typeof req.query.redirectUri === 'string' && req.query.redirectUri
        ? req.query.redirectUri
        : `${getBaseOrigin(req)}/auth/facebook/callback`;
    const linkToken =
      typeof req.query.linkToken === 'string' ? req.query.linkToken : '';

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'public_profile,email',
      state: JSON.stringify({ redirectUri, linkToken }),
    });

    res.json({
      configured: true,
      url: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`,
    });
  });

  // Facebook OAuth 2.0 Callback Handler (postMessage to opener window)
  const facebookCallbackHandler = async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code || '');
      const rawState = String(req.query.state || '{}');
      let parsedState: { redirectUri?: string; linkToken?: string } = {};
      try {
        parsedState = JSON.parse(rawState);
      } catch {
        // Ignore state parse error
      }

      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret || !code) {
        throw new Error('Missing Facebook OAuth credentials or authorization code.');
      }

      const redirectUri =
        parsedState.redirectUri || `${getBaseOrigin(req)}/auth/facebook/callback`;

      const tokenParams = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      });
      const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
      );
      if (!tokenRes.ok) {
        throw new Error('Failed to exchange Facebook authorization code.');
      }
      const tokenData = (await tokenRes.json()) as { access_token: string };

      const userRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(
          tokenData.access_token
        )}`
      );
      if (!userRes.ok) {
        throw new Error('Failed to verify Facebook user identity.');
      }
      const userInfo = (await userRes.json()) as {
        id: string;
        name?: string;
        email?: string;
        picture?: { data?: { url?: string } };
      };

      const { account, session } = accountStore.authenticateOAuthIdentity({
        provider: 'facebook',
        providerUserId: userInfo.id,
        displayName: userInfo.name || 'FBPilot',
        email: userInfo.email,
        avatarUrl: userInfo.picture?.data?.url,
        linkSessionToken: parsedState.linkToken,
      });

      const payload = JSON.stringify({
        type: 'OAUTH_AUTH_SUCCESS',
        provider: 'facebook',
        sessionToken: session.token,
        profile: accountStore.toClientProfile(account, session.token),
      });

      res.send(`<!doctype html><html><body style="background:#070B14;color:#F8FAFC;font-family:monospace;padding:24px;text-align:center;">
        <script>
          if (window.opener) {
            window.opener.postMessage(${payload}, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Facebook authentication verified. Closing window...</p>
      </body></html>`);
    } catch (err) {
      const errMsg = JSON.stringify((err as Error).message || 'OAuth failed');
      res.status(400).send(`<!doctype html><html><body style="background:#070B14;color:#FDA4AF;font-family:monospace;padding:24px;text-align:center;">
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${errMsg} }, '*');
            window.close();
          }
        </script>
        <p>Authentication error: ${(err as Error).message}</p>
      </body></html>`);
    }
  };
  app.get(['/auth/facebook/callback', '/auth/facebook/callback/'], facebookCallbackHandler);

  // ===========================================================================
  // PERSISTENT PROFILE, STORE PURCHASE VALIDATION & ACCOUNT DELETION
  // ===========================================================================
  app.get('/api/profile', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    const cleanToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    res.json({ profile: accountStore.toClientProfile(acc, cleanToken) });
  });

  app.put('/api/profile/preferences', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    const updated = accountStore.syncSafeLoadoutPreferences(acc.playerId, req.body || {});
    const cleanToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    res.json({
      profile: accountStore.toClientProfile(updated || acc, cleanToken),
    });
  });

  app.post('/api/store/purchase', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Authentication required for store purchases' });
    }
    const { transactionId, itemType, itemId } = (req.body || {}) as {
      transactionId?: string;
      itemType?: 'SHIP' | 'WEAPON' | 'UPGRADE' | 'COSMETIC' | 'EXPANSION_PACK' | 'REWARDED_AD';
      itemId?: string;
    };
    if (!transactionId || !itemType || !itemId) {
      return res.status(400).json({ error: 'Missing transactionId, itemType, or itemId' });
    }

    const result = accountStore.processAuthoritativePurchase({
      playerId: acc.playerId,
      transactionId,
      itemType,
      itemId,
    });
    if (!result.success || !result.account) {
      return res.status(400).json({ error: result.error || 'Purchase validation failed' });
    }
    const cleanToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    res.json({
      success: true,
      duplicate: Boolean(result.duplicate),
      receipt: result.receipt,
      profile: accountStore.toClientProfile(result.account, cleanToken),
    });
  });

  app.post('/api/store/restore', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Authentication required to restore purchases' });
    }
    const { restoredCount, receipts } = accountStore.restorePurchases(acc.playerId);
    const cleanToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    res.json({
      success: true,
      restoredCount,
      receipts,
      profile: accountStore.toClientProfile(acc, cleanToken),
    });
  });

  app.get('/api/account/export', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Authentication required to export account data' });
    }
    const exported = accountStore.exportPlayerData(acc.playerId);
    if (!exported) {
      return res.status(404).json({ error: 'Account data not found' });
    }
    res.json(exported);
  });

  app.post('/api/report', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Authentication required to submit a report' });
    }
    const { targetCallsign, reason, details } = (req.body || {}) as {
      targetCallsign?: string;
      reason?: string;
      details?: string;
    };
    if (!targetCallsign || !reason) {
      return res.status(400).json({ error: 'Target callsign and reason are required' });
    }
    const report = accountStore.submitAbuseReport({
      reporterId: acc.playerId,
      targetCallsign,
      reason: details ? `${reason} — ${details}` : reason,
    });
    res.json({ success: true, report });
  });

  app.delete('/api/account', (req, res) => {
    const acc = accountStore.verifySession(req.headers.authorization);
    if (!acc) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    accountStore.deleteAccount(acc.playerId);
    res.json({ success: true, deletedPlayerId: acc.playerId });
  });

  // ===========================================================================
  // ADMIN & REVENUE TELEMETRY DASHBOARD API
  // ===========================================================================
  app.get('/api/admin/metrics', async (req, res) => {
    const requiredAdminToken = process.env.ADMIN_TOKEN;
    if (requiredAdminToken) {
      const provided = String(req.headers['x-admin-token'] || req.query.token || '');
      if (provided !== requiredAdminToken) {
        return res.status(403).json({ error: 'Valid X-Admin-Token required' });
      }
    }
    try {
      const activeRooms = await matchMaker.query({ name: 'fleet_sector' });
      const concurrentHumanPlayers = activeRooms.reduce(
        (sum, r) => sum + (Number(r.clients) || 0),
        0
      );
      const metrics = accountStore.getAdminDashboardMetrics(
        activeRooms.length,
        concurrentHumanPlayers
      );
      const mem = process.memoryUsage();
      res.json({
        ...metrics,
        projectId: PROJECT_ID,
        gameName: BRANDING.GAME_NAME,
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        uptimeSec: Math.round(process.uptime()),
        activeRoomsList: activeRooms.map((r) => {
          const meta = (r.metadata || {}) as Record<string, unknown>;
          return {
            roomId: String(meta.roomCode || r.roomId).toUpperCase(),
            roomName: String(meta.roomName || `Sector ${r.roomId}`),
            modeId: String(meta.modeId || 'team_match'),
            pilotCount: r.clients || 0,
          };
        }),
      });
    } catch {
      res.json(accountStore.getAdminDashboardMetrics(0, 0));
    }
  });

  app.post('/api/admin/refund', (req, res) => {
    const requiredAdminToken = process.env.ADMIN_TOKEN;
    if (requiredAdminToken) {
      const provided = String(req.headers['x-admin-token'] || '');
      if (provided !== requiredAdminToken) {
        return res.status(403).json({ error: 'Valid X-Admin-Token required' });
      }
    }
    const { transactionId } = (req.body || {}) as { transactionId?: string };
    if (!transactionId) {
      return res.status(400).json({ error: 'Missing transactionId' });
    }
    const result = accountStore.refundAndRevokeTransaction(transactionId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  // ===========================================================================
  // REAL-TIME GLOBAL LEADERBOARDS & HEALTH CHECK
  // ===========================================================================
  app.get('/api/leaderboards', (_req, res) => {
    res.json(accountStore.getGlobalLeaderboards(25));
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const activeRooms = await matchMaker.query({ name: 'fleet_sector' });
      const mem = process.memoryUsage();
      res.json({
        status: 'ok',
        projectId: PROJECT_ID,
        gameName: BRANDING.GAME_NAME,
        engine: `Colyseus Authoritative ${BRANDING.GAME_NAME} Server`,
        activeRooms: activeRooms.length,
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        uptimeSec: Math.round(process.uptime()),
      });
    } catch {
      res.json({ status: 'ok', projectId: PROJECT_ID, activeRooms: 0 });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  await gameServer.listen(PORT, '0.0.0.0');
  console.log(
    `${BRANDING.GAME_NAME} (${PROJECT_ID}) Colyseus Server listening on http://0.0.0.0:${PORT}`
  );
}

startServer();

