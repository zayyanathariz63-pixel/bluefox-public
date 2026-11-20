export type SeasonMissionId = 'kriminal-bank' | 'escape-prison' | 'cheater';

export interface GtaSeasonPassState {
  completedMissions: SeasonMissionId[];
  gtaBuffExpiresAt: number | null;
  bestClearTimeSec: number | null;
  lastUpdatedAt: number;
}

const STORAGE_KEY = 'tmpa_gta_season_pass_v1';
export const GTA_BUFF_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const GTA_BUFF_MULTIPLIER = 0.8; // 20% OFF AI quota consumption
export const GTA_SEASON_PASS_EVENT = 'tmpa_gta_season_pass_updated';

const DEFAULT_STATE: GtaSeasonPassState = {
  completedMissions: [],
  gtaBuffExpiresAt: null,
  bestClearTimeSec: null,
  lastUpdatedAt: 0,
};

export function getSeasonPassState(): GtaSeasonPassState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      completedMissions: Array.isArray(parsed.completedMissions)
        ? parsed.completedMissions
        : [],
      gtaBuffExpiresAt:
        typeof parsed.gtaBuffExpiresAt === 'number' ? parsed.gtaBuffExpiresAt : null,
      bestClearTimeSec:
        typeof parsed.bestClearTimeSec === 'number' ? parsed.bestClearTimeSec : null,
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
    completedMissions: completed,
    gtaBuffExpiresAt: Date.now() + GTA_BUFF_DURATION_MS,
    bestClearTimeSec: nextBest,
    lastUpdatedAt: Date.now(),
  });
}

export function resetSeasonPassProgress(): GtaSeasonPassState {
  return saveSeasonPassState({
    ...DEFAULT_STATE,
    lastUpdatedAt: Date.now(),
  });
}

export function applyGtaBuffDiscount(value: number): number {
  if (!isGtaBuffActive()) return value;
  return Number((value * GTA_BUFF_MULTIPLIER).toFixed(2));
}

export function formatDiscountedPercent(basePercent: number): string {
  const val = Number((basePercent * GTA_BUFF_MULTIPLIER).toFixed(1));
  return Number.isInteger(val) ? `${val}%` : `${val}%`;
}
