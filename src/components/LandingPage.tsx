import { motion } from 'motion/react';
import { ArrowRight, Shield, Zap, Sparkles, Search, Brain } from 'lucide-react';

const LOGO_URL = 'https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/Video%20atau%20asset/T_20260809_163901_0000.png';

export function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden relative app-clean-grid">
      {/* Navigation */}
      <header className="px-6 py-5 md:px-12 flex justify-between items-center border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <img 
            src={LOGO_URL} 
            alt="Bluefox AI Logo" 
            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-xs"
          />
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-900 leading-tight">Bluefox AI</span>
            <span className="text-[10px] text-blue-600 font-semibold tracking-wider uppercase font-mono">Chat & Intelligence</span>
          </div>
        </div>
        <button 
          onClick={onStart}
          className="text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
        >
          Mulai Chat
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-3xl flex flex-col items-center"
        >
          {/* Logo Badge */}
          <div className="mb-6 flex items-center justify-center">
            <div className="p-2 rounded-2xl bg-white border border-slate-200 shadow-md">
              <img 
                src={LOGO_URL} 
                alt="Bluefox AI" 
                className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover"
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-6 shadow-xs">
            <Sparkles size={13} className="text-blue-600" />
            <span>Asisten AI Generasi Baru · Multi-Model & Real-time Web</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5 text-slate-900 leading-[1.15]">
            Tanya Apapun.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700">
              Selesaikan Lebih Cepat.
            </span>
          </h1>
          
          <p className="text-base sm:text-lg text-slate-600 mb-8 max-w-xl leading-relaxed">
            Asisten AI cerdas untuk bertukar ide, penulisan kode, penelusuran web real-time yang akurat, serta otomasi tugas harian Anda.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onStart}
              className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
            >
              <span>Mulai Percakapan Sekarang</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Features grid */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-4xl w-full text-left"
        >
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-100">
              <Zap size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Tiga Model Canggih</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dukungan penuh model <strong>bluefox pro</strong> (Vision & Multi-modal), <strong>bluefox standard</strong>, dan <strong>bluefox Dilo</strong>.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-3.5 border border-cyan-100">
              <Search size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Pencarian Web & Advance</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pencarian web multi-query 3-5 sumber dengan mode advance otomatis untuk informasi faktual yang akurat dan terkini.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5 border border-emerald-100">
              <Shield size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Aman & Terenkripsi</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Keamanan data sesi dengan manajemen kuota pintar per 5 jam dan mingguan yang transparan dan stabil.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        © 2026 Bluefox AI. All rights reserved.
      </footer>
    </div>
  );
}
