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

export const MIN_SHARE_ID_LENGTH = 16;
export const MAX_SHARE_ID_LENGTH = 32;

/**
 * Menghasilkan Session ID Share Chat acak yang terdiri dari angka dan huruf (alphanumeric),
 * dengan panjang minimal 16 karakter dan maksimal 32 karakter (default 24 karakter).
 */
export function generateShareSessionId(length: number = 24): string {
  const targetLen = Math.max(MIN_SHARE_ID_LENGTH, Math.min(MAX_SHARE_ID_LENGTH, length));
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(targetLen);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < targetLen; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < targetLen; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * Memvalidasi apakah sebuah ID memenuhi kriteria ID Share Chat (alphanumeric 16-32 karakter)
 */
export function isValidShareSessionId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return id.length >= MIN_SHARE_ID_LENGTH && id.length <= MAX_SHARE_ID_LENGTH && /^[a-zA-Z0-9]+$/.test(id);
}

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
 * Mendapatkan daftar unik catatan share chat tanpa duplikasi key
 */
export function getUniqueSharedChatsList(): SharedChatRecord[] {
  const registry = getSharedChatsRegistry();
  const seen = new Set<string>();
  const list: SharedChatRecord[] = [];
  for (const record of Object.values(registry)) {
    const key = record.id || record.sessionId;
    if (key && !seen.has(key)) {
      seen.add(key);
      list.push(record);
    }
  }
  return list;
}

/**
 * Menyimpan atau memperbarui konfigurasi share chat
 */
export function saveSharedChatRecord(record: SharedChatRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const registry = getSharedChatsRegistry();
    // Simpan berdasarkan ID share (alphanumeric 16-32 karakter) dan sessionId
    registry[record.id] = record;
    if (record.sessionId && record.sessionId !== record.id) {
      registry[record.sessionId] = record;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (err) {
    console.error('Failed to save shared chat record', err);
  }
}

/**
 * Memperbarui mode akses share chat tertentu berdasarkan share ID atau session ID
 */
export function updateSharedChatMode(idOrSessionId: string, newMode: ShareMode): SharedChatRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const registry = getSharedChatsRegistry();
    let targetRecord: SharedChatRecord | null = registry[idOrSessionId] || null;
    
    if (!targetRecord) {
      targetRecord = Object.values(registry).find(r => r.id === idOrSessionId || r.sessionId === idOrSessionId) || null;
    }
    
    if (!targetRecord) return null;
    
    targetRecord.mode = newMode;
    targetRecord.updatedAt = Date.now();
    
    registry[targetRecord.id] = targetRecord;
    if (targetRecord.sessionId) {
      registry[targetRecord.sessionId] = targetRecord;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    return targetRecord;
  } catch (err) {
    console.error('Failed to update shared chat mode', err);
    return null;
  }
}

/**
 * Menghapus/mencabut link share chat
 */
export function revokeSharedChat(idOrSessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const registry = getSharedChatsRegistry();
    const targetRecord = registry[idOrSessionId] || Object.values(registry).find(r => r.id === idOrSessionId || r.sessionId === idOrSessionId);
    
    if (targetRecord) {
      delete registry[targetRecord.id];
      if (targetRecord.sessionId) {
        delete registry[targetRecord.sessionId];
      }
    } else {
      delete registry[idOrSessionId];
    }
    
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
    const match = registry[sessionId] || Object.values(registry).find(r => r.id === sessionId || r.sessionId === sessionId);
    if (match?.mode) {
      mode = match.mode;
    }
  }

  return { sessionId, mode: mode || 'read', snapshotData };
}
