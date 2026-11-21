export function TopiGtb6Svg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 44"
      fill="none"
      className={className}
      role="img"
      aria-label="Topi GTB 6"
    >
      <defs>
        <linearGradient id="gtbCapCrown" x1="12" y1="6" x2="50" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B146B" />
          <stop offset="55%" stopColor="#7B208F" />
          <stop offset="100%" stopColor="#C9349B" />
        </linearGradient>
        <linearGradient id="gtbCapBrim" x1="10" y1="26" x2="60" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F36A78" />
          <stop offset="55%" stopColor="#FF9B55" />
          <stop offset="100%" stopColor="#FFB458" />
        </linearGradient>
      </defs>

      {/* Top button */}
      <circle cx="31" cy="7" r="2.6" fill="#FFB458" stroke="#111827" strokeWidth="1.5" />

      {/* Main cap crown */}
      <path
        d="M12 28C12 15.8 20.5 8 31 8C41.5 8 50 15.8 50 28H12Z"
        fill="url(#gtbCapCrown)"
        stroke="#111827"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* Crown seam highlight */}
      <path
        d="M31 8C27.5 14 26.5 21 27 28"
        stroke="#FFB458"
        strokeOpacity="0.45"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* GTB 6 Front Patch */}
      <rect
        x="21"
        y="15"
        width="20"
        height="10"
        rx="3"
        fill="#111827"
        stroke="#FFB458"
        strokeWidth="1.4"
      />
      <text
        x="31"
        y="22.5"
        textAnchor="middle"
        fill="#FFB458"
        fontSize="7"
        fontWeight="900"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        GTB6
      </text>

      {/* Angled Sunset Visor Brim */}
      <path
        d="M11 28.5C22 25.5 41 25.5 55.5 31.5C58 32.5 58 35.8 54.5 36.2C40 37.8 23 34.5 11 31.5C9.5 31.1 9.5 28.9 11 28.5Z"
        fill="url(#gtbCapBrim)"
        stroke="#111827"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
