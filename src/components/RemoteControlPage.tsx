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
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  Link2,
  Power,
  PowerOff
} from 'lucide-react';
import {
  TelegramBotRecord,
  fetchTelegramBots,
  createTelegramBot,
  updateTelegramBotName,
  deleteTelegramBot,
  searchAndLinkChatId,
  toggleBotActiveStatus,
  MAX_TELEGRAM_BOTS_PER_USER
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
  const [creationStepText, setCreationStepText] = useState<string>('');
  const [createdBotResult, setCreatedBotResult] = useState<{
    bot: TelegramBotRecord;
    telegramLink: string;
    detectedChatId?: number | null;
  } | null>(null);

  // Checking Chat ID state
  const [checkingChatIdBotId, setCheckingChatIdBotId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [togglingBotId, setTogglingBotId] = useState<string | null>(null);

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
    if (!botNameInput.trim() || !botTokenInput.trim()) return;

    if (bots.length >= MAX_TELEGRAM_BOTS_PER_USER) {
      setCreateError(
        isId
          ? 'Batas maksimal 5 bot per akun telah tercapai (5/5). Anda tidak dapat membuat lebih dari 5 bot.'
          : 'Maximum limit of 5 bots per account reached (5/5).'
      );
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);
    setCreationStepText(isId ? 'Mengambil token & mencari ID Chat...' : 'Checking token & searching Chat ID...');

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
        detectedChatId: result.detectedChatId
      });

      setBots(prev => [result.bot, ...prev.filter(b => b.id !== result.bot.id)]);
      setBotNameInput('');
      setBotTokenInput('');
      setBotUsernameInput('');
    } catch (err: any) {
      console.error('Gagal membuat bot telegram:', err);
      setCreateError(
        err?.message ||
        (isId ? 'Gagal membuat bot. Periksa token Anda.' : 'Failed to create bot. Check your token.')
      );
    } finally {
      setIsSubmitting(false);
      setCreationStepText('');
    }
  };

  const handleToggleActiveBot = async (bot: TelegramBotRecord) => {
    setActiveMenuBotId(null);
    setTogglingBotId(bot.id);
    try {
      const newActive = await toggleBotActiveStatus(bot.id, bot.is_active);
      setBots(prev => prev.map(b => b.id === bot.id ? { ...b, is_active: newActive } : b));
    } catch (err) {
      console.error('Gagal mengubah status aktif bot:', err);
    } finally {
      setTogglingBotId(null);
    }
  };

  const handleSearchChatIdForBot = async (bot: TelegramBotRecord) => {
    setCheckingChatIdBotId(bot.id);
    try {
      const res = await searchAndLinkChatId(bot);
      if (res.ok && res.chatId) {
        setBots(prev =>
          prev.map(b => (b.id === bot.id ? { ...b, telegram_chat_id: res.chatId } : b))
        );
        if (createdBotResult && createdBotResult.bot.id === bot.id) {
          setCreatedBotResult(prev =>
            prev ? { ...prev, detectedChatId: res.chatId } : null
          );
        }
      }
    } finally {
      setCheckingChatIdBotId(null);
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Remote Control
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {isId
                ? 'Kelola bot dan kontrol sesi jarak jauh'
                : 'Manage bots and remote session control'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Counter Maksimal 5 Bot */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>{isId ? 'Bot:' : 'Bots:'}</span>
            <span className={bots.length >= MAX_TELEGRAM_BOTS_PER_USER ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'}>
              {bots.length} / {MAX_TELEGRAM_BOTS_PER_USER}
            </span>
          </div>

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
              if (bots.length >= MAX_TELEGRAM_BOTS_PER_USER) {
                alert(
                  isId
                    ? 'Batas maksimal 5 bot per akun telah tercapai (5/5). Anda tidak dapat membuat lebih dari 5 bot.'
                    : 'Maximum limit of 5 bots per account reached (5/5).'
                );
                return;
              }
              setCreateError(null);
              setCreatedBotResult(null);
              setIsCreateModalOpen(true);
            }}
            disabled={bots.length >= MAX_TELEGRAM_BOTS_PER_USER}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 ${
              bots.length >= MAX_TELEGRAM_BOTS_PER_USER
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer'
            }`}
            title={bots.length >= MAX_TELEGRAM_BOTS_PER_USER ? (isId ? 'Maksimal 5 bot tercapai' : 'Max 5 bots reached') : undefined}
          >
            <Plus size={16} />
            <span>+ New Bot</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Bot Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {isId ? 'Daftar Bot Terhubung' : 'Connected Bots'} ({bots.length})
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
                  {isId ? 'Belum Ada Bot' : 'No Bots Yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {isId
                    ? 'Buat bot pertama Anda untuk menghubungkan percakapan Bluefox dengan bot client.'
                    : 'Create your first bot to connect Bluefox conversations with a bot client.'}
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
                const isCheckingChat = checkingChatIdBotId === bot.id;

                return (
                  <div
                    key={bot.id}
                    className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                  >
                    {/* Top Card Info */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                            bot.is_active
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                          }`}>
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
                                {/* Opsi Nonaktifkan / Aktifkan Bot (Sesuai Permintaan) */}
                                <button
                                  onClick={() => handleToggleActiveBot(bot)}
                                  disabled={togglingBotId === bot.id}
                                  className={`w-full text-left px-3.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                                    bot.is_active
                                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  }`}
                                >
                                  {togglingBotId === bot.id ? (
                                    <RefreshCw size={13} className="animate-spin" />
                                  ) : bot.is_active ? (
                                    <PowerOff size={13} />
                                  ) : (
                                    <Power size={13} />
                                  )}
                                  <span>
                                    {bot.is_active
                                      ? isId
                                        ? 'Nonaktifkan bot'
                                        : 'Deactivate bot'
                                      : isId
                                      ? 'Aktifkan bot'
                                      : 'Activate bot'}
                                  </span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuBotId(null);
                                    setEditingBot(bot);
                                    setEditBotNameInput(bot.bot_name);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100 dark:border-slate-800"
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
                          <span>{isId ? 'Status' : 'Status'}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              bot.is_active
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {bot.is_active
                              ? isId
                                ? 'Aktif'
                                : 'Active'
                              : isId
                              ? 'Nonaktif (Diam)'
                              : 'Inactive (Silent)'}
                          </span>
                        </div>

                        {/* Telegram Links Chat ID */}
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>Chat ID (Links)</span>
                          {bot.telegram_chat_id ? (
                            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              {bot.telegram_chat_id}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSearchChatIdForBot(bot)}
                              disabled={isCheckingChat}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              {isCheckingChat ? (
                                <RefreshCw size={10} className="animate-spin" />
                              ) : (
                                <Search size={10} />
                              )}
                              <span>{isId ? 'Cari ID Chat' : 'Find Chat ID'}</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>Session ID</span>
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
                          title={isId ? 'Salin Tautan' : 'Copy Link'}
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
                          title={isId ? 'Buka Link' : 'Open Link'}
                        >
                          <Send size={13} />
                          <span>Link</span>
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
                      {isId ? 'Tambah Bot Baru' : 'Add New Bot'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isId ? 'Ambil token, cari ID Chat, dan simpan data bot' : 'Fetch token, find Chat ID, and save bot records'}
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
                      {isId ? 'Bot Berhasil Dibuat' : 'Bot Created Successfully'}
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-sm mx-auto leading-relaxed">
                      {isId
                        ? 'Token telah diproses dan disimpan ke tabel telegram_bots dan telegram_links.'
                        : 'Token processed and stored in telegram_bots and telegram_links tables.'}
                    </p>
                  </div>

                  {/* Chat ID Link Status */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-700/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <Link2 size={14} className="text-blue-500" />
                        <span>Status telegram_links:</span>
                      </div>
                      {createdBotResult.detectedChatId ? (
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                          ID: {createdBotResult.detectedChatId} (Tersimpan)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          {isId ? 'Belum Ada Pesan Masuk' : 'No Incoming Message Yet'}
                        </span>
                      )}
                    </div>

                    {!createdBotResult.detectedChatId && (
                      <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          {isId
                            ? 'Kirim /start ke bot di Telegram agar ID chat terdeteksi otomatis.'
                            : 'Send /start to your bot in Telegram to detect chat ID automatically.'}
                        </span>
                        <button
                          onClick={() => handleSearchChatIdForBot(createdBotResult.bot)}
                          disabled={checkingChatIdBotId === createdBotResult.bot.id}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {checkingChatIdBotId === createdBotResult.bot.id ? (
                            <RefreshCw size={11} className="animate-spin" />
                          ) : (
                            <Search size={11} />
                          )}
                          <span>{isId ? 'Cek Chat ID' : 'Check Chat ID'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Tautan Kustom Bot:' : 'Custom Bot Link:'}
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
                  {/* Warning / Error Message */}
                  {createError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-relaxed">
                        <span className="font-semibold block">{isId ? 'Terjadi Kesalahan:' : 'Error:'}</span>
                        {createError}
                      </div>
                    </div>
                  )}

                  {bots.length >= MAX_TELEGRAM_BOTS_PER_USER && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-relaxed">
                        <span className="font-bold block">
                          {isId ? 'Batas Maksimal Bot Tercapai (5/5)' : 'Maximum Bot Limit Reached (5/5)'}
                        </span>
                        {isId
                          ? 'Setiap akun dibatasi hingga 5 bot. Hapus salah satu bot yang ada terlebih dahulu untuk menambahkan bot baru.'
                          : 'Each account is limited to 5 bots. Delete an existing bot to create a new one.'}
                      </div>
                    </div>
                  )}

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
                        ? 'Nama kustom yang ditampilkan di antarmuka Bluefox.'
                        : 'Custom name displayed in Bluefox interface.'}
                    </p>
                  </div>

                  {/* Input telegram_bot_token */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Token API Bot (telegram_bot_token) *' : 'Bot API Token (telegram_bot_token) *'}
                    </label>
                    <input
                      type="password"
                      required
                      value={botTokenInput}
                      onChange={e => setBotTokenInput(e.target.value)}
                      placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isId
                        ? 'Website akan mengambil token ini untuk memverifikasi bot dan mencarikan ID chat.'
                        : 'Website will fetch this token to verify bot and search for user Chat ID.'}
                    </p>
                  </div>

                  {/* Input telegram_bot_username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      {isId ? 'Username Bot (Opsional)' : 'Bot Username (Optional)'}
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
                      disabled={isSubmitting || !botNameInput.trim() || !botTokenInput.trim()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>{creationStepText || (isId ? 'Memproses...' : 'Processing...')}</span>
                        </>
                      ) : (
                        <span>{isId ? 'Buat Bot' : 'Create Bot'}</span>
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
                    {isId ? 'Hapus Bot' : 'Delete Bot'}
                  </h3>
                  <p className="text-xs text-slate-500">{deletingBot.bot_name}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  {isId
                    ? 'Apakah Anda yakin ingin menghapus atau menonaktifkan bot ini?'
                    : 'Are you sure you want to delete or deactivate this bot?'}
                </p>
                <div className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-[11px] text-rose-700 dark:text-rose-300">
                  <span className="font-bold">
                    {isId ? 'Aturan Sistem Penanganan Bot Nonaktif:' : 'Inactive Bot Rule:'}
                  </span>
                  <br />
                  {isId
                    ? 'Pesan yang dikirim ke bot yang telah dihapus atau dinonaktifkan akan diabaikan.'
                    : 'Messages sent to deleted or inactive bots will be ignored.'}
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
export default RemoteControlPage;
