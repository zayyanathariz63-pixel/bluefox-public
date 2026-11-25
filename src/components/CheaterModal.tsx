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

  // Underground laptop state (null = desktop overview, non-null = open portaled app popup)
  const [openApp, setOpenApp] = useState<DesktopAppId | null>(null);
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
    setOpenApp(null);
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
        text: 'Laptop underground aktif. Pilih salah satu dari 5 aplikasi di bawah.',
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
        (moduleLevels.stealth * 22 + moduleLevels.ssl * 16) / 100;
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
          setOpenApp(null);
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
          setOpenApp(null);
          gtaAudio.stopHeistBgm();
          gtaAudio.playBustedSfx();
        }
        return nextHeat;
      });

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
    setOpenApp(app);
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
        setOpenApp(null);
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
        setOpenApp(null);
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
  const totalUpgradesBought =
    moduleLevels.dropper + moduleLevels.stealth + moduleLevels.botnet + moduleLevels.ssl;

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
      subtitle: 'Upgrade modul & stealth payload',
      icon: Bug,
      statusText: `${totalUpgradesBought}/12 Modul`,
    },
    {
      id: 'cheat',
      label: 'Cheat Code GTB 6',
      shortLabel: 'Cheat',
      subtitle: 'Buat kode promo umpan korban',
      icon: Terminal,
      statusText: activeBaitObj ? `+${activeBaitObj.victimBoostPct}% Tarik` : 'Pilih Umpan',
    },
    {
      id: 'studio',
      label: 'GTB Studio',
      shortLabel: 'Studio',
      subtitle: 'Rakit GTB Mod / Asli (Palsu)',
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
        ? `Live v${publishedModPkg.version}`
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
        ? `Live v${publishedFakeAsliPkg.version}`
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
              <div className="w-full max-h-[min(68dvh,calc(92dvh-120px))] overflow-y-auto p-4 sm:p-6">
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
              <div className="w-full max-h-[min(68dvh,calc(92dvh-120px))] overflow-y-auto p-2.5 sm:p-4 text-white">
                <div className="w-full max-w-4xl mx-auto flex flex-col gap-3">
                  {/* Compact Laptop Top Bar: Victims, Credits & Heat */}
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
                            Ketuk aplikasi untuk membuka popup kontrol
                          </p>
                        </div>
                      </div>

                      <div className="px-3 py-1 rounded-xl bg-[#3B146B] border border-[#FFB458]/45 font-mono tabular-nums text-xs font-extrabold text-[#FFB458]">
                        {credits} Kredit
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Victim Progress */}
                      <div className="rounded-xl bg-[#120726] border border-white/10 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums font-bold">
                          <span className="text-white/80">Target Korban</span>
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

                      {/* Detection / Heat Meter + Quick Scrub */}
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
                            onClick={handleScrubLogs}
                            disabled={scrubLeftSec > 0 || credits < 30 || heat <= 0}
                            className="px-2.5 py-1 rounded-lg bg-[#3B146B] hover:bg-[#7B208F] disabled:opacity-45 text-white text-[10px] font-bold inline-flex items-center gap-1 border border-white/15 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <RotateCcw size={10} />
                            <span>
                              {scrubLeftSec > 0 ? `${scrubLeftSec}s` : 'Hapus Jejak (30)'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5 Desktop App Launcher Grid (Comfortable on Android & Desktop) */}
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

      {/* External Full-Viewport Popups Portaled to document.body (Escape-from-Prison Shop style, scrollable top-to-bottom on Android) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <AnimatePresence>
              {isOpen && stage === 'playing' && openApp && !isDetected && activeAppMeta && (
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
                      <span className="text-white/90">{credits} Kredit</span>
                      <span className={heat >= 80 ? 'text-[#F36A78]' : 'text-emerald-300'}>
                        Heat {heat.toFixed(0)}%
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

                    {/* APP 1: STORE MALWARE */}
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
                          const canBuy = !isMax && credits >= cost;
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
                                    : `${lv === 0 ? 'Beli' : 'Upgrade'} · ${cost} Kredit`}
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

                    {/* APP 2: CHEAT CODE GTB 6 */}
                    {openApp === 'cheat' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-white/80">
                            Pilih kode promo palsu sebagai umpan.
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
                                    +{bait.victimBoostPct}%
                                  </span>
                                  <span className="block text-[10px] text-[#F36A78]">
                                    +{bait.heatAdd}% Heat
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
                                  GTB 6 Mod
                                </span>
                                <Upload size={14} className="text-[#C9349B]" />
                              </div>
                              <p className="text-[11px] text-white/75 mt-0.5">
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
                                  ? 'bg-[#3B146B] border-[#FF9B55]'
                                  : 'bg-white/[0.06] border-white/10 hover:border-white/25'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs sm:text-sm font-extrabold text-white">
                                  GTB 6 Asli (Palsu)
                                </span>
                                <Rocket size={14} className="text-[#FF9B55]" />
                              </div>
                              <p className="text-[11px] text-white/75 mt-0.5">
                                Gelombang korban besar &amp; cepat, risiko Heat lebih tinggi.
                              </p>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                            2. Payload Malware
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
                                ? `${activeBaitObj.code} (+${activeBaitObj.victimBoostPct}%)`
                                : 'Tanpa Umpan'}
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
                                  Ketuk untuk buka Publish GTB Mod
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
                                  Ketuk untuk buka Publish GTB Asli (Palsu)
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
                              <AlertTriangle size={15} className="text-[#F36A78] shrink-0 mt-0.5" />
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
                                Umpan: {builtModPkg.cheatBait ? builtModPkg.cheatBait.code : 'Tanpa Umpan'}
                              </p>
                              <p className="text-[#FFB458]">
                                Kecepatan: ~{builtModPkg.victimsPerTick} korban/detik
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
                                  : 'Sebar Link Forum (Boost Korban)'}
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
                              <AlertTriangle size={15} className="text-[#F36A78] shrink-0 mt-0.5" />
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
                              <p className="text-[#FFB458]">
                                Kecepatan: ~{builtFakeAsliPkg.victimsPerTick} korban/detik
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
                                  : 'Dorong Wave Viral (Boost Korban)'}
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
            </AnimatePresence>
          </>,
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
