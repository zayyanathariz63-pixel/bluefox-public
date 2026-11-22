import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, X } from 'lucide-react';

interface ViceCityGameFrameProps {
  title: string;
  titleId: string;
  topRightStatus: ReactNode;
  subStatus?: ReactNode;
  muted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
  controller?: ReactNode;
}

function GrandTheftBluefoxLogoCompact() {
  return (
    <svg
      viewBox="0 0 210 122"
      className="w-[68px] sm:w-[96px] h-auto select-none shrink-0"
      role="img"
      aria-label="grand theft bluefox"
    >
      <defs>
        <linearGradient id="gtbGameFrameFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFB458" />
          <stop offset="55%" stopColor="#FF9B55" />
          <stop offset="100%" stopColor="#F36A78" />
        </linearGradient>
      </defs>
      <g
        style={{
          fontFamily: '"Archivo Black", "Plus Jakarta Sans", sans-serif',
          fontWeight: 900,
        }}
        fill="url(#gtbGameFrameFill)"
        stroke="#111827"
        strokeWidth="8.5"
        strokeLinejoin="round"
        paintOrder="stroke fill"
        letterSpacing="-1.5"
      >
        <text x="6" y="39" fontSize="42">
          grand
        </text>
        <text x="26" y="76" fontSize="41">
          theft
        </text>
        <text x="6" y="112" fontSize="40">
          bluefox
        </text>
      </g>
    </svg>
  );
}

export function ViceCityGameFrame({
  title,
  titleId,
  topRightStatus,
  subStatus,
  muted,
  onToggleMute,
  onClose,
  closeLabel,
  children,
  controller,
}: ViceCityGameFrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Horizontal / Landscape Popup Container ("Tidur / Mendatar") */}
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col max-h-[92dvh]"
        style={{
          background:
            'linear-gradient(180deg, #FFB458 0%, #FF9B55 24%, #7B208F 76%, #3B146B 100%)',
        }}
      >
        {/* Top Horizontal Bar: Logo (Left) + Judul Mission (Center) + 1/3 or Progress & Controls (Right) */}
        <header className="px-3 sm:px-5 py-2 sm:py-2.5 shrink-0 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <GrandTheftBluefoxLogoCompact />

            {/* Centered Mission Title Capsule (Coral Pink #F36A78 -> Warm Yellow #FFB458) */}
            <div className="flex-1 flex justify-center min-w-0">
              <div
                className="px-4 sm:px-8 py-1 sm:py-1.5 rounded-full shadow-md border border-[#111827]/15 max-w-full"
                style={{
                  background: 'linear-gradient(90deg, #F36A78 0%, #FFB458 100%)',
                }}
              >
                <h2
                  id={titleId}
                  className="text-xs sm:text-base font-extrabold tracking-tight text-[#111827] whitespace-nowrap truncate"
                >
                  {title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {topRightStatus}

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
              >
                {muted ? (
                  <VolumeX size={17} strokeWidth={2.4} />
                ) : (
                  <Volume2 size={17} strokeWidth={2.4} />
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {subStatus && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {subStatus}
            </div>
          )}
        </header>

        {/* Horizontal Middle Section: Side-by-side Game Screen + Conditional Right Controller */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row items-stretch">
          {/* Layar Mini Game */}
          <main className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-[#140A26]/95 border-y border-[#111827]/20">
            {children}
          </main>

          {/* Optional Controller Dock (Escape from Prison only, Magenta #C9349B & Deep Violet #3B146B) */}
          {controller && (
            <aside className="sm:w-[220px] md:w-[248px] shrink-0 p-2 sm:p-3 flex items-center justify-center bg-gradient-to-b from-[#7B208F] to-[#3B146B] sm:border-l sm:border-y border-[#111827]/20">
              <div
                className="w-full h-full rounded-2xl p-2.5 sm:p-3 shadow-lg border border-white/15 flex flex-col justify-center"
                style={{
                  background: 'linear-gradient(180deg, #C9349B 0%, #3B146B 100%)',
                }}
              >
                {controller}
              </div>
            </aside>
          )}
        </div>

        {/* Bottom 4-Color Vice City Bar */}
        <div
          className="h-3 sm:h-4 shrink-0"
          style={{
            background: 'linear-gradient(90deg, #7B208F 0%, #3B146B 100%)',
          }}
          aria-hidden="true"
        />
      </motion.div>
    </motion.div>
  );
}
