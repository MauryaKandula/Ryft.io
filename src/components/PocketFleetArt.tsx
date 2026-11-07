import React from 'react';
import { FactionId } from '../game/types';
import { BRANDING } from '../config/branding';

export const PocketFleetSplashLogo: React.FC<{
  cyberMode?: boolean;
  faction?: FactionId;
}> = ({ cyberMode = true, faction = 'incorruptus' }) => {
  const isRed = faction === 'omnitron';
  const primary = isRed ? '#FF003C' : '#00F0FF';
  const secondary = isRed ? '#FF2A6D' : '#38BDF8';
  const deep = isRed ? '#9F1239' : '#2563EB';
  const shadowFill = isRed ? '#2A040E' : '#091538';
  const strokeLight = isRed ? '#FDA4AF' : '#A5F3FC';

  return (
    <svg
      viewBox="0 0 760 250"
      className="w-full max-w-2xl h-auto select-none overflow-visible"
      aria-label={BRANDING.GAME_NAME}
    >
      <defs>
        <linearGradient id="pfCyberGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isRed ? '#FFF1F2' : '#F0F9FF'} />
          <stop offset="32%" stopColor={primary} />
          <stop offset="72%" stopColor={deep} />
          <stop offset="100%" stopColor={isRed ? '#3B0412' : '#1E1B4B'} />
        </linearGradient>
        <linearGradient id="pfStreakGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="50%" stopColor={primary} />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
        <linearGradient id="pfVioletStreak" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="50%" stopColor={secondary} />
          <stop offset="100%" stopColor="#FCEE0A" />
        </linearGradient>
        <filter id="pfGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Cyberpunk Blackwall Holo-Grid Horizon Rings Behind Logo */}
      <ellipse
        cx="380"
        cy="145"
        rx="270"
        ry="64"
        fill="none"
        stroke={primary}
        strokeWidth="1.2"
        strokeDasharray="10 8"
        opacity="0.34"
      />
      <ellipse
        cx="380"
        cy="145"
        rx="210"
        ry="44"
        fill="none"
        stroke={secondary}
        strokeWidth="1.1"
        strokeDasharray="4 6"
        opacity="0.4"
      />

      {/* Faction-Reactive Data Shards Floating Above Logo */}
      <g fill={primary} filter="url(#pfGlow)">
        <polygon points="315,74 323,66 327,79 318,83" />
        <polygon points="354,52 365,48 361,61" fill={secondary} />
        <polygon points="384,38 394,45 388,58 380,49" />
        <polygon points="418,32 436,56 426,64 415,44" fill={secondary} />
        <polygon points="442,60 462,74 454,84 436,68" />
        <polygon points="478,46 492,40 496,51 482,56" fill={strokeLight} />
        <polygon points="502,68 518,62 522,74 506,79" />
        <polygon points="535,34 552,29 546,45 532,42" fill={secondary} />
        <polygon points="558,56 572,48 576,60 562,67" />
        <polygon points="586,25 604,34 596,49 581,39" fill={strokeLight} />
        <polygon points="622,42 634,36 638,52 625,55" />
        <polygon points="646,66 658,58 662,74 649,78" fill={secondary} />
        <polygon points="682,32 695,42 688,58 676,48" />
        <polygon points="704,54 718,44 714,66 700,64" fill={secondary} />
      </g>

      {cyberMode && (
        <g fill={primary} opacity="0.92" filter="url(#pfGlow)">
          <polygon points="370,66 378,60 381,70" />
          <polygon points="488,30 498,25 495,36" fill={secondary} />
          <polygon points="610,60 620,53 617,66" />
          <polygon points="332,44 342,39 339,50" fill="#FF2A6D" />
          <polygon points="545,62 554,56 551,68" fill="#00F0FF" />
          <line
            x1="190"
            y1="188"
            x2="570"
            y2="188"
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="18 8"
            opacity="0.82"
          />
        </g>
      )}

      {/* 3D Extruded Deep Shadow Behind Game Name */}
      <text
        x="384"
        y="169"
        textAnchor="middle"
        fill={shadowFill}
        fontFamily="Chakra Petch, Orbitron, sans-serif"
        fontWeight="900"
        fontSize="88"
        letterSpacing="7"
      >
        {BRANDING.GAME_NAME.toUpperCase()}
      </text>

      {/* Main Angular Cyberpunk 2077 / Edgerunners Game Name Typography */}
      <text
        x="380"
        y="164"
        textAnchor="middle"
        fill="url(#pfCyberGrad)"
        stroke={strokeLight}
        strokeWidth="0.95"
        fontFamily="Chakra Petch, Orbitron, sans-serif"
        fontWeight="900"
        fontSize="88"
        letterSpacing="7"
        filter="url(#pfGlow)"
      >
        {BRANDING.GAME_NAME.toUpperCase()}
      </text>

      {/* Dark Diagonal Cut Channels Before Drawing the 3 Streaking Cyber Interceptors */}
      <g stroke="#02050D" strokeWidth="11" strokeLinecap="round">
        <line x1="205" y1="168" x2="375" y2="82" />
        <line x1="305" y1="176" x2="465" y2="94" />
        <line x1="355" y1="184" x2="500" y2="112" />
      </g>

      {/* 3 Streaking Cyber Starfighters Slicing Across the Text */}
      <g filter="url(#pfGlow)">
        <polygon points="195,173 368,81 372,88" fill="url(#pfStreakGrad)" />
        <polygon points="365,78 384,74 376,91" fill={primary} />
        <circle cx="385" cy="73" r="4.5" fill="#FFFFFF" />

        <polygon points="295,181 458,93 462,100" fill="url(#pfStreakGrad)" />
        <polygon points="455,90 474,86 466,103" fill={secondary} />
        <circle cx="475" cy="85" r="4.5" fill="#FFFFFF" />

        <polygon points="345,189 493,111 497,118" fill="url(#pfVioletStreak)" />
        <polygon points="490,108 509,104 501,121" fill={strokeLight} />
        <circle cx="510" cy="103" r="4" fill={primary} />
      </g>
    </svg>
  );
};

export const PocketFleetWingHeader: React.FC<{
  showBackToMenu?: boolean;
  onBackToMenu?: () => void;
  rightSlot?: React.ReactNode;
  faction?: FactionId;
}> = ({ showBackToMenu, onBackToMenu, rightSlot, faction = 'incorruptus' }) => {
  const isRed = faction === 'omnitron';
  const primary = isRed ? '#FF003C' : '#00F0FF';
  const secondary = isRed ? '#FF2A6D' : '#38BDF8';
  const deep = isRed ? '#9F1239' : '#2563EB';
  const shadowFill = isRed ? '#2A040E' : '#091538';
  const strokeLight = isRed ? '#FDA4AF' : '#A5F3FC';

  return (
    <div className="relative w-full max-w-4xl mx-auto pt-2 pb-3 select-none">
      <div className="flex items-center justify-between px-2 mb-1">
        <div>
          {showBackToMenu && onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="pf-grid-btn px-4 py-1.5 text-xs md:text-sm tracking-widest uppercase cursor-pointer"
            >
              MAIN MENU
            </button>
          )}
        </div>
        <div>{rightSlot}</div>
      </div>

      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 800 110" className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="hdrCyberGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isRed ? '#FFF1F2' : '#F0F9FF'} />
              <stop offset="45%" stopColor={primary} />
              <stop offset="100%" stopColor={deep} />
            </linearGradient>
            <linearGradient id="hdrWingBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={deep} />
              <stop offset="50%" stopColor={primary} />
              <stop offset="100%" stopColor={deep} />
            </linearGradient>
            <filter id="wingGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <text
            x="403"
            y="66"
            textAnchor="middle"
            fill={shadowFill}
            fontFamily="Chakra Petch, Orbitron, sans-serif"
            fontWeight="900"
            fontSize="54"
            letterSpacing="6"
          >
            {BRANDING.GAME_NAME.toUpperCase()}
          </text>
          <text
            x="400"
            y="63"
            textAnchor="middle"
            fill="url(#hdrCyberGrad)"
            stroke={strokeLight}
            strokeWidth="0.65"
            fontFamily="Chakra Petch, Orbitron, sans-serif"
            fontWeight="900"
            fontSize="54"
            letterSpacing="6"
            filter="url(#wingGlow)"
          >
            {BRANDING.GAME_NAME.toUpperCase()}
          </text>

          <g stroke="#02050D" strokeWidth="6.5">
            <line x1="295" y1="68" x2="395" y2="16" />
            <line x1="350" y1="74" x2="445" y2="24" />
            <line x1="385" y1="78" x2="470" y2="34" />
          </g>
          <g fill={primary} filter="url(#wingGlow)">
            <polygon points="295,68 395,14 398,19" />
            <circle cx="401" cy="12" r="3.5" fill="#FFFFFF" />
            <polygon points="350,74 445,22 448,27" fill={secondary} />
            <circle cx="451" cy="20" r="3.5" fill="#FFFFFF" />
            <polygon points="385,78 470,32 473,37" fill={strokeLight} />
            <circle cx="476" cy="30" r="3" fill={primary} />
          </g>

          {/* Cyberpunk Faction-Reactive Neon Wing Bezel Below Logo */}
          <path
            d="M 10,56 L 210,56 L 250,92 L 550,92 L 590,56 L 790,56 L 790,62 L 605,62 L 568,98 L 232,98 L 195,62 L 10,62 Z"
            fill="url(#hdrWingBarGrad)"
            filter="url(#wingGlow)"
          />
        </svg>
      </div>
    </div>
  );
};

export const FactionCommanderAvatar: React.FC<{
  faction: FactionId;
  active: boolean;
}> = ({ faction, active }) => {
  if (faction === 'incorruptus') {
    return (
      <svg
        viewBox="0 0 120 180"
        className={`w-24 md:w-28 h-auto transition-all ${
          active
            ? 'opacity-100 scale-105 drop-shadow-[0_0_18px_rgba(0,240,255,0.9)]'
            : 'opacity-45'
        }`}
      >
        <defs>
          <linearGradient id="incHelm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
        </defs>
        {/* Vanguard Synapse (BLUE EDGERUNNER / NETWATCH) Cyber-Director Helmet */}
        <line x1="82" y1="12" x2="82" y2="34" stroke="#00F0FF" strokeWidth="2.5" />
        <circle cx="82" cy="11" r="3" fill="#00F0FF" />
        <path
          d="M34,45 C34,16 86,16 86,45 Z"
          fill="url(#incHelm)"
          stroke="#00F0FF"
          strokeWidth="1.5"
        />
        <polygon points="52,18 68,18 64,42 56,42" fill="#0284C7" />
        {/* Wraparound Cybernetic Blue Holo-Visor */}
        <polygon
          points="34,41 86,41 82,57 38,57"
          fill="#030914"
          stroke="#00F0FF"
          strokeWidth="1.5"
        />
        <line x1="40" y1="47" x2="80" y2="47" stroke="#00F0FF" strokeWidth="2.5" />
        <circle cx="49" cy="51" r="3" fill="#38BDF8" />
        <circle cx="71" cy="51" r="3" fill="#38BDF8" />
        <rect x="44" y="57" width="32" height="5" fill="#94A3B8" />
        <rect x="39" y="62" width="42" height="12" fill="#0EA5E9" />
        <rect x="39" y="68" width="42" height="6" fill="#0284C7" />
        <path
          d="M22,122 L34,76 L86,76 L98,122"
          stroke="#0F172A"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
        <rect
          x="38"
          y="74"
          width="44"
          height="48"
          fill="#0F172A"
          stroke="#00F0FF"
          strokeWidth="1.2"
        />
        <rect x="38" y="74" width="8" height="44" fill="#0284C7" />
        <rect x="74" y="74" width="8" height="44" fill="#0284C7" />
        <rect x="38" y="112" width="44" height="6" fill="#00F0FF" />
        {/* Synapse Core Triad */}
        <polygon points="60,86 68,99 52,99" fill="none" stroke="#00F0FF" strokeWidth="1.8" />
        <circle cx="60" cy="94" r="2.5" fill="#38BDF8" />
        <circle cx="22" cy="126" r="6" fill="#00F0FF" />
        <circle cx="98" cy="126" r="6" fill="#00F0FF" />
        <rect x="42" y="122" width="14" height="48" fill="#0F172A" />
        <rect x="64" y="122" width="14" height="48" fill="#0F172A" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 120 180"
      className={`w-24 md:w-28 h-auto transition-all ${
        active
          ? 'opacity-100 scale-105 drop-shadow-[0_0_18px_rgba(255,0,60,0.9)]'
          : 'opacity-45'
      }`}
    >
      {/* Nexus Protocol (RED BLACKWALL ROGUE AI) Prime Daemon */}
      <polygon
        points="30,54 39,22 81,22 90,54"
        fill="#270914"
        stroke="#FF003C"
        strokeWidth="1.6"
      />
      <polygon points="39,33 81,33 85,56 35,56" fill="#090205" />
      <rect x="44" y="38" width="32" height="3.5" fill="#FF003C" />
      <rect x="44" y="44.5" width="32" height="3.5" fill="#FF2A6D" />
      <rect x="44" y="51" width="32" height="3.5" fill="#FF003C" />
      <rect
        x="36"
        y="64"
        width="48"
        height="54"
        fill="#19040B"
        stroke="#FF003C"
        strokeWidth="1.2"
      />
      <line x1="36" y1="80" x2="84" y2="80" stroke="#4C0519" strokeWidth="3" />
      <line x1="36" y1="96" x2="84" y2="96" stroke="#4C0519" strokeWidth="3" />
      <line x1="60" y1="64" x2="60" y2="118" stroke="#FF003C" strokeWidth="2" />
      <line x1="34" y1="70" x2="18" y2="120" stroke="#3B0718" strokeWidth="10" />
      <line x1="86" y1="70" x2="102" y2="120" stroke="#3B0718" strokeWidth="10" />
      <path d="M10,132 C10,118 26,118 26,132" stroke="#FF003C" strokeWidth="5" fill="none" />
      <path d="M94,132 C94,118 110,118 110,132" stroke="#FF003C" strokeWidth="5" fill="none" />
      <rect x="40" y="118" width="16" height="52" fill="#2A0510" />
      <rect x="64" y="118" width="16" height="52" fill="#2A0510" />
      <line x1="40" y1="132" x2="56" y2="132" stroke="#FF003C" strokeWidth="2" />
      <line x1="64" y1="132" x2="80" y2="132" stroke="#FF003C" strokeWidth="2" />
      <line x1="40" y1="148" x2="56" y2="148" stroke="#FF003C" strokeWidth="2" />
      <line x1="64" y1="148" x2="80" y2="148" stroke="#FF003C" strokeWidth="2" />
    </svg>
  );
};

export const RankHexagonBadge: React.FC<{ numeral: string; faction: FactionId }> = ({
  numeral,
  faction,
}) => {
  const isRed = faction === 'omnitron';
  const outerColor =
    faction === 'incorruptus' ? '#0284C7' : isRed ? '#9F1239' : '#059669';
  const midColor =
    faction === 'incorruptus' ? '#00F0FF' : isRed ? '#FF003C' : '#34D399';
  const gradEnd =
    faction === 'incorruptus' ? '#38BDF8' : isRed ? '#FF2A6D' : '#10B981';

  return (
    <svg
      viewBox="0 0 160 150"
      className={`w-32 md:w-36 h-auto ${
        isRed
          ? 'drop-shadow-[0_0_22px_rgba(255,0,60,0.65)]'
          : 'drop-shadow-[0_0_22px_rgba(0,240,255,0.6)]'
      }`}
    >
      <defs>
        <linearGradient id={`rankCyber_${faction}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor={midColor} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
      </defs>
      {/* 3D Faceted Hexagon Bevels */}
      <polygon
        points="42,10 118,10 154,75 118,140 42,140 6,75"
        fill={outerColor}
        stroke={midColor}
        strokeWidth="3.5"
      />
      <polygon points="42,10 118,10 104,36 56,36" fill={midColor} opacity="0.7" />
      <polygon points="6,75 42,10 56,36 32,75" fill={midColor} opacity="0.45" />
      <polygon points="118,10 154,75 128,75 104,36" fill="#050814" opacity="0.45" />
      <polygon points="56,114 104,114 118,140 42,140" fill="#050814" opacity="0.6" />

      {/* Inner Dark Hexagon Cutout */}
      <polygon
        points="56,36 104,36 128,75 104,114 56,114 32,75"
        fill="#040208"
        stroke={midColor}
        strokeWidth="1.5"
      />

      {/* Faction-Reactive Roman Numeral */}
      <text
        x="80"
        y="96"
        textAnchor="middle"
        fill={`url(#rankCyber_${faction})`}
        stroke="#FFFFFF"
        strokeWidth="1"
        fontFamily="Chakra Petch, Orbitron, sans-serif"
        fontWeight="900"
        fontSize="58"
      >
        {numeral}
      </text>
    </svg>
  );
};

export const EquipmentPreviewIcon: React.FC<{
  type: 'SHIP' | 'CANNON' | 'MISSILE';
  faction: FactionId;
  itemId: string;
}> = ({ type, faction, itemId }) => {
  const accent =
    faction === 'incorruptus' ? '#00F0FF' : faction === 'omnitron' ? '#FF003C' : '#05FFA1';
  const ringStop =
    faction === 'omnitron' ? 'rgba(255, 0, 60, 0.38)' : 'rgba(0, 240, 255, 0.36)';

  return (
    <svg viewBox="0 0 110 110" className="w-24 h-24 mx-auto overflow-visible">
      <defs>
        <linearGradient id="hullMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="darkMetal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <radialGradient id={`ringGlowGrad_${faction}`} cx="50%" cy="50%" r="50%">
          <stop offset="65%" stopColor="rgba(0, 0, 0, 0.05)" />
          <stop offset="100%" stopColor={ringStop} />
        </radialGradient>
      </defs>

      {/* Outer Glowing Faction-Reactive Target Ring */}
      <circle
        cx="55"
        cy="55"
        r="37"
        fill={`url(#ringGlowGrad_${faction})`}
        stroke={accent}
        strokeWidth="3.5"
      />

      {type === 'SHIP' && (
        <g transform="translate(55,55) rotate(-32)">
          <ellipse cx="-6" cy="24" rx="3" ry="7" fill={accent} />
          <ellipse cx="6" cy="24" rx="3" ry="7" fill={accent} />
          <polygon
            points="0,-34 11,-8 32,8 14,14 9,25 0,18 -9,25 -14,14 -32,8 -11,-8"
            fill="url(#hullMetal)"
            stroke="#CBD5E1"
            strokeWidth="1.2"
          />
          <polygon points="0,-28 8,-4 0,16 -8,-4" fill="#CBD5E1" />
          <polygon points="-32,8 -22,1 -18,11" fill={accent} />
          <polygon points="32,8 22,1 18,11" fill={accent} />
          <polygon points="0,-16 4.5,-2 0,6 -4.5,-2" fill="#0F172A" />
        </g>
      )}

      {type === 'CANNON' && (
        <g transform="translate(55,55)">
          <ellipse
            cx="0"
            cy="12"
            rx="5"
            ry="15"
            fill={itemId.includes('bio') ? '#05FFA1' : accent}
          />
          <ellipse cx="0" cy="10" rx="2.5" ry="9" fill="#FFFFFF" />
          <path
            d="M -6,-2 L -6,-16 C -6,-26 6,-26 6,-16 L 6,-2 Z"
            fill="url(#hullMetal)"
            stroke="#E2E8F0"
            strokeWidth="1"
          />
          <path
            d="M -26,28 C -18,18 18,18 26,28 L 32,33 L -32,33 Z"
            fill="url(#hullMetal)"
            stroke="#94A3B8"
            strokeWidth="1.2"
          />
        </g>
      )}

      {type === 'MISSILE' && (
        <g transform="translate(55,55)">
          <polygon
            points="-32,18 -14,6 14,6 32,18 20,32 -20,32"
            fill="url(#hullMetal)"
            stroke="#CBD5E1"
            strokeWidth="1.4"
          />
          <polygon points="-20,18 -10,11 10,11 20,18 12,26 -12,26" fill="#0F172A" />
          <rect
            x="-6.5"
            y="-22"
            width="13"
            height="38"
            rx="3"
            fill="url(#darkMetal)"
            stroke="#94A3B8"
            strokeWidth="1"
          />
          <path d="M -6.5,-20 C -6.5,-32 6.5,-32 6.5,-20 Z" fill={accent} />
          <polygon points="-12,12 -6.5,0 -6.5,14" fill="#64748B" />
          <polygon points="12,12 6.5,0 6.5,14" fill="#64748B" />
        </g>
      )}
    </svg>
  );
};

export const TutorialNavigatorAvatar: React.FC = () => (
  <svg
    viewBox="0 0 90 80"
    className="w-16 md:w-20 h-auto shrink-0 drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]"
  >
    <polygon points="18,34 2,20 8,32 0,36 12,42 4,48 20,46" fill="#00F0FF" />
    <polygon points="72,34 88,20 82,32 90,36 78,42 86,48 70,46" fill="#00F0FF" />
    <path d="M 20,42 C 20,14 70,14 70,42 Z" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
    <rect x="42" y="21" width="6" height="14" fill="#00F0FF" />
    <rect x="38" y="25" width="14" height="6" fill="#00F0FF" />
    <rect
      x="23"
      y="40"
      width="44"
      height="20"
      rx="6"
      fill="#09152B"
      stroke="#00F0FF"
      strokeWidth="1.2"
    />
    <circle cx="35" cy="49" r="6.5" fill="none" stroke="#00F0FF" strokeWidth="1.8" />
    <circle cx="35" cy="49" r="2.5" fill="#38BDF8" />
    <circle cx="55" cy="49" r="2.5" fill="#38BDF8" />
    <rect x="22" y="56" width="46" height="10" rx="4" fill="#4F46E5" />
  </svg>
);

export const TutorialTiltDevicesIllustration: React.FC = () => (
  <svg viewBox="0 0 380 105" className="w-full max-w-md h-auto mx-auto my-2 overflow-visible">
    <g transform="translate(85, 54) rotate(-8)">
      <rect
        x="-58"
        y="-32"
        width="116"
        height="64"
        rx="6"
        fill="#040B1A"
        stroke="#00F0FF"
        strokeWidth="3.5"
      />
      <circle cx="48" cy="-10" r="3" fill="#00F0FF" />
      <rect x="45" y="4" width="6" height="10" rx="1" fill="#00F0FF" />
      <line x1="0" y1="22" x2="0" y2="-4" stroke="#00F0FF" strokeWidth="2.5" />
      <polygon points="0,-12 -6,-1 6,-1" fill="#00F0FF" />
      <path d="M -14,-22 Q 0,-28 8,-14" fill="none" stroke="#A5F3FC" strokeWidth="2.5" />
      <polygon points="-16,-21 -9,-26 -10,-18" fill="#A5F3FC" />
    </g>

    <text
      x="190"
      y="62"
      textAnchor="middle"
      fill="#00F0FF"
      fontFamily="Share Tech Mono, monospace"
      fontWeight="bold"
      fontSize="22"
      letterSpacing="2"
    >
      OR
    </text>

    <g transform="translate(295, 58) rotate(-8)">
      <polygon
        points="-62,6 54,-10 62,6 -54,22"
        fill="#040B1A"
        stroke="#00F0FF"
        strokeWidth="3"
      />
      <line x1="-52" y1="16" x2="58" y2="1" stroke="#00F0FF" strokeWidth="2" />
      <path d="M -12,-14 Q 0,-20 8,-6" fill="none" stroke="#A5F3FC" strokeWidth="2.5" />
      <polygon points="-14,-13 -7,-18 -8,-10" fill="#A5F3FC" />
    </g>
  </svg>
);
