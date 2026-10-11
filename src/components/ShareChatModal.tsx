import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, ExternalLink, HelpCircle, MessageSquare, Bot, User } from 'lucide-react';
import { 
  ShareMode, 
  buildShareUrl, 
  saveSharedChatRecord, 
  getSharedChatsRegistry, 
  getDefaultShareMode,
  generateShareSessionId,
  isValidShareSessionId
} from '../lib/shareChat';
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
  const [shareId, setShareId] = useState<string>('');
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isApplied, setIsApplied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && session) {
      // Periksa apakah sesi ini sudah pernah dibagikan sebelumnya dengan ID acak yang valid (16-32 karakter)
      const registry = getSharedChatsRegistry();
      const existing = Object.values(registry).find(
        r => (r.sessionId === session.id || r.id === session.id) && isValidShareSessionId(r.id)
      );

      if (existing) {
        setShareId(existing.id);
        setSelectedMode(existing.mode);
        setGeneratedUrl(existing.url);
        setIsApplied(true);
      } else {
        // Hasilkan ID acak kombinasi huruf dan angka (16-32 karakter, default 24 karakter)
        const newRandomId = generateShareSessionId(24);
        setShareId(newRandomId);
        setSelectedMode(defaultMode);
        setGeneratedUrl('');
        setIsApplied(false);
      }
      setIsCopied(false);
    }
  }, [isOpen, session, defaultMode]);

  if (!isOpen || !session) return null;

  const currentShareId = shareId || session.id;

  const handleApply = () => {
    // Siapkan snapshot data untuk portability
    const snapshotPayload = {
      id: currentShareId,
      sessionId: session.id,
      title: session.title,
      model: session.model,
      mode: selectedMode,
      createdAt: Date.now(),
      messages: session.messages,
    };

    const fullUrl = buildShareUrl(currentShareId, selectedMode, snapshotPayload);

    // Simpan ke registry share chat dengan ID acak 16-32 karakter
    saveSharedChatRecord({
      id: currentShareId,
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
            {/* Format URL Indicator dengan ID Acak 16-32 Karakter */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-700/60 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 font-mono text-[11px]">
                  {isId ? 'Format URL Tautan:' : 'Link URL Format:'}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  ID: {currentShareId.length} char
                </span>
              </div>
              <div className="font-mono text-blue-600 dark:text-blue-400 font-semibold truncate select-all">
                bluefox.tmpa.my.id/share-{currentShareId}
              </div>
            </div>

            {/* Conversation Snippet Preview (First 2 messages) */}
            {session.messages && session.messages.length > 0 && (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    <MessageSquare size={13} className="text-blue-500" />
                    <span>{isId ? 'Preview Percakapan (2 Pesan Pertama)' : 'Conversation Preview (First 2 Messages)'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {session.messages.length} {isId ? 'pesan' : 'messages'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {session.messages.slice(0, 2).map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl text-xs flex gap-2.5 items-start ${
                        msg.role === 'user'
                          ? 'bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                          : 'bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === 'user'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          : 'bg-blue-600 text-white'
                      }`}>
                        {msg.role === 'user' ? <User size={11} /> : <Bot size={11} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold text-slate-400 mb-0.5">
                          {msg.role === 'user' ? (isId ? 'Pesan Pengguna' : 'User Query') : 'Bluefox AI'}
                        </div>
                        <p className="line-clamp-2 text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                          {msg.text || (msg.media ? (isId ? '[Lampiran Media]' : '[Media Attachment]') : '...')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode User Selection - Minimalist Cards */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2.5">
                {isId ? 'Pilih Mode Akses Pengguna:' : 'Select User Access Mode:'}
              </label>

              <div className="space-y-2">
                {/* 1. READ CARD (Minimalist) */}
                <div 
                  onClick={() => { setSelectedMode('read'); setIsApplied(false); }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    selectedMode === 'read'
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500 shadow-2xs ring-1 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Read</span>
                      <span className="text-slate-400 text-xs font-normal">—</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 leading-tight">
                        {isId 
                          ? 'Hanya membaca, input prompt disembunyikan & sesi tidak tersimpan' 
                          : 'Read-only view, prompt input hidden & session is not saved'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    selectedMode === 'read'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-300 dark:border-slate-600 bg-transparent'
                  }`}>
                    {selectedMode === 'read' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>

                {/* 2. REMIX CARD (Minimalist) */}
                <div 
                  onClick={() => { setSelectedMode('remix'); setIsApplied(false); }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    selectedMode === 'remix'
                      ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-500 dark:border-purple-500 shadow-2xs ring-1 ring-purple-500/20'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Remix</span>
                      <span className="text-slate-400 text-xs font-normal">—</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 leading-tight">
                        {isId 
                          ? 'Melanjutkan sesi dengan konteks penuh & bercabang saat kirim pesan' 
                          : 'Continue with full context, forks into user session upon sending'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    selectedMode === 'remix'
                      ? 'border-purple-600 bg-purple-600'
                      : 'border-slate-300 dark:border-slate-600 bg-transparent'
                  }`}>
                    {selectedMode === 'remix' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>

                {/* 3. EDIT CARD (Minimalist) */}
                <div 
                  onClick={() => { setSelectedMode('edit'); setIsApplied(false); }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    selectedMode === 'edit'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-500 shadow-2xs ring-1 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Edit</span>
                      <span className="text-slate-400 text-xs font-normal">—</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 leading-tight">
                        {isId 
                          ? 'Menyimpan sesi penuh ke akun pengguna & langsung siap dilanjutkan' 
                          : 'Full session saved immediately to account & ready to continue'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    selectedMode === 'edit'
                      ? 'border-emerald-600 bg-emerald-600'
                      : 'border-slate-300 dark:border-slate-600 bg-transparent'
                  }`}>
                    {selectedMode === 'edit' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
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

            {/* Tulisan "Apa itu share chat" -> Mengarah ke faq.tmpa.my.id/ai-fitur/share-chat */}
            <div className="pt-1 flex items-center justify-center">
              <a
                href="https://faq.tmpa.my.id/ai-fitur/share-chat"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors group cursor-pointer"
                title="FAQ Bluefox AI"
              >
                <HelpCircle size={14} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                <span className="underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4 group-hover:decoration-blue-500">
                  {isId ? 'Apa itu share chat?' : 'What is share chat?'}
                </span>
                <ExternalLink size={11} className="opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
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
