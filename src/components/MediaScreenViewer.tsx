import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Share2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Music,
  Video,
  ArrowLeft,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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

  // Khusus Video: 2 pilihan mode tampilan di layar penuh ('video' | 'gambar')
  const [videoViewMode, setVideoViewMode] = useState<'video' | 'gambar'>('video');
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);

  const extractedFrames = media?.extractedFrames || [];
  const isImageViewActive =
    media?.type === 'image' || (media?.type === 'video' && videoViewMode === 'gambar');

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setVideoViewMode('video');
    setSelectedFrameIdx(0);
  }, [media?.id, media?.url]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [videoViewMode, selectedFrameIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (media?.type === 'video' && videoViewMode === 'gambar' && extractedFrames.length > 1) {
        if (e.key === 'ArrowLeft') {
          setSelectedFrameIdx((prev) => (prev > 0 ? prev - 1 : extractedFrames.length - 1));
        } else if (e.key === 'ArrowRight') {
          setSelectedFrameIdx((prev) => (prev < extractedFrames.length - 1 ? prev + 1 : 0));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, media?.type, videoViewMode, extractedFrames.length]);

  if (!media) return null;

  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://bluefox.tmpa.my.id/screen-${media.id || 'media'}`;

  const activeFrame = extractedFrames[selectedFrameIdx] || null;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    if (media.type === 'video' && videoViewMode === 'gambar' && activeFrame) {
      const a = document.createElement('a');
      a.href = activeFrame.dataUrl;
      a.download = activeFrame.nama_file_gambar || `frame_${selectedFrameIdx + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

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
        <header className="h-16 px-4 md:px-8 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between gap-2 z-10 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-xl text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 font-medium text-xs active:scale-95 shrink-0"
              title="Kembali ke Chat"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Kembali</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block shrink-0" />

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                {media.type === 'image' && <ImageIcon size={18} />}
                {media.type === 'video' && (videoViewMode === 'gambar' ? <ImageIcon size={18} /> : <Video size={18} />)}
                {media.type === 'audio' && <Music size={18} />}
                {(media.type === 'document' || media.type === 'file') && <FileText size={18} />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900 truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                  {media.name || 'File Media'}
                </span>
                <span className="text-[11px] text-slate-500 font-mono truncate">
                  {media.size ? `${(media.size / 1024).toFixed(1)} KB` : ''}
                  {media.duration ? ` • ${Math.round(media.duration)} detik` : ''}
                  {media.type === 'audio' ? ' • Audio Viewer' : ''}
                  {media.type === 'video' && extractedFrames.length > 0 ? ` • ${extractedFrames.length} frame` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Selection Khusus Video: Pilihan Video atau Gambar */}
          {media.type === 'video' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setVideoViewMode('video')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  videoViewMode === 'video'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video size={14} />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => setVideoViewMode('gambar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  videoViewMode === 'gambar'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon size={14} />
                <span>Gambar</span>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isImageViewActive && (media.type === 'image' || activeFrame) && (
              <div className="hidden md:flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-xs mr-1">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-slate-600 font-mono px-2">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
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
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-auto relative">
          {media.type === 'image' && (
            <motion.div
              style={{
                scale: zoom,
                rotate: rotation,
                transition: 'transform 0.15s ease-out',
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

          {/* Mode Video di Fullscreen */}
          {media.type === 'video' && videoViewMode === 'video' && (
            <div className="w-full max-w-4xl max-h-[82vh] flex items-center justify-center">
              <video
                src={media.url}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded-2xl shadow-2xl bg-black border border-slate-300"
              />
            </div>
          )}

          {/* Mode Gambar (Frame Hasil Ekstraksi Video) di Fullscreen */}
          {media.type === 'video' && videoViewMode === 'gambar' && (
            <div className="w-full max-w-5xl flex flex-col items-center justify-center gap-4 h-full">
              {extractedFrames.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md shadow-sm">
                  <ImageIcon size={36} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-800">
                    Belum ada gambar frame yang terekstrak
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Video ini tidak memiliki data frame hasil ekstraksi 1 FPS.
                  </p>
                </div>
              ) : (
                <>
                  {/* Main Active Frame Viewer */}
                  <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
                    {extractedFrames.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFrameIdx((prev) =>
                            prev > 0 ? prev - 1 : extractedFrames.length - 1
                          )
                        }
                        className="absolute left-1 sm:left-4 z-10 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 border border-slate-200 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                        title="Frame Sebelumnya"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}

                    <motion.div
                      style={{
                        scale: zoom,
                        rotate: rotation,
                        transition: 'transform 0.15s ease-out',
                      }}
                      className="max-w-full max-h-full flex items-center justify-center"
                    >
                      <img
                        src={activeFrame?.dataUrl}
                        alt={activeFrame?.nama_file_gambar || 'Frame Video'}
                        className="max-h-[58vh] sm:max-h-[62vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl border border-slate-200 bg-white"
                      />
                    </motion.div>

                    {extractedFrames.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFrameIdx((prev) =>
                            prev < extractedFrames.length - 1 ? prev + 1 : 0
                          )
                        }
                        className="absolute right-1 sm:right-4 z-10 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 border border-slate-200 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                        title="Frame Berikutnya"
                      >
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>

                  {/* Active Frame Metadata Strip */}
                  {activeFrame && (
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-slate-700 bg-white/95 border border-slate-200 rounded-xl px-4 py-1.5 shadow-xs">
                      <span className="font-semibold text-slate-900">
                        {selectedFrameIdx + 1} / {extractedFrames.length}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Detik {activeFrame.timestamp}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeFrame.nama_file_gambar}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeFrame.ukuran_kb} KB</span>
                    </div>
                  )}

                  {/* Thumbnail Strip per Detik */}
                  <div className="w-full max-w-4xl bg-white/95 border border-slate-200 rounded-2xl p-2 shadow-sm overflow-x-auto flex items-center gap-2 shrink-0">
                    {extractedFrames.map((frame, idx) => (
                      <button
                        key={frame.nama_file_gambar}
                        type="button"
                        onClick={() => setSelectedFrameIdx(idx)}
                        className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          idx === selectedFrameIdx
                            ? 'border-blue-600 ring-2 ring-blue-100'
                            : 'border-slate-200 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={frame.dataUrl}
                          alt={frame.nama_file_gambar}
                          className="w-20 h-12 object-cover bg-slate-900"
                        />
                        <span className="block text-[10px] font-mono text-slate-700 bg-white px-1 py-0.5 text-center border-t border-slate-100">
                          {frame.timestamp}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
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
                  <Music size={42} className={isPlayingAudio ? 'animate-pulse' : ''} />
                </div>
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
                  {media.duration ? `Durasi: ${Math.round(media.duration)} detik` : 'Format Audio Terdukung'} • Maks. 3 Menit
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
                <span>Audio siap diputar &amp; dianalisis oleh AI</span>
              </div>
            </motion.div>
          )}

          {(media.type === 'document' || media.type === 'file') && (
            <div className="w-full max-w-3xl max-h-[80vh] bg-white border border-slate-200 rounded-3xl shadow-xl flex flex-col overflow-hidden text-slate-900">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      media.name.toLowerCase().endsWith('.pdf')
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <FileText size={15} />
                  </div>
                  <span className="text-xs font-bold text-slate-900 truncate">{media.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {media.pageCount && (
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      {media.pageCount} Halaman
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 font-mono">
                    {media.textContent ? `${media.textContent.length.toLocaleString()} karakter` : ''}
                  </span>
                </div>
              </div>
              <div className="p-6 overflow-y-auto font-mono text-xs text-slate-800 leading-relaxed max-h-[65vh] whitespace-pre-wrap selection:bg-blue-100 bg-slate-50/40">
                {media.textContent || 'Pratinjau isi dokumen tidak dapat dimuat langsung sebagai teks.'}
              </div>
            </div>
          )}
        </main>

        {/* Footer info bar */}
        <footer className="h-10 px-4 md:px-8 border-t border-slate-200 bg-white/90 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0 shadow-xs">
          <span className="font-semibold text-slate-700">Bluefox Media Screen Viewer</span>
          <span className="truncate max-w-[200px] sm:max-w-md">{currentUrl}</span>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
