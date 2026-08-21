import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, Search, CheckCircle2, Shield, RefreshCw, Key, 
  ExternalLink, Trash2, AlertTriangle, X, Lock, Check, Sparkles,
  Layers, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export interface Integration {
  id: string;
  name: string;
  type: "oauth" | "apikey";
  icon: string;
  description: string;
  connected: boolean;
  category?: "database" | "workspace" | "developer" | "design" | "ai" | "automation";
}

export const PROVIDERS_CONFIG: Omit<Integration, "connected">[] = [
  { id: "user_supabase", name: "Supabase User", type: "oauth", icon: "⚡", description: "Akses Management API & Database pengguna", category: "database" },
  { id: "google", name: "Google Workspace", type: "oauth", icon: "🌐", description: "Gmail, Drive, Sheets, Docs, Calendar, Slides", category: "workspace" },
  { id: "github", name: "GitHub", type: "oauth", icon: "🐙", description: "Kelola Repositori, Issue, dan Commit", category: "developer" },
  { id: "vercel", name: "Vercel", type: "oauth", icon: "▲", description: "Pantau Deployment dan Serverless Logs", category: "developer" },
  { id: "netlify", name: "Netlify", type: "oauth", icon: "💎", description: "Kelola Situs dan Forms Submissions", category: "developer" },
  { id: "figma", name: "Figma", type: "oauth", icon: "🎨", description: "Baca file desain dan komponen Figma", category: "design" },
  { id: "airtable", name: "Airtable", type: "oauth", icon: "📊", description: "Akses Basis Data Relasional Airtable", category: "database" },
  { id: "canva", name: "Canva", type: "oauth", icon: "✨", description: "Akses Aset dan Desain Canva", category: "design" },
  { id: "make", name: "Make (Integromat)", type: "apikey", icon: "🧩", description: "Trigger otomatisasi skenario Make", category: "automation" },
  { id: "huggingface", name: "Hugging Face", type: "apikey", icon: "🤗", description: "Model AI kustom & Dataset", category: "ai" },
  { id: "resend", name: "Resend", type: "apikey", icon: "✉️", description: "Kirim email transactional via AI", category: "workspace" },
];

interface IntegrationsPageProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export function IntegrationsPage({ onBack, isStandalone = true }: IntegrationsPageProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApiKeyProvider, setSelectedApiKeyProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "oauth" | "apikey" | "connected">("all");
  
  // Custom dialogs & toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Base URL Supabase TMPA untuk Edge Function Callbacks
  const SUPABASE_PROJECT_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://jjlanjshpyklqayjzxyy.supabase.co';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    fetchStatusIntegrasi();
  }, []);

  // 1. Ambil status integrasi pengguna dari tabel 'user_integrations'
  async function fetchStatusIntegrasi() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Fallback jika belum login: tampilkan default list
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
        .select("provider")
        .eq("user_id", user.id);

      if (error) {
        console.warn("Tabel user_integrations mungkin belum dibuat atau ada kendala koneksi:", error.message);
      }

      const connectedProviders = new Set(userIntegrations?.map((item) => item.provider) || []);

      const updatedList = PROVIDERS_CONFIG.map((p) => ({
        ...p,
        connected: connectedProviders.has(p.id),
      }));

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

  // 2. Memicu OAuth Redirect berdasarkan Provider
  async function handleOAuthConnect(providerId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Silakan login terlebih dahulu untuk menghubungkan integrasi.");
      return;
    }

    const redirectUri = encodeURIComponent(`${SUPABASE_PROJECT_URL}/functions/v1/${providerId === 'user_supabase' ? 'supabase' : providerId}-callback`);
    const state = user.id;

    let oauthUrl = "";

    const env = (import.meta as any).env || {};

    switch (providerId) {
      case "user_supabase": {
        const supabaseClientId = env.VITE_SUPABASE_CLIENT_ID || "supabase-client";
        oauthUrl = `https://api.supabase.com/v1/oauth/authorize?client_id=${supabaseClientId}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;
        break;
      }
      case "google": {
        const googleClientId = env.VITE_GOOGLE_CLIENT_ID || "google-client";
        const googleScopes = encodeURIComponent("https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents");
        oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${googleScopes}&state=${state}&access_type=offline&prompt=consent`;
        break;
      }
      case "github": {
        const githubClientId = env.VITE_GITHUB_CLIENT_ID || "github-client";
        oauthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=repo%20read:user&state=${state}`;
        break;
      }
      case "vercel": {
        const vercelClientId = env.VITE_VERCEL_CLIENT_ID || "vercel-client";
        oauthUrl = `https://vercel.com/oauth/authorize?client_id=${vercelClientId}&redirect_uri=${redirectUri}&state=${state}`;
        break;
      }
      case "netlify": {
        const netlifyClientId = env.VITE_NETLIFY_CLIENT_ID || "netlify-client";
        oauthUrl = `https://app.netlify.com/authorize?client_id=${netlifyClientId}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;
        break;
      }
      case "figma": {
        const figmaClientId = env.VITE_FIGMA_CLIENT_ID || "figma-client";
        oauthUrl = `https://www.figma.com/oauth?client_id=${figmaClientId}&redirect_uri=${redirectUri}&scope=files:read&state=${state}&response_type=code`;
        break;
      }
      case "airtable": {
        const airtableClientId = env.VITE_AIRTABLE_CLIENT_ID || "airtable-client";
        oauthUrl = `https://airtable.com/oauth2/v1/authorize?client_id=${airtableClientId}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=data.records:read%20data.records:write`;
        break;
      }
      case "canva": {
        const canvaClientId = env.VITE_CANVA_CLIENT_ID || "canva-client";
        oauthUrl = `https://www.canva.com/api/oauth/authorize?response_type=code&client_id=${canvaClientId}&redirect_uri=${redirectUri}&state=${state}`;
        break;
      }
    }

    if (oauthUrl) {
      showToast(`Mengarahkan ke halaman otorisasi ${providerId.toUpperCase()}...`);
      setTimeout(() => {
        window.location.href = oauthUrl;
      }, 500);
    }
  }

  // 3. Menyimpan API Key Manual (Make, HuggingFace, Resend)
  async function handleSaveApiKey() {
    if (!apiKeyInput.trim() || !selectedApiKeyProvider) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("Silakan login terlebih dahulu!");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from("user_integrations").upsert({
        user_id: user.id,
        provider: selectedApiKeyProvider,
        access_token: apiKeyInput.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id, provider" });

      if (error) {
        console.error("Upsert API Key error:", error);
        showToast(`Gagal menyimpan API Key: ${error.message}`);
      } else {
        showToast(`API Key untuk ${selectedApiKeyProvider.toUpperCase()} berhasil disimpan!`);
        setSelectedApiKeyProvider(null);
        setApiKeyInput("");
        fetchStatusIntegrasi();
      }
    } catch (err: any) {
      showToast(`Terjadi kesalahan: ${err.message || 'Gagal menyimpan'}`);
    } finally {
      setIsSaving(false);
    }
  }

  // 4. Memutus Koneksi Integrasi
  async function executeDisconnect(providerId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", providerId);

      if (error) {
        showToast(`Gagal memutus koneksi: ${error.message}`);
      } else {
        showToast(`Koneksi dengan ${providerId} berhasil diputus.`);
        fetchStatusIntegrasi();
      }
    } catch (err: any) {
      showToast(`Terjadi kesalahan saat memutus koneksi`);
    } finally {
      setDisconnectConfirm(null);
    }
  }

  // Filtered list
  const filteredIntegrations = integrations.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === "oauth") return item.type === "oauth";
    if (activeTab === "apikey") return item.type === "apikey";
    if (activeTab === "connected") return item.connected;
    return true;
  });

  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div className={cn(
      "w-full min-h-screen bg-black text-white flex flex-col font-sans select-none",
      !isStandalone && "min-h-0"
    )}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-blue-500/40 text-blue-300 px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.3)] backdrop-blur-xl flex items-center gap-3 text-sm font-medium"
          >
            <Sparkles size={16} className="text-blue-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="border-b border-gray-900 bg-gray-950/80 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-900 transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Integrasi Platform MCP TMPA
              </h1>
              <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                MCP ENGINE
              </span>
            </div>
            <p className="text-xs text-gray-400 hidden sm:block mt-0.5">
              Hubungkan akun & API Key Anda untuk memberikan akses otomatis ke layanan pihak ketiga.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatusIntegrasi}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Muat Ulang Status"
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin text-blue-400")} />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900/80 border border-gray-800 text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{connectedCount} Terhubung</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        
        {/* Banner / Overview Card */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-800/80 bg-gradient-to-br from-gray-900/90 via-gray-950 to-black p-6 sm:p-8 shadow-2xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
                <Layers size={14} />
                Model Context Protocol (MCP) Ecosystem
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Konektivitas Cerdas AI ke Semua Layanan Anda
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Platform MCP TMPA memungkinkan model AI berinteraksi secara aman dengan repositori kode, dokumen cloud, spreadsheet, deployment serverless, dan skenario otomatisasi Anda.
              </p>
            </div>

            <div className="flex sm:flex-col gap-3 shrink-0">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/60 border border-gray-800 text-xs">
                <Shield size={16} className="text-emerald-400 shrink-0" />
                <span className="text-gray-300">Enkripsi Tingkat Tinggi</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/60 border border-gray-800 text-xs">
                <Lock size={16} className="text-cyan-400 shrink-0" />
                <span className="text-gray-300">Sesi Terisolasi Per Akun</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-gray-900/80 border border-gray-800 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer",
                activeTab === "all" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              )}
            >
              Semua ({integrations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("oauth")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer",
                activeTab === "oauth" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              )}
            >
              OAuth ({integrations.filter(i => i.type === "oauth").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("apikey")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer",
                activeTab === "apikey" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              )}
            >
              API Key ({integrations.filter(i => i.type === "apikey").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("connected")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
                activeTab === "connected" ? "bg-emerald-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Terhubung ({connectedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari platform..."
              className="w-full bg-gray-900/80 border border-gray-800 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Integration Cards Grid */}
        {loading ? (
          <div className="text-center py-24 space-y-3">
            <RefreshCw size={28} className="animate-spin text-blue-400 mx-auto" />
            <div className="text-sm font-medium text-gray-400">Memuat status integrasi platform MCP...</div>
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="text-center py-20 px-4 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 mx-auto">
              <Filter size={20} />
            </div>
            <h3 className="text-base font-semibold text-gray-300">Tidak ada integrasi yang cocok</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Tidak ditemukan platform yang sesuai dengan filter atau kata kunci pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIntegrations.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "relative border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group backdrop-blur-sm",
                  item.connected
                    ? "bg-gray-900/60 border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                    : "bg-gray-900/30 border-gray-800 hover:border-gray-700 hover:bg-gray-900/50"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base text-white truncate">
                          {item.name}
                        </h3>
                        {item.connected ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Check size={10} strokeWidth={3} />
                            Connected
                          </span>
                        ) : (
                          <span className="bg-gray-800/80 text-gray-400 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-700/50">
                            Not Connected
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-950 border border-gray-800 text-gray-400">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-gray-800/60 flex items-center justify-between">
                  <div className="text-[11px] text-gray-500 font-mono">
                    ID: {item.id}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.connected ? (
                      <button
                        type="button"
                        onClick={() => setDisconnectConfirm({ id: item.id, name: item.name })}
                        className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Trash2 size={13} />
                        Disconnect
                      </button>
                    ) : item.type === "oauth" ? (
                      <button
                        type="button"
                        onClick={() => handleOAuthConnect(item.id)}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-blue-900/30 cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <ExternalLink size={13} />
                        Connect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApiKeyProvider(item.id);
                          setApiKeyInput("");
                        }}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-white font-medium px-3.5 py-1.5 rounded-xl border border-gray-700 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Key size={13} />
                        Set Key
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Input API Key */}
      <AnimatePresence>
        {selectedApiKeyProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApiKeyProvider(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-gray-950 border border-gray-800 p-6 rounded-3xl max-w-md w-full shadow-2xl z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      API Key {selectedApiKeyProvider.toUpperCase()}
                    </h3>
                    <p className="text-xs text-gray-400">Konfigurasi token otentikasi</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApiKeyProvider(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-gray-300 mb-4 leading-relaxed bg-gray-900/60 p-3 rounded-2xl border border-gray-800/80">
                🔒 Kunci rahasia ini disimpan aman dalam tabel <code className="text-blue-400 font-mono">user_integrations</code> dan hanya digunakan untuk akun Anda saat AI memproses tugas MCP.
              </p>

              <div className="space-y-1.5 mb-5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                  API Key / Secret Token
                </label>
                <input
                  type="password"
                  placeholder={`Paste API Key ${selectedApiKeyProvider} di sini...`}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono transition-all"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedApiKeyProvider(null)}
                  className="px-4 py-2 text-xs font-medium bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!apiKeyInput.trim() || isSaving}
                  onClick={handleSaveApiKey}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition shadow-lg shadow-blue-900/40 cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving && <RefreshCw size={13} className="animate-spin" />}
                  Simpan Kunci
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Disconnect */}
      <AnimatePresence>
        {disconnectConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDisconnectConfirm(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-gray-950 border border-red-500/30 p-6 rounded-3xl max-w-md w-full shadow-2xl z-10 overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Putus Koneksi {disconnectConfirm.name}?
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
                    AI TMPA tidak akan lagi memiliki akses ke layanan ini hingga Anda menghubungkannya kembali.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDisconnectConfirm(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-medium bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => executeDisconnect(disconnectConfirm.id)}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl transition shadow-lg shadow-red-950/50 cursor-pointer"
                >
                  Ya, Putuskan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
