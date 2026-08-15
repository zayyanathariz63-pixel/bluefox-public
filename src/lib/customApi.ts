export interface CustomApiKey {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey: string;
  model?: string;
  isActive: boolean;
  createdAt: number;
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
  model?: string;
  isActive?: boolean;
}): { success: boolean; error?: string; api?: CustomApiKey } {
  const currentApis = getCustomApis();
  if (currentApis.length >= MAX_CUSTOM_APIS) {
    return {
      success: false,
      error: `Maksimal hanya dapat menambahkan ${MAX_CUSTOM_APIS} API. Hapus salah satu API terlebih dahulu.`,
    };
  }

  if (!data.name.trim() || !data.apiKey.trim()) {
    return {
      success: false,
      error: 'Nama API dan API Key wajib diisi.',
    };
  }

  // Jika dibuat aktif, buat API lainnya nonaktif (atau boleh multi-active, tapi defaultnya jadikan active yang baru)
  const shouldBeActive = data.isActive !== undefined ? data.isActive : currentApis.length === 0;

  const newApi: CustomApiKey = {
    id: 'api_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: data.name.trim(),
    provider: data.provider?.trim() || 'Custom / OpenAI Compatible',
    baseUrl: data.baseUrl?.trim() || '',
    apiKey: data.apiKey.trim(),
    model: data.model?.trim() || '',
    isActive: shouldBeActive,
    createdAt: Date.now(),
  };

  const updatedApis = shouldBeActive
    ? currentApis.map(a => ({ ...a, isActive: false })).concat(newApi)
    : [...currentApis, newApi];

  saveCustomApis(updatedApis);
  return { success: true, api: newApi };
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
