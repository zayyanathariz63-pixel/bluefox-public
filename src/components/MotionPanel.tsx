import React, { useState, useEffect, useRef } from 'react';
import { 
  X, RotateCcw, Copy, Check, Download, Maximize2, Minimize2, 
  Code2, Eye, Sparkles, Play, Monitor, Smartphone, Square, 
  FileCode
} from 'lucide-react';
import { sanitizeMotionHtml } from '../lib/motion';
import { MotionDownloadModal } from './MotionDownloadModal';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

interface MotionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  motionCode: string;
  onUpdateCode?: (newCode: string) => void;
  title?: string;
  isFloating?: boolean;
}

type AspectRatioType = 'responsive' | '16-9' | '1-1' | '9-16' | '4-3';

export function MotionPanel({
  isOpen,
  onClose,
  motionCode,
  onUpdateCode,
  title = 'Bluefox Motion Preview',
}: MotionPanelProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  // Sesuai permintaan: Hanya ada 2 tab (Pratinjau & Editor Kode, Tab Preset dihapus)
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [editableCode, setEditableCode] = useState<string>(motionCode || '');
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('responsive');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync editable code when incoming motionCode changes
  useEffect(() => {
    if (motionCode) {
      setEditableCode(motionCode);
      setIframeKey(prev => prev + 1);
    }
  }, [motionCode]);

  if (!isOpen) return null;

  const handleReplay = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(editableCode || motionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleApplyCodeEdit = () => {
    if (onUpdateCode) {
      onUpdateCode(editableCode);
    }
    setIframeKey(prev => prev + 1);
    setActiveTab('preview');
  };

  const currentCode = editableCode || motionCode;
  const sanitizedSrcDoc = sanitizeMotionHtml(currentCode, 'dark');

  // Aspect ratio container styles
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '16-9':
        return 'aspect-video max-w-4xl max-h-[85vh] w-full';
      case '1-1':
        return 'aspect-square max-w-[540px] max-h-[85vh] w-full';
      case '9-16':
        return 'aspect-[9/16] max-w-[360px] max-h-[85vh] w-full';
      case '4-3':
        return 'aspect-[4/3] max-w-2xl max-h-[85vh] w-full';
      case 'responsive':
      default:
        return 'w-full h-full';
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 z-40 shadow-2xl",
          isFullscreen
            ? "fixed inset-0 z-50 w-screen h-screen border-none"
            : "w-full lg:w-[500px] xl:w-[560px] h-full shrink-0"
        )}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {isId ? 'Render animasi langsung via <iframe> srcdoc' : 'Live iframe animation renderer'}
              </p>
            </div>
          </div>

          {/* Header Right Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleReplay}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={isId ? 'Putar Ulang Animasi' : 'Replay Animation'}
              aria-label="Replay"
            >
              <RotateCcw size={15} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? (isId ? 'Keluar Fullscreen' : 'Exit Fullscreen') : (isId ? 'Layar Penuh' : 'Fullscreen')}
              aria-label="Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer ml-1"
              title={isId ? 'Tutup Panel' : 'Close Panel'}
              aria-label="Close"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Preview & Code - Preset dan Selector Warna Dihapus) */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs gap-2 flex-wrap select-none">
          {/* 2 Main Mode Tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-xs",
                activeTab === 'preview'
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Eye size={13} />
              <span>{isId ? 'Pratinjau' : 'Preview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-xs",
                activeTab === 'code'
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Code2 size={13} />
              <span>{isId ? 'Editor Kode' : 'Code'}</span>
            </button>
          </div>

          {/* Viewport Aspect Ratio Selector */}
          {activeTab === 'preview' && (
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-slate-500">
              <button
                onClick={() => setAspectRatio('responsive')}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer",
                  aspectRatio === 'responsive' ? "bg-white dark:bg-slate-900 text-blue-600 shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                )}
                title="Responsive (100%)"
              >
                <Monitor size={12} />
              </button>
              <button
                onClick={() => setAspectRatio('16-9')}
                className={cn(
                  "px-1 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer",
                  aspectRatio === '16-9' ? "bg-white dark:bg-slate-900 text-blue-600 font-bold shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                )}
                title="16:9 Video Aspect"
              >
                16:9
              </button>
              <button
                onClick={() => setAspectRatio('1-1')}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer",
                  aspectRatio === '1-1' ? "bg-white dark:bg-slate-900 text-blue-600 shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                )}
                title="1:1 Square"
              >
                <Square size={11} />
              </button>
              <button
                onClick={() => setAspectRatio('9-16')}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer",
                  aspectRatio === '9-16' ? "bg-white dark:bg-slate-900 text-blue-600 shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                )}
                title="9:16 Shorts / Story"
              >
                <Smartphone size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* TAB 1: LIVE INTERACTIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div 
              className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden relative transition-colors bg-slate-950 group cursor-pointer"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? (isId ? 'Klik untuk perkecil' : 'Click to minimize') : (isId ? 'Klik untuk melihat layar penuh' : 'Click for fullscreen')}
            >
              {/* Petunjuk Layar Penuh pada Hover */}
              <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
                {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isFullscreen ? (isId ? 'Perkecil' : 'Minimize') : (isId ? 'Layar Penuh' : 'Fullscreen')}</span>
              </div>

              {/* Viewport Box Container */}
              <div 
                className={cn(
                  "relative flex items-center justify-center shadow-2xl transition-all duration-300 rounded-xl overflow-hidden border border-slate-800",
                  getAspectRatioClasses()
                )}
                onClick={(e) => {
                  // Prevent nested click stopping
                }}
              >
                <iframe
                  ref={iframeRef}
                  key={iframeKey}
                  srcDoc={sanitizedSrcDoc}
                  title="Bluefox Motion Canvas Preview"
                  className="w-full h-full border-0 rounded-xl pointer-events-auto"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CODE EDITOR */}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-mono text-xs">
              <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 select-none">
                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <FileCode size={13} className="text-blue-400" />
                  <span>HTML / CSS / JS Standalone</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApplyCodeEdit}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Play size={11} />
                    <span>{isId ? 'Terapkan & Render' : 'Apply & Run'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={editableCode}
                onChange={(e) => setEditableCode(e.target.value)}
                placeholder="<!-- Masukkan kode HTML, CSS, JS lengkap di sini -->"
                className="flex-1 p-4 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 overflow-auto whitespace-pre selection:bg-blue-900"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs select-none">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-medium font-mono">
              [BLUEFOX_MOTION]
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer text-xs font-medium"
              title={isId ? 'Salin Kode Lengkap' : 'Copy Full Code'}
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-emerald-600 font-semibold">{isId ? 'Tersalin' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>{isId ? 'Salin Kode' : 'Copy Code'}</span>
                </>
              )}
            </button>

            {/* Tombol Unduh: Membuka Popup Pilihan Unduhan (MP4, Code, Code & MP4) */}
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors cursor-pointer text-xs font-semibold shadow-xs"
              title={isId ? 'Pilihan Unduh Animasi' : 'Download Animation Options'}
            >
              <Download size={12} />
              <span>{isId ? 'Unduh' : 'Download'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Popup Pilihan Download (1. Download mp4, 2. Download code, 3. Download code & mp4) */}
      <MotionDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        motionCode={currentCode}
        iframeRef={iframeRef}
      />
    </>
  );
}

export default MotionPanel;
