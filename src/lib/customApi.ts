export interface CustomApiKey {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey: string;
  model: string;
  isActive: boolean;
  createdAt: number;
}

export interface ProviderPreset {
  id: string;
  name: string;
  defaultBaseUrl: string;
  isSelfHosted: boolean;
  sampleModels: string[];
  placeholderModel: string;
  description: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'OpenAI',
    name: 'OpenAI (Official)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    isSelfHosted: false,
    sampleModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini', 'gpt-4-turbo'],
    placeholderModel: 'Contoh: gpt-4o, gpt-4o-mini, o3-mini',
    description: 'Endpoint resmi OpenAI'
  },
  {
    id: 'Groq',
    name: 'Groq (Ultra-Fast LPU)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    isSelfHosted: false,
    sampleModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'deepseek-r1-distill-llama-70b'],
    placeholderModel: 'Contoh: llama-3.3-70b-versatile, deepseek-r1-distill-llama-70b',
    description: 'Inferensi LPU super cepat'
  },
  {
    id: 'OpenRouter',
    name: 'OpenRouter (All-in-One)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    isSelfHosted: false,
    sampleModels: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b-instruct'],
    placeholderModel: 'Contoh: anthropic/claude-3.5-sonnet, openai/gpt-4o',
    description: 'Ratusan model AI dalam 1 endpoint'
  },
  {
    id: 'DeepSeek',
    name: 'DeepSeek AI',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    isSelfHosted: false,
    sampleModels: ['deepseek-chat', 'deepseek-reasoner'],
    placeholderModel: 'Contoh: deepseek-chat, deepseek-reasoner',
    description: 'DeepSeek V3 dan R1 Reasoning'
  },
  {
    id: 'Gemini',
    name: 'Google Gemini (OpenAI Compat)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    isSelfHosted: false,
    sampleModels: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholderModel: 'Contoh: gemini-2.0-flash, gemini-1.5-pro',
    description: 'Google Gemini via OpenAI compatible API'
  },
  {
    id: 'Anthropic',
    name: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    isSelfHosted: false,
    sampleModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholderModel: 'Contoh: claude-3-5-sonnet-20241022',
    description: 'Model Claude 3.5 Sonnet / Haiku'
  },
  {
    id: 'Mistral',
    name: 'Mistral AI',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    isSelfHosted: false,
    sampleModels: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-large-latest'],
    placeholderModel: 'Contoh: mistral-large-latest, codestral-latest',
    description: 'Model frontier Mistral & Codestral'
  },
  {
    id: 'Together',
    name: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    isSelfHosted: false,
    sampleModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-Coder-32B-Instruct'],
    placeholderModel: 'Contoh: meta-llama/Llama-3.3-70B-Instruct-Turbo',
    description: 'Platform open source cloud AI'
  },
  {
    id: 'Perplexity',
    name: 'Perplexity AI',
    defaultBaseUrl: 'https://api.perplexity.ai',
    isSelfHosted: false,
    sampleModels: ['sonar-pro', 'sonar', 'sonar-reasoning'],
    placeholderModel: 'Contoh: sonar-pro, sonar',
    description: 'Pencarian web real-time'
  },
  {
    id: 'Fireworks',
    name: 'Fireworks AI',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    isSelfHosted: false,
    sampleModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/deepseek-r1'],
    placeholderModel: 'Contoh: accounts/fireworks/models/llama-v3p3-70b-instruct',
    description: 'Fast inference platform'
  },
  {
    id: 'xAI',
    name: 'xAI (Grok)',
    defaultBaseUrl: 'https://api.x.ai/v1',
    isSelfHosted: false,
    sampleModels: ['grok-2-latest', 'grok-2-vision-latest', 'grok-beta'],
    placeholderModel: 'Contoh: grok-2-latest',
    description: 'Model Grok dari xAI'
  },
  {
    id: 'Cohere',
    name: 'Cohere',
    defaultBaseUrl: 'https://api.cohere.com/v2',
    isSelfHosted: false,
    sampleModels: ['command-r-plus-08-2024', 'command-r-08-2024', 'command-light'],
    placeholderModel: 'Contoh: command-r-plus-08-2024',
    description: 'Enterprise NLP & Command models'
  },
  {
    id: 'HuggingFace',
    name: 'Hugging Face Inference',
    defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
    isSelfHosted: false,
    sampleModels: ['meta-llama/Llama-3.3-70B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
    placeholderModel: 'Contoh: meta-llama/Llama-3.3-70B-Instruct',
    description: 'Hugging Face Serverless Inference'
  },
  {
    id: 'Ollama',
    name: 'Ollama (Self-Hosted)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    isSelfHosted: true,
    sampleModels: ['llama3.3', 'deepseek-r1:8b', 'qwen2.5-coder:7b', 'mistral', 'phi3'],
    placeholderModel: 'Contoh: llama3.3, deepseek-r1:8b, qwen2.5-coder:7b',
    description: 'Server Ollama lokal / VPS (Wajib URL Base)'
  },
  {
    id: 'vLLM',
    name: 'vLLM (Self-Hosted)',
    defaultBaseUrl: 'http://localhost:8000/v1',
    isSelfHosted: true,
    sampleModels: ['meta-llama/Llama-3-8B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
    placeholderModel: 'Contoh: Nama model yang di-serve di vLLM',
    description: 'vLLM high-throughput engine (Wajib URL Base)'
  },
  {
    id: 'LocalAI',
    name: 'LocalAI (Self-Hosted)',
    defaultBaseUrl: 'http://localhost:8080/v1',
    isSelfHosted: true,
    sampleModels: ['gpt-4', 'hermes-2-pro', 'llama-3'],
    placeholderModel: 'Contoh: Model ID di server LocalAI',
    description: 'LocalAI self-hosted API (Wajib URL Base)'
  },
  {
    id: 'SelfHosted',
    name: 'Custom / Self-Hosted Endpoint',
    defaultBaseUrl: '',
    isSelfHosted: true,
    sampleModels: [],
    placeholderModel: 'Contoh: my-custom-model-v1',
    description: 'Server OpenAI-compatible kustom / VPS (Wajib URL Base)'
  }
];

export function isSelfHostedProvider(providerIdOrName: string): boolean {
  const preset = PROVIDER_PRESETS.find(p => p.id === providerIdOrName || p.name === providerIdOrName);
  if (preset) return preset.isSelfHosted;
  const lower = providerIdOrName.toLowerCase();
  return lower.includes('self-hosted') || lower.includes('selfhost') || lower.includes('custom') || lower.includes('ollama') || lower.includes('vllm') || lower.includes('localai');
}

export function getProviderPreset(providerIdOrName: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.id === providerIdOrName || p.name === providerIdOrName);
}

export interface CustomApiUsageStats {
  minuteCount: number;
  dailyCount: number;
  minuteLimit: number;
  dailyLimit: number;
  minuteRemaining: number;
  dailyRemaining: number;
  isMinuteLimitReached: boolean;
  isDailyLimitReached: boolean;
}

const STORAGE_KEY_APIS = 'tmpa_custom_apis';
const STORAGE_KEY_USAGE = 'tmpa_custom_api_logs';

export const MAX_CUSTOM_APIS = 10;
export const CUSTOM_API_MINUTE_LIMIT = 10; // 10 request per menit
export const CUSTOM_API_DAILY_LIMIT = 50;  // 50 request per hari

// Ambil daftar API Kustom dari localStorage
export function getCustomApis(): CustomApiKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APIS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Gagal membaca custom APIs:', e);
    return [];
  }
}

// Simpan daftar API Kustom ke localStorage
export function saveCustomApis(apis: CustomApiKey[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_APIS, JSON.stringify(apis));
    window.dispatchEvent(new Event('tmpa_custom_apis_updated'));
  } catch (e) {
    console.error('Gagal menyimpan custom APIs:', e);
  }
}

// Tambah API Kustom baru (Maksimal 10)
export function addCustomApi(data: {
  name: string;
  provider?: string;
  baseUrl?: string;
  apiKey: string;
  model: string;
  isActive?: boolean;
}): { success: boolean; error?: string; api?: CustomApiKey } {
  const currentApis = getCustomApis();
  if (currentApis.length >= MAX_CUSTOM_APIS) {
    return {
      success: false,
      error: `Maksimal hanya dapat menambahkan ${MAX_CUSTOM_APIS} API. Hapus salah satu API terlebih dahulu.`,
    };
  }

  if (!data.name || !data.name.trim()) {
    return {
      success: false,
      error: 'Nama API wajib diisi.',
    };
  }

  if (!data.apiKey || !data.apiKey.trim()) {
    return {
      success: false,
      error: 'API Key / Token wajib diisi.',
    };
  }

  if (!data.model || !data.model.trim()) {
    return {
      success: false,
      error: 'Model ID wajib diisi agar edge function dapat mengenali model yang digunakan.',
    };
  }

  const providerName = data.provider?.trim() || 'OpenAI';
  const isSelfHost = isSelfHostedProvider(providerName);
  const preset = getProviderPreset(providerName);

  if (isSelfHost && (!data.baseUrl || !data.baseUrl.trim())) {
    return {
      success: false,
      error: 'Untuk provider Self-Hosted / Custom Endpoint, Base URL wajib diisi.',
    };
  }

  // Jika bukan self-hosted dan baseUrl kosong, gunakan defaultBaseUrl dari preset
  const finalBaseUrl = data.baseUrl && data.baseUrl.trim() 
    ? data.baseUrl.trim() 
    : (preset?.defaultBaseUrl || '');

  // Jangan otomatis mengaktifkan API kustom baru kecuali diminta eksplisit
  const shouldBeActive = data.isActive === true;

  const newApi: CustomApiKey = {
    id: 'api_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: data.name.trim(),
    provider: preset?.name || providerName,
    baseUrl: finalBaseUrl,
    apiKey: data.apiKey.trim(),
    model: data.model.trim(),
    isActive: shouldBeActive,
    createdAt: Date.now(),
  };

  const updatedApis = shouldBeActive
    ? currentApis.map(a => ({ ...a, isActive: false })).concat(newApi)
    : [...currentApis, newApi];

  saveCustomApis(updatedApis);
  return { success: true, api: newApi };
}

// Nonaktifkan seluruh Custom Chat API (saat beralih ke 3 model bawaan Bluefox)
export function deactivateAllCustomApis(): void {
  const currentApis = getCustomApis();
  const updated = currentApis.map(api => ({ ...api, isActive: false }));
  saveCustomApis(updated);
}

// Toggle status aktif/nonaktif API (Klik di kartu atau indikator hijau)
export function toggleCustomApiActive(id: string): { success: boolean; newState: boolean } {
  const currentApis = getCustomApis();
  let targetNewState = false;

  const updated = currentApis.map(api => {
    if (api.id === id) {
      targetNewState = !api.isActive;
      return { ...api, isActive: targetNewState };
    }
    // Jika mengaktifkan satu API, nonaktifkan yang lain agar fokus pada API yang dipilih
    return targetNewState ? { ...api, isActive: false } : api;
  });

  // Jika baru saja diaktifkan, pastikan yang lain mati
  const finalized = updated.map(api => {
    if (api.id === id) {
      return { ...api, isActive: targetNewState };
    }
    return targetNewState ? { ...api, isActive: false } : api;
  });

  saveCustomApis(finalized);
  return { success: true, newState: targetNewState };
}

// Hapus API Kustom
export function deleteCustomApi(id: string): boolean {
  const currentApis = getCustomApis();
  const filtered = currentApis.filter(api => api.id !== id);
  saveCustomApis(filtered);
  return true;
}

// Ambil API Kustom yang sedang aktif
export function getActiveCustomApi(): CustomApiKey | null {
  const apis = getCustomApis();
  return apis.find(a => a.isActive) || null;
}

// Ambil riwayat log panggilan untuk kalkulasi rate limit (10 req/menit & 50 req/hari)
function getRequestTimestamps(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USAGE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Hitung statistik penggunaan limit Custom API (10 req/menit & 50 req/hari)
export function getCustomApiUsageStats(): CustomApiUsageStats {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const timestamps = getRequestTimestamps();
  
  // Filter yang masih dalam 1 hari terakhir
  const validTimestamps = timestamps.filter(ts => ts > oneDayAgo);
  
  const minuteCount = validTimestamps.filter(ts => ts > oneMinuteAgo).length;
  const dailyCount = validTimestamps.length;

  return {
    minuteCount,
    dailyCount,
    minuteLimit: CUSTOM_API_MINUTE_LIMIT,
    dailyLimit: CUSTOM_API_DAILY_LIMIT,
    minuteRemaining: Math.max(0, CUSTOM_API_MINUTE_LIMIT - minuteCount),
    dailyRemaining: Math.max(0, CUSTOM_API_DAILY_LIMIT - dailyCount),
    isMinuteLimitReached: minuteCount >= CUSTOM_API_MINUTE_LIMIT,
    isDailyLimitReached: dailyCount >= CUSTOM_API_DAILY_LIMIT,
  };
}

// Catat satu panggilan request ke Custom API
export function recordCustomApiRequest(): { success: boolean; error?: string; stats: CustomApiUsageStats } {
  const statsBefore = getCustomApiUsageStats();

  if (statsBefore.isMinuteLimitReached) {
    return {
      success: false,
      error: `(custom API limit) Batas 10 request per menit telah tercapai! Tunggu 1 menit.`,
      stats: statsBefore,
    };
  }

  if (statsBefore.isDailyLimitReached) {
    return {
      success: false,
      error: `(custom API limit) Batas 50 request per hari telah tercapai! Tunggu reset besok.`,
      stats: statsBefore,
    };
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const current = getRequestTimestamps().filter(ts => ts > oneDayAgo);
  current.push(now);

  try {
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(current));
    window.dispatchEvent(new Event('tmpa_custom_api_usage_updated'));
  } catch (e) {
    console.error('Gagal update logs custom api usage:', e);
  }

  const statsAfter = getCustomApiUsageStats();
  return {
    success: true,
    stats: statsAfter,
  };
}

// Reset log penggunaan Custom API
export function resetCustomApiUsage(): void {
  try {
    localStorage.setItem(STORAGE_KEY_USAGE, '[]');
    window.dispatchEvent(new Event('tmpa_custom_api_usage_updated'));
  } catch (e) {
    console.error('Gagal reset custom api usage:', e);
  }
}
