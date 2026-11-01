import React, { useState } from 'react';
import { Download, Smartphone, X, Check, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../lib/i18n';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'badge' | 'menu-item';
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
  onInstalled
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { lang } = useLanguage();
  const isId = lang === 'id';
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Jika sudah terpasang dan berjalan di mode standalone, sembunyikan tombol
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInstallable) {
      const success = await install();
      if (success && onInstalled) {
        onInstalled();
      }
    } else {
      // Tampilkan panduan pemasangan fitur bawaan Google Chrome di Android / iOS
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-100 ${className}`}
        >
          <div className="flex items-center gap-3">
            <Download size={18} className="text-blue-600" />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-xs sm:text-sm">{isId ? 'Download Aplikasi' : 'Download App'}</span>
              <span className="text-[10px] text-slate-400">{isId ? 'Jalan di Android lewat Chrome' : 'Run on Android via Chrome'}</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md">
            PWA
          </span>
        </button>
      ) : variant === 'badge' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer ${className}`}
          title={isId ? 'Install Bluefox di Android lewat fitur Google' : 'Install Bluefox on Android via Google'}
        >
          <Download size={13} />
          <span>{isId ? 'Download App' : 'Download App'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer ${className}`}
        >
          <Download size={15} />
          <span>{isId ? 'Download App' : 'Install App'}</span>
        </button>
      )}

      {/* Modal Panduan Instalasi Fitur Bawaan Google Android & iOS */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Smartphone size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    {isId ? 'Download & Pasang di Android' : 'Download & Install on Android'}
                  </h3>
                  <span className="text-[10px] text-blue-600 font-mono font-bold">Fitur Bawaan Google</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs leading-relaxed text-slate-600">
              {isIOS ? (
                <>
                  <p className="font-medium text-slate-700">
                    {isId ? 'Cara pasang di iPhone / iPad:' : 'How to install on iPhone / iPad:'}
                  </p>
                  <ol className="space-y-2 list-decimal list-inside bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px]">
                    <li>{isId ? 'Tekan tombol' : 'Tap the'} <strong>Bagikan / Share</strong> {isId ? 'di Safari.' : 'in Safari.'}</li>
                    <li>{isId ? 'Pilih' : 'Choose'} <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</li>
                    <li>{isId ? 'Aplikasi Bluefox siap digunakan.' : 'Bluefox is ready to launch.'}</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-700">
                    {isId ? 'Cara pasang lewat Google Chrome di Android:' : 'How to install via Google Chrome on Android:'}
                  </p>
                  <ol className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[11px]">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span>{isId ? 'Tekan ikon menu titik tiga' : 'Tap the three-dots menu'} <strong className="font-mono text-slate-800">(⋮)</strong> {isId ? 'di pojok kanan atas Google Chrome.' : 'at top-right in Chrome.'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span>{isId ? 'Pilih menu' : 'Select'} <strong>Tambahkan ke Layar Utama</strong> {isId ? 'atau' : 'or'} <strong>Instal aplikasi (Install app)</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                      <span>{isId ? 'Tekan' : 'Tap'} <strong>Instal</strong>. {isId ? 'Ikon Bluefox (WebP) akan muncul di layar Android Anda dan siap dijalankan!' : 'The Bluefox icon will appear on your Android home screen!'}</span>
                    </li>
                  </ol>
                </>
              )}

              <div className="flex items-center gap-2 p-2.5 bg-blue-50/80 rounded-xl border border-blue-200/60 text-[11px] text-blue-900">
                <Check size={14} className="text-blue-600 shrink-0" />
                <span>{isId ? 'Ringan, cepat, dan menggunakan icon WebP resmi Bluefox.' : 'Lightweight, fast, and uses official Bluefox WebP icons.'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
            >
              {isId ? 'Mengerti' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
