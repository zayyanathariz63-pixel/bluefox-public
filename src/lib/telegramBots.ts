import { supabase } from './supabase';
import { ChatSession } from '../types';

export interface TelegramBotRecord {
  id: string; // uuid
  user_id?: string;
  bot_name: string;
  telegram_bot_token: string;
  telegram_bot_username: string;
  session_id: string; // uuid -> session_bluefox.id
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const LOCAL_STORAGE_KEY = 'bluefox_telegram_bots_v1';
export const EDGE_FUNCTION_WEBHOOK_URL = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/quick-handler';

/**
 * Generate standard UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Membaca data bot lokal sebagai fallback
 */
function getLocalBots(): TelegramBotRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Menyimpan data bot ke local storage
 */
function saveLocalBots(bots: TelegramBotRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bots));
  } catch (e) {
    console.error('Gagal menyimpan bot ke localStorage:', e);
  }
}

/**
 * Mengambil daftar bot Telegram dari Supabase (dengan fallback ke localStorage)
 */
export async function fetchTelegramBots(): Promise<TelegramBotRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from('telegram_bots').select('*').order('created_at', { ascending: false });
    if (user?.id) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Gagal memuat telegram_bots dari Supabase, menggunakan data lokal:', error.message);
      return getLocalBots();
    }

    if (data) {
      saveLocalBots(data as TelegramBotRecord[]);
      return data as TelegramBotRecord[];
    }
  } catch (err) {
    console.warn('Error fetching telegram bots:', err);
  }

  return getLocalBots();
}

/**
 * Mendaftarkan Webhook ke Telegram API
 */
export async function registerTelegramWebhook(token: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) return { ok: false, description: 'Token tidak boleh kosong' };

    const webhookApiUrl = `https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(EDGE_FUNCTION_WEBHOOK_URL)}`;
    const response = await fetch(webhookApiUrl);
    const data = await response.json();

    return {
      ok: Boolean(data?.ok),
      description: data?.description || (data?.ok ? 'Webhook berhasil didaftarkan' : 'Gagal mendaftarkan webhook')
    };
  } catch (error: any) {
    console.error('Error saat mendaftarkan webhook telegram:', error);
    return {
      ok: false,
      description: error?.message || 'Gagal menghubungi server Telegram'
    };
  }
}

/**
 * Mengambil username bot dari Telegram API (getMe)
 */
export async function fetchTelegramBotInfo(token: string): Promise<{ ok: boolean; username?: string; first_name?: string }> {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) return { ok: false };

    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await response.json();

    if (data?.ok && data?.result?.username) {
      return {
        ok: true,
        username: data.result.username,
        first_name: data.result.first_name,
      };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Membuat Bot Baru:
 * 1. Buat entri sesi baru di session_bluefox dengan title sesuai bot_name
 * 2. Daftarkan webhook Telegram Bot ke Supabase Edge Function
 * 3. Simpan data bot ke telegram_bots beserta session_id yang baru dibuat (is_active = true)
 */
export async function createTelegramBot(params: {
  bot_name: string;
  telegram_bot_token?: string;
  telegram_bot_username?: string;
}): Promise<{
  bot: TelegramBotRecord;
  session: { id: string; title: string };
  telegramLink: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  const botId = generateUUID();
  const sessionId = generateUUID();
  const now = new Date().toISOString();

  // 1. Buat entri sesi baru di session_bluefox dengan title sesuai bot_name
  try {
    await supabase.from('session_bluefox').insert([{
      id: sessionId,
      user_id: user?.id || null,
      title: params.bot_name.trim(),
      created_at: now,
      updated_at: now
    }]);
  } catch (err) {
    console.warn('Gagal menyimpan sesi ke Supabase session_bluefox:', err);
  }

  // 2. Daftarkan webhook Telegram Bot jika token disediakan
  let detectedUsername = params.telegram_bot_username?.trim().replace(/^@/, '') || '';
  const token = params.telegram_bot_token?.trim() || '';

  if (token) {
    // Daftarkan webhook
    await registerTelegramWebhook(token);

    // Ambil username jika belum disediakan
    if (!detectedUsername) {
      const info = await fetchTelegramBotInfo(token);
      if (info.ok && info.username) {
        detectedUsername = info.username;
      }
    }
  }

  if (!detectedUsername) {
    detectedUsername = `${params.bot_name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_bot`;
  }

  const newBot: TelegramBotRecord = {
    id: botId,
    user_id: user?.id,
    bot_name: params.bot_name.trim(),
    telegram_bot_token: token,
    telegram_bot_username: detectedUsername,
    session_id: sessionId,
    is_active: true,
    created_at: now,
    updated_at: now
  };

  // 3. Simpan data bot ke telegram_bots di Supabase
  try {
    const { error } = await supabase.from('telegram_bots').insert([newBot]);
    if (error) {
      console.warn('Error insert telegram_bots ke Supabase, fallback ke lokal:', error.message);
    }
  } catch (err) {
    console.warn('Exception insert telegram_bots:', err);
  }

  // Simpan ke local storage
  const currentBots = getLocalBots();
  saveLocalBots([newBot, ...currentBots]);

  const telegramLink = `https://t.me/${detectedUsername}?start=${sessionId}`;

  return {
    bot: newBot,
    session: {
      id: sessionId,
      title: params.bot_name.trim()
    },
    telegramLink
  };
}

/**
 * Edit Bot: HANYA memperbarui kolom bot_name pada tabel telegram_bots di Supabase.
 * Nama bot di aplikasi Telegram TIDAK BOLEH BERUBAH.
 */
export async function updateTelegramBotName(botId: string, newBotName: string): Promise<boolean> {
  const now = new Date().toISOString();
  const trimmedName = newBotName.trim();

  try {
    const { error } = await supabase
      .from('telegram_bots')
      .update({
        bot_name: trimmedName,
        updated_at: now
      })
      .eq('id', botId);

    if (error) {
      console.warn('Gagal mengupdate bot_name di Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Exception update telegram_bots:', err);
  }

  // Update di local storage
  const current = getLocalBots();
  const updated = current.map(b => b.id === botId ? { ...b, bot_name: trimmedName, updated_at: now } : b);
  saveLocalBots(updated);

  return true;
}

/**
 * Hapus Bot:
 * Hapus baris data di telegram_bots atau ubah status is_active = false.
 * Jika pengguna di Telegram mencoba mengirim pesan ke bot yang sudah dihapus/dinonaktifkan,
 * Supabase Edge Function HARUS MENGABAIKAN (ignore) pesan tersebut.
 */
export async function deleteTelegramBot(botId: string, softDelete: boolean = false): Promise<boolean> {
  try {
    if (softDelete) {
      await supabase
        .from('telegram_bots')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', botId);
    } else {
      await supabase
        .from('telegram_bots')
        .delete()
        .eq('id', botId);
    }
  } catch (err) {
    console.warn('Gagal menghapus bot di Supabase:', err);
  }

  // Hapus atau perbarui di local storage
  const current = getLocalBots();
  const filtered = softDelete 
    ? current.map(b => b.id === botId ? { ...b, is_active: false } : b)
    : current.filter(b => b.id !== botId);
  saveLocalBots(filtered);

  return true;
}
