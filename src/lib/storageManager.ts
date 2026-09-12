import { supabase } from './supabase';

export interface StorageUsageStats {
  totalBytes: number;
  totalKb: number;
  totalMb: number;
  percentageUsed: number;
  mediaCount: number;
  sessionCount: number;
  estimatedMaxMb: number;
}

/**
 * Menghitung perkiraan penggunaan localStorage saat ini (dalam bytes, KB, MB, dan %)
 */
export function getStorageUsageStats(): StorageUsageStats {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      totalBytes: 0,
      totalKb: 0,
      totalMb: 0,
      percentageUsed: 0,
      mediaCount: 0,
      sessionCount: 0,
      estimatedMaxMb: 5,
    };
  }

  let totalChars = 0;
  let mediaCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        totalChars += key.length + val.length;
        if (key.startsWith('tmpa_media_')) {
          mediaCount++;
        }
      }
    }
  } catch (err) {
    console.warn('[STORAGE STATS ERROR]:', err);
  }

  // 1 karakter string JS disimpan dalam UTF-16 (~2 bytes)
  const totalBytes = totalChars * 2;
  const totalKb = Math.round((totalBytes / 1024) * 10) / 10;
  const totalMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
  const estimatedMaxMb = 5; // Batas standar localStorage browser adalah 5 MB
  const percentageUsed = Math.min(100, Math.round((totalMb / estimatedMaxMb) * 100));

  let sessionCount = 0;
  try {
    const rawSessions = localStorage.getItem('tmpa_chat_sessions');
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions);
      if (Array.isArray(parsed)) sessionCount = parsed.length;
    }
  } catch {}

  return {
    totalBytes,
    totalKb,
    totalMb,
    percentageUsed,
    mediaCount,
    sessionCount,
    estimatedMaxMb,
  };
}

/**
 * Membersihkan seluruh media yang tersimpan di localStorage:
 * 1. Menghapus semua kunci `tmpa_media_*`
 * 2. Membersihkan URL data base64 yang besar pada lampiran pesan di riwayat sesi,
 *    namun tetap mempertahankan nama file, tipe, dan teks chat agar riwayat obrolan tidak rusak.
 */
export function clearAllStoredMedia(): { countRemoved: number; bytesFreedKb: number } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { countRemoved: 0, bytesFreedKb: 0 };
  }

  const beforeStats = getStorageUsageStats();
  let countRemoved = 0;

  try {
    // 1. Hapus semua kunci tmpa_media_*
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tmpa_media_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      countRemoved++;
    });

    // 2. Bersihkan payload base64 media dari tmpa_chat_sessions
    const rawSessions = localStorage.getItem('tmpa_chat_sessions');
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions);
      if (Array.isArray(sessions)) {
        let modified = false;
        const cleanedSessions = sessions.map((sess: any) => {
          if (!sess.messages || !Array.isArray(sess.messages)) return sess;
          const cleanedMessages = sess.messages.map((msg: any) => {
            let msgChanged = false;
            let newMedia = msg.media;
            let newImageUrl = msg.imageUrl;

            if (newImageUrl && newImageUrl.startsWith('data:')) {
              newImageUrl = '';
              msgChanged = true;
            }

            if (newMedia) {
              if (Array.isArray(newMedia)) {
                newMedia = newMedia.map((m: any) => {
                  if (m.url && m.url.startsWith('data:')) {
                    msgChanged = true;
                    return { ...m, url: '' };
                  }
                  return m;
                });
              } else if (newMedia.url && newMedia.url.startsWith('data:')) {
                newMedia = { ...newMedia, url: '' };
                msgChanged = true;
              }
            }

            if (msgChanged) {
              modified = true;
              return { ...msg, media: newMedia, imageUrl: newImageUrl };
            }
            return msg;
          });

          return modified ? { ...sess, messages: cleanedMessages } : sess;
        });

        if (modified) {
          localStorage.setItem('tmpa_chat_sessions', JSON.stringify(cleanedSessions));
        }
      }
    }
  } catch (err) {
    console.error('[CLEAR MEDIA ERROR]:', err);
  }

  const afterStats = getStorageUsageStats();
  const bytesFreedKb = Math.max(0, Math.round((beforeStats.totalKb - afterStats.totalKb) * 10) / 10);

  // Beritahukan komponen aplikasi
  window.dispatchEvent(new CustomEvent('tmpa_media_cleared', { detail: { countRemoved, bytesFreedKb } }));

  return { countRemoved, bytesFreedKb };
}

/**
 * Otomatis menghapus media jika localStorage penuh (QuotaExceededError).
 * Ini dipanggil saat setItem gagal karena storage penuh.
 */
export function autoPurgeMediaIfStorageFull(): boolean {
  try {
    console.warn('[STORAGE] Kuota localStorage penuh! Menjalankan pembersihan media otomatis...');
    clearAllStoredMedia();
    window.dispatchEvent(new CustomEvent('tmpa_storage_auto_purged'));
    return true;
  } catch (err) {
    console.error('[STORAGE] Gagal membersihkan media secara otomatis:', err);
    return false;
  }
}

/**
 * Menyimpan sesi obrolan dengan proteksi otomatis jika kuota penuh:
 * Jika localStorage penuh, langsung bersihkan media dan coba simpan ulang.
 */
export function safeSaveSessionsToLocal(sessions: any[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem('tmpa_chat_sessions', JSON.stringify(sessions));
    return true;
  } catch (e: any) {
    // Tangani QuotaExceededError (code 22, atau pesan quota)
    console.warn('[STORAGE QUOTA EXCEEDED] Menghapus media untuk memberi ruang penyimpanan...');
    autoPurgeMediaIfStorageFull();

    // Buat salinan sesi yang sudah dibersihkan dari base64 media data
    try {
      const strippedSessions = sessions.map((sess: any) => {
        if (!sess.messages || !Array.isArray(sess.messages)) return sess;
        return {
          ...sess,
          messages: sess.messages.map((msg: any) => {
            const stripped = { ...msg };
            if (stripped.imageUrl && stripped.imageUrl.startsWith('data:')) {
              stripped.imageUrl = '';
            }
            if (stripped.media) {
              if (Array.isArray(stripped.media)) {
                stripped.media = stripped.media.map((m: any) => ({
                  ...m,
                  url: m.url?.startsWith('data:') ? '' : m.url,
                }));
              } else if (stripped.media.url?.startsWith('data:')) {
                stripped.media = { ...stripped.media, url: '' };
              }
            }
            return stripped;
          }),
        };
      });

      localStorage.setItem('tmpa_chat_sessions', JSON.stringify(strippedSessions));
      return true;
    } catch (retryErr) {
      console.error('[STORAGE RETRY FAILED]:', retryErr);
      return false;
    }
  }
}

/**
 * Menghapus seluruh sesi chat dari localStorage
 */
export function clearAllChatSessions(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.removeItem('tmpa_chat_sessions');
    localStorage.removeItem('tmpa_last_active_session_id');

    // Bersihkan juga media yang terkait
    clearAllStoredMedia();

    window.dispatchEvent(new CustomEvent('tmpa_sessions_cleared'));
    return true;
  } catch (err) {
    console.error('[CLEAR SESSIONS ERROR]:', err);
    return false;
  }
}

/**
 * Menghapus seluruh akun dan data pengguna dari perangkat:
 * 1. Logout dari Supabase
 * 2. Menghapus sesi chat, media, profil, custom instruction, token SSO, dsb.
 */
export async function deleteUserAccount(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Sign out dari Supabase
    try {
      await supabase.auth.signOut();
    } catch (authErr) {
      console.warn('[AUTH SIGNOUT ERROR]:', authErr);
    }

    // 2. Daftar kunci yang wajib dibersihkan
    const specificKeys = [
      'tmpa_user_profile',
      'tmpa_profile_pic',
      'tmpa_custom_instruction',
      'tmpa_device_id',
      'tmpa_selected_account',
      'tmpa_chat_sessions',
      'tmpa_last_active_session_id',
      'tmpa_custom_apis',
      'tmpa_custom_api_usage',
      'tmpa_vision_active',
      'tmpa_selected_model',
      'ai_usage_events',
      'tmpa_language',
    ];

    specificKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });

    // 3. Hapus semua kunci media dan auth tokens supabase
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tmpa_') || key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    window.dispatchEvent(new CustomEvent('tmpa_account_deleted'));
    return true;
  } catch (err) {
    console.error('[DELETE ACCOUNT ERROR]:', err);
    return false;
  }
}
