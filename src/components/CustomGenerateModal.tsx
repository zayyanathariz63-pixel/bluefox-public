import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Loader2, 
  Play, 
  Download, 
  Send, 
  Settings, 
  Plus, 
  Key, 
  Clock, 
  ExternalLink,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { BluefoxCustomApi } from '../types';
import { 
  getUserCustomApis, 
  saveUserCustomApi, 
  deleteUserCustomApi, 
  getUserCustomApiDailyUsage, 
  handleGenerateContent 
} from '../lib/bluefoxCustomApi';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

interface CustomGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat?: (media: { type: 'image' | 'video'; url: string; prompt: string }) => void;
  onOpenMediaScreen?: (media: { type: 'image' | 'video'; url: string; name: string }) => void;
  initialPrompt?: string;
  initialApiType?: 'image' | 'video';
}

export function CustomGenerateModal({
  isOpen,
  onClose,
  onInsertToChat,
  onOpenMediaScreen,
  initialPrompt = '',
  initialApiType
}: CustomGenerateModalProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  // Tabs: 'generate' | 'manage'
  const [activeTab, setActiveTab] = useState<'generate' | 'manage'>('generate');

  // Custom APIs from Supabase
  const [apis, setApis] = useState<BluefoxCustomApi[]>([]);
  const [isLoadingApis, setIsLoadingApis] = useState(false);
  const [dailyUsage, setDailyUsage] = useState({ usedToday: 0, dailyLimit: 100 });

  // Generation State
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [generatedResult, setGeneratedResult] = useState<{ type: 'image' | 'video'; url: string; prompt: string } | null>(null);

  // Form State for Adding Custom API
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [formName, setFormName] = useState('');
  const [formApiType, setFormApiType] = useState<'image' | 'video'>(initialApiType || 'image');
  const [formEndpointUrl, setFormEndpointUrl] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formApiKey, setFormApiKey] = useState('');

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadApisAndUsage = async () => {
    setIsLoadingApis(true);
    try {
      const [fetchedApis, usage] = await Promise.all([
        getUserCustomApis(),
        getUserCustomApiDailyUsage()
      ]);
      setApis(fetchedApis);
      setDailyUsage(usage);

      if (fetchedApis.length > 0 && !selectedApiId) {
        if (initialApiType) {
          const matchType = fetchedApis.find(a => a.api_type === initialApiType);
          setSelectedApiId(matchType ? matchType.id : fetchedApis[0].id);
        } else {
          setSelectedApiId(fetchedApis[0].id);
        }
      }
    } finally {
      setIsLoadingApis(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadApisAndUsage();
      if (initialPrompt) {
        setPrompt(initialPrompt);
      }
      if (initialApiType) {
        setFormApiType(initialApiType);
      }
    } else {
      setGeneratedResult(null);
      setIsGenerating(false);
    }
  }, [isOpen, initialPrompt, initialApiType]);

  const selectedApi = apis.find(a => a.id === selectedApiId);

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEndpointUrl.trim() || !formModelId.trim() || !formApiKey.trim()) {
      alert(isId ? 'Semua kolom formulir wajib diisi.' : 'All form fields are required.');
      return;
    }

    setIsSavingApi(true);
    try {
      const res = await saveUserCustomApi({
        name: formName.trim(),
        apiType: formApiType,
        endpointUrl: formEndpointUrl.trim(),
        modelId: formModelId.trim(),
        apiKey: formApiKey.trim()
      });

      if (res.success && res.data) {
        showToast(isId ? 'Custom API berhasil disimpan ke database!' : 'Custom API saved successfully!');
        setFormName('');
        setFormEndpointUrl('');
        setFormModelId('');
        setFormApiKey('');
        setIsAddFormOpen(false);
        await loadApisAndUsage();
        setSelectedApiId(res.data.id);
        setActiveTab('generate');
      }
    } finally {
      setIsSavingApi(false);
    }
  };

  const handleDeleteApi = async (id: string, name: string) => {
    if (!confirm(isId ? `Apakah Anda yakin ingin menghapus "${name}"?` : `Are you sure you want to delete "${name}"?`)) {
      return;
    }

    const ok = await deleteUserCustomApi(id);
    if (ok) {
      showToast(isId ? 'API berhasil dihapus.' : 'API deleted successfully.');
      const updated = apis.filter(a => a.id !== id);
      setApis(updated);
      if (selectedApiId === id) {
        setSelectedApiId(updated.length > 0 ? updated[0].id : '');
      }
    }
  };

  const handleGenerate = async () => {
    if (!selectedApiId) {
      alert(isId ? 'Pilih salah satu Custom API terlebih dahulu.' : 'Please select a Custom API first.');
      return;
    }

    if (!prompt.trim()) {
      alert(isId ? 'Masukkan prompt deskripsi gambar/video yang ingin digenerasikan.' : 'Please enter a prompt description.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage(isId ? 'Mengirim prompt ke Edge Function...' : 'Sending prompt to Edge Function...');
    setGeneratedResult(null);

    try {
      const result = await handleGenerateContent(prompt.trim(), selectedApiId, {
        setLoadingState: (loading, msg) => {
          setIsGenerating(loading);
          if (msg) setStatusMessage(msg);
        },
        displayGeneratedImage: (imgUrl) => {
          setGeneratedResult({
            type: 'image',
            url: imgUrl,
            prompt: prompt.trim()
          });
        },
        displayGeneratedVideo: (vidUrl) => {
          setGeneratedResult({
            type: 'video',
            url: vidUrl,
            prompt: prompt.trim()
          });
        },
        onError: (errMsg) => {
          setStatusMessage(errMsg);
        }
      });

      if (result && result.url) {
        setGeneratedResult({
          type: result.type,
          url: result.url,
          prompt: prompt.trim()
        });
        showToast(isId ? 'Generasi konten berhasil selesai!' : 'Generation completed successfully!');
        // Refresh usage meter
        const usage = await getUserCustomApiDailyUsage();
        setDailyUsage(usage);
      }
    } catch (err: any) {
      console.error("Generate error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToChat = () => {
    if (generatedResult && onInsertToChat) {
      onInsertToChat(generatedResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 320 }}
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl z-10 text-slate-900 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {isId ? 'Studio Custom API' : 'Custom API Studio'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold uppercase tracking-wider font-mono">
                  Gambar & Video
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isId ? 'Generasi media server kustom via Supabase Edge Function' : 'Custom server generation via Supabase Edge Function'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Quota Bar */}
        <div className="px-5 sm:px-6 pt-3 pb-2 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('generate')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'generate'
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sparkles size={14} />
              <span>{isId ? 'Generasi Media' : 'Generate'}</span>
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'manage'
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Settings size={14} />
              <span>{isId ? 'Konfigurasi API' : 'Manage APIs'} ({apis.length})</span>
            </button>
          </div>

          {/* Quota Counter (100 req/day) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 font-medium">
              {isId ? 'Batas Harian:' : 'Daily Limit:'}
            </span>
            <span className={cn(
              "font-mono font-bold px-1.5 py-0.5 rounded-md text-[11px]",
              dailyUsage.usedToday >= 100 
                ? "bg-rose-100 text-rose-700 font-extrabold" 
                : "bg-blue-50 text-blue-700"
            )}>
              {dailyUsage.usedToday} / {dailyUsage.dailyLimit} Req
            </span>
          </div>
        </div>

        {/* Toast Alert */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium"
            >
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: GENERATE CONTENT */}
          {activeTab === 'generate' && (
            <div className="space-y-4">
              {apis.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
                    <Key size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {isId ? 'Belum Ada Konfigurasi Custom API' : 'No Custom API Configured'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {isId 
                        ? 'Simpan kredensial server gambar (SDXL, ComfyUI) atau video (Runway, Kling) Anda ke tabel bluefox_custom_api terlebih dahulu.' 
                        : 'Configure your image or video generation API endpoint credentials first.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('manage');
                      setIsAddFormOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition cursor-pointer shadow-sm shadow-blue-600/20"
                  >
                    <Plus size={15} />
                    <span>{isId ? 'Tambah Custom API Baru' : 'Add Custom API'}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Selector Custom API */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      {isId ? 'Pilih Endpoint & Model API' : 'Select Custom API'} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedApiId}
                      onChange={(e) => setSelectedApiId(e.target.value)}
                      disabled={isGenerating}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 text-sm font-medium cursor-pointer"
                    >
                      {apis.map((api) => (
                        <option key={api.id} value={api.id}>
                          {api.api_type === 'video' ? '🎬 [VIDEO]' : '🖼️ [IMAGE]'} {api.name} ({api.model_id})
                        </option>
                      ))}
                    </select>

                    {selectedApi && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between text-slate-600">
                        <div className="flex items-center gap-2 truncate">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md font-bold uppercase text-[10px]",
                            selectedApi.api_type === 'video' ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {selectedApi.api_type}
                          </span>
                          <span className="font-mono text-slate-500 truncate" title={selectedApi.endpoint_url}>
                            {selectedApi.endpoint_url}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-slate-700 shrink-0">
                          {selectedApi.model_id}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prompt Textarea */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Prompt Deskripsi <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      rows={3}
                      placeholder={selectedApi?.api_type === 'video' 
                        ? (isId ? "Contoh: Drone cinematic shot of neon cyberpunk city at night, rain reflections, 4k ultra-realistic" : "e.g. Cinematic drone flying over foggy mountains at sunrise, 4k")
                        : (isId ? "Contoh: Potret rubah biru bercahaya dengan aksen cybernetic di hutan malam, detail tinggi, 8k" : "e.g. A glowing blue fox in an enchanted neon forest, 8k octane render")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 text-sm leading-relaxed"
                    />

                    {/* Quick Prompt Ideas */}
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                        Saran:
                      </span>
                      {(selectedApi?.api_type === 'video' ? [
                        "Cinematic drone over ocean waves, golden hour",
                        "Futuristic train speeding through neon cyberpunk tunnel",
                        "Time-lapse of blooming lotus flower in crystal water"
                      ] : [
                        "Futuristic cybernetic blue fox in neon rain, 8k",
                        "Photorealistic macro shot of emerald butterfly on glowing leaf",
                        "Isometric 3D low-poly miniature cyberpunk cafe, cozy lighting"
                      ]).map((hint, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPrompt(hint)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition cursor-pointer shrink-0 truncate max-w-[200px]"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button & Progress State */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt.trim() || !selectedApiId || dailyUsage.usedToday >= 100}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md",
                        isGenerating || !prompt.trim() || !selectedApiId || dailyUsage.usedToday >= 100
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/25 active:scale-98"
                      )}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={18} className="animate-spin text-white" />
                          <span>{statusMessage || (isId ? 'Sedang Memproses...' : 'Processing...')}</span>
                        </>
                      ) : (
                        <>
                          {selectedApi?.api_type === 'video' ? <Video size={18} /> : <ImageIcon size={18} />}
                          <span>
                            {isId 
                              ? `Generate ${selectedApi?.api_type === 'video' ? 'Video' : 'Gambar'}` 
                              : `Generate ${selectedApi?.api_type === 'video' ? 'Video' : 'Image'}`}
                          </span>
                        </>
                      )}
                    </button>

                    {dailyUsage.usedToday >= 100 && (
                      <p className="text-center text-xs text-rose-600 font-semibold mt-2 flex items-center justify-center gap-1">
                        <AlertCircle size={13} />
                        {isId 
                          ? 'Batas kuota 100 request/hari telah tercapai untuk Custom API.' 
                          : 'Daily 100 requests limit reached for Custom API.'}
                      </p>
                    )}
                  </div>

                  {/* Polling / Generating Live Progress Card */}
                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                        <span className="flex items-center gap-2">
                          <Loader2 size={15} className="animate-spin text-blue-600" />
                          <span>Status Pengecekan Edge Function</span>
                        </span>
                        <span className="font-mono text-blue-600">
                          {selectedApi?.api_type === 'video' ? 'Polling tiap 5 dtk' : 'Memproses'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono bg-white/80 p-2.5 rounded-xl border border-blue-100">
                        {statusMessage || 'Sedang menunggu respons generator...'}
                      </p>
                    </motion.div>
                  )}

                  {/* Hasil Generasi Preview */}
                  {generatedResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          {isId ? 'Konten Berhasil Digenerasi' : 'Content Successfully Generated'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">
                          {generatedResult.type}
                        </span>
                      </div>

                      {/* Display Result (Image or Video) */}
                      <div className="relative rounded-2xl overflow-hidden bg-black max-h-[340px] flex items-center justify-center">
                        {generatedResult.type === 'video' ? (
                          <video
                            src={generatedResult.url}
                            controls
                            autoPlay
                            loop
                            className="max-h-[320px] w-full object-contain"
                          />
                        ) : (
                          <img
                            src={generatedResult.url}
                            alt={generatedResult.prompt}
                            className="max-h-[320px] w-full object-contain cursor-pointer"
                            onClick={() => onOpenMediaScreen && onOpenMediaScreen({
                              type: 'image',
                              url: generatedResult.url,
                              name: 'Generated-Image.png'
                            })}
                          />
                        )}
                      </div>

                      <p className="text-xs text-slate-500 italic truncate" title={generatedResult.prompt}>
                        "{generatedResult.prompt}"
                      </p>

                      {/* Action Buttons for Result */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
                        <a
                          href={generatedResult.url}
                          download={`bluefox-${generatedResult.type}-${Date.now()}.${generatedResult.type === 'video' ? 'mp4' : 'png'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download size={13} />
                          <span>Unduh</span>
                        </a>

                        {onOpenMediaScreen && (
                          <button
                            type="button"
                            onClick={() => onOpenMediaScreen({
                              type: generatedResult.type,
                              url: generatedResult.url,
                              name: `Generated-${generatedResult.type}`
                            })}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Maximize2 size={13} />
                            <span>Layar Penuh</span>
                          </button>
                        )}

                        {onInsertToChat && (
                          <button
                            type="button"
                            onClick={handleSendToChat}
                            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                          >
                            <Send size={13} />
                            <span>Kirim ke Chat</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: MANAGE APIS (bluefox_custom_api TABLE) */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isId ? 'Daftar Custom API Tersimpan' : 'Configured Custom APIs'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isId ? 'Tersimpan aman di tabel bluefox_custom_api Supabase' : 'Persisted in bluefox_custom_api table'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  <span>{isAddFormOpen ? 'Tutup Form' : 'Tambah API'}</span>
                </button>
              </div>

              {/* Form Tambah Custom API */}
              <AnimatePresence>
                {isAddFormOpen && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSaveApi}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-blue-200 space-y-3.5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key size={14} className="text-blue-600" />
                        Form Konfigurasi Custom API
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">bluefox_custom_api</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Nama Server / Label <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Contoh: My SDXL Server, Runway Gen2"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Tipe API (api_type) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formApiType}
                          onChange={(e) => setFormApiType(e.target.value as 'image' | 'video')}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                          <option value="image">🖼️ image (Generasi Gambar)</option>
                          <option value="video">🎬 video (Generasi Video)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Endpoint URL <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={formEndpointUrl}
                          onChange={(e) => setFormEndpointUrl(e.target.value)}
                          placeholder="https://api.domainuser.com/v1/generate"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Model ID <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formModelId}
                          onChange={(e) => setFormModelId(e.target.value)}
                          placeholder="Contoh: sdxl-v1-0, runway-gen2, flux-1"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        API Key (api_key_encrypted) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder="sk-... / Secret Token"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsAddFormOpen(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingApi}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isSavingApi && <Loader2 size={13} className="animate-spin" />}
                        <span>Simpan ke Database</span>
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* List of APIs */}
              {isLoadingApis ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  <span>Memuat data dari Supabase...</span>
                </div>
              ) : apis.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-slate-200 rounded-2xl bg-slate-50">
                  Belum ada Custom API tersimpan di akun Anda.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {apis.map((api) => (
                    <div
                      key={api.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white",
                          api.api_type === 'video' ? "bg-purple-600" : "bg-emerald-600"
                        )}>
                          {api.api_type === 'video' ? <Video size={17} /> : <ImageIcon size={17} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{api.name}</span>
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded font-mono",
                              api.api_type === 'video' ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {api.api_type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                            {api.model_id} • {api.endpoint_url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApiId(api.id);
                            setActiveTab('generate');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition cursor-pointer"
                        >
                          Pilih & Tes
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteApi(api.id, api.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus API"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
