import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Activity, Shield, Settings2, Link2, 
  Camera, Clock, Calendar, Volume2, Globe, Sparkles, Smartphone, Check,
  Key, Plus, Trash2, Eye, EyeOff, Copy, AlertCircle, RefreshCw, Cpu
} from 'lucide-react';
import { cn } from '../lib/utils';
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
  CUSTOM_API_DAILY_LIMIT
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

type SubView = 'menu' | 'account' | 'activity' | 'usage' | 'personalization' | 'connected_apps' | 'custom_api';

export function SettingsModal({ isOpen, onClose, customInstruction, setCustomInstruction, chatSessions, hourlyUsage, weeklyUsage, resetUsage }: SettingsModalProps) {
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
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Decorative Toggle states to match screenshot
  const [liveStopResponse, setLiveStopResponse] = useState(true);
  const [handsfreeVoice, setHandsfreeVoice] = useState(true);

  const cosmicStars = useMemo(() => {
    return [...Array(60)].map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 7,
      xOffset: (Math.random() - 0.5) * 50,
      scaleMax: Math.random() * 2
    }));
  }, []);

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
        showToast('Foto profil berhasil diperbarui!');
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDate = (ts: number | undefined) => {
    if (!ts) return '-';
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}, ${date.getDate()} ${date.toLocaleString('id-ID', { month: 'long' })} ${date.getFullYear()}`;
  };

  const handleToggleActive = (id: string, name: string) => {
    const res = toggleCustomApiActive(id);
    setCustomApis(getCustomApis());
    if (res.newState) {
      showToast(`API "${name}" sekarang aktif digunakan.`);
    } else {
      showToast(`API "${name}" telah dinonaktifkan.`);
    }
  };

  const handleDeleteApi = (id: string, name: string) => {
    deleteCustomApi(id);
    setCustomApis(getCustomApis());
    showToast(`API "${name}" berhasil dihapus.`);
  };

  const handleSaveNewApi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Nama API wajib diisi!');
      return;
    }
    if (!formApiKey.trim()) {
      showToast('API Key wajib diisi!');
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
      showToast(res.error || 'Gagal menambahkan API');
      return;
    }

    setCustomApis(getCustomApis());
    setIsAddFormOpen(false);
    setFormName('');
    setFormBaseUrl('');
    setFormApiKey('');
    setFormModel('');
    setFormIsActive(true);
    showToast(`API "${formName}" berhasil ditambahkan!`);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} berhasil disalin!`);
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
                  title="Kembali ke Chat"
                >
                  <ArrowLeft size={24} />
                </button>
                <h1 className="text-3xl sm:text-4xl font-normal text-white mt-4 tracking-tight">
                  Setelan TMPA
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
                    <h3 className="text-[17px] font-medium text-white">Info akun</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Kelola email, ID profil, dan foto profil Anda</p>
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
                    <h3 className="text-[17px] font-medium text-white">Aktivitas</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Riwayat chat detail berserta penanda waktu pertama dibuat</p>
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
                    <h3 className="text-[17px] font-medium text-white">Batas penggunaan</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Kuota batas model dan persentase penggunaan sisa</p>
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
                    <h3 className="text-[17px] font-medium text-white">Personalisasi</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Atur instruksi kustom Anda dan lihat aplikasi terhubung</p>
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
                      <h3 className="text-[17px] font-medium text-white">Custom API</h3>
                      <span className="text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                        {customApis.length}/10 API
                      </span>
                      {customApis.some(a => a.isActive) && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">Kelola hingga 10 API kustom (Limit: 10 req/menit & 50 req/hari)</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Subview Content */}
          {currentView !== 'menu' && currentView !== 'connected_apps' && (
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
                  {currentView === 'account' && 'Info Akun'}
                  {currentView === 'activity' && 'Aktivitas Anda'}
                  {currentView === 'usage' && 'Batas Penggunaan'}
                  {currentView === 'personalization' && 'Personalisasi'}
                  {currentView === 'custom_api' && 'Custom API'}
                </span>
              </div>

              {/* Sub-screen body container */}
              <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full">
                
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
                                Provider / Layanan
                              </label>
                              <select 
                                value={formProvider}
                                onChange={(e) => {
                                  setFormProvider(e.target.value);
                                  if (e.target.value === 'OpenAI' && !formBaseUrl) setFormBaseUrl('https://api.openai.com/v1');
                                  else if (e.target.value === 'Groq' && !formBaseUrl) setFormBaseUrl('https://api.groq.com/openai/v1');
                                  else if (e.target.value === 'OpenRouter' && !formBaseUrl) setFormBaseUrl('https://openrouter.ai/api/v1');
                                }}
                                className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-sm"
                              >
                                <option value="OpenAI">OpenAI (api.openai.com)</option>
                                <option value="Groq">Groq (api.groq.com)</option>
                                <option value="OpenRouter">OpenRouter (openrouter.ai)</option>
                                <option value="Anthropic">Anthropic (Claude)</option>
                                <option value="Gemini">Google Gemini</option>
                                <option value="DeepSeek">DeepSeek</option>
                                <option value="Custom">Custom Endpoint / Self-Hosted</option>
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
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1.5">
                                Model ID (Opsional)
                              </label>
                              <input 
                                type="text"
                                value={formModel}
                                onChange={(e) => setFormModel(e.target.value)}
                                placeholder="Contoh: gpt-4o, llama-3.3-70b, dll."
                                className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1.5">
                              Base URL / Endpoint (Opsional)
                            </label>
                            <input 
                              type="text"
                              value={formBaseUrl}
                              onChange={(e) => setFormBaseUrl(e.target.value)}
                              placeholder="https://api.openai.com/v1"
                              className="w-full bg-[#161619] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm"
                            />
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

          {/* Connected Apps Cosmic Sun / Star Screen */}
          {currentView === 'connected_apps' && (
            <div className="flex-1 w-full h-full relative flex items-center justify-center p-6 text-center bg-black overflow-hidden select-none">
               {/* Star backdrop background */}
               <div className="absolute inset-0 z-0 pointer-events-none">
                 {/* Glowing Sun Flare */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                   <div className="w-32 h-32 rounded-full bg-orange-100 shadow-[0_0_80px_30px_rgba(255,200,100,0.6)] animate-pulse" />
                   <motion.div 
                     className="absolute w-56 h-56 rounded-full bg-yellow-400 mix-blend-screen mix-blend-soft-light"
                     animate={{ scale: [1, 2.5], opacity: [0, 0.6, 0] }}
                     transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
                   />
                 </div>
                 {/* Fast Twinkling Cosmic Stars */}
                 {cosmicStars.map((star) => (
                   <motion.div
                     key={star.id}
                     className="absolute w-1 h-1 bg-white rounded-full bg-opacity-80 shadow-[0_0_5px_1px_rgba(255,255,255,0.8)]"
                     initial={{ top: star.top, left: star.left }}
                     animate={{ 
                       y: [0, -150],
                       x: [0, star.xOffset],
                       opacity: [0, 1, 0], 
                       scale: [0.5, star.scaleMax, 0.5] 
                     }}
                     transition={{ duration: star.duration, repeat: Infinity, ease: "linear", delay: star.delay }}
                   />
                 ))}
               </div>

               {/* Center Mascot Artwork Image */}
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 15 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 transition={{ duration: 0.7, ease: "easeOut" }}
                 className="relative z-10 max-w-sm sm:max-w-md w-full flex items-center justify-center p-4 drop-shadow-[0_20px_60px_rgba(251,146,60,0.3)]"
               >
                 <img 
                   src="https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/Video%20atau%20asset/T_20260602_194527_0000.png" 
                   alt="Mascot Artwork" 
                   className="w-full max-h-[60vh] object-contain select-none"
                   referrerPolicy="no-referrer"
                 />
               </motion.div>

               {/* Floating Back Control Button over Cosmic View */}
               <button 
                  onClick={() => setCurrentView('personalization')}
                  className="absolute top-6 left-6 z-20 flex items-center gap-2 py-2.5 px-4 bg-gray-900/90 hover:bg-[#1f1f1d] active:bg-black rounded-full text-white transition-all cursor-pointer backdrop-blur-md border border-gray-800 shadow-xl font-medium text-sm"
                >
                  <ArrowLeft size={18} />
                  <span>Kembali</span>
                </button>
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
