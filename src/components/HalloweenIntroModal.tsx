import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, BookOpen, HelpCircle, History, Gift } from 'lucide-react';
import { 
  PumpkinSvg, 
  BatSvg, 
  SkeletonSkullSvg, 
  HalloweenCandySvg 
} from './HalloweenSvgAssets';

interface HalloweenIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
  onOpenEventHub?: () => void;
}

export const HalloweenIntroModal: React.FC<HalloweenIntroModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  onOpenEventHub
}) => {
  if (!isOpen) return null;

  const menuOptions = [
    {
      id: 'apa_itu',
      title: 'Apa itu Halloween?',
      prompt: 'Apa itu Halloween?',
      description: 'Asal usul festival Samhain bangsa Celtic, makna simbol labu, dan tradisi di baliknya.',
      icon: HelpCircle,
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      borderColor: 'border-orange-500/40 hover:border-orange-400',
      badge: 'Pengenalan Dasar'
    },
    {
      id: 'mengapa_ada',
      title: 'Mengapa Halloween ada?',
      prompt: 'Mengapa Halloween ada?',
      description: 'Menelusuri alasan kultural, perubahan musim, dan kepercayaan roh penjaga masa lampau.',
      icon: BookOpen,
      gradient: 'from-purple-500/20 via-violet-500/10 to-transparent',
      borderColor: 'border-purple-500/40 hover:border-purple-400',
      badge: 'Fakta & Makna'
    },
    {
      id: 'bedah_sejarah',
      title: 'Bedah sejarah Halloween bersama bluefox',
      prompt: 'Bedah sejarah Halloween bersama bluefox',
      description: 'Eksplorasi kronologis mendalam bersama kecerdasan Bluefox dari era kuno hingga modern.',
      icon: History,
      gradient: 'from-indigo-500/20 via-blue-500/10 to-transparent',
      borderColor: 'border-blue-500/40 hover:border-blue-400',
      badge: 'Analisis Mendalam'
    }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-[#07050b] text-white overflow-hidden select-none"
      >
        {/* Atmospheric Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-radial from-orange-600/15 via-purple-900/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-radial from-purple-700/15 via-indigo-950/10 to-transparent blur-3xl pointer-events-none" />

        {/* TOP DECORATIVE BORDER: Pumpkins, Skeletons, Bats */}
        <div className="relative z-10 w-full px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between border-b border-orange-500/20 bg-gradient-to-b from-black/85 to-transparent backdrop-blur-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="animate-bounce">
              <PumpkinSvg size={32} glow={true} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold tracking-widest uppercase bg-gradient-to-r from-orange-400 via-amber-300 to-purple-400 bg-clip-text text-transparent font-mono">
                  HALLOWEEN 2026
                </span>
                <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-full font-mono">
                  Edisi Spesial
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">The Night of Spirits with Bluefox AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <BatSvg size={30} animateFlap={true} />
            <SkeletonSkullSvg size={28} glow={true} />
            
            {onOpenEventHub && (
              <button
                onClick={onOpenEventHub}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-xs font-semibold transition-all cursor-pointer"
              >
                <Gift size={14} className="text-orange-400" />
                <span>Event Hub & Candy</span>
                <HalloweenCandySvg size={16} />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer ml-2"
              title="Tutup / Kembali ke Chat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CENTER CONTENT: Title & The 3 Interactive Menu Options */}
        <div className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col justify-center items-center text-center overflow-y-auto">
          {/* Spooky Header Badge */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-bold uppercase tracking-wider mb-4"
          >
            <Sparkles size={14} className="text-orange-400 animate-pulse" />
            <span>Selamat Datang di Gerbang Halloween 2026</span>
            <Sparkles size={14} className="text-orange-400 animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3"
          >
            Malam Mistis Bersama{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
              Bluefox AI
            </span>
          </motion.h1>

          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-sm sm:text-base text-slate-400 max-w-xl mb-8"
          >
            Pintu dimensi misteri terbuka lebar. Pilih salah satu topik di bawah ini untuk memulai percakapan sejarah dan fakta Halloween secara otomatis:
          </motion.p>

          {/* 3 Main Choice Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {menuOptions.map((item, index) => {
              const IconComp = item.icon;
              return (
                <motion.button
                  key={item.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSelectPrompt(item.prompt);
                    onClose();
                  }}
                  className={`relative text-left p-5 sm:p-6 rounded-2xl bg-gradient-to-b ${item.gradient} bg-[#110d1a]/80 backdrop-blur-md border ${item.borderColor} transition-all duration-300 shadow-xl shadow-black/40 group cursor-pointer flex flex-col justify-between`}
                >
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider font-mono px-2.5 py-1 rounded-full bg-white/10 text-orange-200 border border-white/10 mb-3">
                      {item.badge}
                    </span>

                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 group-hover:bg-orange-500/30 transition-colors">
                        <IconComp size={20} />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-orange-300 transition-colors">
                        {item.title}
                      </h3>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-4">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-orange-300 group-hover:text-orange-200">
                    <span>Mulai Chat Topik Ini</span>
                    <span className="text-base group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {onOpenEventHub && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <button
                onClick={onOpenEventHub}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-600/30 border border-orange-400/40 transition-all cursor-pointer"
              >
                <HalloweenCandySvg size={18} />
                <span>Masuk ke Event Hub & Kumpulkan Candy</span>
              </button>
            </motion.div>
          )}
        </div>

        {/* BOTTOM DECORATIVE BORDER */}
        <div className="relative z-10 w-full px-4 sm:px-8 py-3 flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-t from-black/90 to-transparent backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <SkeletonSkullSvg size={20} glow={false} />
            <span className="hidden sm:inline font-mono">Event Halloween 2026: 2 - 20 November</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs text-orange-300/80">
            <span className="hidden sm:inline font-mono">Ketik "pumpkin", "skeleton", atau "ghost" di kolom chat!</span>
            <PumpkinSvg size={20} glow={false} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
