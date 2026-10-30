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
export const BLUEFOX_MODELS = [
  {
    id: "bluefox-dilo",
    name: "Bluefox Dilo",
    upstreamModel: "deepseek-v4.1-flash-free",
    description: "Cepat dan efisien untuk interaksi harian"
  },
  {
    id: "bluefox-standard",
    name: "Bluefox Standard",
    upstreamModel: "agnes-2.5-flash",
    description: "Model standar yang stabil dan serbaguna"
  },
  {
    id: "bluefox-pro",
    name: "Bluefox Pro",
    upstreamModel: "agnes-3.0-flash",
    description: "Model flagship dengan kemampuan vision dan pemrosesan tinggi"
  }
];

export async function invokeBluefoxProcessor(payload: any, signal?: AbortSignal) {
  const edgeFunctionUrl = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-';
  const anonKey = supabaseKey || (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zXY2aPqOnPt7j1QKdoZFxQ_x6rOon0U';

  // Pastikan ID model selalu terisi sesuai spesifikasi Edge Function:
  // 1. Bluefox Pro --> agnes-3.0-flash
  // 2. Bluefox Standard --> agnes-2.5-flash
  // 3. Bluefox Dilo --> deepseek-v4.1-flash-free
  const safePayload: any = { ...(payload || {}) };

  // Deteksi apakah request ini untuk 3 model bawaan Bluefox
  const isBluefoxModel = 
    safePayload.is_bluefox_native === true ||
    safePayload.isBluefoxNative === true ||
    safePayload.model === 'agnes-3.0-flash' || 
    safePayload.model === 'agnes-2.5-flash' || 
    safePayload.model === 'deepseek-v4.1-flash-free' || 
    safePayload.model === 'jev' || 
    safePayload.model === 'laguna-s-2.1' ||
    safePayload.model === 'tencent-hy3-free' ||
    safePayload.model_id === 'agnes-3.0-flash' || 
    safePayload.model_id === 'agnes-2.5-flash' || 
    safePayload.model_id === 'deepseek-v4.1-flash-free' || 
    safePayload.model_id === 'jev' || 
    safePayload.model_id === 'laguna-s-2.1' ||
    safePayload.model_id === 'tencent-hy3-free' ||
    safePayload.selected_model === 'agnes-3.0-flash' ||
    safePayload.selected_model === 'agnes-2.5-flash' ||
    safePayload.selected_model === 'deepseek-v4.1-flash-free' ||
    safePayload.selected_model === 'tencent-hy3-free' ||
    safePayload.selected_model === 'laguna-s-2.1';

  // Selalu bersihkan field custom API dan gunakan native Bluefox model
  delete safePayload.api_id;
  delete safePayload.apiId;
  delete safePayload.target_api_id;
  delete safePayload.targetApiId;
  delete safePayload.API_ID;
  delete safePayload.target_api;
  delete safePayload.targetApi;
  delete safePayload.customApi;
  delete safePayload.custom_api;
  delete safePayload.custom_api_id;

  // Normalisasi ID model resmi
  let normalized = 'agnes-3.0-flash';
  const m = (safePayload.model_id || safePayload.model || safePayload.selected_model || '').toLowerCase();
  if (m.includes('dilo') || m.includes('deepseek') || m.includes('laguna')) {
    normalized = 'deepseek-v4.1-flash-free';
  } else if (m.includes('2.5') || m.includes('standard') || m.includes('standar') || m.includes('tencent') || m.includes('jev')) {
    normalized = 'agnes-2.5-flash';
  } else {
    normalized = 'agnes-3.0-flash';
  }

  safePayload.is_bluefox_native = true;
  safePayload.isBluefoxNative = true;
  safePayload.model = normalized;
  safePayload.model_id = normalized;
  safePayload.modelId = normalized;
  safePayload.id_model = normalized;
  safePayload.resolved_model = normalized;
  safePayload.resolvedModel = normalized;

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
  const payloadString = JSON.stringify(safePayload);
  console.log('[EDGE FUNCTION DISPATCH]', {
    endpoint: edgeFunctionUrl,
    keys: Object.keys(safePayload),
    bodySizeBytes: new Blob([payloadString]).size,
    sample: payloadString.slice(0, 350)
  });

  const executeRequest = async (tokenToUse: string) => {
    return await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${tokenToUse}`,
      },
      body: payloadString,
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

/**
 * Mendengarkan pesan baru secara Realtime pada tabel message_bluefox
 * untuk sinkronisasi dua arah Web <-> Telegram Bot
 */
export function listenToBluefoxSessionMessages(
  sessionId: string,
  onNewMessageTurn: (row: any) => void
) {
  const validSessionId = getValidUUID(sessionId);
  if (!validSessionId || !hasValidConfig) return () => {};

  try {
    const channel = supabase
      .channel(`bluefox_msg_${validSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_bluefox',
          filter: `session_id=eq.${validSessionId}`
        },
        (payload) => {
          const row = payload.new;
          if (row) {
            onNewMessageTurn(row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Gagal subscribe realtime message_bluefox:', err);
    return () => {};
  }
}

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
 * Mengambil limit penggunaan AI langsung dari tabel 'user_limits' di Supabase
 */
export async function getUserLimits(userId: string) {
  try {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn("Info query user_limits:", error.message);
      return null;
    }

    const now = new Date();

    // Jika belum ada row di public.user_limits, buatkan row default baru (0% used)
    if (!data) {
      try {
        const reset5hAt = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
        const resetWeeklyAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('user_limits').insert([{
          user_id: userId,
          is_dev_mode: isLocalDevMode(),
          used_5h: 0.00,
          reset_5h_at: reset5hAt,
          used_weekly: 0.00,
          reset_weekly_at: resetWeeklyAt
        }]);
      } catch (insertErr) {
        console.warn("Info auto-create user_limits:", insertErr);
      }

      return {
        used_5h: 0,
        used_weekly: 0,
        remaining_5h: 100,
        remaining_weekly: 100,
        is_dev_mode: isLocalDevMode(),
        reset_5h_at: null,
        reset_weekly_at: null,
      };
    }

    // Jika is_dev_mode bernilai true di database, aktifkan dev mode lokal
    if (data.is_dev_mode === true) {
      setLocalDevMode(true);
    }

    let used5h = Number(data.used_5h || 0);
    let usedWeekly = Number(data.used_weekly || 0);

    let needsUpdate = false;
    const updatePayload: Record<string, any> = {};

    // Cek apakah window 5 jam sudah terlewati
    if (data.reset_5h_at && now > new Date(data.reset_5h_at)) {
      used5h = 0;
      updatePayload.used_5h = 0.00;
      updatePayload.reset_5h_at = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
      needsUpdate = true;
    }

    // Cek apakah window mingguan sudah terlewati
    if (data.reset_weekly_at && now > new Date(data.reset_weekly_at)) {
      usedWeekly = 0;
      updatePayload.used_weekly = 0.00;
      updatePayload.reset_weekly_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      supabase.from('user_limits').update(updatePayload).eq('user_id', userId).then(() => {}, () => {});
    }

    return {
      used_5h: used5h,
      used_weekly: usedWeekly,
      remaining_5h: Math.max(0, 100 - used5h),
      remaining_weekly: Math.max(0, 100 - usedWeekly),
      is_dev_mode: Boolean(data.is_dev_mode),
      reset_5h_at: data.reset_5h_at,
      reset_weekly_at: data.reset_weekly_at,
    };
  } catch (err) {
    console.warn("getUserLimits catch:", err);
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
  "agnes-3.0-flash": "agnes-3.0-flash",
  "agnes-2.5-flash": "agnes-2.5-flash",
  "deepseek-v4.1-flash-free": "deepseek-v4.1-flash-free",

  // Nama Display & Aliases
  "bluefox-pro": "agnes-3.0-flash",
  "bluefox_pro": "agnes-3.0-flash",
  "pro": "agnes-3.0-flash",
  "bluefox-standard": "agnes-2.5-flash",
  "bluefox_standard": "agnes-2.5-flash",
  "bluefox_standar": "agnes-2.5-flash",
  "standard": "agnes-2.5-flash",
  "jev": "agnes-2.5-flash",
  "tencent-hy3-free": "agnes-2.5-flash",
  "bluefox-dilo": "deepseek-v4.1-flash-free",
  "bluefox_dilo": "deepseek-v4.1-flash-free",
  "dilo": "deepseek-v4.1-flash-free",
  "laguna-s-2.1": "deepseek-v4.1-flash-free",
};

/**
 * Standardized Model Display Names
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'bluefox pro';
  const clean = modelId.toLowerCase();
  if (clean.includes('dilo') || clean.includes('deepseek') || clean.includes('laguna') || clean.includes('nemotron')) {
    return 'bluefox Dilo';
  }
  if (clean.includes('2.5') || clean.includes('standard') || clean.includes('standar') || clean.includes('jev') || clean.includes('tencent')) {
    return 'bluefox standard';
  }
  if (clean.includes('3.0') || clean.includes('pro') || clean.includes('agnes') || clean.includes('v2')) {
    return 'bluefox pro';
  }
  return 'bluefox pro';
}

/**
 * Pengecekan status Mode Development / No Limit dari localStorage
 */
export function isLocalDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('tmpa_dev_mode') === 'true';
  } catch {
    return false;
  }
}

/**
 * Menyimpan status Mode Development / No Limit ke localStorage
 */
export function setLocalDevMode(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      localStorage.setItem('tmpa_dev_mode', 'true');
    } else {
      localStorage.removeItem('tmpa_dev_mode');
    }
  } catch {}
}

/**
 * Menukarkan Invite Code untuk mengaktifkan Development Mode / No Limit
 * Memanggil RPC Supabase: redeem_invite_code(p_user_id, p_code)
 */
export async function redeemInviteCode(userId: string, code: string): Promise<{ success: boolean; message?: string }> {
  try {
    if (!userId) {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id || '';
    }

    if (!userId) {
      return { success: false, message: 'Silakan login terlebih dahulu!' };
    }

    const trimmedCode = (code || '').trim().toUpperCase();
    if (!trimmedCode) {
      return { success: false, message: 'Kode undangan tidak boleh kosong.' };
    }

    // Panggil fungsi RPC Supabase
    const { data, error } = await supabase.rpc('redeem_invite_code', {
      p_user_id: userId,
      p_code: trimmedCode
    });

    if (error) {
      return { 
        success: false, 
        message: error.message || 'Gagal memproses kode undangan di server.' 
      };
    }

    // Tangani struktur respons boolean atau objek dari RPC Supabase
    if (typeof data === 'boolean') {
      if (data) {
        setLocalDevMode(true);
        return { success: true, message: 'Berhasil! Mode Development / No Limit diaktifkan di perangkat ini.' };
      } else {
        return { success: false, message: 'Kode undangan tidak valid atau sudah pernah digunakan.' };
      }
    }

    if (data?.success === false) {
      return { 
        success: false, 
        message: data.message || 'Kode undangan tidak valid atau sudah pernah digunakan.' 
      };
    }

    // Sukses: simpan ke localStorage
    setLocalDevMode(true);
    return {
      success: true,
      message: data?.message || 'Berhasil! Mode Development / No Limit diaktifkan di perangkat ini.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Terjadi kesalahan saat memvalidasi kode undangan.'
    };
  }
}

/**
 * Pengecekan dan pemotongan batas penggunaan AI langsung ke tabel 'public.user_limits' di Supabase
 */
export async function consumeAiLimit(
  userId?: string, 
  model: string = 'v2_non_vision', 
  isVision: boolean = false,
  searchMode?: 'standard' | 'advanced' | 'map_standard' | 'map_advanced'
): Promise<{ 
  success: boolean; 
  isLimitExceeded?: boolean; 
  isDevMode?: boolean; 
  message?: string; 
  remaining_5h?: number; 
  remaining_weekly?: number;
  used_5h?: number;
  used_weekly?: number;
}> {
  try {
    // 1. Cek apakah Mode Development / No Limit aktif di perangkat lokal user
    if (isLocalDevMode()) {
      console.log('Mode Development aktif (No Limit). Melewati pengecekan kuota.');
      return { success: true, isDevMode: true, message: 'Mode Development aktif (No Limit).' };
    }

    // 2. Ambil UUID user jika belum disediakan
    let userUuid = userId;
    if (!userUuid) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      userUuid = authUser?.id;
    }

    if (!userUuid) {
      // Jika guest atau tidak ada sesi auth, jangan blokir
      return { success: true, message: 'Guest session' };
    }

    // 3. Cek langsung ke tabel public.user_limits
    const { data: row, error: tableErr } = await supabase
      .from('user_limits')
      .select('*')
      .eq('user_id', userUuid)
      .maybeSingle();

    if (tableErr) {
      console.warn("Info query tabel user_limits:", tableErr.message);
    }

    // 4. Jika is_dev_mode aktif di tabel, sinkronkan ke local dan bebaskan batas kuota
    if (row?.is_dev_mode === true) {
      setLocalDevMode(true);
      return { success: true, isDevMode: true, message: 'Mode Development aktif (No Limit).' };
    }

    const now = new Date();
    let current5h = Number(row?.used_5h || 0);
    let currentWeekly = Number(row?.used_weekly || 0);

    // Cek apakah window 5 jam atau mingguan sudah lewat waktu reset
    if (row?.reset_5h_at && now > new Date(row.reset_5h_at)) {
      current5h = 0;
    }
    if (row?.reset_weekly_at && now > new Date(row.reset_weekly_at)) {
      currentWeekly = 0;
    }

    // 5. Cek apakah kuota BENAR-BENAR sudah habis (>= 100%) di tabel public.user_limits
    if (current5h >= 100) {
      return {
        success: false,
        isLimitExceeded: true,
        message: 'Batas penggunaan 5 jam Anda telah habis (100%).',
        used_5h: current5h,
        used_weekly: currentWeekly,
        remaining_5h: 0,
        remaining_weekly: Math.max(0, 100 - currentWeekly)
      };
    }

    if (currentWeekly >= 100) {
      return {
        success: false,
        isLimitExceeded: true,
        message: 'Batas penggunaan mingguan Anda telah habis (100%).',
        used_5h: current5h,
        used_weekly: currentWeekly,
        remaining_5h: Math.max(0, 100 - current5h),
        remaining_weekly: 0
      };
    }

    // 6. Hitung persentase potongan kuota sesuai aturan model & search
    let delta5h = 0;
    let deltaWeekly = 0;

    const m = (model || '').toLowerCase();
    if (m.includes('dilo') || m.includes('deepseek') || m.includes('laguna')) {
      delta5h = 2; // Bluefox dilo: 5 jam: 2%, seminggu: 2%
      deltaWeekly = 2;
    } else if (m.includes('2.5') || m.includes('standard') || m.includes('standar') || m.includes('tencent') || m.includes('jev') || m.includes('v1')) {
      delta5h = 2; // Bluefox standard: 5 jam: 2%, seminggu: 3%
      deltaWeekly = 3;
    } else {
      // Bluefox pro (agnes-3.0-flash / default)
      if (isVision) {
        delta5h = 5; // Bluefox pro vision: 5 jam: 5%, seminggu: 7%
        deltaWeekly = 7;
      } else {
        delta5h = 3; // Bluefox pro standard: 5 jam: 3%, seminggu: 4%
        deltaWeekly = 4;
      }
    }

    if (searchMode) {
      if (searchMode === 'advanced') {
        delta5h += 5;
        deltaWeekly += 3;
      } else if (searchMode === 'standard') {
        delta5h += 3;
        deltaWeekly += 2;
      } else if (searchMode === 'map_advanced') {
        delta5h += 7;
        deltaWeekly += 4;
      } else if (searchMode === 'map_standard') {
        delta5h += 6;
        deltaWeekly += 3;
      }
    }

    const next5h = Math.min(100, Number((current5h + delta5h).toFixed(2)));
    const nextWeekly = Math.min(100, Number((currentWeekly + deltaWeekly).toFixed(2)));

    const reset5hAt = (row?.reset_5h_at && now <= new Date(row.reset_5h_at))
      ? row.reset_5h_at 
      : new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
    const resetWeeklyAt = (row?.reset_weekly_at && now <= new Date(row.reset_weekly_at))
      ? row.reset_weekly_at 
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 7. Simpan langsung pembaruan ke tabel public.user_limits
    try {
      await supabase
        .from('user_limits')
        .upsert({
          user_id: userUuid,
          used_5h: next5h,
          used_weekly: nextWeekly,
          reset_5h_at: reset5hAt,
          reset_weekly_at: resetWeeklyAt,
          is_dev_mode: false
        }, { onConflict: 'user_id' });
    } catch (saveErr) {
      console.warn("Info simpan pemotongan kuota ke user_limits:", saveErr);
    }

    // Panggil RPC jika ada untuk sinkronisasi server-side (abaikan error jika RPC tidak ada)
    try {
      let rpcModel: 'v2_vision' | 'v2_non_vision' | 'v1' | 'dilo' = isVision ? 'v2_vision' : 'v2_non_vision';
      if (m.includes('dilo') || m.includes('deepseek') || m.includes('laguna')) rpcModel = 'dilo';
      else if (m.includes('2.5') || m.includes('standard') || m.includes('standar') || m.includes('tencent') || m.includes('jev') || m.includes('v1')) rpcModel = 'v1';
      supabase.rpc('consume_ai_limit', { p_user_id: userUuid, p_model: rpcModel }).then(() => {}, () => {});
    } catch {}

    return {
      success: true,
      used_5h: next5h,
      used_weekly: nextWeekly,
      remaining_5h: Math.max(0, 100 - next5h),
      remaining_weekly: Math.max(0, 100 - nextWeekly)
    };
  } catch (err: any) {
    console.warn("consumeAiLimit error fallback:", err);
    // Jangan blokir pesan AI hanya karena kendala jaringan
    return { success: true, message: 'Proceed with chat' };
  }
}

export { redeemStleyCode } from './styleManager';
