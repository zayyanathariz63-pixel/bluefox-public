import { supabase } from './supabase';

export type AppStyle = 'normal' | 'blue_rilis';

export interface StyleOption {
  id: AppStyle;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  badge: string;
  isLockedDefault: boolean;
  previewColors: {
    bg: string;
    accent: string;
    glass: string;
    border: string;
  };
}

export const APP_STYLES: StyleOption[] = [
  {
    id: 'normal',
    name: 'Normal Style',
    nameEn: 'Normal Style',
    description: 'Style app pada umumnya, tampilan default bersih dan elegan tanpa modifikasi.',
    descriptionEn: 'Standard default app style, clean and balanced interface.',
    badge: 'Default',
    isLockedDefault: false,
    previewColors: {
      bg: '#ffffff',
      accent: '#2563eb',
      glass: '#f8fafc',
      border: '#e2e8f0',
    }
  },
  {
    id: 'blue_rilis',
    name: 'Blue Rilis Style',
    nameEn: 'Blue Release Style',
    description: 'Background hitam kebiruan gelap, input & tombol Glass Matte dengan sinar biru menyala, serta panel frosted eksklusif.',
    descriptionEn: 'Deep blue-black backdrop, glass matte input & send button with glowing blue halo, and frosted UI surfaces.',
    badge: 'Eksklusif (Perlu Redeem)',
    isLockedDefault: true,
    previewColors: {
      bg: '#070b14',
      accent: '#3b82f6',
      glass: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(59, 130, 246, 0.3)',
    }
  }
];

const STYLE_STORAGE_KEY = 'tmpa_app_style';
const UNLOCKED_STYLES_KEY = 'tmpa_unlocked_styles';

export function getAppStyle(): AppStyle {
  if (typeof window === 'undefined') return 'normal';
  try {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY);
    if (saved === 'blue_rilis' || saved === 'normal') {
      return saved;
    }
  } catch {}
  return 'normal';
}

export function setAppStyle(style: AppStyle): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, style);
    window.dispatchEvent(new CustomEvent('tmpa_app_style_changed', { detail: style }));
  } catch {}
}

export function getUnlockedStyles(): string[] {
  if (typeof window === 'undefined') return ['normal'];
  try {
    const raw = localStorage.getItem(UNLOCKED_STYLES_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        if (!list.includes('normal')) list.push('normal');
        return list;
      }
    }
  } catch {}
  return ['normal'];
}

export function isStyleUnlocked(styleId: AppStyle): boolean {
  if (styleId === 'normal') return true;
  const list = getUnlockedStyles();
  return list.includes(styleId);
}

export function unlockAppStyle(styleId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getUnlockedStyles();
    if (!list.includes(styleId)) {
      list.push(styleId);
      localStorage.setItem(UNLOCKED_STYLES_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('tmpa_unlocked_styles_changed', { detail: list }));
    }
  } catch {}
}

/**
 * Client Logic (Penukaran Kode Style oleh User)
 * Panggil RPC Supabase: claim_stley_code
 */
export async function redeemStleyCode(userCodeInput: string): Promise<{ success: boolean; message: string; stley_name?: string }> {
  if (!userCodeInput || !userCodeInput.trim()) {
    return { success: false, message: "Kode tidak boleh kosong." };
  }

  const cleanCode = userCodeInput.trim();

  try {
    // Panggil RPC Supabase
    const { data, error } = await supabase.rpc('claim_stley_code', {
      input_code: cleanCode
    });

    if (error) {
      console.error("Redeem Error:", error.message);
      
      // Fallback ramah jika RPC belum disetup di backend Supabase (misal kode bawaan 'BFNEON2026', 'BLUERILIS', dsb)
      const upper = cleanCode.toUpperCase();
      if (upper === 'BFNEON2026' || upper.includes('BLUE') || upper.includes('RILIS') || upper.includes('STYLE')) {
        unlockAppStyle('blue_rilis');
        setAppStyle('blue_rilis');
        return {
          success: true,
          message: "Selamat! Style Blue Rilis Style telah aktif di perangkat ini.",
          stley_name: "Blue Rilis Style"
        };
      }

      return { success: false, message: error.message || "Terjadi kesalahan pada jaringan/server atau kode tidak valid." };
    }

    if (data && data.success) {
      const name = data.stley_name || data.style_name || 'Blue Rilis Style';
      unlockAppStyle('blue_rilis');
      setAppStyle('blue_rilis');
      return {
        success: true,
        message: data.message || `Selamat! Style ${name} telah aktif.`,
        stley_name: name
      };
    }

    if (data && data.success === false) {
      return {
        success: false,
        message: data.message || "Kode redeem style tidak valid atau sudah kadaluarsa."
      };
    }

    // Default jika data truthy
    unlockAppStyle('blue_rilis');
    setAppStyle('blue_rilis');
    return {
      success: true,
      message: "Selamat! Style Blue Rilis Style telah aktif.",
      stley_name: "Blue Rilis Style"
    };
  } catch (err: any) {
    console.error("Redeem Style Catch Error:", err);
    return { success: false, message: err?.message || "Terjadi kesalahan pada jaringan/server." };
  }
}
