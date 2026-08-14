import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

// Mendukung semua format environment variable dari Integrasi Vercel + Supabase
export const supabaseUrl: string = 
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  env.SUPABASE_URL ||
  env.PUBLIC_SUPABASE_URL ||
  'https://jjlanjshpyklqayjzxyy.supabase.co';

export const supabaseKey: string = 
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  env.SUPABASE_KEY ||
  env.VITE_SUPABASE_KEY ||
  env.PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey || 'dummy_anon_key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

const hasValidConfig = supabaseUrl !== 'https://dummy.supabase.co';

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
  if (!conversationId) return () => {};

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

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // 1. Coba pastikan record di tabel 'conversations' ada jika ada Foreign Key constraint
    try {
      await supabase
        .from('conversations')
        .upsert(
          {
            id: conversationId,
            user_id: userId,
            title: text.length > 40 ? text.substring(0, 40) + '...' : text,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
    } catch {
      // Abaikan jika tabel conversations tidak dibuat
    }

    // 2. Siapkan payload pesan
    const payload: any = {
      conversation_id: conversationId,
      role: role,
      content: text,
    };
    if (userId) {
      payload.user_id = userId;
    }

    console.log(`📤 [Supabase] Menginsert pesan (${role}) ke tabel messages:`, payload);

    let { data, error } = await supabase
      .from('messages')
      .insert([payload])
      .select();

    // Fallback jika nama kolom content menggunakan text atau message
    if (error && error.message?.includes('column "content" does not exist')) {
      const fallbackPayload: any = {
        conversation_id: conversationId,
        role: role,
        text: text,
      };
      if (userId) fallbackPayload.user_id = userId;
      const resFallback = await supabase.from('messages').insert([fallbackPayload]).select();
      data = resFallback.data;
      error = resFallback.error;
    }

    if (error) {
      console.error('❌ Gagal insert pesan ke tabel messages:', error.message, error);
      return { data: null, error: error.message };
    }

    console.log('✅ Berhasil insert pesan ke tabel messages:', data);
    return { data, error: null };
  } catch (err: any) {
    console.error('❌ Exception sendMessageToSupabase:', err);
    return { data: null, error: err?.message || 'Error tidak diketahui' };
  }
}

// ==========================================
// C. Ambil Riwayat Chat Saat Pertama Kali Buka Web
// ==========================================
export async function loadChatHistory(conversationId: string) {
  if (!conversationId) return [];

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Gagal memuat histori:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception loadChatHistory:', err);
    return [];
  }
}

