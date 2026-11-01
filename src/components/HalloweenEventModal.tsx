import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, Clock, ShieldCheck, Check, 
  Gift, Info, Flame, Zap, Compass, AlertCircle
} from 'lucide-react';
import { 
  getHalloweenCandy, 
  getSpawnSecondsRemaining, 
  redeemHalloweenShopItem, 
  isHalloweenItemRedeemed, 
  HALLOWEEN_SHOP_ITEMS,
  getHalloweenEventTimeRemaining,
  triggerInstantSpawn,
  RewardType,
  MONSTER_CONFIGS
} from '../lib/halloweenManager';
import { 
  BatSvg, 
  PumpkinSvg, 
  SkeletonSkullSvg, 
  HalloweenCandySvg 
} from './HalloweenSvgAssets';

interface HalloweenEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStyle?: () => void;
}

export const HalloweenEventModal: React.FC<HalloweenEventModalProps> = ({
  isOpen,
  onClose,
  onNavigateToStyle
}) => {
  const [candy, setCandy] = useState<number>(() => getHalloweenCandy());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Cooldown timers in seconds
  const [timers, setTimers] = useState<Record<RewardType, number>>({
    bat: 0,
    pumpkin: 0,
    skeleton: 0
  });

  const [eventRemaining, setEventRemaining] = useState(() => getHalloweenEventTimeRemaining());
  const [redeemedList, setRedeemedList] = useState<string[]>([]);

  // Refresh data whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setCandy(getHalloweenCandy());
    setRedeemedList(HALLOWEEN_SHOP_ITEMS.filter(item => isHalloweenItemRedeemed(item.id)).map(i => i.id));

    const updateTimers = () => {
      setTimers({
        bat: getSpawnSecondsRemaining('bat'),
        pumpkin: getSpawnSecondsRemaining('pumpkin'),
        skeleton: getSpawnSecondsRemaining('skeleton')
      });
      setEventRemaining(getHalloweenEventTimeRemaining());
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    const handleCandyChange = (e: any) => {
      setCandy(e.detail !== undefined ? e.detail : getHalloweenCandy());
    };
    const handleRedeemChange = () => {
      setRedeemedList(HALLOWEEN_SHOP_ITEMS.filter(item => isHalloweenItemRedeemed(item.id)).map(i => i.id));
    };
    const handleScheduleChange = () => {
      updateTimers();
    };

    window.addEventListener('tmpa_halloween_candy_changed', handleCandyChange);
    window.addEventListener('tmpa_halloween_redeemed', handleRedeemChange);
    window.addEventListener('tmpa_halloween_schedule_changed', handleScheduleChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tmpa_halloween_candy_changed', handleCandyChange);
      window.removeEventListener('tmpa_halloween_redeemed', handleRedeemChange);
      window.removeEventListener('tmpa_halloween_schedule_changed', handleScheduleChange);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRedeem = (itemId: 'limit_20' | 'limit_30' | 'style_halloween') => {
    const res = redeemHalloweenShopItem(itemId);
    showToast(res.message);
    if (res.success) {
      setCandy(getHalloweenCandy());
      setRedeemedList(prev => [...prev, itemId]);
    }
  };

  const handleTestSpawn = (type: RewardType) => {
    triggerInstantSpawn(type);
    showToast(`Monster ${MONSTER_CONFIGS[type].name} dimunculkan di layar! Coba klik sekarang.`);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#07050b] text-white overflow-y-auto select-none flex flex-col"
      >
        {/* Ambient Spooky Lights */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-radial from-orange-600/15 via-purple-900/10 to-transparent blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 right-10 w-[500px] h-[300px] bg-radial from-purple-800/15 to-transparent blur-3xl pointer-events-none" />

        {/* Top Header Navbar */}
        <header className="sticky top-0 z-20 w-full px-4 sm:px-8 py-4 border-b border-orange-500/20 bg-black/85 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PumpkinSvg size={32} glow={true} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase font-mono bg-gradient-to-r from-orange-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
                  EVENT HALLOWEEN 2026
                </h1>
                <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  2 - 20 NOV
                </span>
              </div>
              <p className="text-xs text-slate-400">Bluefox AI Spooky Celebration & Rewards</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Candy Balance Chip */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 shadow-inner text-amber-300">
              <HalloweenCandySvg size={20} />
              <span className="text-sm font-extrabold font-mono">{candy}</span>
              <span className="text-[11px] font-bold text-orange-300/80 uppercase">Candy</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Tutup Event"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-black/90 border border-orange-500 text-orange-200 text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <Sparkles size={16} className="text-orange-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          
          {/* Banner Status & Countdown */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-purple-950/60 via-black to-orange-950/60 border border-orange-500/30 shadow-2xl shadow-orange-950/40">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-mono font-bold mb-3">
                  <Flame size={14} className="text-orange-400 animate-pulse" />
                  <span>Periode Event Berlangsung</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
                  <span>Kumpulkan Candy, Klaim Bonus Limit & Tema!</span>
                  <HalloweenCandySvg size={30} />
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Event aktif mulai <strong>2 November sampai 20 November 2026</strong>. Kumpulkan permen mistis dari monster yang muncul secara otomatis di layar Anda. Lewat 20 November, event ini otomatis berakhir.
                </p>
              </div>

              {/* Countdown Card */}
              <div className="flex-shrink-0 bg-black/70 border border-white/10 rounded-2xl p-4 text-center min-w-[200px] backdrop-blur-xs">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold block mb-1">
                  Sisa Waktu Event
                </span>
                <div className="flex items-center justify-center gap-2 text-orange-400 font-mono font-extrabold text-xl sm:text-2xl">
                  <div>
                    <span>{eventRemaining.days}</span>
                    <span className="text-[10px] text-slate-400 block -mt-1">Hari</span>
                  </div>
                  <span>:</span>
                  <div>
                    <span>{eventRemaining.hours}</span>
                    <span className="text-[10px] text-slate-400 block -mt-1">Jam</span>
                  </div>
                  <span>:</span>
                  <div>
                    <span>{eventRemaining.minutes}</span>
                    <span className="text-[10px] text-slate-400 block -mt-1">Mnt</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: RADAR & JADWAL KEMUNCULAN MONSTER (BUTTON CLAIM DIHAPUS SESUAI REQUEST) */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <Compass size={20} className="text-orange-400" />
                  <span>Radar & Cara Mendapatkan Candy</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    Spawns di Seluruh Layar
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Monster akan muncul tiba-tiba di mana saja pada layar Anda (bukan hanya saat chat). Klik monster saat ia muncul sebelum hilang!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1. Kelelawar Terbang (5 menit, +1 Candy) */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-b from-purple-900/30 via-[#100b1a] to-black border border-purple-500/30 flex flex-col justify-between overflow-hidden shadow-lg group">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                      <BatSvg size={44} animateFlap={true} />
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-extrabold text-xs">
                        <HalloweenCandySvg size={14} />
                        <span>+1 Candy</span>
                      </div>
                      <span className="block text-[10px] text-slate-400 mt-1 font-mono">Setiap 5 Menit</span>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white mb-1">Kelelawar Terbang</h4>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Terbang melintasi layar dari kiri ke kanan. Jika terlewat (miss), kelelawar akan hilang dan Anda harus menunggu 5 menit lagi.
                  </p>

                  <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20 text-[11px] text-purple-200 space-y-1 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Radar Status:</span>
                      <span className="font-mono font-bold text-purple-300">
                        {timers.bat > 0 ? `Siap dalam ${formatSeconds(timers.bat)}` : 'Sedang Siap Muncul!'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Durasi:</span>
                      <span className="font-mono font-semibold text-amber-300">Melintas di Layar</span>
                    </div>
                  </div>
                </div>

                {/* Tombol Uji Langsung Kemunculan */}
                <button
                  onClick={() => handleTestSpawn('bat')}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 font-mono text-[11px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  title="Uji kemunculan kelelawar sekarang"
                >
                  <Zap size={13} className="text-amber-300" />
                  <span>Uji Munculkan Kelelawar</span>
                </button>
              </div>

              {/* 2. Labu di Pinggir Layar (10 menit, 5 detik durasi, +2 Candy) */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-b from-orange-900/30 via-[#130b14] to-black border border-orange-500/30 flex flex-col justify-between overflow-hidden shadow-lg group">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                      <PumpkinSvg size={42} glow={true} />
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-extrabold text-xs">
                        <HalloweenCandySvg size={14} />
                        <span>+2 Candy</span>
                      </div>
                      <span className="block text-[10px] text-slate-400 mt-1 font-mono">Setiap 10 Menit</span>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white mb-1">Labu Mistis</h4>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Muncul dari pinggir/sudut layar selama <strong>5 detik</strong>. Jika tidak ditekan dalam 5 detik, labu menghilang dan harus menunggu 10 menit.
                  </p>

                  <div className="p-2.5 rounded-xl bg-orange-950/40 border border-orange-500/20 text-[11px] text-orange-200 space-y-1 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Radar Status:</span>
                      <span className="font-mono font-bold text-orange-300">
                        {timers.pumpkin > 0 ? `Siap dalam ${formatSeconds(timers.pumpkin)}` : 'Sedang Siap Muncul!'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Durasi Muncul:</span>
                      <span className="font-mono font-semibold text-amber-300">Tepat 5 Detik</span>
                    </div>
                  </div>
                </div>

                {/* Tombol Uji Langsung Kemunculan */}
                <button
                  onClick={() => handleTestSpawn('pumpkin')}
                  className="w-full py-2 px-3 rounded-xl bg-orange-600/30 hover:bg-orange-600/50 text-orange-200 border border-orange-500/40 font-mono text-[11px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  title="Uji kemunculan labu sekarang"
                >
                  <Zap size={13} className="text-amber-300" />
                  <span>Uji Munculkan Labu (5s)</span>
                </button>
              </div>

              {/* 3. Tengkorak di Bagian Atas Layar (20 menit, 5 detik durasi, +4 Candy) */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-b from-indigo-900/30 via-[#0e0c1a] to-black border border-indigo-500/30 flex flex-col justify-between overflow-hidden shadow-lg group">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                      <SkeletonSkullSvg size={42} glow={true} />
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-extrabold text-xs">
                        <HalloweenCandySvg size={14} />
                        <span>+4 Candy</span>
                      </div>
                      <span className="block text-[10px] text-slate-400 mt-1 font-mono">Setiap 20 Menit</span>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white mb-1">Tengkorak Keramat</h4>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Kepala tengkorak melayang turun dari atas layar selama <strong>5 detik</strong>. Klik tengkoraknya untuk hadiah permen tertinggi (+4 Candy).
                  </p>

                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-200 space-y-1 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Radar Status:</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {timers.skeleton > 0 ? `Siap dalam ${formatSeconds(timers.skeleton)}` : 'Sedang Siap Muncul!'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Durasi Muncul:</span>
                      <span className="font-mono font-semibold text-amber-300">Tepat 5 Detik</span>
                    </div>
                  </div>
                </div>

                {/* Tombol Uji Langsung Kemunculan */}
                <button
                  onClick={() => handleTestSpawn('skeleton')}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-mono text-[11px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  title="Uji kemunculan tengkorak sekarang"
                >
                  <Zap size={13} className="text-amber-300" />
                  <span>Uji Munculkan Tengkorak (5s)</span>
                </button>
              </div>

            </div>
          </section>

          {/* SECTION 2: CANDY SHOP / HADIAH PENUKARAN */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>Toko Penukaran Candy</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Hadiah Eksklusif
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tukarkan permen yang Anda kumpulkan dengan peningkatan limit kuota percakapan atau tema malam mistis.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HALLOWEEN_SHOP_ITEMS.map((item) => {
                const isRedeemed = redeemedList.includes(item.id);
                const canAfford = candy >= item.cost;

                return (
                  <div
                    key={item.id}
                    className={`relative p-5 rounded-2xl bg-[#100d17]/90 border transition-all flex flex-col justify-between ${
                      isRedeemed
                        ? 'border-emerald-500/40 bg-emerald-950/20 shadow-md shadow-emerald-950/20'
                        : canAfford
                        ? 'border-orange-500/40 hover:border-orange-400 shadow-lg shadow-orange-950/30'
                        : 'border-white/10 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-white/10 text-orange-200 border border-white/10">
                          {item.badge}
                        </span>
                        
                        <div className="flex items-center gap-1.5 font-mono font-extrabold text-amber-300">
                          <HalloweenCandySvg size={18} />
                          <span className="text-sm">{item.cost}</span>
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                        {item.name}
                        {isRedeemed && (
                          <Check size={16} className="text-emerald-400" />
                        )}
                      </h4>

                      <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                        {item.description}
                      </p>

                      {item.isPreorder && (
                        <div className="mb-4 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[11px] text-orange-300 flex items-start gap-2">
                          <Info size={14} className="flex-shrink-0 mt-0.5 text-orange-400" />
                          <span>
                            Tema ini akan otomatis tersedia di menu <strong>Style App</strong> begitu versi tema dirilis resmi.
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      {isRedeemed ? (
                        <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-center text-xs font-bold flex items-center justify-center gap-1.5">
                          <ShieldCheck size={16} />
                          <span>Sudah Ditukar & Aktif</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRedeem(item.id)}
                          disabled={!canAfford}
                          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            canAfford
                              ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-600/30 active:scale-95'
                              : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? (
                            <>
                              <Gift size={14} />
                              <span>Tukar {item.cost} Candy</span>
                            </>
                          ) : (
                            <>
                              <span>Kurang {item.cost - candy} Candy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: KEYWORD EASTER EGGS CHEAT SHEET */}
          <section className="p-5 rounded-2xl bg-black/60 border border-white/10 text-xs text-slate-400 space-y-2">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span>Kata Kunci Rahasia di Kolom Chat</span>
            </h4>
            <p>
              Coba ketik kata-kata berikut di kolom input percakapan chat Bluefox untuk memunculkan efek animasi khusus:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-orange-300">
                1. <strong>pumpkin</strong>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-purple-300">
                2. <strong>skeleton</strong>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-cyan-300">
                3. <strong>ghost</strong>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-red-300">
                4. <strong>headless horse man</strong>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-amber-300">
                5. <strong>halloween</strong>
              </div>
            </div>
          </section>

        </main>
      </motion.div>
    </AnimatePresence>
  );
};
