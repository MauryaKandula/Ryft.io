import React, { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { GAME_MODES } from '../game/catalog';
import { GameModeId } from '../game/types';
import { BRANDING } from '../config/branding';

export interface PublicRoomSummary {
  roomId: string;
  roomName: string;
  modeId: GameModeId;
  pilotCount: number;
  allyScore: number;
  enemyScore: number;
}

interface MultiplayerLobbyModalProps {
  callsign: string;
  selectedMode: GameModeId;
  rooms: PublicRoomSummary[];
  activeRoomId: string | null;
  connectedStatus: 'CONNECTED' | 'CONNECTING' | 'OFFLINE';
  onChangeCallsign: (name: string) => void;
  onJoinRoom: (roomId: string, roomName: string, modeId: GameModeId) => void;
  onClose: () => void;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  callsign,
  selectedMode,
  rooms,
  activeRoomId,
  connectedStatus,
  onChangeCallsign,
  onJoinRoom,
  onClose,
}) => {
  const [customCode, setCustomCode] = useState<string>(activeRoomId || 'SECTOR-7');
  const [roomMode, setRoomMode] = useState<GameModeId>(selectedMode);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const handleCopyInviteLink = () => {
    soundEngine.playSelect();
    const code = (customCode.trim() || 'SECTOR-7').toUpperCase();
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#02050E]/90 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-2xl pf-panel p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/40">
          <div>
            <div className="text-xs font-mono text-cyan-400">
              {BRANDING.GAME_NAME.toUpperCase()} LIVE SECTOR NETWORK ·{' '}
              {connectedStatus === 'CONNECTED' ? 'WEBSOCKET ONLINE' : 'AI SQUADRON FALLBACK READY'}
            </div>
            <h2 className="text-xl font-bold font-display text-cyan-200 mt-0.5 tracking-wider">
              {BRANDING.GAME_NAME.toUpperCase()} · MULTIPLAYER SECTOR ROOMS
            </h2>
          </div>
          <button
            onClick={() => {
              soundEngine.playSelect();
              onClose();
            }}
            className="pf-grid-btn px-4 py-1.5 text-xs font-bold uppercase cursor-pointer"
          >
            CLOSE
          </button>
        </div>

        {/* Pilot Callsign & Host New Room */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
          <div>
            <label className="block text-xs font-semibold text-cyan-300 mb-1.5 uppercase tracking-wider">
              Pilot Callsign
            </label>
            <input
              type="text"
              value={callsign}
              maxLength={16}
              onChange={(e) => onChangeCallsign(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#030A1C] border border-cyan-500/60 text-cyan-100 focus:outline-none focus:border-cyan-300"
              placeholder="Enter Callsign"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-cyan-300 mb-1.5 uppercase tracking-wider">
              Sector Room Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customCode}
                maxLength={12}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono bg-[#030A1C] border border-cyan-500/60 text-cyan-100 focus:outline-none focus:border-cyan-300"
                placeholder="SECTOR-7"
              />
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  const code = customCode.trim() || 'ALPHA-1';
                  onJoinRoom(code, `Room ${code}`, roomMode);
                }}
                className="pf-grid-btn px-3.5 py-2 text-xs font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
              >
                Host / Join
              </button>
              <button
                onClick={handleCopyInviteLink}
                className="pf-grid-btn-cyan px-3 py-2 text-xs font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                title="Copy shareable RYFT.io room link"
              >
                {copiedLink ? 'Copied!' : 'Share URL'}
              </button>
            </div>
          </div>
        </div>

        {/* Room Mode Selector */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-sky-300/80 mb-2 uppercase tracking-wider">
            Select Mode for New Room
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setRoomMode(m.id)}
                className={`p-2.5 border text-left text-xs font-semibold transition-colors cursor-pointer ${
                  roomMode === m.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.28)]'
                    : 'bg-[#040C1E] border-blue-900/60 text-slate-400 hover:text-cyan-200'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Active Public Rooms List */}
        <div>
          <div className="text-xs font-semibold text-sky-300/80 mb-2 uppercase tracking-wider">
            Active Sector Rooms ({rooms.length})
          </div>
          {rooms.length === 0 ? (
            <div className="p-6 text-center border border-blue-900/60 bg-[#030A18]/80 text-xs text-sky-200/75">
              No active public rooms yet. Enter a Room Code above and click Host / Join to launch a
              synchronized multiplayer arena with AI wingmen.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {rooms.map((r) => {
                const modeSpec = GAME_MODES.find((m) => m.id === r.modeId) || GAME_MODES[0];
                const isJoined = activeRoomId === r.roomId;
                return (
                  <div
                    key={r.roomId}
                    className="flex items-center justify-between p-3 border border-cyan-500/35 bg-[#040E22]/90"
                  >
                    <div>
                      <div className="text-sm font-bold text-cyan-100 font-mono">
                        {r.roomId} · <span className="font-sans">{modeSpec.name}</span>
                      </div>
                      <div className="text-xs text-sky-300/80 font-mono tabular-nums">
                        {r.pilotCount} Human {r.pilotCount === 1 ? 'Pilot' : 'Pilots'} + AI Squadron ·
                        Score {r.allyScore} - {r.enemyScore}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        soundEngine.playSelect();
                        onJoinRoom(r.roomId, r.roomName, r.modeId);
                      }}
                      className={`px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isJoined
                          ? 'bg-emerald-500 text-slate-950'
                          : 'pf-grid-btn'
                      }`}
                    >
                      {isJoined ? 'Joined — Enter Arena' : 'Join Sector'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
