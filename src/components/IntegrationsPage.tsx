import React from 'react';
import { ArrowLeft, Sparkles, Layers, Globe, Database, Github, Server, Rocket } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../lib/i18n';

interface IntegrationsPageProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export function IntegrationsPage({ onBack }: IntegrationsPageProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  // Daftar platform yang akan segera hadir di ekosistem MCP
  const upcomingPlatforms = [
    { name: 'Supabase', icon: Database, color: 'text-emerald-400', border: 'border-emerald-500/30' },
    { name: 'Google Workspace', icon: Globe, color: 'text-blue-400', border: 'border-blue-500/30' },
    { name: 'GitHub', icon: Github, color: 'text-purple-400', border: 'border-purple-500/30' },
    { name: 'Vercel', icon: Server, color: 'text-slate-200', border: 'border-slate-500/30' },
    { name: 'External Tools', icon: Layers, color: 'text-amber-400', border: 'border-amber-500/30' },
  ];

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Background Cosmic Starfield */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Twinkling & Streaming Stars */}
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${(i % 3) + 1.5}px`,
              height: `${(i % 3) + 1.5}px`,
              top: `${(i * 17) % 96}%`,
              left: `${(i * 23) % 98}%`,
              opacity: (i % 5) * 0.18 + 0.25,
              animation: `pulse ${(i % 3) + 2}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
              animationDelay: `${(i % 4) * 0.7}s`,
            }}
          />
        ))}

        {/* Ambient Nebula Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 w-full max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-all text-xs sm:text-sm font-semibold cursor-pointer backdrop-blur-md active:scale-95"
        >
          <ArrowLeft size={16} />
          <span>{isId ? 'Kembali ke Chat' : 'Back to Chat'}</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-wider uppercase">
          <Sparkles size={12} className="animate-spin text-blue-400" style={{ animationDuration: '6s' }} />
          <span>MCP Hub</span>
        </div>
      </header>

      {/* Centerpiece: Rocket Flying Upwards Carrying COMING SOON Banner */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center max-w-3xl mx-auto w-full">
        {/* Floating Rocket Container */}
        <div className="relative mb-6 flex flex-col items-center">
          {/* Animated Ascending & Floating Motion for Rocket */}
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{
              y: [-12, -32, -12],
              opacity: 1,
            }}
            transition={{
              y: {
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
              },
              opacity: { duration: 0.8 },
            }}
            className="relative flex flex-col items-center"
          >
            {/* Holographic Glowing "COMING SOON" Banner Attached to Rocket */}
            <motion.div
              animate={{
                rotate: [-2, 2, -2],
                y: [0, -3, 0],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="mb-4 relative"
            >
              <div className="relative px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-purple-600/90 border-2 border-blue-300/80 shadow-[0_0_35px_rgba(59,130,246,0.6)] backdrop-blur-md flex items-center justify-center gap-2">
                <Rocket size={18} className="text-cyan-300 animate-pulse shrink-0" />
                <span className="text-sm sm:text-base font-extrabold tracking-widest text-white uppercase drop-shadow-md">
                  COMING SOON
                </span>
                {/* Banner Ribbon Tails */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-4 bg-blue-500/80 clip-left" />
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-4 bg-purple-500/80 clip-right" />
              </div>
              {/* String tether connecting banner to rocket */}
              <div className="w-0.5 h-4 bg-blue-300/60 mx-auto shadow-sm" />
            </motion.div>

            {/* Custom High-Tech SVG Rocket */}
            <div className="relative">
              <svg
                width="84"
                height="110"
                viewBox="0 0 84 110"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-[0_0_20px_rgba(96,165,250,0.5)]"
              >
                {/* Rocket Body */}
                <path
                  d="M42 2C32 20 22 45 22 75C22 84 28 88 42 88C56 88 62 84 62 75C62 45 52 20 42 2Z"
                  fill="url(#rocket_body_grad)"
                  stroke="#93C5FD"
                  strokeWidth="2"
                />
                {/* Rocket Nose Cone Accent */}
                <path
                  d="M42 2C38 10 33 22 30 32C37 34 47 34 54 32C51 22 46 10 42 2Z"
                  fill="#2563EB"
                />
                {/* Porthole Glass Window */}
                <circle cx="42" cy="46" r="10" fill="#0F172A" stroke="#60A5FA" strokeWidth="2.5" />
                <circle cx="42" cy="46" r="7" fill="#38BDF8" opacity="0.8" />
                <circle cx="40" cy="43" r="2.5" fill="white" opacity="0.9" />
                
                {/* Left Fin */}
                <path
                  d="M22 62C12 66 4 78 6 92C12 91 20 86 23 80L22 62Z"
                  fill="#1E40AF"
                  stroke="#60A5FA"
                  strokeWidth="1.5"
                />
                {/* Right Fin */}
                <path
                  d="M62 62C72 66 80 78 78 92C72 91 64 86 61 80L62 62Z"
                  fill="#1E40AF"
                  stroke="#60A5FA"
                  strokeWidth="1.5"
                />
                {/* Center Fin Accent */}
                <path d="M41 68L43 68L43 86L41 86Z" fill="#3B82F6" />

                {/* Engine Nozzle */}
                <path
                  d="M33 88H51L47 96H37L33 88Z"
                  fill="#475569"
                  stroke="#94A3B8"
                  strokeWidth="1"
                />

                <defs>
                  <linearGradient id="rocket_body_grad" x1="42" y1="2" x2="42" y2="88" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F8FAFC" />
                    <stop offset="0.6" stopColor="#E2E8F0" />
                    <stop offset="1" stopColor="#94A3B8" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Pulsing Rocket Thruster Fire / Exhaust Smoke */}
              <motion.div
                animate={{
                  scaleY: [1, 1.45, 1],
                  opacity: [0.85, 1, 0.85],
                }}
                transition={{
                  duration: 0.35,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute left-1/2 -translate-x-1/2 top-[92px] flex flex-col items-center origin-top pointer-events-none"
              >
                <div className="w-5 h-12 rounded-full bg-gradient-to-b from-amber-200 via-orange-500 to-rose-600 blur-[2px] shadow-[0_0_25px_rgba(249,115,22,0.9)]" />
                <div className="w-8 h-10 rounded-full bg-blue-500/30 blur-md -mt-4" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Text Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3"
        >
          {isId ? 'Model Context Protocol (MCP)' : 'Model Context Protocol (MCP)'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed mb-8"
        >
          {isId
            ? 'Ekosistem integrasi agen AI dengan database eksternal dan aplikasi produktivitas Anda sedang dalam tahap peluncuran akhir.'
            : 'The AI agent integration ecosystem connecting to your external databases and productivity tools is finalizing its launch.'}
        </motion.p>

        {/* Upcoming Integrations Pill Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2.5 max-w-xl mx-auto mb-8"
        >
          {upcomingPlatforms.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border ${p.border} text-xs font-medium text-slate-300 shadow-xs`}
              >
                <Icon size={14} className={p.color} />
                <span>{p.name}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-mono">
                  {isId ? 'Segera' : 'Soon'}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            <span>{isId ? 'Kembali ke Percakapan' : 'Return to Chat'}</span>
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-500 border-t border-white/5">
        <p>Bluefox / TMPA Ecosystem • Autonomous Agent Protocol v2.5</p>
      </footer>
    </div>
  );
}

export default IntegrationsPage;
