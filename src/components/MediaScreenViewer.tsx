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
        className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between select-none"
      >
        {/* Top Control Bar */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Kembali ke Chat"
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-semibold hidden sm:inline">Kembali</span>
            </button>
            
            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                {media.type === 'image' && <ImageIcon size={16} />}
                {media.type === 'video' && <Video size={16} />}
                {media.type === 'audio' && <Music size={16} />}
                {(media.type === 'document' || media.type === 'file') && <FileText size={16} />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                  {media.name || 'File Media'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {media.size ? `${(media.size / 1024).toFixed(1)} KB` : ''} 
                  {media.duration ? ` • ${Math.round(media.duration)}s` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {media.type === 'image' && (
              <div className="hidden md:flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 mr-2">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-slate-400 font-mono px-2">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Putar 90°"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            )}

            <button
              onClick={handleCopyLink}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Salin Tautan Khusus"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
              <span className="hidden sm:inline">{copied ? 'Tersalin!' : 'Bagikan'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-lg shadow-blue-600/30"
              title="Download File"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Unduh</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="Tutup (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Content Viewer Area */}
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
                className="max-h-[82vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border border-slate-800"
              />
            </motion.div>
          )}

          {media.type === 'video' && (
            <div className="w-full max-w-4xl max-h-[82vh] flex items-center justify-center">
              <video
                src={media.url}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded-2xl shadow-2xl bg-black border border-slate-800"
              />
            </div>
          )}

          {media.type === 'audio' && (
            <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Music size={36} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white mb-1">{media.name}</h3>
                <p className="text-xs text-slate-400">Audio File • Durasi Maks. 2 Menit</p>
              </div>
              <audio
                src={media.url}
                controls
                autoPlay
                className="w-full"
              />
            </div>
          )}

          {(media.type === 'document' || media.type === 'file') && (
            <div className="w-full max-w-3xl max-h-[80vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
              <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-400" />
                  <span className="text-xs font-semibold text-white">{media.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {media.textContent ? `${media.textContent.length.toLocaleString()} karakter` : ''}
                </span>
              </div>
              <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed max-h-[65vh] whitespace-pre-wrap selection:bg-blue-600/40">
                {media.textContent || "Pratinjau isi dokumen tidak dapat dimuat langsung sebagai teks."}
              </div>
            </div>
          )}
        </main>

        {/* Footer info bar */}
        <footer className="h-10 px-4 md:px-8 border-t border-slate-850 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
          <span>TMPA Media Screen Viewer</span>
          <span className="truncate">{currentUrl}</span>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
