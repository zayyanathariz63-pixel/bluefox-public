import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Activity, Shield, Settings2, Link2, 
  Camera, Clock, Calendar, Volume2, Globe, Sparkles, Smartphone, Check,
  Key, Plus, Trash2, Eye, EyeOff, Copy, AlertCircle, RefreshCw, Cpu, Layers, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { IntegrationsPage } from './IntegrationsPage';
import { useLanguage, Language } from '../lib/i18n';
import { 
  CustomApiKey, 
  CustomApiUsageStats, 
  getCustomApis, 
  addCustomApi, 
  toggleCustomApiActive, 
  deleteCustomApi, 
  getCustomApiUsageStats, 
  resetCustomApiUsage, 
  MAX_CUSTOM_APIS,
  CUSTOM_API_MINUTE_LIMIT,
  CUSTOM_API_DAILY_LIMIT,
  PROVIDER_PRESETS,
  isSelfHostedProvider,
  getProviderPreset
} from '../lib/customApi';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customInstruction: string;
  setCustomInstruction: (val: string) => void;
  chatSessions: any[];
  hourlyUsage: number;
  weeklyUsage: number;
  resetUsage: () => void;
}

type SubView = 'menu' | 'account' | 'activity' | 'usage' | 'personalization' | 'connected_apps' | 'custom_api' | 'integrations' | 'language';

export function SettingsModal({ isOpen, onClose, customInstruction, setCustomInstruction, chatSessions, hourlyUsage, weeklyUsage, resetUsage }: SettingsModalProps) {
  const { lang, changeLanguage, t } = useLanguage();
  const [currentView, setCurrentView] = useState<SubView>('menu');
  const [profilePic, setProfilePic] = useState('https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/TMPA%20storege/Desain%20tanpa%20judul_20260520_150307_0000.png');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom API states
  const [customApis, setCustomApis] = useState<CustomApiKey[]>(() => getCustomApis());
  const [customUsage, setCustomUsage] = useState<CustomApiUsageStats>(() => getCustomApiUsageStats());
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});

  // Form input states
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState('OpenAI');
  const [formBaseUrl, setFormBaseUrl] = useState('https://api.openai.com/v1');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const selectedPreset = useMemo(() => {
    return getProviderPreset(formProvider) || PROVIDER_PRESETS[0];
  }, [formProvider]);

  const isCurrentSelfHost = selectedPreset.isSelfHosted;

  useEffect(() => {
    const savedPic = localStorage.getItem('tmpa_profile_pic');
    if (savedPic) setProfilePic(savedPic);

    const refreshApis = () => {
      setCustomApis(getCustomApis());
    };
    const refreshUsage = () => {
      setCustomUsage(getCustomApiUsageStats());
    };

    window.addEventListener('tmpa_custom_apis_updated', refreshApis);
    window.addEventListener('tmpa_custom_api_usage_updated', refreshUsage);

    // Interval to refresh minute/daily rate limit timer
    const interval = setInterval(refreshUsage, 5000);

    return () => {
      window.removeEventListener('tmpa_custom_apis_updated', refreshApis);
      window.removeEventListener('tmpa_custom_api_usage_updated', refreshUsage);
      clearInterval(interval);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handlePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setProfilePic(result);
        localStorage.setItem('tmpa_profile_pic', result);
        showToast(t.photoUpdated);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDate = (ts: number | undefined) => {
    if (!ts) return '-';
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}, ${date.getDate()} ${date.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long' })} ${date.getFullYear()}`;
  };

  const handleToggleActive = (id: string, name: string) => {
    const res = toggleCustomApiActive(id);
    setCustomApis(getCustomApis());
    if (res.newState) {
      showToast(lang === 'id' ? `API "${name}" sekarang aktif digunakan.` : `API "${name}" is now active.`);
    } else {
      showToast(lang === 'id' ? `API "${name}" telah dinonaktifkan.` : `API "${name}" has been disabled.`);
    }
  };

  const handleDeleteApi = (id: string, name: string) => {
    deleteCustomApi(id);
    setCustomApis(getCustomApis());
    showToast(lang === 'id' ? `API "${name}" berhasil dihapus.` : `API "${name}" deleted.`);
  };

  const handleSaveNewApi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast(lang === 'id' ? 'Nama API wajib diisi!' : 'API Name is required!');
      return;
    }
    if (!formApiKey.trim()) {
      showToast(lang === 'id' ? 'API Key / Token wajib diisi!' : 'API Key / Token is required!');
      return;
    }
    if (!formModel.trim()) {
      showToast(lang === 'id' ? 'Model ID wajib diisi agar edge function dapat meneruskan request!' : 'Model ID is required!');
      return;
    }
    if (isCurrentSelfHost && !formBaseUrl.trim()) {
      showToast(lang === 'id' ? 'Base URL wajib diisi untuk provider Self-Hosted!' : 'Base URL is required for Self-Hosted provider!');
      return;
    }

    const res = addCustomApi({
      name: formName,
      provider: formProvider,
      baseUrl: formBaseUrl,
      apiKey: formApiKey,
      model: formModel,
      isActive: formIsActive,
    });

    if (!res.success) {
      showToast(res.error || (lang === 'id' ? 'Gagal menambahkan API' : 'Failed to add API'));
      return;
    }

    setCustomApis(getCustomApis());
    setIsAddFormOpen(false);
    setFormName('');
    setFormBaseUrl('https://api.openai.com/v1');
    setFormApiKey('');
    setFormModel('');
    setFormIsActive(true);
    showToast(lang === 'id' ? `API "${formName}" berhasil ditambahkan!` : `API "${formName}" added successfully!`);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(lang === 'id' ? `${label} berhasil disalin!` : `${label} copied to clipboard!`);
  };

  const selectLanguageOption = (selectedLang: Language) => {
    changeLanguage(selectedLang);
    showToast(selectedLang === 'id' ? 'Bahasa berhasil diubah ke Bahasa Indonesia!' : 'Language successfully switched to English!');
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 bg-black text-white flex flex-col font-sans overflow-hidden"
        >
          {/* Main List Menu View */}
          {currentView === 'menu' && (
            <div className="flex-1 overflow-y-auto w-full px-4 sm:px-6 md:px-8 py-6 max-w-2xl mx-auto flex flex-col">
              {/* Back & Title */}
              <div className="flex flex-col mb-8 mt-2">
                <button 
                  onClick={onClose} 
                  className="w-12 h-12 -ml-2 rounded-full flex items-center justify-center text-gray-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                  title={t.backToChat}
                >
                  <ArrowLeft size={24} />
                </button>
                <h1 className="text-3xl sm:text-4xl font-normal text-white mt-4 tracking-tight">
                  {t.settingsTitle}
                </h1>
              </div>

              {/* Settings Rows */}
              <div className="space-y-1">
                {/* 1. Info Akun (Interactive) */}
                <button
                  onClick={() => setCurrentView('account')}
                  className="w-full text-left flex items-start gap-5 py-4 px-3 rounded-2xl hover:bg-neutral-900/60 active:bg-neutral-800/55 transition-colors group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-gray-400 group-hover:text-blue-400 transition-colors">
                    <User size={22} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-medium text-white">{t.accountInfo}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{t.accountInfoDesc}</p>
                  </div>
                </button>

                {/* 2. Aktivitas (Interactive) */}
                <button
                  onClick={() => setCurrentView('activity')}
                  className="w-full text-left flex items-start gap-5 py-4 px-3 rounded-2xl hover:bg-neutral-900/60 active:bg-neutral-800/55 transition-colors group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-gray-400 group-hover:text-amber-400 transition-colors">
                    <Activity size={22} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-medium text-white">{t.activity}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{t.activityDesc}</p>
                  </div>
                </button>

                {/* 3. Batas Penggunaan (Interactive) */}
                <button
                  onClick={() => setCurrentView('usage')}
                  className="w-full text-left flex items-start gap-5 py-4 px-3 rounded-2xl hover:bg-neutral-900/60 active:bg-neutral-800/55 transition-colors group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-gray-400 group-hover:text-rose-400 transition-colors">
                    <Shield size={22} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-medium text-white">{t.usageLimits}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{t.usageLimitsDesc}</p>
                  </div>
                </button>

                {/* 4. Personalisasi (Interactive) */}
                <button
                  onClick={() => setCurrentView('personalization')}
                  className="w-full text-left flex items-start gap-5 py-4 px-3 rounded-2xl hover:bg-neutral-900/60 active:bg-neutral-800/55 transition-colors group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-gray-400 group-hover:text-[#1a73e8] transition-colors">
                    <Settings2 size={22} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-medium text-white">{t.personalization}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{t.personalizationDesc}</p>
                  </div>
                </button>

                {/* 5. Custom API (Interactive) */}
                <button
                  onClick={() => setCurrentView('custom_api')}
                  className="w-full text-left flex items-start gap-5 py-4 px-3 rounded-2xl hover:bg-neutral-900/60 active:bg-neutral-800/55 transition-colors group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-gray-400 group-hover:text-emerald-400 transition-colors">
                    <Key size={22} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-medium text-white">{t.customApi}</h3>
                      <span className="text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                        {customApis.length}/10 API
                      </span>
                      {customApis.some(a => a.isActive) && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {t.active}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{t.customApiDesc}</p>
                  </div>
                </button>

                {/* 6. Bahasa / Language (Interactive) */}
                <button
                  onClick={() => setCurrentView('language')}
                  className="w-full text-left flex items-start gap-5 py-4 px-3 rounded-2xl hover:bg-neutral-900/60 active:bg-neutral-800/55 transition-colors group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-gray-400 group-hover:text-cyan-400 transition-colors">
                    <Globe size={22} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-medium text-white">{t.language}</h3>
                      <span className="text-[11px] font-semibold uppercase bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded-full font-mono">
                        {lang === 'id' ? 'ID (Indonesia)' : 'EN (English)'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{t.languageDesc}</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Subview Integrations */}
          {currentView === 'integrations' && (
            <div className="flex-1 overflow-y-auto bg-black flex flex-col w-full h-full text-white">
              <IntegrationsPage onBack={() => setCurrentView('connected_apps')} isStandalone={false} />
            </div>
          )}

          {/* Subview Content */}
          {currentView !== 'menu' && currentView !== 'connected_apps' && currentView !== 'integrations' && (
            <div className="flex-1 overflow-y-auto bg-[#070708] flex flex-col w-full h-full text-white">
              {/* Header inside sub-screen */}
              <div className="border-b border-neutral-900 bg-[#0c0c0d] py-4 px-4 sm:px-6 sticky top-0 z-10 flex items-center">
                <button 
                  onClick={() => setCurrentView('menu')}
                  className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-gray-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={22} />
                </button>
                <span className="ml-3 font-medium text-lg text-white capitalize">
                  {currentView === 'account' && t.accountInfo}
                  {currentView === 'activity' && t.activity}
                  {currentView === 'usage' && t.usageLimits}
                  {currentView === 'personalization' && t.personalization}
                  {currentView === 'custom_api' && t.customApi}
                  {currentView === 'language' && t.language}
                </span>
              </div>

              {/* Sub-screen body container */}
              <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full">
                
                {/* View: LANGUAGE / BAHASA */}
                {currentView === 'language' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-normal text-white mb-1">{t.selectLanguage}</h3>
                      <p className="text-gray-400 text-sm">{t.languageDesc}</p>
                    </div>

                    <div className="space-y-3">
                      {/* Indonesian Option */}
                      <div 
                        onClick={() => selectLanguageOption('id')}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                          lang === 'id' 
                            ? "bg-cyan-950/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                            : "bg-[#0e0e10] border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/40"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-xl font-bold border border-neutral-800">
                            🇮🇩
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[16px] font-semibold text-white">Bahasa Indonesia</h4>
                              {lang === 'id' && (
                                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.2 rounded font-medium">
                                  {t.active}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">Bahasa Indonesia baku dan natural untuk seluruh antarmuka & respons</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          lang === 'id' ? "bg-cyan-500 border-cyan-400 text-black font-bold" : "border-neutral-700 group-hover:border-neutral-500"
                        )}>
                          {lang === 'id' && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>

                      {/* English Option */}
                      <div 
                        onClick={() => selectLanguageOption('en')}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                          lang === 'en' 
                            ? "bg-blue-950/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                            : "bg-[#0e0e10] border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/40"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-xl font-bold border border-neutral-800">
                            🇺🇸
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[16px] font-semibold text-white">English (US)</h4>
                              {lang === 'en' && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-medium">
                                  {t.active}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">Standard English for all UI menus, system prompts, and options</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          lang === 'en' ? "bg-blue-500 border-blue-400 text-white font-bold" : "border-neutral-700 group-hover:border-neutral-500"
                        )}>
                          {lang === 'en' && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* View A. INFO AKUN */}
                {currentView === 'account' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="flex flex-col items-center sm:items-start gap-6 border-b border-neutral-900 pb-8">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-neutral-900 group-hover:border-[#1a73e8] transition-colors relative shadow-inner">
                          <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={24} className="text-white" />
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          ref={fileInputRef} 
                          onChange={handlePicUpload}
                        />
                      </div>
                      <div className="text-center sm:text-left space-y-1">
                        <h4 className="text-xl font-medium text-white">TMPA User</h4>
                        <p className="text-sm text-gray-400">Klik gambar di atas untuk mengganti foto profil Anda</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Username</label>
                        <div className="bg-[#121214] p-4 rounded-xl border border-neutral-900 text-white font-medium text-[15px]">TMPA User</div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Email Terdaftar</label>
                        <div className="bg-[#121214] p-4 rounded-xl border border-neutral-900 text-white font-medium text-[15px]">user@tmpa.example</div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Identifier ID</label>
                        <div className="bg-[#121214] p-4 rounded-xl border border-neutral-900 text-gray-300 font-mono text-sm leading-relaxed">tmpa_usr_988319aa</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* View B. AKTIVITAS */}
                {currentView === 'activity' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-normal text-white mb-2">Riwayat Percakapan</h3>
                      <p className="text-gray-400 text-sm">Melihat penanda pertama kali Anda membuat chat dengan asisten.</p>
                    </div>

                    {chatSessions.length === 0 ? (
                      <div className="text-center py-16 text-gray-400 border border-dashed border-neutral-900 rounded-3xl bg-[#0c0c0d]">
                        Belum ada aktivitas obrolan atau sesi Anda kosong.
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {chatSessions.map((session) => (
                          <div key={session.id} className="bg-[#0e0e10] p-5 rounded-2xl border border-neutral-900 shadow-sm space-y-4">
                            <h4 className="text-base font-semibold text-white truncate leading-tight select-none">
                              {session.title || "Percakapan baru..."}
                            </h4>
                            <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-400 pt-2 border-t border-neutral-900">
                              <div className="flex items-center gap-2">
                                <Clock size={16} className="text-[#1a73e8]" />
                                <span>Dibuat: {formatDate(Number(session.id))}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-gray-400" />
                                <span>Diperbarui: {formatDate(session.updatedAt || Number(session.id))}</span>
                              </div>
                            </div>
                            <div className="inline-flex items-center bg-neutral-900 px-3 py-1 rounded-full text-xs font-medium text-gray-300 capitalize">
                              Model: {session.model === 'mistral_nemotron' ? 'Dilo' : session.model === 'qwen3_coder' ? 'tmpa v2' : 'tmpa v1'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* View C. BATAS PENGGUNAAN */}
                {currentView === 'usage' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-normal text-white mb-2">Batas Penggunaan Model Gabungan</h3>
                      <p className="text-gray-400 text-sm">Persentase gabungan penggunaan seluruh model yang akan meningkat setelah setiap permintaan, hingga mencapai 100%.</p>
                    </div>

                    <div className="bg-[#0e0e10] border border-neutral-900 rounded-2xl p-6 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-lg font-semibold text-white">Kuota Keseluruhan</h4>
                          <p className="text-xs text-gray-400">Dihitung berdasarkan model yang digunakan dan waktu real-time</p>
                        </div>
                        <button
                          onClick={resetUsage}
                          className="text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                        >
                          Reset Kuota
                        </button>
                      </div>
                      
                      <div className="space-y-6 mt-6">
                        <div>
                          <div className="flex justify-between text-xs font-medium text-white mb-1.5">
                            <span>Batas 5 Jam</span>
                            <span className={hourlyUsage >= 100 ? "text-red-400" : "text-blue-400"}>Terpakai {hourlyUsage.toFixed(1)}%</span>
                          </div>
                          <div className="h-4 bg-neutral-900 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                hourlyUsage >= 100 ? "bg-red-500" : hourlyUsage > 75 ? "bg-amber-500" : "bg-blue-500"
                              )} 
                              style={{ width: `${hourlyUsage}%` }} 
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-medium text-white mb-1.5">
                            <span>Batas Mingguan</span>
                            <span className={weeklyUsage >= 100 ? "text-red-400" : "text-emerald-400"}>Terpakai {weeklyUsage.toFixed(1)}%</span>
                          </div>
                          <div className="h-4 bg-neutral-900 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                weeklyUsage >= 100 ? "bg-red-500" : weeklyUsage > 75 ? "bg-amber-500" : "bg-emerald-500"
                              )} 
                              style={{ width: `${weeklyUsage}%` }} 
                            />
                          </div>
                        </div>

                        {(hourlyUsage >= 100 || weeklyUsage >= 100) && (
                          <p className="text-red-400 text-xs mt-3 bg-red-950/20 p-3 rounded-lg border border-red-900/30">
                            Anda telah mencapai batas penggunaan. Semua model sementara dinonaktifkan.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#0e0e10] border border-neutral-900 rounded-2xl p-6 shadow-sm">
                      <h4 className="text-base font-semibold text-white mb-1">Konsumsi Kuota Tiap Model</h4>
                      <p className="text-xs text-gray-400 mb-4">Pengurangan kuota otomatis dicatat ke basis data setiap kali AI membalas pesan Anda</p>
                      
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">Tmpa ai v2</span>
                            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded">Vision Ready</span>
                          </div>
                          <div className="text-[11px] text-gray-400 space-y-1">
                            <div className="flex justify-between">
                              <span>Non-Vision:</span>
                              <span className="text-gray-200 font-mono">13% (5h) · 10% (w)</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Vision:</span>
                              <span className="text-cyan-300 font-mono font-medium">19% (5h) · 14% (w)</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">Tmpa ai v1</span>
                            <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-800/50 px-1.5 py-0.5 rounded">Standar</span>
                          </div>
                          <div className="text-[11px] text-gray-400 space-y-1">
                            <div className="flex justify-between">
                              <span>Per 5 Jam:</span>
                              <span className="text-gray-200 font-mono">12%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Mingguan:</span>
                              <span className="text-gray-200 font-mono">9%</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">Dilo</span>
                            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded">Hemat</span>
                          </div>
                          <div className="text-[11px] text-gray-400 space-y-1">
                            <div className="flex justify-between">
                              <span>Per 5 Jam:</span>
                              <span className="text-gray-200 font-mono">8%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Mingguan:</span>
                              <span className="text-gray-200 font-mono">6%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* (custom API limit) Card */}
                    <div className="bg-[#0e0e10] border border-neutral-900 rounded-2xl p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-white">(custom API limit)</h4>
                            <span className="text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                              10 req/menit · 50 req/hari
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Batas kuota otomatis saat Anda menggunakan Custom API yang terhubung</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentView('custom_api')}
                            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline px-2 py-1"
                          >
                            Kelola API &rarr;
                          </button>
                          <button
                            onClick={() => {
                              resetCustomApiUsage();
                              setCustomUsage(getCustomApiUsageStats());
                              showToast('Limit Custom API berhasil direset!');
                            }}
                            className="text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-gray-300 border border-neutral-800 px-3 py-1.5 rounded-lg transition"
                          >
                            Reset Custom
                          </button>
                        </div>
                      </div>

                      <div className="space-y-5">
                        {/* 10 request permenit */}
                        <div>
                          <div className="flex justify-between text-xs font-medium text-white mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              Batas Per Menit (10 request/menit)
                            </span>
                            <span className={customUsage.minuteCount >= 10 ? "text-red-400 font-semibold font-mono" : "text-emerald-400 font-mono"}>
                              {customUsage.minuteCount} / 10 request ({Math.round((customUsage.minuteCount / 10) * 100)}%)
                            </span>
                          </div>
                          <div className="h-3.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-neutral-800/60">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                customUsage.minuteCount >= 10 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" : customUsage.minuteCount > 7 ? "bg-amber-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              )} 
                              style={{ width: `${Math.min(100, (customUsage.minuteCount / 10) * 100)}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                            <span>Sisa: {customUsage.minuteRemaining} request menit ini</span>
                            <span>Reset: Otomatis setiap 60 detik</span>
                          </div>
                        </div>

                        {/* 50 request per hari */}
                        <div>
                          <div className="flex justify-between text-xs font-medium text-white mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                              Batas Per Hari (50 request/hari)
                            </span>
                            <span className={customUsage.dailyCount >= 50 ? "text-red-400 font-semibold font-mono" : "text-emerald-400 font-mono"}>
                              {customUsage.dailyCount} / 50 request ({Math.round((customUsage.dailyCount / 50) * 100)}%)
                            </span>
                          </div>
                          <div className="h-3.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-neutral-800/60">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                customUsage.dailyCount >= 50 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" : customUsage.dailyCount > 40 ? "bg-amber-500" : "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                              )} 
                              style={{ width: `${Math.min(100, (customUsage.dailyCount / 50) * 100)}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                            <span>Sisa: {customUsage.dailyRemaining} request hari ini</span>
                            <span>Reset: 24 jam</span>
                          </div>
                        </div>

                        {(customUsage.minuteCount >= 10 || customUsage.dailyCount >= 50) && (
                          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
                            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                            <span>Batas Custom API tercapai ({customUsage.minuteCount >= 10 ? '10 request/menit' : '50 request/hari'}). Harap tunggu periode reset.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* View D. PERSONALISASI */}
                {currentView === 'personalization' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-normal text-white mb-1">Pengaturan Tambahan</h3>
                      <p className="text-gray-400 text-sm">Sesuaikan gaya interaksi AI yang bekerja di belakang layar obrolan Anda.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-white block">Instruksi Kustom Sistem AI</label>
                      <textarea 
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder="Contoh: 'Berbicaralah dengan nada santai', 'Selalu gunakan bahasa ramah kepada saya', dll..."
                        className="w-full h-36 bg-[#161619] border border-neutral-800 rounded-xl p-4 text-white hover:border-neutral-700 focus:bg-[#0c0c0d] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-none transition-all resize-y text-[15px]"
                      />
                      <p className="text-xs text-gray-400 leading-relaxed">Peraturan bawaan sistem kami akan tetap diterapkan secara ketat demi keamanan, namun petunjuk tambahan dari Anda akan disisipkan langsung setelah peraturan tersebut.</p>
                    </div>

                    <div className="pt-8 border-t border-neutral-900">
                      <button 
                        onClick={() => setCurrentView('connected_apps')}
                        className="w-full text-left bg-gradient-to-r from-neutral-900 to-[#151518] hover:bg-gradient-to-r hover:from-neutral-800 hover:to-[#17171a] active:from-neutral-900 border border-neutral-800 rounded-2xl p-5 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-[#1a73e8]/20 text-[#1a73e8] p-2.5 rounded-xl group-hover:scale-105 transition-transform">
                            <Link2 size={24} />
                          </div>
                          <div>
                            <h4 className="text-[17px] font-semibold text-white">Aplikasi / Web Terhubung</h4>
                            <p className="text-xs text-gray-400 mt-1">Gunakan produk kami secara lancar dan terintegrasi</p>
                          </div>
                        </div>
                        <ArrowLeft size={18} className="rotate-180 text-gray-400 group-hover:translate-x-1 transition-all group-hover:text-[#1a73e8]" />
                      </button>
                    </div>
                  </div>
                )}

                {/* View E. CUSTOM API */}
                {currentView === 'custom_api' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-2xl font-normal text-white">Custom API</h3>
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
                            {customApis.length} / {MAX_CUSTOM_APIS} API
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1">
                          Kelola hingga maksimal {MAX_CUSTOM_APIS} API. Kartu dengan warna hijau di sebelah kiri menandakan API aktif & digunakan.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (customApis.length >= MAX_CUSTOM_APIS) {
                            showToast(`Maksimal ${MAX_CUSTOM_APIS} API telah tercapai!`);
                            return;
                          }
                          setIsAddFormOpen(prev => !prev);
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition cursor-pointer whitespace-nowrap",
                          customApis.length >= MAX_CUSTOM_APIS
                            ? "bg-neutral-800 text-gray-500 cursor-not-allowed"
                            : isAddFormOpen 
                              ? "bg-neutral-800 text-gray-200 hover:bg-neutral-700" 
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/60"
                        )}
                      >
                        <Plus size={18} className={isAddFormOpen ? "rotate-45 transition-transform" : "transition-transform"} />
                        <span>{isAddFormOpen ? 'Tutup Formulir' : 'Tambah API Baru'}</span>
                      </button>
                    </div>

                    {/* Rate Limit Summary Banner */}
                    <div className="bg-[#0e0e10] border border-emerald-900/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 mt-0.5">
                          <Cpu size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">(custom API limit)</span>
                            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full font-mono">
                              10 req/min · 50 req/hari
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Status Kuota: <span className="text-emerald-300 font-mono">{customUsage.minuteRemaining}/10 sisa menit ini</span> · <span className="text-teal-300 font-mono">{customUsage.dailyRemaining}/50 sisa hari ini</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            resetCustomApiUsage();
                            setCustomUsage(getCustomApiUsageStats());
                            showToast('Log limit Custom API berhasil direset!');
                          }}
                          className="w-full sm:w-auto text-xs text-gray-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition"
                          title="Reset Penghitung Limit"
                        >
                          <RefreshCw size={13} />
                          <span>Reset Limit</span>
                        </button>
                      </div>
                    </div>

                    {/* Form Tambah API */}
                    <AnimatePresence>
                      {isAddFormOpen && (
                        <motion.form
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          onSubmit={handleSaveNewApi}
                          className="bg-[#0e0e10] border border-emerald-800/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl overflow-hidden"
                        >
                          <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                            <h4 className="text-base font-semibold text-white flex items-center gap-2">
                              <Key size={18} className="text-emerald-400" />
                              Tambah Custom API ({customApis.length + 1} dari {MAX_CUSTOM_APIS})
                            </h4>
                            <span className="text-xs text-gray-400">Maks. 10 API</span>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1.5">
                                Nama API / Label <span className="text-red-400">*</span>
                              </label>
                              <input 
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Contoh: OpenAI GPT-4o, Groq Llama, dll."
                                className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm"
                                required
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1.5">
                                Provider / Layanan <span className="text-red-400">*</span>
                              </label>
                              <select 
                                value={formProvider}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  setFormProvider(selectedId);
                                  const preset = getProviderPreset(selectedId);
                                  if (preset) {
                                    setFormBaseUrl(preset.defaultBaseUrl);
                                    if (preset.sampleModels && preset.sampleModels.length > 0 && !formModel) {
                                      setFormModel(preset.sampleModels[0]);
                                    }
                                  }
                                }}
                                className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-sm font-medium"
                              >
                                <optgroup label="── Cloud AI Providers ──" className="bg-[#121214] text-gray-300 font-semibold">
                                  {PROVIDER_PRESETS.filter(p => !p.isSelfHosted).map((p) => (
                                    <option key={p.id} value={p.id} className="text-white py-1">
                                      {p.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="── Self-Hosted & Local Engine ──" className="bg-[#121214] text-emerald-400 font-semibold">
                                  {PROVIDER_PRESETS.filter(p => p.isSelfHosted).map((p) => (
                                    <option key={p.id} value={p.id} className="text-white py-1">
                                      {p.name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1.5">
                                API Key / Bearer Token <span className="text-red-400">*</span>
                              </label>
                              <input 
                                type="password"
                                value={formApiKey}
                                onChange={(e) => setFormApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm font-mono"
                                required
                              />
                              <p className="text-[11px] text-gray-500 mt-1">
                                {isCurrentSelfHost ? 'Untuk Ollama/LocalAI bisa diisi token atau teks sembarang.' : 'Kunci API rahasia dari akun provider Anda.'}
                              </p>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                                  Model ID <span className="text-red-400">*</span>
                                </label>
                                <span className="text-[10px] text-emerald-400 font-mono">Wajib untuk Edge Function</span>
                              </div>
                              <input 
                                type="text"
                                value={formModel}
                                onChange={(e) => setFormModel(e.target.value)}
                                placeholder={selectedPreset.placeholderModel}
                                className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm font-mono"
                                required
                              />
                              {selectedPreset.sampleModels && selectedPreset.sampleModels.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                  <span className="text-[10px] text-gray-500">Pilihan cepat:</span>
                                  {selectedPreset.sampleModels.map(m => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setFormModel(m)}
                                      className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-md border font-mono transition cursor-pointer",
                                        formModel === m
                                          ? "bg-emerald-950 text-emerald-300 border-emerald-600 font-semibold"
                                          : "bg-neutral-900 text-gray-400 border-neutral-800 hover:text-white hover:border-neutral-700"
                                      )}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                                Base URL / Endpoint {isCurrentSelfHost ? <span className="text-red-400 font-bold">* (Wajib untuk Self-Hosted)</span> : <span className="text-gray-500 font-normal">(Opsional untuk Cloud)</span>}
                              </label>
                              {isCurrentSelfHost ? (
                                <span className="text-[10px] bg-red-950/80 text-red-300 border border-red-800/50 px-2 py-0.5 rounded font-mono">
                                  Wajib Diisi
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  Default: {selectedPreset.defaultBaseUrl || 'Standar Provider'}
                                </span>
                              )}
                            </div>
                            <input 
                              type="text"
                              value={formBaseUrl}
                              onChange={(e) => setFormBaseUrl(e.target.value)}
                              placeholder={isCurrentSelfHost ? "Contoh: http://localhost:11434/v1 atau http://IP_VPS:8000/v1" : (selectedPreset.defaultBaseUrl || "https://api.openai.com/v1")}
                              className={cn(
                                "w-full bg-[#161619] border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none text-sm font-mono transition",
                                isCurrentSelfHost 
                                  ? "border-emerald-800/70 focus:border-emerald-500" 
                                  : "border-neutral-800 focus:border-emerald-500"
                              )}
                              required={isCurrentSelfHost}
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                              {isCurrentSelfHost 
                                ? '⚠️ Provider Self-Hosted memerlukan Base URL lengkap (misal Ollama: http://localhost:11434/v1, vLLM: http://localhost:8000/v1).'
                                : 'Opsional. Jika dikosongkan, sistem akan otomatis menggunakan Base URL resmi provider tersebut.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input 
                              type="checkbox"
                              id="formIsActive"
                              checked={formIsActive}
                              onChange={(e) => setFormIsActive(e.target.checked)}
                              className="w-4 h-4 rounded text-emerald-600 bg-neutral-900 border-neutral-700 focus:ring-emerald-500 focus:ring-offset-black cursor-pointer"
                            />
                            <label htmlFor="formIsActive" className="text-sm text-gray-300 cursor-pointer select-none">
                              Jadikan API ini langsung aktif dan digunakan
                            </label>
                          </div>

                          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-900">
                            <button
                              type="button"
                              onClick={() => setIsAddFormOpen(false)}
                              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-neutral-900 transition"
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              className="px-5 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-950"
                            >
                              Simpan API
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* List API Cards */}
                    <div className="space-y-3.5">
                      {customApis.length === 0 ? (
                        <div className="text-center py-16 px-4 border border-dashed border-neutral-900 rounded-3xl bg-[#0c0c0d] space-y-3">
                          <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-gray-500 mx-auto">
                            <Key size={22} />
                          </div>
                          <div>
                            <h4 className="text-base font-medium text-white">Belum Ada Custom API</h4>
                            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                              Tambahkan hingga 10 API kustom untuk menghubungkan endpoint AI Anda sendiri dengan limit 10 req/menit & 50 req/hari.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsAddFormOpen(true)}
                            className="inline-flex items-center gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition cursor-pointer shadow-md"
                          >
                            <Plus size={16} />
                            <span>Tambah API Pertama</span>
                          </button>
                        </div>
                      ) : (
                        customApis.map((api) => {
                          const isKeyVisible = visibleKeyIds[api.id] || false;
                          const maskedKey = api.apiKey.length > 8 
                            ? api.apiKey.substring(0, 4) + '••••••••••••' + api.apiKey.substring(api.apiKey.length - 4)
                            : '••••••••••••';

                          return (
                            <div 
                              key={api.id}
                              className={cn(
                                "group relative bg-[#0e0e10] rounded-2xl border transition-all duration-300 shadow-sm flex overflow-hidden",
                                api.isActive 
                                  ? "border-emerald-600/70 bg-gradient-to-r from-emerald-950/20 via-[#0e0e10] to-[#0e0e10] shadow-[0_0_20px_rgba(16,185,129,0.08)]" 
                                  : "border-neutral-900 hover:border-neutral-800 hover:bg-[#121214]"
                              )}
                            >
                              {/* Indikator Hijau di Kiri Card API (Bisa diklik untuk on/off) */}
                              <div 
                                onClick={() => handleToggleActive(api.id, api.name)}
                                title={api.isActive ? "Klik untuk mematikan API ini" : "Klik untuk mengaktifkan & menggunakan API ini"}
                                className={cn(
                                  "w-3.5 sm:w-4 flex-shrink-0 cursor-pointer transition-all duration-300 flex items-center justify-center relative",
                                  api.isActive 
                                    ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" 
                                    : "bg-neutral-800 hover:bg-neutral-700"
                                )}
                              >
                                {api.isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm animate-ping opacity-75" />
                                )}
                              </div>

                              {/* Isi Card */}
                              <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <h4 className="text-base font-semibold text-white">{api.name}</h4>
                                      <span className="text-[11px] bg-neutral-900 text-gray-300 border border-neutral-800 px-2 py-0.5 rounded-md font-medium">
                                        {api.provider}
                                      </span>
                                      {api.model && (
                                        <span className="text-[11px] bg-blue-950/60 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded-md font-mono">
                                          {api.model}
                                        </span>
                                      )}
                                    </div>
                                    {api.baseUrl && (
                                      <p className="text-xs text-gray-400 font-mono truncate max-w-md">
                                        {api.baseUrl}
                                      </p>
                                    )}
                                  </div>

                                  {/* Tombol Toggle & Hapus */}
                                  <div className="flex items-center gap-2 self-start">
                                    <button
                                      onClick={() => handleToggleActive(api.id, api.name)}
                                      className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                                        api.isActive
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-700/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                          : "bg-neutral-900 text-gray-400 border border-neutral-800 hover:text-white hover:bg-neutral-800"
                                      )}
                                    >
                                      <span className={cn("w-2 h-2 rounded-full", api.isActive ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
                                      <span>{api.isActive ? 'Aktif Digunakan' : 'Klik Aktifkan'}</span>
                                    </button>

                                    <button
                                      onClick={() => handleDeleteApi(api.id, api.name)}
                                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/40 rounded-lg transition cursor-pointer"
                                      title="Hapus API ini"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* API Key Masked Box */}
                                <div className="flex items-center justify-between bg-[#070708] border border-neutral-900 rounded-xl px-3.5 py-2 text-xs">
                                  <div className="flex items-center gap-2 truncate font-mono text-gray-300">
                                    <span className="text-gray-500">Key:</span>
                                    <span>{isKeyVisible ? api.apiKey : maskedKey}</span>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                    <button
                                      onClick={() => toggleKeyVisibility(api.id)}
                                      className="p-1 text-gray-400 hover:text-white transition rounded"
                                      title={isKeyVisible ? "Sembunyikan Key" : "Tampilkan Key"}
                                    >
                                      {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(api.apiKey, 'API Key')}
                                      className="p-1 text-gray-400 hover:text-white transition rounded"
                                      title="Salin Key"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-4 bg-neutral-900/40 border border-neutral-900 rounded-xl text-xs text-gray-400 flex items-start gap-2.5">
                      <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-300 font-medium">Petunjuk Penggunaan Custom API:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-400">
                          <li>Maksimal hingga 10 API yang dapat disimpan.</li>
                          <li>Warna hijau di sisi kiri kartu menandakan API sedang aktif digunakan.</li>
                          <li>Klik kartu atau tombol toggle untuk mematikan / menyalakan API kapan saja.</li>
                          <li>Limit penggunaan Custom API adalah <strong>10 request per menit</strong> dan <strong>50 request per hari</strong>.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connected Apps & MCP Hub Screen */}
          {currentView === 'connected_apps' && (
            <div className="flex-1 overflow-y-auto bg-[#070708] flex flex-col w-full h-full text-white">
              {/* Header inside sub-screen */}
              <div className="border-b border-neutral-900 bg-[#0c0c0d] py-4 px-4 sm:px-6 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center">
                  <button 
                    onClick={() => setCurrentView('personalization')}
                    className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-gray-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={22} />
                  </button>
                  <span className="ml-3 font-medium text-lg text-white">
                    {t.connectedApps}
                  </span>
                </div>
              </div>

              {/* Sub-screen body container */}
              <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full space-y-6">
                
                {/* 1. MCP Hub Featured Card */}
                <div className="bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-[#0e0e12] border border-blue-900/40 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none group-hover:bg-blue-500/15 transition-all" />
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-2xl">
                        <Layers size={26} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-semibold text-white">{t.mcpHubTitle}</h4>
                        </div>
                        <span className="text-[11px] font-medium text-blue-400 font-mono">
                          {t.connectedStatusBadge}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 leading-relaxed">
                    {t.mcpIntroText}
                  </p>

                  {/* Platforms mini preview badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { name: 'Supabase', color: 'text-emerald-400 border-emerald-800/40 bg-emerald-950/40' },
                      { name: 'Google', color: 'text-red-400 border-red-800/40 bg-red-950/40' },
                      { name: 'GitHub', color: 'text-gray-300 border-gray-700/40 bg-gray-900/60' },
                      { name: 'Vercel', color: 'text-white border-neutral-700 bg-neutral-900' },
                      { name: 'Figma', color: 'text-purple-400 border-purple-800/40 bg-purple-950/40' },
                      { name: 'Canva', color: 'text-cyan-400 border-cyan-800/40 bg-cyan-950/40' },
                      { name: 'Airtable', color: 'text-amber-400 border-amber-800/40 bg-amber-950/40' },
                      { name: 'Netlify', color: 'text-teal-400 border-teal-800/40 bg-teal-950/40' }
                    ].map((p, idx) => (
                      <span key={idx} className={cn("text-xs px-2.5 py-1 rounded-lg border font-medium", p.color)}>
                        {p.name}
                      </span>
                    ))}
                    <span className="text-xs px-2.5 py-1 rounded-lg border border-neutral-800 bg-neutral-900/40 text-gray-400 font-mono">
                      +3 lagi
                    </span>
                  </div>

                  {/* Open MCP Settings Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => setCurrentView('integrations')}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl font-medium transition-all shadow-lg shadow-blue-900/30 cursor-pointer text-sm"
                    >
                      <Layers size={18} />
                      <span>{t.openMcpIntegrations}</span>
                      <ArrowLeft size={16} className="rotate-180 ml-1" />
                    </button>
                  </div>
                </div>

                {/* 2. Connected Web Ecosystem Links */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                    {lang === 'id' ? 'Ekosistem Layanan Web TMPA' : 'TMPA Web Ecosystem'}
                  </h4>

                  {/* Main Website TMPA Link */}
                  <a
                    href="https://tmpa.my.id"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-4 bg-[#0e0e10] hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-neutral-900 text-gray-300 group-hover:text-blue-400 rounded-xl border border-neutral-800 transition-colors">
                        <Globe size={20} />
                      </div>
                      <div>
                        <h5 className="text-[15px] font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {t.mainWebsite}
                        </h5>
                        <p className="text-xs text-gray-400 mt-0.5">https://tmpa.my.id</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                  </a>

                  {/* Store Link */}
                  <div
                    onClick={() => showToast(lang === 'id' ? 'Membuka TMPA Store...' : 'Opening TMPA Store...')}
                    className="w-full flex items-center justify-between p-4 bg-[#0e0e10] hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-neutral-900 text-gray-300 group-hover:text-amber-400 rounded-xl border border-neutral-800 transition-colors">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h5 className="text-[15px] font-semibold text-white group-hover:text-amber-400 transition-colors">
                          {t.store}
                        </h5>
                        <p className="text-xs text-gray-400 mt-0.5">TMPA Store & Marketplace AI Models</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-lg">
                      {t.active}
                    </span>
                  </div>
                </div>

                {/* 3. Mascot Brand Artwork Card */}
                <div className="bg-[#0b0b0e] border border-neutral-900 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-3 mt-4">
                  <img 
                    src="https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/Video%20atau%20asset/T_20260602_194527_0000.png" 
                    alt="TMPA Mascot" 
                    className="w-24 h-24 object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h5 className="text-sm font-semibold text-white">TMPA Connected Intelligence</h5>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      {lang === 'id' 
                        ? 'Semua data dan integrasi MCP terenkripsi dan terlindungi di bawah standar privasi TMPA.'
                        : 'All data and MCP integrations are securely encrypted under TMPA privacy standards.'}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Subtle Clean Interactive Toast Box */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1f1f1f] text-white text-sm py-3 px-5 rounded-full flex items-center gap-2 shadow-2xl tracking-normal border border-neutral-800 whitespace-nowrap"
              >
                <Check size={16} className="text-emerald-400 stroke-[3]" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
