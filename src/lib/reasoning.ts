export type SmartSelectLevel = 'none' | 'low' | 'medium' | 'high' | 'auto';
export type ReasoningEffortLevel = 'none' | 'low' | 'medium' | 'high';

export const SMART_SELECT_STEPS: Array<'none' | 'low' | 'medium' | 'high'> = ['none', 'low', 'medium', 'high'];

export interface SmartSelectInfo {
  level: 'none' | 'low' | 'medium' | 'high';
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export const SMART_SELECT_CONFIG: Record<'none' | 'low' | 'medium' | 'high', SmartSelectInfo> = {
  none: {
    level: 'none',
    label: 'None (Tanpa Penalaran)',
    shortLabel: 'None',
    description: 'Respon instan dan langsung tanpa proses thinking/penalaran latar belakang.',
    color: '#64748b',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    borderClass: 'border-slate-300 dark:border-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300'
  },
  low: {
    level: 'low',
    label: 'Low (Penalaran Ringan)',
    shortLabel: 'Low',
    description: 'Penalaran cepat dan hemat untuk percakapan santai sehari-hari.',
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
    label: 'High (Penalaran Tertinggi)',
    shortLabel: 'High',
    description: 'Daya pemikiran paling mendalam untuk logika kompleks, coding, dan visual multimodal.',
    color: '#9333ea',
    bgClass: 'bg-purple-100 dark:bg-purple-950/60',
    borderClass: 'border-purple-300 dark:border-purple-800',
    textClass: 'text-purple-700 dark:text-purple-300'
  }
};

/**
 * Smart Select - Mengatur level penalaran/thinking AI dari 'none' sampai 'high'
 * Nilai yang dapat ditarik: none (0) -> low (1) -> medium (2) -> high (3)
 * Jika mode 'auto', sistem menarik otomatis sesuai model:
 * 1. Bluefox Pro (agnes-3.0-flash) -> 'high'
 * 2. Bluefox Standard (agnes-2.5-flash) -> 'medium'
 * 3. Bluefox Dilo (deepseek-v4.1-flash-free) -> 'low'
 */
export function getSmartSelectEffort(
  modelId: string,
  levelOrMode: SmartSelectLevel
): ReasoningEffortLevel {
  if (levelOrMode === 'none' || levelOrMode === 'low' || levelOrMode === 'medium' || levelOrMode === 'high') {
    return levelOrMode;
  }

  // Jika mode Auto:
  const clean = (modelId || '').toLowerCase();
  if (clean.includes('dilo') || clean.includes('deepseek') || clean.includes('laguna') || clean.includes('nemotron')) {
    return 'low';
  }
  if (clean.includes('2.5') || clean.includes('standard') || clean.includes('standar') || clean.includes('tencent') || clean.includes('jev')) {
    return 'medium';
  }
  if (clean.includes('3.0') || clean.includes('pro') || clean.includes('agnes') || clean.includes('v2') || clean.includes('qwen')) {
    return 'high';
  }
  return 'high';
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
