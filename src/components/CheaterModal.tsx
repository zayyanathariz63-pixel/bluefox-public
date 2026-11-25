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

interface MalwareModuleDef {
  id: 'dropper' | 'stealth' | 'botnet' | 'ssl';
  name: string;
  payloadName: string;
  desc: string;
  baseCost: number;
  maxLevel: number;
  rateBonus: number;
  heatReductionPct: number;
}

interface CheatBaitItem {
  id: string;
  code: string;
  label: string;
  victimBoostPct: number;
  heatAdd: number;
}

interface BuiltPackage {
  type: PackageType;
  version: number;
  payloadId: string;
  payloadName: string;
  cheatBait: CheatBaitItem | null;
  victimsPerTick: number;
  heatPerTick: number;
  creditsPerTick: number;
  builtAt: number;
}

interface ActivityLogItem {
  id: string;
  time: string;
  tag: 'SYSTEM' | 'BUILD' | 'PUBLISH' | 'DOWNLOAD' | 'INJECT' | 'TELEMETRY' | 'WARN' | 'ALERT';
  text: string;
}

const TARGET_VICTIMS = 1000;
const INITIAL_CREDITS = 120;

const MALWARE_MODULES: MalwareModuleDef[] = [
  {
    id: 'dropper',
    name: 'Trojan Dropper',
    payloadName: 'Trojan Dropper X',
    desc: 'Mempercepat injeksi payload (+9 korban/tick per level).',
    baseCost: 70,
    maxLevel: 3,
    rateBonus: 9,
    heatReductionPct: 0,
  },
  {
    id: 'stealth',
    name: 'Rootkit Stealth',
    payloadName: 'Rootkit Phantom',
    desc: 'Menekan kenaikan Heat (-22% deteksi per level + pendinginan pasif).',
    baseCost: 80,
    maxLevel: 3,
    rateBonus: 3,
    heatReductionPct: 22,
  },
  {
    id: 'botnet',
    name: 'Botnet Mirror',
    payloadName: 'Botnet Swarm',
    desc: 'Menggandakan distribusi unduhan (+14 korban/tick per level).',
    baseCost: 110,
    maxLevel: 3,
    rateBonus: 14,
    heatReductionPct: 5,
  },
  {
    id: 'ssl',
    name: 'Spoofed SSL Cert',
    payloadName: 'Spoofed Enterprise Cert',
    desc: 'Meningkatkan daya tarik GTB Asli (Palsu) & menekan lonjakan Heat.',
    baseCost: 130,
    maxLevel: 3,
    rateBonus: 12,
    heatReductionPct: 16,
  },
];

const INITIAL_CHEAT_BAITS: CheatBaitItem[] = [
  {
    id: 'bait-godmode',
    code: 'BLUEFOX-GODMODE-999',
    label: 'Mode Kebal & Uang Tak Terbatas',
    victimBoostPct: 35,
    heatAdd: 0.4,
  },
  {
    id: 'bait-limit',
    code: 'INFINITE-LIMIT-VIP',
    label: 'Buka Limit AI 100% Gratis',
    victimBoostPct: 55,
    heatAdd: 0.8,
  },
  {
    id: 'bait-unlock',
    code: 'UNLOCK-ALL-GTB6',
    label: 'Buka Semua Misi & Skin Langka',
    victimBoostPct: 45,
    heatAdd: 0.55,
  },
  {
    id: 'bait-mod',
    code: 'TURBO-FPS-MODMENU',
    label: 'Mod Menu VIP Anti-Ban',
    victimBoostPct: 65,
    heatAdd: 1.0,
  },
];

const CHEAT_PREFIXES = ['GTB6-VIP', 'VICE-MOD', 'FOX-ELITE', 'CRYPTO-PASS', 'HYPER-UNLOCK'];
const CHEAT_SUFFIXES = ['PRO99', 'MAX77', 'ULTRA', 'ZEROX', 'PRIME', 'ALPHA'];

function formatLogTime(): string {
  const d = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function CheaterModal({ isOpen, onClose, onMissionSuccess }: CheaterModalProps) {
  const [stage, setStage] = useState<ModalStage>('briefing');
  const [muted, setMuted] = useState<boolean>(() => gtaAudio.isMuted());
  const [completed, setCompleted] = useState<boolean>(() =>
    isMissionCompleted('cheater', getSeasonPassState())
  );

  // Underground laptop state
  const [activeApp, setActiveApp] = useState<DesktopAppId>('store');
  const [victims, setVictims] = useState<number>(0);
  const [credits, setCredits] = useState<number>(INITIAL_CREDITS);
  const [heat, setHeat] = useState<number>(0);
  const [isDetected, setIsDetected] = useState<boolean>(false);

  // Store Malware levels (0..3) + selected payload for Studio
  const [moduleLevels, setModuleLevels] = useState<Record<MalwareModuleDef['id'], number>>({
    dropper: 0,
    stealth: 0,
    botnet: 0,
    ssl: 0,
  });
  const [selectedPayloadId, setSelectedPayloadId] = useState<string>('basic');

  // Cheat Code GTB 6 state
  const [cheatBaits, setCheatBaits] = useState<CheatBaitItem[]>(INITIAL_CHEAT_BAITS);
  const [selectedBaitId, setSelectedBaitId] = useState<string | null>(INITIAL_CHEAT_BAITS[0].id);

  // GTB Studio builder state
  const [studioBuildType, setStudioBuildType] = useState<PackageType>('gtb_mod');
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildProgress, setBuildProgress] = useState<number>(0);
  const [builtModPkg, setBuiltModPkg] = useState<BuiltPackage | null>(null);
  const [builtFakeAsliPkg, setBuiltFakeAsliPkg] = useState<BuiltPackage | null>(null);

  // Live published releases
  const [publishedModPkg, setPublishedModPkg] = useState<BuiltPackage | null>(null);
  const [publishedFakeAsliPkg, setPublishedFakeAsliPkg] = useState<BuiltPackage | null>(null);

  // Feedback, cooldowns & logs
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [scrubCooldownUntil, setScrubCooldownUntil] = useState<number>(0);
  const [modBoostCooldownUntil, setModBoostCooldownUntil] = useState<number>(0);
  const [asliBoostCooldownUntil, setAsliBoostCooldownUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);

  const wonRef = useRef<boolean>(false);
  const detectedRef = useRef<boolean>(false);

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

  const resetSimulation = useCallback(() => {
    wonRef.current = false;
    detectedRef.current = false;
    setVictims(0);
    setCredits(INITIAL_CREDITS);
    setHeat(0);
    setIsDetected(false);
    setActiveApp('store');
    setModuleLevels({ dropper: 0, stealth: 0, botnet: 0, ssl: 0 });
    setSelectedPayloadId('basic');
    setCheatBaits(INITIAL_CHEAT_BAITS);
    setSelectedBaitId(INITIAL_CHEAT_BAITS[0].id);
    setStudioBuildType('gtb_mod');
    setIsBuilding(false);
    setBuildProgress(0);
    setBuiltModPkg(null);
    setBuiltFakeAsliPkg(null);
    setPublishedModPkg(null);
    setPublishedFakeAsliPkg(null);
    setPublishWarning(null);
    setScrubCooldownUntil(0);
    setModBoostCooldownUntil(0);
    setAsliBoostCooldownUntil(0);
    setLogs([
      {
        id: 'init-1',
        time: formatLogTime(),
        tag: 'SYSTEM',
        text: 'Laptop underground aktif. Siapkan payload di Store Malware & Cheat Code.',
      },
      {
        id: 'init-2',
        time: formatLogTime(),
        tag: 'SYSTEM',
        text: 'Target operasi: 1.000 korban sebelum Deteksi / Heat menyentuh 100%.',
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

  // Passive simulation loop: victim downloads, malware payload ticks, credits, heat
  useEffect(() => {
    if (!isOpen || stage !== 'playing' || isDetected) return;

    const timer = setInterval(() => {
      if (wonRef.current || detectedRef.current) return;

      const hasAnyPublish = Boolean(publishedModPkg || publishedFakeAsliPkg);
      const stealthReduction =
        (moduleLevels.stealth * 22 + moduleLevels.ssl * 16) / 100; // up to ~1.14 -> clamp
      const heatMultiplier = Math.max(0.28, 1 - Math.min(0.72, stealthReduction));
      const passiveCooling = moduleLevels.stealth > 0 ? 0.35 * moduleLevels.stealth : 0.15;

      if (!hasAnyPublish) {
        setHeat((prev) => Math.max(0, Number((prev - passiveCooling).toFixed(1))));
        return;
      }

      let gainedVictims = 0;
      let gainedCredits = 0;
      let gainedHeat = 0;

      const botnetMult = 1 + moduleLevels.botnet * 0.25;
      const dropperBonus = moduleLevels.dropper * 4;

      if (publishedModPkg) {
        const modJitter = 0.85 + Math.random() * 0.35;
        const vMod = Math.max(
          2,
          Math.round((publishedModPkg.victimsPerTick + dropperBonus) * botnetMult * modJitter)
        );
        gainedVictims += vMod;
        gainedCredits += publishedModPkg.creditsPerTick + Math.floor(vMod * 0.65);
        gainedHeat += publishedModPkg.heatPerTick * heatMultiplier;
      }

      if (publishedFakeAsliPkg) {
        const asliJitter = 0.85 + Math.random() * 0.45;
        const sslBoost = 1 + moduleLevels.ssl * 0.18;
        const vAsli = Math.max(
          4,
          Math.round(
            (publishedFakeAsliPkg.victimsPerTick + dropperBonus * 1.4) *
              botnetMult *
              sslBoost *
              asliJitter
          )
        );
        gainedVictims += vAsli;
        gainedCredits += publishedFakeAsliPkg.creditsPerTick + Math.floor(vAsli * 0.8);
        gainedHeat += publishedFakeAsliPkg.heatPerTick * heatMultiplier;
      }

      setCredits((c) => c + gainedCredits);

      setVictims((prev) => {
        const next = Math.min(TARGET_VICTIMS, prev + gainedVictims);
        if (next >= TARGET_VICTIMS && !wonRef.current) {
          wonRef.current = true;
          gtaAudio.stopHeistBgm();
          const updated = completeCheaterMission();
          setCompleted(true);
          onMissionSuccess?.(updated);
          setStage('victory_anim');
        }
        return next;
      });

      setHeat((prev) => {
        const nextHeat = Math.min(
          100,
          Math.max(0, Number((prev + gainedHeat - passiveCooling * 0.45).toFixed(1)))
        );
        if (nextHeat >= 100 && !detectedRef.current && !wonRef.current) {
          detectedRef.current = true;
          setIsDetected(true);
          gtaAudio.stopHeistBgm();
          gtaAudio.playBustedSfx();
        }
        return nextHeat;
      });

      // Emit concise malware execution telemetry logs
      const roll = Math.random();
      if (publishedFakeAsliPkg && roll < 0.42) {
        pushLog(
          'INJECT',
          `GTB Asli (Palsu) v${publishedFakeAsliPkg.version}: +${gainedVictims} unduhan · payload ${publishedFakeAsliPkg.payloadName} aktif.`
        );
      } else if (publishedModPkg && roll < 0.78) {
        pushLog(
          'DOWNLOAD',
          `GTB 6 Mod v${publishedModPkg.version}: +${gainedVictims} korban · sesi telemetri tercatat.`
        );
      } else {
        pushLog(
          'TELEMETRY',
          `Sinkronisasi mirror aktif (+${gainedCredits} Kredit operasi).`
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isOpen,
    stage,
    isDetected,
    publishedModPkg,
    publishedFakeAsliPkg,
    moduleLevels,
    onMissionSuccess,
    pushLog,
  ]);

  const handleOpenApp = (app: DesktopAppId) => {
    gtaAudio.playCyberClickSfx();
    setPublishWarning(null);
    setActiveApp(app);
  };

  const getModuleCost = (mod: MalwareModuleDef, lv: number) =>
    Math.round(mod.baseCost * Math.pow(1.65, lv));

  const handleUpgradeModule = (mod: MalwareModuleDef) => {
    const curLv = moduleLevels[mod.id];
    if (curLv >= mod.maxLevel) return;
    const cost = getModuleCost(mod, curLv);
    if (credits < cost) {
      pushLog('WARN', `Kredit tidak cukup untuk ${mod.name} (butuh ${cost} Kredit).`);
      return;
    }

    gtaAudio.playBuildCompleteSfx();
    setCredits((c) => c - cost);
    const nextLv = curLv + 1;
    setModuleLevels((prev) => ({ ...prev, [mod.id]: nextLv }));
    setSelectedPayloadId(mod.id);
    pushLog(
      'SYSTEM',
      `Store Malware: ${mod.name} ditingkatkan ke Lv ${nextLv}. Payload ${mod.payloadName} dipilih.`
    );
  };

  const ownedPayloads = [
    {
      id: 'basic',
      name: 'Injector Dasar v1',
      rateBonus: 0,
      heatPenalty: 0.4,
      unlocked: true,
    },
    ...MALWARE_MODULES.map((m) => ({
      id: m.id,
      name: `${m.payloadName} (Lv ${moduleLevels[m.id]})`,
      rateBonus: m.rateBonus * Math.max(1, moduleLevels[m.id]),
      heatPenalty: Math.max(0.15, 0.9 - (m.heatReductionPct * moduleLevels[m.id]) / 100),
      unlocked: moduleLevels[m.id] > 0,
    })),
  ];

  const handleGenerateCheatCode = () => {
    gtaAudio.playCyberClickSfx();
    const prefix = CHEAT_PREFIXES[Math.floor(Math.random() * CHEAT_PREFIXES.length)];
    const suffix = CHEAT_SUFFIXES[Math.floor(Math.random() * CHEAT_SUFFIXES.length)];
    const num = Math.floor(100 + Math.random() * 899);
    const code = `${prefix}-${suffix}-${num}`;
    const boost = 45 + Math.floor(Math.random() * 35);
    const heatAdd = Number((0.45 + Math.random() * 0.55).toFixed(2));
    const newItem: CheatBaitItem = {
      id: `bait-${Date.now()}`,
      code,
      label: `Promo Cheat Acak (+${boost}% Tarik Korban)`,
      victimBoostPct: boost,
      heatAdd,
    };
    setCheatBaits((prev) => [newItem, ...prev.slice(0, 5)]);
    setSelectedBaitId(newItem.id);
    pushLog('SYSTEM', `Cheat Code GTB 6 dibuat: ${code} (+${boost}% daya tarik).`);
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
    const duration = 750;
    const step = (now: number) => {
      const p = Math.min(100, Math.round(((now - start) / duration) * 100));
      setBuildProgress(p);
      if (p < 100) {
        requestAnimationFrame(step);
      } else {
        setIsBuilding(false);
        gtaAudio.playBuildCompleteSfx();

        const isFakeAsli = studioBuildType === 'gtb_asli_palsu';
        const baseVictims = isFakeAsli ? 22 : 12;
        const baseHeat = isFakeAsli ? 2.6 : 1.35;
        const baseCredits = isFakeAsli ? 16 : 9;
        const baitMult = activeBaitObj ? 1 + activeBaitObj.victimBoostPct / 100 : 1;
        const baitHeat = activeBaitObj ? activeBaitObj.heatAdd : 0;

        const prevVersion = isFakeAsli
          ? builtFakeAsliPkg?.version ?? 0
          : builtModPkg?.version ?? 0;

        const pkg: BuiltPackage = {
          type: studioBuildType,
          version: prevVersion + 1,
          payloadId: activePayloadObj.id,
          payloadName: activePayloadObj.name,
          cheatBait: activeBaitObj,
          victimsPerTick: Math.round((baseVictims + activePayloadObj.rateBonus) * baitMult),
          heatPerTick: Number((baseHeat + activePayloadObj.heatPenalty + baitHeat).toFixed(2)),
          creditsPerTick: baseCredits + (isFakeAsli ? 6 : 2),
          builtAt: Date.now(),
        };

        if (isFakeAsli) {
          setBuiltFakeAsliPkg(pkg);
          pushLog(
            'BUILD',
            `GTB Studio selesai merakit GTB 6 Asli (Palsu) v${pkg.version} dengan ${pkg.payloadName}.`
          );
        } else {
          setBuiltModPkg(pkg);
          pushLog(
            'BUILD',
            `GTB Studio selesai merakit GTB 6 Mod v${pkg.version} dengan ${pkg.payloadName}.`
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
      `GTB 6 Mod v${builtModPkg.version} dipublikasikan! Unduhan korban & payload berjalan.`
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
      `GTB 6 Asli (Palsu) v${builtFakeAsliPkg.version} resmi dirilis! Gelombang unduhan besar dimulai.`
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
      setAsliBoostCooldownUntil(Date.now() + 3000);
    } else {
      setModBoostCooldownUntil(Date.now() + 2500);
    }

    const burstVictims = isAsli
      ? Math.round(pkg.victimsPerTick * 1.9 + 18)
      : Math.round(pkg.victimsPerTick * 1.5 + 10);
    const burstCredits = isAsli ? 24 : 14;
    const stealthCut = Math.max(
      0.35,
      1 - Math.min(0.65, (moduleLevels.stealth * 18 + moduleLevels.ssl * 14) / 100)
    );
    const burstHeat = Number(((isAsli ? 6.5 : 3.5) * stealthCut).toFixed(1));

    setCredits((c) => c + burstCredits);
    setVictims((prev) => {
      const next = Math.min(TARGET_VICTIMS, prev + burstVictims);
      if (next >= TARGET_VICTIMS && !wonRef.current) {
        wonRef.current = true;
        gtaAudio.stopHeistBgm();
        const updated = completeCheaterMission();
        setCompleted(true);
        onMissionSuccess?.(updated);
        setStage('victory_anim');
      }
      return next;
    });
    setHeat((prev) => {
      const nextHeat = Math.min(100, Number((prev + burstHeat).toFixed(1)));
      if (nextHeat >= 100 && !detectedRef.current && !wonRef.current) {
        detectedRef.current = true;
        setIsDetected(true);
        gtaAudio.stopHeistBgm();
        gtaAudio.playBustedSfx();
      }
      return nextHeat;
    });

    pushLog(
      'INJECT',
      `Promosi ${isAsli ? 'GTB Asli (Palsu)' : 'GTB Mod'}: +${burstVictims} korban instan (+${burstHeat}% Heat).`
    );
  };

  const handleScrubLogs = () => {
    if (nowTick < scrubCooldownUntil) return;
    const cost = 30;
    if (credits < cost) {
      pushLog('WARN', `Butuh ${cost} Kredit untuk membersihkan jejak deteksi.`);
      return;
    }
    gtaAudio.playCyberClickSfx();
    setCredits((c) => c - cost);
    setScrubCooldownUntil(Date.now() + 3500);
    setHeat((prev) => Math.max(0, Number((prev - 22).toFixed(1))));
    pushLog('SYSTEM', 'Pembersihan jejak berhasil: Deteksi / Heat turun -22%.');
  };

  const victimPct = Math.min(100, Math.round((victims / TARGET_VICTIMS) * 100));
  const heatStatusLabel = heat >= 80 ? 'Kritis' : heat >= 45 ? 'Waspada' : 'Aman';
  const scrubLeftSec = Math.max(0, Math.ceil((scrubCooldownUntil - nowTick) / 1000));
  const modBoostLeftSec = Math.max(0, Math.ceil((modBoostCooldownUntil - nowTick) / 1000));
  const asliBoostLeftSec = Math.max(0, Math.ceil((asliBoostCooldownUntil - nowTick) / 1000));

  const dockApps: {
    id: DesktopAppId;
    label: string;
    shortLabel: string;
    icon: typeof Bug;
    badgeText?: string;
    isLive?: boolean;
  }[] = [
    { id: 'store', label: 'Store Malware', shortLabel: 'Malware', icon: Bug },
    { id: 'cheat', label: 'Cheat Code GTB 6', shortLabel: 'Cheat', icon: Terminal },
    {
      id: 'studio',
      label: 'GTB Studio',
      shortLabel: 'Studio',
      icon: Wrench,
      badgeText: builtModPkg || builtFakeAsliPkg ? 'Siap' : undefined,
    },
    {
      id: 'publish_mod',
      label: 'Publish GTB Mod',
      shortLabel: 'Pub Mod',
      icon: Upload,
      isLive: Boolean(publishedModPkg),
    },
    {
      id: 'publish_asli',
      label: 'Publish GTB Asli (Palsu)',
      shortLabel: 'Pub Asli',
      icon: Rocket,
      isLive: Boolean(publishedFakeAsliPkg),
    },
  ];

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
                  <div className="px-2.5 sm:px-3 py-1 rounded-full bg-white/95 border border-[#111827]/15 shadow-xs font-mono tabular-nums text-[11px] sm:text-xs font-extrabold text-[#111827]">
                    Korban: {victims.toLocaleString('id-ID')} / 1.000
                  </div>
                  <div
                    className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full border font-mono tabular-nums text-[11px] font-extrabold shadow-xs ${
                      heat >= 80
                        ? 'bg-rose-600 text-white border-rose-300'
                        : heat >= 45
                        ? 'bg-[#FF9B55] text-[#111827] border-[#111827]/20'
                        : 'bg-[#3B146B] text-[#FFB458] border-white/20'
                    }`}
                  >
                    Heat: {heat.toFixed(0)}%
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
              <div className="w-full max-h-[70dvh] overflow-y-auto flex flex-col justify-center p-4 sm:p-6">
                <div className="w-full max-w-2xl mx-auto space-y-4">
                  <div className="rounded-2xl bg-[#3B146B]/65 border border-[#7B208F]/70 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                      <Laptop size={15} strokeWidth={2.4} />
                      <span>Simulasi Laptop Underground</span>
                    </div>
                    <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                      Operasikan 5 aplikasi di desktop underground: beli modul di{' '}
                      <strong className="text-white">Store Malware</strong>, buat umpan di{' '}
                      <strong className="text-white">Cheat Code GTB 6</strong>, rakit paket di{' '}
                      <strong className="text-white">GTB Studio</strong>, lalu distribusikan lewat{' '}
                      <strong className="text-white">Publish GTB Mod</strong> &amp;{' '}
                      <strong className="text-white">Publish GTB Asli (Palsu)</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#7B208F]/35 border border-[#C9349B]/50 p-3.5">
                      <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                        <Upload size={14} strokeWidth={2.4} />
                        <span>Target 1.000 Korban</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                        Kumpulkan 1.000 korban yang mengunduh GTB Mod atau GTB Asli (Palsu) dengan
                        injeksi payload malware aktif.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#F36A78]/15 border border-[#F36A78]/50 p-3.5">
                      <div className="flex items-center gap-2 text-[#F36A78] text-xs font-extrabold uppercase tracking-wider">
                        <AlertTriangle size={14} strokeWidth={2.4} />
                        <span>Jaga Deteksi / Heat</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                        Jika Heat menyentuh 100% sebelum 1.000 korban, operasi terbongkar. Upgrade
                        Rootkit Stealth atau hapus jejak secara berkala.
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
              <div className="w-full h-full flex flex-col p-2 sm:p-3 overflow-hidden">
                {/* Underground Laptop Shell */}
                <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-[#100720] border border-[#C9349B]/40 shadow-2xl overflow-hidden text-white">
                  {/* Laptop Top Bar */}
                  <div className="px-3 py-2 bg-[#1D0B38] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#7B208F]/50 border border-[#C9349B]/50 flex items-center justify-center text-[#FFB458]">
                        <Laptop size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold tracking-tight text-white leading-none">
                          Underground Laptop
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5">
                          Target 1.000 unduhan aktif
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      {/* Victim Bar */}
                      <div className="flex items-center gap-2 bg-[#120726] border border-white/10 rounded-lg px-2.5 py-1">
                        <span className="text-[11px] font-mono tabular-nums font-bold text-[#FFB458]">
                          Korban: {victims.toLocaleString('id-ID')} / 1.000
                        </span>
                        <div className="w-16 sm:w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${victimPct}%`,
                              background: 'linear-gradient(90deg, #7B208F 0%, #FFB458 100%)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Operation Credits */}
                      <div className="px-2.5 py-1 rounded-lg bg-[#3B146B] border border-[#FFB458]/40 font-mono tabular-nums text-[11px] font-extrabold text-[#FFB458]">
                        {credits} Kredit
                      </div>
                    </div>
                  </div>

                  {/* Desktop Main Workspace (Active Window + Side Telemetry/Heat) */}
                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_275px] overflow-hidden">
                    {/* Active App Window */}
                    <div className="min-h-0 overflow-y-auto p-3 sm:p-4 bg-[#140A26]">
                      {/* Window Title Header */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          {activeApp === 'store' && <Bug size={16} className="text-[#F36A78]" />}
                          {activeApp === 'cheat' && <Terminal size={16} className="text-[#FFB458]" />}
                          {activeApp === 'studio' && <Wrench size={16} className="text-[#FF9B55]" />}
                          {activeApp === 'publish_mod' && <Upload size={16} className="text-[#C9349B]" />}
                          {activeApp === 'publish_asli' && <Rocket size={16} className="text-[#F87572]" />}
                          <h3 className="text-sm font-extrabold tracking-tight text-white">
                            {dockApps.find((a) => a.id === activeApp)?.label}
                          </h3>
                        </div>
                        <span className="text-[11px] text-white/65 font-mono">
                          {activeApp === 'store' && 'Modul & Payload'}
                          {activeApp === 'cheat' && 'Generator Umpan'}
                          {activeApp === 'studio' && 'Perakit Paket'}
                          {activeApp === 'publish_mod' && 'Distribusi Mod'}
                          {activeApp === 'publish_asli' && 'Distribusi Fake Full'}
                        </span>
                      </div>

                      {/* APP 1: STORE MALWARE */}
                      {activeApp === 'store' && (
                        <div className="space-y-3">
                          <div className="rounded-xl bg-[#1D0B38] border border-white/10 p-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-[#FFB458]">
                                Payload Aktif untuk GTB Studio
                              </p>
                              <p className="text-xs text-white/80 mt-0.5 font-mono">
                                {activePayloadObj.name}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenApp('studio')}
                              className="px-3 py-1.5 rounded-lg bg-[#7B208F] hover:bg-[#C9349B] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                              Ke GTB Studio
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {MALWARE_MODULES.map((mod) => {
                              const lv = moduleLevels[mod.id];
                              const isMax = lv >= mod.maxLevel;
                              const cost = getModuleCost(mod, lv);
                              const canBuy = !isMax && credits >= cost;
                              const isSelected = selectedPayloadId === mod.id && lv > 0;

                              return (
                                <div
                                  key={mod.id}
                                  className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-colors ${
                                    isSelected
                                      ? 'bg-[#29104E] border-[#FFB458]/70'
                                      : 'bg-[#1A0B33] border-white/10'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-extrabold text-white">
                                        {mod.name}
                                      </span>
                                      <span className="text-[10px] font-mono font-bold text-[#FFB458]">
                                        Lv {lv}/{mod.maxLevel}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-white/70 mt-1 leading-relaxed">
                                      {mod.desc}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpgradeModule(mod)}
                                      disabled={!canBuy}
                                      className={`flex-1 min-h-[34px] px-2.5 rounded-lg text-[11px] font-extrabold font-mono transition-all ${
                                        isMax
                                          ? 'bg-white/10 text-white/50 cursor-default'
                                          : canBuy
                                          ? 'bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] hover:brightness-105 active:scale-95 cursor-pointer'
                                          : 'bg-white/10 text-white/40 cursor-not-allowed'
                                      }`}
                                    >
                                      {isMax ? 'MAKS' : `${lv === 0 ? 'Beli' : 'Upgrade'} (${cost})`}
                                    </button>

                                    {lv > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          gtaAudio.playCyberClickSfx();
                                          setSelectedPayloadId(mod.id);
                                        }}
                                        className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                          isSelected
                                            ? 'bg-[#FFB458] text-[#111827] border-[#FFB458]'
                                            : 'bg-white/5 text-white/80 border-white/15 hover:bg-white/10'
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
                        </div>
                      )}

                      {/* APP 2: CHEAT CODE GTB 6 */}
                      {activeApp === 'cheat' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-xs text-white/80">
                              Pilih atau buat kode promo palsu sebagai umpan unduhan korban.
                            </p>
                            <button
                              type="button"
                              onClick={handleGenerateCheatCode}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#C9349B] to-[#FF9B55] text-white text-xs font-extrabold inline-flex items-center gap-1.5 hover:brightness-110 active:scale-95 cursor-pointer shadow-sm"
                            >
                              <RefreshCw size={12} />
                              <span>Generate Kode Baru</span>
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
                                      ? 'bg-[#2B1052] border-[#FFB458]'
                                      : 'bg-[#1A0B33] border-white/10 hover:border-white/25'
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
                                  <div className="text-right shrink-0">
                                    <span className="block text-[11px] font-mono font-bold text-emerald-400">
                                      +{bait.victimBoostPct}% Korban
                                    </span>
                                    <span className="block text-[10px] font-mono text-[#F36A78]">
                                      +{bait.heatAdd}% Heat/tick
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* APP 3: GTB STUDIO */}
                      {activeApp === 'studio' && (
                        <div className="space-y-3.5">
                          {/* Step 1: Build Type */}
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1.5">
                              1. Pilih Tipe Paket
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  gtaAudio.playCyberClickSfx();
                                  setStudioBuildType('gtb_mod');
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                  studioBuildType === 'gtb_mod'
                                    ? 'bg-[#2B1052] border-[#C9349B]'
                                    : 'bg-[#1A0B33] border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-extrabold text-white">
                                    GTB 6 Mod
                                  </span>
                                  <Upload size={14} className="text-[#C9349B]" />
                                </div>
                                <p className="text-[11px] text-white/70 mt-1">
                                  Stabil &amp; lebih aman dari deteksi, aliran korban konstan.
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
                                    ? 'bg-[#2B1052] border-[#FF9B55]'
                                    : 'bg-[#1A0B33] border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-extrabold text-white">
                                    GTB 6 Asli (Palsu)
                                  </span>
                                  <Rocket size={14} className="text-[#FF9B55]" />
                                </div>
                                <p className="text-[11px] text-white/70 mt-1">
                                  Gelombang korban besar &amp; cepat, risiko Heat lebih tinggi.
                                </p>
                              </button>
                            </div>
                          </div>

                          {/* Step 2: Malware Payload */}
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1.5">
                              2. Pasang Payload dari Store Malware
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
                                      : 'bg-[#1A0B33] text-white/85 border-white/15 hover:border-white/30 cursor-pointer'
                                  }`}
                                >
                                  {!p.unlocked && <Lock size={10} />}
                                  <span>{p.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Step 3: Cheat Bait summary */}
                          <div className="rounded-xl bg-[#1D0B38] border border-white/10 p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                Umpan Cheat Code
                              </p>
                              <p className="text-xs font-mono font-bold text-[#FFB458] truncate mt-0.5">
                                {activeBaitObj
                                  ? `${activeBaitObj.code} (+${activeBaitObj.victimBoostPct}%)`
                                  : 'Tanpa Umpan Cheat'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenApp('cheat')}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white cursor-pointer shrink-0"
                            >
                              Ubah
                            </button>
                          </div>

                          {/* Build Action */}
                          <button
                            type="button"
                            onClick={handleBuildPackage}
                            disabled={isBuilding}
                            className="relative overflow-hidden w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-[0.985] cursor-pointer disabled:opacity-90"
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
                                : `Build Paket ${
                                    studioBuildType === 'gtb_asli_palsu'
                                      ? 'GTB 6 Asli (Palsu)'
                                      : 'GTB 6 Mod'
                                  }`}
                            </span>
                          </button>

                          {(builtModPkg || builtFakeAsliPkg) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {builtModPkg && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenApp('publish_mod')}
                                  className="p-2.5 rounded-xl bg-[#3B146B]/70 border border-[#C9349B]/60 text-left hover:bg-[#3B146B] transition-colors cursor-pointer"
                                >
                                  <p className="text-[10px] font-bold text-[#FFB458] uppercase">
                                    Mod Siap Publikasi (v{builtModPkg.version})
                                  </p>
                                  <p className="text-[11px] text-white/80 mt-0.5 truncate">
                                    Klik untuk buka Publish GTB Mod
                                  </p>
                                </button>
                              )}
                              {builtFakeAsliPkg && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenApp('publish_asli')}
                                  className="p-2.5 rounded-xl bg-[#3B146B]/70 border border-[#FF9B55]/60 text-left hover:bg-[#3B146B] transition-colors cursor-pointer"
                                >
                                  <p className="text-[10px] font-bold text-[#FFB458] uppercase">
                                    Asli (Palsu) Siap (v{builtFakeAsliPkg.version})
                                  </p>
                                  <p className="text-[11px] text-white/80 mt-0.5 truncate">
                                    Klik untuk buka Publish GTB Asli (Palsu)
                                  </p>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* APP 4: PUBLISH GTB MOD */}
                      {activeApp === 'publish_mod' && (
                        <div className="space-y-3">
                          {publishWarning && (
                            <div className="rounded-xl bg-rose-950/70 border border-[#F36A78] p-3 flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 text-xs text-rose-100">
                                <AlertTriangle size={15} className="text-[#F36A78] shrink-0 mt-0.5" />
                                <span>{publishWarning}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setStudioBuildType('gtb_mod');
                                  handleOpenApp('studio');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#F36A78] text-[#111827] text-[11px] font-extrabold shrink-0 cursor-pointer"
                              >
                                Buka Studio
                              </button>
                            </div>
                          )}

                          <div className="rounded-xl bg-[#1D0B38] border border-white/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-white">
                                Paket Build GTB 6 Mod
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  publishedModPkg
                                    ? 'text-emerald-400'
                                    : builtModPkg
                                    ? 'text-[#FFB458]'
                                    : 'text-white/50'
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
                                  Umpan: {builtModPkg.cheatBait ? builtModPkg.cheatBait.code : 'Tanpa Umpan'}
                                </p>
                                <p className="text-[#FFB458]">
                                  Estimasi: ~{builtModPkg.victimsPerTick} korban/detik
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-white/65">
                                Rakit paket tipe GTB 6 Mod di GTB Studio agar bisa dipublikasikan.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handlePublishMod}
                              className="flex-1 min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#7B208F] to-[#C9349B] text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.985] cursor-pointer shadow-md"
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
                                className="min-h-[42px] px-3.5 rounded-xl bg-[#FFB458] text-[#111827] font-extrabold text-xs inline-flex items-center gap-1.5 hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <Zap size={14} />
                                <span>
                                  {modBoostLeftSec > 0
                                    ? `Tunggu ${modBoostLeftSec}s`
                                    : 'Sebar Link Forum'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* APP 5: PUBLISH GTB ASLI (PALSU) */}
                      {activeApp === 'publish_asli' && (
                        <div className="space-y-3">
                          {publishWarning && (
                            <div className="rounded-xl bg-rose-950/70 border border-[#F36A78] p-3 flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 text-xs text-rose-100">
                                <AlertTriangle size={15} className="text-[#F36A78] shrink-0 mt-0.5" />
                                <span>{publishWarning}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setStudioBuildType('gtb_asli_palsu');
                                  handleOpenApp('studio');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#F36A78] text-[#111827] text-[11px] font-extrabold shrink-0 cursor-pointer"
                              >
                                Buka Studio
                              </button>
                            </div>
                          )}

                          <div className="rounded-xl bg-[#1D0B38] border border-white/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-white">
                                Paket Build GTB 6 Asli (Palsu)
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  publishedFakeAsliPkg
                                    ? 'text-emerald-400'
                                    : builtFakeAsliPkg
                                    ? 'text-[#FFB458]'
                                    : 'text-white/50'
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
                                <p className="text-[#FFB458]">
                                  Estimasi: ~{builtFakeAsliPkg.victimsPerTick} korban/detik (Dampak Tinggi)
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-white/65">
                                Rakit paket tipe GTB 6 Asli (Palsu) di GTB Studio untuk gelombang
                                korban besar.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handlePublishFakeAsli}
                              className="flex-1 min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.985] cursor-pointer shadow-md"
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
                                className="min-h-[42px] px-3.5 rounded-xl bg-[#C9349B] text-white font-extrabold text-xs inline-flex items-center gap-1.5 hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <Zap size={14} />
                                <span>
                                  {asliBoostLeftSec > 0
                                    ? `Tunggu ${asliBoostLeftSec}s`
                                    : 'Dorong Wave Viral'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Side Panel: Detection/Heat Meter + Live Malware Log Feed */}
                    <aside className="min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-[#120724]">
                      {/* Detection / Heat Meter */}
                      <div className="p-3 border-b border-white/10 space-y-2 shrink-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/85">
                            <Shield
                              size={13}
                              className={heat >= 80 ? 'text-[#F36A78]' : 'text-[#FFB458]'}
                            />
                            <span>Deteksi / Heat</span>
                          </span>
                          <span
                            className={`text-xs font-mono font-extrabold tabular-nums ${
                              heat >= 80
                                ? 'text-[#F36A78]'
                                : heat >= 45
                                ? 'text-[#FFB458]'
                                : 'text-emerald-400'
                            }`}
                          >
                            {heat.toFixed(1)}% · {heatStatusLabel}
                          </span>
                        </div>

                        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
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
                          onClick={handleScrubLogs}
                          disabled={scrubLeftSec > 0 || credits < 30 || heat <= 0}
                          className="w-full min-h-[32px] px-2.5 rounded-lg bg-[#3B146B] hover:bg-[#7B208F] disabled:opacity-45 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 border border-white/15 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <RotateCcw size={12} />
                          <span>
                            {scrubLeftSec > 0
                              ? `Pendinginan (${scrubLeftSec}s)`
                              : 'Hapus Jejak (-22% Heat · 30 Kredit)'}
                          </span>
                        </button>
                      </div>

                      {/* Live Activity / Malware Feed */}
                      <div className="flex-1 min-h-[120px] max-h-[175px] lg:max-h-none flex flex-col p-3 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/75">
                            <Activity size={12} className="text-[#C9349B]" />
                            <span>Log Aktivitas Malware</span>
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] leading-relaxed">
                          {logs.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-1.5 text-white/80"
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
                    </aside>
                  </div>

                  {/* Bottom 5-App Taskbar / Dock */}
                  <nav
                    aria-label="Taskbar Aplikasi Laptop"
                    className="px-2 py-1.5 bg-[#1D0B38] border-t border-white/10 grid grid-cols-5 gap-1.5 shrink-0"
                  >
                    {dockApps.map((app) => {
                      const Icon = app.icon;
                      const isActive = activeApp === app.id;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => handleOpenApp(app.id)}
                          className={`relative min-h-[40px] px-1.5 py-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-[#7B208F] to-[#C9349B] text-white border border-[#FFB458]/60 shadow-sm'
                              : 'bg-white/[0.05] hover:bg-white/[0.1] text-white/75 border border-transparent'
                          }`}
                        >
                          <Icon size={14} className="shrink-0" />
                          <span className="truncate max-w-full">{app.shortLabel}</span>
                          {app.isLive && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                              title="Aktif"
                            />
                          )}
                          {!app.isLive && app.badgeText && (
                            <span className="hidden md:inline text-[9px] font-mono text-[#FFB458]">
                              {app.badgeText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            )}
          </ViceCityGameFrame>
        )}
      </AnimatePresence>

      {/* External Full-Viewport Detected Modal (100% Heat) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && stage === 'playing' && isDetected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 select-none"
                role="alertdialog"
                aria-modal="true"
                aria-label="Terdeteksi"
              >
                <motion.div
                  initial={{ y: 14, opacity: 0, scale: 0.96 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 10, opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="max-w-sm w-full rounded-2xl bg-[#250D47] border-2 border-[#F36A78] p-5 text-center space-y-3.5 shadow-2xl"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#F36A78]/20 text-[#F36A78] flex items-center justify-center">
                    <AlertTriangle size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-wide text-[#F36A78]">
                      TERDETEKSI!
                    </h3>
                    <p className="text-xs sm:text-sm text-white/85 mt-1.5 leading-relaxed">
                      Deteksi / Heat mencapai 100% sebelum 1.000 korban tercapai. Gunakan Rootkit
                      Stealth dan hapus jejak lebih rutin.
                    </p>
                    <p className="text-xs font-mono font-bold text-[#FFB458] mt-2">
                      Korban terakhir: {victims.toLocaleString('id-ID')} / 1.000
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetSimulation();
                      gtaAudio.startCheaterBgm();
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#F36A78] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Coba Lagi
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Post-Win Sequence & GTB Limit 30% Reward Modal */}
      <CheaterVictorySequence
        isOpen={isOpen && stage === 'victory_anim'}
        onComplete={onClose}
      />
    </>
  );
}
