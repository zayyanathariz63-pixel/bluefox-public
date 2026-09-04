import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Activity, Shield, Settings2, Link2, 
  Camera, Clock, Calendar, Volume2, Globe, Sparkles, Smartphone, Check,
  Key, Plus, Trash2, Eye, EyeOff, Copy, AlertCircle, RefreshCw, Cpu, Layers, ExternalLink, RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { IntegrationsPage } from './IntegrationsPage';
import { useLanguage, Language } from '../lib/i18n';
import { getModelDisplayName } from '../lib/supabase';
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
          className="fixed inset-0 z-50 bg-white text-slate-900 flex flex-col font-sans overflow-hidden app-clean-grid"
        >
          {/* Main List Menu View */}
          {currentView === 'menu' && (
            <div className="flex-1 overflow-y-auto w-full px-4 sm:px-6 md:px-8 py-6 max-w-2xl mx-auto flex flex-col">
              {/* Back & Title */}
              <div className="flex flex-col mb-8 mt-2">
                <button 
                  onClick={onClose} 
                  className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title={t.backToChat}
                >
                  <ArrowLeft size={22} />
                </button>
                <h1 className="text-3xl sm:text-4xl font-normal text-slate-900 mt-4 tracking-tight">
                  {t.settingsTitle}
                </h1>
              </div>

              {/* Settings Rows */}
              <div className="space-y-1.5">
                {/* 1. Info Akun (Interactive) */}
                <button
                  onClick={() => setCurrentView('account')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50">
                    <User size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.accountInfo}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.accountInfoDesc}</p>
                  </div>
                </button>

                {/* 2. Aktivitas (Interactive) */}
                <button
                  onClick={() => setCurrentView('activity')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-amber-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-amber-50">
                    <Activity size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.activity}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.activityDesc}</p>
                  </div>
                </button>

                {/* 3. Batas Penggunaan (Interactive) */}
                <button
                  onClick={() => setCurrentView('usage')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-rose-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-rose-50">
                    <Shield size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.usageLimits}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.usageLimitsDesc}</p>
                  </div>
                </button>

                {/* 4. Personalisasi (Interactive) */}
                <button
                  onClick={() => setCurrentView('personalization')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50">
                    <Settings2 size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.personalization}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.personalizationDesc}</p>
                  </div>
                </button>

                {/* 5. Custom API (Interactive) */}
                <button
                  onClick={() => setCurrentView('custom_api')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-emerald-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-emerald-50">
                    <Key size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900">{t.customApi}</h3>
                      <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {customApis.length}/10 API
                      </span>
                      {customApis.some(a => a.isActive) && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t.active}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{t.customApiDesc}</p>
                  </div>
                </button>

                {/* 6. Bahasa / Language (Interactive) */}
                <button
                  onClick={() => setCurrentView('language')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-cyan-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-cyan-50">
                    <Globe size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900">{t.language}</h3>
                      <span className="text-[11px] font-semibold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full font-mono">
                        {lang === 'id' ? 'ID (Indonesia)' : 'EN (English)'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{t.languageDesc}</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Subview Integrations */}
          {currentView === 'integrations' && (
            <div className="flex-1 overflow-y-auto bg-white flex flex-col w-full h-full text-slate-900 app-clean-grid">
              <IntegrationsPage onBack={() => setCurrentView('connected_apps')} isStandalone={false} />
            </div>
          )}

          {/* Subview Content */}
          {currentView !== 'menu' && currentView !== 'connected_apps' && currentView !== 'integrations' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col w-full h-full text-slate-900">
              {/* Header inside sub-screen */}
              <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md py-4 px-4 sm:px-6 sticky top-0 z-10 flex items-center shadow-xs">
                <button 
                  onClick={() => setCurrentView('menu')}
                  className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={22} />
                </button>
                <span className="ml-3 font-semibold text-lg text-slate-900 capitalize">
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
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">{t.selectLanguage}</h3>
                      <p className="text-slate-500 text-sm">{t.languageDesc}</p>
                    </div>

                    <div className="space-y-3">
                      {/* Indonesian Option */}
                      <div 
                        onClick={() => selectLanguageOption('id')}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                          lang === 'id' 
                            ? "bg-cyan-50 border-cyan-400 shadow-sm" 
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center text-xs font-bold font-mono text-cyan-800 border border-cyan-200 shadow-xs">
                            ID
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[16px] font-semibold text-slate-900">Bahasa Indonesia</h4>
                              {lang === 'id' && (
                                <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-300 px-1.5 py-0.2 rounded font-medium">
                                  {t.active}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Bahasa Indonesia baku dan natural untuk seluruh antarmuka & respons</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          lang === 'id' ? "bg-cyan-600 border-cyan-600 text-white font-bold" : "border-slate-300 group-hover:border-slate-400"
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
                            ? "bg-blue-50 border-blue-400 shadow-sm" 
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xs font-bold font-mono text-blue-800 border border-blue-200 shadow-xs">
                            EN
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[16px] font-semibold text-slate-900">English (US)</h4>
                              {lang === 'en' && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.2 rounded font-medium">
                                  {t.active}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Standard English for all UI menus, system prompts, and options</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          lang === 'en' ? "bg-blue-600 border-blue-600 text-white font-bold" : "border-slate-300 group-hover:border-slate-400"
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
                    <div className="flex flex-col sm:items-center sm:flex-row gap-6 border-b border-slate-200 pb-8">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md group-hover:border-blue-500 transition-colors relative">
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
                      <div className="text-left space-y-1">
                        <h4 className="text-xl font-bold text-slate-900">TMPA User</h4>
                        <p className="text-sm text-slate-500">
                          {lang === 'id' ? 'Klik gambar di atas untuk mengganti foto profil Anda' : 'Click the image above to change your profile picture'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Username</label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-900 font-semibold text-[15px] shadow-xs">TMPA User</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          {lang === 'id' ? 'Email Terdaftar' : 'Registered Email'}
                        </label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-900 font-semibold text-[15px] shadow-xs">user@tmpa.example</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Identifier ID</label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-600 font-mono text-sm leading-relaxed shadow-xs">tmpa_usr_988319aa</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* View B. AKTIVITAS */}
                {currentView === 'activity' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {lang === 'id' ? 'Riwayat Percakapan' : 'Conversation History'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Melihat penanda sesi obrolan Anda dengan asisten.' : 'View session history of your conversations with the assistant.'}
                      </p>
                    </div>

                    {chatSessions.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 border border-dashed border-slate-300 rounded-3xl bg-white">
                        {lang === 'id' ? 'Belum ada aktivitas obrolan atau sesi Anda kosong.' : 'No chat activity or sessions found.'}
                      </div>
                    ) : (
                      <div className="grid gap-3.5">
                        {chatSessions.map((session) => (
                          <div key={session.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h4 className="text-base font-bold text-slate-900 truncate leading-tight select-none">
                              {session.title || (lang === 'id' ? "Percakapan baru..." : "New conversation...")}
                            </h4>
                            <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-blue-600" />
                                <span>{lang === 'id' ? 'Dibuat:' : 'Created:'} {formatDate(Number(session.id))}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span>{lang === 'id' ? 'Diperbarui:' : 'Updated:'} {formatDate(session.updatedAt || Number(session.id))}</span>
                              </div>
                            </div>
                            <div className="inline-flex items-center bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-700 capitalize">
                              Model: {getModelDisplayName(session.model)}
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
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {lang === 'id' ? 'Batas Penggunaan Model & Pencarian' : 'Model & Search Usage Limits'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Persentase gabungan penggunaan seluruh model dan pencarian web yang diakumulasikan per permintaan.' : 'Combined usage percentage of models and web search accumulated per request.'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-lg font-bold text-slate-900">{lang === 'id' ? 'Kuota Keseluruhan' : 'Total Quota'}</h4>
                          <p className="text-xs text-slate-500">{lang === 'id' ? 'Dihitung berdasarkan model dan pencarian yang digunakan' : 'Calculated based on models and searches used'}</p>
                        </div>
                        <button
                          onClick={() => {
                            resetUsage();
                            showToast(lang === 'id' ? 'Kuota dan limit penggunaan berhasil direset ke 0%!' : 'Usage limits successfully reset to 0%!');
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>Reset Kuota (Dev)</span>
                        </button>
                      </div>
                      
                      <div className="space-y-5 mt-6">
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-900 mb-1.5">
                            <span>{lang === 'id' ? 'Batas 5 Jam' : '5-Hour Limit'}</span>
                            <span className={hourlyUsage >= 100 ? "text-rose-600 font-bold" : "text-blue-600 font-bold"}>
                              {lang === 'id' ? `Terpakai ${hourlyUsage.toFixed(1)}%` : `Used ${hourlyUsage.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                hourlyUsage >= 100 ? "bg-rose-500" : hourlyUsage > 75 ? "bg-amber-500" : "bg-blue-600"
                              )} 
                              style={{ width: `${hourlyUsage}%` }} 
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-900 mb-1.5">
                            <span>{lang === 'id' ? 'Batas Mingguan' : 'Weekly Limit'}</span>
                            <span className={weeklyUsage >= 100 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                              {lang === 'id' ? `Terpakai ${weeklyUsage.toFixed(1)}%` : `Used ${weeklyUsage.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                weeklyUsage >= 100 ? "bg-rose-500" : weeklyUsage > 75 ? "bg-amber-500" : "bg-emerald-600"
                              )} 
                              style={{ width: `${weeklyUsage}%` }} 
                            />
                          </div>
                        </div>

                        {(hourlyUsage >= 100 || weeklyUsage >= 100) && (
                          <div className="text-rose-700 text-xs mt-3 bg-rose-50 p-3.5 rounded-xl border border-rose-200 flex items-start gap-2">
                            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                            <span>{lang === 'id' ? 'Anda telah mencapai batas penggunaan. Semua model sementara dinonaktifkan.' : 'You have reached the usage limit. Models are temporarily paused.'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rincian Tarif Model & Pencarian */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          {lang === 'id' ? 'Rincian Tarif Limit Pencarian Web' : 'Web Search Usage Limit Rates'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {lang === 'id' ? 'Konsumsi kuota pencarian per 5 jam dan per minggu' : 'Search quota consumption per 5 hours and per week'}
                        </p>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left text-slate-700">
                          <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3.5">Jenis Pencarian</th>
                              <th className="py-2.5 px-3.5 text-blue-700">Per 5 Jam</th>
                              <th className="py-2.5 px-3.5 text-emerald-700">Per Minggu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Advanced search</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">10%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">5%</td>
                            </tr>
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Standard search</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">5%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">3%</td>
                            </tr>
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Map search advanced</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">13%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">7%</td>
                            </tr>
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Map standard search</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">7%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">4%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="pt-2">
                        <h4 className="text-base font-bold text-slate-900 mb-1">
                          {lang === 'id' ? 'Rincian Tarif Model AI' : 'AI Model Usage Rates'}
                        </h4>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-xs text-left text-slate-700">
                            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3.5">Nama Model</th>
                                <th className="py-2.5 px-3.5 text-blue-700">Per 5 Jam</th>
                                <th className="py-2.5 px-3.5 text-emerald-700">Per Minggu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox pro (Vision Aktif)</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">19%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">14%</td>
                              </tr>
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox pro (Standar Teks)</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">13%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">10%</td>
                              </tr>
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox standard</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">12%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">9%</td>
                              </tr>
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox Dilo</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">8%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">6%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* (custom API limit) Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-slate-900">(custom API limit)</h4>
                            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                              10 req/min · 50 req/day
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {lang === 'id' ? 'Batas kuota otomatis saat Anda menggunakan Custom API yang terhubung' : 'Automated rate limit when utilizing connected Custom APIs'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentView('custom_api')}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline px-2 py-1 cursor-pointer"
                          >
                            {lang === 'id' ? 'Kelola API →' : 'Manage API →'}
                          </button>
                          <button
                            onClick={() => {
                              resetCustomApiUsage();
                              setCustomUsage(getCustomApiUsageStats());
                              showToast(lang === 'id' ? 'Limit Custom API berhasil direset!' : 'Custom API limits reset successfully!');
                            }}
                            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Reset Custom
                          </button>
                        </div>
                      </div>

                      <div className="space-y-5">
                        {/* 10 request permenit */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-900 mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              {lang === 'id' ? 'Batas Per Menit (10 request/menit)' : 'Per-Minute Limit (10 req/min)'}
                            </span>
                            <span className={customUsage.minuteCount >= 10 ? "text-rose-600 font-bold font-mono" : "text-emerald-600 font-bold font-mono"}>
                              {customUsage.minuteCount} / 10 req ({Math.round((customUsage.minuteCount / 10) * 100)}%)
                            </span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                customUsage.minuteCount >= 10 ? "bg-rose-500" : customUsage.minuteCount > 7 ? "bg-amber-500" : "bg-emerald-500"
                              )} 
                              style={{ width: `${Math.min(100, (customUsage.minuteCount / 10) * 100)}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                            <span>{lang === 'id' ? `Sisa: ${customUsage.minuteRemaining} req menit ini` : `Remaining: ${customUsage.minuteRemaining} req this minute`}</span>
                            <span>{lang === 'id' ? 'Reset: 60 detik' : 'Reset: 60s'}</span>
                          </div>
                        </div>

                        {/* 50 request per hari */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-900 mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                              {lang === 'id' ? 'Batas Per Hari (50 request/hari)' : 'Daily Limit (50 req/day)'}
                            </span>
                            <span className={customUsage.dailyCount >= 50 ? "text-rose-600 font-bold font-mono" : "text-emerald-600 font-bold font-mono"}>
                              {customUsage.dailyCount} / 50 req ({Math.round((customUsage.dailyCount / 50) * 100)}%)
                            </span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                customUsage.dailyCount >= 50 ? "bg-rose-500" : customUsage.dailyCount > 40 ? "bg-amber-500" : "bg-teal-600"
                              )} 
                              style={{ width: `${Math.min(100, (customUsage.dailyCount / 50) * 100)}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                            <span>{lang === 'id' ? `Sisa: ${customUsage.dailyRemaining} req hari ini` : `Remaining: ${customUsage.dailyRemaining} req today`}</span>
                            <span>{lang === 'id' ? 'Reset: 24 jam' : 'Reset: 24h'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* View D. PERSONALISASI */}
                {currentView === 'personalization' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {lang === 'id' ? 'Pengaturan Tambahan' : 'Additional Personalization'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Sesuaikan gaya interaksi AI yang bekerja di balik obrolan Anda.' : 'Customize AI interaction style for your chats.'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-900 block">
                        {lang === 'id' ? 'Instruksi Kustom Sistem AI' : 'Custom AI System Instructions'}
                      </label>
                      <textarea 
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder={lang === 'id' ? "Contoh: 'Berbicaralah dengan nada santai', 'Selalu berikan penjelasan terstruktur', dll..." : "Example: 'Always provide structured answers', 'Speak with a friendly tone', etc..."}
                        className="w-full h-36 bg-white border border-slate-200 rounded-xl p-4 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-y text-[15px] shadow-xs"
                      />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {lang === 'id' 
                          ? 'Petunjuk tambahan dari Anda akan disisipkan langsung ke prompt sistem AI.' 
                          : 'Your custom instructions will be appended to the AI system prompt.'}
                      </p>
                    </div>

                    <div className="pt-6 border-t border-slate-200">
                      <button 
                        onClick={() => setCurrentView('connected_apps')}
                        className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-5 transition-all flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100 group-hover:scale-105 transition-transform">
                            <Link2 size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[17px] font-bold text-slate-900">{t.connectedApps}</h4>
                              <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                                Coming Soon
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {lang === 'id' ? 'Gunakan produk kami secara lancar dan terintegrasi' : 'Seamlessly connect and integrate with external apps'}
                            </p>
                          </div>
                        </div>
                        <ArrowLeft size={18} className="rotate-180 text-slate-400 group-hover:translate-x-1 transition-all group-hover:text-blue-600" />
                      </button>
                    </div>
                  </div>
                )}

                {/* View E. CUSTOM API */}
                {currentView === 'custom_api' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-2xl font-bold text-slate-900">Custom API</h3>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold">
                            {customApis.length} / {MAX_CUSTOM_APIS} API
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-1">
                          {lang === 'id' 
                            ? `Kelola hingga maksimal ${MAX_CUSTOM_APIS} API. Kartu hijau di sebelah kiri menandakan API aktif.`
                            : `Manage up to ${MAX_CUSTOM_APIS} APIs. Green bar indicates active API.`}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (customApis.length >= MAX_CUSTOM_APIS) {
                            showToast(lang === 'id' ? `Maksimal ${MAX_CUSTOM_APIS} API telah tercapai!` : `Maximum of ${MAX_CUSTOM_APIS} APIs reached!`);
                            return;
                          }
                          setIsAddFormOpen(prev => !prev);
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition cursor-pointer whitespace-nowrap shadow-xs",
                          customApis.length >= MAX_CUSTOM_APIS
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : isAddFormOpen 
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                      >
                        <Plus size={18} className={isAddFormOpen ? "rotate-45 transition-transform" : "transition-transform"} />
                        <span>{isAddFormOpen ? (lang === 'id' ? 'Tutup Formulir' : 'Close Form') : (lang === 'id' ? 'Tambah API Baru' : 'Add New API')}</span>
                      </button>
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
                          className="bg-white border border-emerald-300 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <Key size={18} className="text-emerald-600" />
                              {lang === 'id' ? `Tambah Custom API (${customApis.length + 1} dari ${MAX_CUSTOM_APIS})` : `Add Custom API (${customApis.length + 1} of ${MAX_CUSTOM_APIS})`}
                            </h4>
                            <span className="text-xs text-slate-400">Maks. 10 API</span>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                {lang === 'id' ? 'Nama API / Label' : 'API Name / Label'} <span className="text-rose-500">*</span>
                              </label>
                              <input 
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Contoh: OpenAI GPT-4o, Groq Llama, etc."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 text-sm"
                                required
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                Provider <span className="text-rose-500">*</span>
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 text-sm font-medium"
                              >
                                <optgroup label="── Cloud AI Providers ──" className="bg-white text-slate-800 font-semibold">
                                  {PROVIDER_PRESETS.filter(p => !p.isSelfHosted).map((p) => (
                                    <option key={p.id} value={p.id} className="text-slate-900 py-1">
                                      {p.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="── Self-Hosted & Local Engine ──" className="bg-white text-emerald-700 font-semibold">
                                  {PROVIDER_PRESETS.filter(p => p.isSelfHosted).map((p) => (
                                    <option key={p.id} value={p.id} className="text-slate-900 py-1">
                                      {p.name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                API Key / Bearer Token <span className="text-rose-500">*</span>
                              </label>
                              <input 
                                type="password"
                                value={formApiKey}
                                onChange={(e) => setFormApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 text-sm font-mono"
                                required
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                Model ID <span className="text-rose-500">*</span>
                              </label>
                              <input 
                                type="text"
                                value={formModel}
                                onChange={(e) => setFormModel(e.target.value)}
                                placeholder={selectedPreset.placeholderModel}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 text-sm font-mono"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                              Base URL / Endpoint {isCurrentSelfHost ? <span className="text-rose-600 font-bold">* (Wajib)</span> : <span className="text-slate-400 font-normal">(Opsional)</span>}
                            </label>
                            <input 
                              type="text"
                              value={formBaseUrl}
                              onChange={(e) => setFormBaseUrl(e.target.value)}
                              placeholder={isCurrentSelfHost ? "http://localhost:11434/v1" : (selectedPreset.defaultBaseUrl || "https://api.openai.com/v1")}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 text-sm font-mono"
                              required={isCurrentSelfHost}
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input 
                              type="checkbox"
                              id="formIsActive"
                              checked={formIsActive}
                              onChange={(e) => setFormIsActive(e.target.checked)}
                              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor="formIsActive" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                              {lang === 'id' ? 'Jadikan API ini langsung aktif dan digunakan' : 'Set as active API immediately'}
                            </label>
                          </div>

                          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setIsAddFormOpen(false)}
                              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="submit"
                              className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
                            >
                              {lang === 'id' ? 'Simpan API' : 'Save API'}
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* List API Cards */}
                    <div className="space-y-3">
                      {customApis.length === 0 ? (
                        <div className="text-center py-16 px-4 border border-dashed border-slate-300 rounded-3xl bg-white space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                            <Key size={22} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">
                              {lang === 'id' ? 'Belum Ada Custom API' : 'No Custom APIs Added'}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                              {lang === 'id' ? 'Tambahkan hingga 10 API kustom untuk menghubungkan model AI Anda.' : 'Add up to 10 custom APIs to connect your preferred models.'}
                            </p>
                          </div>
                          <button
                            onClick={() => setIsAddFormOpen(true)}
                            className="inline-flex items-center gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
                          >
                            <Plus size={16} />
                            <span>{lang === 'id' ? 'Tambah API Pertama' : 'Add First API'}</span>
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
                                "group relative bg-white rounded-2xl border transition-all duration-300 shadow-sm flex overflow-hidden",
                                api.isActive 
                                  ? "border-emerald-500 shadow-md ring-1 ring-emerald-500/30" 
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              {/* Indikator Hijau di Kiri Card API */}
                              <div 
                                onClick={() => handleToggleActive(api.id, api.name)}
                                title={api.isActive ? "Active API" : "Click to activate"}
                                className={cn(
                                  "w-3.5 sm:w-4 flex-shrink-0 cursor-pointer transition-all duration-300 flex items-center justify-center relative",
                                  api.isActive 
                                    ? "bg-emerald-500" 
                                    : "bg-slate-200 hover:bg-slate-300"
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
                                      <h4 className="text-base font-bold text-slate-900">{api.name}</h4>
                                      <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-semibold">
                                        {api.provider}
                                      </span>
                                      {api.model && (
                                        <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-mono">
                                          {api.model}
                                        </span>
                                      )}
                                    </div>
                                    {api.baseUrl && (
                                      <p className="text-xs text-slate-500 font-mono truncate max-w-md">
                                        {api.baseUrl}
                                      </p>
                                    )}
                                  </div>

                                  {/* Tombol Toggle & Hapus */}
                                  <div className="flex items-center gap-2 self-start">
                                    <button
                                      onClick={() => handleToggleActive(api.id, api.name)}
                                      className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs",
                                        api.isActive
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                                          : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                                      )}
                                    >
                                      <span className={cn("w-2 h-2 rounded-full", api.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                                      <span>{api.isActive ? (lang === 'id' ? 'Aktif' : 'Active') : (lang === 'id' ? 'Aktifkan' : 'Activate')}</span>
                                    </button>

                                    <button
                                      onClick={() => handleDeleteApi(api.id, api.name)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition cursor-pointer"
                                      title={lang === 'id' ? "Hapus API" : "Delete API"}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* API Key Masked Box */}
                                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs">
                                  <div className="flex items-center gap-2 truncate font-mono text-slate-700">
                                    <span className="text-slate-400 font-semibold">Key:</span>
                                    <span>{isKeyVisible ? api.apiKey : maskedKey}</span>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                    <button
                                      onClick={() => toggleKeyVisibility(api.id)}
                                      className="p-1 text-slate-500 hover:text-slate-900 transition rounded cursor-pointer"
                                      title={isKeyVisible ? "Hide Key" : "Show Key"}
                                    >
                                      {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(api.apiKey, 'API Key')}
                                      className="p-1 text-slate-500 hover:text-slate-900 transition rounded cursor-pointer"
                                      title="Copy Key"
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connected Apps & MCP Hub Screen */}
          {currentView === 'connected_apps' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col w-full h-full text-slate-900">
              {/* Header inside sub-screen */}
              <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md py-4 px-4 sm:px-6 sticky top-0 z-10 flex items-center justify-between shadow-xs">
                <div className="flex items-center">
                  <button 
                    onClick={() => setCurrentView('personalization')}
                    className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={22} />
                  </button>
                  <span className="ml-3 font-bold text-lg text-slate-900">
                    {t.connectedApps}
                  </span>
                </div>
              </div>

              {/* Sub-screen body container */}
              <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full space-y-6">
                
                {/* 1. MCP Hub Featured Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5 relative overflow-hidden group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl">
                        <Layers size={26} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-bold text-slate-900">{t.mcpHubTitle}</h4>
                          <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                            Coming Soon
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-amber-600 font-mono">
                          {lang === 'id' ? 'Integrasi MCP Segera Hadir' : 'MCP Integration Coming Soon'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {t.mcpIntroText}
                  </p>

                  {/* Open MCP Settings Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => setCurrentView('integrations')}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold transition-all shadow-sm cursor-pointer text-sm"
                    >
                      <Layers size={18} />
                      <span>{t.openMcpIntegrations}</span>
                      <ArrowLeft size={16} className="rotate-180 ml-1" />
                    </button>
                  </div>
                </div>

                {/* 2. Connected Web Ecosystem Links */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                    {lang === 'id' ? 'Ekosistem Layanan Web TMPA' : 'TMPA Web Ecosystem'}
                  </h4>

                  {/* Main Website TMPA Link */}
                  <a
                    href="https://tmpa.my.id"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all group shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white rounded-xl border border-blue-100 transition-colors">
                        <Globe size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {t.mainWebsite}
                          </h5>
                          <span className="text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                            Online
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">https://tmpa.my.id</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </a>

                  {/* Store Link */}
                  <div
                    onClick={() => showToast(lang === 'id' ? 'TMPA Store segera hadir (Coming Soon)...' : 'TMPA Store is coming soon...')}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all group shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 transition-colors">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-[15px] font-bold text-slate-900">
                            {t.store}
                          </h5>
                          <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">TMPA Store & Marketplace AI Models</p>
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-mono font-semibold">
                      Coming Soon
                    </span>
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
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm py-3 px-5 rounded-full flex items-center gap-2 shadow-2xl tracking-normal border border-slate-800 whitespace-nowrap font-medium"
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
