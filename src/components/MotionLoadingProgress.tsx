import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, Code2, Wrench, Monitor, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface MotionLoadingProgressProps {
  isFinalizing: boolean; // Set to true when the AI response has arrived from edge function
  onFinalizeComplete: () => void; // Called after 20s of "Render full code & preview" completes
  onStop?: () => void; // Cancellation callback
}

interface MotionStageConfig {
  id: string;
  label: string;
  duration: number; // Duration in seconds
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

// 1. Initial stage (run once, 10 seconds): Titik tiga
const INITIAL_STAGE: MotionStageConfig = {
  id: 'dots',
  label: 'Titik tiga',
  duration: 10
};

// 2. Loop cycle stages (repeats until AI responds)
const CYCLE_STAGES: MotionStageConfig[] = [
  {
    id: 'thinking_1',
    label: 'Thinking',
    duration: 30,
    icon: Brain
  },
  {
    id: 'generated_1',
    label: 'Generated code',
    duration: 40,
    icon: Code2
  },
  {
    id: 'thinking_2',
    label: 'Thinking',
    duration: 40,
    icon: Brain
  },
  {
    id: 'revisi',
    label: 'Revisi',
    duration: 60,
    icon: Wrench
  },
  {
    id: 'generated_2',
    label: 'Generated code',
    duration: 40,
    icon: Code2
  },
  {
    id: 'render_code',
    label: 'Render code',
    duration: 50,
    icon: Monitor
  }
];

// 3. Finalizing stage (when AI response received: 20 seconds before giving to user)
const FINALIZING_STAGE: MotionStageConfig = {
  id: 'render_full_preview',
  label: 'Render full code & preview',
  duration: 20,
  icon: Sparkles
};

export function MotionLoadingProgress({
  isFinalizing,
  onFinalizeComplete,
  onStop
}: MotionLoadingProgressProps) {
  // State: -1 = INITIAL_STAGE (Titik tiga: 10s)
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1);
  const [stageElapsed, setStageElapsed] = useState<number>(0);
  const [finalizingElapsed, setFinalizingElapsed] = useState<number>(0);

  const finalizeTriggeredRef = useRef<boolean>(false);

  // Active Stage configuration
  const activeStage: MotionStageConfig = isFinalizing 
    ? FINALIZING_STAGE 
    : (currentStageIndex === -1 ? INITIAL_STAGE : CYCLE_STAGES[currentStageIndex]);

  // Main Timer Effect (durasi presisi di latar belakang)
  useEffect(() => {
    const timer = setInterval(() => {
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
          // Tahap 1: Titik tiga (10s)
          if (next >= INITIAL_STAGE.duration) {
            setCurrentStageIndex(0); // Pindah ke Thinking (30s)
            return 0;
          }
        } else {
          // Tahap Loop Siklus: Thinking (30s) -> Code (40s) -> Thinking (40s) -> Revisi (60s) -> Code (40s) -> Render (50s)
          const curStage = CYCLE_STAGES[currentStageIndex];
          if (next >= curStage.duration) {
            setCurrentStageIndex((currentStageIndex + 1) % CYCLE_STAGES.length);
            return 0;
          }
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStageIndex, isFinalizing, onFinalizeComplete]);

  // Reset saat beralih ke finalizing
  useEffect(() => {
    if (isFinalizing) {
      setFinalizingElapsed(0);
      finalizeTriggeredRef.current = false;
    }
  }, [isFinalizing]);

  const StageIcon = activeStage.icon;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="py-4 sm:py-5 px-4 sm:px-8 flex w-full"
    >
      <div className="max-w-3xl mx-auto flex w-full items-center gap-2 pl-1 sm:pl-2">
        {activeStage.id === 'dots' && !isFinalizing ? (
          /* Titik tiga pas awal user kirim (muncul selama 10 detik persis seperti chat biasa) */
          <div className="flex items-center gap-1.5 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          /* Tahap berikutnya: Cuma icon dan tulisan minimalis + flash sweep setiap 5 detik (NO CARD, NO DETIK) */
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage.id}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2 }}
              className="relative inline-flex items-center gap-2 py-0.5 overflow-hidden select-none"
            >
              {StageIcon && (
                <StageIcon 
                  size={16} 
                  className={
                    isFinalizing 
                      ? "text-blue-600 dark:text-blue-400 shrink-0 animate-pulse" 
                      : "text-blue-600 dark:text-blue-400 shrink-0"
                  } 
                />
              )}

              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tracking-wide">
                {activeStage.label}
              </span>

              {/* Efek Flash Light Sweep yang melewati tulisan dan ikon setiap 5 detik */}
              <div 
                className="pointer-events-none absolute inset-0 -skew-x-12 animate-flash-sweep"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.85) 50%, transparent 100%)',
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

export default MotionLoadingProgress;
