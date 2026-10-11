import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Plus,
  Send,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Shield,
  Radio,
  X,
  AlertCircle,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import {
  TelegramBotRecord,
  fetchTelegramBots,
  createTelegramBot,
  updateTelegramBotName,
  deleteTelegramBot,
  EDGE_FUNCTION_WEBHOOK_URL
} from '../lib/telegramBots';
import { useLanguage } from '../lib/i18n';

interface RemoteControlPageProps {
  onBack: () => void;
  onOpenSession?: (sessionId: string) => void;
  onAddSession?: (session: { id: string; title: string }) => void;
}

export const RemoteControlPage: React.FC<RemoteControlPageProps> = ({
  onBack,
  onOpenSession,
  onAddSession,
}) => {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [bots, setBots] = useState<TelegramBotRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeMenuBotId, setActiveMenuBotId] = useState<string | null>(null);

  // Modal Create Bot
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [botNameInput, setBotNameInput] = useState<string>('');
  const [botTokenInput, setBotTokenInput] = useState<string>('');
  const [botUsernameInput, setBotUsernameInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdBotResult, setCreatedBotResult] = useState<{
    bot: TelegramBotRecord;
    telegramLink: string;
  } | null>(null);

  // Modal Edit Bot
  const [editingBot, setEditingBot] = useState<TelegramBotRecord | null>(null);
  const [editBotNameInput, setEditBotNameInput] = useState<string>('');
  const [isEditingSubmitting, setIsEditingSubmitting] = useState<boolean>(false);

  // Modal Delete Bot
  const [deletingBot, setDeletingBot] = useState<TelegramBotRecord | null>(null);
  const [isDeletingSubmitting, setIsDeletingSubmitting] = useState<boolean>(false);

  // Copy toast state
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const loadBots = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTelegramBots();
      setBots(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botNameInput.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createTelegramBot({
        bot_name: botNameInput.trim(),
        telegram_bot_token: botTokenInput.trim(),
        telegram_bot_username: botUsernameInput.trim(),
      });

      // Tambahkan sesi baru secara instan ke daftar obrolan web
      if (onAddSession) {
        onAddSession(result.session);
      }

      setCreatedBotResult({
        bot: result.bot,
        telegramLink: result.telegramLink,
      });

      setBots(prev => [result.bot, ...prev]);
      setBotNameInput('');
      setBotTokenInput('');
      setBotUsernameInput('');
    } catch (err) {
      console.error('Gagal membuat bot telegram:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBotName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBot || !editBotNameInput.trim()) return;

    setIsEditingSubmitting(true);
    try {
      await updateTelegramBotName(editingBot.id, editBotNameInput.trim());
      setBots(prev =>
        prev.map(b => (b.id === editingBot.id ? { ...b, bot_name: editBotNameInput.trim() } : b))
      );
      setEditingBot(null);
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!deletingBot) return;

    setIsDeletingSubmitting(true);
    try {
      await deleteTelegramBot(deletingBot.id);
      setBots(prev => prev.filter(b => b.id !== deletingBot.id));
      setDeletingBot(null);
    } finally {
      setIsDeletingSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isId ? 'Kembali ke Pengaturan' : 'Back to Settings'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Remote Control
              </h1>
              <span className="text-[10px] font-mono uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Telegram Integration
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {isId
                ? 'Jembatan komunikasi antara Web Bluefox dan Telegram Bot Client'
                : 'Bridge communication between Bluefox Web and Telegram Bot Client'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBots}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isId ? 'Segarkan daftar bot' : 'Refresh bot list'}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              setCreatedBotResult(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>+ New Bot</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Architecture & Status Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-950/30 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-blue-600 dark:text-blue-400 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {isId ? 'Sinkronisasi Dua Arah Aktif' : 'Two-Way Synchronization Active'}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {isId
                ? 'Setiap pesan yang dikirim dari Telegram Bot dimasukkan ke riwayat percakapan Web Bluefox secara real-time. Anda dapat membaca riwayat atau melanjutkan sesi di kedua platform.'
                : 'Every message sent from the Telegram Bot is synced into Bluefox Web history in real-time. You can read and continue sessions across both platforms.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Edge Function: quick-handler</span>
          </div>
        </div>

        {/* Bot Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {isId ? 'Daftar Bot Telegram Terhubung' : 'Connected Telegram Bots'} ({bots.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <p className="text-xs font-medium">
                {isId ? 'Memuat data Remote Control...' : 'Loading Remote Control data...'}
              </p>
            </div>
          ) : bots.length === 0 ? (
            <div className="py-16 px-6 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/60 shadow-xs">
                <Send size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isId ? 'Belum Ada Bot Telegram' : 'No Telegram Bots Yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {isId
                    ? 'Buat bot pertama Anda untuk menghubungkan percakapan Bluefox langsung dengan Telegram Bot Client.'
                    : 'Create your first bot to bridge Bluefox conversations directly with Telegram.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedBotResult(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>{isId ? 'Tambah Bot Baru' : 'Add New Bot'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bots.map(bot => {
                const tgLink = `https://t.me/${bot.telegram_bot_username}?start=${bot.session_id}`;
                return (
                  <div
                    key={bot.id}
                    className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                  >
                    {/* Top Card Info */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/60 shrink-0">
                            <Send size={18} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {bot.bot_name}
                            </h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate">
                              @{bot.telegram_bot_username}
                            </p>
                          </div>
                        </div>

                        {/* Three Dots Menu (Titik Tiga) */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuBotId(activeMenuBotId === bot.id ? null : bot.id)
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title={isId ? 'Opsi Bot' : 'Bot Options'}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuBotId === bot.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setActiveMenuBotId(null)}
                              />
                              <div className="absolute right-0 top-8 w-44 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-xl z-30 py-1 overflow-hidden text-xs">
                                <button
                                  onClick={() => {
                                    setActiveMenuBotId(null);
                                    setEditingBot(bot);
                                    setEditBotNameInput(bot.bot_name);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Edit2 size={13} className="text-blue-500" />
                                  <span>{isId ? 'Edit Nama Bot' : 'Edit Bot Name'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuBotId(null);
                                    setDeletingBot(bot);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100 dark:border-slate-800"
                                >
                                  <Trash2 size={13} />
                                  <span>{isId ? 'Hapus Bot' : 'Delete Bot'}</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Bot Meta Information */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>{isId ? 'Status Bot' : 'Bot Status'}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              bot.is_active
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {bot.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>{isId ? 'Session ID' : 'Session ID'}</span>
                          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                            {bot.session_id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(tgLink, bot.id)}
                          className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title={isId ? 'Salin Tautan Telegram' : 'Copy Telegram Link'}
                        >
                          {copiedLink === bot.id ? (
                            <Check size={13} className="text-emerald-500 stroke-[3]" />
                          ) : (
                            <Copy size={13} />
                          )}
                          <span>
                            {copiedLink === bot.id
                              ? isId
                                ? 'Tersalin'
                                : 'Copied'
                              : isId
                              ? 'Salin Link'
                              : 'Copy Link'}
                          </span>
                        </button>

                        <a
                          href={tgLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          title={isId ? 'Mulai di Telegram' : 'Start on Telegram'}
                        >
                          <Send size={13} />
                          <span>Telegram</span>
                          <ExternalLink size={10} className="opacity-70" />
                        </a>
                      </div>

                      {onOpenSession && (
                        <button
                          onClick={() => {
                            onOpenSession(bot.session_id);
                            onBack();
                          }}
                          className="w-full py-2 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare size={13} />
                          <span>{isId ? 'Buka di Web Bluefox' : 'Open in Bluefox Web'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: + NEW BOT */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/60 shadow-xs">
                    <Send size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                      {isId ? 'Tambah Bot Telegram Baru' : 'Add New Telegram Bot'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isId ? 'Konfigurasi jembatan Remote Control' : 'Configure Remote Control bridge'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {createdBotResult ? (
                /* Success Result View */
                <div className="py-6 space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      {isId ? 'Bot Berhasil Dibuat dan Didaftarkan' : 'Bot Created & Registered'}
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-sm mx-auto leading-relaxed">
                      {isId
                        ? 'Sesi baru telah ditambahkan ke daftar percakapan web dan webhook Telegram telah disiapkan.'
                        : 'A new session has been added to the web chat list and Telegram webhook is ready.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Tautan Kustom Telegram:' : 'Custom Telegram Link:'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={createdBotResult.telegramLink}
                        className="flex-1 text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 select-all focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(createdBotResult.telegramLink, 'created')}
                        className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedLink === 'created' ? <Check size={14} /> : <Copy size={14} />}
                        <span>
                          {copiedLink === 'created' ? (isId ? 'Tersalin' : 'Copied') : isId ? 'Salin' : 'Copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <a
                      href={createdBotResult.telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{isId ? 'Buka di Telegram' : 'Open in Telegram'}</span>
                      <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => setIsCreateModalOpen(false)}
                      className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isId ? 'Selesai' : 'Done'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Form Input View */
                <form onSubmit={handleCreateBot} className="py-4 space-y-4 overflow-y-auto">
                  {/* Input bot_name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Nama Bot (bot_name) *' : 'Bot Name (bot_name) *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={botNameInput}
                      onChange={e => setBotNameInput(e.target.value)}
                      placeholder={isId ? 'Contoh: Asisten Riset Bluefox' : 'e.g. Research Assistant'}
                      className="w-full text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isId
                        ? 'Nama kustom yang ditampilkan di Dashboard & daftar percakapan Bluefox.'
                        : 'Custom name displayed in Bluefox Dashboard & conversation list.'}
                    </p>
                  </div>

                  {/* Input telegram_bot_token */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Token API Telegram BotFather' : 'BotFather Telegram API Token'}
                    </label>
                    <input
                      type="password"
                      value={botTokenInput}
                      onChange={e => setBotTokenInput(e.target.value)}
                      placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isId
                        ? 'Diperlukan untuk mendaftarkan webhook ke quick-handler. Dapatkan dari @BotFather.'
                        : 'Required to register webhook to quick-handler. Obtain from @BotFather.'}
                    </p>
                  </div>

                  {/* Input telegram_bot_username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Username Bot Telegram' : 'Telegram Bot Username'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-xs">@</span>
                      <input
                        type="text"
                        value={botUsernameInput}
                        onChange={e => setBotUsernameInput(e.target.value)}
                        placeholder="bluefox_assistant_bot"
                        className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>

                  {/* Info Notice */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">
                      {isId ? 'Otomatisasi Sistem:' : 'System Actions:'}
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      <li>{isId ? 'Membuat sesi baru di session_bluefox' : 'Creates new session in session_bluefox'}</li>
                      <li>{isId ? 'Mendaftarkan webhook ke Edge Function quick-handler' : 'Registers webhook to Edge Function quick-handler'}</li>
                      <li>{isId ? 'Menyimpan konfigurasi aktif di telegram_bots' : 'Saves active configuration in telegram_bots'}</li>
                    </ul>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isId ? 'Batal' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !botNameInput.trim()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>{isId ? 'Memproses...' : 'Processing...'}</span>
                        </>
                      ) : (
                        <span>{isId ? 'Buat & Daftarkan Bot' : 'Create & Register Bot'}</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT BOT (Kartu Bot -> Titik Tiga -> Edit) */}
      <AnimatePresence>
        {editingBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => !isEditingSubmitting && setEditingBot(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-slate-900 dark:text-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Edit2 size={18} className="text-blue-500" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {isId ? 'Edit Nama Bot' : 'Edit Bot Name'}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingBot(null)}
                  disabled={isEditingSubmitting}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateBotName} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    {isId ? 'Nama Bot (bot_name)' : 'Bot Name (bot_name)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editBotNameInput}
                    onChange={e => setEditBotNameInput(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                {/* Important Rule Notice */}
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 leading-relaxed">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {isId ? 'Aturan Penting:' : 'Important Rule:'}
                    </span>{' '}
                    {isId
                      ? 'Tindakan ini HANYA memperbarui kolom bot_name pada database Supabase. Nama bot di aplikasi Telegram TIDAK BOLEH BERUBAH.'
                      : 'This action ONLY updates bot_name column in Supabase. The bot name in Telegram app WILL NOT change.'}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBot(null)}
                    disabled={isEditingSubmitting}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                  >
                    {isId ? 'Batal' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isEditingSubmitting || !editBotNameInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    {isEditingSubmitting ? (isId ? 'Menyimpan...' : 'Saving...') : isId ? 'Simpan Perubahan' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DELETE BOT (Kartu Bot -> Titik Tiga -> Delete) */}
      <AnimatePresence>
        {deletingBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => !isDeletingSubmitting && setDeletingBot(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-slate-900 dark:text-slate-100 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center border border-rose-200 dark:border-rose-800 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                    {isId ? 'Hapus Bot Telegram' : 'Delete Telegram Bot'}
                  </h3>
                  <p className="text-xs text-slate-500">{deletingBot.bot_name}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  {isId
                    ? 'Apakah Anda yakin ingin menghapus atau menonaktifkan bot ini dari Dashboard Bluefox?'
                    : 'Are you sure you want to delete or deactivate this bot from Bluefox Dashboard?'}
                </p>
                <div className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-[11px] text-rose-700 dark:text-rose-300">
                  <span className="font-bold">
                    {isId ? 'Aturan Sistem Penanganan Bot Nonaktif:' : 'Inactive Bot Rule:'}
                  </span>
                  <br />
                  {isId
                    ? 'Jika pengguna di Telegram mencoba mengirim pesan ke bot yang sudah dihapus/dinonaktifkan, Supabase Edge Function HARUS MENGABAIKAN (ignore) pesan tersebut (tidak disimpan ke message_bluefox, tidak memanggil AI, dan tidak membalas).'
                    : 'If Telegram users send messages to deleted/inactive bots, Edge Function will IGNORE them (no storage in message_bluefox, no AI invocation, no replies).'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingBot(null)}
                  disabled={isDeletingSubmitting}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {isId ? 'Batal' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBot}
                  disabled={isDeletingSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isDeletingSubmitting ? (isId ? 'Menghapus...' : 'Deleting...') : isId ? 'Ya, Hapus Bot' : 'Yes, Delete Bot'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
