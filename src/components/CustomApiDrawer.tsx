import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Bot, 
  Image as ImageIcon, 
  Video, 
  MessageSquare, 
  Key, 
  Plus, 
  Check, 
  ExternalLink, 
  Search, 
  Layers, 
  SlidersHorizontal,
  Cpu,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { BluefoxCustomApi, CustomApiKey } from '../types';
import { 
  getUserCustomApis, 
  deleteUserCustomApi,
  getUserCustomApiDailyUsage 
} from '../lib/bluefoxCustomApi';
import { 
  getCustomApis, 
  toggleCustomApiActive, 
  getActiveCustomApi,
  deleteCustomApi 
} from '../lib/customApi';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

interface CustomApiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChatModel: (api: CustomApiKey) => void;
  onGenerateImage: (api?: BluefoxCustomApi) => void;
  onGenerateVideo: (api?: BluefoxCustomApi) => void;
  onOpenManageApis: () => void;
  user?: any;
}

export function CustomApiDrawer({
  isOpen,
  onClose,
  onSelectChatModel,
  onGenerateImage,
  onGenerateVideo,
  onOpenManageApis,
  user
}: CustomApiDrawerProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [activeFilter, setActiveFilter] = useState<'all' | 'chat' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom APIs data
  const [chatApis, setChatApis] = useState<CustomApiKey[]>([]);
  const [mediaApis, setMediaApis] = useState<BluefoxCustomApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyUsage, setDailyUsage] = useState({ usedToday: 0, dailyLimit: 100 });
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const loadAllApis = async () => {
    setIsLoading(true);
    try {
      // 1. Chat LLM APIs from local storage
      const loadedChatApis = getCustomApis();
      setChatApis(loadedChatApis);

      // 2. Media APIs from Supabase table bluefox_custom_api
      const [fetchedMedia, usage] = await Promise.all([
        getUserCustomApis(),
        getUserCustomApiDailyUsage()
      ]);
      setMediaApis(fetchedMedia);
      setDailyUsage(usage);
    } catch (err) {
      console.error('Error loading custom APIs in drawer:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllApis();
      setSearchQuery('');
    }
  }, [isOpen]);

  // Listen to custom api update events
  useEffect(() => {
    const handleUpdate = () => {
      loadAllApis();
    };
    window.addEventListener('tmpa_custom_apis_updated', handleUpdate);
    return () => window.removeEventListener('tmpa_custom_apis_updated', handleUpdate);
  }, []);

  const handleActivateChatApi = (api: CustomApiKey) => {
    toggleCustomApiActive(api.id);
    setChatApis(getCustomApis());
    showToast(isId ? `Model ${api.name} diaktifkan untuk obrolan!` : `Model ${api.name} activated for chat!`);
    onSelectChatModel(api);
  };

  const handleDeleteChatApi = (id: string, name: string) => {
    if (window.confirm(isId ? `Hapus API ${name}?` : `Delete API ${name}?`)) {
      deleteCustomApi(id);
      setChatApis(getCustomApis());
      showToast(isId ? `API ${name} telah dihapus` : `API ${name} deleted`);
    }
  };

  const handleDeleteMediaApi = async (id: string, name: string) => {
    if (window.confirm(isId ? `Hapus API ${name} dari tabel bluefox_custom_api?` : `Delete API ${name}?`)) {
      const ok = await deleteUserCustomApi(id);
      if (ok) {
        setMediaApis(prev => prev.filter(a => a.id !== id));
        showToast(isId ? `API ${name} telah dihapus` : `API ${name} deleted`);
      }
    }
  };

  // Filtered lists
  const imageApis = mediaApis.filter(a => a.api_type === 'image');
  const videoApis = mediaApis.filter(a => a.api_type === 'video');

  const totalCount = chatApis.length + mediaApis.length;

  // Search filter
  const q = searchQuery.toLowerCase().trim();
  const filteredChat = chatApis.filter(a => 
    !q || a.name.toLowerCase().includes(q) || a.model.toLowerCase().includes(q) || a.provider.toLowerCase().includes(q)
  );
  const filteredImage = imageApis.filter(a => 
    !q || a.name.toLowerCase().includes(q) || a.model_id.toLowerCase().includes(q) || a.endpoint_url.toLowerCase().includes(q)
  );
  const filteredVideo = videoApis.filter(a => 
    !q || a.name.toLowerCase().includes(q) || a.model_id.toLowerCase().includes(q) || a.endpoint_url.toLowerCase().includes(q)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Bottom Sheet / Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="relative w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl z-50 max-h-[88vh] flex flex-col text-slate-900 dark:text-slate-100 overflow-hidden"
          >
            {/* Top Drag Handle Indicator */}
            <div className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="px-5 md:px-7 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                      {isId ? 'Model Custom API' : 'Custom API Models'}
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      {totalCount} {isId ? 'Model Terpasang' : 'Installed'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isId 
                      ? 'Pilih model Video, Image, atau Chat Biasa yang Anda hubungkan dengan API Key' 
                      : 'Select your custom Video, Image, or Chat AI models linked with API Key'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenManageApis();
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>{isId ? 'Tambah / Kelola' : 'Add / Manage'}</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="px-5 md:px-7 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                    activeFilter === 'all'
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  <Layers size={13} />
                  <span>{isId ? 'Semua Model' : 'All Models'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {totalCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveFilter('chat')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                    activeFilter === 'chat'
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  <MessageSquare size={13} className={activeFilter === 'chat' ? 'text-white' : 'text-blue-500'} />
                  <span>{isId ? 'Chat Biasa' : 'Chat Models'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {chatApis.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveFilter('image')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                    activeFilter === 'image'
                      ? "bg-emerald-600 text-white shadow-xs shadow-emerald-500/20"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  <ImageIcon size={13} className={activeFilter === 'image' ? 'text-white' : 'text-emerald-500'} />
                  <span>Image</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {imageApis.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveFilter('video')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                    activeFilter === 'video'
                      ? "bg-purple-600 text-white shadow-xs shadow-purple-500/20"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  <Video size={13} className={activeFilter === 'video' ? 'text-white' : 'text-purple-500'} />
                  <span>Video</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {videoApis.length}
                  </span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isId ? 'Cari nama atau model...' : 'Search model or name...'}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Model Cards List */}
            <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-6">
              {/* Toast Feedback */}
              {feedbackToast && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>{feedbackToast}</span>
                  </div>
                </motion.div>
              )}

              {/* SECTION: CHAT BIASA MODELS */}
              {(activeFilter === 'all' || activeFilter === 'chat') && filteredChat.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
                        <MessageSquare size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {isId ? 'Model Chat Biasa (LLM Teks)' : 'Chat AI Models'}
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        {filteredChat.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Limit: 10 req/mnt • 50 req/hari
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredChat.map((api) => (
                      <div
                        key={api.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all relative flex flex-col justify-between group",
                          api.isActive 
                            ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500/80 shadow-xs" 
                            : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs"
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                api.isActive ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              )}>
                                <Bot size={16} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                                    {api.name}
                                  </h5>
                                  {api.isActive && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      {isId ? 'Sedang Aktif' : 'Active'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Provider: <strong>{api.provider}</strong>
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteChatApi(api.id, api.name)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title={isId ? 'Hapus konfigurasi ini' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-1 my-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-sans">{isId ? 'Model ID:' : 'Model:'}</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{api.model}</span>
                            </div>
                            {api.baseUrl && (
                              <div className="flex items-center justify-between truncate">
                                <span className="text-slate-400 font-sans">Endpoint:</span>
                                <span className="text-[10px] truncate max-w-[180px]">{api.baseUrl}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Key size={11} /> API Key terpasang
                          </span>

                          <button
                            onClick={() => handleActivateChatApi(api)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                              api.isActive
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                            )}
                          >
                            {api.isActive ? (
                              <>
                                <Check size={13} />
                                <span>{isId ? 'Gunakan Model Ini' : 'Use Active'}</span>
                              </>
                            ) : (
                              <>
                                <ArrowRight size={13} />
                                <span>{isId ? 'Aktifkan Chat' : 'Activate Chat'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: IMAGE GENERATION MODELS */}
              {(activeFilter === 'all' || activeFilter === 'image') && filteredImage.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
                        <ImageIcon size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {isId ? 'Model Generasi Gambar (Image)' : 'Image Generation Models'}
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {filteredImage.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Edge Function: {dailyUsage.usedToday}/{dailyUsage.dailyLimit} req/hari
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredImage.map((api) => (
                      <div
                        key={api.id}
                        className="p-4 rounded-2xl border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-600/60 transition-all hover:shadow-xs relative flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <ImageIcon size={16} />
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {api.name}
                                </h5>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  Custom Image API
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteMediaApi(api.id, api.name)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title={isId ? 'Hapus' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-1 my-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-sans">Model ID:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{api.model_id}</span>
                            </div>
                            <div className="flex items-center justify-between truncate">
                              <span className="text-slate-400 font-sans">Endpoint:</span>
                              <span className="text-[10px] truncate max-w-[190px]">{api.endpoint_url}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Key size={11} /> Terenkripsi Supabase
                          </span>

                          <button
                            onClick={() => {
                              onClose();
                              onGenerateImage(api);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <Sparkles size={13} />
                            <span>{isId ? 'Generate Gambar' : 'Generate Image'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: VIDEO GENERATION MODELS */}
              {(activeFilter === 'all' || activeFilter === 'video') && filteredVideo.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 flex items-center justify-center">
                        <Video size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {isId ? 'Model Generasi Video' : 'Video Generation Models'}
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                        {filteredVideo.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Polling Asynchronous 5s • 100 req/hari
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredVideo.map((api) => (
                      <div
                        key={api.id}
                        className="p-4 rounded-2xl border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-purple-300 dark:hover:border-purple-600/60 transition-all hover:shadow-xs relative flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <Video size={16} />
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {api.name}
                                </h5>
                                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                                  Custom Video API
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteMediaApi(api.id, api.name)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title={isId ? 'Hapus' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-1 my-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-sans">Model ID:</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{api.model_id}</span>
                            </div>
                            <div className="flex items-center justify-between truncate">
                              <span className="text-slate-400 font-sans">Endpoint:</span>
                              <span className="text-[10px] truncate max-w-[190px]">{api.endpoint_url}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Key size={11} /> Polling Status Otomatis
                          </span>

                          <button
                            onClick={() => {
                              onClose();
                              onGenerateVideo(api);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <Video size={13} />
                            <span>{isId ? 'Generate Video' : 'Generate Video'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EMPTY STATE (If nothing found in current filter) */}
              {totalCount === 0 || (
                (activeFilter === 'chat' && filteredChat.length === 0) ||
                (activeFilter === 'image' && filteredImage.length === 0) ||
                (activeFilter === 'video' && filteredVideo.length === 0) ||
                (filteredChat.length === 0 && filteredImage.length === 0 && filteredVideo.length === 0)
              ) && (
                <div className="py-12 px-4 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Key size={22} />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {searchQuery 
                      ? (isId ? 'Tidak ada model yang cocok dengan pencarian' : 'No matching models found') 
                      : (isId ? 'Belum Ada Model di Kategori Ini' : 'No models in this category')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
                    {isId 
                      ? 'Tambahkan API Key untuk server kustom Anda (OpenAI, Groq, SDXL, ComfyUI, Runway, Kling, dll).' 
                      : 'Add an API Key for your custom servers (OpenAI, Groq, SDXL, Runway, etc).'}
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenManageApis();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus size={14} />
                    <span>{isId ? 'Tambah API Key Sekarang' : 'Add API Key Now'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="px-5 md:px-7 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-850/60 flex items-center justify-between gap-4">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  {isId 
                    ? 'Semua request melalui Edge Function Supabase dengan rate limit terlindungi' 
                    : 'All requests run through Supabase Edge Function with protected limits'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenManageApis();
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <SlidersHorizontal size={13} />
                  <span>{isId ? 'Kelola API Key' : 'Manage Keys'}</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {isId ? 'Selesai' : 'Done'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
