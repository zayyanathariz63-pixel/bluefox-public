export interface ThemeConfig {
  bg?: string;
  font?: string;
  cta?: string;
  border?: string;
  hover?: string;
  surface?: string;
}

const STORAGE_KEY = 'tmpa_custom_theme';

export const THEME_PRESETS: Record<string, { name: string; config: ThemeConfig }> = {
  default: {
    name: 'TMPA Dark (Default)',
    config: {
      bg: '#000000',
      font: '#f3f4f6',
      cta: '#2563eb',
      border: '#1f2937',
      hover: '#1d4ed8',
      surface: '#0a0a0c'
    }
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    config: {
      bg: '#1e1e2e',
      font: '#cdd6f4',
      cta: '#89b4fa',
      border: '#313244',
      hover: '#b4befe',
      surface: '#181825'
    }
  },
  dracula: {
    name: 'Dracula Dark',
    config: {
      bg: '#282a36',
      font: '#f8f8f2',
      cta: '#bd93f9',
      border: '#44475a',
      hover: '#ff79c6',
      surface: '#21222c'
    }
  },
  nord: {
    name: 'Nord Aurora',
    config: {
      bg: '#2e3440',
      font: '#eceff4',
      cta: '#88c0d0',
      border: '#434c5e',
      hover: '#81a1c1',
      surface: '#242933'
    }
  },
  tokyonight: {
    name: 'Tokyo Night',
    config: {
      bg: '#1a1b26',
      font: '#c0caf5',
      cta: '#7aa2f7',
      border: '#292e42',
      hover: '#bb9af7',
      surface: '#16161e'
    }
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    config: {
      bg: '#0d1117',
      font: '#00ffcc',
      cta: '#ff007f',
      border: '#30363d',
      hover: '#ff0055',
      surface: '#161b22'
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
  } else {
    root.style.removeProperty('--theme-bg');
    root.style.removeProperty('--theme-app-bg');
  }

  if (theme.font) {
    root.style.setProperty('--theme-font', theme.font);
    root.style.setProperty('--theme-text', theme.font);
  } else {
    root.style.removeProperty('--theme-font');
    root.style.removeProperty('--theme-text');
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

  // Update background-color on body if custom bg is set
  if (theme.bg) {
    document.body.style.backgroundColor = theme.bg;
  } else {
    document.body.style.backgroundColor = '';
  }
  if (theme.font) {
    document.body.style.color = theme.font;
  } else {
    document.body.style.color = '';
  }
}

export function saveTheme(theme: ThemeConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  applyTheme(theme);
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
  return {};
}

export function initTheme() {
  const current = getSavedTheme();
  applyTheme(current);
}

export function parseThemeCommand(commandText: string): { 
  success: boolean; 
  theme?: ThemeConfig; 
  message: string; 
  changes: Array<{ target: string; value: string }>;
  isReset?: boolean;
} {
  // Format examples:
  // @theme bg:#1e1e2e font:#f5e0dc cta:#89b4fa
  // @theme bg:#1e1e2e
  // @theme cta:#89b4fa
  // @theme preset catppuccin
  // @theme catppuccin
  // @theme reset
  
  const clean = commandText.replace(/^@theme\s*/i, '').trim();
  if (!clean || clean.toLowerCase() === 'help' || clean.toLowerCase() === 'info') {
    return {
      success: false,
      message: `🎨 **Sintaks @theme Customization**:\n\n- \`@theme [target]:[nilai_warna]\` (Contoh: \`@theme bg:#1e1e2e cta:#89b4fa\`)\n- \`@theme preset [nama]\` (Pilihan: \`catppuccin\`, \`dracula\`, \`nord\`, \`tokyonight\`, \`cyberpunk\`)\n- \`@theme reset\` (Kembalikan ke tema default TMPA)\n\n**Target Elemen yang Didukung:**\n- \`bg:\` Warna latar belakang aplikasi\n- \`font:\` / \`text:\` Warna teks utama\n- \`cta:\` / \`button:\` Warna tombol aksi utama\n- \`border:\` Warna garis pembatas\n- \`hover:\` Warna efek hover\n- \`surface:\` Warna kontainer/kartu`,
      changes: []
    };
  }

  if (clean.toLowerCase() === 'reset' || clean.toLowerCase() === 'default') {
    resetTheme();
    return {
      success: true,
      isReset: true,
      theme: {},
      message: '✅ Tema aplikasi telah di-reset kembali ke **TMPA Dark Default**.',
      changes: [{ target: 'Semua Elemen', value: 'Default Theme' }]
    };
  }

  // Check if preset name is provided
  const presetKey = clean.toLowerCase().replace(/^preset\s+/i, '').trim();
  if (THEME_PRESETS[presetKey]) {
    const preset = THEME_PRESETS[presetKey];
    saveTheme(preset.config);
    const changes = Object.entries(preset.config).map(([k, v]) => ({
      target: k.toUpperCase(),
      value: v || ''
    }));
    return {
      success: true,
      theme: preset.config,
      message: `✨ Tema berhasil diubah ke **Preset ${preset.name}**!`,
      changes
    };
  }

  // Parse key:value pairs or space separated items
  const currentTheme = { ...getSavedTheme() };
  const tokens = clean.split(/\s+/);
  const changes: Array<{ target: string; value: string }> = [];

  for (const token of tokens) {
    if (!token.includes(':') && !token.includes('=')) continue;
    const [rawKey, ...valParts] = token.split(/[:=]/);
    const key = rawKey.toLowerCase().trim();
    let val = valParts.join(':').trim();

    if (!val) continue;
    // Fix hex code if user omitted #
    if (/^[0-9a-fA-F]{3,8}$/.test(val)) {
      val = `#${val}`;
    }

    if (key === 'bg' || key === 'background') {
      currentTheme.bg = val;
      changes.push({ target: 'Background (Latar Belakang)', value: val });
    } else if (key === 'font' || key === 'text' || key === 'color') {
      currentTheme.font = val;
      changes.push({ target: 'Font & Text (Warna Teks)', value: val });
    } else if (key === 'cta' || key === 'button' || key === 'primary') {
      currentTheme.cta = val;
      changes.push({ target: 'CTA Button (Tombol Aksi)', value: val });
    } else if (key === 'border' || key === 'stroke') {
      currentTheme.border = val;
      changes.push({ target: 'Border (Garis Pembatas)', value: val });
    } else if (key === 'hover') {
      currentTheme.hover = val;
      changes.push({ target: 'Hover Effect (Efek Hover)', value: val });
    } else if (key === 'surface' || key === 'card') {
      currentTheme.surface = val;
      changes.push({ target: 'Surface Container (Kartu)', value: val });
    }
  }

  if (changes.length === 0) {
    return {
      success: false,
      message: `⚠️ Format perintah tidak valid. Gunakan format \`@theme [target]:[nilai_warna]\` (Contoh: \`@theme bg:#1e1e2e cta:#89b4fa\`) atau \`@theme reset\`.`,
      changes: []
    };
  }

  saveTheme(currentTheme);
  return {
    success: true,
    theme: currentTheme,
    message: `🎨 **Visual Theme Berhasil Diperbarui** secara live! Variabel CSS root telah diterapkan langsung tanpa reload.`,
    changes
  };
}
