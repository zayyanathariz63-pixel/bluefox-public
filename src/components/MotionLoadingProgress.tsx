import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Code2, Brain, RefreshCw, Wrench, Play, 
  CheckCircle2, Monitor, Loader2, Square, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

export interface MotionLoadingProgressProps {
  isFinalizing: boolean; // Set to true when the AI response has arrived from edge function
  onFinalizeComplete: () => void; // Called after 20s of "Render full code & preview" completes
  onStop?: () => void; // Cancellation callback
}

interface MotionStageConfig {
  id: string;
  label: string;
  displayLabel: string;
  duration: number; // Duration in seconds
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

// 1. Initial stage (run once, 10 seconds)
const INITIAL_STAGE: MotionStageConfig = {
  id: 'dots',
  label: 'Titik tiga',
  displayLabel: 'Titik tiga',
  duration: 10,
  description: 'Menginisialisasi Bluefox Motion Engine...',
  icon: Loader2,
  color: 'from-blue-600 to-cyan-500'
};

// 2. Loop cycle stages (repeats until AI responds)
const CYCLE_STAGES: MotionStageConfig[] = [
  {
    id: 'thinking_1',
    label: 'Thinking',
    displayLabel: 'Thinking',
    duration: 30,
    description: 'Menganalisis prompt visual & merancang struktur DOM...',
    icon: Brain,
    color: 'from-indigo-600 to-blue-500'
  },
  {
    id: 'generated_1',
    label: 'Generated code',
    displayLabel: 'Generated code',
    duration: 40,
    description: 'Menulis elemen HTML standar, CSS keyframes, SVG, dan JavaScript...',
    icon: Code2,
    color: 'from-blue-600 to-cyan-500'
  },
  {
    id: 'thinking_2',
    label: 'Thinking',
    displayLabel: 'Thinking',
    duration: 40,
    description: 'Mengoptimalkan performa animasi, rendering loop & responsiveness...',
    icon: Brain,
    color: 'from-indigo-600 to-blue-500'
  },
  {
    id: 'revisi',
    label: 'Revisi',
    displayLabel: 'Revisi',
    duration: 60,
    description: 'Memvalidasi sintaks, memastikan bebas canvas, dan menyempurnakan transisi...',
    icon: Wrench,
    color: 'from-amber-600 to-rose-500'
  },
  {
    id: 'generated_2',
    label: 'Generated code',
    displayLabel: 'Generated code',
    duration: 40,
    description: 'Merakit kembali blok kode animasi mandiri [BLUEFOX_MOTION]...',
    icon: Code2,
    color: 'from-cyan-600 to-blue-500'
  },
  {
    id: 'render_code',
    label: 'Render code',
    displayLabel: 'Render code',
    duration: 50,
    description: 'Memverifikasi isolasi sandbox iframe & kompatibilitas peramban...',
    icon: Monitor,
    color: 'from-blue-600 to-teal-500'
  }
];

// 3. Finalizing stage (when AI response received: 20 seconds before giving to user)
const FINALIZING_STAGE: MotionStageConfig = {
  id: 'render_full_preview',
  label: 'Render full code & preview',
  displayLabel: 'Render full code & preview',
  duration: 20,
  description: 'Menyusun visualisasi interaktif & menyuntikkan ke panel preview...',
  icon: Sparkles,
  color: 'from-emerald-500 via-teal-500 to-cyan-500'
};

export function MotionLoadingProgress({
  isFinalizing,
  onFinalizeComplete,
  onStop
}: MotionLoadingProgressProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  // State
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1); // -1 = INITIAL_STAGE (Titik tiga)
  const [stageElapsed, setStageElapsed] = useState<number>(0);
  const [totalElapsed, setTotalElapsed] = useState<number>(0);
  const [finalizingElapsed, setFinalizingElapsed] = useState<number>(0);

  const finalizeTriggeredRef = useRef<boolean>(false);

  // Active Stage configuration
  const activeStage: MotionStageConfig = isFinalizing 
    ? FINALIZING_STAGE 
    : (currentStageIndex === -1 ? INITIAL_STAGE : CYCLE_STAGES[currentStageIndex]);

  // Main Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTotalElapsed(prev => prev + 1);

      if (isFinalizing) {
        setFinalizingElapsed(prev => {
          const next = prev + 1;
          if (next >= FINALIZING_STAGE.duration && !finalizeTriggeredRef.current) {
            finalizeTriggeredRef.current = true;
            setTimeout(() => {
              onFinalizeComplete();
            }, 100);
          }
          return next;
        });
        return;
      }

      setStageElapsed(prev => {
        const next = prev + 1;

        if (currentStageIndex === -1) {
          // In INITIAL_STAGE (Titik tiga: 10s)
          if (next >= INITIAL_STAGE.duration) {
            setCurrentStageIndex(0); // Move to CYCLE_STAGES[0] (Thinking: 30s)
            return 0;
          }
        } else {
          // In CYCLE_STAGES
          const curStage = CYCLE_STAGES[currentStageIndex];
          if (next >= curStage.duration) {
            // Move to next stage in cycle (loops back to 0 without repeating Titik tiga)
            setCurrentStageIndex((currentStageIndex + 1) % CYCLE_STAGES.length);
            return 0;
          }
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStageIndex, isFinalizing, onFinalizeComplete]);

  // Handle sudden switch to finalizing
  useEffect(() => {
    if (isFinalizing) {
      setFinalizingElapsed(0);
      finalizeTriggeredRef.current = false;
    }
  }, [isFinalizing]);

  const currentDuration = activeStage.duration;
  const currentElapsed = isFinalizing ? finalizingElapsed : stageElapsed;
  const currentRemaining = Math.max(0, currentDuration - currentElapsed);
  const progressPercent = Math.min(100, Math.round((currentElapsed / currentDuration) * 100));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="py-3 sm:py-4 px-4 sm:px-8 flex w-full"
    >
      <div className="max-w-3xl mx-auto w-full">
        <div className="relative rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-b from-white via-blue-50/20 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 shadow-md overflow-hidden p-4 sm:p-5">
          
          {/* Glowing Top Ambient Line */}
          <div className={cn(
            "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
            activeStage.color,
            "animate-pulse"
          )} />

          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Bluefox Motion Engine
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    @motion
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFinalizing 
                    ? (isId ? 'Respons diterima! Tahap finalisasi rendering visual' : 'Response received! Finalizing visual render') 
                    : (isId ? 'Sedang memproses animasi visual mandiri di Edge Function' : 'Processing standalone visual motion at Edge Function')}
                </p>
              </div>
            </div>

            {onStop && (
              <button
                type="button"
                onClick={onStop}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-800"
                title="Hentikan proses"
              >
                <Square size={11} className="fill-current text-rose-500" />
                <span>Batal</span>
              </button>
            )}
          </div>

          {/* Active Stage Banner Card */}
          <div className={cn(
            "p-3.5 sm:p-4 rounded-xl border transition-all mb-3.5",
            isFinalizing 
              ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-sm"
              : "bg-slate-50 dark:bg-slate-850/80 border-slate-200/90 dark:border-slate-800"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Stage Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                  isFinalizing 
                    ? "bg-emerald-600 text-white animate-bounce" 
                    : (activeStage.id === 'dots' 
                        ? "bg-blue-600 text-white" 
                        : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white")
                )}>
                  {activeStage.id === 'dots' ? (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <activeStage.icon size={20} className={isFinalizing ? "animate-pulse" : "animate-spin-slow"} />
                  )}
                </div>

                {/* Stage Text */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {activeStage.displayLabel}
                    </h4>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                      {currentRemaining}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                    {activeStage.description}
                  </p>
                </div>
              </div>

              {/* Countdown Gauge */}
              <div className="text-right shrink-0 hidden sm:block">
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                  {currentElapsed}s / {currentDuration}s
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Total: {totalElapsed}s
                </div>
              </div>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000 bg-gradient-to-r",
                  activeStage.color
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Pipeline Tracker Steps Pills */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Alur Pipeline Bluefox Motion:</span>
              <span className="font-mono text-[10px]">
                {isFinalizing ? 'Tahap Akhir (Finalisasi)' : `Tahap ${currentStageIndex === -1 ? 'Awal' : (currentStageIndex + 1)}/6`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {/* Step 1: Titik tiga */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === -1 && !isFinalizing
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">1. Titik tiga</div>
                <div className="text-[9px] font-mono text-slate-400">10s</div>
              </div>

              {/* Step 2: Thinking */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === 0 && !isFinalizing
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">2. Thinking</div>
                <div className="text-[9px] font-mono text-slate-400">30s</div>
              </div>

              {/* Step 3: Generated code */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === 1 && !isFinalizing
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">3. Code</div>
                <div className="text-[9px] font-mono text-slate-400">40s</div>
              </div>

              {/* Step 4: Thinking */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === 2 && !isFinalizing
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">4. Thinking</div>
                <div className="text-[9px] font-mono text-slate-400">40s</div>
              </div>

              {/* Step 5: Revisi */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === 3 && !isFinalizing
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/60 font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">5. Revisi</div>
                <div className="text-[9px] font-mono text-slate-400">60s</div>
              </div>

              {/* Step 6: Generated code */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === 4 && !isFinalizing
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">6. Code</div>
                <div className="text-[9px] font-mono text-slate-400">40s</div>
              </div>

              {/* Step 7: Render code */}
              <div className={cn(
                "p-1.5 rounded-lg border text-center transition-all",
                currentStageIndex === 5 && !isFinalizing
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-950/60 font-bold text-teal-700 dark:text-teal-300 ring-1 ring-teal-400 shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 dark:text-slate-400"
              )}>
                <div className="text-[10px] truncate">7. Render</div>
                <div className="text-[9px] font-mono text-slate-400">50s</div>
              </div>
            </div>

            {/* Special Finalizing Banner */}
            {isFinalizing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2.5 p-2 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/15 to-cyan-500/10 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-500 animate-pulse" />
                  <span className="font-semibold">
                    Rander full code & preview aktif ({currentRemaining}s tersisa)
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 font-bold">
                  Tahap Penutup
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default MotionLoadingProgress;
