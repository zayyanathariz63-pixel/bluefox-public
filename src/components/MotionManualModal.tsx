import React, { useState, useEffect } from 'react';
import { 
  X, Play, Code2, Sparkles, Check, AlertCircle, 
  Clipboard, FileCode, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { MOTION_PRESETS, MotionPreset } from '../lib/motion';
import { useLanguage } from '../lib/i18n';

interface MotionManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitManualCode: (code: string, note?: string) => void;
}

interface DetectedCodeInfo {
  isValid: boolean;
  type: string;
  hasCanvas: boolean;
  hasHtml: boolean;
  hasSvg: boolean;
  hasStyle: boolean;
  hasScript: boolean;
  suggestedTitle?: string;
  charCount: number;
}

export function MotionManualModal({
  isOpen,
  onClose,
  onSubmitManualCode
}: MotionManualModalProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [code, setCode] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [detectedInfo, setDetectedInfo] = useState<DetectedCodeInfo | null>(null);
  const [justPasted, setJustPasted] = useState<boolean>(false);

  // Auto-detect code whenever code changes
  useEffect(() => {
    if (!code || !code.trim()) {
      setDetectedInfo(null);
      return;
    }

    const trimmed = code.trim();
    const lower = trimmed.toLowerCase();

    const hasCanvas = lower.includes('<canvas');
    const hasHtml = lower.includes('<html') || lower.includes('<!doctype html') || lower.includes('<div') || lower.includes('<body');
    const hasSvg = lower.includes('<svg');
    const hasStyle = lower.includes('<style') || lower.includes('@keyframes');
    const hasScript = lower.includes('<script');

    // Extract potential title from <title> tag or comments
    let suggestedTitle: string | undefined;
    const titleMatch = trimmed.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      suggestedTitle = titleMatch[1].trim();
    } else {
      const commentMatch = trimmed.match(/<!--\s*([A-Za-z0-9\s_-]{3,40})\s*-->/);
      if (commentMatch && commentMatch[1]) {
        suggestedTitle = commentMatch[1].trim();
      }
    }

    let type = 'Kode HTML & Animasi';
    if (hasSvg && !hasHtml) {
      type = 'Animasi SVG Mandiri';
    } else if (hasHtml && hasStyle && hasScript) {
      type = 'HTML5 Komplit (CSS + JS Animasi)';
    } else if (hasHtml && hasStyle) {
      type = 'HTML5 + CSS Keyframes Animasi';
    } else if (hasScript && !hasStyle) {
      type = 'JavaScript DOM Animasi';
    }

    const isValid = (hasHtml || hasSvg || hasStyle || hasScript) && trimmed.length > 10;

    setDetectedInfo({
      isValid,
      type,
      hasCanvas,
      hasHtml,
      hasSvg,
      hasStyle,
      hasScript,
      suggestedTitle,
      charCount: trimmed.length
    });

    if (suggestedTitle && !note) {
      setNote(suggestedTitle);
    }
  }, [code, note]);

  if (!isOpen) return null;

  const handleCleanAndSetCode = (rawCode: string) => {
    let clean = rawCode.trim();
    // Auto-strip markdown code blocks if pasted from chat or markdown
    if (clean.startsWith('```html')) {
      clean = clean.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    }
    // Also remove any accidental [BLUEFOX_MOTION] tags
    clean = clean.replace(/\[BLUEFOX_MOTION\]/gi, '').replace(/\[\/BLUEFOX_MOTION\]/gi, '').trim();

    setCode(clean);
    setError(null);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          handleCleanAndSetCode(text);
          setJustPasted(true);
          setTimeout(() => setJustPasted(false), 2000);
          return;
        }
      }
      setError(isId ? 'Clipboard kosong atau izin akses ditolak browser.' : 'Clipboard is empty or permission denied.');
    } catch {
      setError(isId ? 'Gagal membaca clipboard secara otomatis. Silakan tekan Ctrl+V di kotak kode.' : 'Failed to read clipboard automatically. Please press Ctrl+V in the box.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(isId ? 'Harap tempel atau masukkan kode animasi terlebih dahulu.' : 'Please paste or enter animation code first.');
      return;
    }
    setError(null);
    onSubmitManualCode(code.trim(), note.trim());
    setCode('');
    setNote('');
    onClose();
  };

  const handleUsePreset = (preset: MotionPreset) => {
    handleCleanAndSetCode(preset.code);
    setNote(preset.title);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Code2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {isId ? 'Input Kode Manual' : 'Manual Code Motion Mode'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  @motion
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isId ? 'Tempel kode & sistem akan mendeteksi otomatis lalu merender ke iframe.' : 'Paste code & system auto-detects it to render directly into the iframe.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto gap-3.5 sm:gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tombol Tempel Cepat & Deteksi Otomatis */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {isId ? 'Deteksi Otomatis: ' : 'Auto Detection: '}
                </span>
                {isId ? 'Salin kode dari clipboard atau ketik di bawah.' : 'Copy code from clipboard or write below.'}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              {justPasted ? (
                <>
                  <Check size={13} className="text-emerald-300" />
                  <span>{isId ? 'Berhasil Ditempel!' : 'Pasted!'}</span>
                </>
              ) : (
                <>
                  <Clipboard size={13} />
                  <span>{isId ? 'Tempel dari Clipboard' : 'Paste from Clipboard'}</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
              {isId ? 'Atau Pilih Contoh Animasi Siap Pakai:' : 'Or Select a Ready-to-Use Motion Preset:'}
            </label>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {MOTION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleUsePreset(p)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles size={11} className="text-blue-500" />
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Title/Note */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
              {isId ? 'Judul / Label Animasi:' : 'Animation Title / Label:'}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isId ? 'Contoh: Lingkaran Denyut Neon Pulse' : 'e.g. Neon Pulse Circle Animation'}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Code Textarea with Auto-Detection Feedback */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileCode size={13} className="text-blue-500" />
                <span>{isId ? 'Kotak Kode (HTML, CSS, SVG, JS):' : 'Code Box (HTML, CSS, SVG, JS):'}</span>
              </label>

              {detectedInfo && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  {detectedInfo.isValid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 size={11} />
                      <span>{detectedInfo.type} ({detectedInfo.charCount} chars)</span>
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium">
                      {isId ? 'Menunggu format kode HTML/SVG...' : 'Waiting for HTML/SVG code...'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {detectedInfo?.hasCanvas && (
              <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
                <AlertTriangle size={13} className="shrink-0" />
                <span>
                  {isId 
                    ? 'Catatan: Kode menggunakan HTML Canvas. Bluefox Motion merekomendasikan HTML standar, SVG, atau CSS keyframes untuk performa rendering terbaik.'
                    : 'Note: Code uses HTML Canvas. Standard HTML, SVG, or CSS keyframes are recommended for best performance.'}
                </span>
              </div>
            )}

            <textarea
              value={code}
              onChange={(e) => handleCleanAndSetCode(e.target.value)}
              placeholder="<!-- Tempel kode HTML, CSS (<style>), dan JS (<script>) di sini -->&#10;<!DOCTYPE html>&#10;<html>&#10;<head>&#10;  <style>&#10;    .circle { width: 100px; height: 100px; background: #3498db; border-radius: 50%; animation: pulse 2s infinite; }&#10;    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.5); } 100% { transform: scale(1); } }&#10;  </style>&#10;</head>&#10;<body>&#10;  <div class=&quot;circle&quot;></div>&#10;</body>&#10;</html>"
              className="w-full flex-1 p-3.5 text-xs font-mono leading-relaxed rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y whitespace-pre selection:bg-blue-900 min-h-[190px]"
              spellCheck={false}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-400 hidden sm:block">
              {isId ? 'Render langsung ke iframe preview (RENDER_MOTION)' : 'Direct iframe renderer (RENDER_MOTION)'}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {isId ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={!code.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play size={13} />
                <span>{isId ? 'Render Animasi Sekarang' : 'Render Motion Now'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
export default MotionManualModal;
