import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

export const supabaseUrl = env.VITE_SUPABASE_URL || 'https://jjlanjshpyklqayjzxyy.supabase.co';
export const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey || 'dummy_anon_key');

const hasValidConfig = supabaseUrl !== 'https://dummy.supabase.co';

export const exchangeSsoTicket = async (ticketId: string) => {
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

// ==========================================
// B. Fungsi Kirim Pesan (Trigger Webhook di Background)
// ==========================================
export async function sendMessageToSupabase(text: string, conversationId: string) {
  if (!text.trim() || !conversationId) return { data: null, error: 'Input tidak valid' };

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: text
      }
    ])
    .select();

  if (error) {
    console.error('Gagal mengirim pesan:', error.message);
  }

  return { data, error };
}

// ==========================================
// C. Ambil Riwayat Chat Saat Pertama Kali Buka Web
// ==========================================
export async function loadChatHistory(conversationId: string) {
  if (!conversationId) return [];

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
}

