import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Lock, Check, Zap, RotateCcw } from 'lucide-react';
import {
  formatGtaBuffRemaining,
  getSeasonPassState,
  GTA_SEASON_PASS_EVENT,
  GtaSeasonPassState,
  hasTopiGtb6Unlocked,
  isGtaBuffActive,
  isMissionCompleted,
  isMissionUnlocked,
  isTopiGtb6Equipped,
  resetSeasonPassProgress,
  SeasonMissionId,
  toggleTopiGtb6Equipped,
} from '../lib/gtaSeasonPass';
import { KriminalBankModal } from './KriminalBankModal';
import { EscapePrisonModal } from './EscapePrisonModal';
import { TopiGtb6Svg } from './TopiGtb6Svg';

interface GtaSeasonPassBannerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  canAccess?: boolean;
  onNotify?: (message: string) => void;
}

interface MissionNode {
  id: SeasonMissionId;
  number: string;
  line1: string;
  line2?: string;
}

const MISSIONS: MissionNode[] = [
  { id: 'kriminal-bank', number: '1', line1: 'Kriminal', line2: 'bank' },
  { id: 'escape-prison', number: '2', line1: 'Escape from', line2: 'prison' },
  { id: 'cheater', number: '3', line1: 'cheater' },
];

function GrandTheftBluefoxLogo() {
  return (
    <svg
      viewBox="0 0 210 122"
      className="w-[140px] sm:w-[168px] h-auto select-none drop-shadow-[0_3px_8px_rgba(59,20,107,0.3)]"
      role="img"
      aria-label="grand theft bluefox"
    >
      <defs>
        <linearGradient id="gtbSunsetFillFull" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F36A78" />
          <stop offset="52%" stopColor="#F87572" />
          <stop offset="100%" stopColor="#FF9B55" />
        </linearGradient>
      </defs>
      <g
        style={{
          fontFamily: '"Archivo Black", "Plus Jakarta Sans", sans-serif',
          fontWeight: 900,
        }}
        fill="url(#gtbSunsetFillFull)"
        stroke="#111827"
        strokeWidth="7.5"
        strokeLinejoin="round"
        paintOrder="stroke fill"
        letterSpacing="-1.5"
      >
        <text x="6" y="39" fontSize="42">
          grand
        </text>
        <text x="26" y="76" fontSize="41">
          theft
        </text>
        <text x="6" y="112" fontSize="40">
          bluefox
        </text>
      </g>
    </svg>
  );
}

export function GtaSeasonPassBanner({
  isOpen,
  onClose,
  isAdmin,
  canAccess,
  onNotify,
}: GtaSeasonPassBannerProps) {
  const hasPassAccess = canAccess ?? isAdmin;
  const [seasonState, setSeasonState] = useState<GtaSeasonPassState>(() =>
    getSeasonPassState()
  );
  const [isKriminalBankOpen, setIsKriminalBankOpen] = useState(false);
  const [isEscapePrisonOpen, setIsEscapePrisonOpen] = useState(false);
  const [buffRemaining, setBuffRemaining] = useState<string>(() =>
    formatGtaBuffRemaining()
  );
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncState = () => {
      const next = getSeasonPassState();
      setSeasonState(next);
      setBuffRemaining(formatGtaBuffRemaining(next));
    };
    window.addEventListener(GTA_SEASON_PASS_EVENT, syncState);
    const timer = setInterval(() => {
      setBuffRemaining(formatGtaBuffRemaining(getSeasonPassState()));
    }, 1000);
    return () => {
      window.removeEventListener(GTA_SEASON_PASS_EVENT, syncState);
      clearInterval(timer);
    };
  }, []);

  if (!hasPassAccess) return null;

  const triggerNotice = (msg: string) => {
    setInlineNotice(msg);
    onNotify?.(msg);
    setTimeout(() => {
      setInlineNotice((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  const handleRiset = () => {
    if (!isAdmin) return;
    const next = resetSeasonPassProgress();
    setSeasonState(next);
    setBuffRemaining('00m 00s');
    triggerNotice('Event direset oleh Admin.');
  };

  const handleNodeClick = (mission: MissionNode) => {
    if (mission.id === 'kriminal-bank') {
      setIsKriminalBankOpen(true);
      return;
    }

    const unlocked = isMissionUnlocked(mission.id, seasonState);
    if (mission.id === 'escape-prison') {
      if (!unlocked) {
        triggerNotice('Selesaikan Kriminal bank terlebih dahulu.');
        return;
      }
      setIsEscapePrisonOpen(true);
      return;
    }

    if (mission.id === 'cheater') {
      triggerNotice(
        unlocked
          ? 'Cheater (Mission 3) telah terbuka.'
          : 'Selesaikan Escape from prison terlebih dahulu.'
      );
    }
  };

  const mission1Done = isMissionCompleted('kriminal-bank', seasonState);
  const mission2Done = isMissionCompleted('escape-prison', seasonState);
  const buffActive = isGtaBuffActive(seasonState);
  const hatUnlocked = hasTopiGtb6Unlocked(seasonState);
  const hatEquipped = isTopiGtb6Equipped(seasonState);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex flex-col overflow-hidden select-none"
            style={{
              background:
                'linear-gradient(160deg, #F36A78 0%, #F87572 34%, #FF9B55 72%, #FFB458 100%)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Grand Theft Bluefox 6 Session Pass"
          >
            {/* Subtle Magenta / Violet Depth Accent */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 85% 18%, rgba(201,52,155,0.28), transparent 46%), radial-gradient(circle at 12% 90%, rgba(123,32,143,0.24), transparent 52%)',
              }}
            />

            {/* Minimal Top Navigation Bar */}
            <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 pt-4 pb-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Kembali ke Settings"
                className="w-11 h-11 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft size={22} strokeWidth={2.4} />
              </button>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="px-3 py-1 rounded-full bg-[#3B146B] text-white text-[11px] font-extrabold tracking-widest uppercase border border-white/20 shadow-xs">
                  SEASON PASS
                </span>

                {buffActive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#7B208F] text-[#FFB458] text-[11px] font-bold border border-white/20 shadow-xs">
                    <Zap size={11} strokeWidth={2.6} />
                    <span>20% OFF · {buffRemaining}</span>
                  </span>
                )}

                {hatUnlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = toggleTopiGtb6Equipped();
                      setSeasonState(next);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3B146B] text-white text-[11px] font-bold border border-[#FFB458]/50 shadow-xs cursor-pointer"
                    title="Toggle Topi GTB 6 pada Avatar"
                  >
                    <TopiGtb6Svg className="w-5 h-3.5" />
                    <span className="text-[#FFB458]">
                      Topi GTB 6 {hatEquipped ? 'Dipakai' : 'Nonaktif'}
                    </span>
                  </button>
                )}
              </div>

              {/* Admin-Only Riset Button */}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleRiset}
                  className="h-10 px-3.5 rounded-full bg-[#3B146B] hover:bg-[#7B208F] active:scale-95 text-white text-xs font-extrabold tracking-wide inline-flex items-center gap-1.5 border border-white/20 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <RotateCcw size={13} strokeWidth={2.5} />
                  <span>Riset</span>
                </button>
              ) : (
                <span className="h-10 px-3 rounded-full bg-[#3B146B]/85 text-[#FFB458] text-[11px] font-extrabold tracking-wider uppercase inline-flex items-center border border-white/20 shrink-0">
                  Co-admin
                </span>
              )}
            </header>

            {/* Clean Full-Screen Main Canvas */}
            <main className="relative z-10 flex-1 flex flex-col justify-between max-w-3xl w-full mx-auto px-5 sm:px-8 pt-4 pb-10">
              {/* Top Stacked Wordmark */}
              <div className="pt-2">
                <GrandTheftBluefoxLogo />
              </div>

              {/* Centered Horizontal Scrollable Track */}
              <div className="my-auto overflow-x-auto no-scrollbar snap-x snap-mandatory py-6 -mx-5 px-5 sm:mx-0 sm:px-0">
                <div className="flex items-start min-w-max">
                  {MISSIONS.map((mission, idx) => {
                    const unlocked = isMissionUnlocked(mission.id, seasonState);
                    const completed = isMissionCompleted(mission.id, seasonState);
                    const isPrimaryActive = mission.id === 'kriminal-bank' || unlocked;

                    const segmentCompleted =
                      (idx === 0 && mission1Done) || (idx === 1 && mission2Done);
                    const segmentActiveGlow =
                      (idx === 0 && !mission1Done) ||
                      (idx === 1 && mission1Done && !mission2Done);

                    return (
                      <div key={mission.id} className="flex items-start snap-start">
                        <button
                          type="button"
                          onClick={() => handleNodeClick(mission)}
                          className="group relative flex flex-col items-center w-[124px] sm:w-[148px] shrink-0 focus:outline-none cursor-pointer"
                        >
                          <div className="relative flex items-center justify-center w-[80px] h-[80px]">
                            <div
                              className={`w-[80px] h-[80px] rounded-full flex items-center justify-center transition-transform duration-200 group-active:scale-95 ${
                                isPrimaryActive
                                  ? 'shadow-[0_10px_24px_rgba(59,20,107,0.42)] ring-2 ring-[#F36A78]/90 group-hover:scale-105'
                                  : 'ring-2 ring-slate-200/45 shadow-sm'
                              }`}
                              style={{
                                background: isPrimaryActive
                                  ? 'linear-gradient(135deg, #3B146B 0%, #7B208F 52%, #C9349B 100%)'
                                  : '#94A3B8',
                              }}
                            >
                              {isPrimaryActive ? (
                                <span
                                  className="text-[42px] font-extrabold leading-none"
                                  style={{
                                    background:
                                      'linear-gradient(180deg, #FFB458 0%, #F87572 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                  }}
                                >
                                  {mission.number}
                                </span>
                              ) : (
                                <Lock size={24} strokeWidth={2.4} className="text-slate-100/90" />
                              )}
                            </div>

                            {completed && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#3B146B] border-2 border-[#FFB458] text-[#FFB458] flex items-center justify-center shadow-sm"
                              >
                                <Check size={14} strokeWidth={3} />
                              </span>
                            )}
                          </div>

                          <div className="mt-3 text-center leading-[1.08]">
                            <span
                              className={`block text-[20px] sm:text-[22px] font-bold tracking-tight ${
                                isPrimaryActive ? 'text-[#111827]' : 'text-[#3B146B]/50'
                              }`}
                              style={{ fontFamily: 'var(--font-slab)' }}
                            >
                              {mission.line1}
                            </span>
                            {mission.line2 && (
                              <span
                                className={`block text-[20px] sm:text-[22px] font-bold tracking-tight ${
                                  isPrimaryActive ? 'text-[#111827]' : 'text-[#3B146B]/50'
                                }`}
                                style={{ fontFamily: 'var(--font-slab)' }}
                              >
                                {mission.line2}
                              </span>
                            )}
                          </div>
                        </button>

                        {idx < MISSIONS.length - 1 && (
                          <div
                            aria-hidden="true"
                            className="flex items-center h-[80px] w-[86px] sm:w-[116px] -mx-4 shrink-0"
                          >
                            <div className="relative w-full h-[7px] rounded-full bg-[#64748B]/35 overflow-hidden">
                              {segmentCompleted && (
                                <div
                                  className="h-full w-full rounded-full transition-all duration-500"
                                  style={{
                                    background:
                                      'linear-gradient(90deg, #7B208F 0%, #C9349B 100%)',
                                  }}
                                />
                              )}
                              {segmentActiveGlow && (
                                <div
                                  className="h-full w-[40%] rounded-full"
                                  style={{
                                    background:
                                      'linear-gradient(90deg, #7B208F 0%, #C9349B 100%)',
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clean Footer Toast Slot */}
              <div className="h-10 flex items-center justify-center">
                {inlineNotice && (
                  <div className="px-4 py-1.5 rounded-full bg-[#3B146B]/90 text-white text-xs font-semibold shadow-sm">
                    {inlineNotice}
                  </div>
                )}
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <KriminalBankModal
        isOpen={isKriminalBankOpen}
        onClose={() => setIsKriminalBankOpen(false)}
        onMissionSuccess={(nextState) => {
          setSeasonState(nextState);
          setBuffRemaining(formatGtaBuffRemaining(nextState));
          onNotify?.('Kriminal Bank selesai! Usage Limit 20% OFF aktif 1 jam.');
        }}
      />

      <EscapePrisonModal
        isOpen={isEscapePrisonOpen}
        onClose={() => setIsEscapePrisonOpen(false)}
        onMissionSuccess={(nextState) => {
          setSeasonState(nextState);
          onNotify?.('Escape from Prison selesai! Topi GTB 6 terpasang di avatar Bluefox.');
        }}
      />
    </>
  );
}
