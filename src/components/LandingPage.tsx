import { motion } from 'motion/react';
import { Bot, Sparkles, ArrowRight, Shield, Zap } from 'lucide-react';

export function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#00050b] text-white overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <motion.div
           animate={{
             scale: [1, 1.2, 0.9, 1.1, 1],
             opacity: [0.1, 0.2, 0.1, 0.15, 0.1],
           }}
           transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
           className="absolute w-[80vw] h-[80vw] md:w-[800px] md:h-[800px] rounded-full bg-blue-600 blur-[120px]"
        />
      </div>

      {/* Navigation */}
      <header className="px-6 py-6 md:px-12 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Tmpa Chat</span>
        </div>
        <button 
          onClick={onStart}
          className="text-sm font-medium hover:text-blue-400 transition-colors"
        >
          Masuk
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10 mt-[-5vh]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8">
            <Sparkles size={14} />
            <span>Asisten AI Masa Depan</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Tanya Apapun.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Selesaikan Lebih Cepat.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl leading-relaxed">
            Asisten AI profesional yang dirancang untuk membantu Anda menulis kode, menyusun email, menganalisis data, dan meningkatkan produktivitas harian.
          </p>

          <button
            onClick={onStart}
            className="group relative flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-medium text-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
          >
            <span>Get Started</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Features grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-24 max-w-4xl text-left"
        >
          <div className="bg-gray-900/40 border border-gray-800/50 p-6 rounded-2xl backdrop-blur-sm">
            <Zap className="text-amber-400 mb-4" size={24} />
            <h3 className="text-lg font-medium text-gray-200 mb-2">Respon Instan</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Dapatkan jawaban yang Anda butuhkan dalam hitungan detik dengan dukungan model LLM terbaru dan teringan.</p>
          </div>
          <div className="bg-gray-900/40 border border-gray-800/50 p-6 rounded-2xl backdrop-blur-sm">
            <Shield className="text-emerald-400 mb-4" size={24} />
            <h3 className="text-lg font-medium text-gray-200 mb-2">Aman & Privat</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Percakapan Anda aman dengan standar enkripsi tinggi dan kontrol kuota pintar untuk menjaga pengalaman stabil.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
