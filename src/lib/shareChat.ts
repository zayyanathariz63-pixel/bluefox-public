export type ShareMode = 'read' | 'remix' | 'edit';

export interface SharedChatRecord {
  id: string; // share ID / session ID
  sessionId: string;
  title: string;
  mode: ShareMode;
  createdAt: number;
  updatedAt: number;
  model: string;
  url: string;
  messagesSnapshot?: any[];
}

const STORAGE_KEY = 'tmpa_shared_chats_registry';
const DEFAULT_MODE_KEY = 'tmpa_shared_default_mode';

/**
 * Mendapatkan seluruh riwayat chat yang telah dibagikan
 */
export function getSharedChatsRegistry(): Record<string, SharedChatRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Failed to parse shared chats registry', err);
    return {};
  }
}

/**
 * Menyimpan atau memperbarui konfigurasi share chat
 */
export function saveSharedChatRecord(record: SharedChatRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const registry = getSharedChatsRegistry();
    registry[record.sessionId] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (err) {
    console.error('Failed to save shared chat record', err);
  }
}

/**
 * Memperbarui mode akses share chat tertentu
 */
export function updateSharedChatMode(sessionId: string, newMode: ShareMode): SharedChatRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const registry = getSharedChatsRegistry();
    if (!registry[sessionId]) return null;
    registry[sessionId].mode = newMode;
    registry[sessionId].updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    return registry[sessionId];
  } catch (err) {
    console.error('Failed to update shared chat mode', err);
    return null;
  }
}

/**
 * Menghapus/mencabut link share chat
 */
export function revokeSharedChat(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const registry = getSharedChatsRegistry();
    delete registry[sessionId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (err) {
    console.error('Failed to revoke shared chat', err);
  }
}

/**
 * Mendapatkan mode default share chat dari setting
 */
export function getDefaultShareMode(): ShareMode {
  if (typeof window === 'undefined') return 'read';
  try {
    const val = localStorage.getItem(DEFAULT_MODE_KEY);
    if (val === 'read' || val === 'remix' || val === 'edit') return val;
    return 'read';
  } catch {
    return 'read';
  }
}

/**
 * Menyimpan mode default share chat
 */
export function setDefaultShareMode(mode: ShareMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEFAULT_MODE_KEY, mode);
  } catch (err) {
    console.error('Failed to set default share mode', err);
  }
}

/**
 * Menghasilkan URL format standar sesuai permintaan:
 * bluefox.tmpa.my.id/share-(ID Sesi chat user)
 */
export function buildShareUrl(sessionId: string, mode?: ShareMode, dataPayload?: any, targetOrigin?: string): string {
  // Gunakan domain bluefox.tmpa.my.id sesuai spesifikasi pengguna, atau targetOrigin jika diberikan
  const origin = targetOrigin || 'https://bluefox.tmpa.my.id';
    
  let baseUrl = `${origin}/share-${sessionId}`;
  
  // Sertakan mode dan data snapshot di parameter agar bisa langsung dimuat di browser manapun
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  
  if (dataPayload) {
    try {
      const jsonStr = JSON.stringify(dataPayload);
      const b64 = btoa(encodeURIComponent(jsonStr));
      params.set('d', b64);
    } catch {}
  }
  
  const queryStr = params.toString();
  return queryStr ? `${baseUrl}?${queryStr}` : baseUrl;
}

/**
 * Decode payload data dari URL jika ada
 */
export function parseSharedDataFromUrl(): {
  sessionId: string | null;
  mode: ShareMode | null;
  snapshotData: any | null;
} {
  if (typeof window === 'undefined') {
    return { sessionId: null, mode: null, snapshotData: null };
  }

  const pathname = window.location.pathname || '';
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  let sessionId: string | null = null;
  let mode: ShareMode | null = null;
  let snapshotData: any | null = null;

  // 1. Cek pola /share-(ID)
  const pathMatch = pathname.match(/\/share-([a-zA-Z0-9_-]+)/);
  if (pathMatch) {
    sessionId = pathMatch[1];
  }

  // 2. Cek pola hash #share-(ID) atau #/share-(ID)
  if (!sessionId) {
    const hashMatch = hash.match(/#\/?share-([a-zA-Z0-9_-]+)/);
    if (hashMatch) {
      sessionId = hashMatch[1];
    }
  }

  // 3. Cek query param ?share=(ID)
  if (!sessionId) {
    const params = new URLSearchParams(search);
    const qShare = params.get('share');
    if (qShare) {
      sessionId = qShare.replace(/^share-/, '');
    }
  }

  // Parse mode dari query atau hash
  const urlParams = new URLSearchParams(search || (hash.includes('?') ? hash.split('?')[1] : ''));
  const m = urlParams.get('mode');
  if (m === 'read' || m === 'remix' || m === 'edit') {
    mode = m;
  }

  // Parse snapshot payload jika ada
  const d = urlParams.get('d');
  if (d) {
    try {
      const decoded = decodeURIComponent(atob(d));
      snapshotData = JSON.parse(decoded);
      if (!mode && snapshotData?.mode) {
        mode = snapshotData.mode;
      }
    } catch (e) {
      console.warn('Failed to decode shared snapshot payload', e);
    }
  }

  // Jika mode belum ditentukan, coba baca dari registry lokal
  if (sessionId && !mode) {
    const registry = getSharedChatsRegistry();
    if (registry[sessionId]?.mode) {
      mode = registry[sessionId].mode;
    }
  }

  return { sessionId, mode: mode || 'read', snapshotData };
}
