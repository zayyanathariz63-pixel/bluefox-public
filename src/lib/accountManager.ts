/**
 * Manajemen Multi-Akun Lokal Bluefox / TMPA
 * Menyimpan daftar akun yang pernah login di HP / browser pengguna (localStorage)
 * Setiap akun yang berhasil dapat sesi Supabase dari tiket dibuatkan 1 ID unik bernama "tmpa_device_id"
 */

import { supabase, supabaseKey } from './supabase';

export interface SavedAccount {
  id: string;
  email: string;
  name?: string;
  tier?: string;
  accessToken?: string;
  refreshToken?: string;
  lastActive?: number;
  avatarUrl?: string;
}

const STORAGE_KEY = 'tmpa_saved_accounts';

export type UserRoleBadge = 'admin' | 'taster' | 'co-admin';

const ADMIN_EMAILS = ['zayyanathariz63@gmail.com'];
const ADMIN_GITHUB_USERNAMES = ['zayyanathariz63-pixels', 'zayyanathariz63-pixel', 'zayyanathariz63'];

// Taster saat ini 0 / belum ada
const TASTER_EMAILS: string[] = [];
const TASTER_GITHUB_USERNAMES: string[] = [];

const CO_ADMIN_EMAILS = ['wdp.dirga@gmail.com', 'wirya.dirga26@sd.belajar.id'];
const CO_ADMIN_GITHUB_USERNAMES = ['wdpdirga-sys'];

function extractIdentityTokens(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): { emails: string[]; handles: string[] } {
  if (!emailOrUser) return { emails: [], handles: [] };

  if (typeof emailOrUser === 'string') {
    const val = emailOrUser.toLowerCase().trim();
    return {
      emails: val.includes('@') ? [val] : [],
      handles: [val],
    };
  }

  const emails = new Set<string>();
  const handles = new Set<string>();

  const pushEmail = (v?: any) => {
    if (typeof v === 'string' && v.trim()) {
      emails.add(v.toLowerCase().trim());
    }
  };
  const pushHandle = (v?: any) => {
    if (typeof v === 'string' && v.trim()) {
      handles.add(v.toLowerCase().trim());
    }
  };

  pushEmail(emailOrUser.email);
  pushHandle(emailOrUser.email);
  pushHandle(emailOrUser.name);
  pushHandle(emailOrUser.user_metadata?.user_name);
  pushHandle(emailOrUser.user_metadata?.preferred_username);
  pushHandle(emailOrUser.user_metadata?.full_name);
  pushHandle(emailOrUser.user_metadata?.name);
  pushEmail(emailOrUser.user_metadata?.email);

  if (Array.isArray(emailOrUser.identities)) {
    for (const ident of emailOrUser.identities) {
      const idData = ident?.identity_data;
      if (idData) {
        pushEmail(idData.email);
        pushHandle(idData.user_name);
        pushHandle(idData.preferred_username);
        pushHandle(idData.full_name);
        pushHandle(idData.name);
      }
    }
  }

  return {
    emails: Array.from(emails),
    handles: Array.from(handles),
  };
}

function matchesAccountList(
  tokens: { emails: string[]; handles: string[] },
  targetEmails: string[],
  targetHandles: string[]
): boolean {
  if (tokens.emails.some((e) => targetEmails.includes(e))) {
    return true;
  }
  return tokens.handles.some((h) =>
    targetHandles.some((target) => h === target || h.includes(target))
  );
}

function resolveUserSource(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null {
  if (emailOrUser) return emailOrUser;
  if (typeof window !== 'undefined') {
    try {
      const rawProfile = localStorage.getItem('tmpa_user_profile');
      if (rawProfile) {
        const profile = JSON.parse(rawProfile);
        if (profile?.email || profile?.name || profile?.user_metadata) {
          return profile;
        }
      }
      const rawSelected = localStorage.getItem('tmpa_selected_account');
      if (rawSelected) {
        const sel = JSON.parse(rawSelected);
        if (sel?.email || sel?.name || sel?.user_metadata) {
          return sel;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Mengembalikan badge role akun aktif: 'admin' | 'taster' | 'co-admin' | null
 */
export function getUserRoleBadge(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): UserRoleBadge | null {
  const source = resolveUserSource(emailOrUser);
  if (!source) return null;

  const tokens = extractIdentityTokens(source);

  if (matchesAccountList(tokens, ADMIN_EMAILS, ADMIN_GITHUB_USERNAMES)) {
    return 'admin';
  }
  if (matchesAccountList(tokens, CO_ADMIN_EMAILS, CO_ADMIN_GITHUB_USERNAMES)) {
    return 'co-admin';
  }
  if (matchesAccountList(tokens, TASTER_EMAILS, TASTER_GITHUB_USERNAMES)) {
    return 'taster';
  }
  return null;
}

/**
 * Mengecek apakah akun yang sedang login adalah Admin penuh.
 * Akses Admin: perintah @image, @motion, Session Pass (termasuk Riset), dan MCP.
 */
export function isUserAdmin(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): boolean {
  return getUserRoleBadge(emailOrUser) === 'admin';
}

export function isUserTaster(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): boolean {
  return getUserRoleBadge(emailOrUser) === 'taster';
}

export function isUserCoAdmin(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): boolean {
  return getUserRoleBadge(emailOrUser) === 'co-admin';
}

/**
 * Akses Session Pass GTB: berlaku untuk Admin dan Co-admin.
 */
export function hasSessionPassAccess(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): boolean {
  const role = getUserRoleBadge(emailOrUser);
  return role === 'admin' || role === 'co-admin';
}

/**
 * Batas No Limit otomatis tanpa batas (Co-admin).
 */
export function hasUnlimitedQuotaAccess(
  emailOrUser?: string | { email?: string; user_metadata?: any; name?: string; identities?: any[] } | null
): boolean {
  return getUserRoleBadge(emailOrUser) === 'co-admin';
}

/**
 * Mendapatkan atau membuat ID unik untuk user/perangkat yang disimpan di local bernama "tmpa_device_id"
 */
export function getOrCreateDeviceId(): string {
  let deviceId = typeof window !== 'undefined' ? localStorage.getItem('tmpa_device_id') : null;
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    try {
      localStorage.setItem('tmpa_device_id', deviceId);
    } catch {}
  }
  return deviceId;
}

/**
 * Mendaftarkan akun yang berhasil mendapatkan sesi Supabase (dari ticket/SSO)
 * Sekaligus memastikan ada 1 ID unik di local bernama "tmpa_device_id"
 */
export function registerAccountDeviceSession(
  user: any, 
  tokens?: { access_token?: string; refresh_token?: string }, 
  tier: string = 'free'
): string {
  const deviceId = getOrCreateDeviceId();

  if (user && user.id) {
    const userEmail = user.email || '';
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'TMPA User';

    saveAccount({
      id: user.id,
      email: userEmail,
      name: userName,
      tier: tier || 'free',
      accessToken: tokens?.access_token,
      refreshToken: tokens?.refresh_token,
      lastActive: Date.now()
    });
  }

  return deviceId;
}

/**
 * Mengambil semua akun yang tersimpan di perangkat lokal
 */
export function getSavedAccounts(currentUser?: any, currentTier: string = 'free'): SavedAccount[] {
  let list: SavedAccount[] = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    }
  } catch (e) {
    console.warn('[accountManager] Gagal membaca akun lokal:', e);
  }

  // Cek apakah ada tmpa_selected_account terdahulu
  try {
    const rawSelected = localStorage.getItem('tmpa_selected_account');
    if (rawSelected) {
      const parsedSelected = JSON.parse(rawSelected);
      if (parsedSelected?.email || parsedSelected?.id) {
        const existingIdx = list.findIndex(a => (parsedSelected.id && a.id === parsedSelected.id) || a.email === parsedSelected.email);
        if (existingIdx === -1) {
          list.push({
            id: parsedSelected.id || `acc_${Date.now()}`,
            email: parsedSelected.email || 'user@tmpa.example',
            name: parsedSelected.name || parsedSelected.full_name || parsedSelected.email?.split('@')[0],
            tier: parsedSelected.tier || 'free',
            accessToken: parsedSelected.access_token,
            refreshToken: parsedSelected.refresh_token,
            lastActive: Date.now()
          });
        }
      }
    }
  } catch {}

  // Pastikan akun yang sedang aktif saat ini juga terdaftar
  if (currentUser && currentUser.id) {
    const userEmail = currentUser.email || '';
    const userName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || userEmail.split('@')[0] || 'TMPA User';
    const existingIndex = list.findIndex(a => a.id === currentUser.id || (userEmail && a.email === userEmail));

    if (existingIndex !== -1) {
      list[existingIndex] = {
        ...list[existingIndex],
        id: currentUser.id,
        email: userEmail || list[existingIndex].email,
        name: userName || list[existingIndex].name,
        tier: currentTier || list[existingIndex].tier || 'free',
        lastActive: Date.now()
      };
    } else {
      list.unshift({
        id: currentUser.id,
        email: userEmail || 'user@tmpa.example',
        name: userName,
        tier: currentTier || 'free',
        lastActive: Date.now()
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  // Pastikan device_id selalu ada di local
  getOrCreateDeviceId();

  // Urutkan akun: yang paling baru aktif berada di posisi teratas
  return list.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
}

/**
 * Menyimpan atau memperbarui data akun ke localStorage
 */
export function saveAccount(account: SavedAccount): void {
  try {
    const list = getSavedAccounts();
    const idx = list.findIndex(a => a.id === account.id || (account.email && a.email === account.email));

    if (idx !== -1) {
      list[idx] = { ...list[idx], ...account, lastActive: Date.now() };
    } else {
      list.unshift({ ...account, lastActive: Date.now() });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[accountManager] Gagal menyimpan akun:', e);
  }
}

/**
 * Mencatat akun aktif saat ini bersama session tokens
 */
export async function recordCurrentSession(user: any, tier: string = 'free'): Promise<void> {
  if (!user || !user.id) return;

  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    registerAccountDeviceSession(
      user,
      {
        access_token: session?.access_token,
        refresh_token: session?.refresh_token
      },
      tier
    );
  } catch (err) {
    console.warn('[accountManager] Gagal merekam sesi aktif:', err);
  }
}

/**
 * Menghapus akun dari penyimpanan lokal perangkat ini
 */
export function removeSavedAccount(accountId: string): SavedAccount[] {
  try {
    const list = getSavedAccounts().filter(a => a.id !== accountId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn('[accountManager] Gagal menghapus akun:', e);
    return [];
  }
}

/**
 * Berpindah akun secara instan menggunakan token yang tersimpan di lokal
 */
export async function switchSavedAccount(account: SavedAccount): Promise<{ success: boolean; error?: string }> {
  try {
    if (account.accessToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: account.accessToken,
        refresh_token: account.refreshToken || '',
      });

      if (error) {
        console.warn('[accountManager] setSession error:', error.message);
        localStorage.setItem('tmpa_selected_account', JSON.stringify({
          id: account.id,
          email: account.email,
          name: account.name,
          tier: account.tier,
          access_token: account.accessToken,
          refresh_token: account.refreshToken
        }));
      } else if (data?.user) {
        saveAccount({ ...account, lastActive: Date.now() });
        return { success: true };
      }
    }

    // Simpan pilihan akun ke localStorage
    localStorage.setItem('tmpa_selected_account', JSON.stringify({
      id: account.id,
      email: account.email,
      name: account.name,
      tier: account.tier,
      access_token: account.accessToken,
      refresh_token: account.refreshToken
    }));

    saveAccount({ ...account, lastActive: Date.now() });
    return { success: true };
  } catch (err: any) {
    console.error('[accountManager] Gagal berpindah akun:', err);
    return { success: false, error: err?.message || 'Gagal berpindah akun' };
  }
}

/**
 * Sinkronisasi akun dari swift-endpoint jika server memiliki daftar akun untuk device_id ini
 */
export async function syncDeviceAccountsFromServer(): Promise<SavedAccount[]> {
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch(
      `https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/swift-endpoint?device_id=${deviceId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data?.accounts && Array.isArray(data.accounts)) {
        for (const acc of data.accounts) {
          saveAccount({
            id: acc.id || acc.user_id || `acc_${Date.now()}`,
            email: acc.email || 'user@tmpa.example',
            name: acc.name || acc.nama || acc.full_name,
            tier: acc.tier || acc.plan || 'free',
            accessToken: acc.access_token,
            refreshToken: acc.refresh_token,
            lastActive: Date.now()
          });
        }
      }
    }
  } catch (e) {
    console.warn('[accountManager] Sinkronisasi swift-endpoint:', e);
  }

  return getSavedAccounts();
}
