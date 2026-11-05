export type SmartSelectLevel = 'none' | 'auto' | 'low' | 'medium' | 'high' | 'max';
export type ReasoningEffortLevel = 'none' | 'auto' | 'low' | 'medium' | 'high' | 'max';

export const SMART_SELECT_STEPS: Array<'none' | 'low' | 'medium' | 'high' | 'max'> = ['none', 'low', 'medium', 'high', 'max'];

export interface SmartSelectInfo {
  level: 'none' | 'auto' | 'low' | 'medium' | 'high' | 'max';
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export const SMART_SELECT_CONFIG: Record<'none' | 'auto' | 'low' | 'medium' | 'high' | 'max', SmartSelectInfo> = {
  none: {
    level: 'none',
    label: 'None (Tanpa Penalaran)',
    shortLabel: 'None',
    description: 'Respon instan tanpa proses thinking/penalaran latar belakang.',
    color: '#64748b',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    borderClass: 'border-slate-300 dark:border-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300'
  },
  auto: {
    level: 'auto',
    label: 'Auto (Otomatis Sesuai Model)',
    shortLabel: 'Auto',
    description: 'Tingkat penalaran dikelola secara dinamis dan optimal oleh model.',
    color: '#0284c7',
    bgClass: 'bg-sky-50 dark:bg-sky-950/50',
    borderClass: 'border-sky-300 dark:border-sky-800',
    textClass: 'text-sky-700 dark:text-sky-300'
  },
  low: {
    level: 'low',
    label: 'Low (Penalaran Ringan)',
    shortLabel: 'Low',
    description: 'Penalaran cepat dan hemat untuk percakapan santai & pertanyaan langsung.',
    color: '#0ea5e9',
    bgClass: 'bg-sky-100 dark:bg-sky-950/60',
    borderClass: 'border-sky-300 dark:border-sky-800',
    textClass: 'text-sky-700 dark:text-sky-300'
  },
  medium: {
    level: 'medium',
    label: 'Medium (Penalaran Seimbang)',
    shortLabel: 'Medium',
    description: 'Analisis terstruktur, seimbang antara kecepatan respon dan kedalaman logika.',
    color: '#2563eb',
    bgClass: 'bg-blue-100 dark:bg-blue-950/60',
    borderClass: 'border-blue-300 dark:border-blue-800',
    textClass: 'text-blue-700 dark:text-blue-300'
  },
  high: {
    level: 'high',
    label: 'High (Penalaran Tinggi)',
    shortLabel: 'High',
    description: 'Daya pemikiran mendalam untuk logika kompleks, analisis data, dan multimodal.',
    color: '#9333ea',
    bgClass: 'bg-purple-100 dark:bg-purple-950/60',
    borderClass: 'border-purple-300 dark:border-purple-800',
    textClass: 'text-purple-700 dark:text-purple-300'
  },
  max: {
    level: 'max',
    label: 'Max (Penalaran Maksimal)',
    shortLabel: 'Max',
    description: 'Penalaran intensif tingkat puncak untuk riset mendalam, arsitektur sistem, dan pembuktian logika rumit.',
    color: '#7c3aed',
    bgClass: 'bg-fuchsia-100 dark:bg-fuchsia-950/60',
    borderClass: 'border-fuchsia-400 dark:border-fuchsia-800',
    textClass: 'text-fuchsia-800 dark:text-fuchsia-200'
  }
};

/**
 * Aturan pemilihan effort berdasarkan model:
 * 1. Agnes 2.5 (agnes-2.5-flash): Low, Medium, High
 * 2. Agnes 3.0 (agnes-3.0-flash): Low, Medium, High, Max
 * 3. GLM (glm-4.7-flash): Auto (effort tidak bisa dipilih / terkunci)
 */
export function getAllowedEffortsForModel(modelId: string): Array<'low' | 'medium' | 'high' | 'max' | 'auto'> {
  const clean = (modelId || '').toLowerCase();
  if (clean.includes('glm') || clean.includes('dilo') || clean.includes('deepseek')) {
    return ['auto'];
  }
  if (clean.includes('2.5') || clean.includes('standard') || clean.includes('standar')) {
    return ['low', 'medium', 'high'];
  }
  // Default: Agnes 3.0 Pro
  return ['low', 'medium', 'high', 'max'];
}

export function isEffortSelectable(modelId: string): boolean {
  const clean = (modelId || '').toLowerCase();
  if (clean.includes('glm') || clean.includes('dilo') || clean.includes('deepseek')) {
    return false; // Terkunci ke Auto
  }
  return true;
}

/**
 * Smart Select - Mengatur level penalaran/thinking AI
 * Aturan khusus router baru:
 * - Agnes 2.5: Low, Medium, High (default medium)
 * - Agnes 3.0: Low, Medium, High, Max (default high)
 * - GLM (glm-4.7-flash): Selalu 'auto'
 */
export function getSmartSelectEffort(
  modelId: string,
  levelOrMode: SmartSelectLevel
): ReasoningEffortLevel {
  const clean = (modelId || '').toLowerCase();

  // GLM 4.7 Flash: Terkunci ke 'auto'
  if (clean.includes('glm') || clean.includes('dilo') || clean.includes('deepseek')) {
    return 'auto';
  }

  // Agnes 2.5 Flash: Low, Medium, High (tidak ada 'max')
  if (clean.includes('2.5') || clean.includes('standard') || clean.includes('standar')) {
    if (levelOrMode === 'low' || levelOrMode === 'medium' || levelOrMode === 'high') {
      return levelOrMode;
    }
    if (levelOrMode === 'max') {
      return 'high'; // Clamp max ke high untuk 2.5
    }
    return 'medium'; // Auto default Agnes 2.5 adalah Medium
  }

  // Agnes 3.0 Flash: Low, Medium, High, Max
  if (levelOrMode === 'low' || levelOrMode === 'medium' || levelOrMode === 'high' || levelOrMode === 'max') {
    return levelOrMode;
  }
  return 'high'; // Auto default Agnes 3.0 adalah High
}

// Backward compatibility alias for existing calls
export function getReasoningEffort(
  modelId: string,
  isPenalaranActiveOrLevel: boolean | SmartSelectLevel
): ReasoningEffortLevel {
  if (typeof isPenalaranActiveOrLevel === 'string') {
    return getSmartSelectEffort(modelId, isPenalaranActiveOrLevel);
  }
  return getSmartSelectEffort(modelId, isPenalaranActiveOrLevel ? 'high' : 'auto');
}

/**
 * Ekstraksi blok pemikiran/penalaran (<think>...</think>) dari teks AI
 */
export function parseThinking(rawText: string, explicitThinking?: string) {
  if (explicitThinking && explicitThinking.trim()) {
    const cleanContent = (rawText || '')
      .replace(/<(?:think|thinking|reasoning)>[\s\S]*?(?:<\/(?:think|thinking|reasoning)>|$)/gi, '')
      .trim();
    return {
      thinking: explicitThinking.trim(),
      content: cleanContent,
      isThinkingComplete: true
    };
  }

  if (!rawText) {
    return { thinking: '', content: '', isThinkingComplete: true };
  }

  const thinkRegex = /<(?:think|thinking|reasoning)>([\s\S]*?)(?:<\/(?:think|thinking|reasoning)>|$)/i;
  const match = rawText.match(thinkRegex);

  if (match) {
    const thinking = match[1].trim();
    const isThinkingComplete = /<\/(?:think|thinking|reasoning)>/i.test(rawText);
    const content = rawText.replace(thinkRegex, '').trim();
    return {
      thinking,
      content,
      isThinkingComplete
    };
  }

  return {
    thinking: '',
    content: rawText,
    isThinkingComplete: true
  };
}
