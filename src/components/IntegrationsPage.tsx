import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Sparkles, Layers, Globe, Database, Github, Server, Rocket,
  ShieldCheck, Check, ExternalLink, RefreshCw, Key, Copy, AlertCircle,
  Radio, Cpu, Code2, Link, Zap, Lock, Unlock, Eye, HelpCircle, X,
  AlertTriangle, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { isUserAdmin } from '../lib/accountManager';
import { getProviderClientId, setProviderClientId, isValidClientId } from '../lib/env';

interface IntegrationsPageProps {
  onBack?: () => void;
  isStandalone?: boolean;
  user?: any;
}

interface McpService {
  id: string;
  name: string;
  category: 'developer' | 'productivity' | 'design' | 'automation';
  icon: any;
  color: string;
  bgLight: string;
  bgDark: string;
  borderColor: string;
  scopes: string;
  description: string;
  features: string[];
}

export function IntegrationsPage({ onBack, user: propUser }: IntegrationsPageProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [activeUser, setActiveUser] = useState<any>(propUser || null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isUserAdmin(propUser));
  // Mode pratinjau animasi Coming Soon (khusus admin yang ingin melihat tampilan non-admin)
  const [previewComingSoon, setPreviewComingSoon] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'developer' | 'productivity' | 'design' | 'automation'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // Modal konfigurasi Client ID (jika env Vercel belum redeploy atau admin ingin input langsung)
  const [configModalProvider, setConfigModalProvider] = useState<string | null>(null);
  const [configModalInput, setConfigModalInput] = useState<string>('');

  // Status koneksi lokal yang tersimpan
  const [connectedProviders, setConnectedProviders] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('tmpa_mcp_connected_providers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (propUser) {
      setActiveUser(propUser);
      setIsAdmin(isUserAdmin(propUser));
    } else {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setActiveUser(data.user);
          setIsAdmin(isUserAdmin(data.user));
        }
      });
    }
  }, [propUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --------------------------------------------------------------------------
  // REDIRECT URI & OAUTH HANDLER (Sesuai Spesifikasi MCP Backend & Frontend)
  // --------------------------------------------------------------------------
  const SUPABASE_BASE_URL = (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://jjlanjshpyklqayjzxyy.supabase.co';
  const REDIRECT_URI = `${SUPABASE_BASE_URL}/functions/v1/TMPA-MCP`;

  async function handleOAuthConnect(providerId: string, overrideClientId?: string) {
    try {
      setConnectingProvider(providerId);
      const { data: { user } } = await supabase.auth.getUser();
      const currentUser = user || activeUser;

      if (!currentUser) {
        alert(isId ? "Silakan login terlebih dahulu." : "Please sign in first.");
        setConnectingProvider(null);
        return;
      }

      // Ambil Client ID dari override, env Vercel, atau localStorage
      const effectiveClientId = (overrideClientId || getProviderClientId(providerId) || '').trim();

      // CEK VALIDASI CLIENT ID:
      // Jika Client ID belum ada di Vercel atau belum terbaca, cegah redirect ke Google!
      // Ini mencegah munculnya "Error 401: invalid_client - The OAuth client was not found".
      if (!isValidClientId(effectiveClientId)) {
        setConnectingProvider(null);
        setConfigModalProvider(providerId);
        setConfigModalInput(effectiveClientId);
        return;
      }

      // Menyimpan data user dan provider ke dalam state agar dibaca backend Edge Function
      const statePayload = encodeURIComponent(
        JSON.stringify({ userId: currentUser.id, provider: providerId })
      );

      let oauthUrl = "";

      switch (providerId) {
        case "google": {
          const scopes = encodeURIComponent(
            "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets"
          );
          oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(effectiveClientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${statePayload}&access_type=offline&prompt=consent`;
          break;
        }
        case "vercel": {
          oauthUrl = `https://vercel.com/oauth/authorize?client_id=${encodeURIComponent(effectiveClientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${statePayload}`;
          break;
        }
        case "github": {
          oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(effectiveClientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=repo%20read:user&state=${statePayload}`;
          break;
        }
        case "supabase": {
          oauthUrl = `https://api.supabase.com/v1/oauth/authorize?client_id=${encodeURIComponent(effectiveClientId)}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${statePayload}`;
          break;
        }
        case "netlify": {
          oauthUrl = `https://app.netlify.com/authorize?client_id=${encodeURIComponent(effectiveClientId)}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${statePayload}`;
          break;
        }
        case "figma": {
          oauthUrl = `https://www.figma.com/oauth?client_id=${encodeURIComponent(effectiveClientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=files:read&state=${statePayload}&response_type=code`;
          break;
        }
        case "airtable": {
          oauthUrl = `https://airtable.com/oauth2/v1/authorize?client_id=${encodeURIComponent(effectiveClientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=data.records:read%20data.records:write&state=${statePayload}`;
          break;
        }
        default: {
          showToast(isId ? `Menghubungkan layanan ${providerId}...` : `Connecting ${providerId}...`);
          const updated = { ...connectedProviders, [providerId]: true };
          setConnectedProviders(updated);
          localStorage.setItem('tmpa_mcp_connected_providers', JSON.stringify(updated));
          setConnectingProvider(null);
          return;
        }
      }

      if (oauthUrl) {
        const updated = { ...connectedProviders, [providerId]: true };
        setConnectedProviders(updated);
        localStorage.setItem('tmpa_mcp_connected_providers', JSON.stringify(updated));
        window.location.href = oauthUrl;
      }
    } catch (err: any) {
      console.error("OAuth Error:", err);
      alert(isId ? "Gagal memproses koneksi OAuth." : "Failed to initiate OAuth.");
    } finally {
      setConnectingProvider(null);
    }
  }

  const handleDisconnect = (providerId: string) => {
    const updated = { ...connectedProviders, [providerId]: false };
    setConnectedProviders(updated);
    localStorage.setItem('tmpa_mcp_connected_providers', JSON.stringify(updated));
    showToast(isId ? `Koneksi ${providerId} diputuskan.` : `Disconnected ${providerId}.`);
  };

  const handleSaveModalClientId = (andConnect: boolean = false) => {
    if (!configModalProvider) return;
    const trimmed = configModalInput.trim();
    if (!isValidClientId(trimmed)) {
      alert(isId 
        ? "Format Client ID tidak valid. Pastikan bukan string placeholder atau kosong." 
        : "Invalid Client ID format. Please make sure it is not empty or a dummy placeholder.");
      return;
    }

    setProviderClientId(configModalProvider, trimmed);
    const targetProvider = configModalProvider;
    setConfigModalProvider(null);
    showToast(isId ? `Client ID ${targetProvider} berhasil disimpan!` : `Client ID for ${targetProvider} saved!`);

    if (andConnect) {
      setTimeout(() => {
        handleOAuthConnect(targetProvider, trimmed);
      }, 300);
    }
  };

  // 11 Layanan MCP Platform TMPA
  const mcpServices: McpService[] = [
    {
      id: 'google',
      name: 'Google Workspace',
      category: 'productivity',
      icon: Globe,
      color: 'text-blue-500',
      bgLight: 'bg-blue-50',
      bgDark: 'bg-blue-950/40',
      borderColor: 'border-blue-500/30',
      scopes: 'gmail.modify, calendar, spreadsheets',
      description: isId 
        ? 'Akses AI ke Gmail, Google Calendar, dan Google Sheets secara real-time.' 
        : 'AI access to Gmail, Google Calendar, and Google Sheets in real-time.',
      features: ['Baca & Tulis Email', 'Agenda Kalender', 'Otomasi Spreadsheet']
    },
    {
      id: 'supabase',
      name: 'Supabase Database',
      category: 'developer',
      icon: Database,
      color: 'text-emerald-500',
      bgLight: 'bg-emerald-50',
      bgDark: 'bg-emerald-950/40',
      borderColor: 'border-emerald-500/30',
      scopes: 'all (project management & db)',
      description: isId 
        ? 'Query database PostgreSQL, manajemen skema tabel, dan bucket storage.' 
        : 'PostgreSQL database queries, table schema inspection, and storage management.',
      features: ['SQL Query Execution', 'Database Schema', 'Bucket Storage']
    },
    {
      id: 'github',
      name: 'GitHub Repository',
      category: 'developer',
      icon: Github,
      color: 'text-purple-500',
      bgLight: 'bg-purple-50',
      bgDark: 'bg-purple-950/40',
      borderColor: 'border-purple-500/30',
      scopes: 'repo, read:user',
      description: isId 
        ? 'Pemeriksaan berkas repositori, pembuatan issue, dan peninjauan pull request.' 
        : 'Repository files inspection, issue tracker, and pull request reviews.',
      features: ['Code Search', 'Create Issues', 'Read PRs & Commits']
    },
    {
      id: 'vercel',
      name: 'Vercel Deployment',
      category: 'developer',
      icon: Server,
      color: 'text-slate-800 dark:text-slate-200',
      bgLight: 'bg-slate-100',
      bgDark: 'bg-slate-800/60',
      borderColor: 'border-slate-500/30',
      scopes: 'deployments, projects',
      description: isId 
        ? 'Pemantauan log build deployment, status serverless, dan integrasi domain.' 
        : 'Deployment build logs, serverless status, and domain configuration.',
      features: ['Deploy Triggers', 'Live Build Logs', 'Environment Sync']
    },
    {
      id: 'netlify',
      name: 'Netlify Edge',
      category: 'developer',
      icon: Cpu,
      color: 'text-teal-500',
      bgLight: 'bg-teal-50',
      bgDark: 'bg-teal-950/40',
      borderColor: 'border-teal-500/30',
      scopes: 'site management, webhooks',
      description: isId 
        ? 'Pengelolaan hosting web statis, edge lambdas, dan deployment hooks.' 
        : 'Static web hosting, edge lambdas, and automated deployment hooks.',
      features: ['Edge Functions', 'Deploy Webhooks', 'Form Handlers']
    },
    {
      id: 'figma',
      name: 'Figma Design',
      category: 'design',
      icon: Code2,
      color: 'text-pink-500',
      bgLight: 'bg-pink-50',
      bgDark: 'bg-pink-950/40',
      borderColor: 'border-pink-500/30',
      scopes: 'files:read',
      description: isId 
        ? 'Ekstraksi token warna, komponen UI, dan inspeksi frame desain Figma.' 
        : 'Extract design tokens, UI components, and Figma frame structure.',
      features: ['Design Tokens', 'Vector SVG Export', 'Frame Inspector']
    },
    {
      id: 'airtable',
      name: 'Airtable Base',
      category: 'productivity',
      icon: Layers,
      color: 'text-amber-500',
      bgLight: 'bg-amber-50',
      bgDark: 'bg-amber-950/40',
      borderColor: 'border-amber-500/30',
      scopes: 'data.records:read, data.records:write',
      description: isId 
        ? 'Penyimpanan tabel relasional tanpa kode dan integrasi basis data cerdas.' 
        : 'No-code relational tables and intelligent database querying.',
      features: ['Sync Records', 'Relational Links', 'Automated Tables']
    },
    {
      id: 'canva',
      name: 'Canva Assets',
      category: 'design',
      icon: Sparkles,
      color: 'text-cyan-500',
      bgLight: 'bg-cyan-50',
      bgDark: 'bg-cyan-950/40',
      borderColor: 'border-cyan-500/30',
      scopes: 'asset:read, brand:read',
      description: isId 
        ? 'Akses ke aset brand, template desain grafis, dan visual generator.' 
        : 'Access brand kits, visual templates, and graphic design assets.',
      features: ['Brand Assets', 'Graphic Templates', 'Media Generator']
    },
    {
      id: 'make',
      name: 'Make (Integromat)',
      category: 'automation',
      icon: Zap,
      color: 'text-indigo-500',
      bgLight: 'bg-indigo-50',
      bgDark: 'bg-indigo-950/40',
      borderColor: 'border-indigo-500/30',
      scopes: 'scenarios:run, webhooks',
      description: isId 
        ? 'Pemicu skenario otomasi multi-aplikasi melalui webhook interaktif.' 
        : 'Trigger multi-app automation scenarios via interactive webhooks.',
      features: ['Scenario Trigger', 'Webhook Handlers', 'Workflow Relays']
    },
    {
      id: 'slack',
      name: 'Slack Workspace',
      category: 'productivity',
      icon: Radio,
      color: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      bgDark: 'bg-emerald-950/40',
      borderColor: 'border-emerald-600/30',
      scopes: 'chat:write, channels:read',
      description: isId 
        ? 'Kirim notifikasi ringkasan percakapan dan alert cerdas ke channel tim.' 
        : 'Send conversation summaries and smart alerts directly to team channels.',
      features: ['Channel Messages', 'Team Alerts', 'Direct Bot Replies']
    },
    {
      id: 'discord',
      name: 'Discord Webhook',
      category: 'automation',
      icon: Link,
      color: 'text-violet-500',
      bgLight: 'bg-violet-50',
      bgDark: 'bg-violet-950/40',
      borderColor: 'border-violet-500/30',
      scopes: 'webhooks, bot',
      description: isId 
        ? 'Siarkan hasil query AI dan log aktivitas ke server Discord komunitas.' 
        : 'Broadcast AI query results and activity logs to community Discord servers.',
      features: ['Rich Embeds', 'Community Broadcast', 'Realtime Webhooks']
    }
  ];

  const filteredServices = mcpServices.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // =========================================================================
  // VIEW UNTUK NON-ADMIN (Atau Admin yang sedang preview Coming Soon)
  // Menampilkan animasi roket kosmis high-tech Coming Soon yang tetap sama persis!
  // =========================================================================
  if (!isAdmin || previewComingSoon) {
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

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setPreviewComingSoon(false)}
                className="px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <ShieldCheck size={13} className="text-amber-400" />
                <span>{isId ? 'Buka Dashboard Admin MCP' : 'Open Admin MCP'}</span>
              </button>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-wider uppercase">
              <Sparkles size={12} className="animate-spin text-blue-400" style={{ animationDuration: '6s' }} />
              <span>MCP Hub</span>
            </div>
          </div>
        </header>

        {/* Centerpiece: Rocket Flying Upwards Carrying COMING SOON Banner */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center max-w-3xl mx-auto w-full">
          {/* Floating Rocket Container */}
          <div className="relative mb-6 flex flex-col items-center">
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
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-4 bg-blue-500/80 clip-left" />
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-4 bg-purple-500/80 clip-right" />
                </div>
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
                  <path
                    d="M42 2C32 20 22 45 22 75C22 84 28 88 42 88C56 88 62 84 62 75C62 45 52 20 42 2Z"
                    fill="url(#rocket_body_grad)"
                    stroke="#93C5FD"
                    strokeWidth="2"
                  />
                  <path
                    d="M42 2C38 10 33 22 30 32C37 34 47 34 54 32C51 22 46 10 42 2Z"
                    fill="#2563EB"
                  />
                  <circle cx="42" cy="46" r="10" fill="#0F172A" stroke="#60A5FA" strokeWidth="2.5" />
                  <circle cx="42" cy="46" r="7" fill="#38BDF8" opacity="0.8" />
                  <circle cx="40" cy="43" r="2.5" fill="white" opacity="0.9" />
                  
                  <path
                    d="M22 62C12 66 4 78 6 92C12 91 20 86 23 80L22 62Z"
                    fill="#1E40AF"
                    stroke="#60A5FA"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M62 62C72 66 80 78 78 92C72 91 64 86 61 80L62 62Z"
                    fill="#1E40AF"
                    stroke="#60A5FA"
                    strokeWidth="1.5"
                  />
                  <path d="M41 68L43 68L43 86L41 86Z" fill="#3B82F6" />
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

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3"
          >
            Model Context Protocol (MCP)
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

        <footer className="relative z-10 py-5 text-center text-xs text-slate-500 border-t border-white/5">
          <p>Bluefox / TMPA Ecosystem • Autonomous Agent Protocol v2.5</p>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW UNTUK ROLE ADMIN:
  // Dashboard MCP Hub Fungsional Penuh dengan 11 Platform & OAuth Integration!
  // =========================================================================
  return (
    <div className="relative min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Toast Notifikasi */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-blue-600/90 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-blue-400/40 text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md"
          >
            <Check size={16} className="text-white" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Admin */}
      <header className="sticky top-0 z-30 w-full bg-[#030712]/80 backdrop-blur-xl border-b border-blue-500/20 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isId ? 'Kembali' : 'Back'}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Layers className="text-blue-500" size={20} />
                  <span>TMPA Model Context Protocol (MCP)</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                  <ShieldCheck size={12} className="text-amber-400" />
                  <span>Akses Admin Aktif</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isId 
                  ? 'Panel kontrol integrasi data eksternal 11 platform berbasis MCP Edge Function' 
                  : 'External data integration control hub connecting 11 MCP platforms'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setPreviewComingSoon(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              title="Lihat tampilan Coming Soon yang dilihat oleh pengguna non-admin"
            >
              <Eye size={13} className="text-cyan-400" />
              <span className="hidden sm:inline">{isId ? 'Lihat Tampilan Non-Admin' : 'Preview Coming Soon'}</span>
            </button>

            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>MCP v2.5 Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
        
        {/* Banner Info Edge Function & OAuth Endpoint */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-purple-950/40 border border-blue-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-mono font-bold">
                  SERVERLESS MCP ENDPOINT
                </span>
                <span className="text-xs text-slate-400">Supabase Edge Function</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Backend Edge Function TMPA-MCP
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-mono bg-black/40 p-3 rounded-xl border border-white/5 break-all select-all flex items-center justify-between gap-3">
                <span>{REDIRECT_URI}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(REDIRECT_URI);
                    showToast(isId ? 'URL Endpoint berhasil disalin!' : 'Endpoint URL copied!');
                  }}
                  className="p-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 transition-colors shrink-0 cursor-pointer"
                  title="Salin URL Endpoint"
                >
                  <Copy size={14} />
                </button>
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                <span>
                  Authorized Redirect URI: <strong className="text-blue-300 font-mono">{REDIRECT_URI}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
              <a
                href={REDIRECT_URI}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>{isId ? 'Cek Status Fungsi' : 'Check Function'}</span>
              </a>
              <button
                onClick={() => {
                  showToast(isId ? 'Endpoint Edge Function aktif dan merespons normal.' : 'Edge Function endpoint active.');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>{isId ? 'Uji Ping Koneksi' : 'Test Ping'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-2xl w-full sm:w-auto overflow-x-auto">
            {(['all', 'developer', 'productivity', 'design', 'automation'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer shrink-0 ${
                  selectedCategory === cat 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {cat === 'all' ? (isId ? 'Semua (11)' : 'All (11)') : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isId ? 'Cari integrasi MCP...' : 'Search MCP integrations...'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Grid 11 Platform MCP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredServices.map(service => {
            const Icon = service.icon;
            const isConnected = Boolean(connectedProviders[service.id]);
            const isConnecting = connectingProvider === service.id;
            const currentClientId = getProviderClientId(service.id);
            const hasValidClientId = isValidClientId(currentClientId);

            return (
              <div
                key={service.id}
                className={`flex flex-col justify-between p-5 rounded-3xl border bg-slate-900/50 backdrop-blur-sm transition-all hover:border-blue-500/40 hover:bg-slate-900/80 hover:shadow-xl ${
                  isConnected ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-slate-800'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header: Icon + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl ${service.bgDark} border ${service.borderColor} flex items-center justify-center shrink-0`}>
                        <Icon size={24} className={service.color} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base leading-snug">
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            ID: {service.id}
                          </span>
                          {/* Client ID Status Pill */}
                          {hasValidClientId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-semibold" title={currentClientId}>
                              <Check size={10} className="stroke-[3]" /> Client ID Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono font-semibold">
                              <AlertCircle size={10} /> Client ID Perlu Diatur
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Tombol Pengaturan Client ID */}
                      <button
                        type="button"
                        onClick={() => {
                          setConfigModalProvider(service.id);
                          setConfigModalInput(currentClientId);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Atur / Cek Client ID"
                      >
                        <Key size={13} />
                      </button>

                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-extrabold uppercase">
                          <Check size={11} className="stroke-[3]" />
                          <span>Terhubung</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700">
                          Belum Aktif
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Feature Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {service.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-slate-300 font-medium"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>

                  {/* Scope info */}
                  <div className="pt-2 border-t border-white/5 text-[11px] font-mono text-slate-500 truncate" title={service.scopes}>
                    Scope: {service.scopes}
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-5 mt-4 border-t border-white/5 flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleOAuthConnect(service.id)}
                        disabled={isConnecting}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={12} className={isConnecting ? "animate-spin" : ""} />
                        <span>{isId ? 'Sinkronkan Ulang' : 'Resync'}</span>
                      </button>
                      <button
                        onClick={() => handleDisconnect(service.id)}
                        className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
                        title={isId ? 'Putuskan Akses' : 'Disconnect'}
                      >
                        {isId ? 'Putus' : 'Revoke'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOAuthConnect(service.id)}
                      disabled={isConnecting}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={13} />
                      <span>
                        {isConnecting 
                          ? (isId ? 'Memproses OAuth...' : 'Redirecting...') 
                          : (isId ? `Hubungkan ${service.name}` : `Connect ${service.name}`)}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Protocol Guide Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-white font-bold">
            <HelpCircle size={16} className="text-blue-400" />
            <span>Cara Kerja Protokol MCP (Model Context Protocol) di Bluefox</span>
          </div>
          <p className="leading-relaxed">
            1. <strong>Otentikasi OAuth Aman:</strong> Admin mengotorisasi akun platform pihak ketiga melalui URL otentikasi resmi. Parameter <code>state</code> mengikat UUID akun Anda dengan layanan yang dipilih.
          </p>
          <p className="leading-relaxed">
            2. <strong>Penyimpanan Kredensial Serverless:</strong> Kode pertukaran (token) diproses secara aman oleh Edge Function <code>TMPA-MCP</code> di Supabase. Kunci rahasia tidak pernah diekspos ke browser klien.
          </p>
          <p className="leading-relaxed">
            3. <strong>Akses Alat AI (Tool Calling):</strong> Model Bluefox (Pro, Standard, Dilo) akan secara otomatis memanggil alat MCP yang relevan saat Anda menanyakan konteks email, jadwal kalender, repo GitHub, atau baris database.
          </p>
        </div>
      </main>

      {/* Modal Dialog: Atur / Masukkan Client ID OAuth */}
      <AnimatePresence>
        {configModalProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-[#0d1527] border border-blue-500/30 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-400/30 text-blue-400 flex items-center justify-center">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      Konfigurasi Client ID: <span className="capitalize text-blue-400">{configModalProvider}</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Mencegah Error 401 (invalid_client) saat login OAuth
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfigModalProvider(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Notice Box */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle size={14} />
                  <span>Penyebab Error 401 "The OAuth client was not found":</span>
                </div>
                <p>
                  Google membutuhkan <strong>Client ID resmi</strong> Anda (contoh: <code>123456...apps.googleusercontent.com</code>). Jika variabel di Vercel belum terbaca saat build atau nama variabel berbeda, Anda dapat menempelkannya langsung di bawah ini.
                </p>
              </div>

              {/* Form Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  OAuth Client ID {configModalProvider.toUpperCase()}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={configModalInput}
                    onChange={(e) => setConfigModalInput(e.target.value)}
                    placeholder={
                      configModalProvider === 'google' 
                        ? '123456789-xxxxxxxx.apps.googleusercontent.com' 
                        : 'Masukkan Client ID platform...'
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-blue-500 pr-20"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) setConfigModalInput(clip.trim());
                      } catch {}
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    Paste
                  </button>
                </div>
              </div>

              {/* Panduan Pengaturan Vercel & Google Cloud */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-[11px] text-slate-400 space-y-2">
                <div className="font-semibold text-slate-300">
                  Panduan Pengaturan di Vercel & Google Cloud Console:
                </div>
                <p>
                  1. <strong>Di Vercel Environment Variables:</strong> Pastikan nama variabel adalah <code className="text-blue-300">VITE_{configModalProvider.toUpperCase()}_CLIENT_ID</code> atau <code className="text-blue-300">{configModalProvider.toUpperCase()}_CLIENT_ID</code>.
                </p>
                <p>
                  2. <strong>Di Google Cloud Console (Authorized redirect URIs):</strong> Pastikan Anda telah memasukkan URL redirect ini:
                </p>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-white/10 font-mono text-slate-200 text-[10px] break-all">
                  <span>{REDIRECT_URI}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(REDIRECT_URI);
                      showToast(isId ? 'Redirect URI berhasil disalin!' : 'Redirect URI copied!');
                    }}
                    className="p-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 shrink-0 ml-2 cursor-pointer"
                    title="Salin URI"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfigModalProvider(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveModalClientId(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Simpan Saja
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveModalClientId(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Simpan & Lanjutkan OAuth</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-6 px-4 text-center text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p>Bluefox Autonomous AI Agent • MCP (Model Context Protocol) Gateway • Khusus Akses Administrator</p>
      </footer>
    </div>
  );
}

export default IntegrationsPage;
