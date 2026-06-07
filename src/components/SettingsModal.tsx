import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Activity, Shield, Settings2, Link2, 
  Camera, Clock, Calendar, Volume2, Globe, Sparkles, Smartphone, Check
} from 'lucide-react';
import { cn } from '../lib/utils';

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

type SubView = 'menu' | 'account' | 'activity' | 'usage' | 'personalization' | 'connected_apps';

export function SettingsModal({ isOpen, onClose, customInstruction, setCustomInstruction, chatSessions, hourlyUsage, weeklyUsage, resetUsage }: SettingsModalProps) {
  const [currentView, setCurrentView] = useState<SubView>('menu');
  const [profilePic, setProfilePic] = useState('https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/TMPA%20storege/Desain%20tanpa%20judul_20260520_150307_0000.png');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
