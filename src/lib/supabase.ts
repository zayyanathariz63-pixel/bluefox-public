import { createClient } from '@supabase/supabase-js';
import { getActiveCustomApi } from './customApi';
import { SUPABASE_CONFIG, getEnvAny } from './env';

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
  bluefox_pro: "agnes-2.0-flash", // bluefox pro (Supports Vision)
  bluefox_standard: "tencent-hy3-free", // bluefox standard
  bluefox_dilo: "laguna-s-2.1", // bluefox Dilo
  tmpa_v2: "agnes-2.0-flash",
  tmpa_v1: "tencent-hy3-free",
  dilo: "laguna-s-2.1",
  "agnes-2.0-flash": "agnes-2.0-flash",
  "laguna-s-2.1": "laguna-s-2.1",
  "tencent-hy3-free": "tencent-hy3-free",
  qwen3_coder: "agnes-2.0-flash",
  gpt_oss: "tencent-hy3-free",
  mistral_nemotron: "laguna-s-2.1",
};

export async function invokeBluefoxProcessor(
  message: string,
  conversationId?: string | null,
  model?: string,
  isVisionActive?: boolean,
  imageUrl?: string | string[] | null,
  abortSignal?: AbortSignal
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

    const primaryImageUrl = Array.isArray(imageUrl) ? (imageUrl[0] || null) : (imageUrl || null);
    const mediaUrls = Array.isArray(imageUrl) ? imageUrl : (imageUrl ? [imageUrl] : []);
    const videoUrls = mediaUrls.filter(u => typeof u === 'string' && (u.startsWith('data:video') || u.includes('.mp4') || u.includes('.webm') || u.includes('.mov')));
    const primaryVideoUrl = videoUrls.length > 0 ? videoUrls[0] : null;

    const requestBody: Record<string, any> = {
      message: message.trim(),
      prompt: message.trim(),
      input: message.trim(),
      query: message.trim(),
      conversation_id: cleanConvId,
      conversationId: cleanConvId,
      sessionId: cleanConvId,
      model: finalModel,
      is_vision: Boolean(isVisionActive),
      vision: Boolean(isVisionActive),
      image_url: primaryImageUrl,
      images: mediaUrls,
      media_urls: mediaUrls,
      video_url: primaryVideoUrl,
      videos: videoUrls,
      media: mediaUrls,
      file_urls: mediaUrls,
      attachments: mediaUrls,
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

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;
    const baseEndpoint = (supabaseUrl || 'https://jjlanjshpyklqayjzxyy.supabase.co').replace(/\/+$/, '');
    
    // Coba endpoint URL spesifik yang diberikan user
    const urlsToTry = [
      `${baseEndpoint}/functions/v1/bluefox-processor-`,
      `${baseEndpoint}/functions/v1/bluefox-processor`
    ];

    let lastError: any = null;

    for (const fnUrl of urlsToTry) {
      if (abortSignal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      try {
        console.log(`📡 Memanggil Edge Function di: ${fnUrl}`);
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requestBody),
          signal: abortSignal,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`⚠️ [Edge Function] HTTP ${res.status} dari ${fnUrl}:`, errText);
          lastError = `Edge Function HTTP ${res.status}: ${errText}`;
          continue;
        }

        let resData: any = null;
        const contentType = res.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          resData = await res.json().catch(() => null);
        } else {
          const rawText = await res.text().catch(() => '');
          try {
            resData = JSON.parse(rawText);
          } catch {
            resData = { reply: rawText };
          }
        }
        
        console.log("📥 [Supabase Edge Function] Respons diterima:", resData);

        if (!resData) {
          lastError = "Respon kosong dari server";
          continue;
        }

        if (resData.success === false || resData.error) {
          console.warn("⚠️ Error dari Edge Function:", resData.error || resData.message);
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

        let replyText = resData?.reply ?? 
          resData?.text ?? 
          (typeof resData?.message === 'string' ? resData?.message : resData?.message?.content ?? resData?.message?.text) ??
          resData?.response ?? 
          resData?.content ?? 
          resData?.output ?? 
          resData?.result ?? 
          resData?.answer ??
          resData?.summary ??
          resData?.description ??
          resData?.video_analysis ??
          resData?.output_text ??
          resData?.generated_text ??
          resData?.data?.reply ?? 
          resData?.data?.text ?? 
          resData?.data?.content ?? 
          resData?.data?.response ??
          resData?.data?.result ??
          resData?.data?.output ?? 
          resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? 
          resData?.candidates?.[0]?.text ??
          resData?.choices?.[0]?.message?.content ?? 
          resData?.choices?.[0]?.text ??
          resData?.choices?.[0]?.delta?.content ??
          (typeof resData === 'string' ? resData : '');

        if (typeof replyText !== 'string' && replyText) {
          try {
            replyText = JSON.stringify(replyText);
          } catch {}
        }

        const nextConvId = resData?.conversation_id || resData?.conversationId || cleanConvId;

        if (replyText && typeof replyText === 'string' && replyText.trim().length > 0) {
          return {
            data: {
              success: true,
              reply: replyText.trim(),
              conversation_id: nextConvId,
              ...resData,
            },
            error: null,
          };
        }
        lastError = "Teks balasan tidak ditemukan pada respon";
      } catch (fErr: any) {
        if (fErr.name === 'AbortError') throw fErr;
        console.warn(`⚠️ Gagal direct fetch ke ${fnUrl}:`, fErr?.message);
        lastError = fErr?.message;
      }
    }

    // 2. Jika direct fetch gagal, coba melalui supabase.functions.invoke
    try {
      if (abortSignal?.aborted) throw new DOMException('Request aborted', 'AbortError');

      const { data, error } = await supabase.functions.invoke('bluefox-processor-', {
        body: requestBody,
      });

      if (!error && data) {
        console.log("📥 [Supabase Edge Function] Respons diterima (SDK):", data);
        if (data.success === false || data.error) {
          return {
            data: {
              success: false,
              error: data.error || data.message || 'Error tidak diketahui',
              reply: '',
              conversation_id: cleanConvId,
              ...data,
            },
            error: data.error || data.message,
          };
        }

        const replyText = data?.reply || data?.text || data?.message || data?.response || data?.content || (typeof data === 'string' ? data : '');
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
    } catch (invokeErr: any) {
      if (invokeErr.name === 'AbortError') throw invokeErr;
      console.warn("⚠️ SDK invoke error:", invokeErr);
    }

    return {
      data: null,
      error: lastError || 'Tidak dapat terhubung ke Edge Function Supabase',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
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

export function getModelUsageRates(modelCode: AiModelCode): { add5h: number; addWeekly: number } {
  if (modelCode === 'v2_vision') {
    return { add5h: 19, addWeekly: 14 };
  } else if (modelCode === 'v2_non_vision') {
    return { add5h: 13, addWeekly: 10 };
  } else if (modelCode === 'v1') {
    return { add5h: 12, addWeekly: 9 };
  } else if (modelCode === 'dilo') {
    return { add5h: 8, addWeekly: 6 };
  }
  return { add5h: 12, addWeekly: 9 };
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

export async function resetUserLimits(userId: string) {
  try {
    if (!userId) {
      // Coba ambil dari session jika userId kosong
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) userId = authData.user.id;
      } catch {}
    }
    if (!userId) return false;
    console.log(`🔄 [user_limits] Mereset limit penggunaan untuk user ${userId}`);

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

    // 1. Coba update record yang sudah ada
    const { error: updateErr } = await supabase
      .from('user_limits')
      .update({
        used_5h: 0,
        used_weekly: 0,
        reset_5h_at: reset5hAt,
        reset_weekly_at: resetWeeklyAt,
      })
      .eq('user_id', userId);

    // 2. Coba upsert jika record belum ada
    const { error: upsertErr } = await supabase
      .from('user_limits')
      .upsert(payload, { onConflict: 'user_id' });

    // 3. Panggil RPC reset jika ada di database
    try {
      await supabase.rpc('reset_ai_limit', { p_user_id: userId });
    } catch {}
    try {
      await supabase.rpc('reset_user_limits', { p_user_id: userId });
    } catch {}

    if (updateErr && upsertErr) {
      console.warn("⚠️ Gagal reset tabel user_limits:", updateErr.message || upsertErr.message);
      return false;
    }

    console.log("✅ Tabel user_limits berhasil direset ke 0%");
    return true;
  } catch (err) {
    console.warn("Exception resetUserLimits:", err);
    return false;
  }
}

export async function consumeAiLimit(userId: string, modelCode: AiModelCode) {
  try {
    if (!userId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) userId = authData.user.id;
      } catch {}
    }

    if (!userId) {
      console.warn("User ID tidak ditemukan untuk consumeAiLimit");
      return { success: true, remaining_5h: 100, remaining_weekly: 100, used_5h: 0, used_weekly: 0 };
    }

    const rates = getModelUsageRates(modelCode);
    console.log(`📊 [Limit] Mengonsumsi limit untuk user ${userId} model ${modelCode} (+${rates.add5h}% 5h, +${rates.addWeekly}% weekly)`);

    // 1. Direct Authoritative Update pada Tabel 'public.user_limits' sesuai spesifikasi rate model
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

      // Cek apakah periode 5 jam sudah lewat waktu reset
      if (existingRow.reset_5h_at && now > new Date(existingRow.reset_5h_at)) {
        currentUsed5h = 0;
        reset5hAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      }

      // Cek apakah periode mingguan sudah lewat waktu reset
      if (existingRow.reset_weekly_at && now > new Date(existingRow.reset_weekly_at)) {
        currentUsedWeekly = 0;
        resetWeeklyAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Proteksi otomatis jika used_weekly janggal (misal 99% padahal used_5h masih di bawah 30%)
      if (currentUsedWeekly >= 90 && currentUsed5h <= 30) {
        console.warn(`⚠️ Anomali limit mingguan terdeteksi (${currentUsedWeekly}%), menormalisasi ke proporsi model.`);
        currentUsedWeekly = Math.round(currentUsed5h * (rates.addWeekly / rates.add5h));
      }
    }

    const nextUsed5h = currentUsed5h + rates.add5h;
    const nextUsedWeekly = currentUsedWeekly + rates.addWeekly;

    // Cek batas kuota
    if (nextUsed5h > 100 || nextUsedWeekly > 100) {
      const remaining5h = Math.max(0, 100 - currentUsed5h);
      const remainingWeekly = Math.max(0, 100 - currentUsedWeekly);
      const limitReason = nextUsedWeekly > 100 
        ? "Batas kuota Mingguan Anda telah habis (100%). Silakan tunggu periode reset mingguan atau gunakan tombol Reset (Dev)."
        : "Batas kuota 5 Jam Anda telah habis (100%). Silakan tunggu periode reset 5 jam atau gunakan tombol Reset (Dev).";

      console.log(`Sisa 5-Jam: ${remaining5h}%, Sisa Mingguan: ${remainingWeekly}% (Limit Tercapai)`);
      return {
        success: false,
        message: limitReason,
        remaining_5h: remaining5h,
        remaining_weekly: remainingWeekly,
        used_5h: currentUsed5h,
        used_weekly: currentUsedWeekly,
      };
    }

    // Simpan data terbaru ke tabel 'user_limits'
    const payload = {
      user_id: userId,
      used_5h: nextUsed5h,
      reset_5h_at: reset5hAt,
      used_weekly: nextUsedWeekly,
      reset_weekly_at: resetWeeklyAt,
    };

    // Update atau upsert
    const { error: updateErr } = await supabase
      .from('user_limits')
      .update({
        used_5h: nextUsed5h,
        reset_5h_at: reset5hAt,
        used_weekly: nextUsedWeekly,
        reset_weekly_at: resetWeeklyAt,
      })
      .eq('user_id', userId);

    if (updateErr) {
      await supabase
        .from('user_limits')
        .upsert(payload, { onConflict: 'user_id' });
    }

    // Panggil RPC database secara non-blocking jika ada untuk menjaga kompatibilitas DB backend
    try {
      (async () => {
        try {
          await supabase.rpc('consume_ai_limit', {
            p_user_id: userId,
            p_model: modelCode,
          });
        } catch {}
      })();
    } catch {}

    const remaining5h = Math.max(0, 100 - nextUsed5h);
    const remainingWeekly = Math.max(0, 100 - nextUsedWeekly);
    console.log(`✅ Limit Berhasil Diperbarui -> 5-Jam: ${nextUsed5h}% (sisa ${remaining5h}%), Mingguan: ${nextUsedWeekly}% (sisa ${remainingWeekly}%)`);

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

/**
 * G. Manajemen Limit Penggunaan Web Search & Maps
 * Tarif per 5 jam:
 * - Advanced search: 10%
 * - Standard search: 5%
 * - Map search advanced: 13%
 * - Map standard search: 7%
 * Tarif per minggu:
 * - Advanced search: 5%
 * - Standard search: 3%
 * - Map search advanced: 7%
 * - Map standard search: 4%
 */
export async function consumeSearchLimit(
  userId: string,
  searchMode: 'standard' | 'advanced' | 'map_standard' | 'map_advanced' = 'standard'
) {
  const ratesMap: Record<string, { add5h: number; addWeekly: number }> = {
    advanced: { add5h: 10, addWeekly: 5 },
    standard: { add5h: 5, addWeekly: 3 },
    map_advanced: { add5h: 13, addWeekly: 7 },
    map_standard: { add5h: 7, addWeekly: 4 },
  };

  const rates = ratesMap[searchMode] || ratesMap.standard;

  try {
    if (!userId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) userId = authData.user.id;
      } catch {}
    }

    if (!userId) {
      return { success: true, remaining_5h: 100, remaining_weekly: 100, used_5h: 0, used_weekly: 0 };
    }

    const { data: existingRow } = await supabase
      .from('user_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const now = new Date();
    let currentUsed5h = Number(existingRow?.used_5h || 0);
    let currentUsedWeekly = Number(existingRow?.used_weekly || 0);
    let reset5hAt = existingRow?.reset_5h_at || new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    let resetWeeklyAt = existingRow?.reset_weekly_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (existingRow?.reset_5h_at && now > new Date(existingRow.reset_5h_at)) {
      currentUsed5h = 0;
      reset5hAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    }
    if (existingRow?.reset_weekly_at && now > new Date(existingRow.reset_weekly_at)) {
      currentUsedWeekly = 0;
      resetWeeklyAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const nextUsed5h = currentUsed5h + rates.add5h;
    const nextUsedWeekly = currentUsedWeekly + rates.addWeekly;

    if (nextUsed5h > 100 || nextUsedWeekly > 100) {
      return {
        success: false,
        message: "Batas kuota pencarian web tercapai. Silakan tunggu reset atau gunakan tombol Reset Kuota.",
        remaining_5h: Math.max(0, 100 - currentUsed5h),
        remaining_weekly: Math.max(0, 100 - currentUsedWeekly),
        used_5h: currentUsed5h,
        used_weekly: currentUsedWeekly,
      };
    }

    const payload = {
      user_id: userId,
      used_5h: nextUsed5h,
      reset_5h_at: reset5hAt,
      used_weekly: nextUsedWeekly,
      reset_weekly_at: resetWeeklyAt,
    };

    await supabase.from('user_limits').upsert(payload, { onConflict: 'user_id' });

    return {
      success: true,
      remaining_5h: Math.max(0, 100 - nextUsed5h),
      remaining_weekly: Math.max(0, 100 - nextUsedWeekly),
      used_5h: nextUsed5h,
      used_weekly: nextUsedWeekly,
    };
  } catch (err) {
    console.warn("Exception consumeSearchLimit:", err);
    return { success: true, remaining_5h: 100, remaining_weekly: 100, used_5h: 0, used_weekly: 0 };
  }
}

/**
 * Standardized Model Display Names
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'bluefox pro';
  const clean = modelId.toLowerCase();
  if (clean.includes('v2') || clean.includes('pro') || clean.includes('agnes') || clean.includes('qwen')) {
    return 'bluefox pro';
  }
  if (clean.includes('v1') || clean.includes('standard') || clean.includes('tencent') || clean.includes('gpt')) {
    return 'bluefox standard';
  }
  if (clean.includes('dilo') || clean.includes('laguna') || clean.includes('mistral') || clean.includes('nemotron')) {
    return 'bluefox Dilo';
  }
  return 'bluefox pro';
}



