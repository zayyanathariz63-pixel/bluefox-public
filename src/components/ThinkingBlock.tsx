import { useState, useEffect } from 'react';
import { Brain, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ReasoningEffortLevel } from '../lib/reasoning';

interface ThinkingBlockProps {
  thinking: string;
  isThinkingComplete: boolean;
  reasoningEffort?: ReasoningEffortLevel;
}

export function ThinkingBlock({
  thinking,
  isThinkingComplete,
  reasoningEffort,
}: ThinkingBlockProps) {
  // Buka secara otomatis saat AI sedang aktif berpikir, dan dapat dilipat/dibuka oleh user
  const [isExpanded, setIsExpanded] = useState(!isThinkingComplete);

  // Jika sedang aktif berpikir (streaming), pastikan terbuka agar user melihat prosesnya
  useEffect(() => {
    if (!isThinkingComplete) {
      setIsExpanded(true);
    }
  }, [isThinkingComplete]);

  if (!thinking) return null;

  const getEffortBadge = () => {
    if (!reasoningEffort || reasoningEffort === 'none') return null;

    if (reasoningEffort === 'high') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
          Smart Select: High
        </span>
      );
    }
    if (reasoningEffort === 'medium') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          Smart Select: Medium
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
        Smart Select: Low
      </span>
    );
  };

  return (
    <div className="w-full my-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 shadow-xs overflow-hidden transition-all">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-100/60 dark:hover:bg-slate-850/60 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              !isThinkingComplete
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-300 animate-pulse'
                : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Brain size={14} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {!isThinkingComplete ? 'Smart Select sedang berpikir...' : 'Proses Berpikir (Smart Select)'}
            </span>
            {getEffortBadge()}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
          {!isThinkingComplete ? (
            <Loader2 size={13} className="animate-spin text-purple-500" />
          ) : (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              {isExpanded ? 'Sembunyikan' : 'Lihat proses'}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-white/70 dark:bg-slate-950/40 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="border-l-2 border-purple-400/80 dark:border-purple-500/80 pl-3 text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed whitespace-pre-wrap select-text">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                >
                  {thinking}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
