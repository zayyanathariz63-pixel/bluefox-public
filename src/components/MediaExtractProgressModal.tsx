import { motion, AnimatePresence } from 'motion/react';
import { Rocket } from 'lucide-react';

interface MediaExtractProgressModalProps {
  isOpen: boolean;
  progress: number;
  status: string;
  subStatus?: string;
  fileName?: string;
}

export function MediaExtractProgressModal({
  isOpen,
  progress,
  status,
  subStatus,
  fileName,
}: MediaExtractProgressModalProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
          {/* Latar belakang abu-abu */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-500/75 dark:bg-slate-800/80 backdrop-blur-sm"
          />

          {/* Popup di bagian tengah dengan roket terbang & progress bar di bawahnya */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden"
          >
            {/* Area Roket Terbang */}
            <div className="relative h-28 flex items-center justify-center mb-4">
              {/* Garis angin/kecepatan vertikal halus */}
              <motion.div
                animate={{ y: [0, 18], opacity: [0.2, 0.7, 0] }}
                transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                className="absolute left-1/3 top-4 w-0.5 h-6 rounded-full bg-slate-300 dark:bg-slate-600"
              />
              <motion.div
                animate={{ y: [0, 22], opacity: [0.2, 0.6, 0] }}
                transition={{ repeat: Infinity, duration: 0.55, delay: 0.25, ease: 'linear' }}
                className="absolute right-1/3 top-6 w-0.5 h-5 rounded-full bg-slate-300 dark:bg-slate-600"
              />

              {/* Roket Terbang */}
              <motion.div
                animate={{
                  y: [-5, 5, -5],
                  rotate: [-2, 2, -2],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.4,
                  ease: 'easeInOut',
                }}
                className="relative flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                  <Rocket size={34} className="-rotate-45" />
                </div>
                {/* Ekor pendorong roket */}
                <motion.div
                  animate={{
                    scaleY: [0.85, 1.35, 0.85],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.35,
                    ease: 'easeInOut',
                  }}
                  className="w-3 h-4 mt-1 rounded-b-full bg-gradient-to-b from-amber-400 via-orange-500 to-transparent origin-top"
                />
              </motion.div>
            </div>

            {/* Keterangan Status */}
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {status || 'Mengekstrak Media...'}
            </h3>
            {fileName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                {fileName}
              </p>
            )}

            {/* Bar Progres di bawah roket */}
            <div className="mt-5">
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700">
                <motion.div
                  className="h-full bg-blue-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${clampedProgress}%` }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 text-xs font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400 truncate text-[11px]">
                  {subStatus || 'Memproses di perangkat...'}
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  {clampedProgress}%
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
