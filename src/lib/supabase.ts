import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env;

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'dummy_anon_key';

export const supabase = createClient(supabaseUrl, supabaseKey);

const hasValidConfig = supabaseUrl !== 'https://dummy.supabase.co';

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
