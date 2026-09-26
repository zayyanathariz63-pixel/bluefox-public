/**
 * Manajemen Local Storage untuk File & Gambar Lampiran Bluefox
 * Sesuai spesifikasi:
 * - Gambar & file lampiran disimpan di LocalStorage
 * - Supabase hanya menyimpan metadata (local_id, name, type, size)
 */

export interface LocalStoredFile {
  id: string; // e.g. bluefox_file_...
  name: string;
  type: string;
  size: number;
  base64: string;
  createdAt: number;
}

export interface AttachmentMetadata {
  local_id: string;
  name: string;
  type: string;
  size: number;
  pageCount?: number;
  textContent?: string;
}

const FILE_INDEX_KEY = 'bluefox_file_index';

function updateFileIndex(fileData: LocalStoredFile) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(FILE_INDEX_KEY);
    const index: Array<{ id: string; name: string; type: string; size: number; createdAt: number }> = raw ? JSON.parse(raw) : [];
    const filtered = index.filter(item => item.id !== fileData.id);
    filtered.unshift({
      id: fileData.id,
      name: fileData.name,
      type: fileData.type,
      size: fileData.size,
      createdAt: fileData.createdAt || Date.now()
    });
    localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch {}
}

function removeFromIndex(fileId: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(FILE_INDEX_KEY);
    if (!raw) return;
    const index: Array<{ id: string }> = JSON.parse(raw);
    const filtered = index.filter(item => item.id !== fileId);
    localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(filtered));
  } catch {}
}

/**
 * Menyimpan file dari input file HTML ke Local Storage
 */
export function saveFileToLocalStorage(file: File): Promise<AttachmentMetadata> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileId = `bluefox_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    reader.onload = () => {
      const base64 = reader.result as string;
      const fileData: LocalStoredFile = {
        id: fileId,
        name: file.name,
        type: file.type || 'image/png',
        size: file.size,
        base64: base64,
        createdAt: Date.now()
      };

      try {
        localStorage.setItem(fileId, JSON.stringify(fileData));
        updateFileIndex(fileData);
        window.dispatchEvent(new CustomEvent('bluefox_files_updated'));

        resolve({
          local_id: fileId,
          name: file.name,
          type: file.type || 'image/png',
          size: file.size
        });
      } catch (error) {
        console.warn('Gagal menyimpan file ke local storage:', error);
        reject('Local storage penuh atau tidak dapat menyimpan file.');
      }
    };

    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Menyimpan data Base64 / Data URL yang sudah ada ke Local Storage
 */
export function saveBase64ToLocalStorage(
  base64: string, 
  name: string = 'image.png', 
  type: string = 'image/png', 
  size?: number
): AttachmentMetadata | null {
  if (typeof window === 'undefined' || !base64) return null;
  const fileId = `bluefox_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const calculatedSize = size || Math.round(base64.length * 0.75);

  const fileData: LocalStoredFile = {
    id: fileId,
    name: name,
    type: type,
    size: calculatedSize,
    base64: base64,
    createdAt: Date.now()
  };

  try {
    localStorage.setItem(fileId, JSON.stringify(fileData));
    updateFileIndex(fileData);
    window.dispatchEvent(new CustomEvent('bluefox_files_updated'));

    return {
      local_id: fileId,
      name: fileData.name,
      type: fileData.type,
      size: fileData.size
    };
  } catch (err) {
    console.warn('Gagal menyimpan base64 ke local storage:', err);
    return null;
  }
}

/**
 * Mengambil data file dari Local Storage berdasarkan local_id
 */
export function getFileFromLocalStorage(localId: string): LocalStoredFile | null {
  if (typeof window === 'undefined' || !localId) return null;
  try {
    const data = localStorage.getItem(localId);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Mengambil semua file yang tersimpan di Local Storage untuk ditampilkan di File History
 */
export function getAllLocalFiles(): LocalStoredFile[] {
  if (typeof window === 'undefined') return [];
  const files: LocalStoredFile[] = [];
  const seenIds = new Set<string>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('bluefox_file_') || key.startsWith('tmpa_media_'))) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const id = parsed.id || key;
            if (!seenIds.has(id) && (parsed.base64 || parsed.url)) {
              seenIds.add(id);
              files.push({
                id: id,
                name: parsed.name || 'Lampiran Gambar',
                type: parsed.type || (parsed.url?.includes('data:image') ? 'image/png' : 'application/octet-stream'),
                size: parsed.size || 0,
                base64: parsed.base64 || parsed.url,
                createdAt: parsed.createdAt || Date.now()
              });
            }
          }
        } catch {}
      }
    }
  } catch {}

  return files.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Menghapus satu file dari Local Storage
 */
export function deleteLocalFile(localId: string): boolean {
  if (typeof window === 'undefined' || !localId) return false;
  try {
    localStorage.removeItem(localId);
    removeFromIndex(localId);
    window.dispatchEvent(new CustomEvent('bluefox_files_updated'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Menghapus seluruh file lampiran di Local Storage
 */
export function clearAllLocalFiles(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('bluefox_file_') || key.startsWith('tmpa_media_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(FILE_INDEX_KEY);
    window.dispatchEvent(new CustomEvent('bluefox_files_updated'));
    return true;
  } catch {
    return false;
  }
}
