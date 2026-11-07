import React, { useState, useEffect } from 'react';
import { COSMETIC_ITEMS } from '../game/catalog';
import { CosmeticCategory, CosmeticItemSpec, PilotProfile } from '../game/types';
import { soundEngine } from '../audio/soundEngine';
import { BRANDING } from '../config/branding';

interface CosmeticStoreModalProps {
  profile: PilotProfile;
  onUnlockCosmetic: (item: CosmeticItemSpec) => void;
  onEquipCosmetic: (item: CosmeticItemSpec) => void;
  onClaimRewardedAd: (kpReward: number) => void;
  onRestorePurchases?: () => Promise<number>;
  onClose: () => void;
}

export const CosmeticStoreModal: React.FC<CosmeticStoreModalProps> = ({
  profile,
  onUnlockCosmetic,
  onEquipCosmetic,
  onClaimRewardedAd,
  onRestorePurchases,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<CosmeticCategory>('SKIN');
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(5);
  const [adCompleted, setAdCompleted] = useState(false);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);

  const items = COSMETIC_ITEMS.filter((it) => it.category === activeTab);

  useEffect(() => {
    if (!adModalOpen || adCompleted) return;
    const timer = window.setInterval(() => {
      setAdSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setAdCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [adModalOpen, adCompleted]);

  const startRewardedBroadcast = () => {
    soundEngine.playSelect();
    setAdSecondsLeft(5);
    setAdCompleted(false);
    setAdModalOpen(true);
  };

  const finishRewardedBroadcast = () => {
    soundEngine.playRepair();
    onClaimRewardedAd(500);
    setAdModalOpen(false);
  };

  const isEquipped = (item: CosmeticItemSpec) => {
    if (item.category === 'SKIN') return (profile.selectedSkinId || 'skin_default') === item.id;
    if (item.category === 'TRAIL') return (profile.selectedTrailId || 'trail_default') === item.id;
    return (profile.selectedShieldId || 'shield_default') === item.id;
  };

  const isUnlocked = (item: CosmeticItemSpec) => {
    if (item.costKp === 0) return true;
    return (profile.unlockedCosmetics || []).includes(item.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01040B]/85 backdrop-blur-md p-3">
      <div className="relative w-full max-w-2xl pf-panel overflow-hidden shadow-2xl">
        {/* Top Bezel Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b-2 border-cyan-500/70 bg-[#051026]">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-wider text-cyan-200 uppercase">
              {BRANDING.GAME_NAME.toUpperCase()} COSMETIC BAY
            </h2>
            <p className="text-[11px] font-mono text-sky-300/80 tracking-wider">
              100% COSMETIC CUSTOMIZATION · ZERO PAY-TO-WIN ADVANTAGE
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[#020714] border border-cyan-500/60 text-right">
              <div className="text-[10px] font-mono text-cyan-300/70">AVAILABLE KP</div>
              <div className="text-base font-bold font-mono text-cyan-200 tabular-nums">
                {profile.killpoints.toLocaleString()} KP
              </div>
            </div>
            <button
              onClick={() => {
                soundEngine.playSelect();
                onClose();
              }}
              className="pf-grid-btn px-3 py-1.5 text-sm font-bold cursor-pointer"
            >
              ✕ CLOSE
            </button>
          </div>
        </div>

        {/* Category Tabs + Optional Sponsored Broadcast Reward Button + Restore Purchases */}
        <div className="px-5 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 bg-[#030A18]/90">
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'SKIN', label: 'HULL SKINS' },
                { id: 'TRAIL', label: 'EXHAUST TRAILS' },
                { id: 'SHIELD', label: 'SHIELD AURAS' },
              ] as { id: CosmeticCategory; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playSelect();
                  setActiveTab(tab.id);
                }}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold tracking-wider transition-all border cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.35)]'
                    : 'bg-[#040C1E] border-blue-800/60 text-sky-400/75 hover:text-cyan-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {onRestorePurchases && (
              <button
                onClick={async () => {
                  soundEngine.playSelect();
                  const count = await onRestorePurchases();
                  setRestoreNote(
                    `Verified ${count} authoritative receipt(s) & restored unlocked inventory.`
                  );
                }}
                className="px-2.5 py-1.5 text-xs font-bold font-mono tracking-wider bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-400/70 text-indigo-200 cursor-pointer"
              >
                ↻ RESTORE PURCHASES
              </button>
            )}
            <button
              onClick={startRewardedBroadcast}
              className="px-3.5 py-1.5 text-xs font-bold font-mono tracking-wider bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer"
            >
              <span>▶ WATCH SPONSORED BROADCAST</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/30 border border-emerald-300 text-emerald-100">
                +500 KP
              </span>
            </button>
          </div>
        </div>

        {restoreNote && (
          <div className="px-5 py-1.5 bg-cyan-950/70 border-b border-cyan-500/40 text-xs font-mono text-cyan-200">
            {restoreNote}
          </div>
        )}

        {/* Cosmetic Items Grid */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {items.map((item) => {
            const unlocked = isUnlocked(item);
            const equipped = isEquipped(item);
            const canAfford = profile.killpoints >= item.costKp;

            return (
              <div
                key={item.id}
                className={`p-3.5 border transition-all flex flex-col justify-between ${
                  equipped
                    ? 'bg-cyan-950/45 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                    : unlocked
                      ? 'bg-[#051024]/90 border-sky-600/50 hover:border-cyan-400/80'
                      : 'bg-[#030A18]/85 border-blue-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold tracking-wide text-cyan-100">
                      {item.name}
                    </span>
                    {equipped ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-cyan-500/20 border border-cyan-400 text-cyan-200">
                        EQUIPPED
                      </span>
                    ) : unlocked ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/20 border border-indigo-400/60 text-indigo-200">
                        OWNED
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                        {item.costKp.toLocaleString()} KP
                      </span>
                    )}
                  </div>

                  {/* Color Swatch Preview Bar */}
                  <div className="h-6 w-full mb-2.5 border border-cyan-400/30 flex overflow-hidden">
                    <div
                      className="flex-1 h-full"
                      style={{ backgroundColor: item.previewPrimary }}
                    />
                    <div
                      className="flex-1 h-full"
                      style={{ backgroundColor: item.previewSecondary }}
                    />
                    <div
                      className="flex-1 h-full"
                      style={{ backgroundColor: item.previewAccent }}
                    />
                  </div>

                  <p className="text-xs text-sky-100/75 leading-relaxed mb-3">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  {equipped ? (
                    <button
                      disabled
                      className="w-full py-1.5 text-xs font-mono font-bold bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 cursor-default"
                    >
                      ✓ ACTIVE ON SHIP
                    </button>
                  ) : unlocked ? (
                    <button
                      onClick={() => {
                        soundEngine.playSelect();
                        onEquipCosmetic(item);
                      }}
                      className="w-full py-1.5 text-xs font-bold pf-grid-btn cursor-pointer"
                    >
                      EQUIP COSMETIC
                    </button>
                  ) : (
                    <button
                      disabled={!canAfford}
                      onClick={() => {
                        soundEngine.playRepair();
                        onUnlockCosmetic(item);
                      }}
                      className={`w-full py-1.5 text-xs font-bold border transition-all ${
                        canAfford
                          ? 'pf-grid-btn cursor-pointer'
                          : 'bg-slate-900/80 border-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford
                        ? `UNLOCK FOR ${item.costKp.toLocaleString()} KP`
                        : `NEED ${(item.costKp - profile.killpoints).toLocaleString()} MORE KP`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Fair-Play Notice */}
        <div className="px-5 py-2.5 bg-[#020714] border-t border-cyan-500/30 flex items-center justify-between text-[11px] font-mono text-sky-300/75">
          <span>COSMETICS SYNCHRONIZE LIVE ACROSS ALL COLYSEUS SECTOR ROOMS</span>
          <span>SPONSORED BROADCASTS WATCHED: {profile.adsWatchedCount || 0}</span>
        </div>

        {/* Simulated 5-Second Sponsored Broadcast Modal (Never shown in combat) */}
        {adModalOpen && (
          <div className="absolute inset-0 z-50 bg-[#02050E]/95 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full pf-panel p-6 border-2 border-emerald-400/80">
              <div className="text-xs font-mono tracking-widest text-emerald-300 uppercase mb-1">
                GALACTIC SYNDICATE HOLONET TRANSMISSION
              </div>
              <h3 className="text-xl font-bold text-cyan-200 mb-3">
                ORBITAL SHIPYARDS · SEASON I COSMETIC SHOWCASE
              </h3>
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 mb-4">
                <div className="text-xs font-mono text-emerald-200/90 mb-2">
                  Collect glowing Plasma Orbs across Sector Alpha-01 to evolve your Scout into a
                  Tier III Heavy Frigate!
                </div>
                <div className="w-full h-2 bg-black/80 border border-emerald-500/40 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-1000"
                    style={{ width: `${((5 - adSecondsLeft) / 5) * 100}%` }}
                  />
                </div>
              </div>

              {adCompleted ? (
                <button
                  onClick={finishRewardedBroadcast}
                  className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-300 cursor-pointer"
                >
                  CLAIM +500 KP REWARD
                </button>
              ) : (
                <div className="text-xs font-mono text-cyan-300">
                  REWARD UNLOCKS IN {adSecondsLeft}s...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
