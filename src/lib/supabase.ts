import { createClient } from '@supabase/supabase-js';

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
export async function invokeBluefoxProcessor(
  message: string,
  conversationId?: string | null
) {
  try {
    // Pastikan conversation_id bernilai null jika string kosong atau tidak ada
    const cleanConvId = (conversationId && typeof conversationId === 'string' && conversationId.trim() !== "")
      ? conversationId.trim()
      : null;

    const requestBody = {
      message: message.trim(),
      conversation_id: cleanConvId,
    };

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


