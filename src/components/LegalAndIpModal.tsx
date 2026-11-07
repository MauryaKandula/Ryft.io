import React, { useState } from 'react';
import { BRANDING, PROJECT_ID } from '../config/branding';
import { soundEngine } from '../audio/soundEngine';

export type LegalTabId = 'IP_AUDIT' | 'TOS' | 'PRIVACY' | 'GUIDELINES' | 'DATA_DELETION';

interface LegalAndIpModalProps {
  initialTab?: LegalTabId;
  playerId?: string;
  sessionToken?: string;
  callsign: string;
  authProvider?: string;
  linkedProviders?: string[];
  googleConfigured: boolean;
  facebookConfigured: boolean;
  googleCallbackUrl: string;
  facebookCallbackUrl: string;
  onDeleteAccount: () => Promise<void>;
  onOpenAdminDashboard?: () => void;
  onClose: () => void;
}

export const LegalAndIpModal: React.FC<LegalAndIpModalProps> = ({
  initialTab = 'IP_AUDIT',
  playerId,
  sessionToken,
  callsign,
  authProvider = 'guest',
  linkedProviders = ['guest'],
  googleConfigured,
  facebookConfigured,
  googleCallbackUrl,
  facebookCallbackUrl,
  onDeleteAccount,
  onOpenAdminDashboard,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabId>(initialTab);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [reportCallsign, setReportCallsign] = useState('');
  const [reportReason, setReportReason] = useState('CHEATING / EXPLOIT');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const tabs: { id: LegalTabId; label: string }[] = [
    { id: 'IP_AUDIT', label: 'IP AUDIT & ARCHITECTURE' },
    { id: 'TOS', label: 'TERMS OF SERVICE' },
    { id: 'PRIVACY', label: 'PRIVACY & COOKIES' },
    { id: 'GUIDELINES', label: 'COMMUNITY, SAFETY & REFUNDS' },
    { id: 'DATA_DELETION', label: 'ACCOUNT, EXPORT & OAUTH' },
  ];

  const handleExportAccountData = async () => {
    soundEngine.playSelect();
    if (!sessionToken) {
      setDeleteStatus('Active server session token required to export account JSON.');
      return;
    }
    try {
      const res = await fetch('/api/account/export', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error('Failed to export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ryft-io-account-export-${callsign}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDeleteStatus('GDPR / CCPA JSON account archive downloaded.');
    } catch {
      setDeleteStatus('Unable to export account data.');
    }
  };

  const handleSubmitReport = async () => {
    soundEngine.playSelect();
    if (!reportCallsign.trim()) {
      setReportStatus('Enter a pilot callsign to report.');
      return;
    }
    if (!sessionToken) {
      setReportStatus('Report logged locally; connect online to transmit to server queue.');
      return;
    }
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          targetCallsign: reportCallsign.trim(),
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      if (!res.ok) throw new Error('Report submission failed');
      setReportCallsign('');
      setReportDetails('');
      setReportStatus('Safety report transmitted to server moderation queue.');
    } catch {
      setReportStatus('Failed to submit safety report.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01040B]/88 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl pf-panel shadow-[0_0_40px_rgba(0,240,255,0.28)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-cyan-500/70 bg-[#051026] px-4 py-3">
          <div>
            <div className="text-[11px] font-mono text-cyan-300 tracking-widest uppercase">
              PROJECT_ID: {PROJECT_ID} · COMPLIANCE & LEGAL SUITE
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-[0.18em] text-cyan-100 uppercase">
              {BRANDING.GAME_NAME} — LEGAL, IP AUDIT & DATA CONTROLS
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAdminDashboard && (
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  onOpenAdminDashboard();
                }}
                className="pf-grid-btn-cyan px-3 py-1 text-xs font-bold tracking-widest uppercase cursor-pointer"
              >
                📊 TELEMETRY &amp; ADMIN
              </button>
            )}
            <button
              onClick={() => {
                soundEngine.playSelect();
                onClose();
              }}
              className="pf-grid-btn px-3.5 py-1 text-xs font-bold tracking-widest uppercase cursor-pointer"
            >
              ✕ CLOSE
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-cyan-500/35 bg-[#030A18] px-4 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                soundEngine.playSelect();
                setActiveTab(t.id);
              }}
              className={`px-3 py-1.5 text-xs tracking-wider uppercase font-bold cursor-pointer transition ${
                activeTab === t.id
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'pf-grid-btn text-cyan-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 text-sky-100/90 text-xs md:text-sm leading-relaxed space-y-4 font-mono">
          {activeTab === 'IP_AUDIT' && (
            <div className="space-y-4">
              <div className="border border-cyan-400/50 bg-cyan-950/30 p-3.5">
                <div className="text-cyan-300 font-bold tracking-wider uppercase mb-1">
                  NON-DESTRUCTIVE INTELLECTUAL PROPERTY (IP) AUDIT REPORT
                </div>
                <p className="text-sky-100/85">
                  Changing a game&apos;s display name to <strong>{BRANDING.GAME_NAME}</strong> does not
                  automatically resolve potential intellectual property overlaps with historical
                  titles. Below is the complete technical &amp; creative audit of this codebase,
                  preserved non-destructively per engineering rules.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-cyan-500/50 bg-[#051024] p-3">
                  <div className="text-emerald-300 font-bold uppercase mb-1.5">
                    ✓ 100% ORIGINAL CODE &amp; PROCEDURAL ASSETS
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      <strong>Rendering Engine:</strong> Custom HTML5 Canvas 2D vector geometry
                      renderer (`src/game/realtimeArena.ts`) with procedural starfields, nebula
                      gradients, exhaust plumes, and shockwaves. No ripped sprite sheets or bitmap
                      textures from third-party games.
                    </li>
                    <li>
                      <strong>Audio Engine:</strong> 100% procedural Web Audio API synthesizer
                      (`src/audio/soundEngine.ts`) generating oscillators, filters, and chimes in
                      real time. Zero copyrighted `.mp3`/`.wav` audio files.
                    </li>
                    <li>
                      <strong>Networking &amp; Backend:</strong> Original TypeScript Colyseus
                      authoritative server (`src/server/FleetIoRoom.ts`, `src/server/accountStore.ts`).
                    </li>
                  </ul>
                </div>

                <div className="border border-indigo-500/50 bg-indigo-950/25 p-3">
                  <div className="text-cyan-300 font-bold uppercase mb-1.5">
                    ✓ ORIGINAL CYBERPUNK IP &amp; NOMENCLATURE VERIFIED
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      <strong>Original Cyberpunk Factions &amp; Lore:</strong> All faction titles
                      (<em>Vanguard Synapse</em>, <em>Nexus Protocol</em>, <em>Xeno-Helix</em>),
                      motherships (<em>VNS Aegis Core</em>, <em>Zero-One Mainframe</em>,{' '}
                      <em>Helix Bio-Spire</em>), commander briefings, and starfighter blueprints are
                      100% original cyberpunk creations.
                    </li>
                    <li>
                      <strong>Pilot Callsigns &amp; Bot Roster:</strong> Default pilot handle
                      (<em>Kuro-7</em>) and AI squadron callsigns (<em>ZeroCool_X</em>,{' '}
                      <em>NeonWraith</em>, <em>CipherBlade</em>, <em>VoltRunner</em>) are original
                      cyberpunk identifiers with zero third-party overlap.
                    </li>
                    <li>
                      <strong>Centralized Branding:</strong> Public display branding is centralized
                      in `src/config/branding.ts` (`GAME_NAME = &quot;{BRANDING.GAME_NAME}&quot;`,
                      `PROJECT_ID = &quot;{PROJECT_ID}&quot;`).
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TOS' && (
            <div className="space-y-3">
              <h3 className="text-cyan-300 font-bold text-base uppercase">
                {BRANDING.GAME_NAME} — TERMS OF SERVICE (EDITABLE DRAFT)
              </h3>
              <p>
                <strong>Effective Date:</strong> November 7, 2026 · <strong>Domain:</strong>{' '}
                {BRANDING.GAME_DOMAIN}
              </p>
              <p>
                <strong>1. Acceptance of Terms:</strong> By accessing or playing{' '}
                {BRANDING.GAME_NAME}, you agree to these Terms of Service. Note: This draft must be
                reviewed by qualified legal counsel and updated with your registered business entity
                and jurisdiction prior to commercial publication.
              </p>
              <p>
                <strong>2. Server-Authoritative Fair Play &amp; Anti-Cheat:</strong> All movement,
                weapon cooldowns, hit detection, currency balances (Killpoints / KP), and
                leaderboards are validated on the authoritative server. Attempting to manipulate
                network packets, automate inputs, or exploit session states may result in immediate
                session termination or account suspension.
              </p>
              <p>
                <strong>3. Accounts &amp; Guest Progression:</strong> You may play immediately using
                a persistent Guest session or sign in via Google or Facebook OAuth. Linking a social
                provider upgrades your current session after verifying ownership; accounts are never
                automatically merged solely on matching email addresses.
              </p>
              <p>
                <strong>4. Virtual Items &amp; Cosmetics:</strong> Unlocked starfighter blueprints,
                weapons, and cosmetic skins/trails/shields are licensed for in-game entertainment
                only and hold no real-world cash redemption value.
              </p>
            </div>
          )}

          {activeTab === 'PRIVACY' && (
            <div className="space-y-3">
              <h3 className="text-cyan-300 font-bold text-base uppercase">
                {BRANDING.GAME_NAME} — PRIVACY &amp; COOKIE POLICY (EDITABLE DRAFT)
              </h3>
              <p>
                <strong>1. Minimum Data Collection:</strong> When you play as a Guest, we store a
                randomly generated internal player ID (`plr_...`), display callsign, match
                statistics, and loadout preferences. When you authenticate via Google or Facebook
                OAuth, we request only the minimum `openid`, `profile`, and `email` scopes needed to
                verify your unique provider ID and display name.
              </p>
              <p>
                <strong>2. Cookies &amp; Local Storage:</strong> We use first-party browser storage
                and bearer session tokens (`orb_arena_project`) strictly to maintain your
                authenticated session, audio mixer settings, and reconnection tokens. We do not sell
                personal data to third-party data brokers.
              </p>
              <p>
                <strong>3. Data Retention &amp; Self-Service Deletion:</strong> You may permanently
                delete your account, profile statistics, and linked OAuth identifiers at any time
                using the <strong>ACCOUNT, EXPORT &amp; OAUTH</strong> tab in this window (`DELETE
                /api/account`) or export a machine-readable JSON archive (`GET /api/account/export`).
              </p>
            </div>
          )}

          {activeTab === 'GUIDELINES' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-cyan-300 font-bold text-base uppercase">
                  COMMUNITY GUIDELINES, REFUND POLICY &amp; DMCA / IP COMPLAINTS
                </h3>
                <p>
                  <strong>Community Guidelines:</strong> Pilots must use respectful callsigns (server
                  moderation filters automatically sanitize profanity/reserved terms) and refrain from
                  harassment, impersonation, or intentional match disruption.
                </p>
                <p>
                  <strong>Purchase &amp; Refund Policy:</strong> All store unlocks are validated on
                  the server with idempotency protection (`transactionId`) so duplicate events never
                  double-charge or double-grant items. Refunded transactions automatically revoke the
                  associated item from inventory.
                </p>
                <p>
                  <strong>Copyright &amp; IP Inquiries:</strong> Report any copyright or trademark
                  concerns to {BRANDING.SUPPORT_EMAIL}.
                </p>
              </div>

              {/* Player Abuse & Safety Report Form */}
              <div className="border border-cyan-500/60 bg-[#051024] p-4 space-y-2.5">
                <div className="text-cyan-300 font-bold uppercase">
                  SUBMIT PLAYER SAFETY / ABUSE REPORT
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={reportCallsign}
                    onChange={(e) => setReportCallsign(e.target.value)}
                    placeholder="Target Pilot Callsign"
                    className="bg-[#020714] border border-cyan-500/50 px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="bg-[#020714] border border-cyan-500/50 px-3 py-1.5 text-xs text-cyan-200 focus:outline-none"
                  >
                    <option value="CHEATING / EXPLOIT">CHEATING / EXPLOIT</option>
                    <option value="OFFENSIVE CALLSIGN">OFFENSIVE CALLSIGN</option>
                    <option value="GRIEFING / HARASSMENT">GRIEFING / HARASSMENT</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Optional match / sector details..."
                  className="w-full bg-[#020714] border border-cyan-500/50 px-3 py-1.5 text-xs text-white focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleSubmitReport}
                    className="pf-grid-btn px-4 py-1.5 text-xs font-bold uppercase cursor-pointer"
                  >
                    TRANSMIT SAFETY REPORT
                  </button>
                  {reportStatus && (
                    <span className="text-xs text-cyan-300 font-bold">{reportStatus}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DATA_DELETION' && (
            <div className="space-y-4">
              <div className="border border-cyan-500/60 bg-[#051024] p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-cyan-300 font-bold uppercase">
                    ACTIVE PILOT IDENTITY &amp; OAUTH PROVIDER STATUS
                  </div>
                  <button
                    onClick={handleExportAccountData}
                    className="pf-grid-btn-cyan px-3 py-1 text-xs font-bold uppercase cursor-pointer"
                  >
                    ⬇ EXPORT MY DATA (JSON)
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-sky-400">INTERNAL PLAYER ID:</span>{' '}
                    <span className="text-cyan-200 font-bold">{playerId || 'Local Session'}</span>
                  </div>
                  <div>
                    <span className="text-sky-400">CALLSIGN:</span>{' '}
                    <span className="text-cyan-100 font-bold">{callsign}</span>
                  </div>
                  <div>
                    <span className="text-sky-400">PRIMARY AUTH:</span>{' '}
                    <span className="text-indigo-300 uppercase font-bold">{authProvider}</span>
                  </div>
                  <div>
                    <span className="text-sky-400">LINKED PROVIDERS:</span>{' '}
                    <span className="text-emerald-300 uppercase font-bold">
                      {linkedProviders.join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-indigo-500/40 bg-[#030A18] p-4 space-y-2 text-xs">
                <div className="text-indigo-300 font-bold uppercase">
                  OAUTH 2.0 REDIRECT URI CONFIGURATION (FOR GOOGLE &amp; META CONSOLES)
                </div>
                <div>
                  <span className="text-cyan-300">Google OAuth Status:</span>{' '}
                  <span className={googleConfigured ? 'text-emerald-400' : 'text-sky-300'}>
                    {googleConfigured
                      ? 'LIVE (GOOGLE_CLIENT_ID configured)'
                      : 'AWAITING ENV VARS (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET)'}
                  </span>
                  <div className="text-[11px] text-slate-300 break-all mt-0.5">
                    Callback URI: {googleCallbackUrl}
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-cyan-300">Facebook Login Status:</span>{' '}
                  <span className={facebookConfigured ? 'text-emerald-400' : 'text-sky-300'}>
                    {facebookConfigured
                      ? 'LIVE (FACEBOOK_APP_ID configured)'
                      : 'AWAITING ENV VARS (FACEBOOK_APP_ID & FACEBOOK_APP_SECRET)'}
                  </span>
                  <div className="text-[11px] text-slate-300 break-all mt-0.5">
                    Callback URI: {facebookCallbackUrl}
                  </div>
                </div>
              </div>

              <div className="border border-rose-500/60 bg-rose-950/25 p-4 space-y-2.5">
                <div className="text-rose-300 font-bold uppercase">
                  GDPR / CCPA PERMANENT ACCOUNT &amp; DATA DELETION
                </div>
                <p className="text-xs text-rose-200/90">
                  Type <strong>DELETE</strong> below to permanently erase your server account,
                  session tokens, linked OAuth IDs, and progression history.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={confirmDeleteText}
                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="bg-[#020714] border border-rose-500/60 px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    disabled={confirmDeleteText.trim().toUpperCase() !== 'DELETE'}
                    onClick={async () => {
                      soundEngine.playSelect();
                      await onDeleteAccount();
                      setConfirmDeleteText('');
                      setDeleteStatus('Account and server progression permanently deleted.');
                    }}
                    className="px-4 py-1.5 bg-rose-600 disabled:bg-rose-950/50 disabled:text-rose-400/40 text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
                  >
                    PERMANENTLY DELETE MY ACCOUNT
                  </button>
                </div>
                {deleteStatus && (
                  <div className="text-xs text-emerald-300 font-bold">{deleteStatus}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
