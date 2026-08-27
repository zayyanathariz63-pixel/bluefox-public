import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ExternalLink, X, Sparkles, Search, ShieldCheck } from 'lucide-react';
import { SearchSource } from '../types';
import { sanitizeHtml } from '../lib/search';
import { useLanguage } from '../lib/i18n';

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
  const { lang, t } = useLanguage();
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
        <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            id="sourcesOverlay"
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity z-[998]"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            ref={sheetRef}
            id="sourcesSheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bottom-sheet relative w-full sm:max-w-xl max-h-[75vh] flex flex-col bg-white border-t sm:border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl z-[999] overflow-hidden text-slate-900 app-clean-grid"
          >
            {/* Header with Drag Handle */}
            <div className="sheet-header pt-3 pb-3 px-4 border-b border-slate-200 text-center relative bg-white/95 backdrop-blur-sm">
              <div className="drag-handle w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2.5" />
              
              <div className="flex items-center justify-center gap-2">
                <Globe size={16} className="text-blue-600" />
                <h3 className="m-0 text-sm font-bold text-slate-900">
                  {t('sourcesTitle')} ({sources.length})
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full font-mono border ${
                    isTavily
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isTavily ? (
                    <>
                      <Sparkles size={11} className="text-blue-600" />
                      <span>Tavily AI</span>
                    </>
                  ) : (
                    <>
                      <Search size={11} className="text-amber-600" />
                      <span>DuckDuckGo</span>
                    </>
                  )}
                </span>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="btn-close absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Sheet Body with Source Items */}
            <div className="sheet-body flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/50" id="sourcesList">
              {sources && sources.length > 0 ? (
                sources.map((item, index) => {
                  const domain = extractDomain(item.url);
                  const sanitizedTitle = sanitizeHtml(item.title);
                  const sanitizedSnippet = sanitizeHtml(item.snippet);
                  const sanitizedUrl = sanitizeHtml(item.url);

                  return (
                    <div
                      key={item.id || `source-item-${index}`}
                      className="source-item p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col gap-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Globe size={13} className="text-slate-400 shrink-0" />
                          <span className="text-xs font-semibold text-slate-600 truncate font-mono">
                            {domain}
                          </span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 shadow-xs cursor-pointer"
                        >
                          <span>{t('openWebsite')}</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      <h4 className="source-title text-[13px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        {sanitizedTitle || item.title}
                      </h4>

                      {item.snippet && (
                        <p className="source-snippet text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {sanitizedSnippet || item.snippet}
                        </p>
                      )}

                      <div className="source-url text-[11px] text-slate-400 truncate flex items-center gap-1 pt-1.5 border-t border-slate-100">
                        <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{sanitizedUrl || item.url}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Globe size={32} className="mx-auto mb-2 opacity-40 text-blue-500" />
                  <p className="text-xs font-medium">{t('noSourcesAvailable')}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
