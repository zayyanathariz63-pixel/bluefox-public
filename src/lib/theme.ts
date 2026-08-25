import { useState, useEffect } from 'react';

export interface ThemeConfig {
  bg?: string;
  font?: string;
  cta?: string;
  border?: string;
  hover?: string;
  surface?: string;
  name?: string;
}

export function useCurrentTheme(): ThemeConfig {
  const [theme, setTheme] = useState<ThemeConfig>(() => getSavedTheme());
  useEffect(() => {
    const handler = (e: any) => {
      setTheme(e.detail || getSavedTheme());
    };
    window.addEventListener('tmpa_theme_updated', handler);
    return () => window.removeEventListener('tmpa_theme_updated', handler);
  }, []);
  return theme;
}

const STORAGE_KEY = 'tmpa_custom_theme';

export const THEME_PRESETS: Record<string, { name: string; config: ThemeConfig; keywords: string[] }> = {
  default: {
    name: 'TMPA Dark (Default)',
    keywords: ['default', 'standar', 'normal', 'reset', 'asli', 'hitam biru'],
    config: {
      bg: '#000000',
      font: '#f3f4f6',
      cta: '#2563eb',
      border: '#1f2937',
      hover: '#1d4ed8',
      surface: '#0a0a0c',
      name: 'TMPA Dark Default'
    }
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    keywords: ['cyberpunk', 'neon', 'ungu neon', 'pink neon', 'futuristik', 'cyber', 'synthwave'],
    config: {
      bg: '#0c0714',
      font: '#e2f1ff',
      cta: '#d946ef',
      border: '#3b185f',
      hover: '#ec4899',
      surface: '#170c2a',
      name: 'Cyberpunk Neon'
    }
  },
  emerald: {
    name: 'Emerald Forest (Hijau Elegan)',
    keywords: ['emerald', 'hijau', 'forest', 'hutan', 'alam', 'nature', 'green', 'daun', 'lumut'],
    config: {
      bg: '#051b14',
      font: '#e6f4ea',
      cta: '#10b981',
      border: '#0f392b',
      hover: '#059669',
      surface: '#0a261c',
      name: 'Emerald Forest'
    }
  },
  ocean: {
    name: 'Deep Ocean Blue (Biru Samudra)',
    keywords: ['ocean', 'laut', 'samudra', 'biru', 'blue', 'aqua', 'pantai', 'air', 'ombak'],
    config: {
      bg: '#061325',
      font: '#e0f2fe',
      cta: '#0284c7',
      border: '#112b4e',
      hover: '#0369a1',
      surface: '#0c1d38',
      name: 'Deep Ocean Blue'
    }
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    keywords: ['catppuccin', 'mocha', 'pastel dark', 'ungu lembut', 'cozy'],
    config: {
      bg: '#1e1e2e',
      font: '#cdd6f4',
      cta: '#89b4fa',
      border: '#313244',
      hover: '#b4befe',
      surface: '#181825',
      name: 'Catppuccin Mocha'
    }
  },
  dracula: {
    name: 'Dracula Gothic',
    keywords: ['dracula', 'vampire', 'gothic', 'dark purple', 'ungu gelap'],
    config: {
      bg: '#282a36',
      font: '#f8f8f2',
      cta: '#bd93f9',
      border: '#44475a',
      hover: '#ff79c6',
      surface: '#21222c',
      name: 'Dracula Gothic'
    }
  },
  nord: {
    name: 'Nord Aurora',
    keywords: ['nord', 'arctic', 'kutub', 'dingin', 'salju', 'nordic', 'aurora'],
    config: {
      bg: '#2e3440',
      font: '#eceff4',
      cta: '#88c0d0',
      border: '#434c5e',
      hover: '#81a1c1',
      surface: '#242933',
      name: 'Nord Aurora'
    }
  },
  tokyonight: {
    name: 'Tokyo Night',
    keywords: ['tokyo', 'tokyonight', 'jepang', 'malam', 'japan', 'shibuya'],
    config: {
      bg: '#1a1b26',
      font: '#c0caf5',
      cta: '#7aa2f7',
      border: '#292e42',
      hover: '#bb9af7',
      surface: '#16161e',
      name: 'Tokyo Night'
    }
  },
  coffee: {
    name: 'Warm Coffee & Wood (Kopi Hangat Vintage)',
    keywords: ['coffee', 'kopi', 'kafe', 'cafe', 'cokelat', 'brown', 'kayu', 'vintage', 'warm', 'hangat', 'retro'],
    config: {
      bg: '#1c140e',
      font: '#f7ede2',
      cta: '#d97706',
      border: '#3d2b1f',
      hover: '#b45309',
      surface: '#291e16',
      name: 'Warm Coffee Vintage'
    }
  },
  sunset: {
    name: 'Sunset Glow (Jingga Senja)',
    keywords: ['sunset', 'senja', 'oranye', 'orange', 'jingga', 'sore', 'matahari terbenam', 'amber'],
    config: {
      bg: '#180e0c',
      font: '#ffedd5',
      cta: '#ea580c',
      border: '#3d1d16',
      hover: '#c2410c',
      surface: '#241410',
      name: 'Sunset Glow'
    }
  },
  sakura: {
    name: 'Sakura Pastel Pink (Bunga Sakura)',
    keywords: ['sakura', 'pink', 'merah muda', 'rose', 'bunga', 'cute', 'kawaii', 'pastel pink'],
    config: {
      bg: '#1a0d14',
      font: '#fce7f3',
      cta: '#ec4899',
      border: '#3d1a2d',
      hover: '#db2777',
      surface: '#26121d',
      name: 'Sakura Pastel Pink'
    }
  },
  crimson: {
    name: 'Crimson Blood (Merah Gelap Elegan)',
    keywords: ['crimson', 'merah', 'red', 'ruby', 'darah', 'maroon', 'api', 'fire', 'lava'],
    config: {
      bg: '#18080a',
      font: '#ffe4e6',
      cta: '#e11d48',
      border: '#3d1217',
      hover: '#be123c',
      surface: '#240d10',
      name: 'Crimson Ruby'
    }
  },
  monochrome: {
    name: 'Clean Monochrome (Minimalis Hitam Putih)',
    keywords: ['monochrome', 'monokrom', 'abu-abu', 'grey', 'gray', 'silver', 'perak', 'minimalis', 'minimalist'],
    config: {
      bg: '#121214',
      font: '#ffffff',
      cta: '#71717a',
      border: '#27272a',
      hover: '#a1a1aa',
      surface: '#18181b',
      name: 'Clean Monochrome'
    }
  },
  luxury_gold: {
    name: 'Luxury Black & Gold (Emas Mewah)',
    keywords: ['gold', 'emas', 'luxury', 'mewah', 'sultan', 'royal', 'tajir', 'golden'],
    config: {
      bg: '#0f0e08',
      font: '#fef3c7',
      cta: '#eab308',
      border: '#3a3111',
      hover: '#ca8a04',
      surface: '#1d190b',
      name: 'Luxury Black & Gold'
    }
  },
  light_clean: {
    name: 'Minimal Light Mode (Terang Bersih)',
    keywords: ['light', 'terang', 'putih', 'white', 'siang', 'cerah', 'clean light'],
    config: {
      bg: '#f8fafc',
      font: '#0f172a',
      cta: '#2563eb',
      border: '#e2e8f0',
      hover: '#1d4ed8',
      surface: '#ffffff',
      name: 'Minimal Light Mode'
    }
  }
};

export function getSavedTheme(): ThemeConfig {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function applyTheme(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme.bg) {
    root.style.setProperty('--theme-bg', theme.bg);
    root.style.setProperty('--theme-app-bg', theme.bg);
    document.body.style.backgroundColor = theme.bg;
  } else {
    root.style.removeProperty('--theme-bg');
    root.style.removeProperty('--theme-app-bg');
    document.body.style.backgroundColor = '';
  }

  if (theme.font) {
    root.style.setProperty('--theme-font', theme.font);
    root.style.setProperty('--theme-text', theme.font);
    document.body.style.color = theme.font;
  } else {
    root.style.removeProperty('--theme-font');
    root.style.removeProperty('--theme-text');
    document.body.style.color = '';
  }

  if (theme.cta) {
    root.style.setProperty('--theme-cta', theme.cta);
    root.style.setProperty('--theme-primary', theme.cta);
  } else {
    root.style.removeProperty('--theme-cta');
    root.style.removeProperty('--theme-primary');
  }

  if (theme.border) {
    root.style.setProperty('--theme-border', theme.border);
  } else {
    root.style.removeProperty('--theme-border');
  }

  if (theme.hover) {
    root.style.setProperty('--theme-hover', theme.hover);
  } else {
    root.style.removeProperty('--theme-hover');
  }

  if (theme.surface) {
    root.style.setProperty('--theme-surface', theme.surface);
  } else {
    root.style.removeProperty('--theme-surface');
  }
}

export function saveTheme(theme: ThemeConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  applyTheme(theme);
  try {
    window.dispatchEvent(new CustomEvent('tmpa_theme_updated', { detail: theme }));
  } catch {}
}

export function resetTheme(): ThemeConfig {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  const root = document.documentElement;
  root.style.removeProperty('--theme-bg');
  root.style.removeProperty('--theme-app-bg');
  root.style.removeProperty('--theme-font');
  root.style.removeProperty('--theme-text');
  root.style.removeProperty('--theme-cta');
  root.style.removeProperty('--theme-primary');
  root.style.removeProperty('--theme-border');
  root.style.removeProperty('--theme-hover');
  root.style.removeProperty('--theme-surface');
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
  try {
    window.dispatchEvent(new CustomEvent('tmpa_theme_updated', { detail: {} }));
  } catch {}
  return {};
}

export function initTheme() {
  const current = getSavedTheme();
  applyTheme(current);
}

/**
 * Intelligent Natural Language Theme & Prompt Parser
 * Supports free-form prompts like:
 * - "@theme cyberpunk neon ungu"
 * - "@them gaya kopi santai cokelat kayu"
 * - "@theme nuansa laut biru toska"
 * - "@them merah darah elegan"
 * - "@theme terang bersih"
 * - "@them bg:#1e1e2e cta:#89b4fa"
 * - "@theme reset"
 */
export function parseThemeCommand(commandText: string): { 
  success: boolean; 
  theme?: ThemeConfig; 
  message: string; 
  changes: Array<{ target: string; value: string }>;
  isReset?: boolean;
} {
  const clean = commandText.replace(/^@(theme|them|tema)\s*/i, '').trim();
  const lower = clean.toLowerCase();

  if (!clean || lower === 'help' || lower === 'info') {
    return {
      success: false,
      message: `🎨 **Sistem Kustomisasi Tema Bebas (@theme / @them)**\n\nCukup ketik konsep warna atau suasana yang Anda inginkan, sistem akan langsung meracik palet warna yang serasi!\n\n**Contoh Penggunaan Bebas (Prompt Alami):**\n- \`@them tema cyberpunk neon ungu\`\n- \`@them gaya kopi hangat vintage cokelat\`\n- \`@them nuansa laut biru samudra tenang\`\n- \`@them emerald hijau hutan elegan\`\n- \`@them sakura pastel pink imut\`\n- \`@them merah ruby gelap mewah\`\n- \`@them minimalis monokrom abu abu\`\n- \`@them luxury black gold emas\`\n- \`@them mode terang putih bersih\`\n- \`@them reset\` (Kembali ke tema default)`,
      changes: []
    };
  }

  // 1. Reset check
  if (lower === 'reset' || lower === 'default' || lower === 'asli' || lower === 'standar') {
    resetTheme();
    return {
      success: true,
      isReset: true,
      theme: {},
      message: '✅ Tema aplikasi telah dikembalikan ke **TMPA Dark Default**.',
      changes: [{ target: 'Seluruh Tampilan', value: 'Default Theme' }]
    };
  }

  // 2. Cek apakah pengguna memasukkan key:value spesifik (misal: bg:#123 cta:#456)
  if (clean.includes(':') || clean.includes('=')) {
    const currentTheme = { ...getSavedTheme() };
    const tokens = clean.split(/\s+/);
    const changes: Array<{ target: string; value: string }> = [];

    for (const token of tokens) {
      if (!token.includes(':') && !token.includes('=')) continue;
      const [rawKey, ...valParts] = token.split(/[:=]/);
      const key = rawKey.toLowerCase().trim();
      let val = valParts.join(':').trim();

      if (!val) continue;
      if (/^[0-9a-fA-F]{3,8}$/.test(val)) {
        val = `#${val}`;
      }

      if (key === 'bg' || key === 'background') {
        currentTheme.bg = val;
        changes.push({ target: 'Latar Belakang (Background)', value: val });
      } else if (key === 'font' || key === 'text' || key === 'color') {
        currentTheme.font = val;
        changes.push({ target: 'Warna Teks (Font)', value: val });
      } else if (key === 'cta' || key === 'button' || key === 'primary') {
        currentTheme.cta = val;
        changes.push({ target: 'Tombol Aksi (CTA)', value: val });
      } else if (key === 'border' || key === 'stroke') {
        currentTheme.border = val;
        changes.push({ target: 'Garis Pembatas (Border)', value: val });
      } else if (key === 'hover') {
        currentTheme.hover = val;
        changes.push({ target: 'Efek Hover', value: val });
      } else if (key === 'surface' || key === 'card') {
        currentTheme.surface = val;
        changes.push({ target: 'Kontainer Kartu (Surface)', value: val });
      }
    }

    if (changes.length > 0) {
      saveTheme(currentTheme);
      return {
        success: true,
        theme: currentTheme,
        message: `🎨 **Visual Theme Kustom Berhasil Diterapkan** secara instan!`,
        changes
      };
    }
  }

  // 3. Cek Preset & Smart Natural Language Matching
  let matchedPresetKey: string | null = null;
  let highestScore = 0;

  for (const [key, preset] of Object.entries(THEME_PRESETS)) {
    if (key === 'default') continue;
    let score = 0;

    // Cek nama preset langsung
    if (lower.includes(key) || lower.includes(preset.name.toLowerCase())) {
      score += 5;
    }

    // Cek keyword dalam prompt user
    for (const kw of preset.keywords) {
      if (lower.includes(kw)) {
        score += 2;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      matchedPresetKey = key;
    }
  }

  if (matchedPresetKey && highestScore >= 2) {
    const preset = THEME_PRESETS[matchedPresetKey];
    saveTheme(preset.config);
    const changes = Object.entries(preset.config)
      .filter(([k]) => k !== 'name')
      .map(([k, v]) => ({
        target: k.toUpperCase(),
        value: v || ''
      }));

    return {
      success: true,
      theme: preset.config,
      message: `✨ AI mengenali konsep tema Anda dan menerapkan **${preset.name}**!`,
      changes
    };
  }

  // 4. Dynamic Auto-Harmonizer untuk prompt warna bebas
  // Misal: user mengetik "tema ungu galaxy gelap" atau "warna kuning matahari" atau "toska"
  const colorMap: Record<string, { bg: string; font: string; cta: string; border: string; hover: string; surface: string; name: string }> = {
    ungu: { bg: '#13091e', font: '#f3e8ff', cta: '#a855f7', border: '#3b185f', hover: '#9333ea', surface: '#1e0f2f', name: 'Mystic Purple' },
    purple: { bg: '#13091e', font: '#f3e8ff', cta: '#a855f7', border: '#3b185f', hover: '#9333ea', surface: '#1e0f2f', name: 'Mystic Purple' },
    violet: { bg: '#120b22', font: '#ede9fe', cta: '#8b5cf6', border: '#2e1065', hover: '#7c3aed', surface: '#1c1033', name: 'Cosmic Violet' },
    biru: { bg: '#051329', font: '#e0f2fe', cta: '#38bdf8', border: '#075985', hover: '#0284c7', surface: '#0c2242', name: 'Azure Sky' },
    blue: { bg: '#051329', font: '#e0f2fe', cta: '#38bdf8', border: '#075985', hover: '#0284c7', surface: '#0c2242', name: 'Azure Sky' },
    cyan: { bg: '#041d24', font: '#ecfeff', cta: '#06b6d4', border: '#155e75', hover: '#0891b2', surface: '#082f3a', name: 'Cyan Glow' },
    toska: { bg: '#041f1f', font: '#f0fdfa', cta: '#14b8a6', border: '#115e59', hover: '#0d9488', surface: '#083333', name: 'Teal Oasis' },
    teal: { bg: '#041f1f', font: '#f0fdfa', cta: '#14b8a6', border: '#115e59', hover: '#0d9488', surface: '#083333', name: 'Teal Oasis' },
    hijau: { bg: '#041a0e', font: '#dcfce7', cta: '#22c55e', border: '#14532d', hover: '#16a34a', surface: '#092a18', name: 'Vibrant Green' },
    green: { bg: '#041a0e', font: '#dcfce7', cta: '#22c55e', border: '#14532d', hover: '#16a34a', surface: '#092a18', name: 'Vibrant Green' },
    kuning: { bg: '#1c1604', font: '#fefce8', cta: '#eab308', border: '#713f12', hover: '#ca8a04', surface: '#2d2308', name: 'Solar Amber' },
    yellow: { bg: '#1c1604', font: '#fefce8', cta: '#eab308', border: '#713f12', hover: '#ca8a04', surface: '#2d2308', name: 'Solar Amber' },
    oranye: { bg: '#1c0e04', font: '#ffedd5', cta: '#f97316', border: '#7c2d12', hover: '#ea580c', surface: '#2d180a', name: 'Warm Orange' },
    orange: { bg: '#1c0e04', font: '#ffedd5', cta: '#f97316', border: '#7c2d12', hover: '#ea580c', surface: '#2d180a', name: 'Warm Orange' },
    merah: { bg: '#1a0507', font: '#ffe4e6', cta: '#ef4444', border: '#7f1d1d', hover: '#dc2626', surface: '#2d0c10', name: 'Blaze Red' },
    red: { bg: '#1a0507', font: '#ffe4e6', cta: '#ef4444', border: '#7f1d1d', hover: '#dc2626', surface: '#2d0c10', name: 'Blaze Red' },
    pink: { bg: '#1a0814', font: '#fdf2f8', cta: '#f43f5e', border: '#831843', hover: '#e11d48', surface: '#2b0f23', name: 'Rose Bloom' },
    hitam: { bg: '#000000', font: '#f4f4f5', cta: '#3b82f6', border: '#27272a', hover: '#2563eb', surface: '#09090b', name: 'Midnight Onyx' },
    putih: { bg: '#f8fafc', font: '#0f172a', cta: '#2563eb', border: '#cbd5e1', hover: '#1d4ed8', surface: '#ffffff', name: 'Clean Daylight' }
  };

  for (const [colorWord, palette] of Object.entries(colorMap)) {
    if (lower.includes(colorWord)) {
      saveTheme(palette);
      const changes = Object.entries(palette)
        .filter(([k]) => k !== 'name')
        .map(([k, v]) => ({
          target: k.toUpperCase(),
          value: v
        }));

      return {
        success: true,
        theme: palette,
        message: `🎨 AI berhasil meracik palet warna **${palette.name}** berdasarkan prompt "${clean}"!`,
        changes
      };
    }
  }

  // Fallback: Default to an elegant Modern Slate palette if prompt is unrecognized but not empty
  const customPalette = {
    bg: '#0f172a',
    font: '#f8fafc',
    cta: '#38bdf8',
    border: '#1e293b',
    hover: '#0284c7',
    surface: '#1e293b',
    name: `Tema Kustom "${clean}"`
  };

  saveTheme(customPalette);
  return {
    success: true,
    theme: customPalette,
    message: `✨ AI menginterpretasikan prompt "${clean}" dan menerapkan palet modern bernuansa Slate Blue!`,
    changes: [
      { target: 'Background', value: customPalette.bg },
      { target: 'Warna Teks', value: customPalette.font },
      { target: 'Tombol CTA', value: customPalette.cta },
      { target: 'Garis Pembatas', value: customPalette.border }
    ]
  };
}
