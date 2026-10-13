import React, { useState, useEffect, useRef } from 'react';
import { 
  X, RotateCcw, Copy, Check, Download, Maximize2, Minimize2, 
  Code2, Eye, Sparkles, Play, Monitor, Smartphone, Square, 
  FileCode, Palette, Edit3
} from 'lucide-react';
import { sanitizeMotionHtml, MOTION_PRESETS, MotionPreset } from '../lib/motion';
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
type BgMode = 'dark' | 'black' | 'light' | 'checker';

export function MotionPanel({
  isOpen,
  onClose,
  motionCode,
  onUpdateCode,
  title = 'Bluefox Motion Preview',
}: MotionPanelProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'presets'>('preview');
  const [editableCode, setEditableCode] = useState<string>(motionCode || '');
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('responsive');
  const [bgMode, setBgMode] = useState<BgMode>('dark');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
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

  const handleDownloadHtml = () => {
    const code = editableCode || motionCode;
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bluefox-motion-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApplyCodeEdit = () => {
    if (onUpdateCode) {
      onUpdateCode(editableCode);
    }
    setIframeKey(prev => prev + 1);
    setActiveTab('preview');
  };

  const handleSelectPreset = (preset: MotionPreset) => {
    setEditableCode(preset.code);
    if (onUpdateCode) {
      onUpdateCode(preset.code);
    }
    setIframeKey(prev => prev + 1);
    setActiveTab('preview');
  };

  const currentCode = editableCode || motionCode;
  const sanitizedSrcDoc = sanitizeMotionHtml(currentCode, bgMode === 'light' ? 'light' : 'dark');

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

  // Background canvas styling
  const getBgStyle = () => {
    switch (bgMode) {
      case 'black':
        return 'bg-black';
      case 'light':
        return 'bg-slate-100';
      case 'checker':
        return 'bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:20px_20px] bg-[#0f172a]';
      case 'dark':
      default:
        return 'bg-slate-950';
    }
  };

  return (
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

      {/* Navigation Sub-Tabs & Viewport Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs gap-2 flex-wrap">
        {/* Main Mode Tabs */}
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

          <button
            onClick={() => setActiveTab('presets')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer text-xs",
              activeTab === 'presets'
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Sparkles size={13} />
            <span>{isId ? 'Preset' : 'Presets'}</span>
          </button>
        </div>

        {/* Viewport & Canvas Controls when on Preview Tab */}
        {activeTab === 'preview' && (
          <div className="flex items-center gap-1.5">
            {/* Aspect Ratio Selector */}
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

            {/* Background Canvas Mode */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-slate-500">
              <button
                onClick={() => setBgMode('dark')}
                className={cn(
                  "w-4 h-4 rounded-full bg-slate-900 border border-slate-700 transition-transform cursor-pointer",
                  bgMode === 'dark' && "ring-2 ring-blue-500 scale-110"
                )}
                title="Dark BG"
              />
              <button
                onClick={() => setBgMode('black')}
                className={cn(
                  "w-4 h-4 rounded-full bg-black border border-slate-800 transition-transform cursor-pointer",
                  bgMode === 'black' && "ring-2 ring-blue-500 scale-110"
                )}
                title="Pitch Black BG"
              />
              <button
                onClick={() => setBgMode('light')}
                className={cn(
                  "w-4 h-4 rounded-full bg-white border border-slate-300 transition-transform cursor-pointer",
                  bgMode === 'light' && "ring-2 ring-blue-500 scale-110"
                )}
                title="Light BG"
              />
              <button
                onClick={() => setBgMode('checker')}
                className={cn(
                  "w-4 h-4 rounded-full bg-slate-700 border border-slate-500 transition-transform cursor-pointer flex items-center justify-center text-[8px] font-bold text-white",
                  bgMode === 'checker' && "ring-2 ring-blue-500 scale-110"
                )}
                title="Checkerboard BG"
              >
                ▦
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* TAB 1: LIVE IFRAME PREVIEW */}
        {activeTab === 'preview' && (
          <div className={cn("flex-1 flex items-center justify-center p-3 overflow-auto", getBgStyle())}>
            <div className={cn("relative transition-all duration-200 overflow-hidden rounded-xl shadow-lg border border-slate-800/60 bg-transparent flex items-center justify-center", getAspectRatioClasses())}>
              <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={sanitizedSrcDoc}
                title="Bluefox Motion Animation Frame"
                className="w-full h-full border-0 rounded-xl"
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

        {/* TAB 3: PRESET GALLERY */}
        {activeTab === 'presets' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/60">
            <div className="mb-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isId ? 'Preset Animasi Siap Pakai' : 'Ready-to-use Motion Presets'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isId
                  ? 'Pilih animasi untuk diuji secara instan di iframe preview atau diedit di tab kode.'
                  : 'Select an animation to test instantly in the iframe preview.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {MOTION_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-xs flex flex-col justify-between gap-3 group"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-500" />
                      <span>{preset.title}</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {preset.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400">HTML + CSS Keyframes</span>
                    <button
                      onClick={() => handleSelectPreset(preset)}
                      className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Play size={11} />
                      <span>{isId ? 'Gunakan & Render' : 'Load Preset'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium font-mono">
            [BLUEFOX_MOTION] Active
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

          <button
            onClick={handleDownloadHtml}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors cursor-pointer text-xs font-semibold shadow-xs"
            title={isId ? 'Unduh sebagai file .html' : 'Download .html file'}
          >
            <Download size={12} />
            <span>{isId ? 'Unduh HTML' : 'Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
