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

function GrandTheftBluefoxLogoSmall() {
  return (
    <svg
      viewBox="0 0 210 122"
      className="w-[104px] sm:w-[132px] h-auto select-none shrink-0"
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
        strokeWidth="8"
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
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[80] w-screen h-[100dvh] flex flex-col overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(180deg, #FFB458 0%, #FF9B55 34%, #7B208F 68%, #3B146B 100%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Top Section: Logo + 1/3 or Progress Status + Centered Mission Title */}
      <header className="px-4 sm:px-6 pt-3 pb-3 shrink-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <GrandTheftBluefoxLogoSmall />

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              {topRightStatus}

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="w-10 h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
              >
                {muted ? (
                  <VolumeX size={18} strokeWidth={2.4} />
                ) : (
                  <Volume2 size={18} strokeWidth={2.4} />
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="w-10 h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={19} strokeWidth={2.5} />
              </button>
            </div>

            {subStatus && <div className="flex items-center gap-1.5">{subStatus}</div>}
          </div>
        </div>

        {/* Centered Mission Title Capsule (Coral Pink #F36A78 -> Warm Yellow #FFB458) */}
        <div className="flex justify-center">
          <div
            className="px-7 sm:px-10 py-1.5 rounded-full shadow-md border border-[#111827]/15"
            style={{
              background: 'linear-gradient(90deg, #F36A78 0%, #FFB458 100%)',
            }}
          >
            <h2
              id={titleId}
              className="text-base sm:text-lg font-extrabold tracking-tight text-[#111827] whitespace-nowrap"
            >
              {title}
            </h2>
          </div>
        </div>
      </header>

      {/* Middle Zone: Layar Mini Game (fits cleanly inside middle viewport band) */}
      <main className="flex-1 min-h-0 w-full flex flex-col justify-center bg-[#140A26]/95 border-y border-[#111827]/20 shadow-inner overflow-hidden">
        {children}
      </main>

      {/* Bottom Zone: Conditional Controller (Magenta #C9349B & Deep Violet #3B146B) */}
      {controller ? (
        <footer className="px-3 sm:px-6 py-3 sm:py-4 shrink-0 flex items-center justify-center">
          <div
            className="w-full max-w-3xl rounded-3xl p-3 sm:p-4 shadow-xl border border-white/15"
            style={{
              background: 'linear-gradient(180deg, #C9349B 0%, #3B146B 100%)',
            }}
          >
            {controller}
          </div>
        </footer>
      ) : (
        <div className="h-4 sm:h-6 shrink-0" aria-hidden="true" />
      )}
    </motion.div>
  );
}
