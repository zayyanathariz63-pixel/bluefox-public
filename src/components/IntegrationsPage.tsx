import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProviderClientId, SUPABASE_CONFIG } from "../lib/env";
import { 
  ArrowLeft, Search, RefreshCw, X, Check, Sparkles,
  ShieldCheck, ExternalLink, Key, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export interface IntegrationConfig {
  id: string;
  name: string;
  type: "oauth" | "apikey";
  logo: string; // URL Logo SVG Resmi
  shortDesc: string;
  fullDesc: string;
  features: string[];
}

export interface IntegrationState extends IntegrationConfig {
  connected: boolean;
  tokenSnippet?: string;
}

// Daftar Provider tanpa Figma sesuai spesifikasi terbaru
export const PROVIDERS_CONFIG: IntegrationConfig[] = [
  {
    id: "user_supabase",
    name: "Supabase User",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/supabase",
    shortDesc: "Akses Management API & Database pengguna",
    fullDesc: "Izinkan AI Bluefox untuk mengelola project, menjalankan query database, eksekusi SQL migration, dan memantau status Supabase milik Anda.",
    features: ["Kelola Database & Tabel", "Eksekusi Migration", "BACA & Tulis RLS Policies", "Pantau Edge Functions"]
  },
  {
    id: "google",
    name: "Google Workspace",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/google",
    shortDesc: "Gmail, Drive, Sheets, Docs, Calendar, Slides",
    fullDesc: "Hubungkan seluruh ekosistem Google Workspace agar AI Bluefox dapat membantu menjadwalkan acara, membaca dokumen, membuat spreadsheet, dan mengelola email Anda.",
    features: ["Kirim & Baca Email Gmail", "Otomatisasi Google Sheets", "Buat Dokumen Google Docs", "Atur Jadwal Google Calendar"]
  },
  {
    id: "github",
    name: "GitHub",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/github/white",
    shortDesc: "Kelola Repositori, Issue, dan Commit",
    fullDesc: "Integrasikan akun GitHub Anda agar AI Bluefox dapat membantu membuat repository baru, mengelola issue, pull request, dan otomatisasi workflow CI/CD.",
    features: ["Buat & Edit Repositori", "Manajemen Issues & PR", "Push Code & Commit", "Jalankan GitHub Actions"]
  },
  {
    id: "vercel",
    name: "Vercel",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/vercel/white",
    shortDesc: "Pantau Deployment dan Serverless Logs",
    fullDesc: "Hubungkan Vercel untuk memantau status deployment project frontend/backend Anda, memeriksa build logs, dan mengelola environment variables.",
    features: ["Cek Build & Deployment Logs", "Atur Environment Variables", "Kelola Domain & Project"]
  },
  {
    id: "netlify",
    name: "Netlify",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/netlify",
    shortDesc: "Kelola Situs dan Forms Submissions",
    fullDesc: "Integrasi Netlify untuk mempermudah AI Bluefox memantau situs, mengelola form submissions, dan mengonfigurasi fitur hosting JAMstack.",
    features: ["Deploy Status & Logs", "Manajemen Forms Data", "Pengaturan Webhooks"]
  },
  {
    id: "airtable",
    name: "Airtable",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/airtable",
    shortDesc: "Akses Basis Data Relasional Airtable",
    fullDesc: "Izinkan AI Bluefox membaca dan menulis record di basis data Airtable Anda untuk manajemen tugas, CRM, atau basis pengetahuan.",
    features: ["BACA & Tulis Records", "Kelola Bases & Tables", "Otomatisasi Sync Data"]
  },
  {
    id: "canva",
    name: "Canva",
    type: "oauth",
    logo: "https://cdn.simpleicons.org/canva",
    shortDesc: "Akses Aset dan Desain Canva",
    fullDesc: "Integrasikan akun Canva untuk membaca metadata desain, mengakses folder aset, serta membuat draf konten visual otomatis.",
    features: ["Akses Folder Aset Media", "Membaca Metadata Desain", "Ekspor Hasil Desain"]
  },
  {
    id: "make",
    name: "Make (Integromat)",
    type: "apikey",
    logo: "https://cdn.simpleicons.org/make",
    shortDesc: "Trigger otomatisasi skenario Make",
    fullDesc: "Hubungkan API Key atau Webhook Make agar AI Bluefox bisa memicu (trigger) skenario otomatisasi kompleks antar aplikasi.",
    features: ["Trigger Scenario Webhook", "Kirim Parameter Data Custom", "Eksekusi Otomatisasi"]
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    type: "apikey",
    logo: "https://cdn.simpleicons.org/huggingface",
    shortDesc: "Model AI kustom & Dataset",
    fullDesc: "Masukkan User Access Token Hugging Face untuk mengeksekusi model AI kustom, memuat datasets, atau menjalankan Inference API.",
    features: ["Akses Inference API", "Panggil AI Model Custom", "Kelola Datasets"]
  },
  {
    id: "resend",
    name: "Resend",
    type: "apikey",
    logo: "https://cdn.simpleicons.org/resend/white",
    shortDesc: "Kirim email transactional via AI",
    fullDesc: "Masukkan API Key Resend agar AI Bluefox dapat mengirim email transaksional dan notifikasi kustom ke pengguna Anda.",
    features: ["Kirim Transactional Email", "Atur Template Email", "Cek Analytics Pengiriman"]
  },
];

interface IntegrationsPageProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export function IntegrationsPage({ onBack, isStandalone = true }: IntegrationsPageProps) {
  const [integrations, setIntegrations] = useState<IntegrationState[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk menyimpan provider yang sedang dibuka detailnya
  const [activeModalProvider, setActiveModalProvider] = useState<IntegrationState | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "oauth" | "apikey" | "connected">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<IntegrationState | null>(null);

  const SUPABASE_PROJECT_URL = SUPABASE_CONFIG.url;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    fetchStatusIntegrasi();
  }, []);

  async function fetchStatusIntegrasi() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const defaultList = PROVIDERS_CONFIG.map((p) => ({
          ...p,
          connected: false,
        }));
        setIntegrations(defaultList);
        setLoading(false);
        return;
      }

      const { data: userIntegrations, error } = await supabase
        .from("user_integrations")
        .select("provider, access_token")
        .eq("user_id", user.id);

      if (error) {
        console.warn("Info fetch user_integrations:", error.message);
      }

      const connectedMap = new Map<string, string>();
      userIntegrations?.forEach((item) => {
        connectedMap.set(item.provider, item.access_token || "connected");
      });

      const updatedList = PROVIDERS_CONFIG.map((p) => {
        const isConnected = connectedMap.has(p.id);
        return {
          ...p,
          connected: isConnected,
          tokenSnippet: isConnected ? connectedMap.get(p.id) : undefined
        };
      });

      setIntegrations(updatedList);
    } catch (err: any) {
      console.error("Gagal mengambil status integrasi:", err);
      const defaultList = PROVIDERS_CONFIG.map((p) => ({
        ...p,
        connected: false,
      }));
      setIntegrations(defaultList);
    } finally {
      setLoading(false);
    }
  }

  // Handle proses Hubungkan (OAuth) ke TMPA-MCP
  async function handleOAuthConnect(providerId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Silakan login terlebih dahulu.");
      return;
    }

    // Base URL tunggal untuk semua callback OAuth diarahkan ke TMPA-MCP
    const REDIRECT_URI = encodeURIComponent(
      `${SUPABASE_PROJECT_URL}/functions/v1/TMPA-MCP`
    );

    // Memasukkan userId dan providerId ke dalam state
    const state = encodeURIComponent(
      JSON.stringify({ userId: user.id, provider: providerId })
    );

    let oauthUrl = "";

    const metaEnv = (import.meta as any).env || {};

    switch (providerId) {
      case "user_supabase": {
        const clientId = metaEnv.VITE_SUPABASE_CLIENT_ID || getProviderClientId("user_supabase");
        oauthUrl = `https://api.supabase.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${REDIRECT_URI}&state=${state}`;
        break;
      }
      case "google": {
        const clientId = metaEnv.VITE_GOOGLE_CLIENT_ID || getProviderClientId("google");
        const scopes = encodeURIComponent(
          "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents"
        );
        oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&state=${state}&access_type=offline&prompt=consent`;
        break;
      }
      case "github": {
        const clientId = metaEnv.VITE_GITHUB_CLIENT_ID || getProviderClientId("github");
        oauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${REDIRECT_URI}&scope=repo%20read:user&state=${state}`;
        break;
      }
      case "vercel": {
        const clientId = metaEnv.VITE_VERCEL_CLIENT_ID || getProviderClientId("vercel");
        oauthUrl = `https://vercel.com/oauth/authorize?client_id=${clientId}&redirect_uri=${REDIRECT_URI}&state=${state}`;
        break;
      }
      case "netlify": {
        const clientId = metaEnv.VITE_NETLIFY_CLIENT_ID || getProviderClientId("netlify");
        oauthUrl = `https://app.netlify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${REDIRECT_URI}&state=${state}`;
        break;
      }
      case "airtable": {
        const clientId = metaEnv.VITE_AIRTABLE_CLIENT_ID || getProviderClientId("airtable");
        oauthUrl = `https://airtable.com/oauth2/v1/authorize?client_id=${clientId}&redirect_uri=${REDIRECT_URI}&state=${state}&scope=data.records:read%20data.records:write`;
        break;
      }
      case "canva": {
        const clientId = metaEnv.VITE_CANVA_CLIENT_ID || getProviderClientId("canva");
        oauthUrl = `https://www.canva.com/api/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${REDIRECT_URI}&state=${state}`;
        break;
      }
    }

    if (oauthUrl) {
      showToast(`Membuka otorisasi ${providerId.toUpperCase()}...`);
      setTimeout(() => {
        window.location.href = oauthUrl;
      }, 300);
    }
  }

  // Handle proses Simpan API Key Manual
  async function handleSaveApiKey(providerId: string) {
    if (!apiKeyInput.trim()) {
      showToast("API Key tidak boleh kosong!");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("Silakan login terlebih dahulu.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from("user_integrations").upsert({
        user_id: user.id,
        provider: providerId,
        access_token: apiKeyInput.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id, provider" });

      if (error) {
        showToast("Gagal menyimpan API Key!");
      } else {
        showToast("API Key berhasil disimpan!");
        setApiKeyInput("");
        setActiveModalProvider(null);
        fetchStatusIntegrasi();
      }
    } catch (e: any) {
      showToast("Terjadi kesalahan: " + (e.message || "Gagal"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Putus Koneksi
  async function handleDisconnect(providerId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (confirm(`Apakah Anda yakin ingin memutus koneksi dengan provider ini?`)) {
      await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", providerId);

      setActiveModalProvider(null);
      setConfirmDisconnect(null);
      fetchStatusIntegrasi();
    }
  }

  // Filtered providers
  const filteredIntegrations = integrations.filter((item) => {
    const matchQuery = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fullDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchQuery) return false;

    if (filterType === "oauth") return item.type === "oauth";
    if (filterType === "apikey") return item.type === "apikey";
    if (filterType === "connected") return item.connected;
    return true;
  });

  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div className={cn(
      "w-full min-h-screen bg-slate-50 app-clean-grid text-slate-900 flex flex-col font-sans select-none",
      !isStandalone && "min-h-0 bg-transparent"
    )}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl backdrop-blur-xl flex items-center gap-3 text-sm font-semibold border border-slate-800"
          >
            <Sparkles size={16} className="text-blue-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Integrasi Provider MCP
              </h1>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                COMING SOON
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block mt-0.5">
              Hubungkan akun & API Key untuk memberikan kemampuan otomatisasi penuh kepada AI Bluefox (Fitur Segera Hadir).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatusIntegrasi}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
            title="Muat Ulang Status"
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin text-blue-600")} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{connectedCount} / {PROVIDERS_CONFIG.length} Terhubung</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        
        {/* Banner / Header Description */}
        <div className="mb-2">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-slate-900">Integrasi Provider MCP</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            Klik pada provider untuk melihat deskripsi lengkap dan menghubungkan layanan Anda dengan AI Bluefox.
          </p>
        </div>

        {/* Filter Pills & Search Box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200 shadow-xs overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer",
                filterType === "all" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Semua ({integrations.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("oauth")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer",
                filterType === "oauth" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              OAuth ({integrations.filter(i => i.type === "oauth").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("apikey")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer",
                filterType === "apikey" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              API Key ({integrations.filter(i => i.type === "apikey").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("connected")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
                filterType === "connected" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Terhubung ({connectedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari provider MCP..."
              className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-xs transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Grid Provider */}
        {loading ? (
          <div className="text-center py-20 space-y-3">
            <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-500">Memuat integrasi provider MCP...</div>
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="text-center py-20 px-4 border border-dashed border-slate-300 rounded-3xl bg-white space-y-3">
            <h3 className="text-base font-bold text-slate-800">Tidak ada provider yang cocok</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Coba gunakan kata kunci pencarian lain atau ubah filter tipe integrasi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveModalProvider(item);
                  setApiKeyInput("");
                }}
                className={cn(
                  "bg-white border rounded-2xl p-5 cursor-pointer transition duration-200 hover:bg-slate-50 flex flex-col justify-between group relative overflow-hidden shadow-xs hover:shadow-md",
                  item.connected 
                    ? "border-emerald-400 ring-1 ring-emerald-400/30" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    {/* Logo Provider */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center p-2.5 group-hover:scale-105 transition-transform shadow-xs">
                      <img 
                        src={item.logo} 
                        alt={item.name} 
                        className="w-full h-full object-contain" 
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Status Badge */}
                    {item.connected ? (
                      <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Connected
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-semibold border border-slate-200">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition">
                      {item.name}
                    </h3>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-semibold">
                      {item.type}
                    </span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                      Coming Soon
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {item.shortDesc}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-500 group-hover:text-blue-600">
                  <span>Lihat Detail & Konfigurasi</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL / HALAMAN DETAIL PROVIDER */}
      <AnimatePresence>
        {activeModalProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModalProvider(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-7 relative shadow-2xl z-10 overflow-hidden text-slate-900"
            >
              {/* Tombol Close Modal */}
              <button
                type="button"
                onClick={() => setActiveModalProvider(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>

              {/* Header Modal */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center p-3 shadow-xs">
                  <img src={activeModalProvider.logo} alt={activeModalProvider.name} className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{activeModalProvider.name}</h2>
                    {activeModalProvider.connected ? (
                      <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                        <Check size={12} />
                        Connected
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full border border-slate-200 font-semibold">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Metode Integrasi: <span className="font-bold text-slate-700 uppercase font-mono">{activeModalProvider.type}</span></p>
                </div>
              </div>

              {/* Deskripsi Lengkap */}
              <div className="mb-5">
                <h4 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-600" />
                  Tentang Integrasi
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {activeModalProvider.fullDesc}
                </p>
              </div>

              {/* Fitur Kemampuan MCP */}
              <div className="mb-6">
                <h4 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Kemampuan AI Bluefox
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  {activeModalProvider.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-blue-600 font-bold">✓</span> {feat}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AREA AKSI / TOMBOL CONNECT */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                {activeModalProvider.connected ? (
                  <div className="w-full flex items-center justify-between gap-3">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      Akun terhubung dan siap digunakan AI Bluefox.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(activeModalProvider.id)}
                      className="px-4 py-2 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition font-semibold cursor-pointer shrink-0"
                    >
                      Putuskan Koneksi
                    </button>
                  </div>
                ) : activeModalProvider.type === "oauth" ? (
                  <div className="w-full flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Akan membuka halaman otorisasi resmi {activeModalProvider.name}.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOAuthConnect(activeModalProvider.id)}
                      className="px-5 py-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <ExternalLink size={14} />
                      Connect {activeModalProvider.name}
                    </button>
                  </div>
                ) : (
                  /* Form Input API Key */
                  <div className="w-full">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Masukkan API Key {activeModalProvider.name}:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Paste API Key di sini..."
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={isSubmitting || !apiKeyInput.trim()}
                        onClick={() => handleSaveApiKey(activeModalProvider.id)}
                        className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          "Simpan Key"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default IntegrationsPage;
