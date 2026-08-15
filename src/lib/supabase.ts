import { createClient } from '@supabase/supabase-js';
import { getActiveCustomApi } from './customApi';

const env = (import.meta as any).env || {};

// Mendukung semua format environment variable dari Integrasi Vercel + Supabase
const getEnvVar = (keys: string[]): string => {
  for (const k of keys) {
    if (env[k] && typeof env[k] === 'string' && env[k].trim() !== '') {
      return env[k].trim();
    }
  }
  if (typeof window !== 'undefined') {
    for (const k of keys) {
      const stored = window.localStorage.getItem(k) || (window as any)[k];
      if (stored && typeof stored === 'string' && stored.trim() !== '') {
        return stored.trim();
      }
    }
  }
  return '';
};

export const supabaseUrl: string = 
  getEnvVar(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'PUBLIC_SUPABASE_URL']) ||
  'https://jjlanjshpyklqayjzxyy.supabase.co';

export const supabaseKey: string = 
  getEnvVar([
    'VITE_SUPABASE_ANON_KEY', 
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_ANON_KEY', 
    'SUPABASE_KEY', 
    'VITE_SUPABASE_KEY', 
    'PUBLIC_SUPABASE_ANON_KEY'
  ]) || '';

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

export const exchangeSsoTicket = async (ticketId: string) => {
  // ⏳ JEDA 2 DETIK (2000 ms)
  // Memberi napas ke Supabase DB untuk memastikan tiket dari 'account' sudah ter-commit
  await delay(2000);

  // Use a single direct fetch to the Edge Function to prevent double execution on single-use tickets
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

export const signInWithGoogle = async () => {
  if (!hasValidConfig) {
    console.warn("Using mock Supabase config. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    return {
      session: {
        provider_token: "dummy_access_token_" + Date.now()
      }
    };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/presentations.readonly https://www.googleapis.com/auth/gmail.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  
  if (error) {
    throw error;
  }
  
  return data;
};

export const getSession = async () => {
    if (!hasValidConfig) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
};

// ==========================================
// A. Mendengarkan Pesan Masuk secara REALTIME
// ==========================================
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
          onNewMessage(newMessage);
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

// Helper untuk memastikan format UUID valid
export function getValidUUID(id?: string | null): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && uuidRegex.test(id)) {
    return id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================
// B. Fungsi Kirim Pesan (Insert ke tabel messages)
// ==========================================
export async function sendMessageToSupabase(
  text: string, 
  conversationId: string, 
  role: 'user' | 'assistant' = 'user'
) {
  if (!text.trim() || !conversationId) return { data: null, error: 'Input tidak valid' };
  if (!hasValidConfig) {
    console.log("ℹ️ [Supabase] Config anon key belum diatur, melewati sinkronisasi tabel messages.");
    return { data: null, error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const rawUserId = session?.user?.id;
    const userId = (rawUserId && typeof rawUserId === 'string' && rawUserId.trim() !== "") ? rawUserId.trim() : null;
    const validConvId = getValidUUID(conversationId);

    // 1. Pastikan record di tabel 'conversations' ada (dengan payload bersih)
    try {
      const convPayload: Record<string, any> = {
        id: validConvId,
        title: text.length > 40 ? text.substring(0, 40) + '...' : text,
        updated_at: new Date().toISOString(),
      };
      
      // Hanya masukkan user_id jika nilainya BENAR-BENAR ADA (bukan null/undefined/string kosong)
      if (userId) {
        convPayload.user_id = userId;
      }

      await supabase
        .from('conversations')
        .upsert([convPayload], { onConflict: 'id' });
    } catch {
      // Abaikan jika tabel conversations tidak dibuat
    }

    // 2. Siapkan payload pesan yang bersih
    const msgPayload: Record<string, any> = {
      conversation_id: validConvId,
      role: role,
      content: text,
    };

    // Hanya masukkan user_id jika nilainya BENAR-BENAR ADA
    if (userId) {
      msgPayload.user_id = userId;
    }

    console.log(`📤 [Supabase] Menginsert pesan (${role}) ke tabel messages:`, msgPayload);

    let { data, error } = await supabase
      .from('messages')
      .insert([msgPayload])
      .select();

    // Fallback jika nama kolom content menggunakan text atau message
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
      console.warn('⚠️ Gagal insert pesan ke tabel messages (cek RLS/Permissions):', error.message);
      return { data: null, error: error.message };
    }

    console.log('✅ Berhasil insert pesan ke tabel messages:', data);
    return { data, error: null };
  } catch (err: any) {
    console.warn('⚠️ Exception sendMessageToSupabase:', err?.message || err);
    return { data: null, error: err?.message || 'Error tidak diketahui' };
  }
}

// ==========================================
// C. Ambil Riwayat Chat Saat Pertama Kali Buka Web
// ==========================================
export async function loadChatHistory(conversationId: string) {
  if (!conversationId || !hasValidConfig) return [];

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Gagal memuat histori messages:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('Exception loadChatHistory:', err);
    return [];
  }
}

// ==========================================
// D. Helper Pembuatan Conversation Bersih
// ==========================================
export async function createConversation(title: string = 'Chat Baru', customId?: string) {
  if (!hasValidConfig) return { data: null, error: null };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const rawUserId = session?.user?.id;
    const userId = (rawUserId && typeof rawUserId === 'string' && rawUserId.trim() !== "") ? rawUserId.trim() : null;

    const payload: Record<string, any> = {
      title: title.trim() || 'Chat Baru',
    };

    if (customId && customId.trim() !== "") {
      payload.id = getValidUUID(customId);
    }

    // Hanya masukkan user_id jika nilainya BENAR-BENAR ADA (bukan null/undefined/string kosong)
    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) {
      console.warn("Gagal buat conversation:", error.message);
    }

    return { data, error };
  } catch (err: any) {
    console.warn("Exception createConversation:", err);
    return { data: null, error: err?.message || 'Error' };
  }
}

// ==========================================
// E. Panggil Edge Function 'bluefox-processor-'
// URL: https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-
// ==========================================
export const MODEL_MAPPING: Record<string, string> = {
  tmpa_v2: "agnes-2.0-flash", // Support Vision
  tmpa_v1: "laguna-s-2.1",
  dilo: "tencent-hy3-free",
  "agnes-2.0-flash": "agnes-2.0-flash",
  "laguna-s-2.1": "laguna-s-2.1",
  "tencent-hy3-free": "tencent-hy3-free",
  qwen3_coder: "agnes-2.0-flash",
  gpt_oss: "laguna-s-2.1",
  mistral_nemotron: "tencent-hy3-free",
};

export async function invokeBluefoxProcessor(
  message: string,
  conversationId?: string | null,
  model?: string,
  isVisionActive?: boolean,
  imageUrl?: string | null
) {
  try {
    // Pastikan conversation_id bernilai null jika string kosong atau tidak ada
    const cleanConvId = (conversationId && typeof conversationId === 'string' && conversationId.trim() !== "")
      ? conversationId.trim()
      : null;

    // Determinasi model:
    // 1. Jika ada Custom API aktif -> Gunakan Model ID dari Custom API
    // 2. Jika Vision Aktif -> Kunci paksa ke 'agnes-2.0-flash'
    // 3. Jika Vision Matikan -> Gunakan model pilihan user
    const activeCustomApi = getActiveCustomApi();
    const selectedKey = model || 'tmpa_v2';
    const finalModel = activeCustomApi
      ? activeCustomApi.model
      : isVisionActive 
        ? MODEL_MAPPING.tmpa_v2 
        : (MODEL_MAPPING[selectedKey] || selectedKey || MODEL_MAPPING.tmpa_v2);

    const requestBody: Record<string, any> = {
      message: message.trim(),
      conversation_id: cleanConvId,
      model: finalModel,
      is_vision: Boolean(isVisionActive),
      vision: Boolean(isVisionActive),
      image_url: imageUrl || null,
    };

    if (activeCustomApi) {
      requestBody.custom_api = {
        name: activeCustomApi.name,
        provider: activeCustomApi.provider,
        base_url: activeCustomApi.baseUrl,
        api_key: activeCustomApi.apiKey,
        model: activeCustomApi.model,
      };
      requestBody.custom_model = activeCustomApi.model;
      requestBody.provider = activeCustomApi.provider;
      requestBody.base_url = activeCustomApi.baseUrl;
      requestBody.api_key = activeCustomApi.apiKey;
    }

    console.log("📤 [Supabase Edge Function] Mengirim request ke 'bluefox-processor-':", requestBody);

    // 1. Coba melalui supabase.functions.invoke dengan nama endpoint 'bluefox-processor-'
    try {
      const { data, error } = await supabase.functions.invoke('bluefox-processor-', {
        body: requestBody,
      });

      if (error) {
        console.error("❌ [Supabase SDK Error]:", error);
      } else if (data) {
        console.log("📥 [Supabase Edge Function] Respons diterima (SDK):", data);

        // Jika Edge Function mengirim balasan error (misal: success === false atau ada error field)
        if (data.success === false || data.error) {
          console.error("❌ Detail Error Asli dari Server:", data.error || data.message);
          return {
            data: {
              success: false,
              error: data.error || data.message || 'Error tidak diketahui dari server',
              reply: '',
              conversation_id: cleanConvId,
              ...data,
            },
            error: data.error || data.message || 'Server error',
          };
        }

        const replyText = data?.reply || data?.text || data?.message || data?.response || (typeof data === 'string' ? data : '');
        const nextConvId = data?.conversation_id || data?.conversationId || cleanConvId;

        return {
          data: {
            success: true,
            reply: replyText,
            conversation_id: nextConvId,
            ...data,
          },
          error: null,
        };
      }
    } catch (invokeErr) {
      console.warn("⚠️ [Supabase Edge Function] SDK invoke exception, mencoba fallback HTTP:", invokeErr);
    }

    // 2. Fallback: direct HTTP POST ke full URL https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-
    const functionUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/bluefox-processor-`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;

    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ [Edge Function] Direct fetch status ${res.status}:`, errText);
      return {
        data: {
          success: false,
          error: `Edge Function HTTP ${res.status}: ${errText}`,
          reply: '',
          conversation_id: cleanConvId,
        },
        error: `Edge Function error (${res.status}): ${errText}`,
      };
    }

    const resData = await res.json();
    console.log("📥 [Supabase Edge Function] Respons diterima (Direct Fetch):", resData);

    if (resData.success === false || resData.error) {
      console.error("❌ Detail Error Asli dari Server (Fetch):", resData.error || resData.message);
      return {
        data: {
          success: false,
          error: resData.error || resData.message || 'Error dari server',
          reply: '',
          conversation_id: cleanConvId,
          ...resData,
        },
        error: resData.error || resData.message,
      };
    }

    const replyText = resData?.reply || resData?.text || resData?.message || resData?.response || (typeof resData === 'string' ? resData : '');
    const nextConvId = resData?.conversation_id || resData?.conversationId || cleanConvId;

    return {
      data: {
        success: true,
        reply: replyText,
        conversation_id: nextConvId,
        ...resData,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('❌ Exception invokeBluefoxProcessor:', err);
    return { data: null, error: err?.message || 'Error Edge Function' };
  }
}

// ==========================================
// F. Manajemen Limit Penggunaan AI (user_limits)
// ==========================================
export type AiModelCode = 'v2_vision' | 'v2_non_vision' | 'v1' | 'dilo';

export function getModelLimitCode(model: string, isVision?: boolean): AiModelCode {
  if (isVision) return 'v2_vision';
  if (model === 'agnes-2.0-flash' || model === 'tmpa_v2' || model === 'qwen3_coder') {
    return 'v2_non_vision';
  }
  if (model === 'tencent-hy3-free' || model === 'tmpa_v1' || model === 'gpt_oss') {
    return 'v1';
  }
  if (model === 'laguna-s-2.1' || model === 'dilo' || model === 'mistral_nemotron') {
    return 'dilo';
  }
  return 'v1';
}

export async function getUserLimits(userId: string) {
  try {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn("⚠️ Gagal mengambil user_limits:", error.message);
      return null;
    }

    if (!data) return null;

    const now = new Date();
    let used5h = Number(data.used_5h || 0);
    let usedWeekly = Number(data.used_weekly || 0);

    // Cek apakah waktu reset 5 jam telah lewat
    if (data.reset_5h_at && now > new Date(data.reset_5h_at)) {
      used5h = 0;
    }

    // Cek apakah waktu reset mingguan telah lewat
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
  } catch (err) {
    console.warn("Exception getUserLimits:", err);
    return null;
  }
}

export async function consumeAiLimit(userId: string, modelCode: AiModelCode) {
  try {
    if (!userId) {
      console.warn("User ID tidak ditemukan untuk consumeAiLimit");
      return { success: true, remaining_5h: 100, remaining_weekly: 100, used_5h: 0, used_weekly: 0 };
    }

    console.log(`📊 [Limit] Mengonsumsi limit untuk user ${userId} model ${modelCode}`);

    // 1. Coba panggil RPC Supabase 'consume_ai_limit'
    try {
      const { data, error } = await supabase.rpc('consume_ai_limit', {
        p_user_id: userId,
        p_model: modelCode,
      });

      if (!error && data) {
        console.log("📥 [RPC consume_ai_limit] Sukses:", data);
        if (data.success === false) {
          return {
            success: false,
            message: data.message || "Batas kuota penggunaan AI Anda telah habis. Harap tunggu waktu reset.",
            remaining_5h: data.remaining_5h ?? 0,
            remaining_weekly: data.remaining_weekly ?? 0,
            used_5h: data.used_5h ?? 100,
            used_weekly: data.used_weekly ?? 100,
          };
        }

        const remaining5h = data.remaining_5h ?? Math.max(0, 100 - Number(data.used_5h || 0));
        const remainingWeekly = data.remaining_weekly ?? Math.max(0, 100 - Number(data.used_weekly || 0));

        console.log(`Sisa 5-Jam: ${remaining5h}%, Sisa Mingguan: ${remainingWeekly}%`);

        return {
          success: true,
          remaining_5h: remaining5h,
          remaining_weekly: remainingWeekly,
          used_5h: Number(data.used_5h ?? (100 - remaining5h)),
          used_weekly: Number(data.used_weekly ?? (100 - remainingWeekly)),
        };
      }
      if (error) {
        console.warn("⚠️ RPC consume_ai_limit tidak tersedia atau error, menjalankan fallback tabel user_limits:", error.message);
      }
    } catch (rpcErr) {
      console.warn("⚠️ Exception RPC consume_ai_limit, fallback ke tabel user_limits:", rpcErr);
    }

    // 2. Fallback: Langsung update tabel 'public.user_limits'
    let add5h = 12;
    let addWeekly = 9;
    if (modelCode === 'v2_vision') {
      add5h = 19;
      addWeekly = 14;
    } else if (modelCode === 'v2_non_vision') {
      add5h = 13;
      addWeekly = 10;
    } else if (modelCode === 'v1') {
      add5h = 12;
      addWeekly = 9;
    } else if (modelCode === 'dilo') {
      add5h = 8;
      addWeekly = 6;
    }

    const { data: existingRow, error: selectErr } = await supabase
      .from('user_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') {
      console.error("❌ Gagal membaca user_limits:", selectErr);
    }

    const now = new Date();
    let currentUsed5h = 0;
    let currentUsedWeekly = 0;
    let reset5hAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    let resetWeeklyAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (existingRow) {
      currentUsed5h = Number(existingRow.used_5h || 0);
      currentUsedWeekly = Number(existingRow.used_weekly || 0);
      reset5hAt = existingRow.reset_5h_at || reset5hAt;
      resetWeeklyAt = existingRow.reset_weekly_at || resetWeeklyAt;

      // Cek apakah periode 5 jam sudah reset
      if (existingRow.reset_5h_at && now > new Date(existingRow.reset_5h_at)) {
        currentUsed5h = 0;
        reset5hAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      }

      // Cek apakah periode mingguan sudah reset
      if (existingRow.reset_weekly_at && now > new Date(existingRow.reset_weekly_at)) {
        currentUsedWeekly = 0;
        resetWeeklyAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const nextUsed5h = currentUsed5h + add5h;
    const nextUsedWeekly = currentUsedWeekly + addWeekly;

    if (nextUsed5h > 100 || nextUsedWeekly > 100) {
      const remaining5h = Math.max(0, 100 - currentUsed5h);
      const remainingWeekly = Math.max(0, 100 - currentUsedWeekly);
      console.log(`Sisa 5-Jam: ${remaining5h}%, Sisa Mingguan: ${remainingWeekly}% (Limit Tercapai)`);
      return {
        success: false,
        message: "Batas kuota penggunaan AI Anda telah habis. Harap tunggu waktu reset.",
        remaining_5h: remaining5h,
        remaining_weekly: remainingWeekly,
        used_5h: currentUsed5h,
        used_weekly: currentUsedWeekly,
      };
    }

    // Update / Insert row baru
    const payload = {
      user_id: userId,
      used_5h: nextUsed5h,
      reset_5h_at: reset5hAt,
      used_weekly: nextUsedWeekly,
      reset_weekly_at: resetWeeklyAt,
    };

    const { error: upsertErr } = await supabase
      .from('user_limits')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error("❌ Gagal update tabel user_limits:", upsertErr);
    } else {
      console.log("✅ Tabel user_limits berhasil diperbarui:", payload);
    }

    const remaining5h = Math.max(0, 100 - nextUsed5h);
    const remainingWeekly = Math.max(0, 100 - nextUsedWeekly);
    console.log(`Sisa 5-Jam: ${remaining5h}%, Sisa Mingguan: ${remainingWeekly}%`);

    return {
      success: true,
      remaining_5h: remaining5h,
      remaining_weekly: remainingWeekly,
      used_5h: nextUsed5h,
      used_weekly: nextUsedWeekly,
    };
  } catch (err: any) {
    console.error("❌ Exception consumeAiLimit:", err);
    return { success: true, remaining_5h: 100, remaining_weekly: 100, used_5h: 0, used_weekly: 0 };
  }
}



