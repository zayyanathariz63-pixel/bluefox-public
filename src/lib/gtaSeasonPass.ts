export type SeasonMissionId = 'kriminal-bank' | 'escape-prison' | 'cheater';
export type SeasonRewardItemId = 'topi-gtb-6';

export interface GtaSeasonPassState {
  completedMissions: SeasonMissionId[];
  gtaBuffExpiresAt: number | null;
  bestClearTimeSec: number | null;
  unlockedItems: SeasonRewardItemId[];
  equippedHat: boolean;
  gtbLimit30Active: boolean;
  lastUpdatedAt: number;
}

const STORAGE_KEY = 'tmpa_gta_season_pass_v1';
export const GTA_BUFF_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const GTA_BUFF_MULTIPLIER = 0.8; // 20% OFF AI quota consumption
export const GTA_LIMIT_30_MULTIPLIER = 0.7; // 30% OFF AI quota consumption (Mission 3 reward)
export const GTA_SEASON_PASS_EVENT = 'tmpa_gta_season_pass_updated';

const DEFAULT_STATE: GtaSeasonPassState = {
  completedMissions: [],
  gtaBuffExpiresAt: null,
  bestClearTimeSec: null,
  unlockedItems: [],
  equippedHat: false,
  gtbLimit30Active: false,
  lastUpdatedAt: 0,
};

export function getSeasonPassState(): GtaSeasonPassState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const completedMissions: SeasonMissionId[] = Array.isArray(parsed.completedMissions)
      ? parsed.completedMissions
      : [];
    return {
      completedMissions,
      gtaBuffExpiresAt:
        typeof parsed.gtaBuffExpiresAt === 'number' ? parsed.gtaBuffExpiresAt : null,
      bestClearTimeSec:
        typeof parsed.bestClearTimeSec === 'number' ? parsed.bestClearTimeSec : null,
      unlockedItems: Array.isArray(parsed.unlockedItems)
        ? parsed.unlockedItems
        : [],
      equippedHat: Boolean(parsed.equippedHat),
      gtbLimit30Active:
        Boolean(parsed.gtbLimit30Active) || completedMissions.includes('cheater'),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === 'number' ? parsed.lastUpdatedAt : 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveSeasonPassState(next: GtaSeasonPassState): GtaSeasonPassState {
  if (typeof window === 'undefined') return next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(GTA_SEASON_PASS_EVENT, { detail: next }));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function isMissionCompleted(
  missionId: SeasonMissionId,
  state?: GtaSeasonPassState
): boolean {
  const current = state || getSeasonPassState();
  return current.completedMissions.includes(missionId);
}

export function isMissionUnlocked(
  missionId: SeasonMissionId,
  state?: GtaSeasonPassState
): boolean {
  const current = state || getSeasonPassState();
  if (missionId === 'kriminal-bank') return true;
  if (missionId === 'escape-prison') {
    return current.completedMissions.includes('kriminal-bank');
  }
  if (missionId === 'cheater') {
    return current.completedMissions.includes('escape-prison');
  }
  return false;
}

export function isGtaBuffActive(state?: GtaSeasonPassState): boolean {
  const current = state || getSeasonPassState();
  if (!current.gtaBuffExpiresAt) return false;
  return current.gtaBuffExpiresAt > Date.now();
}

export function hasGtbLimit30Active(state?: GtaSeasonPassState): boolean {
  const current = state || getSeasonPassState();
  return Boolean(current.gtbLimit30Active || current.completedMissions.includes('cheater'));
}

export function getActiveQuotaDiscountPercent(state?: GtaSeasonPassState): number {
  const current = state || getSeasonPassState();
  if (hasGtbLimit30Active(current)) return 30;
  if (isGtaBuffActive(current)) return 20;
  return 0;
}

export function getGtaBuffRemainingMs(state?: GtaSeasonPassState): number {
  const current = state || getSeasonPassState();
  if (!current.gtaBuffExpiresAt) return 0;
  return Math.max(0, current.gtaBuffExpiresAt - Date.now());
}

export function formatGtaBuffRemaining(state?: GtaSeasonPassState): string {
  const remainingMs = getGtaBuffRemainingMs(state);
  if (remainingMs <= 0) return '00m 00s';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

export function hasTopiGtb6Unlocked(state?: GtaSeasonPassState): boolean {
  const current = state || getSeasonPassState();
  return (
    current.unlockedItems.includes('topi-gtb-6') ||
    current.completedMissions.includes('escape-prison')
  );
}

export function isTopiGtb6Equipped(state?: GtaSeasonPassState): boolean {
  const current = state || getSeasonPassState();
  return hasTopiGtb6Unlocked(current) && current.equippedHat;
}

export function toggleTopiGtb6Equipped(): GtaSeasonPassState {
  const current = getSeasonPassState();
  if (!hasTopiGtb6Unlocked(current)) return current;
  return saveSeasonPassState({
    ...current,
    equippedHat: !current.equippedHat,
    lastUpdatedAt: Date.now(),
  });
}

export function completeKriminalBankMission(clearTimeSec?: number): GtaSeasonPassState {
  const current = getSeasonPassState();
  const completed = current.completedMissions.includes('kriminal-bank')
    ? current.completedMissions
    : [...current.completedMissions, 'kriminal-bank' as SeasonMissionId];

  const nextBest =
    typeof clearTimeSec === 'number' && clearTimeSec > 0
      ? current.bestClearTimeSec !== null
        ? Math.min(current.bestClearTimeSec, clearTimeSec)
        : clearTimeSec
      : current.bestClearTimeSec;

  return saveSeasonPassState({
    ...current,
    completedMissions: completed,
    gtaBuffExpiresAt: Date.now() + GTA_BUFF_DURATION_MS,
    bestClearTimeSec: nextBest,
    lastUpdatedAt: Date.now(),
  });
}

export function completeEscapePrisonMission(): GtaSeasonPassState {
  const current = getSeasonPassState();
  const completed = current.completedMissions.includes('escape-prison')
    ? current.completedMissions
    : [...current.completedMissions, 'escape-prison' as SeasonMissionId];
  const unlocked = current.unlockedItems.includes('topi-gtb-6')
    ? current.unlockedItems
    : [...current.unlockedItems, 'topi-gtb-6' as SeasonRewardItemId];

  return saveSeasonPassState({
    ...current,
    completedMissions: completed,
    unlockedItems: unlocked,
    equippedHat: true,
    lastUpdatedAt: Date.now(),
  });
}

export function completeCheaterMission(): GtaSeasonPassState {
  const current = getSeasonPassState();
  const completed = current.completedMissions.includes('cheater')
    ? current.completedMissions
    : [...current.completedMissions, 'cheater' as SeasonMissionId];

  return saveSeasonPassState({
    ...current,
    completedMissions: completed,
    gtbLimit30Active: true,
    lastUpdatedAt: Date.now(),
  });
}

export function resetSeasonPassProgress(): GtaSeasonPassState {
  return saveSeasonPassState({
    ...DEFAULT_STATE,
    lastUpdatedAt: Date.now(),
  });
}

export function resetSeasonPassFromMission(fromMission: 1 | 2 | 3): GtaSeasonPassState {
  if (fromMission === 1) {
    return resetSeasonPassProgress();
  }

  const current = getSeasonPassState();
  if (fromMission === 2) {
    return saveSeasonPassState({
      ...current,
      completedMissions: ['kriminal-bank'],
      unlockedItems: [],
      equippedHat: false,
      gtbLimit30Active: false,
      lastUpdatedAt: Date.now(),
    });
  }

  // fromMission === 3: keep Mission 1 & Mission 2 complete so Mission 3 (Cheater) is unlocked immediately
  return saveSeasonPassState({
    ...current,
    completedMissions: ['kriminal-bank', 'escape-prison'],
    unlockedItems: ['topi-gtb-6'],
    equippedHat: current.unlockedItems.includes('topi-gtb-6') ? current.equippedHat : true,
    gtbLimit30Active: false,
    lastUpdatedAt: Date.now(),
  });
}

export function applyGtaBuffDiscount(value: number): number {
  const discountPct = getActiveQuotaDiscountPercent();
  if (discountPct === 30) {
    return Number((value * GTA_LIMIT_30_MULTIPLIER).toFixed(2));
  }
  if (discountPct === 20) {
    return Number((value * GTA_BUFF_MULTIPLIER).toFixed(2));
  }
  return value;
}

export function formatDiscountedPercent(basePercent: number, discountPct?: number): string {
  const pct = typeof discountPct === 'number' ? discountPct : getActiveQuotaDiscountPercent();
  const multiplier = pct === 30 ? GTA_LIMIT_30_MULTIPLIER : pct === 20 ? GTA_BUFF_MULTIPLIER : 1;
  const val = Number((basePercent * multiplier).toFixed(1));
  return Number.isInteger(val) ? `${val}%` : `${val}%`;
}
