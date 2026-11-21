import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Play,
  Sun,
  Moon,
  Layers,
  Check,
  Volume2,
  VolumeX,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Gauge,
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

interface EscapePrisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionSuccess?: (state: GtaSeasonPassState) => void;
}

type ModalStage = 'briefing' | 'playing' | 'victory_anim';
type CyclePhase = 'night' | 'day';

interface DirtParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
}

const LOGICAL_W = 800;
const LOGICAL_H = 420;
const PHASE_DURATION_SEC = 120; // 2 minutes Night / 2 minutes Day

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
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(PHASE_DURATION_SEC);
  const [timerSpeed, setTimerSpeed] = useState<1 | 10>(1);
  const [digProgress, setDigProgress] = useState<number>(0);
  const [inHole, setInHole] = useState<boolean>(false);
  const [rugCovered, setRugCovered] = useState<boolean>(true);
  const [bustedReason, setBustedReason] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => gtaAudio.isMuted());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<DirtParticle[]>([]);
  const swingAnimRef = useRef<number>(0);
  const rugSlideRef = useRef<number>(1); // 1 = covered, 0 = uncovered
  const guardXRef = useRef<number>(740);
  const rafRef = useRef<number | null>(null);
  const digHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synced refs for animation loop & timers
  const phaseRef = useRef<CyclePhase>('night');
  const progressRef = useRef<number>(0);
  const inHoleRef = useRef<boolean>(false);
  const rugCoveredRef = useRef<boolean>(true);
  const bustedRef = useRef<boolean>(false);
  const speedRef = useRef<1 | 10>(1);

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
    bustedRef.current = Boolean(bustedReason);
  }, [bustedReason]);
  useEffect(() => {
    speedRef.current = timerSpeed;
  }, [timerSpeed]);

  const showHint = useCallback((msg: string) => {
    setActionHint(msg);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => {
      setActionHint(null);
    }, 2100);
  }, []);

  const stopHoldDig = useCallback(() => {
    if (digHoldIntervalRef.current) {
      clearInterval(digHoldIntervalRef.current);
      digHoldIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSeasonState(getSeasonPassState());
      setStage('briefing');
      setPhase('night');
      setPhaseSecondsLeft(PHASE_DURATION_SEC);
      setTimerSpeed(1);
      setDigProgress(0);
      setInHole(false);
      setRugCovered(true);
      setBustedReason(null);
      setActionHint(null);
      particlesRef.current = [];
      rugSlideRef.current = 1;
    } else {
      stopHoldDig();
      gtaAudio.stopHeistBgm();
    }
    return () => {
      stopHoldDig();
      gtaAudio.stopHeistBgm();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, [isOpen, stopHoldDig]);

  const triggerBusted = useCallback(
    (reason: string) => {
      if (bustedRef.current) return;
      stopHoldDig();
      bustedRef.current = true;
      gtaAudio.playBustedSfx();
      setBustedReason(reason);
      setDigProgress((prev) => Math.max(0, prev - 25));
      setInHole(false);
      setRugCovered(true);
    },
    [stopHoldDig]
  );

  // Day/Night cycle countdown loop
  useEffect(() => {
    if (!isOpen || stage !== 'playing') return;

    const tickInterval = setInterval(() => {
      if (bustedRef.current) return;

      setPhaseSecondsLeft((prev) => {
        const next = prev - 0.25 * speedRef.current;
        if (next <= 0) {
          const nextPhase: CyclePhase = phaseRef.current === 'night' ? 'day' : 'night';
          phaseRef.current = nextPhase;
          setPhase(nextPhase);
          gtaAudio.playPhaseShiftSfx(nextPhase === 'night');
          gtaAudio.startPrisonBgm(nextPhase);

          if (nextPhase === 'day') {
            if (inHoleRef.current) {
              triggerBusted('Kamu masih berada di dalam lubang saat Siang tiba!');
            } else if (!rugCoveredRef.current) {
              triggerBusted('Karpet belum ditutup saat Sipir berpatroli di Siang hari!');
            }
          }
          return PHASE_DURATION_SEC;
        }
        return next;
      });
    }, 250);

    return () => clearInterval(tickInterval);
  }, [isOpen, stage, triggerBusted]);

  // Canvas 2D Prison Cell renderer
  useEffect(() => {
    if (!isOpen || stage !== 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let prevNow = performance.now();

    const drawCell = (now: number) => {
      const dt = Math.min(0.05, (now - prevNow) / 1000);
      prevNow = now;
      const tSec = now / 1000;

      const isNight = phaseRef.current === 'night';
      const targetRug = rugCoveredRef.current ? 1 : 0;
      rugSlideRef.current += (targetRug - rugSlideRef.current) * Math.min(1, dt * 10);

      if (swingAnimRef.current > 0) {
        swingAnimRef.current = Math.max(0, swingAnimRef.current - dt * 4.5);
      }

      // Guard patrol movement during Day (peeks past cell window/bars)
      if (!isNight) {
        guardXRef.current = 640 + Math.sin(tSec * 1.15) * 95;
      } else {
        guardXRef.current = 860;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

          // 1. Back Wall & Ambient Lighting
          const wallGrad = ctx.createLinearGradient(0, 0, 0, 290);
          if (isNight) {
            wallGrad.addColorStop(0, '#1D0B38');
            wallGrad.addColorStop(1, '#3B146B');
          } else {
            wallGrad.addColorStop(0, '#59423B');
            wallGrad.addColorStop(1, '#856556');
          }
          ctx.fillStyle = wallGrad;
          ctx.fillRect(0, 0, LOGICAL_W, 290);

          // Brick masonry lines
          ctx.strokeStyle = isNight ? 'rgba(123,32,143,0.28)' : 'rgba(17,24,39,0.18)';
          ctx.lineWidth = 2;
          for (let row = 0; row < 6; row++) {
            const ry = 35 + row * 44;
            ctx.beginPath();
            ctx.moveTo(0, ry);
            ctx.lineTo(LOGICAL_W, ry);
            ctx.stroke();
            const offset = row % 2 === 0 ? 0 : 45;
            for (let cx = offset; cx < LOGICAL_W; cx += 90) {
              ctx.beginPath();
              ctx.moveTo(cx, ry);
              ctx.lineTo(cx, ry + 44);
              ctx.stroke();
            }
          }

          // 2. High Barred Cell Window (Left-Center)
          ctx.fillStyle = isNight ? '#120726' : '#FFB458';
          ctx.fillRect(150, 44, 150, 88);
          if (isNight) {
            // Crescent Moon
            ctx.fillStyle = '#FDE68A';
            ctx.beginPath();
            ctx.arc(255, 76, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#120726';
            ctx.beginPath();
            ctx.arc(261, 72, 12, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Warm Vice City Day Sun Glow
            const sunGrad = ctx.createLinearGradient(150, 44, 300, 132);
            sunGrad.addColorStop(0, '#FFB458');
            sunGrad.addColorStop(1, '#FF9B55');
            ctx.fillStyle = sunGrad;
            ctx.fillRect(150, 44, 150, 88);
          }

          // Window steel bars
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 6;
          ctx.strokeRect(150, 44, 150, 88);
          [185, 225, 265].forEach((bx) => {
            ctx.beginPath();
            ctx.moveTo(bx, 44);
            ctx.lineTo(bx, 132);
            ctx.stroke();
          });

          // Angled light shaft onto cell floor
          const beamGrad = ctx.createLinearGradient(220, 132, 340, 380);
          if (isNight) {
            beamGrad.addColorStop(0, 'rgba(123, 32, 143, 0.25)');
            beamGrad.addColorStop(1, 'rgba(59, 20, 107, 0)');
          } else {
            beamGrad.addColorStop(0, 'rgba(255, 180, 88, 0.35)');
            beamGrad.addColorStop(1, 'rgba(255, 155, 85, 0.05)');
          }
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(150, 132);
          ctx.lineTo(300, 132);
          ctx.lineTo(440, 410);
          ctx.lineTo(190, 410);
          ctx.closePath();
          ctx.fill();

          // 3. Stone Cell Floor (Angled 2D perspective)
          ctx.fillStyle = isNight ? '#24143B' : '#574E5B';
          ctx.fillRect(0, 286, LOGICAL_W, LOGICAL_H - 286);
          ctx.fillStyle = isNight ? '#3B146B' : '#786D7D';
          ctx.fillRect(0, 286, LOGICAL_W, 6);

          // Floor perspective seams
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 2;
          for (let fx = 100; fx < LOGICAL_W; fx += 140) {
            ctx.beginPath();
            ctx.moveTo(fx, 290);
            ctx.lineTo(fx - 40, LOGICAL_H);
            ctx.stroke();
          }

          // 4. Prison Bunk / Bed on Left
          ctx.fillStyle = '#334155';
          ctx.fillRect(28, 224, 154, 18);
          ctx.fillRect(34, 242, 10, 56);
          ctx.fillRect(166, 242, 10, 56);
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.roundRect(36, 208, 42, 16, 6);
          ctx.fill();
          ctx.fillStyle = '#7B208F';
          ctx.beginPath();
          ctx.roundRect(74, 210, 102, 16, 4);
          ctx.fill();

          // 5. Right Cell Gate & Corridor Guard Window
          ctx.fillStyle = isNight ? '#10071F' : '#2C2236';
          ctx.fillRect(585, 58, 195, 228);

          // Prison Guard (Sipir) visible patrolling behind cell bars during Day
          if (guardXRef.current < 810) {
            const gx = guardXRef.current;
            const gy = 178;
            ctx.save();
            ctx.translate(gx, gy);

            // Flashlight / inspection cone during Day
            const guardBeam = ctx.createLinearGradient(0, 0, -250, 140);
            guardBeam.addColorStop(0, 'rgba(255, 180, 88, 0.35)');
            guardBeam.addColorStop(1, 'rgba(255, 180, 88, 0)');
            ctx.fillStyle = guardBeam;
            ctx.beginPath();
            ctx.moveTo(-14, 4);
            ctx.lineTo(-270, 110);
            ctx.lineTo(-220, 190);
            ctx.closePath();
            ctx.fill();

            // Sipir body & peaked cap
            ctx.fillStyle = '#1E293B';
            ctx.beginPath();
            ctx.roundRect(-18, -14, 36, 78, 8);
            ctx.fill();
            ctx.fillStyle = '#FBBF24';
            ctx.fillRect(-10, -2, 8, 8); // Badge
            ctx.fillStyle = '#FDE68A';
            ctx.beginPath();
            ctx.arc(0, -30, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(-18, -46, 36, 11);
            ctx.fillRect(-22, -37, 26, 4);
            ctx.restore();
          }

          // Vertical steel cell door bars
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 8;
          ctx.strokeRect(585, 58, 195, 228);
          for (let gx = 618; gx < 780; gx += 32) {
            ctx.beginPath();
            ctx.moveTo(gx, 58);
            ctx.lineTo(gx, 286);
            ctx.stroke();
          }

          // 6. Dig Spot & Excavated Escape Tunnel (Center Floor x=385, y=352)
          const holeX = 385;
          const holeY = 354;
          const pct = progressRef.current / 100;
          const holeRx = 34 + pct * 38;
          const holeRy = 14 + pct * 14;

          // Dirt rim mound around hole
          if (progressRef.current > 0) {
            ctx.fillStyle = '#78350F';
            ctx.beginPath();
            ctx.ellipse(holeX, holeY + 3, holeRx + 12, holeRy + 7, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // Deep pit cavity
          ctx.fillStyle = '#090512';
          ctx.beginPath();
          ctx.ellipse(holeX, holeY, holeRx, holeRy, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tunnel inner rim glow near completion
          if (progressRef.current >= 70) {
            ctx.strokeStyle = 'rgba(255, 180, 88, 0.55)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          // 7. Bluefox Prisoner Avatar (inside hole vs standing next to hole)
          const swingAngle = Math.sin(swingAnimRef.current * Math.PI) * 0.9;
          if (inHoleRef.current) {
            // Inside hole: waist & upper torso emerging from tunnel pit
            ctx.save();
            ctx.translate(holeX, holeY - 6);

            // Prison striped torso
            ctx.fillStyle = '#2563EB';
            ctx.beginPath();
            ctx.roundRect(-14, -18, 28, 26, 6);
            ctx.fill();
            ctx.fillStyle = '#FF9B55';
            ctx.fillRect(-13, -10, 26, 4);
            ctx.fillRect(-13, -1, 26, 4);

            // Fox head
            ctx.fillStyle = '#2563EB';
            ctx.beginPath();
            ctx.arc(0, -30, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-10, -40);
            ctx.lineTo(-14, -54);
            ctx.lineTo(-2, -43);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(2, -43);
            ctx.lineTo(14, -54);
            ctx.lineTo(10, -40);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#67E8F9';
            ctx.beginPath();
            ctx.roundRect(-7, -34, 15, 6, 3);
            ctx.fill();

            // Pickaxe swinging
            ctx.save();
            ctx.translate(12, -10);
            ctx.rotate(swingAngle - 0.35);
            ctx.strokeStyle = '#92400E';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(20, -18);
            ctx.stroke();
            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(12, -22);
            ctx.lineTo(26, -12);
            ctx.stroke();
            ctx.restore();

            ctx.restore();
          } else {
            // Standing safely outside hole on the left side
            const bx = 262;
            const by = 318 + Math.sin(tSec * 3) * 1.5;
            ctx.save();
            ctx.translate(bx, by);

            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath();
            ctx.ellipse(0, 34, 18, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Legs
            ctx.strokeStyle = '#1E3A8A';
            ctx.lineWidth = 6.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-5, 14);
            ctx.lineTo(-6, 32);
            ctx.moveTo(5, 14);
            ctx.lineTo(6, 32);
            ctx.stroke();

            // Prison striped torso
            ctx.fillStyle = '#2563EB';
            ctx.beginPath();
            ctx.roundRect(-13, -14, 26, 30, 7);
            ctx.fill();
            ctx.fillStyle = '#FF9B55';
            ctx.fillRect(-12, -5, 24, 4);
            ctx.fillRect(-12, 4, 24, 4);

            // Head & ears
            ctx.fillStyle = '#2563EB';
            ctx.beginPath();
            ctx.arc(0, -25, 13.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-9, -35);
            ctx.lineTo(-13, -49);
            ctx.lineTo(-1, -38);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(1, -38);
            ctx.lineTo(13, -49);
            ctx.lineTo(9, -35);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#67E8F9';
            ctx.beginPath();
            ctx.roundRect(-4, -29, 14, 6, 3);
            ctx.fill();

            ctx.restore();
          }

          // 8. Movable Rug ("Karpet") covering or slid aside from hole
          const rugX = holeX + (1 - rugSlideRef.current) * 155;
          const rugY = holeY;
          const rugScaleX = 1 - (1 - rugSlideRef.current) * 0.25;

          ctx.save();
          ctx.translate(rugX, rugY);
          ctx.scale(rugScaleX, 1);

          // Rug shadow
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath();
          ctx.roundRect(-78, -22, 156, 44, 8);
          ctx.fill();

          // Rug Vice-City body
          const rugGrad = ctx.createLinearGradient(-76, -24, 76, 20);
          rugGrad.addColorStop(0, '#7B208F');
          rugGrad.addColorStop(0.5, '#C9349B');
          rugGrad.addColorStop(1, '#F36A78');
          ctx.fillStyle = rugGrad;
          ctx.beginPath();
          ctx.roundRect(-76, -24, 152, 42, 7);
          ctx.fill();

          // Gold inner woven border
          ctx.strokeStyle = '#FFB458';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-64, -16, 128, 26);
          ctx.restore();

          // 9. Dirt Digging Particles
          particlesRef.current = particlesRef.current.filter((p) => {
            p.age += dt;
            if (p.age >= p.maxAge) return false;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 290 * dt;
            ctx.fillStyle = '#D97706';
            ctx.globalAlpha = 1 - p.age / p.maxAge;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            return true;
          });
        }
      }

      rafRef.current = requestAnimationFrame(drawCell);
    };

    rafRef.current = requestAnimationFrame(drawCell);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, stage]);

  const performDigTick = useCallback(() => {
    if (bustedRef.current || progressRef.current >= 100) return;
    if (phaseRef.current !== 'night') {
      stopHoldDig();
      showHint('Hanya bisa menggali saat fase Malam!');
      return;
    }
    if (rugCoveredRef.current) {
      stopHoldDig();
      showHint('Tekan "Buka Karpet" dulu sebelum menggali.');
      return;
    }
    if (!inHoleRef.current) {
      inHoleRef.current = true;
      setInHole(true);
      gtaAudio.playHoleToggleSfx(true);
    }

    swingAnimRef.current = 1;
    gtaAudio.playDigPickaxeSfx();

    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: 385 + (Math.random() - 0.5) * 26,
        y: 344,
        vx: (Math.random() - 0.5) * 140,
        vy: -80 - Math.random() * 90,
        age: 0,
        maxAge: 0.45,
      });
    }

    setDigProgress((prev) => {
      const next = Math.min(100, prev + 4);
      if (next >= 100) {
        stopHoldDig();
        gtaAudio.stopHeistBgm();
        const updated = completeEscapePrisonMission();
        setSeasonState(updated);
        onMissionSuccess?.(updated);
        setTimeout(() => {
          setStage('victory_anim');
        }, 260);
      }
      return next;
    });
  }, [onMissionSuccess, showHint, stopHoldDig]);

  const handleDigPointerDown = () => {
    performDigTick();
    stopHoldDig();
    digHoldIntervalRef.current = setInterval(() => {
      performDigTick();
    }, 220);
  };

  const handleToggleHole = () => {
    if (bustedReason) return;
    if (!inHole && rugCovered) {
      showHint('Tekan "Buka Karpet" dulu sebelum masuk lubang.');
      return;
    }
    if (!inHole && phase === 'day') {
      setInHole(true);
      triggerBusted('Sipir melihat kamu masuk ke dalam lubang di Siang hari!');
      return;
    }
    const next = !inHole;
    setInHole(next);
    gtaAudio.playHoleToggleSfx(next);
  };

  const handleToggleRug = () => {
    if (bustedReason) return;
    if (rugCovered && phase === 'day') {
      setRugCovered(false);
      triggerBusted('Sipir melihat lubang di lantai saat Karpet dibuka pada Siang hari!');
      return;
    }
    if (!rugCovered && inHole) {
      showHint('Tekan "Keluar Lubang" dulu sebelum menutup Karpet!');
      return;
    }
    const next = !rugCovered;
    setRugCovered(next);
    gtaAudio.playRugToggleSfx(next);
  };

  const handleStartMission = () => {
    if (completed) return;
    gtaAudio.unlock();
    setPhase('night');
    phaseRef.current = 'night';
    setPhaseSecondsLeft(PHASE_DURATION_SEC);
    setDigProgress(0);
    setInHole(false);
    setRugCovered(true);
    setBustedReason(null);
    setActionHint(null);
    rugSlideRef.current = 1;
    gtaAudio.startPrisonBgm('night');
    setStage('playing');
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    gtaAudio.setMuted(next);
  };

  const isNight = phase === 'night';
  const lowNightWarning = isNight && phaseSecondsLeft <= 12 && (inHole || !rugCovered);

  return (
    <>
      <AnimatePresence>
        {isOpen && stage !== 'victory_anim' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-2.5 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="escape-prison-title"
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-2xl bg-[#140A26] text-white rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col max-h-[95dvh]"
            >
              {/* Header */}
              <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#3B146B] text-white text-[10px] font-extrabold uppercase tracking-wider">
                    Mission 02
                  </span>
                  <h2 id="escape-prison-title" className="text-base sm:text-xl font-extrabold tracking-tight">
                    Escape from Prison
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                    className="w-10 h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {muted ? <VolumeX size={18} strokeWidth={2.4} /> : <Volume2 size={18} strokeWidth={2.4} />}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Escape from Prison"
                    className="w-10 h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X size={19} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 overflow-y-auto">
                {stage === 'briefing' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="rounded-2xl bg-[#3B146B]/55 border border-[#7B208F]/60 p-3.5">
                        <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                          <Moon size={14} strokeWidth={2.4} />
                          <span>Fase Malam (2:00)</span>
                        </div>
                        <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                          Buka Karpet, masuk lubang, lalu tap atau tahan Gali (Pickaxe) hingga progres mencapai 100%.
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#FF9B55]/15 border border-[#FFB458]/40 p-3.5">
                        <div className="flex items-center gap-2 text-[#FFB458] text-xs font-extrabold uppercase tracking-wider">
                          <Sun size={14} strokeWidth={2.4} />
                          <span>Fase Siang (2:00)</span>
                        </div>
                        <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                          Sipir berpatroli. Pastikan sudah Keluar Lubang dan Tutup Karpet sebelum Siang tiba agar tidak Busted.
                        </p>
                      </div>
                    </div>

                    {/* Reward Preview */}
                    <div className="rounded-2xl p-3.5 bg-gradient-to-r from-[#3B146B] via-[#7B208F] to-[#C9349B] border border-white/15 flex items-center gap-3.5">
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
                      <div className="w-full min-h-[50px] rounded-2xl bg-white/10 border border-white/15 text-white/85 font-bold text-sm flex items-center justify-center gap-2">
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
                )}

                {stage === 'playing' && (
                  <div className="space-y-3">
                    {/* Top Cycle & Progress HUD */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                            isNight
                              ? 'bg-[#3B146B] text-[#FFB458] border-[#C9349B]/50'
                              : 'bg-[#FFB458] text-[#111827] border-[#FF9B55]'
                          }`}
                        >
                          {isNight ? <Moon size={13} strokeWidth={2.5} /> : <Sun size={13} strokeWidth={2.5} />}
                          <span>{isNight ? 'Malam' : 'Siang'}</span>
                          <span className="font-mono">{formatClock(phaseSecondsLeft)}</span>
                        </span>

                        <span className="text-[11px] font-semibold text-white/75">
                          {isNight ? 'Aman Menggali' : 'Sipir Patroli'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTimerSpeed((s) => (s === 1 ? 10 : 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-mono font-bold text-[#FFB458] cursor-pointer"
                        title="Test Timer Speed"
                      >
                        <Gauge size={12} />
                        <span>Speed {timerSpeed}x</span>
                      </button>
                    </div>

                    {/* Dig Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-white/80">Progres Terowongan</span>
                        <span className="font-mono text-[#FFB458]">{digProgress}%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${digProgress}%`,
                            background: 'linear-gradient(90deg, #7B208F 0%, #C9349B 55%, #FFB458 100%)',
                          }}
                        />
                      </div>
                    </div>

                    {/* 2D Prison Cell Canvas */}
                    <div className="relative w-full aspect-[800/420] rounded-2xl overflow-hidden border border-white/15 bg-[#120726] select-none">
                      <canvas
                        ref={canvasRef}
                        width={LOGICAL_W}
                        height={LOGICAL_H}
                        className="w-full h-full block"
                      />

                      {/* Low-time danger warning */}
                      {lowNightWarning && !bustedReason && (
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wide shadow-md whitespace-nowrap animate-pulse">
                          Siang segera tiba! Keluar Lubang &amp; Tutup Karpet
                        </div>
                      )}

                      {/* Status hint */}
                      {actionHint && !bustedReason && (
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#3B146B]/95 border border-[#FFB458]/50 text-[#FFB458] text-xs font-bold whitespace-nowrap shadow-lg">
                          {actionHint}
                        </div>
                      )}

                      {/* Busted Alert Overlay */}
                      {bustedReason && (
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
                          <div className="max-w-xs w-full rounded-2xl bg-[#250D47] border-2 border-[#F36A78] p-4 text-center space-y-3 shadow-2xl">
                            <div className="w-11 h-11 mx-auto rounded-full bg-[#F36A78]/20 text-[#F36A78] flex items-center justify-center">
                              <AlertTriangle size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black uppercase tracking-wide text-[#F36A78]">
                                BUSTED!
                              </h3>
                              <p className="text-xs text-white/85 mt-1 leading-relaxed">
                                {bustedReason}
                              </p>
                              <p className="text-[11px] font-mono font-bold text-[#FFB458] mt-1.5">
                                Penalti: -25% progres galian
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBustedReason(null)}
                              className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                            >
                              Lanjutkan
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile-First Action Controls */}
                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <button
                        type="button"
                        onPointerDown={handleDigPointerDown}
                        onPointerUp={stopHoldDig}
                        onPointerLeave={stopHoldDig}
                        onPointerCancel={stopHoldDig}
                        disabled={!isNight || Boolean(bustedReason)}
                        className={`min-h-[52px] px-2 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer select-none ${
                          isNight && !bustedReason
                            ? 'bg-gradient-to-br from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] active:scale-95 shadow-md'
                            : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        <PickaxeSvg className="w-5 h-5" />
                        <span>Gali (Pickaxe)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleHole}
                        disabled={Boolean(bustedReason)}
                        className={`min-h-[52px] px-2 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                          inHole
                            ? 'bg-[#C9349B] text-white border-[#FFB458]/60 shadow-md'
                            : 'bg-[#3B146B] text-white border-white/20 hover:bg-[#7B208F]'
                        }`}
                      >
                        {inHole ? <ArrowUp size={18} strokeWidth={2.5} /> : <ArrowDown size={18} strokeWidth={2.5} />}
                        <span>{inHole ? 'Keluar Lubang' : 'Masuk Lubang'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleRug}
                        disabled={Boolean(bustedReason)}
                        className={`min-h-[52px] px-2 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                          rugCovered
                            ? 'bg-emerald-600 text-white border-emerald-300/50 shadow-md'
                            : 'bg-amber-600 text-white border-amber-300/60 shadow-md'
                        }`}
                      >
                        <Layers size={18} strokeWidth={2.4} />
                        <span>{rugCovered ? 'Buka Karpet' : 'Tutup Karpet'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
