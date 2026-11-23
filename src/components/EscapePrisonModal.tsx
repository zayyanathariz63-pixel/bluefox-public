import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Sun,
  Moon,
  Layers,
  Check,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Video,
  BedDouble,
  Gem,
  Clock,
  Coins,
  X,
  Eye,
} from 'lucide-react';
import {
  completeEscapePrisonMission,
  getSeasonPassState,
  isMissionCompleted,
  GtaSeasonPassState,
} from '../lib/gtaSeasonPass';
import { gtaAudio } from '../lib/gtaAudio';
import { TopiGtb6Svg } from './TopiGtb6Svg';
import { EscapePrisonVictorySequence } from './EscapePrisonVictorySequence';
import { ViceCityGameFrame } from './ViceCityGameFrame';

interface EscapePrisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionSuccess?: (state: GtaSeasonPassState) => void;
}

type ModalStage = 'briefing' | 'playing' | 'escape_cutscene' | 'victory_anim';
type CyclePhase = 'night' | 'day';
type FoxWalkState =
  | 'at_rest'
  | 'walking_to_hole'
  | 'climbing_down'
  | 'inside_hole'
  | 'climbing_up'
  | 'walking_to_rest'
  | 'walking_to_bed'
  | 'sleeping';

interface DirtParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  color: string;
  size: number;
  text?: string;
}

interface UndergroundArtifact {
  pct: number;
  label: string;
  xOffset: number;
  color: string;
}

const LOGICAL_W = 960;
const LOGICAL_H = 540;
const WORLD_W = 1520;
const WORLD_H = 720;
const GROUND_Y = 340;
const BED_X = 122;
const REST_X = 198;
const HOLE_X = 340;
const EXIT_X = 1090;
const TUNNEL_Y = 485;
const BASE_PHASE_SEC = 120; // 2 minutes Night / 2 minutes Day
const DIG_COOLDOWN_MS = 1000; // Strict 1.0s cooldown per swing (anti-auto-clicker)
const MAX_UPGRADE_LV = 5;

const RED_EYES_X = 510;
const RED_EYES_Y = 198;
const CORRIDOR_RECT = { x: 435, y: 115, w: 150, h: GROUND_Y - 115 };

const ARTIFACTS: UndergroundArtifact[] = [
  { pct: 12, label: 'Sendok Besi Tua', xOffset: 0.05, color: '#CBD5E1' },
  { pct: 28, label: 'Koin Vice City', xOffset: 0.25, color: '#FFB458' },
  { pct: 48, label: 'Kunci Sipir Lama', xOffset: 0.5, color: '#FDE047' },
  { pct: 68, label: 'Peta Terowongan', xOffset: 0.75, color: '#67E8F9' },
  { pct: 85, label: 'Berlian Terpendam', xOffset: 0.94, color: '#F36A78' },
];

function getTunnelZoneLabel(pct: number): string {
  if (pct < 8) return 'Lantai Sel';
  if (pct < 30) return 'Fondasi Penjara';
  if (pct < 60) return 'Bawah Pagar Kawat';
  if (pct < 88) return 'Halaman Luar';
  return 'Menuju Kebebasan';
}

const SOIL_ROCKS = Array.from({ length: 42 }, (_, i) => ({
  x: 40 + ((i * 197 + 53) % 1440),
  y: 375 + ((i * 89 + 17) % 315),
  r: 3 + (i % 5),
}));

const NIGHT_STARS = Array.from({ length: 48 }, (_, i) => ({
  x: 635 + ((i * 163 + 29) % 865),
  y: 18 + ((i * 71 + 11) % 210),
  r: 1 + (i % 2) * 0.9,
  phase: i * 0.7,
}));

function PickaxeSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14.5 9.5L4 20"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M9 4.5C13.5 4.8 17.5 7.5 19.5 12.2L16.8 13.4C15.2 9.9 12.3 7.8 8.6 7.3L9 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatClock(secFloat: number): string {
  const clamped = Math.max(0, Math.ceil(secFloat));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function drawBluefoxCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: {
    facing?: 1 | -1;
    walkPhase?: number;
    isWalking?: boolean;
    isClimbing?: boolean;
    pickaxeSwing?: number;
    armsUp?: boolean;
    scale?: number;
  }
) {
  const {
    facing = 1,
    walkPhase = 0,
    isWalking = false,
    isClimbing = false,
    pickaxeSwing = 0,
    armsUp = false,
    scale = 1,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);

  const stride = isWalking ? Math.sin(walkPhase) * 8 : isClimbing ? Math.sin(walkPhase) * 5 : 0;
  const bob = isWalking ? Math.abs(Math.cos(walkPhase)) * 2.5 : 0;

  if (!isClimbing) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 34, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(0, -bob);

  // Legs
  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (isClimbing) {
    ctx.moveTo(-4, 14);
    ctx.lineTo(-9, 28 + stride * 0.8);
    ctx.moveTo(4, 14);
    ctx.lineTo(9, 28 - stride * 0.8);
  } else {
    ctx.moveTo(-4, 14);
    ctx.lineTo(-4 - stride, 32);
    ctx.moveTo(4, 14);
    ctx.lineTo(4 + stride, 32);
  }
  ctx.stroke();

  // Back arm
  ctx.strokeStyle = '#1D4ED8';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  if (armsUp) {
    ctx.moveTo(-8, -8);
    ctx.lineTo(-18, -28);
  } else if (isClimbing) {
    ctx.moveTo(-8, -8);
    ctx.lineTo(-16, -18 - stride * 0.7);
  } else {
    ctx.moveTo(-8, -8);
    ctx.lineTo(-12 + stride * 0.65, 9);
  }
  ctx.stroke();

  // Prison striped jumpsuit torso
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.roundRect(-12, -14, 24, 29, 7);
  ctx.fill();
  ctx.fillStyle = '#FF9B55';
  ctx.fillRect(-11, -5, 22, 4);
  ctx.fillRect(-11, 4, 22, 4);

  // Fox head & ears
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(0, -25, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-9, -34);
  ctx.lineTo(-13, -48);
  ctx.lineTo(-1, -37);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1, -37);
  ctx.lineTo(13, -48);
  ctx.lineTo(9, -34);
  ctx.closePath();
  ctx.fill();

  // Cyan cyber visor
  ctx.fillStyle = '#67E8F9';
  ctx.beginPath();
  ctx.roundRect(0, -29, 12, 6, 3);
  ctx.fill();

  // Front arm (plus optional pickaxe)
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  if (armsUp) {
    ctx.moveTo(8, -8);
    ctx.lineTo(18, -28);
  } else if (isClimbing) {
    ctx.moveTo(8, -8);
    ctx.lineTo(16, -18 + stride * 0.7);
  } else {
    ctx.moveTo(8, -8);
    ctx.lineTo(13 - stride * 0.65, 8);
  }
  ctx.stroke();

  if (pickaxeSwing > 0) {
    const swingAngle = Math.sin(pickaxeSwing * Math.PI) * 0.95;
    ctx.save();
    ctx.translate(12, 2);
    ctx.rotate(swingAngle - 0.35);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(22, -18);
    ctx.stroke();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, -22);
    ctx.lineTo(28, -11);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawBluefoxSleepingOnBunk(ctx: CanvasRenderingContext2D, tSec: number) {
  // Bunk mattress top is at y=266, pillow around x=62..96, blanket x=96..182
  ctx.save();
  // Head resting on pillow
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(84, 260, 12, 0, Math.PI * 2);
  ctx.fill();
  // Ears tucked back
  ctx.beginPath();
  ctx.moveTo(74, 254);
  ctx.lineTo(66, 245);
  ctx.lineTo(80, 249);
  ctx.closePath();
  ctx.fill();
  // Dimmed closed visor line
  ctx.strokeStyle = '#67E8F9';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(82, 260);
  ctx.lineTo(92, 260);
  ctx.stroke();

  // Body under blanket (gentle breathing rise)
  const breath = Math.sin(tSec * 2.4) * 1.4;
  ctx.fillStyle = '#7B208F';
  ctx.beginPath();
  ctx.roundRect(96, 256 - breath * 0.5, 86, 22 + breath * 0.5, 6);
  ctx.fill();
  ctx.fillStyle = '#C9349B';
  ctx.fillRect(96, 256 - breath * 0.5, 10, 22 + breath * 0.5);

  // Floating "Zzz" indicator
  const zCycle = tSec % 2.4;
  for (let i = 0; i < 3; i++) {
    const p = (zCycle + i * 0.8) % 2.4;
    const ratio = p / 2.4;
    ctx.fillStyle = '#FFB458';
    ctx.globalAlpha = Math.max(0, 1 - ratio);
    ctx.font = `bold ${10 + i * 2}px sans-serif`;
    ctx.fillText('Z', 88 + ratio * 18 + i * 6, 242 - ratio * 26);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function EscapePrisonModal({
  isOpen,
  onClose,
  onMissionSuccess,
}: EscapePrisonModalProps) {
  const [seasonState, setSeasonState] = useState<GtaSeasonPassState>(() =>
    getSeasonPassState()
  );
  const completed = isMissionCompleted('escape-prison', seasonState);

  const [stage, setStage] = useState<ModalStage>('briefing');
  const [phase, setPhase] = useState<CyclePhase>('night');
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(BASE_PHASE_SEC);
  const [digProgress, setDigProgress] = useState<number>(0);
  const [inHole, setInHole] = useState<boolean>(false);
  const [rugCovered, setRugCovered] = useState<boolean>(true);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [bustedReason, setBustedReason] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => gtaAudio.isMuted());
  const [cooldownLeftMs, setCooldownLeftMs] = useState<number>(0);
  const [foundCount, setFoundCount] = useState<number>(0);

  // Coins & Red-Eye Black Market Upgrades
  const [coins, setCoins] = useState<number>(0);
  const [pickaxeLv, setPickaxeLv] = useState<number>(0);
  const [timeLv, setTimeLv] = useState<number>(0);
  const [moneyLv, setMoneyLv] = useState<number>(0);
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [hoverRedEyes, setHoverRedEyes] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<DirtParticle[]>([]);
  const swingAnimRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  const rugSlideRef = useRef<number>(1);
  const guardXRef = useRef<number>(760);
  const cctvAngleRef = useRef<number>(0);
  const camStateRef = useRef({ x: 345, y: 215, zoom: 1.48 });

  // Walking, climbing & sleeping state refs
  const foxWalkStateRef = useRef<FoxWalkState>('at_rest');
  const foxXRef = useRef<number>(REST_X);
  const climbProgressRef = useRef<number>(0);
  const walkCycleRef = useRef<number>(0);
  const cutsceneTimeRef = useRef<number>(0);
  const cutsceneDoneRef = useRef<boolean>(false);
  const zoomedOutAnnouncedRef = useRef<boolean>(false);
  const coinFractionRef = useRef<number>(0);

  // Strict 1.0s dig anti-spam ref
  const lastDigHitAtRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synced refs for animation loop & timers
  const stageRef = useRef<ModalStage>('briefing');
  const phaseRef = useRef<CyclePhase>('night');
  const progressRef = useRef<number>(0);
  const inHoleRef = useRef<boolean>(false);
  const rugCoveredRef = useRef<boolean>(true);
  const sleepingRef = useRef<boolean>(false);
  const bustedRef = useRef<boolean>(false);
  const timeLvRef = useRef<number>(0);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    progressRef.current = digProgress;
  }, [digProgress]);
  useEffect(() => {
    inHoleRef.current = inHole;
  }, [inHole]);
  useEffect(() => {
    rugCoveredRef.current = rugCovered;
  }, [rugCovered]);
  useEffect(() => {
    sleepingRef.current = isSleeping;
  }, [isSleeping]);
  useEffect(() => {
    bustedRef.current = Boolean(bustedReason);
  }, [bustedReason]);
  useEffect(() => {
    timeLvRef.current = timeLv;
  }, [timeLv]);

  const showHint = useCallback((msg: string) => {
    setActionHint(msg);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => {
      setActionHint(null);
    }, 2600);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSeasonState(getSeasonPassState());
      setStage('briefing');
      stageRef.current = 'briefing';
      setPhase('night');
      phaseRef.current = 'night';
      setPhaseSecondsLeft(BASE_PHASE_SEC);
      setDigProgress(0);
      progressRef.current = 0;
      setInHole(false);
      inHoleRef.current = false;
      setRugCovered(true);
      rugCoveredRef.current = true;
      setIsSleeping(false);
      sleepingRef.current = false;
      setBustedReason(null);
      bustedRef.current = false;
      setActionHint(null);
      setCooldownLeftMs(0);
      setFoundCount(0);
      setCoins(0);
      setPickaxeLv(0);
      setTimeLv(0);
      setMoneyLv(0);
      setShopOpen(false);
      setHoverRedEyes(false);
      coinFractionRef.current = 0;
      lastDigHitAtRef.current = 0;
      particlesRef.current = [];
      rugSlideRef.current = 1;
      foxWalkStateRef.current = 'at_rest';
      foxXRef.current = REST_X;
      climbProgressRef.current = 0;
      camStateRef.current = { x: 345, y: 215, zoom: 1.48 };
      cutsceneTimeRef.current = 0;
      cutsceneDoneRef.current = false;
      zoomedOutAnnouncedRef.current = false;
    } else {
      gtaAudio.stopHeistBgm();
    }
    return () => {
      gtaAudio.stopHeistBgm();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, [isOpen]);

  // Smooth 1.0s Dig Cooldown UI updater
  useEffect(() => {
    if (cooldownLeftMs <= 0) return;
    const iv = setInterval(() => {
      const rem = Math.max(0, DIG_COOLDOWN_MS - (Date.now() - lastDigHitAtRef.current));
      setCooldownLeftMs(rem);
    }, 50);
    return () => clearInterval(iv);
  }, [cooldownLeftMs]);

  // Allow closing Shop popup with Escape key
  useEffect(() => {
    if (!shopOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShopOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shopOpen]);

  const triggerBusted = useCallback((reason: string) => {
    if (bustedRef.current || stageRef.current !== 'playing') return;
    bustedRef.current = true;
    gtaAudio.playBustedSfx();
    setShopOpen(false);
    setBustedReason(reason);
    setDigProgress((prev) => {
      const penalized = Math.max(0, Number((prev - 25).toFixed(1)));
      progressRef.current = penalized;
      if (penalized < 8) zoomedOutAnnouncedRef.current = false;
      setFoundCount(ARTIFACTS.filter((a) => penalized >= a.pct).length);
      return penalized;
    });
    setInHole(false);
    inHoleRef.current = false;
    setIsSleeping(false);
    sleepingRef.current = false;
    setRugCovered(true);
    rugCoveredRef.current = true;
    foxWalkStateRef.current = 'at_rest';
    foxXRef.current = REST_X;
    climbProgressRef.current = 0;
  }, []);

  // Day/Night cycle countdown loop: normal 1x, sleeping on bunk strictly 2x!
  useEffect(() => {
    if (!isOpen || stage !== 'playing') return;

    const tickInterval = setInterval(() => {
      if (bustedRef.current) return;

      const tickMultiplier = sleepingRef.current ? 2 : 1;

      setPhaseSecondsLeft((prev) => {
        const next = prev - 0.25 * tickMultiplier;
        if (next <= 0) {
          const nextPhase: CyclePhase = phaseRef.current === 'night' ? 'day' : 'night';
          phaseRef.current = nextPhase;
          setPhase(nextPhase);
          gtaAudio.playPhaseShiftSfx(nextPhase === 'night');
          gtaAudio.startPrisonBgm(nextPhase);

          if (nextPhase === 'day') {
            setShopOpen(false);
            const unsafe =
              inHoleRef.current ||
              foxWalkStateRef.current === 'walking_to_hole' ||
              foxWalkStateRef.current === 'climbing_down' ||
              foxWalkStateRef.current === 'climbing_up';
            if (unsafe) {
              triggerBusted('CCTV Sel & Sipir mendeteksi kamu berada di lubang saat Siang tiba!');
            } else if (!rugCoveredRef.current) {
              triggerBusted('CCTV Sel melihat lubang terowongan karena Karpet belum ditutup saat Siang!');
            }
          } else {
            // Waking up automatically when Night begins!
            if (sleepingRef.current || foxWalkStateRef.current === 'walking_to_bed' || foxWalkStateRef.current === 'sleeping') {
              sleepingRef.current = false;
              setIsSleeping(false);
              foxWalkStateRef.current = 'at_rest';
              foxXRef.current = REST_X;
              showHint('Malam tiba! Bangun dari kasur dan lanjutkan menggali.');
            }
          }

          return nextPhase === 'night' ? BASE_PHASE_SEC + timeLvRef.current * 10 : BASE_PHASE_SEC;
        }
        return next;
      });
    }, 250);

    return () => clearInterval(tickInterval);
  }, [isOpen, stage, triggerBusted, showHint]);

  const spawnParticles = useCallback(
    (x: number, y: number, count: number, celebration = false, floatingText?: string) => {
      const colors = celebration
        ? ['#FFB458', '#F36A78', '#C9349B', '#67E8F9']
        : ['#D97706', '#92400E', '#F59E0B'];
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 22,
          y,
          vx: (Math.random() - 0.5) * (celebration ? 240 : 155),
          vy: -90 - Math.random() * (celebration ? 150 : 95),
          age: 0,
          maxAge: celebration ? 0.85 : 0.48,
          color: colors[i % colors.length],
          size: celebration ? 4.5 : 3.8,
        });
      }
      if (floatingText) {
        particlesRef.current.push({
          x,
          y: y - 16,
          vx: 0,
          vy: -48,
          age: 0,
          maxAge: 0.78,
          color: '#FFB458',
          size: 12,
          text: floatingText,
        });
      }
    },
    []
  );

  // Main 2D Cutaway World Renderer
  useEffect(() => {
    if (!isOpen || (stage !== 'playing' && stage !== 'escape_cutscene')) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let prevNow = performance.now();

    const drawWorld = (now: number) => {
      const dt = Math.min(0.05, (now - prevNow) / 1000);
      prevNow = now;
      const tSec = now / 1000;

      const curStage = stageRef.current;
      const isNight = phaseRef.current === 'night';
      const pct = Math.max(0, Math.min(100, progressRef.current));

      const shaftDepth =
        pct <= 0 ? 18 : Math.max(24, (Math.min(8, pct) / 8) * (TUNNEL_Y - GROUND_Y));
      const horizRatio = Math.max(0, Math.min(1, (pct - 8) / 80));
      const tunnelEndX = HOLE_X + horizRatio * (EXIT_X - HOLE_X);
      const exitRatio = Math.max(0, Math.min(1, (pct - 88) / 12));
      const exitTopY = TUNNEL_Y - exitRatio * (TUNNEL_Y - GROUND_Y);

      const targetRug = rugCoveredRef.current ? 1 : 0;
      rugSlideRef.current += (targetRug - rugSlideRef.current) * Math.min(1, dt * 10);

      if (swingAnimRef.current > 0) {
        swingAnimRef.current = Math.max(0, swingAnimRef.current - dt * 4.2);
      }
      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - dt * 14);
      }

      if (!isNight && curStage === 'playing') {
        guardXRef.current = 520 + Math.sin(tSec * 1.1) * 145;
      } else {
        guardXRef.current = 900;
      }

      cctvAngleRef.current = Math.sin(tSec * 1.05);
      const cctvTargetX = 330 + cctvAngleRef.current * 140;

      // Walking, Climbing & Sleeping State Machine
      if (curStage === 'playing') {
        const wState = foxWalkStateRef.current;
        if (wState === 'walking_to_hole') {
          walkCycleRef.current += dt * 16;
          foxXRef.current = Math.min(HOLE_X, foxXRef.current + dt * 215);
          if (foxXRef.current >= HOLE_X - 1) {
            foxXRef.current = HOLE_X;
            climbProgressRef.current = 0;
            foxWalkStateRef.current = 'climbing_down';
            gtaAudio.playHoleToggleSfx(true);
          }
        } else if (wState === 'climbing_down') {
          walkCycleRef.current += dt * 14;
          climbProgressRef.current = Math.min(1, climbProgressRef.current + dt / 0.58);
          if (Math.random() < 0.25) {
            spawnParticles(HOLE_X, GROUND_Y + 6, 1, false);
          }
          if (climbProgressRef.current >= 1) {
            climbProgressRef.current = 1;
            foxWalkStateRef.current = 'inside_hole';
            inHoleRef.current = true;
            setInHole(true);
          }
        } else if (wState === 'climbing_up') {
          walkCycleRef.current += dt * 14;
          climbProgressRef.current = Math.max(0, climbProgressRef.current - dt / 0.48);
          if (climbProgressRef.current <= 0) {
            climbProgressRef.current = 0;
            foxXRef.current = HOLE_X;
            foxWalkStateRef.current = 'walking_to_rest';
          }
        } else if (wState === 'walking_to_rest') {
          walkCycleRef.current += dt * 16;
          if (foxXRef.current > REST_X) {
            foxXRef.current = Math.max(REST_X, foxXRef.current - dt * 215);
          } else {
            foxXRef.current = Math.min(REST_X, foxXRef.current + dt * 215);
          }
          if (Math.abs(foxXRef.current - REST_X) <= 2) {
            foxXRef.current = REST_X;
            foxWalkStateRef.current = 'at_rest';
          }
        } else if (wState === 'walking_to_bed') {
          walkCycleRef.current += dt * 15;
          foxXRef.current = Math.max(BED_X, foxXRef.current - dt * 200);
          if (foxXRef.current <= BED_X + 1) {
            foxXRef.current = BED_X;
            foxWalkStateRef.current = 'sleeping';
            sleepingRef.current = true;
            setIsSleeping(true);
          }
        }
      }

      if (curStage === 'escape_cutscene') {
        cutsceneTimeRef.current += dt;
        const ct = cutsceneTimeRef.current;
        if (ct >= 2.95 && ct < 3.05 && Math.random() < 0.45) {
          spawnParticles(EXIT_X + 20, GROUND_Y - 12, 4, true);
        }
        if (ct >= 4.65 && !cutsceneDoneRef.current) {
          cutsceneDoneRef.current = true;
          const updated = completeEscapePrisonMission();
          setSeasonState(updated);
          onMissionSuccess?.(updated);
          setStage('victory_anim');
          stageRef.current = 'victory_anim';
          return;
        }
      }

      // Camera Zoom-Out Threshold at 8.0%
      const shouldZoomOut = pct >= 8 || curStage === 'escape_cutscene';
      let targetCamX = 345;
      let targetCamY = 218;
      let targetCamZoom = 1.46;

      if (curStage === 'escape_cutscene') {
        const panRatio = Math.min(1, cutsceneTimeRef.current / 3.1);
        targetCamX = 720 + panRatio * 140;
        targetCamY = 345;
        targetCamZoom = 0.65;
      } else if (shouldZoomOut) {
        targetCamX = 760;
        targetCamY = 352;
        targetCamZoom = 0.62;
      }

      camStateRef.current.x += (targetCamX - camStateRef.current.x) * Math.min(1, dt * 3.4);
      camStateRef.current.y += (targetCamY - camStateRef.current.y) * Math.min(1, dt * 3.4);
      camStateRef.current.zoom +=
        (targetCamZoom - camStateRef.current.zoom) * Math.min(1, dt * 3.4);

      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current * 4 : 0;
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current * 4 : 0;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = isNight ? '#0B0419' : '#2C1838';
          ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

          ctx.save();
          ctx.translate(LOGICAL_W / 2 + shakeX, LOGICAL_H / 2 + shakeY);
          ctx.scale(camStateRef.current.zoom, camStateRef.current.zoom);
          ctx.translate(-camStateRef.current.x, -camStateRef.current.y);

          // =========================================================
          // 1. SKY, SUN / MOON & OUTSIDE LANDSCAPE
          // =========================================================
          const skyGrad = ctx.createLinearGradient(0, -140, 0, GROUND_Y);
          if (isNight) {
            skyGrad.addColorStop(0, '#070314');
            skyGrad.addColorStop(0.55, '#1B0B36');
            skyGrad.addColorStop(1, '#3B146B');
          } else {
            skyGrad.addColorStop(0, '#F36A78');
            skyGrad.addColorStop(0.45, '#FF9B55');
            skyGrad.addColorStop(1, '#FFB458');
          }
          ctx.fillStyle = skyGrad;
          ctx.fillRect(-160, -220, WORLD_W + 320, GROUND_Y + 220);

          if (isNight) {
            for (const s of NIGHT_STARS) {
              const alpha = 0.45 + Math.sin(tSec * 2.2 + s.phase) * 0.4;
              ctx.fillStyle = `rgba(255, 245, 220, ${alpha.toFixed(2)})`;
              ctx.beginPath();
              ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.save();
            ctx.translate(1190, 96);
            const moonHalo = ctx.createRadialGradient(0, 0, 12, 0, 0, 92);
            moonHalo.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
            moonHalo.addColorStop(1, 'rgba(254, 240, 138, 0)');
            ctx.fillStyle = moonHalo;
            ctx.beginPath();
            ctx.arc(0, 0, 92, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FEF08A';
            ctx.beginPath();
            ctx.arc(0, 0, 34, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#15082B';
            ctx.beginPath();
            ctx.arc(13, -8, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.save();
            ctx.translate(1190, 96);
            const sunHalo = ctx.createRadialGradient(0, 0, 18, 0, 0, 135);
            sunHalo.addColorStop(0, 'rgba(255, 248, 195, 0.9)');
            sunHalo.addColorStop(0.45, 'rgba(255, 180, 88, 0.35)');
            sunHalo.addColorStop(1, 'rgba(255, 180, 88, 0)');
            ctx.fillStyle = sunHalo;
            ctx.beginPath();
            ctx.arc(0, 0, 135, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFF7AE';
            ctx.beginPath();
            ctx.arc(0, 0, 38, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.fillStyle = isNight ? '#16092E' : 'rgba(59, 20, 107, 0.42)';
          const cityBuildings = [
            { x: 690, w: 55, h: 120 },
            { x: 755, w: 42, h: 85 },
            { x: 840, w: 72, h: 155 },
            { x: 925, w: 48, h: 105 },
            { x: 1020, w: 68, h: 138 },
            { x: 1120, w: 58, h: 95 },
            { x: 1220, w: 80, h: 168 },
            { x: 1320, w: 64, h: 115 },
            { x: 1405, w: 85, h: 142 },
          ];
          for (const b of cityBuildings) {
            ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
          }

          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(810, GROUND_Y);
          ctx.lineTo(810, 190);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = 1.5;
          for (let fy = 205; fy < GROUND_Y; fy += 18) {
            ctx.beginPath();
            ctx.moveTo(800, fy);
            ctx.lineTo(820, fy + 10);
            ctx.stroke();
          }
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.6;
          for (let wx = 798; wx <= 822; wx += 8) {
            ctx.beginPath();
            ctx.arc(wx, 186, 7, 0, Math.PI * 2);
            ctx.stroke();
          }

          const drawPalm = (px: number, py: number, scale: number) => {
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(scale, scale);
            ctx.strokeStyle = isNight ? '#1E1136' : '#3B146B';
            ctx.lineWidth = 9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(10, -68, -6, -130);
            ctx.stroke();

            ctx.fillStyle = isNight ? '#271347' : '#3B146B';
            const angles = [-2.5, -1.9, -1.1, -0.4, 0.25];
            for (const a of angles) {
              ctx.save();
              ctx.translate(-6, -130);
              ctx.rotate(a + Math.sin(tSec * 1.4 + px) * 0.04);
              ctx.beginPath();
              ctx.ellipse(24, 0, 28, 7, 0.12, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            ctx.restore();
          };
          drawPalm(955, GROUND_Y, 0.95);
          drawPalm(1340, GROUND_Y, 1.15);

          ctx.fillStyle = isNight ? '#1D1433' : '#475569';
          ctx.fillRect(1240, GROUND_Y - 6, 360, 10);
          ctx.fillStyle = isNight ? '#22C55E' : '#16A34A';
          ctx.fillRect(620, GROUND_Y - 6, 620, 10);

          ctx.fillStyle = '#334155';
          ctx.fillRect(1152, GROUND_Y - 56, 4, 56);
          ctx.fillStyle = '#FFB458';
          ctx.beginPath();
          ctx.roundRect(1156, GROUND_Y - 54, 46, 18, 4);
          ctx.fill();
          ctx.fillStyle = '#111827';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('KELUAR', 1179, GROUND_Y - 42);

          // =========================================================
          // 2. PRISON BUILDING & INTERIOR CELL
          // =========================================================
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(26, 38, 600, 16);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.6;
          for (let rx = 40; rx <= 610; rx += 18) {
            ctx.beginPath();
            ctx.arc(rx, 31, 7, 0, Math.PI * 2);
            ctx.stroke();
          }

          const wallGrad = ctx.createLinearGradient(0, 54, 0, GROUND_Y);
          if (isNight) {
            wallGrad.addColorStop(0, '#1D0B38');
            wallGrad.addColorStop(1, '#3B146B');
          } else {
            wallGrad.addColorStop(0, '#59423B');
            wallGrad.addColorStop(1, '#856556');
          }
          ctx.fillStyle = wallGrad;
          ctx.fillRect(40, 54, 562, GROUND_Y - 54);

          ctx.strokeStyle = isNight ? 'rgba(123,32,143,0.28)' : 'rgba(17,24,39,0.18)';
          ctx.lineWidth = 2;
          for (let row = 0; row < 6; row++) {
            const ry = 82 + row * 44;
            ctx.beginPath();
            ctx.moveTo(40, ry);
            ctx.lineTo(602, ry);
            ctx.stroke();
            const offset = row % 2 === 0 ? 0 : 45;
            for (let cx = 40 + offset; cx < 602; cx += 90) {
              ctx.beginPath();
              ctx.moveTo(cx, ry);
              ctx.lineTo(cx, Math.min(GROUND_Y, ry + 44));
              ctx.stroke();
            }
          }

          ctx.fillStyle = '#334155';
          ctx.fillRect(16, 48, 28, GROUND_Y - 48);
          ctx.fillRect(600, 48, 30, GROUND_Y - 48);
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 2;
          ctx.strokeRect(600, 48, 30, GROUND_Y - 48);

          // High Barred Cell Window
          ctx.fillStyle = isNight ? '#120726' : '#FFB458';
          ctx.fillRect(138, 92, 136, 82);
          if (isNight) {
            ctx.fillStyle = '#FDE68A';
            ctx.beginPath();
            ctx.arc(236, 122, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#120726';
            ctx.beginPath();
            ctx.arc(241, 118, 10, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const winSun = ctx.createLinearGradient(138, 92, 274, 174);
            winSun.addColorStop(0, '#FFB458');
            winSun.addColorStop(1, '#FF9B55');
            ctx.fillStyle = winSun;
            ctx.fillRect(138, 92, 136, 82);
          }
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 5.5;
          ctx.strokeRect(138, 92, 136, 82);
          [172, 206, 240].forEach((bx) => {
            ctx.beginPath();
            ctx.moveTo(bx, 92);
            ctx.lineTo(bx, 174);
            ctx.stroke();
          });

          // Prison Bunk on Left (x = 54..186)
          ctx.fillStyle = '#334155';
          ctx.fillRect(54, 278, 132, 15);
          ctx.fillRect(60, 293, 9, 47);
          ctx.fillRect(172, 293, 9, 47);
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.roundRect(62, 264, 38, 14, 5);
          ctx.fill();
          ctx.fillStyle = '#7B208F';
          ctx.beginPath();
          ctx.roundRect(96, 266, 86, 14, 4);
          ctx.fill();

          // Cell Door Corridor Opening (Guard OR Night Red Eyes strictly clipped inside!)
          const { x: corrX, y: corrY, w: corrW, h: corrH } = CORRIDOR_RECT;
          ctx.fillStyle = isNight ? '#0B0417' : '#261D30';
          ctx.fillRect(corrX, corrY, corrW, corrH);

          ctx.save();
          ctx.beginPath();
          ctx.rect(corrX, corrY, corrW, corrH);
          ctx.clip();

          // DAY: Clipped Patrol Guard (Sipir)
          if (
            !isNight &&
            curStage === 'playing' &&
            guardXRef.current >= corrX - 35 &&
            guardXRef.current <= corrX + corrW + 35
          ) {
            const gx = guardXRef.current;
            const gy = 236;
            ctx.save();
            ctx.translate(gx, gy);

            const guardBeam = ctx.createLinearGradient(0, 0, -140, 90);
            guardBeam.addColorStop(0, 'rgba(255, 180, 88, 0.35)');
            guardBeam.addColorStop(1, 'rgba(255, 180, 88, 0)');
            ctx.fillStyle = guardBeam;
            ctx.beginPath();
            ctx.moveTo(-12, 4);
            ctx.lineTo(-160, 75);
            ctx.lineTo(-120, 125);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#1E293B';
            ctx.beginPath();
            ctx.roundRect(-16, -12, 32, 74, 7);
            ctx.fill();
            ctx.fillStyle = '#FBBF24';
            ctx.fillRect(-9, 0, 7, 7);
            ctx.fillStyle = '#FDE68A';
            ctx.beginPath();
            ctx.arc(0, -26, 13.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(-16, -41, 32, 10);
            ctx.fillRect(-20, -33, 24, 4);
            ctx.restore();
          }

          // NIGHT: Glowing Clickable Red Eyes ("Mata Merah") peeking between steel bars!
          if (isNight && curStage === 'playing') {
            const eyePulse = 0.72 + Math.sin(tSec * 4.2) * 0.28;
            const blink = Math.sin(tSec * 0.9) > 0.96 ? 0.15 : 1;

            // Shadowy silhouette behind bars
            ctx.fillStyle = 'rgba(20, 6, 36, 0.9)';
            ctx.beginPath();
            ctx.arc(RED_EYES_X, RED_EYES_Y + 2, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(RED_EYES_X - 28, RED_EYES_Y + 18, 56, 75, 14);
            ctx.fill();

            // Red eye ambient glow halo
            const eyeGlow = ctx.createRadialGradient(
              RED_EYES_X,
              RED_EYES_Y,
              4,
              RED_EYES_X,
              RED_EYES_Y,
              34
            );
            eyeGlow.addColorStop(0, `rgba(239, 68, 68, ${(0.55 * eyePulse).toFixed(2)})`);
            eyeGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = eyeGlow;
            ctx.beginPath();
            ctx.arc(RED_EYES_X, RED_EYES_Y, 34, 0, Math.PI * 2);
            ctx.fill();

            // Two sharp glowing crimson eyes between bar x=495 and bar x=525
            ctx.save();
            ctx.translate(RED_EYES_X, RED_EYES_Y);
            ctx.scale(1, blink);
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.ellipse(-7, 0, 4.2, 2.8, -0.18, 0, Math.PI * 2);
            ctx.ellipse(7, 0, 4.2, 2.8, 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FCA5A5';
            ctx.beginPath();
            ctx.arc(-6.5, 0, 1.4, 0, Math.PI * 2);
            ctx.arc(6.5, 0, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.restore(); // End Corridor clip

          // Steel bars over doorway
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 7;
          ctx.strokeRect(corrX, corrY, corrW, corrH);
          for (let bx = corrX + 30; bx < corrX + corrW; bx += 30) {
            ctx.beginPath();
            ctx.moveTo(bx, corrY);
            ctx.lineTo(bx, GROUND_Y);
            ctx.stroke();
          }

          // Clickable prompt badge above Mata Merah during Night
          if (isNight && curStage === 'playing') {
            ctx.save();
            ctx.fillStyle = 'rgba(127, 29, 29, 0.9)';
            ctx.strokeStyle = '#F87171';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.roundRect(RED_EYES_X - 48, corrY + 12, 96, 20, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#FEF2F2';
            ctx.font = 'bold 9.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('KLIK MATA MERAH', RED_EYES_X, corrY + 25.5);
            ctx.restore();
          }

          // =========================================================
          // 3. CELL CCTV CAMERA
          // =========================================================
          const camOriginX = 552;
          const camOriginY = 88;
          ctx.save();
          const cctvGrad = ctx.createLinearGradient(camOriginX, camOriginY, cctvTargetX, GROUND_Y);
          if (isNight) {
            cctvGrad.addColorStop(0, 'rgba(201, 52, 155, 0.22)');
            cctvGrad.addColorStop(1, 'rgba(201, 52, 155, 0.02)');
          } else {
            cctvGrad.addColorStop(0, 'rgba(243, 106, 120, 0.36)');
            cctvGrad.addColorStop(1, 'rgba(255, 180, 88, 0.08)');
          }
          ctx.fillStyle = cctvGrad;
          ctx.beginPath();
          ctx.moveTo(camOriginX, camOriginY);
          ctx.lineTo(cctvTargetX - 54, GROUND_Y);
          ctx.lineTo(cctvTargetX + 54, GROUND_Y);
          ctx.closePath();
          ctx.fill();

          if (!isNight) {
            ctx.strokeStyle = 'rgba(243, 106, 120, 0.48)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
          ctx.restore();

          ctx.save();
          ctx.translate(566, 76);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(14, -18);
          ctx.lineTo(0, 0);
          ctx.stroke();

          const aimAngle = Math.atan2(GROUND_Y - 76, cctvTargetX - 566);
          ctx.rotate(aimAngle - Math.PI);
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.roundRect(-24, -8, 28, 16, 4);
          ctx.fill();
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(-28, -6, 6, 12);

          if (Math.sin(tSec * 5.5) > -0.2) {
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(-6, -3, 2.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
          ctx.beginPath();
          ctx.roundRect(518, 59, 64, 16, 4);
          ctx.fill();
          ctx.fillStyle = Math.sin(tSec * 5.5) > -0.2 ? '#F87171' : '#94A3B8';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CAM-01 REC', 550, 70);

          // =========================================================
          // 4. UNDERGROUND SOIL STRATA & EXCAVATED TUNNEL
          // =========================================================
          const soilGrad = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
          soilGrad.addColorStop(0, '#59341D');
          soilGrad.addColorStop(0.32, '#412314');
          soilGrad.addColorStop(0.75, '#2A1511');
          soilGrad.addColorStop(1, '#160B14');
          ctx.fillStyle = soilGrad;
          ctx.fillRect(-160, GROUND_Y, WORLD_W + 320, WORLD_H - GROUND_Y + 120);

          ctx.fillStyle = isNight ? '#2B1947' : '#6B6070';
          ctx.fillRect(16, GROUND_Y - 5, 614, 15);
          ctx.fillStyle = isNight ? '#4C1D95' : '#8A7D91';
          ctx.fillRect(16, GROUND_Y - 5, 614, 4);

          ctx.fillStyle = 'rgba(15, 10, 18, 0.38)';
          for (const rk of SOIL_ROCKS) {
            ctx.beginPath();
            ctx.arc(rk.x, rk.y, rk.r, 0, Math.PI * 2);
            ctx.fill();
          }

          for (const art of ARTIFACTS) {
            if (pct < art.pct) {
              const ax = HOLE_X + art.xOffset * (EXIT_X - HOLE_X);
              const glint = 0.35 + Math.abs(Math.sin(tSec * 3 + art.pct)) * 0.55;
              ctx.fillStyle = art.color;
              ctx.globalAlpha = glint;
              ctx.beginPath();
              ctx.arc(ax, TUNNEL_Y, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }

          if (pct > 0 || foxWalkStateRef.current === 'climbing_down' || foxWalkStateRef.current === 'climbing_up') {
            ctx.fillStyle = '#1B0D0A';
            ctx.beginPath();
            ctx.roundRect(HOLE_X - 30, GROUND_Y - 2, 60, shaftDepth + 28, 18);
            ctx.fill();

            if (pct >= 8) {
              ctx.beginPath();
              ctx.roundRect(HOLE_X - 28, TUNNEL_Y - 30, tunnelEndX - HOLE_X + 58, 60, 22);
              ctx.fill();
            }

            if (pct > 88) {
              ctx.beginPath();
              ctx.roundRect(EXIT_X - 28, exitTopY - 4, 56, TUNNEL_Y - exitTopY + 32, 18);
              ctx.fill();
            }

            ctx.fillStyle = '#09040F';
            ctx.beginPath();
            ctx.roundRect(HOLE_X - 22, GROUND_Y, 44, shaftDepth + 20, 14);
            ctx.fill();

            if (pct >= 8) {
              ctx.beginPath();
              ctx.roundRect(HOLE_X - 22, TUNNEL_Y - 22, tunnelEndX - HOLE_X + 44, 44, 16);
              ctx.fill();

              ctx.fillStyle = '#78350F';
              for (let bx = HOLE_X + 85; bx < tunnelEndX - 20; bx += 145) {
                ctx.fillRect(bx, TUNNEL_Y - 22, 6, 44);
                ctx.fillRect(bx - 6, TUNNEL_Y - 22, 18, 5);
              }
            }

            if (pct > 88) {
              ctx.fillStyle = '#09040F';
              ctx.beginPath();
              ctx.roundRect(EXIT_X - 22, exitTopY - 2, 44, TUNNEL_Y - exitTopY + 24, 14);
              ctx.fill();
            }

            const holeRx = 32 + (pct / 100) * 14;
            ctx.fillStyle = '#78350F';
            ctx.beginPath();
            ctx.ellipse(HOLE_X, GROUND_Y + 2, holeRx + 10, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#09040F';
            ctx.beginPath();
            ctx.ellipse(HOLE_X, GROUND_Y + 1, holeRx, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            if (pct >= 94) {
              ctx.fillStyle = '#78350F';
              ctx.beginPath();
              ctx.ellipse(EXIT_X, GROUND_Y + 2, 34, 9, 0, 0, Math.PI * 2);
              ctx.fill();
              if (pct >= 99.5) {
                ctx.fillStyle = '#09040F';
                ctx.beginPath();
                ctx.ellipse(EXIT_X, GROUND_Y + 1, 24, 6.5, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          } else {
            ctx.fillStyle = '#09040F';
            ctx.beginPath();
            ctx.ellipse(HOLE_X, GROUND_Y + 1, 24, 5, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // =========================================================
          // 5. BLUEFOX CHARACTER (Sleep on Bunk + Walk + Climb + Dig + Cutscene)
          // =========================================================
          if (curStage === 'escape_cutscene') {
            const ct = cutsceneTimeRef.current;
            if (ct < 2.25) {
              const p = ct / 2.25;
              const cx = HOLE_X + p * (EXIT_X - HOLE_X);
              drawBluefoxCharacter(ctx, cx, TUNNEL_Y - 12, {
                facing: 1,
                walkPhase: ct * 20,
                isWalking: true,
                scale: 0.85,
              });
            } else if (ct < 2.9) {
              const p = (ct - 2.25) / 0.65;
              const cy = TUNNEL_Y - 12 - p * (TUNNEL_Y - 12 - (GROUND_Y - 34));
              drawBluefoxCharacter(ctx, EXIT_X, cy, {
                facing: 1,
                walkPhase: ct * 18,
                isClimbing: true,
                scale: 0.9,
              });
            } else {
              const jt = ct - 2.9;
              const jumpX = EXIT_X + Math.min(115, jt * 68);
              const jumpArc = Math.abs(Math.sin(jt * Math.PI * 3.1)) * 48;
              drawBluefoxCharacter(ctx, jumpX, GROUND_Y - 34 - jumpArc, {
                facing: 1,
                armsUp: true,
                scale: 1,
              });
            }
          } else {
            const wState = foxWalkStateRef.current;
            const targetPitY =
              pct < 8
                ? GROUND_Y + Math.max(12, shaftDepth - 22)
                : TUNNEL_Y - 12;

            if (wState === 'sleeping') {
              drawBluefoxSleepingOnBunk(ctx, tSec);
            } else if (wState === 'climbing_down' || wState === 'climbing_up') {
              const cp = climbProgressRef.current;
              const cy = GROUND_Y - 34 + cp * (targetPitY - (GROUND_Y - 34));

              ctx.save();
              ctx.beginPath();
              ctx.rect(HOLE_X - 45, 50, 90, GROUND_Y - 50 + shaftDepth + 45);
              ctx.clip();
              drawBluefoxCharacter(ctx, HOLE_X, cy, {
                facing: 1,
                walkPhase: walkCycleRef.current,
                isClimbing: true,
                scale: 0.92,
              });
              ctx.restore();
            } else if (wState === 'inside_hole') {
              let digCharX = HOLE_X;
              let digCharY = GROUND_Y + Math.max(12, shaftDepth - 22);
              if (pct >= 8 && pct < 88) {
                digCharX = Math.max(HOLE_X + 12, tunnelEndX - 16);
                digCharY = TUNNEL_Y - 12;
              } else if (pct >= 88) {
                digCharX = EXIT_X;
                digCharY = Math.max(GROUND_Y - 24, exitTopY + 10);
              }

              const lanternGlow = ctx.createRadialGradient(
                digCharX + 10,
                digCharY - 10,
                6,
                digCharX + 10,
                digCharY - 10,
                82
              );
              lanternGlow.addColorStop(0, 'rgba(255, 180, 88, 0.34)');
              lanternGlow.addColorStop(1, 'rgba(255, 180, 88, 0)');
              ctx.fillStyle = lanternGlow;
              ctx.beginPath();
              ctx.arc(digCharX + 10, digCharY - 10, 82, 0, Math.PI * 2);
              ctx.fill();

              drawBluefoxCharacter(ctx, digCharX, digCharY, {
                facing: 1,
                pickaxeSwing: swingAnimRef.current,
                scale: pct >= 8 ? 0.85 : 0.92,
              });
            } else {
              const isMoving =
                wState === 'walking_to_hole' ||
                wState === 'walking_to_rest' ||
                wState === 'walking_to_bed';
              const facing: 1 | -1 =
                wState === 'walking_to_bed' ||
                (wState === 'walking_to_rest' && foxXRef.current > REST_X)
                  ? -1
                  : 1;
              drawBluefoxCharacter(ctx, foxXRef.current, GROUND_Y - 34, {
                facing,
                walkPhase: walkCycleRef.current,
                isWalking: isMoving,
                scale: 1,
              });
            }
          }

          // =========================================================
          // 6. MOVABLE RUG ("Karpet")
          // =========================================================
          const rugX = HOLE_X - (1 - rugSlideRef.current) * 112;
          const rugY = GROUND_Y - 4;
          const rugScaleX = 1 - (1 - rugSlideRef.current) * 0.25;

          ctx.save();
          ctx.translate(rugX, rugY);
          ctx.scale(rugScaleX, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.42)';
          ctx.beginPath();
          ctx.roundRect(-62, -7, 124, 16, 6);
          ctx.fill();
          const rugGrad = ctx.createLinearGradient(-60, -8, 60, 8);
          rugGrad.addColorStop(0, '#7B208F');
          rugGrad.addColorStop(0.5, '#C9349B');
          rugGrad.addColorStop(1, '#F36A78');
          ctx.fillStyle = rugGrad;
          ctx.beginPath();
          ctx.roundRect(-60, -9, 120, 14, 5);
          ctx.fill();
          ctx.strokeStyle = '#FFB458';
          ctx.lineWidth = 2;
          ctx.strokeRect(-50, -6, 100, 8);
          ctx.restore();

          // =========================================================
          // 7. DIRT, COIN TEXT & CELEBRATION PARTICLES
          // =========================================================
          particlesRef.current = particlesRef.current.filter((p) => {
            p.age += dt;
            if (p.age >= p.maxAge) return false;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (!p.text) {
              p.vy += 320 * dt;
            }
            ctx.globalAlpha = 1 - p.age / p.maxAge;
            if (p.text) {
              ctx.fillStyle = p.color;
              ctx.font = 'bold 13px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(p.text, p.x, p.y);
            } else {
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
            return true;
          });

          ctx.restore();

          if (curStage === 'escape_cutscene' && cutsceneTimeRef.current >= 4.15) {
            const fadeRatio = Math.min(1, (cutsceneTimeRef.current - 4.15) / 0.5);
            ctx.save();
            ctx.globalAlpha = fadeRatio;
            const transitionGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
            transitionGrad.addColorStop(0, '#F36A78');
            transitionGrad.addColorStop(0.35, '#F87572');
            transitionGrad.addColorStop(0.7, '#FF9B55');
            transitionGrad.addColorStop(1, '#FFB458');
            ctx.fillStyle = transitionGrad;
            ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
            ctx.restore();
          }
        }
      }

      rafRef.current = requestAnimationFrame(drawWorld);
    };

    rafRef.current = requestAnimationFrame(drawWorld);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, stage, onMissionSuccess, spawnParticles]);

  // Convert screen pointer coordinates into world coordinates respecting dynamic camera zoom/pan
  const clientToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const lx = ((clientX - rect.left) / rect.width) * LOGICAL_W;
    const ly = ((clientY - rect.top) / rect.height) * LOGICAL_H;
    const cam = camStateRef.current;
    return {
      wx: (lx - LOGICAL_W / 2) / cam.zoom + cam.x,
      wy: (ly - LOGICAL_H / 2) / cam.zoom + cam.y,
    };
  };

  const isInsideRedEyesHitbox = (wx: number, wy: number) =>
    wx >= CORRIDOR_RECT.x - 10 &&
    wx <= CORRIDOR_RECT.x + CORRIDOR_RECT.w + 10 &&
    wy >= CORRIDOR_RECT.y - 10 &&
    wy <= CORRIDOR_RECT.y + CORRIDOR_RECT.h + 10;

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stageRef.current !== 'playing' || phaseRef.current !== 'night' || bustedRef.current) {
      if (hoverRedEyes) setHoverRedEyes(false);
      return;
    }
    const pt = clientToWorld(e.clientX, e.clientY);
    if (!pt) return;
    const hit = isInsideRedEyesHitbox(pt.wx, pt.wy);
    if (hit !== hoverRedEyes) setHoverRedEyes(hit);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stageRef.current !== 'playing' || bustedRef.current) return;
    if (phaseRef.current !== 'night') return;
    const pt = clientToWorld(e.clientX, e.clientY);
    if (!pt) return;

    if (isInsideRedEyesHitbox(pt.wx, pt.wy)) {
      gtaAudio.playNodeUnlockSfx();
      setShopOpen(true);
    }
  };

  // Single-hit Gali handler with strict 1.0-second delay + 1 coin base (+ money upgrade)
  const handleDigAction = () => {
    if (bustedRef.current || stageRef.current !== 'playing' || progressRef.current >= 100) return;

    if (phaseRef.current !== 'night') {
      showHint('Hanya bisa menggali saat fase Malam!');
      return;
    }
    if (rugCoveredRef.current) {
      showHint('Tekan "Buka Karpet" dulu sebelum menggali.');
      return;
    }

    const wState = foxWalkStateRef.current;
    if (wState === 'sleeping' || wState === 'walking_to_bed') {
      sleepingRef.current = false;
      setIsSleeping(false);
      foxXRef.current = REST_X;
      foxWalkStateRef.current = 'walking_to_hole';
      showHint('Bangun & menuju lubang galian...');
      return;
    }
    if (wState === 'at_rest' || wState === 'walking_to_rest') {
      foxWalkStateRef.current = 'walking_to_hole';
      showHint('Berjalan menuju lubang galian...');
      return;
    }
    if (wState === 'walking_to_hole' || wState === 'climbing_down' || wState === 'climbing_up') {
      return;
    }

    const now = Date.now();
    if (now - lastDigHitAtRef.current < DIG_COOLDOWN_MS) {
      return;
    }
    lastDigHitAtRef.current = now;
    setCooldownLeftMs(DIG_COOLDOWN_MS);

    swingAnimRef.current = 1;
    shakeRef.current = 1;
    gtaAudio.playDigPickaxeSfx();

    // Calculate coin earned: 1 base coin * (1 + moneyLv * 0.1)
    const moneyMult = Number((1 + moneyLv * 0.1).toFixed(1));
    coinFractionRef.current += 1 * moneyMult;
    const earnedCoins = Math.floor(coinFractionRef.current);
    coinFractionRef.current -= earnedCoins;
    if (earnedCoins > 0) {
      setCoins((c) => c + earnedCoins);
    }

    const curPct = progressRef.current;
    const tipX =
      curPct < 8
        ? HOLE_X
        : curPct < 88
        ? HOLE_X + ((curPct - 8) / 80) * (EXIT_X - HOLE_X)
        : EXIT_X;
    const tipY = curPct < 8 ? GROUND_Y + 25 : curPct < 88 ? TUNNEL_Y : GROUND_Y + 25;
    spawnParticles(tipX, tipY, 7, false, `+${earnedCoins} Koin`);

    const digStepPct = Number((0.1 + pickaxeLv * 0.1).toFixed(1));

    setDigProgress((prev) => {
      const next = Math.min(100, Number((prev + digStepPct).toFixed(1)));
      progressRef.current = next;

      if (prev < 8 && next >= 8 && !zoomedOutAnnouncedRef.current) {
        zoomedOutAnnouncedRef.current = true;
        showHint('8,0% tercapai! Kamera menjauh melihat pemandangan luar & jalur galian.');
      }

      const unlockedArtifact = ARTIFACTS.find((a) => prev < a.pct && next >= a.pct);
      if (unlockedArtifact) {
        gtaAudio.playNodeUnlockSfx();
        spawnParticles(tipX, tipY, 12, true);
        setFoundCount(ARTIFACTS.filter((a) => next >= a.pct).length);
        showHint(`Temuan Bawah Tanah: ${unlockedArtifact.label}!`);
      }

      if (next >= 100) {
        setShopOpen(false);
        gtaAudio.stopHeistBgm();
        gtaAudio.playNodeUnlockSfx();
        cutsceneTimeRef.current = 0;
        cutsceneDoneRef.current = false;
        stageRef.current = 'escape_cutscene';
        setStage('escape_cutscene');
      }
      return next;
    });
  };

  const handleToggleHole = () => {
    if (bustedReason || stage !== 'playing') return;
    const wState = foxWalkStateRef.current;
    if (
      wState === 'walking_to_hole' ||
      wState === 'climbing_down' ||
      wState === 'climbing_up' ||
      wState === 'walking_to_bed'
    ) {
      return;
    }

    if (!inHole && rugCovered) {
      showHint('Tekan "Buka Karpet" dulu sebelum turun ke lubang.');
      return;
    }
    if (!inHole && phase === 'day') {
      triggerBusted('CCTV Sel & Sipir melihat kamu berjalan menuju lubang di Siang hari!');
      return;
    }

    if (!inHole) {
      if (wState === 'sleeping') {
        sleepingRef.current = false;
        setIsSleeping(false);
        foxXRef.current = REST_X;
      }
      foxWalkStateRef.current = 'walking_to_hole';
      showHint('Berjalan & turun ke lubang galian...');
    } else {
      inHoleRef.current = false;
      setInHole(false);
      climbProgressRef.current = 1;
      foxWalkStateRef.current = 'climbing_up';
      gtaAudio.playHoleToggleSfx(false);
    }
  };

  const handleToggleRug = () => {
    if (bustedReason || stage !== 'playing') return;
    const wState = foxWalkStateRef.current;
    if (
      wState === 'walking_to_hole' ||
      wState === 'climbing_down' ||
      wState === 'climbing_up' ||
      wState === 'walking_to_bed'
    ) {
      showHint('Tunggu karakter selesai bergerak terlebih dahulu!');
      return;
    }
    if (rugCovered && phase === 'day') {
      setRugCovered(false);
      rugCoveredRef.current = false;
      triggerBusted('CCTV Sel melihat lubang terowongan saat Karpet dibuka di Siang hari!');
      return;
    }
    if (!rugCovered && inHole) {
      showHint('Tekan "Keluar Lubang" dulu sebelum menutup Karpet!');
      return;
    }
    const next = !rugCovered;
    setRugCovered(next);
    rugCoveredRef.current = next;
    gtaAudio.playRugToggleSfx(next);
  };

  // Sleep on the bunk -> strictly 2x time speed!
  const handleToggleSleep = () => {
    if (bustedReason || stage !== 'playing') return;
    const wState = foxWalkStateRef.current;
    if (wState === 'walking_to_hole' || wState === 'climbing_down' || wState === 'climbing_up') {
      showHint('Tunggu karakter selesai bergerak!');
      return;
    }

    if (wState === 'sleeping' || wState === 'walking_to_bed') {
      sleepingRef.current = false;
      setIsSleeping(false);
      foxXRef.current = BED_X;
      foxWalkStateRef.current = 'walking_to_rest';
      showHint('Bangun dari kasur (kecepatan waktu normal 1x).');
      return;
    }

    if (inHole || !rugCovered) {
      showHint('Keluar Lubang & Tutup Karpet dulu sebelum tidur di kasur!');
      return;
    }

    foxWalkStateRef.current = 'walking_to_bed';
    showHint('Berjalan ke kasur... Waktu dipercepat 2x saat tidur.');
  };

  // Red-Eye Black Market Upgrades
  const pickaxeCost = 5 * Math.pow(2, pickaxeLv);
  const timeCost = 10 * Math.pow(2, timeLv);
  const moneyCost = 20 * Math.pow(2, moneyLv);

  const handleBuyUpgrade = (kind: 'pickaxe' | 'time' | 'money') => {
    if (kind === 'pickaxe') {
      if (pickaxeLv >= MAX_UPGRADE_LV || coins < pickaxeCost) return;
      setCoins((c) => c - pickaxeCost);
      setPickaxeLv((lv) => lv + 1);
      gtaAudio.playNodeUnlockSfx();
      showHint(`Pickaxe Lv.${pickaxeLv + 1}: +${(0.1 + (pickaxeLv + 1) * 0.1).toFixed(1)}% per galian!`);
    } else if (kind === 'time') {
      if (timeLv >= MAX_UPGRADE_LV || coins < timeCost) return;
      setCoins((c) => c - timeCost);
      setTimeLv((lv) => lv + 1);
      setPhaseSecondsLeft((s) => s + 10);
      gtaAudio.playNodeUnlockSfx();
      showHint(`Waktu Malam bertambah +10 detik (Lv.${timeLv + 1}/5)!`);
    } else {
      if (moneyLv >= MAX_UPGRADE_LV || coins < moneyCost) return;
      setCoins((c) => c - moneyCost);
      setMoneyLv((lv) => lv + 1);
      gtaAudio.playNodeUnlockSfx();
      showHint(`Money Multiplier menjadi ${(1 + (moneyLv + 1) * 0.1).toFixed(1)}x!`);
    }
  };

  const handleStartMission = () => {
    if (completed) return;
    gtaAudio.unlock();
    setPhase('night');
    phaseRef.current = 'night';
    setPhaseSecondsLeft(BASE_PHASE_SEC);
    setDigProgress(0);
    progressRef.current = 0;
    setInHole(false);
    inHoleRef.current = false;
    setRugCovered(true);
    rugCoveredRef.current = true;
    setIsSleeping(false);
    sleepingRef.current = false;
    setBustedReason(null);
    bustedRef.current = false;
    setActionHint(null);
    setCooldownLeftMs(0);
    setFoundCount(0);
    setCoins(0);
    setPickaxeLv(0);
    setTimeLv(0);
    setMoneyLv(0);
    setShopOpen(false);
    coinFractionRef.current = 0;
    lastDigHitAtRef.current = 0;
    rugSlideRef.current = 1;
    foxWalkStateRef.current = 'at_rest';
    foxXRef.current = REST_X;
    climbProgressRef.current = 0;
    camStateRef.current = { x: 345, y: 215, zoom: 1.48 };
    zoomedOutAnnouncedRef.current = false;
    gtaAudio.startPrisonBgm('night');
    setStage('playing');
    stageRef.current = 'playing';
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    gtaAudio.setMuted(next);
  };

  const isNight = phase === 'night';
  const lowNightWarning =
    isNight &&
    phaseSecondsLeft <= 12 &&
    (inHole ||
      foxWalkStateRef.current === 'walking_to_hole' ||
      foxWalkStateRef.current === 'climbing_down' ||
      !rugCovered);
  const cooldownRatio = cooldownLeftMs / DIG_COOLDOWN_MS;
  const isCoolingDown = cooldownLeftMs > 0;
  const zoneLabel = getTunnelZoneLabel(digProgress);
  const currentDigGain = (0.1 + pickaxeLv * 0.1).toFixed(1);
  const currentMoneyMult = (1 + moneyLv * 0.1).toFixed(1);

  return (
    <>
      <AnimatePresence>
        {isOpen && stage !== 'victory_anim' && (
          <ViceCityGameFrame
            title="Escape from Prison"
            titleId="escape-prison-title"
            muted={muted}
            onToggleMute={handleToggleMute}
            onClose={onClose}
            closeLabel="Close Escape from Prison"
            topRightStatus={
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-white/90 border border-[#111827]/15 shadow-xs">
                <div className="w-10 sm:w-20 h-2 rounded-full bg-[#3B146B]/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${digProgress}%`,
                      background: 'linear-gradient(90deg, #7B208F 0%, #C9349B 60%, #F36A78 100%)',
                    }}
                  />
                </div>
                <span className="font-mono tabular-nums font-extrabold text-[11px] sm:text-xs text-[#111827]">
                  {digProgress.toFixed(1)}%
                </span>
              </div>
            }
            subStatus={
              stage === 'playing' || stage === 'escape_cutscene' ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        isNight
                          ? 'bg-[#3B146B] text-[#FFB458]'
                          : 'bg-[#111827] text-[#FFB458]'
                      }`}
                    >
                      {isNight ? <Moon size={11} /> : <Sun size={11} />}
                      <span className="font-mono tabular-nums">{formatClock(phaseSecondsLeft)}</span>
                      {isSleeping && (
                        <span className="ml-0.5 text-[10px] text-[#F36A78]">2x</span>
                      )}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#3B146B]/85 text-white text-[10px] font-bold">
                      {zoneLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#111827]/85 font-mono tabular-nums text-[10px] font-extrabold text-[#FFB458]">
                      <Coins size={11} />
                      <span>{coins} Koin</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3B146B]/85 font-mono tabular-nums text-[10px] font-bold text-white">
                      <Gem size={10} className="text-[#FFB458]" />
                      <span>{foundCount}/{ARTIFACTS.length}</span>
                    </span>
                  </div>
                </>
              ) : null
            }
            controller={
              stage === 'playing' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-white/90 px-0.5">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Video size={12} className={isNight ? 'text-[#FFB458]' : 'text-[#F36A78]'} />
                      <span className="truncate">
                        {isNight ? 'CCTV Standby · Klik Mata Merah' : 'CCTV Aktif + Sipir Patroli'}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                    {/* Dig Button (+0.1% base + pickaxe upgrade, strict 1s anti-spam cooldown) */}
                    <button
                      type="button"
                      onPointerDown={handleDigAction}
                      disabled={!isNight || Boolean(bustedReason) || isCoolingDown}
                      className={`relative overflow-hidden min-h-[46px] sm:min-h-[48px] px-2.5 rounded-2xl font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 border transition-all select-none ${
                        isNight && !bustedReason && !isCoolingDown
                          ? 'bg-[#C9349B] hover:brightness-110 active:scale-95 text-white border-white/25 cursor-pointer shadow-md'
                          : 'bg-[#3B146B]/85 text-white/60 border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {isCoolingDown && (
                        <div
                          className="absolute inset-y-0 left-0 bg-[#C9349B]/45 pointer-events-none"
                          style={{ width: `${(1 - cooldownRatio) * 100}%` }}
                        />
                      )}
                      <PickaxeSvg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 shrink-0" />
                      <span className="relative z-10 font-mono tabular-nums whitespace-nowrap">
                        {isCoolingDown
                          ? `Delay ${(cooldownLeftMs / 1000).toFixed(1)}s`
                          : `Gali (+${currentDigGain}%)`}
                      </span>
                    </button>

                    {/* Enter / Exit Hole */}
                    <button
                      type="button"
                      onClick={handleToggleHole}
                      disabled={Boolean(bustedReason)}
                      className={`min-h-[46px] sm:min-h-[48px] px-2.5 rounded-2xl font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 border transition-all active:scale-95 cursor-pointer ${
                        inHole
                          ? 'bg-[#C9349B] text-white border-[#FFB458]/60 shadow-md'
                          : 'bg-[#3B146B] text-white border-white/25 hover:bg-[#3B146B]/80'
                      }`}
                    >
                      {inHole ? (
                        <ArrowUp size={17} strokeWidth={2.5} className="shrink-0" />
                      ) : (
                        <ArrowDown size={17} strokeWidth={2.5} className="shrink-0" />
                      )}
                      <span className="whitespace-nowrap">
                        {inHole ? 'Keluar Lubang' : 'Masuk Lubang'}
                      </span>
                    </button>

                    {/* Open / Close Rug */}
                    <button
                      type="button"
                      onClick={handleToggleRug}
                      disabled={Boolean(bustedReason)}
                      className={`min-h-[46px] sm:min-h-[48px] px-2.5 rounded-2xl font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 border transition-all active:scale-95 cursor-pointer ${
                        rugCovered
                          ? 'bg-[#3B146B] text-[#FFB458] border-[#FFB458]/40 shadow-md'
                          : 'bg-[#C9349B] text-white border-white/30 shadow-md'
                      }`}
                    >
                      <Layers size={17} strokeWidth={2.4} className="shrink-0" />
                      <span className="whitespace-nowrap">
                        {rugCovered ? 'Buka Karpet' : 'Tutup Karpet'}
                      </span>
                    </button>

                    {/* Sleep on Bunk (strictly 2x time speed) */}
                    <button
                      type="button"
                      onClick={handleToggleSleep}
                      disabled={Boolean(bustedReason)}
                      className={`min-h-[46px] sm:min-h-[48px] px-2.5 rounded-2xl font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 border transition-all active:scale-95 cursor-pointer ${
                        isSleeping
                          ? 'bg-[#C9349B] text-white border-[#FFB458] shadow-md'
                          : 'bg-[#3B146B] hover:bg-[#C9349B]/80 text-white border-white/25 shadow-md'
                      }`}
                    >
                      <BedDouble size={17} strokeWidth={2.4} className="shrink-0" />
                      <span className="whitespace-nowrap">
                        {isSleeping ? 'Bangun (2x)' : 'Tidur Kasur (2x)'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : undefined
            }
          >
            {stage === 'briefing' && (
              <div className="w-full max-h-[65dvh] overflow-y-auto flex flex-col justify-center p-4 sm:p-6">
                <div className="w-full max-w-2xl mx-auto space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#3B146B]/55 border border-[#7B208F]/60 p-4">
                      <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                        <Moon size={14} strokeWidth={2.4} />
                        <span>Fase Malam (2:00)</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                        Buka Karpet, turun ke lubang, lalu gali (+0,1% &amp; +1 Koin, delay 1s). Klik Mata Merah di jeruji sel untuk upgrade Pickaxe, Waktu &amp; Money!
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FF9B55]/15 border border-[#FFB458]/40 p-4">
                      <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                        <Sun size={14} strokeWidth={2.4} />
                        <span>Fase Siang · Tidur 2x (2:00)</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                        Sipir &amp; CCTV aktif saat Siang. Tutup karpet dan tidur di kasur untuk mempercepat waktu 2x menunggu Malam tiba.
                      </p>
                    </div>
                  </div>

                  {/* Reward Preview */}
                  <div className="rounded-2xl p-4 bg-gradient-to-r from-[#3B146B] via-[#7B208F] to-[#C9349B] border border-white/15 flex items-center gap-3.5">
                    <div className="w-12 h-11 rounded-xl bg-white/15 border border-[#FFB458]/40 flex items-center justify-center shrink-0">
                      <TopiGtb6Svg className="w-10 h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#FFB458]">
                        Hadiah Misi 2
                      </p>
                      <p className="text-sm font-bold text-white">
                        Topi GTB 6 (Otomatis dipakai Avatar Bluefox)
                      </p>
                    </div>
                  </div>

                  {completed ? (
                    <div className="w-full min-h-[52px] rounded-2xl bg-white/10 border border-white/15 text-white/85 font-bold text-sm flex items-center justify-center gap-2">
                      <Check size={18} className="text-[#FFB458]" />
                      <span>Misi Selesai · Topi GTB 6 Terpasang</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartMission}
                      className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Play size={18} fill="currentColor" strokeWidth={2.2} />
                      <span>PLAY ESCAPE FROM PRISON</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {(stage === 'playing' || stage === 'escape_cutscene') && (
              <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-3">
                <div className="relative w-full aspect-[960/540] max-h-[62dvh] rounded-xl overflow-hidden bg-[#120726] select-none shadow-2xl border border-white/10">
                  <canvas
                    ref={canvasRef}
                    width={LOGICAL_W}
                    height={LOGICAL_H}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerDown={handleCanvasPointerDown}
                    className={`w-full h-full block ${hoverRedEyes ? 'cursor-pointer' : 'cursor-default'}`}
                  />

                  {stage === 'escape_cutscene' && (
                    <motion.div
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#7B208F] via-[#C9349B] to-[#FF9B55] text-white text-xs font-extrabold uppercase tracking-widest shadow-lg whitespace-nowrap"
                    >
                      Bluefox Berhasil Kabur dari Penjara!
                    </motion.div>
                  )}

                  {stage === 'playing' && lowNightWarning && !bustedReason && (
                    <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wide shadow-md whitespace-nowrap">
                      Siang segera tiba! Keluar Lubang &amp; Tutup Karpet
                    </div>
                  )}

                  {stage === 'playing' && actionHint && !bustedReason && (
                    <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#3B146B]/95 border border-[#FFB458]/50 text-[#FFB458] text-xs font-bold whitespace-nowrap shadow-lg">
                      {actionHint}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ViceCityGameFrame>
        )}
      </AnimatePresence>

      {/* External Full-Viewport Popup: Night Red-Eyes Black Market Upgrade Shop (outside game screen) */}
      <AnimatePresence>
        {isOpen && stage === 'playing' && shopOpen && isNight && !bustedReason && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setShopOpen(false)}
            className="fixed inset-0 z-[95] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 select-none"
            role="dialog"
            aria-modal="true"
            aria-label="Pasar Gelap Mata Merah"
          >
            <motion.div
              initial={{ y: 14, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#250D47] border-2 border-[#C9349B] p-4 sm:p-5 shadow-2xl space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-400 flex items-center justify-center shrink-0">
                    <Eye size={17} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                      Pasar Gelap Mata Merah
                    </h3>
                    <p className="text-[11px] text-white/75">
                      Biaya naik 2x per level (Maks 5 upgrade)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShopOpen(false)}
                  aria-label="Tutup Pasar Gelap"
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#3B146B]/85 border border-white/10">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FFB458] font-mono tabular-nums">
                  <Coins size={14} />
                  <span>{coins} Koin</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/85 font-mono tabular-nums">
                  <Moon size={13} className="text-[#FFB458]" />
                  <span>Sisa Malam {formatClock(phaseSecondsLeft)}</span>
                </span>
              </div>

              <div className="space-y-2.5">
                {/* 1. Upgrade Pickaxe */}
                <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#C9349B]/30 text-[#FFB458] flex items-center justify-center shrink-0">
                      <PickaxeSvg className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                        Upgrade Pickaxe ({pickaxeLv}/{MAX_UPGRADE_LV})
                      </p>
                      <p className="text-[11px] text-white/75 font-mono tabular-nums">
                        Galian: +{currentDigGain}%{' '}
                        {pickaxeLv < MAX_UPGRADE_LV
                          ? `-> +${(0.1 + (pickaxeLv + 1) * 0.1).toFixed(1)}%`
                          : '(Maks)'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyUpgrade('pickaxe')}
                    disabled={pickaxeLv >= MAX_UPGRADE_LV || coins < pickaxeCost}
                    className={`min-h-[38px] px-3.5 rounded-lg font-mono tabular-nums font-extrabold text-xs shrink-0 transition-all ${
                      pickaxeLv >= MAX_UPGRADE_LV
                        ? 'bg-white/10 text-white/50 cursor-default'
                        : coins >= pickaxeCost
                        ? 'bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] hover:brightness-105 active:scale-95 cursor-pointer'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    {pickaxeLv >= MAX_UPGRADE_LV ? 'MAKS' : `${pickaxeCost} Koin`}
                  </button>
                </div>

                {/* 2. Upgrade Waktu */}
                <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#7B208F]/50 text-[#FFB458] flex items-center justify-center shrink-0">
                      <Clock size={18} strokeWidth={2.3} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                        Upgrade Waktu ({timeLv}/{MAX_UPGRADE_LV})
                      </p>
                      <p className="text-[11px] text-white/75 font-mono tabular-nums">
                        Malam: +{timeLv * 10}s{' '}
                        {timeLv < MAX_UPGRADE_LV ? `-> +${(timeLv + 1) * 10}s` : '(Maks)'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyUpgrade('time')}
                    disabled={timeLv >= MAX_UPGRADE_LV || coins < timeCost}
                    className={`min-h-[38px] px-3.5 rounded-lg font-mono tabular-nums font-extrabold text-xs shrink-0 transition-all ${
                      timeLv >= MAX_UPGRADE_LV
                        ? 'bg-white/10 text-white/50 cursor-default'
                        : coins >= timeCost
                        ? 'bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] hover:brightness-105 active:scale-95 cursor-pointer'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    {timeLv >= MAX_UPGRADE_LV ? 'MAKS' : `${timeCost} Koin`}
                  </button>
                </div>

                {/* 3. Upgrade Money */}
                <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/25 text-[#FFB458] flex items-center justify-center shrink-0">
                      <Coins size={18} strokeWidth={2.3} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                        Upgrade Money ({moneyLv}/{MAX_UPGRADE_LV})
                      </p>
                      <p className="text-[11px] text-white/75 font-mono tabular-nums">
                        Koin: {currentMoneyMult}x{' '}
                        {moneyLv < MAX_UPGRADE_LV
                          ? `-> ${(1 + (moneyLv + 1) * 0.1).toFixed(1)}x`
                          : '(Maks)'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyUpgrade('money')}
                    disabled={moneyLv >= MAX_UPGRADE_LV || coins < moneyCost}
                    className={`min-h-[38px] px-3.5 rounded-lg font-mono tabular-nums font-extrabold text-xs shrink-0 transition-all ${
                      moneyLv >= MAX_UPGRADE_LV
                        ? 'bg-white/10 text-white/50 cursor-default'
                        : coins >= moneyCost
                        ? 'bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] hover:brightness-105 active:scale-95 cursor-pointer'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    {moneyLv >= MAX_UPGRADE_LV ? 'MAKS' : `${moneyCost} Koin`}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShopOpen(false)}
                className="w-full min-h-[42px] rounded-xl bg-white/12 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Tutup Toko
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* External Full-Viewport Popup: BUSTED Alert (outside game screen) */}
      <AnimatePresence>
        {isOpen && stage === 'playing' && bustedReason && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[95] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 select-none"
            role="alertdialog"
            aria-modal="true"
            aria-label="BUSTED"
          >
            <motion.div
              initial={{ y: 14, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="max-w-sm w-full max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#250D47] border-2 border-[#F36A78] p-5 text-center space-y-3.5 shadow-2xl"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F36A78]/20 text-[#F36A78] flex items-center justify-center">
                <AlertTriangle size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-wide text-[#F36A78]">
                  BUSTED!
                </h3>
                <p className="text-xs sm:text-sm text-white/85 mt-1.5 leading-relaxed">
                  {bustedReason}
                </p>
                <p className="text-xs font-mono font-bold text-[#FFB458] mt-2">
                  Penalti: -25.0% progres galian
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  bustedRef.current = false;
                  setBustedReason(null);
                }}
                className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#F36A78] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all"
              >
                Lanjutkan
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-Win Node 2->3 Animation + Topi GTB 6 Reward Popup */}
      <EscapePrisonVictorySequence
        isOpen={isOpen && stage === 'victory_anim'}
        onComplete={onClose}
      />
    </>
  );
}
