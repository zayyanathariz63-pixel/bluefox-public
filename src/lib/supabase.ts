import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './env';

export const supabaseUrl: string = SUPABASE_CONFIG.url;
export const supabaseKey: string = SUPABASE_CONFIG.anonKey;

export const hasValidConfig: boolean = Boolean(
  supabaseUrl && 
  supabaseKey && 
  supabaseKey.length > 20 && 
  supabaseUrl !== 'https://dummy.supabase.co'
);

export const supabase = createClient(
  supabaseUrl,
  supabaseKey || 'anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pertukaran tiket SSO dengan Supabase Auth Edge Function
 */
export const exchangeSsoTicket = async (ticketId: string) => {
  // Memberi jeda ke Supabase DB untuk memastikan tiket dari 'account' sudah ter-commit
  await delay(2000);

  const edgeFunctionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/exchange-sso-ticket`;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ ticket: ticketId }),
  });

  const edgeData = await response.json();

  if (!response.ok || edgeData?.error) {
    throw new Error(edgeData?.error || edgeData?.message || 'Tiket SSO tidak valid atau sudah digunakan');
  }

  if (!edgeData?.token_hash && !edgeData?.session && !edgeData?.user) {
    throw new Error('Respon tiket SSO tidak mengandung token_hash atau session.');
  }

  return edgeData;
};

/**
 * Pemanggilan langsung ke Supabase Edge Function 'bluefox-processor-'
 * Endpoint: https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-
 */
export async function invokeBluefoxProcessor(payload: any, signal?: AbortSignal) {
  const edgeFunctionUrl = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-';
  const anonKey = supabaseKey || (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zXY2aPqOnPt7j1QKdoZFxQ_x6rOon0U';

  // Pastikan ID model dan Target API ID selalu terisi sesuai spesifikasi Edge Function:
  // 1. Bluefox pro --> agnes-2.5-flash
  // 2. Bluefox standard --> jev
  // 3. Bluefox Dilo --> laguna-s-2.1
  const safePayload: any = { ...(payload || {}) };
  const fallbackModel = safePayload.model_id || safePayload.modelId || safePayload.model || safePayload.id_model || 'agnes-2.5-flash';
  if (!safePayload.model_id) safePayload.model_id = fallbackModel;
  if (!safePayload.modelId) safePayload.modelId = fallbackModel;
  if (!safePayload.id_model) safePayload.id_model = fallbackModel;
  if (!safePayload.model) safePayload.model = fallbackModel;

  // Resolve Target API ID
  const resolveTargetApiId = (inputModel?: string): string => {
    if (!inputModel) return 'agnes-2.5-flash';
    const m = inputModel.toLowerCase();
    if (m.includes('laguna') || m.includes('dilo')) return 'laguna-s-2.1';
    if (m.includes('standard') || m.includes('standar') || m.includes('tencent') || m.includes('jev')) return 'jev';
    if (m.includes('pro') || m.includes('agnes')) return 'agnes-2.5-flash';
    return inputModel;
  };

  const resolvedApiId = safePayload.api_id || safePayload.target_api_id || safePayload.targetApiId || safePayload.apiId || resolveTargetApiId(safePayload.model || safePayload.model_id);
  safePayload.api_id = resolvedApiId;
  safePayload.apiId = resolvedApiId;
  safePayload.target_api_id = resolvedApiId;
  safePayload.targetApiId = resolvedApiId;
  safePayload.API_ID = resolvedApiId;
  safePayload.target_api = resolvedApiId;
  safePayload.targetApi = resolvedApiId;

  // 1. Ekstrak access token sesi aktif pengguna
  let authToken = anonKey;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    let currentSession = sessionData?.session;

    // Jika token mendekati masa kedaluwarsa (< 60 detik) atau sudah kedaluwarsa, segarkan sesi
    if (currentSession?.expires_at) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (currentSession.expires_at - nowSec < 60) {
        console.log("🔄 Sesi Supabase mendekati kedaluwarsa, menyegarkan token...");
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          currentSession = refreshed.session;
        }
      }
    }

    if (currentSession?.access_token) {
      authToken = currentSession.access_token;
    } else if (typeof window !== 'undefined') {
      // Coba cari token dari localStorage auth Supabase jika getSession belum tersinkron
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.access_token) {
                authToken = parsed.access_token;
                break;
              }
            }
          } catch {}
        }
      }
    }
  } catch (authErr) {
    console.warn("⚠️ Gagal membaca access token sesi Supabase:", authErr);
  }

  // 2. Fungsi helper untuk mengeksekusi request HTTP ke Edge Function
  const executeRequest = async (tokenToUse: string) => {
    return await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${tokenToUse}`,
      },
      body: JSON.stringify(safePayload),
      signal,
    });
  };

  let response = await executeRequest(authToken);

  // 3. Jika Edge Function mengembalikan 401 Unauthorized, coba refresh sesi 1 kali dan kirim ulang
  if (response.status === 401) {
    console.warn("⚠️ Edge Function merespon 401 Unauthorized, mencoba auto-refresh sesi Supabase...");
    try {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed?.session?.access_token) {
        console.log("✅ Berhasil menyegarkan sesi Supabase, mencoba ulang request Edge Function...");
        authToken = refreshed.session.access_token;
        response = await executeRequest(authToken);
      }
    } catch (retryCatch) {
      console.warn("⚠️ Gagal auto-refresh sesi Supabase:", retryCatch);
    }
  }

  // 4. Parse respons
  let data: any = {};
  const textResponse = await response.text();
  try {
    data = JSON.parse(textResponse);
  } catch {
    data = { message: textResponse };
  }

  if (!response.ok || data?.error) {
    const errorMsg = data?.error || data?.message || `Edge function error (${response.status})`;
    const errorObj = new Error(errorMsg);
    (errorObj as any).status = response.status;
    (errorObj as any).data = data;
    throw errorObj;
  }

  return data;
}

/**
 * Mendengarkan pesan baru secara Realtime untuk suatu percakapan
 */
export function listenToRealtimeMessages(conversationId: string, onNewMessage: (msg: any) => void) {
  if (!conversationId || !hasValidConfig) return () => {};

  try {
    const channel = supabase
      .channel(`room:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new;
          if (newMessage) {
            onNewMessage(newMessage);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime terhubung untuk room:', conversationId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn("Gagal inisialisasi Realtime channel:", err);
    return () => {};
  }
}

/**
 * Helper untuk memastikan format UUID v4 valid
 */
export function getValidUUID(id?: string | null): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && uuidRegex.test(id)) {
    return id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * -------------------------------------------------------------
 * B. Fungsi Database Supabase (Tabel Bluefox: session_bluefox & message_bluefox)
 * -------------------------------------------------------------
 */

// -------------------------------------------------------------
// A. Mendapatkan Info User yang Sedang Login
// -------------------------------------------------------------
export async function getLoggedInUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return session.user;
      console.error('Pengguna belum login:', error?.message);
      return null;
    }
    return user;
  } catch (err: any) {
    console.error('Error getLoggedInUser:', err?.message || err);
    return null;
  }
}

// State global untuk menyimpan ID sesi yang sedang aktif di UI
export let currentSessionId: string | null = null;

export function setCurrentSessionId(id: string | null) {
  currentSessionId = id;
}

// -------------------------------------------------------------
// B. Manajemen Sesi Percakapan (Sesuai User ID)
// -------------------------------------------------------------

// 1. Buat Sesi Baru untuk User yang Login
export async function createNewSession(firstPrompt: string = 'Percakapan Baru', customId?: string) {
  const user = await getLoggedInUser();
  const title = (firstPrompt && firstPrompt.trim())
    ? (firstPrompt.length > 30 ? firstPrompt.substring(0, 30) + '...' : firstPrompt)
    : 'Percakapan Baru';

  const validId = customId ? getValidUUID(customId) : undefined;

  if (!user) {
    console.warn('User belum terautentikasi di Supabase. Menggunakan sesi lokal.');
    const fallbackId = validId || getValidUUID(null);
    currentSessionId = fallbackId;
    return {
      id: fallbackId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  if (validId) {
    try {
      const { data: existing } = await supabase
        .from('session_bluefox')
        .select('*')
        .eq('id', validId)
        .maybeSingle();

      if (existing) {
        currentSessionId = existing.id;
        return existing;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('session_bluefox')
        .insert([{ id: validId, user_id: user.id, title }])
        .select()
        .maybeSingle();

      if (!insertError && inserted) {
        currentSessionId = inserted.id;
        return inserted;
      }
    } catch (e) {
      console.warn('Error saat createNewSession dengan customId:', e);
    }
  }

  // PENTING: Biarkan Supabase dan PostgreSQL yang membuat nilai id baru secara otomatis menggunakan gen_random_uuid()
  const { data, error } = await supabase
    .from('session_bluefox')
    .insert([{ 
      user_id: user.id, 
      title: title 
    }])
    .select()
    .single();

  if (error) {
    console.error('Gagal membuat sesi baru di Supabase, fallback lokal:', error.message);
    const fallbackId = validId || getValidUUID(null);
    currentSessionId = fallbackId;
    return {
      id: fallbackId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // Set ID Sesi baru ke state aktif
  if (data?.id) {
    currentSessionId = data.id;
  }
  return data; // Object sesi baru beserta ID UUID-nya
}

// 2. Ambil Semua Daftar Sesi Milik User (Untuk Pindah Perangkat / Sidebar)
export async function fetchUserSessions() {
  const { data, error } = await supabase
    .from('session_bluefox')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Gagal mengambil daftar sesi:', error.message);
    return [];
  }
  return data || []; // Mengembalikan array daftar sesi [{ id, title, updated_at }, ...]
}

// Alias untuk kompatibilitas penuh dengan kode eksisting
export const getUserSessions = fetchUserSessions;
export const getAllSessions = fetchUserSessions;

// -------------------------------------------------------------
// C. Fitur Hapus Sesi (Otomatis Menghapus Seluruh Pesan di Dalamnya)
// -------------------------------------------------------------

// Hapus Sesi Berdasarkan ID (Sangat Direkomendasikan)
export async function deleteSessionById(sessionId: string) {
  if (!sessionId) {
    console.error('ID Sesi wajib disertakan untuk menghapus.');
    return false;
  }

  const validSessionId = getValidUUID(sessionId);
  try {
    await supabase
      .from('message_bluefox')
      .delete()
      .eq('session_id', validSessionId);
  } catch {}

  // Menghapus baris pada session_bluefox berdasarkan ID uniknya
  const { error } = await supabase
    .from('session_bluefox')
    .delete()
    .eq('id', validSessionId); // Kunci keamanan: Cocokkan ID Sesi secara pasti

  if (error) {
    console.error('Gagal menghapus sesi:', error.message);
    return false;
  }

  // Jika sesi yang dihapus adalah sesi yang sedang dibuka di layar, kosongkan state & UI
  if (currentSessionId === validSessionId) {
    currentSessionId = null;
  }

  console.log(`Sesi dengan ID ${validSessionId} dan seluruh pesannya berhasil dihapus.`);
  return true;
}

// Alias deleteChatSession untuk kompatibilitas penuh
export const deleteChatSession = deleteSessionById;

// Hapus Sesi Berdasarkan Judul (Sesuai Permintaan)
export async function deleteSessionByTitle(title: string) {
  try {
    const { data: sessions } = await supabase
      .from('session_bluefox')
      .select('id')
      .eq('title', title);

    if (sessions && sessions.length > 0) {
      for (const s of sessions) {
        await supabase
          .from('message_bluefox')
          .delete()
          .eq('session_id', s.id);
      }
    }
  } catch {}

  const { error } = await supabase
    .from('session_bluefox')
    .delete()
    .eq('title', title);

  if (error) {
    console.error('Gagal menghapus sesi berdasarkan judul:', error.message);
    return false;
  }
  console.log(`Sesi dengan judul "${title}" berhasil dihapus.`);
  return true;
}

// -------------------------------------------------------------
// D. Menyimpan dan Memuat Pesan Percakapan
// -------------------------------------------------------------

// Simpan Pertanyaan User + Jawaban AI dalam 1 Kali Simpan
export async function saveChatTurn(
  sessionId: string, 
  userMessage: string, 
  aiResponse: string, 
  attachmentMetadata: any[] = []
) {
  const validSessionId = getValidUUID(sessionId);
  currentSessionId = validSessionId;

  // Pastikan sesi ada di session_bluefox sebelum insert message untuk menghindari Foreign Key error
  try {
    const { data: existingSession } = await supabase
      .from('session_bluefox')
      .select('id')
      .eq('id', validSessionId)
      .maybeSingle();

    if (!existingSession) {
      const user = await getLoggedInUser();
      const title = (userMessage && userMessage.trim())
        ? (userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage)
        : 'Percakapan Baru';

      const payload: any = { id: validSessionId, title };
      if (user?.id) {
        payload.user_id = user.id;
      }

      await supabase
        .from('session_bluefox')
        .insert([payload])
        .select()
        .maybeSingle();
    }
  } catch (sessErr) {
    console.warn("Memastikan session_bluefox:", sessErr);
  }

  // PENTING: Jangan masukkan 'id' di dalam object ini.
  // Hanya masukkan session_id, user_message, ai_response, dan attachments.
  const { data, error } = await supabase
    .from('message_bluefox')
    .insert([
      {
        session_id: validSessionId, // ID Sesi tempat pesan ini berada
        user_message: userMessage,
        ai_response: aiResponse,
        attachments: attachmentMetadata || []
      }
    ])
    .select();

  if (error) {
    console.warn('Info simpan baris percakapan ke Supabase (tersimpan di lokal):', error.message);
    return [
      {
        session_id: validSessionId,
        user_message: userMessage,
        ai_response: aiResponse,
        attachments: attachmentMetadata || []
      }
    ];
  }

  console.log('Baris percakapan baru berhasil ditambahkan:', data);
  
  // Perbarui timestamp sesi
  await supabase
    .from('session_bluefox')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', validSessionId);

  return data;
}

// Menyimpan Pesan Baru ke Sesi yang Sedang Aktif
export async function sendChatMessage(userMessageText: string, aiResponseText: string, attachmentMetadata: any[] = []) {
  if (!currentSessionId) {
    console.error('Tidak ada sesi yang aktif! Buat atau pilih sesi terlebih dahulu.');
    return null;
  }

  return saveChatTurn(currentSessionId, userMessageText, aiResponseText, attachmentMetadata);
}

// Kompatibilitas alias untuk saveMessage
export async function saveMessage(
  sessionId: string, 
  sender: 'user' | 'assistant', 
  content: string, 
  attachmentMetadata: any[] = []
) {
  if (sender === 'assistant') {
    return saveChatTurn(sessionId, '', content, attachmentMetadata);
  }
  return saveChatTurn(sessionId, content, '', attachmentMetadata);
}

// Memuat SELURUH Pesan Sesi (Saat Room Chat Dipilih / Pindah Perangkat)
export async function openChatRoom(sessionId: string) {
  const validSessionId = getValidUUID(sessionId);
  currentSessionId = validSessionId;

  // Ambil SELURUH baris pesan dari Supabase berdasarkan ID Sesi ini
  const { data: messages, error } = await supabase
    .from('message_bluefox')
    .select('*')
    .eq('session_id', validSessionId)
    .order('created_at', { ascending: true }); // Mengurutkan dari pesan pertama hingga terbaru

  if (error) {
    console.error('Gagal memuat isi pesan:', error.message);
    const empty: any = [];
    empty.messages = [];
    return empty;
  }

  const result: any = messages || [];
  result.messages = result; // Dukungan kompatibilitas ganda (array langsung dan destructuring { messages })
  return result;
}

// Alias untuk kompatibilitas penuh dengan kode eksisting
export const loadChatMessages = openChatRoom;
export const loadChatSession = openChatRoom;

// 6. Memperbarui Judul Sesi Percakapan di session_bluefox
export async function updateSessionTitleInSupabase(sessionId: string, newTitle: string) {
  const validSessionId = getValidUUID(sessionId);
  try {
    const { data, error } = await supabase
      .from('session_bluefox')
      .update({ 
        title: newTitle,
        updated_at: new Date().toISOString() 
      })
      .eq('id', validSessionId)
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err: any) {
    return { data: null, error: err?.message };
  }
}

/**
 * Menyimpan pesan ke tabel 'messages' dan memperbarui 'conversations' di Supabase (Kompatibilitas Tambahan)
 */
export async function sendMessageToSupabase(
  text: string, 
  conversationId: string, 
  role: 'user' | 'assistant' = 'user'
) {
  if (!text || !text.trim() || !conversationId) {
    return { data: null, error: 'Input tidak valid' };
  }
  if (!hasValidConfig) {
    return { data: null, error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const rawUserId = session?.user?.id;
    const userId = (rawUserId && typeof rawUserId === 'string' && rawUserId.trim() !== "") ? rawUserId.trim() : null;
    const validConvId = getValidUUID(conversationId);

    // 1. Pastikan record di tabel 'conversations' ada
    try {
      const convPayload: Record<string, any> = {
        id: validConvId,
        title: text.length > 40 ? text.substring(0, 40) + '...' : text,
        updated_at: new Date().toISOString(),
      };
      
      if (userId) {
        convPayload.user_id = userId;
      }

      await supabase
        .from('conversations')
        .upsert([convPayload], { onConflict: 'id' });
    } catch {
      // Abaikan jika tabel conversations tidak dibuat atau kendala RLS guest
    }

    // 2. Siapkan payload pesan
    const msgPayload: Record<string, any> = {
      conversation_id: validConvId,
      role: role,
      content: text,
    };

    if (userId) {
      msgPayload.user_id = userId;
    }

    let { data, error } = await supabase
      .from('messages')
      .insert([msgPayload])
      .select();

    // Fallback jika nama kolom content menggunakan 'text'
    if (error && error.message?.includes('column "content" does not exist')) {
      const fallbackPayload: Record<string, any> = {
        conversation_id: validConvId,
        role: role,
        text: text,
      };
      if (userId) fallbackPayload.user_id = userId;
      const resFallback = await supabase.from('messages').insert([fallbackPayload]).select();
      data = resFallback.data;
      error = resFallback.error;
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Error tidak diketahui' };
  }
}

/**
 * Mengambil riwayat pesan dari tabel 'messages'
 */
export async function loadChatHistory(conversationId: string) {
  if (!conversationId || !hasValidConfig) return [];

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  } catch {
    return [];
  }
}

/**
 * Mengambil limit penggunaan AI dari tabel 'user_limits'
 */
export async function getUserLimits(userId: string) {
  try {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    const now = new Date();
    let used5h = Number(data.used_5h || 0);
    let usedWeekly = Number(data.used_weekly || 0);

    if (data.reset_5h_at && now > new Date(data.reset_5h_at)) {
      used5h = 0;
    }

    if (data.reset_weekly_at && now > new Date(data.reset_weekly_at)) {
      usedWeekly = 0;
    }

    return {
      used_5h: used5h,
      used_weekly: usedWeekly,
      remaining_5h: Math.max(0, 100 - used5h),
      remaining_weekly: Math.max(0, 100 - usedWeekly),
      reset_5h_at: data.reset_5h_at,
      reset_weekly_at: data.reset_weekly_at,
    };
  } catch {
    return null;
  }
}

/**
 * Mereset limit penggunaan AI di tabel 'user_limits'
 */
export async function resetUserLimits(userId: string) {
  try {
    if (!userId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) userId = authData.user.id;
      } catch {}
    }
    if (!userId) return false;

    const now = new Date();
    const reset5hAt = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
    const resetWeeklyAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      user_id: userId,
      used_5h: 0,
      reset_5h_at: reset5hAt,
      used_weekly: 0,
      reset_weekly_at: resetWeeklyAt,
    };

    const { error: updateErr } = await supabase
      .from('user_limits')
      .update({
        used_5h: 0,
        used_weekly: 0,
        reset_5h_at: reset5hAt,
        reset_weekly_at: resetWeeklyAt,
      })
      .eq('user_id', userId);

    const { error: upsertErr } = await supabase
      .from('user_limits')
      .upsert(payload, { onConflict: 'user_id' });

    try {
      await supabase.rpc('reset_ai_limit', { p_user_id: userId });
    } catch {}
    try {
      await supabase.rpc('reset_user_limits', { p_user_id: userId });
    } catch {}

    if (updateErr && upsertErr) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Default Models Mapping (Bluefox AI)
 */
export const DEFAULT_MODELS: Record<string, string> = {
  // Lineup Model Aktif
  "agnes-2.5-flash": "agnes-2.5-flash",
  "tencent-hy3-free": "jev",
  "tencent_hy3_free": "jev",
  "laguna-s-2.1": "laguna-s-2.1",
  "jev": "jev",

  // Nama Display & Aliases
  "bluefox-pro": "agnes-2.5-flash",
  "bluefox_pro": "agnes-2.5-flash",
  "bluefox-standard": "jev",
  "bluefox_standard": "jev",
  "bluefox_standar": "jev",
  "bluefox-dilo": "laguna-s-2.1",
  "bluefox_dilo": "laguna-s-2.1",
  "dilo": "laguna-s-2.1",
  "tmpa_v2": "jev",
  "tmpa_v1": "laguna-s-2.1",
  "longcat-2.0-free": "laguna-s-2.1",
  "deepseek-v4.1-flash-free": "agnes-2.5-flash",
  "agnes-2.0-flash": "agnes-2.5-flash",
};

/**
 * Standardized Model Display Names
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'bluefox pro';
  const clean = modelId.toLowerCase();
  if (clean.includes('pro') || clean.includes('agnes') || clean.includes('deepseek') || clean.includes('v2') || clean.includes('qwen')) {
    return 'bluefox pro';
  }
  if (clean.includes('jev') || clean.includes('tencent') || clean.includes('standard') || clean.includes('standar') || clean.includes('v1') || clean.includes('gpt')) {
    return 'bluefox standard';
  }
  if (clean.includes('laguna') || clean.includes('dilo') || clean.includes('longcat') || clean.includes('nemotron')) {
    return 'bluefox Dilo';
  }
  return 'bluefox pro';
}
