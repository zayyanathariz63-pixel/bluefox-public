/**
 * Halloween 2026 Event Manager
 * Event Period: 2 November s/d 20 November 2026
 * (Otomatis berakhir dan hilang setelah 20 November 2026)
 */

export const HALLOWEEN_START_DATE = new Date('2026-11-01T00:00:00'); // Early access mulai 1 Nov
export const HALLOWEEN_END_DATE = new Date('2026-11-20T23:59:59');

export const CANDY_STORAGE_KEY = 'tmpa_halloween_candy';
export const NEXT_SPAWN_STORAGE_KEY = 'tmpa_halloween_next_spawns';
export const REDEMPTIONS_STORAGE_KEY = 'tmpa_halloween_redemptions';

export type RewardType = 'bat' | 'pumpkin' | 'skeleton';

export interface MonsterConfig {
  id: RewardType;
  name: string;
  nameEn: string;
  candies: number;
  intervalSeconds: number; // Durasi jeda kemunculan (detik)
  displayDurationSeconds: number; // Durasi muncul di layar sebelum hilang jika miss (detik)
  description: string;
  behaviorDesc: string;
}

export const MONSTER_CONFIGS: Record<RewardType, MonsterConfig> = {
  bat: {
    id: 'bat',
    name: 'Kelelawar Terbang',
    nameEn: 'Flying Bat',
    candies: 1,
    intervalSeconds: 5 * 60, // 5 menit = 300 detik
    displayDurationSeconds: 7, // Terbang melintasi layar selama ~7 detik
    description: 'Terbang melintasi layar setiap 5 menit. Klik saat terbang untuk menangkap!',
    behaviorDesc: 'Muncul melintasi layar setiap 5 menit. Jika terlewat (miss), harus menunggu 5 menit lagi.'
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Labu Mistis',
    nameEn: 'Mystic Pumpkin',
    candies: 2,
    intervalSeconds: 10 * 60, // 10 menit = 600 detik
    displayDurationSeconds: 5, // Durasi muncul tepat 5 detik
    description: 'Muncul dari pinggir layar setiap 10 menit selama 5 detik. Tekan sebelum menghilang!',
    behaviorDesc: 'Muncul dari sudut/pinggir layar setiap 10 menit selama 5 detik. Jika miss, harus menunggu 10 menit.'
  },
  skeleton: {
    id: 'skeleton',
    name: 'Tengkorak Keramat',
    nameEn: 'Sacred Skeleton Skull',
    candies: 4,
    intervalSeconds: 20 * 60, // 20 menit = 1200 detik
    displayDurationSeconds: 5, // Durasi muncul tepat 5 detik
    description: 'Melayang turun dari atas layar setiap 20 menit selama 5 detik. Klik tengkoraknya!',
    behaviorDesc: 'Melayang turun dari atas layar setiap 20 menit selama 5 detik. Hadiah terbesar +4 Candy.'
  }
};

// Aliases for compatibility
export const REWARD_CONFIGS = MONSTER_CONFIGS;

export interface ShopItem {
  id: 'limit_20' | 'limit_30' | 'style_halloween';
  name: string;
  cost: number;
  description: string;
  badge: string;
  isPreorder?: boolean;
}

export const HALLOWEEN_SHOP_ITEMS: ShopItem[] = [
  {
    id: 'limit_20',
    name: 'Limit 20% Lebih Banyak',
    cost: 60,
    description: 'Meningkatkan kapasitas kuota percakapan AI harian & 5-jam Anda sebesar +20%.',
    badge: '+20% Kuota'
  },
  {
    id: 'limit_30',
    name: 'Limit 30% Lebih Banyak',
    cost: 90,
    description: 'Meningkatkan kapasitas kuota percakapan AI harian & 5-jam Anda sebesar +30% lebih leluasa.',
    badge: '+30% Kuota'
  },
  {
    id: 'style_halloween',
    name: 'Style App Halloween',
    cost: 120,
    description: 'Tema antarmuka eksklusif bernuansa malam Halloween. Tersimpan dan aktif setelah rilis resmi.',
    badge: 'Tema Eksklusif',
    isPreorder: true
  }
];

/**
 * Cek apakah event Halloween sedang berlangsung
 * (Mulai 2 Nov s/d 20 Nov 2026. Lewat 20 Nov otomatis berakhir)
 */
export function isHalloweenEventActive(): boolean {
  if (typeof window === 'undefined') return true;
  const now = new Date();
  return now <= HALLOWEEN_END_DATE;
}

/**
 * Mendapatkan sisa hari/waktu event berlangsung
 */
export function getHalloweenEventTimeRemaining(): { days: number; hours: number; minutes: number; isEnded: boolean } {
  const now = new Date();
  const diff = HALLOWEEN_END_DATE.getTime() - now.getTime();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isEnded: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, isEnded: false };
}

/**
 * Mengambil saldo Candy user
 */
export function getHalloweenCandy(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(CANDY_STORAGE_KEY);
    if (raw === null) {
      // Bonus sambutan awal 5 candy
      localStorage.setItem(CANDY_STORAGE_KEY, '5');
      return 5;
    }
    const val = parseInt(raw, 10);
    return isNaN(val) ? 0 : Math.max(0, val);
  } catch {
    return 0;
  }
}

/**
 * Menambahkan Candy ke saldo user
 */
export function addHalloweenCandy(amount: number): number {
  if (typeof window === 'undefined') return 0;
  const current = getHalloweenCandy();
  const next = current + Math.max(0, amount);
  try {
    localStorage.setItem(CANDY_STORAGE_KEY, next.toString());
    window.dispatchEvent(new CustomEvent('tmpa_halloween_candy_changed', { detail: next }));
  } catch {}
  return next;
}

/**
 * Mengurangi Candy saldo user
 */
export function spendHalloweenCandy(amount: number): boolean {
  if (typeof window === 'undefined') return false;
  const current = getHalloweenCandy();
  if (current < amount) return false;
  const next = current - amount;
  try {
    localStorage.setItem(CANDY_STORAGE_KEY, next.toString());
    window.dispatchEvent(new CustomEvent('tmpa_halloween_candy_changed', { detail: next }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Mengambil data target waktu kemunculan monster berikutnya
 */
export function getNextSpawnTimestamps(): Record<RewardType, number> {
  if (typeof window === 'undefined') return { bat: 0, pumpkin: 0, skeleton: 0 };
  try {
    const raw = localStorage.getItem(NEXT_SPAWN_STORAGE_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bat: Number(parsed.bat || now + MONSTER_CONFIGS.bat.intervalSeconds * 1000),
        pumpkin: Number(parsed.pumpkin || now + MONSTER_CONFIGS.pumpkin.intervalSeconds * 1000),
        skeleton: Number(parsed.skeleton || now + MONSTER_CONFIGS.skeleton.intervalSeconds * 1000)
      };
    } else {
      // Inisialisasi awal: Kelelawar siap dalam 2 menit, labu 4 menit, skeleton 8 menit agar tidak menunggu terlalu lama pada sesi awal
      const initial = {
        bat: now + 90 * 1000,
        pumpkin: now + 240 * 1000,
        skeleton: now + 480 * 1000
      };
      localStorage.setItem(NEXT_SPAWN_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
  } catch {}
  return { bat: 0, pumpkin: 0, skeleton: 0 };
}

/**
 * Menghitung sisa detik menuju kemunculan monster berikutnya
 */
export function getSpawnSecondsRemaining(type: RewardType): number {
  const timestamps = getNextSpawnTimestamps();
  const nextTarget = timestamps[type] || 0;
  const now = Date.now();
  const diff = Math.floor((nextTarget - now) / 1000);
  return Math.max(0, diff);
}

// Backward compatibility alias
export const getCooldownSecondsRemaining = getSpawnSecondsRemaining;

/**
 * Menjadwalkan kemunculan berikutnya setelah monster selesai muncul (baik di-klik maupun terlewat / miss)
 */
export function rescheduleNextSpawn(type: RewardType): number {
  const config = MONSTER_CONFIGS[type];
  const nextTime = Date.now() + config.intervalSeconds * 1000;
  const timestamps = getNextSpawnTimestamps();
  timestamps[type] = nextTime;
  try {
    localStorage.setItem(NEXT_SPAWN_STORAGE_KEY, JSON.stringify(timestamps));
    window.dispatchEvent(new CustomEvent('tmpa_halloween_schedule_changed', { detail: timestamps }));
  } catch {}
  return nextTime;
}

/**
 * Menangani tangkapan monster oleh user
 */
export function catchHalloweenMonster(type: RewardType): {
  success: boolean;
  earned: number;
  message: string;
} {
  const config = MONSTER_CONFIGS[type];
  const earned = config.candies;

  // Jadwalkan ulang kemunculan berikutnya
  rescheduleNextSpawn(type);

  // Tambahkan Candy
  addHalloweenCandy(earned);

  return {
    success: true,
    earned,
    message: `Berhasil menangkap ${config.name}! Mendapatkan +${earned} Candy!`
  };
}

// Backward compatibility alias
export const claimHalloweenReward = (type: RewardType) => catchHalloweenMonster(type);

/**
 * Memicu monster untuk langsung muncul sekarang (untuk testing atau dev)
 */
export function triggerInstantSpawn(type: RewardType): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tmpa_halloween_force_spawn', { detail: type }));
}

/**
 * Mengambil daftar item yang sudah ditukar oleh user
 */
export function getRedeemedHalloweenItems(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REDEMPTIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Cek apakah item sudah ditukar
 */
export function isHalloweenItemRedeemed(itemId: string): boolean {
  return getRedeemedHalloweenItems().includes(itemId);
}

/**
 * Menukar Candy di Toko Halloween
 */
export function redeemHalloweenShopItem(itemId: 'limit_20' | 'limit_30' | 'style_halloween'): {
  success: boolean;
  message: string;
} {
  const item = HALLOWEEN_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) {
    return { success: false, message: 'Item penukaran tidak ditemukan.' };
  }

  if (isHalloweenItemRedeemed(itemId)) {
    return { success: false, message: `Kamu sudah pernah menukarkan item ini sebelumnya!` };
  }

  const candy = getHalloweenCandy();
  if (candy < item.cost) {
    return { 
      success: false, 
      message: `Candy kamu belum mencukupi (${candy}/${item.cost} Candy). Tangkap kelelawar, labu, atau tengkorak saat muncul!` 
    };
  }

  const spent = spendHalloweenCandy(item.cost);
  if (!spent) {
    return { success: false, message: 'Gagal memproses penukaran Candy.' };
  }

  // Simpan penukaran
  const redeemed = getRedeemedHalloweenItems();
  redeemed.push(itemId);
  try {
    localStorage.setItem(REDEMPTIONS_STORAGE_KEY, JSON.stringify(redeemed));
    window.dispatchEvent(new CustomEvent('tmpa_halloween_redeemed', { detail: itemId }));
  } catch {}

  if (itemId === 'style_halloween') {
    return {
      success: true,
      message: 'Berhasil ditukar! Catatan terdaftar: Kamu akan otomatis mendapatkan Style App Halloween setelah resmi dirilis.'
    };
  }

  return {
    success: true,
    message: `Selamat! Penukaran ${item.name} berhasil. Limit akun Anda telah ditingkatkan.`
  };
}

/**
 * Multiplier kuota limit dari reward Halloween
 */
export function getHalloweenLimitBonusMultiplier(): number {
  if (typeof window === 'undefined') return 1.0;
  const items = getRedeemedHalloweenItems();
  if (items.includes('limit_30')) return 1.30;
  if (items.includes('limit_20')) return 1.20;
  return 1.0;
}
