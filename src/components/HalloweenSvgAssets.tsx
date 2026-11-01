import React from 'react';

interface SvgProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/**
 * Bat Vector Asset (Kelelawar)
 * Menacing vampire bat silhouette with wing membranes, glowing eyes, and sharp ears.
 */
export const BatSvg: React.FC<SvgProps & { animateFlap?: boolean }> = ({ 
  className = '', 
  size = 40,
  animateFlap = false 
}) => {
  return (
    <svg
      width={size}
      height={size * 0.65}
      viewBox="0 0 100 65"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animateFlap ? 'animate-pulse' : ''} ${className}`}
      style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.65))' }}
    >
      <defs>
        <linearGradient id="batBodyGrad" x1="50" y1="10" x2="50" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2e1065" />
          <stop offset="0.6" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#090514" />
        </linearGradient>
        <linearGradient id="batWingGrad" x1="0" y1="20" x2="100" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b0764" />
          <stop offset="0.5" stopColor="#1e1035" />
          <stop offset="1" stopColor="#3b0764" />
        </linearGradient>
      </defs>

      {/* Left Wing */}
      <path
        d="M 50 25 C 42 12, 28 6, 8 12 C 14 26, 17 38, 22 46 C 26 38, 33 36, 38 43 C 41 36, 46 36, 50 40 Z"
        fill="url(#batWingGrad)"
        stroke="#7e22ce"
        strokeWidth="1"
      />
      {/* Wing ribs left */}
      <path d="M 12 14 C 20 28, 26 40, 26 44" stroke="#a855f7" strokeWidth="0.8" strokeOpacity="0.7" />
      <path d="M 24 16 C 30 26, 34 38, 37 42" stroke="#a855f7" strokeWidth="0.8" strokeOpacity="0.7" />

      {/* Right Wing */}
      <path
        d="M 50 25 C 58 12, 72 6, 92 12 C 86 26, 83 38, 78 46 C 74 38, 67 36, 62 43 C 59 36, 54 36, 50 40 Z"
        fill="url(#batWingGrad)"
        stroke="#7e22ce"
        strokeWidth="1"
      />
      {/* Wing ribs right */}
      <path d="M 88 14 C 80 28, 74 40, 74 44" stroke="#a855f7" strokeWidth="0.8" strokeOpacity="0.7" />
      <path d="M 76 16 C 70 26, 66 38, 63 42" stroke="#a855f7" strokeWidth="0.8" strokeOpacity="0.7" />

      {/* Bat Head & Body */}
      <path
        d="M 44 26 L 42 16 L 46 22 L 50 20 L 54 22 L 58 16 L 56 26 C 60 30, 60 40, 56 50 C 53 55, 50 58, 50 58 C 50 58, 47 55, 44 50 C 40 40, 40 30, 44 26 Z"
        fill="url(#batBodyGrad)"
        stroke="#9333ea"
        strokeWidth="1.2"
      />

      {/* Glowing Evil Eyes */}
      <circle cx="47.5" cy="27" r="1.6" fill="#f59e0b" filter="drop-shadow(0 0 2px #f59e0b)" />
      <circle cx="52.5" cy="27" r="1.6" fill="#f59e0b" filter="drop-shadow(0 0 2px #f59e0b)" />
      <circle cx="47.5" cy="27" r="0.8" fill="#ef4444" />
      <circle cx="52.5" cy="27" r="0.8" fill="#ef4444" />

      {/* Fangs */}
      <path d="M 48 33 L 48.8 35.5 L 49.6 33" stroke="#f1f5f9" strokeWidth="0.8" fill="#ffffff" />
      <path d="M 50.4 33 L 51.2 35.5 L 52 33" stroke="#f1f5f9" strokeWidth="0.8" fill="#ffffff" />
    </svg>
  );
};

/**
 * Pumpkin Vector Asset (Labu Jack-o'-Lantern)
 * Carved pumpkin with evil glowing jagged eyes, toothy carved grin, and pumpkin ridges.
 */
export const PumpkinSvg: React.FC<SvgProps> = ({ 
  className = '', 
  size = 40,
  glow = true 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 10px rgba(249, 115, 22, 0.75))' } : undefined}
    >
      <defs>
        <radialGradient id="pumpkinGlowGrad" cx="50" cy="55" r="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb923c" />
          <stop offset="0.5" stopColor="#ea580c" />
          <stop offset="0.9" stopColor="#7c2d12" />
          <stop offset="1" stopColor="#431407" />
        </radialGradient>
        <linearGradient id="stemGrad" x1="50" y1="8" x2="54" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#65a30d" />
          <stop offset="0.7" stopColor="#365314" />
          <stop offset="1" stopColor="#1e3a10" />
        </linearGradient>
        <radialGradient id="fireCarve" cx="50" cy="55" r="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.4" stopColor="#f59e0b" />
          <stop offset="0.9" stopColor="#dc2626" />
          <stop offset="1" stopColor="#991b1b" />
        </radialGradient>
      </defs>

      {/* Stem */}
      <path
        d="M 48 25 C 47 18, 48 12, 55 9 C 56 12, 53 18, 54 25 Z"
        fill="url(#stemGrad)"
        stroke="#1a2e05"
        strokeWidth="1.2"
      />
      {/* Tendril leaf */}
      <path d="M 54 18 C 58 14, 63 18, 62 23 C 60 21, 57 21, 54 22" stroke="#84cc16" strokeWidth="1.2" fill="none" />

      {/* Pumpkin Outer Segments (Ridges) */}
      <ellipse cx="25" cy="56" rx="18" ry="30" fill="url(#pumpkinGlowGrad)" stroke="#451a03" strokeWidth="1.5" />
      <ellipse cx="75" cy="56" rx="18" ry="30" fill="url(#pumpkinGlowGrad)" stroke="#451a03" strokeWidth="1.5" />
      <ellipse cx="37" cy="57" rx="20" ry="33" fill="url(#pumpkinGlowGrad)" stroke="#451a03" strokeWidth="1.5" />
      <ellipse cx="63" cy="57" rx="20" ry="33" fill="url(#pumpkinGlowGrad)" stroke="#451a03" strokeWidth="1.5" />
      <ellipse cx="50" cy="58" rx="22" ry="34" fill="url(#pumpkinGlowGrad)" stroke="#7c2d12" strokeWidth="1.5" />

      {/* Carved Glowing Left Eye */}
      <path
        d="M 28 46 L 41 42 L 38 53 Z"
        fill="url(#fireCarve)"
        stroke="#451a03"
        strokeWidth="1.2"
      />
      {/* Carved Glowing Right Eye */}
      <path
        d="M 72 46 L 59 42 L 62 53 Z"
        fill="url(#fireCarve)"
        stroke="#451a03"
        strokeWidth="1.2"
      />

      {/* Carved Glowing Nose */}
      <path
        d="M 50 51 L 45 60 L 55 60 Z"
        fill="url(#fireCarve)"
        stroke="#451a03"
        strokeWidth="1"
      />

      {/* Carved Evil Toothy Mouth */}
      <path
        d="M 28 66 
           L 36 67 L 39 63 L 44 68 L 50 63 L 56 68 L 61 63 L 64 67 L 72 66 
           L 66 76 L 60 72 L 56 77 L 50 72 L 44 77 L 40 72 L 34 76 Z"
        fill="url(#fireCarve)"
        stroke="#451a03"
        strokeWidth="1.5"
      />
    </svg>
  );
};

/**
 * Skeleton Skull Vector Asset (Tengkorak Keramat)
 * Detailed skull with hollow glowing eye sockets, crack details, and eerie spectral aura.
 */
export const SkeletonSkullSvg: React.FC<SvgProps> = ({ 
  className = '', 
  size = 40,
  glow = true 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 10px rgba(129, 140, 248, 0.75))' } : undefined}
    >
      <defs>
        <radialGradient id="skullBoneGrad" cx="50" cy="40" r="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="0.65" stopColor="#cbd5e1" />
          <stop offset="0.9" stopColor="#64748b" />
          <stop offset="1" stopColor="#334155" />
        </radialGradient>
        <radialGradient id="eyeSocketGrad" cx="50" cy="50" r="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.4" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#020617" />
        </radialGradient>
      </defs>

      {/* Crossbones Behind */}
      <g stroke="#64748b" strokeWidth="5" strokeLinecap="round" opacity="0.65">
        <line x1="16" y1="16" x2="84" y2="84" />
        <line x1="84" y1="16" x2="16" y2="84" />
      </g>
      <g fill="#94a3b8" opacity="0.7">
        <circle cx="15" cy="14" r="5" />
        <circle cx="13" cy="20" r="4.5" />
        <circle cx="85" cy="14" r="5" />
        <circle cx="87" cy="20" r="4.5" />
        <circle cx="15" cy="86" r="5" />
        <circle cx="13" cy="80" r="4.5" />
        <circle cx="85" cy="86" r="5" />
        <circle cx="87" cy="80" r="4.5" />
      </g>

      {/* Cranium and Upper Jaw */}
      <path
        d="M 22 42 C 22 22, 34 10, 50 10 C 66 10, 78 22, 78 42 C 78 52, 74 60, 68 64 L 68 76 C 68 78, 66 80, 63 80 L 37 80 C 34 80, 32 78, 32 76 L 32 64 C 26 60, 22 52, 22 42 Z"
        fill="url(#skullBoneGrad)"
        stroke="#1e293b"
        strokeWidth="2"
      />

      {/* Cranium Crack Detail */}
      <path
        d="M 48 10 L 46 22 L 52 28 L 50 36"
        stroke="#475569"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left Eye Socket */}
      <path
        d="M 33 42 C 33 36, 42 34, 45 40 C 47 47, 43 56, 36 54 C 32 52, 33 46, 33 42 Z"
        fill="url(#eyeSocketGrad)"
        stroke="#0f172a"
        strokeWidth="1.5"
      />
      {/* Ghostly Blue Pupil Flame */}
      <circle cx="39" cy="45" r="2.5" fill="#38bdf8" filter="drop-shadow(0 0 3px #38bdf8)" />
      <circle cx="39" cy="45" r="1.2" fill="#ffffff" />

      {/* Right Eye Socket */}
      <path
        d="M 67 42 C 67 36, 58 34, 55 40 C 53 47, 57 56, 64 54 C 68 52, 67 46, 67 42 Z"
        fill="url(#eyeSocketGrad)"
        stroke="#0f172a"
        strokeWidth="1.5"
      />
      {/* Ghostly Blue Pupil Flame */}
      <circle cx="61" cy="45" r="2.5" fill="#38bdf8" filter="drop-shadow(0 0 3px #38bdf8)" />
      <circle cx="61" cy="45" r="1.2" fill="#ffffff" />

      {/* Nasal Cavity (Inverted Heart) */}
      <path
        d="M 50 54 L 46 64 C 47 66, 50 66, 50 66 C 50 66, 53 66, 54 64 Z"
        fill="#0f172a"
        stroke="#1e293b"
        strokeWidth="1"
      />

      {/* Cheekbone indents */}
      <path d="M 24 54 C 30 58, 32 66, 32 70" stroke="#64748b" strokeWidth="1.2" fill="none" />
      <path d="M 76 54 C 70 58, 68 66, 68 70" stroke="#64748b" strokeWidth="1.2" fill="none" />

      {/* Teeth Grid */}
      <g stroke="#334155" strokeWidth="1.2">
        <line x1="34" y1="72" x2="66" y2="72" />
        <line x1="40" y1="67" x2="40" y2="78" />
        <line x1="45" y1="67" x2="45" y2="78" />
        <line x1="50" y1="67" x2="50" y2="78" />
        <line x1="55" y1="67" x2="55" y2="78" />
        <line x1="60" y1="67" x2="60" y2="78" />
      </g>
    </svg>
  );
};

/**
 * Halloween Candy Vector Asset (Permen Mistis)
 * Wrapped candy with swirled glowing pattern and sparkles.
 */
export const HalloweenCandySvg: React.FC<SvgProps> = ({ 
  className = '', 
  size = 28 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.85))' }}
    >
      <defs>
        <linearGradient id="candyWrapGrad" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="0.4" stopColor="#ea580c" />
          <stop offset="0.8" stopColor="#c026d3" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="candyTailGrad" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>

      {/* Left Twist Tail */}
      <path
        d="M 32 36 L 10 20 C 14 32, 12 44, 8 50 L 30 46 Z"
        fill="url(#candyTailGrad)"
        stroke="#78350f"
        strokeWidth="1.2"
      />
      <path d="M 12 28 L 28 40" stroke="#fde047" strokeWidth="0.8" strokeOpacity="0.8" />

      {/* Right Twist Tail */}
      <path
        d="M 68 64 L 90 80 C 86 68, 88 56, 92 50 L 70 54 Z"
        fill="url(#candyTailGrad)"
        stroke="#78350f"
        strokeWidth="1.2"
      />
      <path d="M 88 72 L 72 60" stroke="#fde047" strokeWidth="0.8" strokeOpacity="0.8" />

      {/* Main Oval Candy Body */}
      <g transform="rotate(-35 50 50)">
        <ellipse cx="50" cy="50" rx="30" ry="20" fill="url(#candyWrapGrad)" stroke="#78350f" strokeWidth="1.5" />
        
        {/* Swirl Stripes */}
        <path d="M 32 35 C 38 42, 38 58, 32 65" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
        <path d="M 44 32 C 50 42, 50 58, 44 68" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 56 32 C 62 42, 62 58, 56 68" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
        <path d="M 68 35 C 74 42, 74 58, 68 65" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />

        {/* Gloss highlight */}
        <path d="M 34 38 Q 50 33 66 38" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.8" />
      </g>

      {/* Little magical sparkles */}
      <polygon points="50,14 52,20 58,22 52,24 50,30 48,24 42,22 48,20" fill="#fde047" />
      <polygon points="82,34 83,38 87,39 83,40 82,44 81,40 77,39 81,38" fill="#fde047" />
    </svg>
  );
};

/**
 * Ghost Vector Asset (Hantu Berbaju Putih)
 */
export const GhostSvg: React.FC<SvgProps> = ({ 
  className = '', 
  size = 40 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.65))' }}
    >
      <defs>
        <radialGradient id="ghostGrad" cx="50" cy="35" r="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#e0e7ff" />
          <stop offset="1" stopColor="#a5b4fc" />
        </radialGradient>
      </defs>
      
      {/* Ghost Flowing Sheet */}
      <path
        d="M 30 45 C 30 25, 40 12, 50 12 C 60 12, 70 25, 70 45 C 70 60, 78 68, 76 84 C 74 88, 68 82, 64 86 C 60 90, 56 82, 50 86 C 44 90, 40 82, 36 86 C 32 82, 26 88, 24 84 C 22 68, 30 60, 30 45 Z"
        fill="url(#ghostGrad)"
        stroke="#c7d2fe"
        strokeWidth="1.5"
      />

      {/* Ghost Arms */}
      <path d="M 30 50 C 22 52, 18 58, 20 62 C 22 64, 26 62, 30 58" fill="url(#ghostGrad)" stroke="#c7d2fe" strokeWidth="1" />
      <path d="M 70 50 C 78 52, 82 58, 80 62 C 78 64, 74 62, 70 58" fill="url(#ghostGrad)" stroke="#c7d2fe" strokeWidth="1" />

      {/* Hollow Eyes */}
      <ellipse cx="44" cy="40" rx="3.5" ry="5.5" fill="#1e1b4b" />
      <ellipse cx="56" cy="40" rx="3.5" ry="5.5" fill="#1e1b4b" />
      <circle cx="43" cy="38" r="1" fill="#ffffff" />
      <circle cx="55" cy="38" r="1" fill="#ffffff" />

      {/* O-shaped Spooky Mouth */}
      <ellipse cx="50" cy="52" rx="3.5" ry="5" fill="#1e1b4b" />
    </svg>
  );
};

/**
 * Headless Horseman Vector Asset
 */
export const HeadlessHorsemanSvg: React.FC<SvgProps> = ({ 
  className = '', 
  size = 64 
}) => {
  return (
    <svg
      width={size * 1.5}
      height={size}
      viewBox="0 0 150 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 12px rgba(234, 88, 12, 0.85))' }}
    >
      <defs>
        <linearGradient id="horseDark" x1="0" y1="0" x2="150" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e1b4b" />
          <stop offset="0.5" stopColor="#0f172a" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
      </defs>

      {/* Galloping Steed Silhouette */}
      <path
        d="M 20 85 C 30 75, 45 75, 60 70 C 70 65, 80 60, 95 62 C 105 55, 115 45, 130 35 C 135 40, 132 48, 125 55 C 135 60, 140 70, 145 80 L 138 82 C 132 75, 125 70, 115 72 C 105 75, 95 85, 85 92 L 75 92 C 78 85, 75 80, 70 78 C 55 82, 40 90, 20 92 Z"
        fill="url(#horseDark)"
        stroke="#475569"
        strokeWidth="1.2"
      />
      {/* Front Galloping Legs */}
      <path d="M 115 72 L 132 90 L 136 88" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
      <path d="M 105 75 L 120 95 L 125 93" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
      {/* Back Galloping Legs */}
      <path d="M 35 80 L 15 95" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
      <path d="M 45 78 L 28 92" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />

      {/* Galloping Cape & Rider Torso */}
      <path
        d="M 50 65 C 45 50, 48 35, 65 30 C 72 35, 76 48, 74 65 Z"
        fill="#3b0764"
        stroke="#7e22ce"
        strokeWidth="1.5"
      />
      {/* Billowing Cape */}
      <path
        d="M 48 35 C 30 30, 15 40, 5 45 C 15 55, 30 52, 46 50 Z"
        fill="#581c87"
        stroke="#9333ea"
        strokeWidth="1"
      />

      {/* Held Carved Pumpkin Head In Hand */}
      <g transform="translate(70, 10)">
        <PumpkinSvg size={34} glow={true} />
      </g>

      {/* Flaming Sword / Scythe */}
      <path
        d="M 68 45 L 98 15 L 100 17 L 72 48 Z"
        fill="#fbbf24"
        stroke="#ea580c"
        strokeWidth="1.2"
        filter="drop-shadow(0 0 6px #f59e0b)"
      />
    </svg>
  );
};
