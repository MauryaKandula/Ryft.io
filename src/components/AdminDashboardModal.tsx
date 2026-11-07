import React, { useEffect, useState, useCallback } from 'react';
import { BRANDING, PROJECT_ID } from '../config/branding';
import { soundEngine } from '../audio/soundEngine';

interface AdminMetricsResponse {
  projectId?: string;
  gameName?: string;
  memoryRssMb?: number;
  uptimeSec?: number;
  collectedMetrics: {
    totalRegisteredAccounts: number;
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    concurrentHumanPlayers: number;
    activeMultiplayerRooms: number;
    totalMatchesRecorded: number;
    totalEliminationsRecorded: number;
    totalRewardedAdsCompleted: number;
    totalCosmeticKpVolume: number;
    activeSessionsCount: number;
    modePopularity: Record<string, number>;
  };
  externalMonetizationStatus: {
    adNetworkConnected: boolean;
    paymentGatewayConnected: boolean;
    verifiedRealMoneyRevenueUsd: number;
    note: string;
  };
  recentTransactions: {
    transactionId: string;
    itemType: string;
    itemId: string;
    costKp: number;
    status?: string;
    timestamp: string;
  }[];
  recentAuditLogs: {
    id: string;
    timestamp: string;
    action: string;
    details: string;
    playerId?: string;
  }[];
  abuseReports: {
    id: string;
    timestamp: string;
    reporterId: string;
    targetCallsign: string;
    reason: string;
    status: string;
  }[];
  activeRoomsList?: {
    roomId: string;
    roomName: string;
    modeId: string;
    pilotCount: number;
  }[];
}

interface AdminDashboardModalProps {
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminToken, setAdminToken] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TRANSACTIONS' | 'AUDIT' | 'REPORTS'>(
    'OVERVIEW'
  );

  const fetchMetrics = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (adminToken.trim()) {
        headers['X-Admin-Token'] = adminToken.trim();
      }
      const res = await fetch('/api/admin/metrics', { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load telemetry' }));
        setStatusMessage(err.error || 'Access restricted');
        setLoading(false);
        return;
      }
      const data = (await res.json()) as AdminMetricsResponse;
      setMetrics(data);
      setStatusMessage(null);
    } catch {
      setStatusMessage('Unable to reach server telemetry endpoint.');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchMetrics();
    const timer = window.setInterval(fetchMetrics, 5000);
    return () => window.clearInterval(timer);
  }, [fetchMetrics]);

  const handleRefundTransaction = async (transactionId: string) => {
    soundEngine.playSelect();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken.trim()) {
        headers['X-Admin-Token'] = adminToken.trim();
      }
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || 'Refund failed');
        return;
      }
      setStatusMessage(`Refunded & revoked item for transaction ${transactionId}`);
      fetchMetrics();
    } catch {
      setStatusMessage('Failed to process refund request.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl border-2 border-cyan-500/80 bg-[#040812]/95 shadow-[0_0_40px_rgba(6,182,212,0.28)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-cyan-500/70 bg-[#071224] px-4 py-3">
          <div>
            <div className="text-[10px] font-mono text-cyan-300 tracking-widest uppercase">
              PROJECT_ID: {PROJECT_ID} · LIVE PRODUCTION TELEMETRY &amp; ECONOMY AUDIT
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-[0.16em] text-cyan-200 uppercase">
              {BRANDING.GAME_NAME} — SERVER TELEMETRY, ROOMS &amp; REVENUE DASHBOARD
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Admin Token (if set)"
              className="bg-black/80 border border-cyan-500/40 px-2.5 py-1 text-xs font-mono text-cyan-100 focus:outline-none w-36"
            />
            <button
              onClick={() => {
                soundEngine.playSelect();
                fetchMetrics();
              }}
              className="pf-grid-btn px-3 py-1 text-xs font-bold tracking-wider uppercase cursor-pointer"
            >
              ↻ REFRESH
            </button>
            <button
              onClick={() => {
                soundEngine.playSelect();
                onClose();
              }}
              className="pf-grid-btn px-3 py-1 text-xs font-bold tracking-wider uppercase cursor-pointer"
            >
              ✕ CLOSE
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap gap-1.5 border-b border-cyan-500/30 bg-[#050C18] px-4 py-2">
          {(
            [
              { id: 'OVERVIEW', label: 'LIVE SERVER & REVENUE METRICS' },
              { id: 'TRANSACTIONS', label: 'TRANSACTIONS & REFUND REVOCATION' },
              { id: 'AUDIT', label: 'SECURITY & ECONOMY AUDIT LOGS' },
              { id: 'REPORTS', label: 'PLAYER SAFETY & ABUSE REPORTS' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundEngine.playSelect();
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase cursor-pointer transition ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-black/60 border border-cyan-500/40 text-cyan-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {statusMessage && (
          <div className="px-4 py-2 bg-amber-950/60 border-b border-amber-500/50 text-xs font-mono text-amber-200">
            {statusMessage}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 font-mono text-xs text-slate-200">
          {loading && !metrics ? (
            <div className="p-8 text-center text-cyan-300">
              Loading authoritative server metrics...
            </div>
          ) : metrics ? (
            <>
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  {/* Live Server Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-cyan-950/30 border border-cyan-500/50">
                      <div className="text-[10px] text-cyan-300/80">CONCURRENT PLAYERS</div>
                      <div className="text-xl font-bold text-cyan-200 mt-0.5">
                        {metrics.collectedMetrics.concurrentHumanPlayers}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Active Sector Rooms: {metrics.collectedMetrics.activeMultiplayerRooms}
                      </div>
                    </div>

                    <div className="p-3 bg-cyan-950/30 border border-cyan-500/50">
                      <div className="text-[10px] text-cyan-300/80">REGISTERED / DAU / MAU</div>
                      <div className="text-xl font-bold text-cyan-200 mt-0.5">
                        {metrics.collectedMetrics.totalRegisteredAccounts}{' '}
                        <span className="text-xs text-emerald-300">
                          ({metrics.collectedMetrics.dailyActiveUsers} DAU)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Active Tokens: {metrics.collectedMetrics.activeSessionsCount}
                      </div>
                    </div>

                    <div className="p-3 bg-cyan-950/30 border border-cyan-500/50">
                      <div className="text-[10px] text-cyan-300/80">MATCHES / ELIMINATIONS</div>
                      <div className="text-xl font-bold text-emerald-300 mt-0.5">
                        {metrics.collectedMetrics.totalMatchesRecorded} /{' '}
                        {metrics.collectedMetrics.totalEliminationsRecorded}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Authoritative Combat Ledger
                      </div>
                    </div>

                    <div className="p-3 bg-cyan-950/30 border border-cyan-500/50">
                      <div className="text-[10px] text-cyan-300/80">SERVER MEMORY &amp; UPTIME</div>
                      <div className="text-xl font-bold text-amber-300 mt-0.5">
                        {metrics.memoryRssMb ?? 0} MB
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Uptime: {metrics.uptimeSec ?? 0}s · Tick: 20Hz
                      </div>
                    </div>
                  </div>

                  {/* Verified Monetization & Economy Separation */}
                  <div className="p-4 bg-[#081326] border border-amber-500/50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-amber-300 font-bold uppercase tracking-wider">
                        MONETIZATION &amp; ECONOMY TELEMETRY (ZERO FABRICATED STATS)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-500/60 text-emerald-300">
                        IDEMPOTENT RECEIPT VALIDATION ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-100/80">
                      {metrics.externalMonetizationStatus.note}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="p-2.5 bg-black/60 border border-amber-500/30">
                        <div className="text-[10px] text-amber-300/70">IN-GAME KP SPENT</div>
                        <div className="text-base font-bold text-amber-200">
                          {metrics.collectedMetrics.totalCosmeticKpVolume.toLocaleString()} KP
                        </div>
                      </div>
                      <div className="p-2.5 bg-black/60 border border-amber-500/30">
                        <div className="text-[10px] text-amber-300/70">RECENT RECEIPTS LOGGED</div>
                        <div className="text-base font-bold text-amber-200">
                          {metrics.recentTransactions.length}
                        </div>
                      </div>
                      <div className="p-2.5 bg-black/60 border border-amber-500/30">
                        <div className="text-[10px] text-amber-300/70">
                          SPONSORED BROADCASTS COMPLETED
                        </div>
                        <div className="text-base font-bold text-emerald-300">
                          {metrics.collectedMetrics.totalRewardedAdsCompleted}
                        </div>
                      </div>
                      <div className="p-2.5 bg-black/60 border border-amber-500/30">
                        <div className="text-[10px] text-amber-300/70">
                          EXTERNAL PAYMENT / AD SDK
                        </div>
                        <div className="text-xs font-bold text-slate-300 mt-0.5">
                          {metrics.externalMonetizationStatus.paymentGatewayConnected
                            ? 'STRIPE LIVE'
                            : 'SANDBOX KP ONLY'}{' '}
                          ·{' '}
                          {metrics.externalMonetizationStatus.adNetworkConnected
                            ? 'ADS LIVE'
                            : 'NO EXTERNAL AD SDK'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Popularity & Active Colyseus Rooms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-black/60 border border-cyan-500/40">
                      <div className="text-cyan-300 font-bold uppercase mb-2">
                        MODE POPULARITY (COMPLETED SESSIONS)
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(metrics.collectedMetrics.modePopularity || {}).map(
                          ([mode, count]) => (
                            <div
                              key={mode}
                              className="flex items-center justify-between border-b border-white/10 pb-1"
                            >
                              <span className="uppercase text-slate-300">{mode}</span>
                              <span className="font-bold text-cyan-200">{count} matches</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 bg-black/60 border border-cyan-500/40">
                      <div className="text-cyan-300 font-bold uppercase mb-2">
                        ACTIVE COLYSEUS MULTIPLAYER ROOMS
                      </div>
                      {(metrics.activeRoomsList || []).length === 0 ? (
                        <div className="text-slate-400">
                          No active multiplayer rooms currently instantiated.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(metrics.activeRoomsList || []).map((rm) => (
                            <div
                              key={rm.roomId}
                              className="flex items-center justify-between border-b border-white/10 pb-1"
                            >
                              <span>
                                <strong className="text-cyan-200">{rm.roomId}</strong> ·{' '}
                                {rm.modeId.toUpperCase()}
                              </span>
                              <span className="text-emerald-300 font-bold">
                                {rm.pilotCount} human pilot(s)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'TRANSACTIONS' && (
                <div className="space-y-3">
                  <div className="text-cyan-300 font-bold uppercase">
                    AUTHORITATIVE RECEIPT LEDGER &amp; REFUND REVOCATION TESTER
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Every store unlock is recorded with an idempotent `transactionId`. Triggering a
                    refund revokes the unlocked item from the player&apos;s inventory and restores
                    spent in-game KP.
                  </p>
                  {metrics.recentTransactions.length === 0 ? (
                    <div className="p-6 text-center bg-black/50 border border-white/10 text-slate-400">
                      No store transactions recorded yet. Unlock a ship, weapon, or cosmetic to see
                      live receipts here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {metrics.recentTransactions.map((tx) => (
                        <div
                          key={tx.transactionId}
                          className="p-3 bg-black/65 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-cyan-200 font-bold">
                              {tx.itemType} · {tx.itemId}{' '}
                              <span className="text-amber-300">({tx.costKp} KP)</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              TX: {tx.transactionId} · {new Date(tx.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          <div>
                            {tx.status === 'REFUNDED' ? (
                              <span className="px-2.5 py-1 bg-rose-950 border border-rose-500/60 text-rose-300 text-[10px] font-bold">
                                REFUNDED &amp; REVOKED
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRefundTransaction(tx.transactionId)}
                                className="px-3 py-1 bg-rose-900/80 hover:bg-rose-700 border border-rose-400 text-white text-[10px] font-bold uppercase cursor-pointer"
                              >
                                REFUND &amp; REVOKE ITEM
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'AUDIT' && (
                <div className="space-y-2">
                  <div className="text-cyan-300 font-bold uppercase mb-2">
                    SERVER SECURITY &amp; ECONOMY AUDIT LOG
                  </div>
                  {metrics.recentAuditLogs.length === 0 ? (
                    <div className="p-6 text-center bg-black/50 border border-white/10 text-slate-400">
                      No audit events logged yet in this process window.
                    </div>
                  ) : (
                    metrics.recentAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-black/60 border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-[10px] mr-2">
                            {log.action}
                          </span>
                          <span className="text-slate-200">{log.details}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'REPORTS' && (
                <div className="space-y-2">
                  <div className="text-cyan-300 font-bold uppercase mb-2">
                    PLAYER SAFETY &amp; ABUSE REPORTS
                  </div>
                  {metrics.abuseReports.length === 0 ? (
                    <div className="p-6 text-center bg-black/50 border border-white/10 text-slate-400">
                      Zero active abuse reports in queue.
                    </div>
                  ) : (
                    metrics.abuseReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3 bg-black/60 border border-rose-500/40 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-rose-300 font-bold">
                            Target Callsign: {rep.targetCallsign}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rep.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-slate-300 text-[11px]">{rep.reason}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
