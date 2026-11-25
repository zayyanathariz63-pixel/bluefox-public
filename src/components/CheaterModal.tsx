import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Laptop,
  Terminal,
  Bug,
  Shield,
  Wrench,
  Upload,
  Rocket,
  Lock,
  Check,
  Zap,
  AlertTriangle,
  Play,
  RefreshCw,
  Activity,
  RotateCcw,
  Clock,
  Users,
  X,
} from 'lucide-react';
import {
  completeCheaterMission,
  getSeasonPassState,
  isMissionCompleted,
  GtaSeasonPassState,
} from '../lib/gtaSeasonPass';
import { gtaAudio } from '../lib/gtaAudio';
import { ViceCityGameFrame } from './ViceCityGameFrame';
import { CheaterVictorySequence } from './CheaterVictorySequence';

interface CheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionSuccess?: (state: GtaSeasonPassState) => void;
}

type ModalStage = 'briefing' | 'playing' | 'victory_anim';
type DesktopAppId = 'store' | 'cheat' | 'studio' | 'publish_mod' | 'publish_asli';
type PackageType = 'gtb_mod' | 'gtb_asli_palsu';
type ArrestReason = 'heat_100' | 'heat_clear_fail' | 'timeout';

interface MalwareModuleDef {
  id: 'trojan' | 'bookit' | 'botnet' | 'ssl';
  name: string;
  payloadName: string;
  desc: string;
  baseCost: number;
  maxLevel: number;
  victimsPerSec: number;
  heatPerSec: number;
}

interface CheatBaitItem {
  id: string;
  code: string;
  label: string;
}

interface BuiltPackage {
  type: PackageType;
  version: number;
  payloadId: string;
  payloadName: string;
  cheatBait: CheatBaitItem | null;
  victimsPerTick: number;
  heatPerTick: number;
  builtAt: number;
}

interface ActivityLogItem {
  id: string;
  time: string;
  tag: 'SYSTEM' | 'BUILD' | 'PUBLISH' | 'DOWNLOAD' | 'INJECT' | 'TELEMETRY' | 'WARN' | 'ALERT';
  text: string;
}

const TARGET_VICTIMS = 1000;
const MISSION_DURATION_SEC = 10 * 60; // 10 minutes
const CHEAT_CODE_VICTIM_BONUS = 1;
const CHEAT_CODE_HEAT_PENALTY = 5;

const MALWARE_MODULES: MalwareModuleDef[] = [
  {
    id: 'trojan',
    name: 'Trojan',
    payloadName: 'Trojan Injector',
    desc: '+1 korban/detik dan +0,5 heat/detik per level.',
    baseCost: 70,
    maxLevel: 3,
    victimsPerSec: 1,
    heatPerSec: 0.5,
  },
  {
    id: 'bookit',
    name: 'Bookit',
    payloadName: 'Bookit Stealth',
    desc: '+3 korban/detik dan +1 heat/detik per level.',
    baseCost: 80,
    maxLevel: 3,
    victimsPerSec: 3,
    heatPerSec: 1,
  },
  {
    id: 'botnet',
    name: 'Bootnet Mirror',
    payloadName: 'Bootnet Mirror',
    desc: '+5 korban/detik dan +4 heat/detik per level.',
    baseCost: 110,
    maxLevel: 3,
    victimsPerSec: 5,
    heatPerSec: 4,
  },
  {
    id: 'ssl',
    name: 'SSL',
    payloadName: 'Spoofed SSL',
    desc: '+8 korban/detik dan +10 heat/detik per level.',
    baseCost: 130,
    maxLevel: 3,
    victimsPerSec: 8,
    heatPerSec: 10,
  },
];

const INITIAL_CHEAT_BAITS: CheatBaitItem[] = [
  {
    id: 'bait-godmode',
    code: 'BLUEFOX-GODMODE-999',
    label: 'Umpan Mode Kebal (+1 korban/detik, +5 heat/detik)',
  },
  {
    id: 'bait-limit',
    code: 'INFINITE-LIMIT-VIP',
    label: 'Umpan Limit AI Gratis (+1 korban/detik, +5 heat/detik)',
  },
  {
    id: 'bait-unlock',
    code: 'UNLOCK-ALL-GTB6',
    label: 'Umpan Buka Semua Misi (+1 korban/detik, +5 heat/detik)',
  },
  {
    id: 'bait-mod',
    code: 'TURBO-FPS-MODMENU',
    label: 'Umpan Mod Menu VIP (+1 korban/detik, +5 heat/detik)',
  },
];

const CHEAT_PREFIXES = ['GTB6-VIP', 'VICE-MOD', 'FOX-ELITE', 'CRYPTO-PASS', 'HYPER-UNLOCK'];
const CHEAT_SUFFIXES = ['PRO99', 'MAX77', 'ULTRA', 'ZEROX', 'PRIME', 'ALPHA'];

interface HeatClearLevelConfig {
  level: number;
  greenWidthPct: number;
  speedMultiplier: number;
  modeLabel: string;
}

const HEAT_CLEAR_TOTAL_LEVELS = 5;
const HEAT_CLEAR_MIN_SPEED = 0.85;
const HEAT_CLEAR_MAX_SPEED = 2.0;

function generateHeatClearRun(): HeatClearLevelConfig[] {
  const profiles = [
    { minW: 16, maxW: 19, minS: 0.85, maxS: 1.05, label: 'Zona Kecil · Pelan' },
    { minW: 22, maxW: 26, minS: 1.15, maxS: 1.45, label: 'Seimbang' },
    { minW: 28, maxW: 35, minS: 1.6, maxS: 2.0, label: 'Zona Besar · Cepat' },
  ];

  return Array.from({ length: HEAT_CLEAR_TOTAL_LEVELS }, (_, idx) => {
    const pick = profiles[Math.floor(Math.random() * profiles.length)];
    const t = Math.random();
    const greenWidthPct = Math.round(pick.minW + t * (pick.maxW - pick.minW));
    const rawSpeed = pick.minS + t * (pick.maxS - pick.minS);
    const speedMultiplier = Math.min(
      HEAT_CLEAR_MAX_SPEED,
      Math.max(HEAT_CLEAR_MIN_SPEED, Number(rawSpeed.toFixed(2)))
    );
    return {
      level: idx + 1,
      greenWidthPct,
      speedMultiplier,
      modeLabel: pick.label,
    };
  });
}

function formatLogTime(): string {
  const d = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatCountdown(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const ss = (clamped % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function randomGreenStart(widthPct: number): number {
  const margin = 12;
  const maxStart = Math.max(margin, 100 - margin - widthPct);
  return Number((margin + Math.random() * (maxStart - margin)).toFixed(1));
}

export function CheaterModal({ isOpen, onClose, onMissionSuccess }: CheaterModalProps) {
  const [stage, setStage] = useState<ModalStage>('briefing');
  const [muted, setMuted] = useState<boolean>(() => gtaAudio.isMuted());
  const [completed, setCompleted] = useState<boolean>(() =>
    isMissionCompleted('cheater', getSeasonPassState())
  );

  // Underground laptop state
  const [openApp, setOpenApp] = useState<DesktopAppId | null>(null);
  const [victims, setVictims] = useState<number>(0);
  const [heat, setHeat] = useState<number>(0);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(MISSION_DURATION_SEC);
  const [arrestReason, setArrestReason] = useState<ArrestReason | null>(null);

  // Store Malware levels (0..3) + selected payload (only Injector Dasar owned at start)
  const [moduleLevels, setModuleLevels] = useState<Record<MalwareModuleDef['id'], number>>({
    trojan: 0,
    bookit: 0,
    botnet: 0,
    ssl: 0,
  });
  const [selectedPayloadId, setSelectedPayloadId] = useState<string>('basic');

  // Cheat Code GTB 6 state (unselected at start so player opts in consciously)
  const [cheatBaits, setCheatBaits] = useState<CheatBaitItem[]>(INITIAL_CHEAT_BAITS);
  const [selectedBaitId, setSelectedBaitId] = useState<string | null>(null);

  // GTB Studio builder state
  const [studioBuildType, setStudioBuildType] = useState<PackageType>('gtb_mod');
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildProgress, setBuildProgress] = useState<number>(0);
  const [builtModPkg, setBuiltModPkg] = useState<BuiltPackage | null>(null);
  const [builtFakeAsliPkg, setBuiltFakeAsliPkg] = useState<BuiltPackage | null>(null);

  // Live published releases
  const [publishedModPkg, setPublishedModPkg] = useState<BuiltPackage | null>(null);
  const [publishedFakeAsliPkg, setPublishedFakeAsliPkg] = useState<BuiltPackage | null>(null);

  // Heat Clear 5-level randomized balanced mini-game state
  const [heatClearOpen, setHeatClearOpen] = useState<boolean>(false);
  const [hcLevels, setHcLevels] = useState<HeatClearLevelConfig[]>(() => generateHeatClearRun());
  const [hcLevel, setHcLevel] = useState<number>(1);
  const [hcGreenStart, setHcGreenStart] = useState<number>(37);
  const [hcPointerPct, setHcPointerPct] = useState<number>(0);
  const [hcFeedback, setHcFeedback] = useState<'idle' | 'hit' | 'miss' | 'won'>('idle');
  const hcPointerRef = useRef<number>(0);
  const hcPosDirRef = useRef<{ pos: number; dir: 1 | -1 }>({ pos: 0, dir: 1 });

  // Feedback, cooldowns & logs
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [modBoostCooldownUntil, setModBoostCooldownUntil] = useState<number>(0);
  const [asliBoostCooldownUntil, setAsliBoostCooldownUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);

  const wonRef = useRef<boolean>(false);
  const arrestedRef = useRef<boolean>(false);

  const pushLog = useCallback((tag: ActivityLogItem['tag'], text: string) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: formatLogTime(),
        tag,
        text,
      },
      ...prev.slice(0, 44),
    ]);
  }, []);

  const triggerPoliceArrest = useCallback((reason: ArrestReason) => {
    if (arrestedRef.current || wonRef.current) return;
    arrestedRef.current = true;
    setArrestReason(reason);
    setOpenApp(null);
    setHeatClearOpen(false);
    gtaAudio.stopHeistBgm();
    gtaAudio.playSirenBurst(3);
    gtaAudio.playBustedSfx();
  }, []);

  const triggerVictory = useCallback(() => {
    if (wonRef.current || arrestedRef.current) return;
    wonRef.current = true;
    gtaAudio.stopHeistBgm();
    const updated = completeCheaterMission();
    setCompleted(true);
    setOpenApp(null);
    setHeatClearOpen(false);
    onMissionSuccess?.(updated);
    setStage('victory_anim');
  }, [onMissionSuccess]);

  const resetSimulation = useCallback(() => {
    wonRef.current = false;
    arrestedRef.current = false;
    setVictims(0);
    setHeat(0);
    setTimeLeftSec(MISSION_DURATION_SEC);
    setArrestReason(null);
    setOpenApp(null);
    setHeatClearOpen(false);
    setHcLevel(1);
    setHcFeedback('idle');
    setModuleLevels({ trojan: 0, bookit: 0, botnet: 0, ssl: 0 });
    setSelectedPayloadId('basic');
    setCheatBaits(INITIAL_CHEAT_BAITS);
    setSelectedBaitId(null);
    setStudioBuildType('gtb_mod');
    setIsBuilding(false);
    setBuildProgress(0);
    setBuiltModPkg(null);
    setBuiltFakeAsliPkg(null);
    setPublishedModPkg(null);
    setPublishedFakeAsliPkg(null);
    setPublishWarning(null);
    setModBoostCooldownUntil(0);
    setAsliBoostCooldownUntil(0);
    setLogs([
      {
        id: 'init-1',
        time: formatLogTime(),
        tag: 'SYSTEM',
        text: 'Laptop aktif dengan bawaan Injector Dasar. Buka GTB Studio untuk build paket pertama.',
      },
      {
        id: 'init-2',
        time: formatLogTime(),
        tag: 'SYSTEM',
        text: 'Target: 1.000 korban dalam 10:00. Beli bahan Store Malware memakai Korban.',
      },
    ]);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const state = getSeasonPassState();
      setCompleted(isMissionCompleted('cheater', state));
      setStage('briefing');
      resetSimulation();
    } else {
      gtaAudio.stopHeistBgm();
    }
  }, [isOpen, resetSimulation]);

  useEffect(() => {
    return () => {
      gtaAudio.stopHeistBgm();
    };
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    gtaAudio.setMuted(next);
  };

  const handleStartMission = () => {
    gtaAudio.unlock();
    resetSimulation();
    setStage('playing');
    gtaAudio.startCheaterBgm();
  };

  // Cooldown clock updater
  useEffect(() => {
    if (!isOpen || stage !== 'playing') return;
    const t = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(t);
  }, [isOpen, stage]);

  // 10-minute Mission Countdown Timer (runs continuously while playing & not arrested)
  useEffect(() => {
    if (!isOpen || stage !== 'playing' || arrestReason) return;

    const timer = setInterval(() => {
      if (wonRef.current || arrestedRef.current) return;
      setTimeLeftSec((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          triggerPoliceArrest('timeout');
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, stage, arrestReason, triggerPoliceArrest]);

  // Passive simulation loop (paused during Heat Clear mini-game so Heat doesn't spike mid-challenge)
  useEffect(() => {
    if (!isOpen || stage !== 'playing' || arrestReason || heatClearOpen) return;

    const timer = setInterval(() => {
      if (wonRef.current || arrestedRef.current) return;

      const hasAnyPublish = Boolean(publishedModPkg || publishedFakeAsliPkg);
      if (!hasAnyPublish) return;

      let gainedVictims = 0;
      let gainedHeat = 0;

      if (publishedModPkg) {
        gainedVictims += publishedModPkg.victimsPerTick;
        gainedHeat += publishedModPkg.heatPerTick;
      }

      if (publishedFakeAsliPkg) {
        gainedVictims += publishedFakeAsliPkg.victimsPerTick;
        gainedHeat += publishedFakeAsliPkg.heatPerTick;
      }

      setVictims((prev) => {
        const next = Math.min(TARGET_VICTIMS, prev + gainedVictims);
        if (next >= TARGET_VICTIMS) {
          triggerVictory();
        }
        return next;
      });

      setHeat((prev) => {
        const nextHeat = Math.min(100, Number((prev + gainedHeat).toFixed(1)));
        if (nextHeat >= 100) {
          triggerPoliceArrest('heat_100');
        }
        return nextHeat;
      });

      const roll = Math.random();
      if (publishedFakeAsliPkg && roll < 0.45) {
        pushLog(
          'INJECT',
          `GTB Asli (Palsu) v${publishedFakeAsliPkg.version}: +${gainedVictims} korban/detik · ${publishedFakeAsliPkg.payloadName}.`
        );
      } else if (publishedModPkg && roll < 0.85) {
        pushLog(
          'DOWNLOAD',
          `GTB 6 Mod v${publishedModPkg.version}: +${gainedVictims} korban/detik · payload aktif.`
        );
      } else {
        pushLog('TELEMETRY', `Distribusi aktif (+${gainedVictims} korban/detik, +${gainedHeat.toFixed(1)}% Heat).`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isOpen,
    stage,
    arrestReason,
    heatClearOpen,
    publishedModPkg,
    publishedFakeAsliPkg,
    pushLog,
    triggerPoliceArrest,
    triggerVictory,
  ]);

  // Heat Clear 5-Level White Line Sweep Animation (speed clamped 0.85x - 2.00x)
  useEffect(() => {
    if (!isOpen || stage !== 'playing' || !heatClearOpen || hcFeedback !== 'idle') return;

    const cfg = hcLevels[Math.min(hcLevels.length - 1, hcLevel - 1)];
    const BASE_PCT_PER_SEC = 65; // keeps 0.85x-2.00x responsive & playable on Android touch
    hcPosDirRef.current = { pos: 4, dir: 1 };
    hcPointerRef.current = 4;
    setHcPointerPct(4);

    let lastTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      let { pos, dir } = hcPosDirRef.current;
      pos += dir * cfg.speedMultiplier * BASE_PCT_PER_SEC * dt;
      if (pos >= 100) {
        pos = 100 - (pos - 100);
        dir = -1;
      } else if (pos <= 0) {
        pos = Math.abs(pos);
        dir = 1;
      }

      const clamped = Math.max(0, Math.min(100, pos));
      hcPosDirRef.current = { pos: clamped, dir };
      hcPointerRef.current = clamped;
      setHcPointerPct(clamped);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, stage, heatClearOpen, hcLevels, hcLevel, hcFeedback]);

  const handleOpenApp = (app: DesktopAppId) => {
    gtaAudio.playCyberClickSfx();
    setPublishWarning(null);
    setOpenApp(app);
  };

  const getModuleCost = (mod: MalwareModuleDef, lv: number) =>
    Math.round(mod.baseCost * Math.pow(1.65, lv));

  const handleUpgradeModule = (mod: MalwareModuleDef) => {
    const curLv = moduleLevels[mod.id];
    if (curLv >= mod.maxLevel) return;
    const cost = getModuleCost(mod, curLv);
    if (victims < cost) {
      pushLog('WARN', `Korban belum cukup untuk ${mod.name} (butuh ${cost} Korban).`);
      return;
    }

    gtaAudio.playBuildCompleteSfx();
    setVictims((v) => Math.max(0, v - cost));
    const nextLv = curLv + 1;
    setModuleLevels((prev) => ({ ...prev, [mod.id]: nextLv }));
    setSelectedPayloadId(mod.id);
    pushLog(
      'SYSTEM',
      `Store Malware: ${mod.name} dibeli ke Lv ${nextLv} (-${cost} Korban). Payload ${mod.payloadName} dipilih.`
    );
  };

  const ownedPayloads = [
    {
      id: 'basic',
      name: 'Injector Dasar (Bawaan)',
      victimsBonus: 0,
      heatBonus: 0,
      unlocked: true,
    },
    ...MALWARE_MODULES.map((m) => {
      const lv = Math.max(1, moduleLevels[m.id]);
      return {
        id: m.id,
        name: `${m.payloadName} (Lv ${moduleLevels[m.id]})`,
        victimsBonus: m.victimsPerSec * lv,
        heatBonus: Number((m.heatPerSec * lv).toFixed(1)),
        unlocked: moduleLevels[m.id] > 0,
      };
    }),
  ];

  const handleGenerateCheatCode = () => {
    gtaAudio.playCyberClickSfx();
    const prefix = CHEAT_PREFIXES[Math.floor(Math.random() * CHEAT_PREFIXES.length)];
    const suffix = CHEAT_SUFFIXES[Math.floor(Math.random() * CHEAT_SUFFIXES.length)];
    const num = Math.floor(100 + Math.random() * 899);
    const code = `${prefix}-${suffix}-${num}`;
    const newItem: CheatBaitItem = {
      id: `bait-${Date.now()}`,
      code,
      label: 'Umpan Cheat Acak (+1 korban/detik, +5 heat/detik)',
    };
    setCheatBaits((prev) => [newItem, ...prev.slice(0, 5)]);
    setSelectedBaitId(newItem.id);
    pushLog('SYSTEM', `Cheat Code GTB 6 dibuat: ${code} (+1 korban/detik, +5 heat/detik).`);
  };

  const activePayloadObj =
    ownedPayloads.find((p) => p.id === selectedPayloadId && p.unlocked) || ownedPayloads[0];
  const activeBaitObj = cheatBaits.find((b) => b.id === selectedBaitId) || null;

  const handleBuildPackage = () => {
    if (isBuilding) return;
    gtaAudio.playCyberClickSfx();
    setIsBuilding(true);
    setBuildProgress(0);

    const start = performance.now();
    const duration = 650;
    const step = (now: number) => {
      const p = Math.min(100, Math.round(((now - start) / duration) * 100));
      setBuildProgress(p);
      if (p < 100) {
        requestAnimationFrame(step);
      } else {
        setIsBuilding(false);
        gtaAudio.playBuildCompleteSfx();

        const isFakeAsli = studioBuildType === 'gtb_asli_palsu';
        // Injector Dasar baseline rate so user can always gather initial victims
        const baseVictims = isFakeAsli ? 3 : 2;
        const baseHeat = isFakeAsli ? 0.6 : 0.3;

        const baitVictims = activeBaitObj ? CHEAT_CODE_VICTIM_BONUS : 0;
        const baitHeat = activeBaitObj ? CHEAT_CODE_HEAT_PENALTY : 0;

        const prevVersion = isFakeAsli
          ? builtFakeAsliPkg?.version ?? 0
          : builtModPkg?.version ?? 0;

        const pkg: BuiltPackage = {
          type: studioBuildType,
          version: prevVersion + 1,
          payloadId: activePayloadObj.id,
          payloadName: activePayloadObj.name,
          cheatBait: activeBaitObj,
          victimsPerTick: baseVictims + activePayloadObj.victimsBonus + baitVictims,
          heatPerTick: Number((baseHeat + activePayloadObj.heatBonus + baitHeat).toFixed(1)),
          builtAt: Date.now(),
        };

        if (isFakeAsli) {
          setBuiltFakeAsliPkg(pkg);
          pushLog(
            'BUILD',
            `GTB Studio selesai merakit GTB 6 Asli (Palsu) v${pkg.version} (${pkg.victimsPerTick} korban/detik, +${pkg.heatPerTick}% Heat/detik).`
          );
        } else {
          setBuiltModPkg(pkg);
          pushLog(
            'BUILD',
            `GTB Studio selesai merakit GTB 6 Mod v${pkg.version} (${pkg.victimsPerTick} korban/detik, +${pkg.heatPerTick}% Heat/detik).`
          );
        }
      }
    };
    requestAnimationFrame(step);
  };

  const handlePublishMod = () => {
    if (!builtModPkg) {
      gtaAudio.playCyberClickSfx();
      const msg =
        'Belum ada paket GTB 6 Mod yang dirakit. Buka GTB Studio untuk Build paket terlebih dahulu.';
      setPublishWarning(msg);
      pushLog('WARN', msg);
      return;
    }

    gtaAudio.playPublishLaunchSfx();
    setPublishWarning(null);
    setPublishedModPkg(builtModPkg);
    pushLog(
      'PUBLISH',
      `GTB 6 Mod v${builtModPkg.version} dipublikasikan (+${builtModPkg.victimsPerTick} korban/detik).`
    );
  };

  const handlePublishFakeAsli = () => {
    if (!builtFakeAsliPkg) {
      gtaAudio.playCyberClickSfx();
      const msg =
        'Paket GTB 6 Asli (Palsu) belum dirakit di GTB Studio. Pilih tipe GTB 6 Asli (Palsu) dan klik Build terlebih dahulu.';
      setPublishWarning(msg);
      pushLog('WARN', msg);
      return;
    }

    gtaAudio.playPublishLaunchSfx();
    setPublishWarning(null);
    setPublishedFakeAsliPkg(builtFakeAsliPkg);
    pushLog(
      'PUBLISH',
      `GTB 6 Asli (Palsu) v${builtFakeAsliPkg.version} dirilis (+${builtFakeAsliPkg.victimsPerTick} korban/detik).`
    );
  };

  const handleManualWaveBoost = (kind: 'mod' | 'asli') => {
    const isAsli = kind === 'asli';
    const pkg = isAsli ? publishedFakeAsliPkg : publishedModPkg;
    if (!pkg) return;

    const cdUntil = isAsli ? asliBoostCooldownUntil : modBoostCooldownUntil;
    if (nowTick < cdUntil) return;

    gtaAudio.playPublishLaunchSfx();
    if (isAsli) {
      setAsliBoostCooldownUntil(Date.now() + 2800);
    } else {
      setModBoostCooldownUntil(Date.now() + 2400);
    }

    const burstVictims = isAsli ? 14 : 8;
    const burstHeat = isAsli ? 2.5 : 1.5;

    setVictims((prev) => {
      const next = Math.min(TARGET_VICTIMS, prev + burstVictims);
      if (next >= TARGET_VICTIMS) {
        triggerVictory();
      }
      return next;
    });
    setHeat((prev) => {
      const nextHeat = Math.min(100, Number((prev + burstHeat).toFixed(1)));
      if (nextHeat >= 100) {
        triggerPoliceArrest('heat_100');
      }
      return nextHeat;
    });

    pushLog(
      'INJECT',
      `Sebar ${isAsli ? 'GTB Asli (Palsu)' : 'GTB Mod'}: +${burstVictims} korban instan (+${burstHeat}% Heat).`
    );
  };

  // Start Heat Clear 5-level mini-game (randomized balanced speed & green width per level)
  const handleStartHeatClear = () => {
    if (heat <= 0 || arrestReason) return;
    gtaAudio.playCyberClickSfx();
    const runLevels = generateHeatClearRun();
    setOpenApp(null);
    setHcLevels(runLevels);
    setHcLevel(1);
    setHcGreenStart(randomGreenStart(runLevels[0].greenWidthPct));
    setHcFeedback('idle');
    setHeatClearOpen(true);
  };

  const handleHeatClearStop = useCallback(() => {
    if (!heatClearOpen || hcFeedback !== 'idle' || arrestedRef.current) return;

    const cfg = hcLevels[Math.min(hcLevels.length - 1, hcLevel - 1)];
    const pos = hcPointerRef.current;
    const edgeGrace = 1.2;
    const inGreen =
      pos >= hcGreenStart - edgeGrace && pos <= hcGreenStart + cfg.greenWidthPct + edgeGrace;

    if (inGreen) {
      gtaAudio.playHeatClearHitSfx(hcLevel);
      if (hcLevel >= hcLevels.length) {
        // All 5 levels passed! -25% Heat
        setHcFeedback('won');
        setHeat((prev) => Math.max(0, Number((prev - 25).toFixed(1))));
        pushLog('SYSTEM', 'Heat Clear 5/5 berhasil! Heat berkurang -25%.');
        setTimeout(() => {
          setHeatClearOpen(false);
          setHcFeedback('idle');
        }, 650);
      } else {
        // Advance to next randomized balanced level
        const nextLevel = hcLevel + 1;
        setHcFeedback('hit');
        setTimeout(() => {
          const nextCfg = hcLevels[nextLevel - 1];
          setHcLevel(nextLevel);
          setHcGreenStart(randomGreenStart(nextCfg.greenWidthPct));
          setHcFeedback('idle');
        }, 420);
      }
    } else {
      // Failed! +3 heat + Police Arrest Animation + GAME OVER
      gtaAudio.playHeatClearMissSfx();
      setHcFeedback('miss');
      setHeat((prev) => Math.min(100, Number((prev + 3).toFixed(1))));
      pushLog('ALERT', `Gagal di Heat Clear Lv ${hcLevel}/5 (+3% Heat). Polisi melacak sinyal!`);
      setTimeout(() => {
        triggerPoliceArrest('heat_clear_fail');
      }, 520);
    }
  }, [heatClearOpen, hcFeedback, hcLevels, hcLevel, hcGreenStart, pushLog, triggerPoliceArrest]);

  // Allow Spacebar / Enter to press Stop during Heat Clear
  useEffect(() => {
    if (!isOpen || stage !== 'playing' || !heatClearOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleHeatClearStop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, stage, heatClearOpen, handleHeatClearStop]);

  const victimPct = Math.min(100, Math.round((victims / TARGET_VICTIMS) * 100));
  const heatStatusLabel = heat >= 80 ? 'Kritis' : heat >= 45 ? 'Waspada' : 'Aman';
  const modBoostLeftSec = Math.max(0, Math.ceil((modBoostCooldownUntil - nowTick) / 1000));
  const asliBoostLeftSec = Math.max(0, Math.ceil((asliBoostCooldownUntil - nowTick) / 1000));
  const totalUpgradesBought =
    moduleLevels.trojan + moduleLevels.bookit + moduleLevels.botnet + moduleLevels.ssl;

  const activeHcConfig = hcLevels[Math.min(hcLevels.length - 1, hcLevel - 1)];

  const desktopApps: {
    id: DesktopAppId;
    label: string;
    shortLabel: string;
    subtitle: string;
    icon: typeof Bug;
    statusText: string;
    isLive?: boolean;
    isReady?: boolean;
  }[] = [
    {
      id: 'store',
      label: 'Store Malware',
      shortLabel: 'Malware',
      subtitle: 'Beli bahan pakai Korban',
      icon: Bug,
      statusText: `${totalUpgradesBought}/12 Bahan`,
    },
    {
      id: 'cheat',
      label: 'Cheat Code GTB 6',
      shortLabel: 'Cheat',
      subtitle: '+1 korban/dtk · +5 heat/dtk',
      icon: Terminal,
      statusText: activeBaitObj ? 'Umpan Aktif' : 'Nonaktif',
      isReady: Boolean(activeBaitObj),
    },
    {
      id: 'studio',
      label: 'GTB Studio',
      shortLabel: 'Studio',
      subtitle: 'Rakit paket + Injector Dasar',
      icon: Wrench,
      statusText:
        builtModPkg || builtFakeAsliPkg
          ? `${builtModPkg ? 'Mod' : ''}${builtModPkg && builtFakeAsliPkg ? ' & ' : ''}${
              builtFakeAsliPkg ? 'Asli' : ''
            } Siap`
          : 'Belum Build',
      isReady: Boolean(builtModPkg || builtFakeAsliPkg),
    },
    {
      id: 'publish_mod',
      label: 'Publish GTB Mod',
      shortLabel: 'Pub Mod',
      subtitle: 'Rilis paket mod stabil',
      icon: Upload,
      statusText: publishedModPkg
        ? `Live +${publishedModPkg.victimsPerTick}/s`
        : builtModPkg
        ? 'Siap Rilis'
        : 'Perlu Build',
      isLive: Boolean(publishedModPkg),
      isReady: Boolean(builtModPkg && !publishedModPkg),
    },
    {
      id: 'publish_asli',
      label: 'Publish GTB Asli (Palsu)',
      shortLabel: 'Pub Asli',
      subtitle: 'Rilis game palsu gelombang besar',
      icon: Rocket,
      statusText: publishedFakeAsliPkg
        ? `Live +${publishedFakeAsliPkg.victimsPerTick}/s`
        : builtFakeAsliPkg
        ? 'Siap Rilis'
        : 'Perlu Build',
      isLive: Boolean(publishedFakeAsliPkg),
      isReady: Boolean(builtFakeAsliPkg && !publishedFakeAsliPkg),
    },
  ];

  const activeAppMeta = desktopApps.find((a) => a.id === openApp);

  return (
    <>
      <AnimatePresence>
        {isOpen && stage !== 'victory_anim' && (
          <ViceCityGameFrame
            title="Cheater"
            titleId="cheater-mission-title"
            muted={muted}
            onToggleMute={handleToggleMute}
            onClose={onClose}
            closeLabel="Tutup Misi Cheater"
            topRightStatus={
              stage === 'playing' ? (
                <div className="flex items-center gap-1.5">
                  <div
                    className={`px-2 sm:px-2.5 py-1 rounded-full border shadow-xs font-mono tabular-nums text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-1 ${
                      timeLeftSec <= 60
                        ? 'bg-rose-600 text-white border-rose-300'
                        : 'bg-[#3B146B] text-[#FFB458] border-white/20'
                    }`}
                  >
                    <Clock size={12} />
                    <span>{formatCountdown(timeLeftSec)}</span>
                  </div>
                  <div className="px-2 sm:px-2.5 py-1 rounded-full bg-white/95 border border-[#111827]/15 shadow-xs font-mono tabular-nums text-[11px] sm:text-xs font-extrabold text-[#111827]">
                    {victims.toLocaleString('id-ID')}/1.000
                  </div>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-full bg-white/95 border border-[#111827]/15 shadow-xs font-mono tabular-nums text-xs font-extrabold text-[#111827]">
                  3/3
                </div>
              )
            }
          >
            {stage === 'briefing' && (
              <div className="w-full max-h-[min(68dvh,calc(92dvh-120px))] overflow-y-auto p-4 sm:p-6">
                <div className="w-full max-w-2xl mx-auto space-y-4">
                  <div className="rounded-2xl bg-[#3B146B]/65 border border-[#7B208F]/70 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                      <Laptop size={15} strokeWidth={2.4} />
                      <span>Simulasi Laptop Underground (Timer 10 Menit)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                      Anda mulai tanpa uang, hanya berbekal{' '}
                      <strong className="text-white">Injector Dasar</strong>. Rakit &amp; rilis
                      paket lewat <strong className="text-white">GTB Studio</strong>, kumpulkan
                      Korban, lalu beli bahan di{' '}
                      <strong className="text-white">Store Malware</strong> (Trojan, Bookit,
                      Bootnet Mirror, SSL) memakai Korban!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#7B208F]/35 border border-[#C9349B]/50 p-3.5">
                      <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                        <Upload size={14} strokeWidth={2.4} />
                        <span>Target 1.000 Korban</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                        Capai 1.000 korban dalam 10 menit. Membeli bahan di Store mengurangi saldo
                        Korban yang terkumpul.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#F36A78]/15 border border-[#F36A78]/50 p-3.5">
                      <div className="flex items-center gap-2 text-[#F36A78] text-xs font-extrabold uppercase tracking-wider">
                        <AlertTriangle size={14} strokeWidth={2.4} />
                        <span>Heat Clear (5 Level)</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                        Tekan Clear Heat untuk turunkan -25% Heat lewat 5 level zona hijau. Gagal
                        atau Heat 100% atau waktu habis = ditangkap polisi &amp; Game Over!
                      </p>
                    </div>
                  </div>

                  {/* Reward Preview */}
                  <div className="rounded-2xl p-4 bg-gradient-to-r from-[#3B146B] via-[#7B208F] to-[#C9349B] border border-white/15 flex items-center gap-3.5">
                    <div className="w-12 h-11 rounded-xl bg-[#FFB458]/15 border border-[#FFB458]/50 text-[#FFB458] flex items-center justify-center shrink-0">
                      <Zap size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#FFB458]">
                        Hadiah Misi 3
                      </p>
                      <p className="text-sm font-bold text-white">
                        GTB Limit 30% (Diskon Pemakaian Limit AI 30% OFF)
                      </p>
                    </div>
                  </div>

                  {completed ? (
                    <div className="w-full min-h-[52px] rounded-2xl bg-white/10 border border-[#FFB458]/40 text-white font-bold text-sm flex items-center justify-center gap-2">
                      <Check size={18} className="text-[#FFB458]" />
                      <span>Misi Selesai · GTB Limit 30% Aktif</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartMission}
                      className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Play size={18} fill="currentColor" strokeWidth={2.2} />
                      <span>PLAY CHEATER</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {stage === 'playing' && (
              <div className="w-full max-h-[min(68dvh,calc(92dvh-120px))] overflow-y-auto p-2.5 sm:p-4 text-white">
                <div className="w-full max-w-4xl mx-auto flex flex-col gap-3">
                  {/* Compact Laptop Top Bar: Timer, Victims & Heat */}
                  <div className="rounded-2xl bg-[#1D0B38] border border-[#C9349B]/40 p-3 sm:p-3.5 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#7B208F]/60 border border-[#C9349B]/50 flex items-center justify-center text-[#FFB458] shrink-0">
                          <Laptop size={15} />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                            Underground Laptop
                          </p>
                          <p className="text-[11px] text-white/65">
                            Bawaan: Injector Dasar · Beli Store pakai Korban
                          </p>
                        </div>
                      </div>

                      <div
                        className={`px-3 py-1 rounded-xl border font-mono tabular-nums text-xs font-extrabold inline-flex items-center gap-1.5 ${
                          timeLeftSec <= 60
                            ? 'bg-rose-600/90 border-rose-300 text-white'
                            : 'bg-[#3B146B] border-[#FFB458]/45 text-[#FFB458]'
                        }`}
                      >
                        <Clock size={13} />
                        <span>Sisa {formatCountdown(timeLeftSec)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Victim Progress */}
                      <div className="rounded-xl bg-[#120726] border border-white/10 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums font-bold">
                          <span className="inline-flex items-center gap-1 text-white/80">
                            <Users size={12} className="text-[#FFB458]" />
                            <span>Korban</span>
                          </span>
                          <span className="text-[#FFB458]">
                            {victims.toLocaleString('id-ID')} / 1.000 ({victimPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${victimPct}%`,
                              background: 'linear-gradient(90deg, #7B208F 0%, #FFB458 100%)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Detection / Heat Meter + Clear Heat Mini-Game Trigger */}
                      <div className="rounded-xl bg-[#120726] border border-white/10 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums font-bold">
                          <span className="inline-flex items-center gap-1 text-white/80">
                            <Shield
                              size={12}
                              className={heat >= 80 ? 'text-[#F36A78]' : 'text-[#FFB458]'}
                            />
                            <span>Deteksi / Heat</span>
                          </span>
                          <span
                            className={
                              heat >= 80
                                ? 'text-[#F36A78]'
                                : heat >= 45
                                ? 'text-[#FFB458]'
                                : 'text-emerald-400'
                            }
                          >
                            {heat.toFixed(1)}% · {heatStatusLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, heat)}%`,
                                background:
                                  heat >= 80
                                    ? 'linear-gradient(90deg, #F36A78 0%, #EF4444 100%)'
                                    : 'linear-gradient(90deg, #7B208F 0%, #FF9B55 100%)',
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleStartHeatClear}
                            disabled={heat <= 0 || Boolean(arrestReason)}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#7B208F] to-[#C9349B] hover:brightness-110 disabled:opacity-45 text-white text-[10px] font-extrabold inline-flex items-center gap-1 border border-white/20 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <RotateCcw size={10} />
                            <span>Clear Heat</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5 Desktop App Launcher Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {desktopApps.map((app) => {
                      const Icon = app.icon;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => handleOpenApp(app.id)}
                          className="text-left rounded-2xl bg-[#1D0B38] hover:bg-[#29104E] active:scale-[0.985] border border-white/12 hover:border-[#C9349B] p-3 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                app.isLive
                                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                  : app.isReady
                                  ? 'bg-[#FFB458]/20 border-[#FFB458]/50 text-[#FFB458]'
                                  : 'bg-[#7B208F]/45 border-[#C9349B]/50 text-[#FFB458]'
                              }`}
                            >
                              <Icon size={18} strokeWidth={2.3} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                                {app.label}
                              </p>
                              <p className="text-[11px] text-white/65 truncate mt-0.5">
                                {app.subtitle}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                              app.isLive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : app.isReady
                                ? 'bg-[#FFB458]/20 text-[#FFB458] border border-[#FFB458]/40'
                                : 'bg-white/10 text-white/75'
                            }`}
                          >
                            {app.statusText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Activity / Malware Log Feed */}
                  <div className="rounded-2xl bg-[#120724] border border-white/10 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/80">
                        <Activity size={13} className="text-[#C9349B]" />
                        <span>Log Aktivitas Malware</span>
                      </span>
                      <span className="text-[10px] font-mono text-white/55">
                        {publishedModPkg || publishedFakeAsliPkg
                          ? 'Distribusi Aktif'
                          : 'Menunggu Publish'}
                      </span>
                    </div>

                    <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] sm:text-[11px] leading-relaxed">
                      {logs.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-1.5 text-white/85"
                        >
                          <span className="text-white/45 mr-1.5">{entry.time}</span>
                          <span
                            className={`font-bold mr-1.5 ${
                              entry.tag === 'WARN' || entry.tag === 'ALERT'
                                ? 'text-[#F36A78]'
                                : entry.tag === 'PUBLISH' || entry.tag === 'INJECT'
                                ? 'text-[#FFB458]'
                                : entry.tag === 'BUILD'
                                ? 'text-emerald-400'
                                : 'text-[#C9349B]'
                            }`}
                          >
                            [{entry.tag}]
                          </span>
                          <span>{entry.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ViceCityGameFrame>
        )}
      </AnimatePresence>

      {/* External Full-Viewport Popups Portaled to document.body */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* 5 App Popups (Escape-from-Prison Shop style, scrollable top-to-bottom on Android) */}
            <AnimatePresence>
              {isOpen &&
                stage === 'playing' &&
                openApp &&
                !heatClearOpen &&
                !arrestReason &&
                activeAppMeta && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setOpenApp(null)}
                    className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none"
                    role="dialog"
                    aria-modal="true"
                    aria-label={activeAppMeta.label}
                  >
                    <motion.div
                      initial={{ y: 14, opacity: 0, scale: 0.96 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: 10, opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#250D47] border-2 border-[#C9349B] p-4 sm:p-5 shadow-2xl space-y-3.5 text-white"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#C9349B]/25 border border-[#FFB458]/50 text-[#FFB458] flex items-center justify-center shrink-0">
                            {(() => {
                              const Icon = activeAppMeta.icon;
                              return <Icon size={17} strokeWidth={2.5} />;
                            })()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                              {activeAppMeta.label}
                            </h3>
                            <p className="text-[11px] text-white/75 truncate">
                              {activeAppMeta.subtitle}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOpenApp(null)}
                          aria-label="Tutup Aplikasi"
                          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                        >
                          <X size={18} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Quick Status Bar */}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#3B146B]/85 border border-white/10 text-[11px] font-mono tabular-nums font-bold">
                        <span className="text-[#FFB458]">
                          {victims.toLocaleString('id-ID')} / 1.000 Korban
                        </span>
                        <span className={timeLeftSec <= 60 ? 'text-[#F36A78]' : 'text-white/90'}>
                          {formatCountdown(timeLeftSec)}
                        </span>
                        <span className={heat >= 80 ? 'text-[#F36A78]' : 'text-emerald-300'}>
                          Heat {heat.toFixed(1)}%
                        </span>
                      </div>

                      {/* Quick App Switcher Tabs inside Popup */}
                      <div className="grid grid-cols-5 gap-1 bg-[#16082C] p-1 rounded-xl border border-white/10">
                        {desktopApps.map((tab) => {
                          const TabIcon = tab.icon;
                          const active = openApp === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => handleOpenApp(tab.id)}
                              className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors cursor-pointer ${
                                active
                                  ? 'bg-gradient-to-r from-[#7B208F] to-[#C9349B] text-white'
                                  : 'text-white/65 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <TabIcon size={13} />
                              <span className="truncate max-w-full">{tab.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* APP 1: STORE MALWARE (Purchase with Victims) */}
                      {openApp === 'store' && (
                        <div className="space-y-2.5">
                          <div className="rounded-xl bg-[#3B146B]/70 border border-white/10 p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-[#FFB458]">
                                Payload Aktif untuk Studio
                              </p>
                              <p className="text-xs text-white font-mono truncate mt-0.5">
                                {activePayloadObj.name}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenApp('studio')}
                              className="px-3 py-1.5 rounded-lg bg-[#C9349B] hover:brightness-110 text-white text-xs font-bold shrink-0 cursor-pointer"
                            >
                              Ke Studio
                            </button>
                          </div>

                          {MALWARE_MODULES.map((mod) => {
                            const lv = moduleLevels[mod.id];
                            const isMax = lv >= mod.maxLevel;
                            const cost = getModuleCost(mod, lv);
                            const canBuy = !isMax && victims >= cost;
                            const isSelected = selectedPayloadId === mod.id && lv > 0;

                            return (
                              <div
                                key={mod.id}
                                className={`rounded-xl border p-3 space-y-2 ${
                                  isSelected
                                    ? 'bg-[#3B146B]/85 border-[#FFB458]/70'
                                    : 'bg-white/[0.06] border-white/10'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-extrabold text-white">
                                      {mod.name} ({lv}/{mod.maxLevel})
                                    </p>
                                    <p className="text-[11px] text-white/75 mt-0.5 leading-relaxed">
                                      {mod.desc}
                                    </p>
                                  </div>
                                  <div className="text-right font-mono text-[10px] shrink-0">
                                    <span className="block font-bold text-emerald-400">
                                      +{mod.victimsPerSec}/s
                                    </span>
                                    <span className="block font-bold text-[#F36A78]">
                                      +{mod.heatPerSec} Heat/s
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleUpgradeModule(mod)}
                                    disabled={!canBuy}
                                    className={`flex-1 min-h-[38px] px-3 rounded-lg font-mono tabular-nums font-extrabold text-xs transition-all ${
                                      isMax
                                        ? 'bg-white/10 text-white/50 cursor-default'
                                        : canBuy
                                        ? 'bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] hover:brightness-105 active:scale-95 cursor-pointer'
                                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                                    }`}
                                  >
                                    {isMax
                                      ? 'MAKS'
                                      : `${lv === 0 ? 'Beli' : 'Upgrade'} · ${cost} Korban`}
                                  </button>

                                  {lv > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        gtaAudio.playCyberClickSfx();
                                        setSelectedPayloadId(mod.id);
                                      }}
                                      className={`min-h-[38px] px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#FFB458] text-[#111827] border-[#FFB458]'
                                          : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                                      }`}
                                    >
                                      {isSelected ? 'Dipilih' : 'Pakai'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* APP 2: CHEAT CODE GTB 6 (+1 korban/detik, +5 heat/detik) */}
                      {openApp === 'cheat' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-white/80">
                              Pasang kode umpan (+1 korban/dtk, +5 heat/dtk).
                            </p>
                            <button
                              type="button"
                              onClick={handleGenerateCheatCode}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#C9349B] to-[#FF9B55] text-white text-xs font-extrabold inline-flex items-center gap-1.5 hover:brightness-110 active:scale-95 cursor-pointer shrink-0"
                            >
                              <RefreshCw size={12} />
                              <span>Kode Baru</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {cheatBaits.map((bait) => {
                              const selected = selectedBaitId === bait.id;
                              return (
                                <button
                                  key={bait.id}
                                  type="button"
                                  onClick={() => {
                                    gtaAudio.playCyberClickSfx();
                                    setSelectedBaitId(selected ? null : bait.id);
                                  }}
                                  className={`w-full text-left rounded-xl border p-3 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                    selected
                                      ? 'bg-[#3B146B] border-[#FFB458]'
                                      : 'bg-white/[0.06] border-white/10 hover:border-white/25'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-mono text-xs sm:text-sm font-extrabold text-[#FFB458] truncate">
                                      {bait.code}
                                    </p>
                                    <p className="text-[11px] text-white/75 mt-0.5 truncate">
                                      {bait.label}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0 font-mono">
                                    <span className="block text-[11px] font-bold text-emerald-400">
                                      +1 korban/s
                                    </span>
                                    <span className="block text-[10px] text-[#F36A78]">
                                      +5 Heat/s
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* APP 3: GTB STUDIO */}
                      {openApp === 'studio' && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                              1. Tipe Paket
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  gtaAudio.playCyberClickSfx();
                                  setStudioBuildType('gtb_mod');
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                  studioBuildType === 'gtb_mod'
                                    ? 'bg-[#3B146B] border-[#C9349B]'
                                    : 'bg-white/[0.06] border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs sm:text-sm font-extrabold text-white">
                                    GTB 6 Mod (+2/s dasar · +0,3 Heat/s)
                                  </span>
                                  <Upload size={14} className="text-[#C9349B]" />
                                </div>
                                <p className="text-[11px] text-white/75 mt-0.5">
                                  Stabil &amp; aman dari lonjakan deteksi awal.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  gtaAudio.playCyberClickSfx();
                                  setStudioBuildType('gtb_asli_palsu');
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                  studioBuildType === 'gtb_asli_palsu'
                                    ? 'bg-[#3B146B] border-[#FF9B55]'
                                    : 'bg-white/[0.06] border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs sm:text-sm font-extrabold text-white">
                                    GTB 6 Asli (Palsu) (+3/s dasar · +0,6 Heat/s)
                                  </span>
                                  <Rocket size={14} className="text-[#FF9B55]" />
                                </div>
                                <p className="text-[11px] text-white/75 mt-0.5">
                                  Gelombang unduhan lebih deras dengan Heat sedikit lebih tinggi.
                                </p>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                              2. Payload Malware (Bawaan: Injector Dasar)
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {ownedPayloads.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={!p.unlocked}
                                  onClick={() => {
                                    gtaAudio.playCyberClickSfx();
                                    setSelectedPayloadId(p.id);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all inline-flex items-center gap-1.5 ${
                                    !p.unlocked
                                      ? 'bg-white/5 border-white/10 text-white/35 cursor-not-allowed'
                                      : activePayloadObj.id === p.id
                                      ? 'bg-[#FFB458] text-[#111827] border-[#FFB458] cursor-pointer'
                                      : 'bg-white/[0.06] text-white/85 border-white/15 hover:border-white/30 cursor-pointer'
                                  }`}
                                >
                                  {!p.unlocked && <Lock size={10} />}
                                  <span>{p.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                Umpan Cheat Code
                              </p>
                              <p className="text-xs font-mono font-bold text-[#FFB458] truncate mt-0.5">
                                {activeBaitObj
                                  ? `${activeBaitObj.code} (+1/s, +5 Heat/s)`
                                  : 'Tanpa Umpan (+0/s)'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenApp('cheat')}
                              className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold text-white cursor-pointer shrink-0"
                            >
                              Ubah
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleBuildPackage}
                            disabled={isBuilding}
                            className="relative overflow-hidden w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-[0.985] cursor-pointer"
                          >
                            {isBuilding && (
                              <div
                                className="absolute inset-y-0 left-0 bg-white/30"
                                style={{ width: `${buildProgress}%` }}
                              />
                            )}
                            <Wrench size={15} className="relative z-10" />
                            <span className="relative z-10">
                              {isBuilding
                                ? `Merakit Paket... ${buildProgress}%`
                                : `Build ${
                                    studioBuildType === 'gtb_asli_palsu'
                                      ? 'GTB 6 Asli (Palsu)'
                                      : 'GTB 6 Mod'
                                  }`}
                            </span>
                          </button>

                          {(builtModPkg || builtFakeAsliPkg) && (
                            <div className="space-y-2">
                              {builtModPkg && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenApp('publish_mod')}
                                  className="w-full p-3 rounded-xl bg-[#3B146B] border border-[#C9349B]/70 text-left hover:brightness-110 transition-all cursor-pointer"
                                >
                                  <p className="text-[11px] font-extrabold text-[#FFB458]">
                                    Mod v{builtModPkg.version} Siap Publikasi
                                  </p>
                                  <p className="text-[11px] text-white/80 mt-0.5">
                                    +{builtModPkg.victimsPerTick} korban/s · +
                                    {builtModPkg.heatPerTick}% Heat/s — Ketuk untuk Publish
                                  </p>
                                </button>
                              )}
                              {builtFakeAsliPkg && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenApp('publish_asli')}
                                  className="w-full p-3 rounded-xl bg-[#3B146B] border border-[#FF9B55]/70 text-left hover:brightness-110 transition-all cursor-pointer"
                                >
                                  <p className="text-[11px] font-extrabold text-[#FFB458]">
                                    Asli (Palsu) v{builtFakeAsliPkg.version} Siap Publikasi
                                  </p>
                                  <p className="text-[11px] text-white/80 mt-0.5">
                                    +{builtFakeAsliPkg.victimsPerTick} korban/s · +
                                    {builtFakeAsliPkg.heatPerTick}% Heat/s — Ketuk untuk Publish
                                  </p>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* APP 4: PUBLISH GTB MOD */}
                      {openApp === 'publish_mod' && (
                        <div className="space-y-3">
                          {publishWarning && (
                            <div className="rounded-xl bg-rose-950/75 border border-[#F36A78] p-3 space-y-2">
                              <div className="flex items-start gap-2 text-xs text-rose-100">
                                <AlertTriangle
                                  size={15}
                                  className="text-[#F36A78] shrink-0 mt-0.5"
                                />
                                <span>{publishWarning}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setStudioBuildType('gtb_mod');
                                  handleOpenApp('studio');
                                }}
                                className="w-full py-2 rounded-lg bg-[#F36A78] text-[#111827] text-xs font-extrabold cursor-pointer"
                              >
                                Buka GTB Studio
                              </button>
                            </div>
                          )}

                          <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-extrabold text-white">
                                Paket GTB 6 Mod
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  publishedModPkg
                                    ? 'text-emerald-400'
                                    : builtModPkg
                                    ? 'text-[#FFB458]'
                                    : 'text-white/55'
                                }`}
                              >
                                {publishedModPkg
                                  ? `LIVE v${publishedModPkg.version}`
                                  : builtModPkg
                                  ? `SIAP v${builtModPkg.version}`
                                  : 'BELUM DIRAKIT'}
                              </span>
                            </div>

                            {builtModPkg ? (
                              <div className="text-xs text-white/80 space-y-1 font-mono">
                                <p>Payload: {builtModPkg.payloadName}</p>
                                <p>
                                  Umpan:{' '}
                                  {builtModPkg.cheatBait
                                    ? builtModPkg.cheatBait.code
                                    : 'Tanpa Umpan'}
                                </p>
                                <p className="text-emerald-400">
                                  Kecepatan: +{builtModPkg.victimsPerTick} korban/detik
                                </p>
                                <p className="text-[#F36A78]">
                                  Heat: +{builtModPkg.heatPerTick}% / detik
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-white/70 leading-relaxed">
                                Rakit paket tipe GTB 6 Mod di GTB Studio terlebih dahulu.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={handlePublishMod}
                              className="w-full min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#7B208F] to-[#C9349B] text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.985] cursor-pointer shadow-md"
                            >
                              <Upload size={15} />
                              <span>
                                {publishedModPkg &&
                                builtModPkg &&
                                publishedModPkg.version === builtModPkg.version
                                  ? 'GTB 6 Mod Sedang Live'
                                  : 'Publish GTB 6 Mod'}
                              </span>
                            </button>

                            {publishedModPkg && (
                              <button
                                type="button"
                                onClick={() => handleManualWaveBoost('mod')}
                                disabled={modBoostLeftSec > 0}
                                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FFB458] text-[#111827] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <Zap size={14} />
                                <span>
                                  {modBoostLeftSec > 0
                                    ? `Tunggu ${modBoostLeftSec}s`
                                    : 'Sebar Link Forum (+8 Korban)'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* APP 5: PUBLISH GTB ASLI (PALSU) */}
                      {openApp === 'publish_asli' && (
                        <div className="space-y-3">
                          {publishWarning && (
                            <div className="rounded-xl bg-rose-950/75 border border-[#F36A78] p-3 space-y-2">
                              <div className="flex items-start gap-2 text-xs text-rose-100">
                                <AlertTriangle
                                  size={15}
                                  className="text-[#F36A78] shrink-0 mt-0.5"
                                />
                                <span>{publishWarning}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setStudioBuildType('gtb_asli_palsu');
                                  handleOpenApp('studio');
                                }}
                                className="w-full py-2 rounded-lg bg-[#F36A78] text-[#111827] text-xs font-extrabold cursor-pointer"
                              >
                                Buka GTB Studio
                              </button>
                            </div>
                          )}

                          <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-extrabold text-white">
                                Paket GTB 6 Asli (Palsu)
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  publishedFakeAsliPkg
                                    ? 'text-emerald-400'
                                    : builtFakeAsliPkg
                                    ? 'text-[#FFB458]'
                                    : 'text-white/55'
                                }`}
                              >
                                {publishedFakeAsliPkg
                                  ? `LIVE v${publishedFakeAsliPkg.version}`
                                  : builtFakeAsliPkg
                                  ? `SIAP v${builtFakeAsliPkg.version}`
                                  : 'BELUM DIRAKIT'}
                              </span>
                            </div>

                            {builtFakeAsliPkg ? (
                              <div className="text-xs text-white/80 space-y-1 font-mono">
                                <p>Payload: {builtFakeAsliPkg.payloadName}</p>
                                <p>
                                  Umpan:{' '}
                                  {builtFakeAsliPkg.cheatBait
                                    ? builtFakeAsliPkg.cheatBait.code
                                    : 'Tanpa Umpan'}
                                </p>
                                <p className="text-emerald-400">
                                  Kecepatan: +{builtFakeAsliPkg.victimsPerTick} korban/detik
                                </p>
                                <p className="text-[#F36A78]">
                                  Heat: +{builtFakeAsliPkg.heatPerTick}% / detik
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-white/70 leading-relaxed">
                                Rakit paket tipe GTB 6 Asli (Palsu) di GTB Studio untuk gelombang
                                unduhan besar.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={handlePublishFakeAsli}
                              className="w-full min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.985] cursor-pointer shadow-md"
                            >
                              <Rocket size={15} />
                              <span>
                                {publishedFakeAsliPkg &&
                                builtFakeAsliPkg &&
                                publishedFakeAsliPkg.version === builtFakeAsliPkg.version
                                  ? 'GTB Asli (Palsu) Sedang Live'
                                  : 'Publish GTB Asli (Palsu)'}
                              </span>
                            </button>

                            {publishedFakeAsliPkg && (
                              <button
                                type="button"
                                onClick={() => handleManualWaveBoost('asli')}
                                disabled={asliBoostLeftSec > 0}
                                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#C9349B] text-white font-extrabold text-xs inline-flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <Zap size={14} />
                                <span>
                                  {asliBoostLeftSec > 0
                                    ? `Tunggu ${asliBoostLeftSec}s`
                                    : 'Dorong Wave Viral (+14 Korban)'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenApp(null)}
                        className="w-full min-h-[42px] rounded-xl bg-white/12 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Tutup Aplikasi
                      </button>
                    </motion.div>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* HEAT CLEAR 5-Level Timing Mini-Game Popup */}
            <AnimatePresence>
              {isOpen && stage === 'playing' && heatClearOpen && !arrestReason && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Heat Clear"
                >
                  <motion.div
                    initial={{ y: 14, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 10, opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#250D47] border-2 border-[#C9349B] p-4 sm:p-5 shadow-2xl space-y-4 text-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#C9349B]/25 border border-[#FFB458]/50 text-[#FFB458] flex items-center justify-center shrink-0">
                          <Shield size={17} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-white">Heat Clear</h3>
                          <p className="text-[11px] text-white/75">
                            Hentikan garis putih tepat di zona hijau!
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#3B146B] border border-[#FFB458]/50 font-mono text-xs font-extrabold text-[#FFB458]">
                        Level {hcLevel}/5
                      </span>
                    </div>

                    {/* 5 Level Step Pills */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {hcLevels.map((lvCfg) => {
                        const done = lvCfg.level < hcLevel || hcFeedback === 'won';
                        const current = lvCfg.level === hcLevel && hcFeedback !== 'won';
                        return (
                          <div
                            key={lvCfg.level}
                            className={`h-2 rounded-full transition-colors ${
                              done
                                ? 'bg-emerald-400'
                                : current
                                ? 'bg-[#FFB458]'
                                : 'bg-white/15'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Timing Bar */}
                    <div className="rounded-xl bg-[#120724] border border-white/15 p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="text-white/80">
                          Hijau: {activeHcConfig.greenWidthPct}%
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-300 font-sans font-bold text-[10px]">
                          {activeHcConfig.modeLabel}
                        </span>
                        <span className="text-[#FFB458]">
                          {activeHcConfig.speedMultiplier.toFixed(2)}x
                        </span>
                      </div>

                      <div className="relative w-full h-14 rounded-xl bg-[#090314] border-2 border-white/15 overflow-hidden">
                        {/* Target Green Zone */}
                        <div
                          className="absolute inset-y-0 bg-emerald-500/80 border-x-2 border-emerald-300"
                          style={{
                            left: `${hcGreenStart}%`,
                            width: `${activeHcConfig.greenWidthPct}%`,
                          }}
                        />

                        {/* Moving White Vertical Line */}
                        <div
                          className="absolute inset-y-0 w-1.5 -ml-[3px] bg-white shadow-[0_0_12px_#ffffff]"
                          style={{ left: `${hcPointerPct}%` }}
                        />
                      </div>

                      <div className="h-5 flex items-center justify-center text-xs font-extrabold">
                        {hcFeedback === 'hit' && (
                          <span className="text-emerald-400">
                            PAS! Lanjut ke Level {hcLevel + 1}/5
                          </span>
                        )}
                        {hcFeedback === 'won' && (
                          <span className="text-emerald-400">
                            HEAT CLEAR 5/5 BERHASIL! Heat -25%
                          </span>
                        )}
                        {hcFeedback === 'miss' && (
                          <span className="text-[#F36A78]">
                            MELENCENG! +3% Heat · Polisi Mendeteksi!
                          </span>
                        )}
                        {hcFeedback === 'idle' && (
                          <span className="text-white/65">
                            Lulus 5 level = -25% Heat · Gagal = +3% Heat &amp; Game Over
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleHeatClearStop}
                      disabled={hcFeedback !== 'idle'}
                      className="w-full min-h-[50px] rounded-xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] hover:brightness-105 active:scale-[0.985] disabled:opacity-60 text-[#111827] font-black text-sm uppercase tracking-wider shadow-lg cursor-pointer"
                    >
                      BERHENTI!
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* POLICE ARREST 2D ANIMATION + GAME OVER OVERLAY */}
            <AnimatePresence>
              {isOpen && stage === 'playing' && arrestReason && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="fixed inset-0 z-[9999] bg-slate-950/92 backdrop-blur-sm flex items-center justify-center p-4 select-none"
                  role="alertdialog"
                  aria-modal="true"
                  aria-label="Game Over - Ditangkap Polisi"
                >
                  <motion.div
                    initial={{ y: 18, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 12, opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.24 }}
                    className="max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#1A0933] border-2 border-[#F36A78] p-4 sm:p-5 text-center space-y-3.5 shadow-2xl text-white"
                  >
                    {/* Animated 2D Police Arrest SVG Scene */}
                    <div className="relative rounded-xl overflow-hidden border border-white/15 bg-[#090314]">
                      {/* Red/Blue Police Siren Strobe Overlay */}
                      <motion.div
                        animate={{ opacity: [0.15, 0.48, 0.15] }}
                        transition={{ duration: 0.55, repeat: Infinity }}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(239,68,68,0.45) 0%, transparent 45%, rgba(59,130,246,0.45) 100%)',
                        }}
                      />

                      <svg viewBox="0 0 420 185" className="w-full h-auto block relative z-10">
                        {/* Dark street & wall */}
                        <rect x="0" y="0" width="420" height="145" fill="#120726" />
                        <rect x="0" y="145" width="420" height="40" fill="#090412" />

                        {/* Hacker Desk & Laptop on Left */}
                        <rect x="26" y="114" width="84" height="31" rx="3" fill="#2A124D" />
                        <polygon points="44,114 82,114 88,90 48,90" fill="#1E1B4B" stroke="#C9349B" strokeWidth="2" />

                        {/* Surrendering Character (Hands Up) */}
                        <motion.g
                          animate={{ y: [0, -2, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        >
                          {/* Body */}
                          <rect x="114" y="96" width="24" height="36" rx="6" fill="#2563EB" />
                          {/* Head */}
                          <circle cx="126" cy="82" r="12" fill="#3B82F6" />
                          {/* Ears */}
                          <polygon points="116,74 113,60 124,70" fill="#1D4ED8" />
                          <polygon points="136,74 139,60 128,70" fill="#1D4ED8" />
                          {/* Raised Hands */}
                          <path
                            d="M 114 102 L 101 76 M 138 102 L 151 76"
                            stroke="#93C5FD"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          {/* Legs */}
                          <line x1="120" y1="132" x2="118" y2="148" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
                          <line x1="132" y1="132" x2="134" y2="148" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
                        </motion.g>

                        {/* Police Cruiser Sliding In From Right */}
                        <motion.g
                          initial={{ x: 140 }}
                          animate={{ x: 0 }}
                          transition={{ duration: 0.65, ease: 'easeOut' }}
                        >
                          <rect x="236" y="102" width="152" height="36" rx="8" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
                          <polygon points="262,102 284,78 346,78 364,102" fill="#0F172A" stroke="#94A3B8" strokeWidth="2" />
                          <rect x="288" y="83" width="22" height="15" rx="2" fill="#38BDF8" opacity="0.65" />
                          <rect x="316" y="83" width="24" height="15" rx="2" fill="#38BDF8" opacity="0.65" />
                          {/* Siren Light Bar */}
                          <rect x="302" y="71" width="13" height="7" rx="2" fill="#EF4444" />
                          <rect x="315" y="71" width="13" height="7" rx="2" fill="#3B82F6" />
                          {/* Wheels */}
                          <circle cx="268" cy="140" r="12" fill="#090D16" stroke="#64748B" strokeWidth="3" />
                          <circle cx="356" cy="140" r="12" fill="#090D16" stroke="#64748B" strokeWidth="3" />
                          <text x="312" y="124" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="monospace" fill="#F8FAFC">
                            POLICE
                          </text>
                        </motion.g>

                        {/* Police Officer Stepping Toward Character */}
                        <motion.g
                          initial={{ x: 95 }}
                          animate={{ x: 0 }}
                          transition={{ duration: 0.75, ease: 'easeOut' }}
                        >
                          <rect x="176" y="96" width="24" height="38" rx="5" fill="#1E3A8A" />
                          <circle cx="188" cy="82" r="11" fill="#FDBA74" />
                          <rect x="176" y="69" width="24" height="6" rx="2" fill="#1E3A8A" />
                          <line x1="176" y1="104" x2="156" y2="96" stroke="#1E3A8A" strokeWidth="5" strokeLinecap="round" />
                          <line x1="182" y1="134" x2="180" y2="148" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
                          <line x1="194" y1="134" x2="196" y2="148" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
                        </motion.g>

                        {/* Handcuff Rings Lock */}
                        <motion.g
                          initial={{ scale: 1.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.45, duration: 0.3 }}
                          style={{ transformOrigin: '152px 72px' }}
                        >
                          <circle cx="146" cy="68" r="6" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
                          <circle cx="160" cy="68" r="6" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
                          <line x1="152" y1="68" x2="154" y2="68" stroke="#E2E8F0" strokeWidth="2.5" />
                        </motion.g>
                      </svg>
                    </div>

                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#F36A78]">
                        GAME OVER
                      </h3>
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[#FFB458] mt-1">
                        Anda Ditangkap Polisi!
                      </p>
                      <p className="text-xs sm:text-sm text-white/85 mt-1.5 leading-relaxed">
                        {arrestReason === 'heat_clear_fail'
                          ? 'Gagal di mini-game Heat Clear (+3% Heat). Polisi langsung melacak sinyal dan menangkap Anda.'
                          : arrestReason === 'timeout'
                          ? 'Timer 10 menit telah habis! Unit siber polisi berhasil menggerebek lokasi Anda.'
                          : 'Deteksi / Heat mencapai 100%! Polisi mengepung markas sebelum 1.000 korban tercapai.'}
                      </p>
                      <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] font-mono font-bold text-[#FFB458]">
                        <span>Korban: {victims.toLocaleString('id-ID')} / 1.000</span>
                        <span>Heat: {heat.toFixed(1)}%</span>
                        <span>Waktu: {formatCountdown(timeLeftSec)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        resetSimulation();
                        gtaAudio.startCheaterBgm();
                      }}
                      className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-[#F36A78] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all"
                    >
                      Coba Lagi
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}

      {/* Post-Win Cutscene (Laptop -> Bluefox Evil Smile + Riser -> Blackout 100% Bar -> Mission 3 Bar) */}
      <CheaterVictorySequence
        isOpen={isOpen && stage === 'victory_anim'}
        onComplete={onClose}
      />
    </>
  );
}
