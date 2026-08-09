import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

export const supabaseUrl = env.VITE_SUPABASE_URL || 'https://jjlanjshpyklqayjzxyy.supabase.co';
export const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey || 'dummy_anon_key');

const hasValidConfig = supabaseUrl !== 'https://dummy.supabase.co';

export const exchangeSsoTicket = async (ticketId: string) => {
  // 1. Try SDK invoke first
  try {
    const { data, error } = await supabase.functions.invoke('exchange-sso-ticket', {
      body: { ticket: ticketId },
    });
    if (!error && data?.session) {
      return data;
    }
  } catch (e) {
    console.warn("supabase.functions.invoke failed, falling back to direct fetch:", e);
  }

  // 2. Fallback to direct fetch call
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

  if (!response.ok || !edgeData?.session) {
    throw new Error(edgeData?.error || 'Gagal menukarkan tiket SSO');
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
}
