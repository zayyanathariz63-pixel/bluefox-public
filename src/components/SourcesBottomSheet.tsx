import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ExternalLink, X, Sparkles, Search, ShieldCheck } from 'lucide-react';
import { SearchSource } from '../types';
import { sanitizeHtml } from '../lib/search';

interface SourcesBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: SearchSource[];
  engine?: 'tavily' | 'duckduckgo' | string;
  query?: string;
}

export function SourcesBottomSheet({
  isOpen,
  onClose,
  sources = [],
  engine = 'tavily',
  query,
}: SourcesBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Helper to extract clean domain name from URL
  const extractDomain = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return urlStr;
    }
  };

  const isTavily = engine === 'tavily';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center">
          {/* Overlay Latar Belakang (PRD 4.2 & 4.3: rgba(0, 0, 0, 0.4)) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            id="sourcesOverlay"
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity z-[998]"
          />

          {/* Bottom Sheet Modal Setengah Layar (PRD 4.2: max-height: 60vh) */}
          <motion.div
            ref={sheetRef}
            id="sourcesSheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="bottom-sheet relative w-full sm:max-w-xl max-h-[60vh] flex flex-col bg-white dark:bg-[#11131a] border-t sm:border border-slate-200 dark:border-neutral-800 rounded-t-[20px] sm:rounded-[20px] shadow-2xl shadow-black/30 dark:shadow-black/70 z-[999] overflow-hidden text-slate-900 dark:text-neutral-100"
          >
            {/* Header with Drag Handle */}
            <div className="sheet-header pt-3 pb-3 px-4 border-b border-slate-200 dark:border-neutral-800 text-center relative bg-slate-50/80 dark:bg-[#161822]/80 backdrop-blur-sm">
              {/* Garis Penarik (Drag Handle) */}
              <div className="drag-handle w-[40px] h-[4px] bg-[#cbd5e1] dark:bg-neutral-600 rounded-[2px] mx-auto mb-2" />
              
              <div className="flex items-center justify-center gap-2">
                <h3 className="m-0 text-[15px] font-semibold text-[#0f172a] dark:text-white">
                  Sumber Informasi
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono border ${
                    isTavily
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/25'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25'
                  }`}
                >
                  {isTavily ? (
                    <>
                      <Sparkles size={10} className="text-cyan-500 dark:text-cyan-400" />
                      <span>Tavily</span>
                    </>
                  ) : (
                    <>
                      <Search size={10} className="text-amber-500 dark:text-amber-400" />
                      <span>DuckDuckGo</span>
                    </>
                  )}
                </span>
              </div>

              {/* Close Button (&times;) */}
              <button
                onClick={onClose}
                className="btn-close absolute right-4 top-3 text-[20px] leading-none text-[#64748b] hover:text-slate-900 dark:hover:text-white transition-colors p-1 rounded-lg"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>

            {/* Sheet Body with Source Items (PRD 4.3) */}
            <div className="sheet-body flex-1 overflow-y-auto p-4 flex flex-col gap-3" id="sourcesList">
              {sources && sources.length > 0 ? (
                sources.map((item, index) => {
                  const domain = extractDomain(item.url);
                  const sanitizedTitle = sanitizeHtml(item.title);
                  const sanitizedSnippet = sanitizeHtml(item.snippet);
                  const sanitizedUrl = sanitizeHtml(item.url);

                  return (
                    <a
                      key={item.id || `source-item-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-item p-3 rounded-[10px] border border-[#e2e8f0] dark:border-neutral-800 bg-[#f8fafc] dark:bg-[#161824] hover:border-[#0284c7] dark:hover:border-blue-500 transition-colors flex flex-col no-underline text-inherit group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="source-title text-[13px] font-semibold text-[#0369a1] dark:text-blue-400 group-hover:underline line-clamp-1">
                          {sanitizedTitle || item.title}
                        </span>
                        <ExternalLink size={12} className="text-slate-400 dark:text-neutral-500 group-hover:text-[#0369a1] dark:group-hover:text-blue-400 shrink-0 transition-colors" />
                      </div>

                      {item.snippet && (
                        <p className="source-snippet text-[12px] text-[#475569] dark:text-neutral-300 leading-[1.4] mb-1.5 line-clamp-3">
                          {sanitizedSnippet || item.snippet}
                        </p>
                      )}

                      <div className="source-url text-[11px] text-[#94a3b8] dark:text-neutral-500 break-all truncate flex items-center gap-1">
                        <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{sanitizedUrl || item.url}</span>
                      </div>
                    </a>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[#94a3b8]">
                  <Globe size={28} className="mx-auto mb-1 opacity-50" />
                  <p className="text-xs font-medium">Tidak ada data sumber tersedia.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
