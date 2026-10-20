import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X, ShieldAlert, Clock, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  title?: string;
  message?: string;
  used5h?: number;
  usedWeekly?: number;
}

export function QuotaExceededModal({
  isOpen,
  onClose,
  onReset,
  title,
  message,
  used5h = 100,
  usedWeekly = 100,
}: QuotaExceededModalProps) {
  const { lang } = useLanguage();

  if (!isOpen) return null;

  const defaultTitle = lang === 'id' ? 'Batas Kuota Penggunaan Tercapai' : 'Usage Limit Reached';
  const defaultMessage = lang === 'id' 
    ? 'Batas kuota 5 Jam atau Mingguan Anda telah mencapai 100%. Silakan tunggu siklus reset otomatis atau gunakan tombol Reset Kuota (Dev) untuk melanjutkan percakapan.' 
    : 'Your 5-hour or weekly quota limit has reached 100%. Please wait for automatic reset or use the Dev Reset button below.';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 340 }}
          className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 overflow-hidden text-slate-900"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert size={26} />
            </div>
            <div className="flex-1 pr-6">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full inline-block mb-1">
                Quota System Notification
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                {title || defaultTitle}
              </h3>
            </div>
          </div>

          {/* Message Body */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 mb-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
            {message || defaultMessage}
          </div>

          {/* Usage Meters */}
          <div className="space-y-3.5 mb-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
              {/* 5-Hour Meter */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Clock size={13} className="text-blue-600" />
                    {lang === 'id' ? 'Batas 5 Jam' : '5-Hour Limit'}
                  </span>
                  <span className={used5h >= 100 ? 'text-rose-600' : 'text-amber-600'}>
                    {used5h.toFixed(1)}% {lang === 'id' ? 'Terpakai' : 'Used'}
                  </span>
                </div>
                <div className="h-3 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      used5h >= 100 ? 'bg-rose-500' : used5h > 75 ? 'bg-amber-500' : 'bg-blue-600'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, used5h))}%` }}
                  />
                </div>
              </div>

              {/* Weekly Meter */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Calendar size={13} className="text-emerald-600" />
                    {lang === 'id' ? 'Batas Mingguan' : 'Weekly Limit'}
                  </span>
                  <span className={usedWeekly >= 100 ? 'text-rose-600' : 'text-emerald-600'}>
                    {usedWeekly.toFixed(1)}% {lang === 'id' ? 'Terpakai' : 'Used'}
                  </span>
                </div>
                <div className="h-3 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      usedWeekly >= 100 ? 'bg-rose-500' : usedWeekly > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, usedWeekly))}%` }}
                  />
                </div>
              </div>
            </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 text-center"
            >
              {lang === 'id' ? 'Tutup' : 'Close'}
            </button>
            <button
              type="button"
              onClick={() => {
                onReset();
                onClose();
              }}
              className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>{lang === 'id' ? 'Reset Kuota (Dev)' : 'Reset Quota (Dev)'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
