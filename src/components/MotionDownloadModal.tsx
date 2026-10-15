import React, { useState } from 'react';
import { X, Film, FileCode, Layers, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadMotionCode, recordAndDownloadMotionMp4 } from '../lib/motionRecorder';
import { useLanguage } from '../lib/i18n';

interface MotionDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  motionCode: string;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export function MotionDownloadModal({
  isOpen,
  onClose,
  motionCode,
  iframeRef
}: MotionDownloadModalProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Opsi 1: Download MP4
  const handleDownloadMp4 = async () => {
    try {
      setError(null);
      setIsRecording(true);
      setProgress(5);
      setStatusMessage(isId ? 'Merekam video animasi MP4...' : 'Recording MP4 animation...');

      await recordAndDownloadMotionMp4(iframeRef?.current || null, 3.5, (pct) => {
        setProgress(pct);
      });

      setStatusMessage(isId ? 'Selesai! Berkas MP4 tersimpan.' : 'Done! MP4 file downloaded.');
      setTimeout(() => {
        setIsRecording(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Download MP4 error:', err);
      setError(err?.message || (isId ? 'Gagal merekam video MP4' : 'Failed to record MP4 video'));
      setIsRecording(false);
    }
  };

  // Opsi 2: Download Code
  const handleDownloadCode = () => {
    try {
      setError(null);
      downloadMotionCode(motionCode);
      onClose();
    } catch (err: any) {
      setError(err?.message || (isId ? 'Gagal mengunduh kode' : 'Failed to download code'));
    }
  };

  // Opsi 3: Download Code & MP4
  const handleDownloadBundle = async () => {
    try {
      setError(null);
      setIsRecording(true);
      setProgress(10);
      setStatusMessage(isId ? 'Mengunduh kode & merekam MP4...' : 'Downloading code & recording MP4...');

      // 1. Download kode segera
      downloadMotionCode(motionCode);

      // 2. Rekam dan unduh MP4
      await recordAndDownloadMotionMp4(iframeRef?.current || null, 3.5, (pct) => {
        setProgress(pct);
      });

      setStatusMessage(isId ? 'Selesai! Berkas kode & MP4 telah diunduh.' : 'Done! Code & MP4 files downloaded.');
      setTimeout(() => {
        setIsRecording(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Download bundle error:', err);
      setError(err?.message || (isId ? 'Gagal mengunduh paket berkas' : 'Failed to download bundle'));
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isId ? 'Pilihan Unduh Animasi' : 'Download Options'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isId ? 'Pilih format berkas yang ingin disimpan' : 'Choose format to save to your device'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isRecording}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>

          {/* Feedback & Error */}
          {error && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isRecording && (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs">
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 font-semibold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin text-blue-600 dark:text-blue-400" />
                  {statusMessage}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-150 rounded-full" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          )}

          {/* 3 Tombol Opsi Unduhan Sesuai Permintaan */}
          <div className="mt-4 space-y-2.5">
            {/* 1. Download mp4 */}
            <button
              onClick={handleDownloadMp4}
              disabled={isRecording}
              className="w-full group flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/60 dark:bg-slate-850 dark:hover:bg-blue-950/30 transition-all text-left cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Film size={18} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    1. Download mp4
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isId ? 'Video rekaman animasi (.mp4)' : 'Recorded animation video (.mp4)'}
                  </div>
                </div>
              </div>
            </button>

            {/* 2. Download code */}
            <button
              onClick={handleDownloadCode}
              disabled={isRecording}
              className="w-full group flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/60 dark:bg-slate-850 dark:hover:bg-blue-950/30 transition-all text-left cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileCode size={18} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    2. Download code
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isId ? 'Berkas kode sumber mandiri (.html)' : 'Standalone source code (.html)'}
                  </div>
                </div>
              </div>
            </button>

            {/* 3. Download code & mp4 */}
            <button
              onClick={handleDownloadBundle}
              disabled={isRecording}
              className="w-full group flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/60 dark:bg-slate-850 dark:hover:bg-indigo-950/30 transition-all text-left cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Layers size={18} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    3. Download code & mp4
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isId ? 'Unduh paket lengkap (kode HTML + video MP4)' : 'Complete bundle (HTML code + MP4 video)'}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default MotionDownloadModal;
