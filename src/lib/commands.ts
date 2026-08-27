export interface TriggerCommand {
  id: string;
  name: string;
  category: 'ai' | 'system' | 'theme';
  categoryLabel: string;
  badge: string;
  description: string;
  syntax: string;
  example: string;
  iconName: string;
  hasParameter?: boolean;
  parameterPlaceholder?: string;
}

export const TRIGGER_COMMANDS: TriggerCommand[] = [
  // 1. AI & Web Search Module Commands
  {
    id: 'web-search',
    name: '@search',
    category: 'ai',
    categoryLabel: 'Web Search',
    badge: 'Dual-Engine',
    description: 'Pencarian web real-time (Tavily AI & DuckDuckGo fallback) dengan rincian sumber terverifikasi.',
    syntax: '@search [topik / kata kunci yang dicari]',
    example: '@search harga emas antam hari ini dan tren pasar',
    iconName: 'Globe',
    hasParameter: true,
    parameterPlaceholder: 'ketik topik atau informasi web terbaru yang dicari...'
  },
  {
    id: 'verifyai',
    name: '@verifyai',
    category: 'ai',
    categoryLabel: 'AI Module',
    badge: 'Self-Correction',
    description: 'Mengoreksi & memvalidasi akurasi data serta logika berpikir dari jawaban AI sebelumnya.',
    syntax: '@verifyai [opsional: fokus evaluasi]',
    example: '@verifyai periksa kembali rumus matematika di atas',
    iconName: 'ShieldCheck',
    hasParameter: true,
    parameterPlaceholder: 'pertanyaan atau fokus koreksi...'
  },
  {
    id: 'deep-verify',
    name: '@deep verify',
    category: 'ai',
    categoryLabel: 'AI Module',
    badge: 'Deep Reasoning',
    description: 'Memicu analisis mendalam dengan pemikiran bertahap (step-by-step reasoning) sebelum menjawab.',
    syntax: '@deep verify [pertanyaan/masalah]',
    example: '@deep verify jelaskan arsitektur distributed consensus Raft',
    iconName: 'BrainCircuit',
    hasParameter: true,
    parameterPlaceholder: 'topik atau masalah kompleks yang dianalisis...'
  },
  {
    id: 'creative',
    name: '@creative',
    category: 'ai',
    categoryLabel: 'AI Module',
    badge: 'Dynamic Style',
    description: 'Mengaktifkan gaya eksploratif, variasi diksi kaya, dan pendekatan pembuatan ide kreatif.',
    syntax: '@creative [instruksi/topik ide]',
    example: '@creative buat 5 konsep branding nama brand minuman sehat',
    iconName: 'Sparkles',
    hasParameter: true,
    parameterPlaceholder: 'topik atau konsep ide yang ingin dieksplorasi...'
  },
  {
    id: 'memory',
    name: '@memory',
    category: 'ai',
    categoryLabel: 'AI Module',
    badge: 'Context Storage',
    description: 'Menampilkan memori aktif percakapan atau menyimpan konteks penting baru ke profil AI.',
    syntax: '@memory [opsional: teks informasi penting]',
    example: '@memory Saya seorang software engineer dengan stack TypeScript dan React',
    iconName: 'BookmarkCheck',
    hasParameter: true,
    parameterPlaceholder: 'informasi konteks baru untuk disimpan...'
  },

  // 2. System Controller (@bluefox) Commands
  {
    id: 'bluefox-profile',
    name: '@bluefox profile',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Identity',
    description: 'Menampilkan kartu informasi identitas pengguna (User ID unik, Email aktif, dan Plan).',
    syntax: '@bluefox profile',
    example: '@bluefox profile',
    iconName: 'UserCheck',
    hasParameter: false
  },
  {
    id: 'bluefox-activity',
    name: '@bluefox activity',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'History Log',
    description: 'Menampilkan log aktivitas riwayat chat, tanggal pembuatan, dan pembaruan terakhir.',
    syntax: '@bluefox activity',
    example: '@bluefox activity',
    iconName: 'Activity',
    hasParameter: false
  },
  {
    id: 'bluefox-kuota',
    name: '@bluefox kuota',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Quota Monitor',
    description: 'Menampilkan indikator batas penggunaan (Limit 5 jam, Weekend limit, & Custom API limit).',
    syntax: '@bluefox kuota',
    example: '@bluefox kuota',
    iconName: 'Gauge',
    hasParameter: false
  },
  {
    id: 'bluefox-reset',
    name: '@bluefox reset',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Dev Reset',
    description: 'Mereset kuota dan batas penggunaan AI ke 0% secara instan (Mode Development & Pengujian).',
    syntax: '@bluefox reset',
    example: '@bluefox reset',
    iconName: 'RotateCcw',
    hasParameter: false
  },
  {
    id: 'bluefox-personalization',
    name: '@bluefox personalization',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Profile Sync',
    description: 'Membaca string instruksi lalu menyimpan secara otomatis ke profil personalisasi user.',
    syntax: '@bluefox personalization [teks_instruksi]',
    example: '@bluefox personalization Selalu berikan jawaban dalam format poin-poin ringkas',
    iconName: 'Sliders',
    hasParameter: true,
    parameterPlaceholder: 'ketik preferensi respon AI Anda...'
  },
  {
    id: 'bluefox-download',
    name: '@bluefox download',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Export MD',
    description: 'Mengonversi percakapan sesi aktif menjadi berkas .md dan memicu auto-download ke perangkat.',
    syntax: '@bluefox download',
    example: '@bluefox download',
    iconName: 'Download',
    hasParameter: false
  },
  {
    id: 'bluefox-pin',
    name: '@bluefox pin',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Pin Session',
    description: 'Mengubah status percakapan aktif menjadi tersemat (pinned) pada bagian atas sidebar.',
    syntax: '@bluefox pin',
    example: '@bluefox pin',
    iconName: 'Pin',
    hasParameter: false
  },
  {
    id: 'bluefox-delete',
    name: '@bluefox delete',
    category: 'system',
    categoryLabel: 'System Controller',
    badge: 'Session Reset',
    description: 'Menghapus data percakapan sesi aktif dan mengembalikan layar ke tampilan chat baru kosong.',
    syntax: '@bluefox delete',
    example: '@bluefox delete',
    iconName: 'Trash2',
    hasParameter: false
  },

  // 3. Visual Customization (@theme / @them) Commands
  {
    id: 'theme-custom',
    name: '@theme',
    category: 'theme',
    categoryLabel: 'Visual Styling',
    badge: 'Live Auto-Harmonizer',
    description: 'Kustomisasi tema bebas dengan ketikan suasana warna apa saja (@them cyberpunk, @them nuansa laut biru, @them hijau hutan, dll).',
    syntax: '@theme [konsep suasana warna] atau @theme reset',
    example: '@them gaya kopi hangat vintage cokelat',
    iconName: 'Palette',
    hasParameter: true,
    parameterPlaceholder: 'nuansa laut biru / tema cyberpunk neon / hijau hutan / reset'
  }
];

export function filterTriggerCommands(rawQuery: string): TriggerCommand[] {
  const query = rawQuery.trim().toLowerCase();
  
  if (!query || query === '@') {
    return TRIGGER_COMMANDS;
  }

  const cleanQuery = query.startsWith('@') ? query.slice(1) : query;

  return TRIGGER_COMMANDS.filter(cmd => {
    const cmdClean = cmd.name.toLowerCase().replace('@', '');
    const idClean = cmd.id.toLowerCase();
    const descClean = cmd.description.toLowerCase();
    const badgeClean = cmd.badge.toLowerCase();
    
    // Direct prefix match or sub-command match (e.g. "bluefox p" -> "bluefox profile" or "bluefox personalization")
    if (cmdClean.startsWith(cleanQuery) || idClean.startsWith(cleanQuery)) {
      return true;
    }

    // Support @them matching @theme
    if ((cleanQuery === 'them' || cleanQuery.startsWith('them')) && cmd.category === 'theme') {
      return true;
    }

    // Match each word in multi-word command query (e.g. "bluefox pers" or "deep ver")
    const searchTerms = cleanQuery.split(/\s+/).filter(Boolean);
    const matchesAllTerms = searchTerms.every(term => 
      cmdClean.includes(term) || 
      descClean.includes(term) || 
      badgeClean.includes(term) ||
      (term === 'them' && cmd.category === 'theme')
    );

    return matchesAllTerms;
  });
}

// Memory Storage Helpers for @memory
const MEMORY_STORAGE_KEY = 'tmpa_active_memories';

export function getActiveMemories(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveActiveMemory(newContext: string): string[] {
  const memories = getActiveMemories();
  const trimmed = newContext.trim();
  if (trimmed && !memories.includes(trimmed)) {
    memories.push(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    }
  }
  return memories;
}

export function clearActiveMemories() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MEMORY_STORAGE_KEY);
  }
}
