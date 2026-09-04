import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2, Check, ZoomIn, ZoomOut, RotateCw, FileText, Music, Video, Image as ImageIcon, ArrowLeft, ExternalLink } from 'lucide-react';
import { MediaAttachment } from '../types';

interface MediaScreenViewerProps {
  media: MediaAttachment | null;
  onClose: () => void;
}

export function MediaScreenViewer({ media, onClose }: MediaScreenViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [media?.url]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!media) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : `https://bluefox.tmpa.my.id/screen-${media.id || 'media'}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    if (!media.url) return;
    const a = document.createElement('a');
    a.href = media.url;
    a.download = media.name || `bluefox-media-${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-white bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:20px_20px] flex flex-col justify-between select-none text-slate-900 overflow-hidden"
      >
        {/* Top Control Bar - Bright, Clean & Modern */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between z-10 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-xl text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 font-medium text-xs active:scale-95"
              title="Kembali ke Chat"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Kembali</span>
            </button>
            
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                {media.type === 'image' && <ImageIcon size={18} />}
                {media.type === 'video' && <Video size={18} />}
                {media.type === 'audio' && <Music size={18} />}
                {(media.type === 'document' || media.type === 'file') && <FileText size={18} />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                  {media.name || 'File Media'}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {media.size ? `${(media.size / 1024).toFixed(1)} KB` : ''} 
                  {media.duration ? ` • ${Math.round(media.duration)} detik` : ''}
                  {media.type === 'audio' ? ' • Audio Viewer' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons - Bright, High Contrast */}
          <div className="flex items-center gap-2">
            {media.type === 'image' && (
              <div className="hidden md:flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-xs mr-2">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-slate-600 font-mono px-2">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
                  title="Putar 90°"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            )}

            <button
              onClick={handleCopyLink}
              className="p-2 sm:px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-200 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold active:scale-95"
              title="Salin Tautan Khusus"
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
              <span className="hidden sm:inline">{copied ? 'Tersalin!' : 'Bagikan'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="p-2 sm:px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-blue-500/25 active:scale-95"
              title="Download File"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Unduh</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors cursor-pointer ml-1 active:scale-95"
              title="Tutup (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Content Viewer Area - Clean White Grid Canvas */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto relative">
          {media.type === 'image' && (
            <motion.div
              style={{
                scale: zoom,
                rotate: rotation,
                transition: 'transform 0.15s ease-out'
              }}
              className="max-w-full max-h-full flex items-center justify-center"
            >
              <img
                src={media.url}
                alt={media.name || 'Fullscreen Image'}
                className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-slate-200 bg-white"
              />
            </motion.div>
          )}

          {media.type === 'video' && (
            <div className="w-full max-w-4xl max-h-[82vh] flex items-center justify-center">
              <video
                src={media.url}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded-2xl shadow-2xl bg-black border border-slate-300"
              />
            </div>
          )}

          {media.type === 'audio' && (
            <motion.div 
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg bg-white/95 border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 flex flex-col items-center gap-6 backdrop-blur-md"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-blue-50 border-2 border-blue-200 text-blue-600 flex items-center justify-center shadow-md">
                  <Music size={42} className={isPlayingAudio ? "animate-pulse" : ""} />
                </div>
                {/* Waveform indicator bars */}
                <div className="absolute -bottom-2 inset-x-0 flex items-center justify-center gap-1">
                  {[4, 10, 16, 8, 14, 6, 12, 18, 9, 15].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: isPlayingAudio ? [h, h * 1.5, Math.max(3, h * 0.4), h] : 6,
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        delay: i * 0.08,
                      }}
                      className="w-1 bg-blue-600 rounded-full"
                    />
                  ))}
                </div>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{media.name}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {media.duration ? `Durasi: ${Math.round(media.duration)} detik` : 'Format Audio Terdukung'} • Maks. 2 Menit
                </p>
              </div>

              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-inner">
                <audio
                  src={media.url}
                  controls
                  autoPlay
                  onPlay={() => setIsPlayingAudio(true)}
                  onPause={() => setIsPlayingAudio(false)}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="w-full h-11"
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Audio siap diputar & dianalisis oleh AI</span>
              </div>
            </motion.div>
          )}

          {(media.type === 'document' || media.type === 'file') && (
            <div className="w-full max-w-3xl max-h-[80vh] bg-white border border-slate-200 rounded-3xl shadow-xl flex flex-col overflow-hidden text-slate-900">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">{media.name}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {media.textContent ? `${media.textContent.length.toLocaleString()} karakter` : ''}
                </span>
              </div>
              <div className="p-6 overflow-y-auto font-mono text-xs text-slate-800 leading-relaxed max-h-[65vh] whitespace-pre-wrap selection:bg-blue-100 bg-slate-50/40">
                {media.textContent || "Pratinjau isi dokumen tidak dapat dimuat langsung sebagai teks."}
              </div>
            </div>
          )}
        </main>

        {/* Footer info bar - Bright & Clean */}
        <footer className="h-10 px-4 md:px-8 border-t border-slate-200 bg-white/90 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0 shadow-xs">
          <span className="font-semibold text-slate-700">TMPA Media Screen Viewer</span>
          <span className="truncate max-w-[200px] sm:max-w-md">{currentUrl}</span>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
