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
 * Menyimpan pesan ke tabel 'messages' dan memperbarui 'conversations' di Supabase
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
 * Standardized Model Display Names
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'bluefox pro';
  const clean = modelId.toLowerCase();
  if (clean.includes('pro') || clean.includes('agnes') || clean.includes('deepseek') || clean.includes('v2') || clean.includes('qwen')) {
    return 'bluefox pro';
  }
  if (clean.includes('tencent') || clean.includes('standard') || clean.includes('standar') || clean.includes('v1') || clean.includes('gpt')) {
    return 'bluefox standard';
  }
  if (clean.includes('laguna') || clean.includes('dilo') || clean.includes('longcat') || clean.includes('nemotron')) {
    return 'bluefox Dilo';
  }
  return 'bluefox pro';
}
