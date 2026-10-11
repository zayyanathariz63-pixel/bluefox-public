import { supabase } from './supabase';

export interface TelegramBotRecord {
  id: string; // uuid
  user_id?: string;
  bot_name: string;
  telegram_bot_token: string;
  telegram_bot_username?: string | null;
  session_id: string; // uuid -> session_bluefox.id
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  telegram_chat_id?: number | string | null;
}

export interface TelegramLinkRecord {
  id: string; // uuid
  user_id: string;
  telegram_chat_id: number;
  linked_at?: string;
}

const LOCAL_STORAGE_BOTS_KEY = 'bluefox_telegram_bots_v1';
const LOCAL_STORAGE_LINKS_KEY = 'bluefox_telegram_links_v1';
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
 * Local storage helpers
 */
function getLocalBots(): TelegramBotRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBots(bots: TelegramBotRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_BOTS_KEY, JSON.stringify(bots));
  } catch (e) {
    console.error('Gagal menyimpan bot ke localStorage:', e);
  }
}

function getLocalTelegramLinks(): TelegramLinkRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTelegramLinks(links: TelegramLinkRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(links));
  } catch (e) {
    console.error('Gagal menyimpan telegram links ke localStorage:', e);
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
 * Mencari ID chat pengguna dari Telegram API (getUpdates)
 */
export async function fetchTelegramChatIdFromUpdates(token: string): Promise<{
  ok: boolean;
  chatId?: number;
  senderName?: string;
  chatUsername?: string;
  error?: string;
}> {
  const cleanToken = token.trim();
  if (!cleanToken) return { ok: false, error: 'Token tidak boleh kosong' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates`);
    const data = await res.json();

    if (!data?.ok) {
      return { ok: false, error: data?.description || 'Gagal memanggil getUpdates Telegram' };
    }

    if (Array.isArray(data?.result) && data.result.length > 0) {
      // Ambil update terbaru dari belakang (reverse order)
      for (let i = data.result.length - 1; i >= 0; i--) {
        const u = data.result[i];
        const chat = u.message?.chat || u.my_chat_member?.chat || u.callback_query?.message?.chat || u.channel_post?.chat;
        if (chat && chat.id) {
          return {
            ok: true,
            chatId: chat.id,
            senderName: chat.first_name || chat.title || chat.username,
            chatUsername: chat.username,
          };
        }
      }
    }

    return {
      ok: false,
      error: 'Belum ada pesan yang masuk di bot ini.'
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Gagal menghubungi Telegram API'
    };
  }
}

/**
 * Menyimpan data ke tabel public.telegram_links di Supabase
 */
export async function saveTelegramLink(chatId: number, userId?: string): Promise<{ ok: boolean; record?: TelegramLinkRecord }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = userId || user?.id;
    if (!effectiveUserId) {
      console.warn('User ID tidak ditemukan saat menyimpan telegram_links');
      return { ok: false };
    }

    const payload = {
      user_id: effectiveUserId,
      telegram_chat_id: chatId,
      linked_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('telegram_links')
      .upsert([payload], { onConflict: 'telegram_chat_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Gagal menyimpan ke tabel telegram_links di Supabase:', error.message);
    }

    const currentLinks = getLocalTelegramLinks();
    const filtered = currentLinks.filter(l => l.telegram_chat_id !== chatId);
    const newRecord: TelegramLinkRecord = data || {
      id: generateUUID(),
      ...payload
    };
    saveLocalTelegramLinks([newRecord, ...filtered]);

    return { ok: true, record: newRecord };
  } catch (e) {
    console.warn('Exception saveTelegramLink:', e);
    return { ok: false };
  }
}

/**
 * Mengambil daftar telegram_links milik user
 */
export async function fetchTelegramLinks(): Promise<TelegramLinkRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase.from('telegram_links').select('*').order('linked_at', { ascending: false });
    if (user?.id) {
      query = query.eq('user_id', user.id);
    }
    const { data, error } = await query;
    if (!error && data) {
      saveLocalTelegramLinks(data as TelegramLinkRecord[]);
      return data as TelegramLinkRecord[];
    }
  } catch (err) {
    console.warn('Exception fetchTelegramLinks:', err);
  }
  return getLocalTelegramLinks();
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
 * Mengambil daftar bot Telegram dari Supabase (dengan fallback ke localStorage)
 * dan menghubungkannya dengan chat ID dari telegram_links
 */
export async function fetchTelegramBots(): Promise<TelegramBotRecord[]> {
  let botsData: TelegramBotRecord[] = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from('telegram_bots').select('*').order('created_at', { ascending: false });
    if (user?.id) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      botsData = data as TelegramBotRecord[];
      saveLocalBots(botsData);
    } else {
      botsData = getLocalBots();
    }
  } catch (err) {
    console.warn('Error fetching telegram bots:', err);
    botsData = getLocalBots();
  }

  // Lengkapi dengan chat_id dari telegram_links jika tersedia
  try {
    const links = await fetchTelegramLinks();
    if (links.length > 0) {
      botsData = botsData.map(bot => {
        const link = links.find(l => l.user_id === bot.user_id);
        return {
          ...bot,
          telegram_chat_id: bot.telegram_chat_id || link?.telegram_chat_id || null
        };
      });
    }
  } catch {}

  return botsData;
}

/**
 * Membuat Bot Baru:
 * 1. Mengambil token Telegram
 * 2. Mencarikan ID chat pengguna dari Telegram (getUpdates)
 * 3. Menyimpan ID chat ke tabel public.telegram_links
 * 4. Menyimpan sesi ke session_bluefox
 * 5. Menyimpan data bot ke tabel public.telegram_bots
 * 6. Mendaftarkan webhook Telegram ke Edge Function
 */
export async function createTelegramBot(params: {
  bot_name: string;
  telegram_bot_token: string;
  telegram_bot_username?: string;
  telegram_chat_id?: number | null;
}): Promise<{
  bot: TelegramBotRecord;
  session: { id: string; title: string };
  telegramLink: string;
  detectedChatId?: number | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  const botId = generateUUID();
  const sessionId = generateUUID();
  const now = new Date().toISOString();
  const token = params.telegram_bot_token.trim();

  // 1. Ambil info bot untuk mendapatkan username
  let detectedUsername = params.telegram_bot_username?.trim().replace(/^@/, '') || '';
  if (token && !detectedUsername) {
    const info = await fetchTelegramBotInfo(token);
    if (info.ok && info.username) {
      detectedUsername = info.username;
    }
  }

  if (!detectedUsername) {
    detectedUsername = `${params.bot_name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_bot`;
  }

  // 2. Mencarikan ID chat dari Telegram (getUpdates)
  let foundChatId: number | null = params.telegram_chat_id || null;
  if (!foundChatId && token) {
    const updatesResult = await fetchTelegramChatIdFromUpdates(token);
    if (updatesResult.ok && updatesResult.chatId) {
      foundChatId = updatesResult.chatId;
    }
  }

  // 3. Simpan ke telegram_links jika chat ID ditemukan
  if (foundChatId && user?.id) {
    await saveTelegramLink(foundChatId, user.id);
  }

  // 4. Buat entri sesi baru di session_bluefox dengan title sesuai bot_name
  try {
    await supabase.from('session_bluefox').insert([{
      id: sessionId,
      user_id: user?.id || null,
      title: params.bot_name.trim(),
      created_at: now,
      updated_at: now
    }]);
  } catch (err) {
    console.warn('Gagal menyimpan sesi ke session_bluefox:', err);
  }

  // 5. Daftarkan webhook Telegram Bot ke Edge Function
  if (token) {
    await registerTelegramWebhook(token);
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
    updated_at: now,
    telegram_chat_id: foundChatId
  };

  // 6. Simpan data bot ke telegram_bots di Supabase
  try {
    const { error } = await supabase.from('telegram_bots').insert([{
      id: botId,
      user_id: user?.id,
      bot_name: params.bot_name.trim(),
      telegram_bot_token: token,
      telegram_bot_username: detectedUsername,
      session_id: sessionId,
      is_active: true,
      created_at: now,
      updated_at: now
    }]);
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
    telegramLink,
    detectedChatId: foundChatId
  };
}

/**
 * Mencari dan menghubungkan Chat ID untuk bot yang sudah ada
 */
export async function searchAndLinkChatId(bot: TelegramBotRecord): Promise<{
  ok: boolean;
  chatId?: number;
  error?: string;
}> {
  if (!bot.telegram_bot_token) {
    return { ok: false, error: 'Token bot tidak tersedia' };
  }

  const res = await fetchTelegramChatIdFromUpdates(bot.telegram_bot_token);
  if (res.ok && res.chatId) {
    await saveTelegramLink(res.chatId, bot.user_id);
    
    // Perbarui state lokal
    const currentBots = getLocalBots();
    const updated = currentBots.map(b => b.id === bot.id ? { ...b, telegram_chat_id: res.chatId } : b);
    saveLocalBots(updated);

    return { ok: true, chatId: res.chatId };
  }

  return { ok: false, error: res.error || 'Chat ID belum ditemukan' };
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

  const current = getLocalBots();
  const updated = current.map(b => b.id === botId ? { ...b, bot_name: trimmedName, updated_at: now } : b);
  saveLocalBots(updated);

  return true;
}

/**
 * Hapus Bot:
 * Hapus baris data di telegram_bots atau ubah status is_active = false.
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

  const current = getLocalBots();
  const filtered = softDelete 
    ? current.map(b => b.id === botId ? { ...b, is_active: false } : b)
    : current.filter(b => b.id !== botId);
  saveLocalBots(filtered);

  return true;
}
