import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Eye, GitFork, Pencil, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { ShareMode, buildShareUrl, saveSharedChatRecord, getSharedChatsRegistry, getDefaultShareMode } from '../lib/shareChat';
import { ChatSession } from '../types';

interface ShareChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatSession | null;
  lang?: 'id' | 'en';
}

export const ShareChatModal: React.FC<ShareChatModalProps> = ({
  isOpen,
  onClose,
  session,
  lang = 'id',
}) => {
  const isId = lang === 'id';
  const defaultMode = getDefaultShareMode();
  
  const [selectedMode, setSelectedMode] = useState<ShareMode>(defaultMode);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isApplied, setIsApplied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && session) {
      // Periksa apakah sesi ini sudah pernah dibagikan sebelumnya
      const registry = getSharedChatsRegistry();
      const existing = registry[session.id];
      if (existing) {
        setSelectedMode(existing.mode);
        setGeneratedUrl(existing.url);
        setIsApplied(true);
      } else {
        setSelectedMode(defaultMode);
        setGeneratedUrl('');
        setIsApplied(false);
      }
      setIsCopied(false);
    }
  }, [isOpen, session, defaultMode]);

  if (!isOpen || !session) return null;

  const handleApply = () => {
    // Siapkan snapshot data untuk portability
    const snapshotPayload = {
      id: session.id,
      title: session.title,
      model: session.model,
      mode: selectedMode,
      createdAt: Date.now(),
      messages: session.messages,
    };

    const fullUrl = buildShareUrl(session.id, selectedMode, snapshotPayload);

    // Simpan ke registry share chat
    saveSharedChatRecord({
      id: session.id,
      sessionId: session.id,
      title: session.title,
      mode: selectedMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: session.model,
      url: fullUrl,
      messagesSnapshot: session.messages,
    });

    setGeneratedUrl(fullUrl);
    setIsApplied(true);

    // Salin otomatis ke clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }).catch(() => {});
    }
  };

  const handleCopyLink = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handleNativeShare = async () => {
    if (!generatedUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bluefox AI: ${session.title}`,
          text: `Lihat percakapan ini di Bluefox AI (Mode: ${selectedMode.toUpperCase()}):`,
          url: generatedUrl,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/60 shadow-xs">
                <Share2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  {isId ? 'Bagikan Obrolan' : 'Share Chat'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 max-w-[280px]">
                  {session.title}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {/* Format URL Indicator */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
              <span className="text-slate-400 font-mono text-[11px] block mb-1">
                {isId ? 'Format URL Tautan:' : 'Link URL Format:'}
              </span>
              <div className="font-mono text-blue-600 dark:text-blue-400 font-semibold truncate">
                bluefox.tmpa.my.id/share-{session.id}
              </div>
            </div>

            {/* Mode User Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2.5">
                {isId ? 'Pilih Mode Akses Pengguna:' : 'Select User Access Mode:'}
              </label>

              <div className="space-y-2.5">
                {/* 1. READ MODE */}
                <div 
                  onClick={() => { setSelectedMode('read'); setIsApplied(false); }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedMode === 'read'
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-xs ring-1 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    selectedMode === 'read' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <Eye size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Read (Hanya Baca)</span>
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        Read Only
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {isId 
                        ? 'Pengguna hanya bisa membaca obrolan. Sesi tidak disimpan di riwayat chat pengguna dan input prompt disembunyikan.' 
                        : 'User can only read the conversation. Session will not be saved and prompt input is hidden.'}
                    </p>
                  </div>
                </div>

                {/* 2. REMIX MODE */}
                <div 
                  onClick={() => { setSelectedMode('remix'); setIsApplied(false); }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedMode === 'remix'
                      ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 dark:border-purple-500 shadow-xs ring-1 ring-purple-500/30'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    selectedMode === 'remix' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <GitFork size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Remix (Lanjutkan Sesi Baru)</span>
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                        Fork Context
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {isId 
                        ? 'Melanjutkan sesi chat dengan seluruh konteks percakapan. Saat pengguna mulai mengetik, obrolan akan menjadi sesi baru milik mereka tanpa mengubah tautan asli.' 
                        : 'Continue the chat session with full context window. When the user chats, a new private branch session is created without modifying the shared link.'}
                    </p>
                  </div>
                </div>

                {/* 3. EDIT MODE */}
                <div 
                  onClick={() => { setSelectedMode('edit'); setIsApplied(false); }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedMode === 'edit'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    selectedMode === 'edit' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <Pencil size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Edit (Simpan Penuh & Lanjutkan)</span>
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                        Full Save
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {isId 
                        ? 'Menyimpan sesi chat sepenuhnya ke riwayat pengguna (bahkan sebelum pengguna mengetik pesan baru), siap dilanjutkan dan diedit penuh.' 
                        : 'Completely import and persist the session into user account, editable and active right away.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated URL Result Box */}
            {isApplied && generatedUrl && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <Check size={14} className="stroke-[3]" />
                    <span>{isId ? 'Tautan Siap Dibagikan!' : 'Link Ready to Share!'}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-md font-bold">
                    Mode: {selectedMode.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-mono truncate focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{isCopied ? (isId ? 'Tersalin!' : 'Copied!') : (isId ? 'Salin' : 'Copy')}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>
                    {isId ? 'Cara mengaturnya lagi ada di setting bernama ' : 'Configure access anytime in setting named '}
                    <strong className="text-slate-700 dark:text-slate-200 font-semibold">"share chat"</strong>.
                  </span>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={handleNativeShare}
                      className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 size={12} />
                      <span>{isId ? 'Kirim via Apps' : 'Share to apps'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              {isId ? 'Tutup' : 'Close'}
            </button>

            <button
              onClick={handleApply}
              className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Check size={16} />
              <span>{isId ? 'Apply & Buat Link' : 'Apply & Generate'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default ShareChatModal;
