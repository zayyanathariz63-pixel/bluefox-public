import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Zap, Check, Volume2, VolumeX } from 'lucide-react';
import {
  completeKriminalBankMission,
  getSeasonPassState,
  isMissionCompleted,
  GtaSeasonPassState,
} from '../lib/gtaSeasonPass';
import { gtaAudio } from '../lib/gtaAudio';
import { KriminalBankVictorySequence } from './KriminalBankVictorySequence';

interface KriminalBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionSuccess?: (state: GtaSeasonPassState) => void;
}

type ModalStage = 'briefing' | 'intro' | 'playing' | 'victory_anim';
type EnemyKind = 'officer' | 'car' | 'heli';

interface EnemyUnit {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  baseY: number;
  phase: number;
  radius: number;
  cleared: boolean;
}

interface BurstEffect {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  color: string;
}

interface WaveInfo {
  wave: 1 | 2 | 3;
  code: string;
  title: string;
  cars: number;
  officers: number;
  helis: number;
  summary: string;
}

const LOGICAL_W = 800;
const LOGICAL_H = 420;

const WAVES: WaveInfo[] = [
  {
    wave: 1,
    code: 'WAVE 01',
    title: 'Police Squad',
    cars: 3,
    officers: 20,
    helis: 0,
    summary: '3 Mobil · 20 Polisi',
  },
  {
    wave: 2,
    code: 'WAVE 02',
    title: 'Air & Road Pursuit',
    cars: 3,
    officers: 20,
    helis: 1,
    summary: '3 Mobil · 20 Polisi · 1 Heli',
  },
  {
    wave: 3,
    code: 'WAVE 03',
    title: 'Full Lockdown',
    cars: 4,
    officers: 30,
    helis: 3,
    summary: '4 Mobil · 30 Polisi · 3 Heli',
  },
];

function createWaveUnits(info: WaveInfo): EnemyUnit[] {
  const units: EnemyUnit[] = [];
  const seed = Date.now();

  // Spawn Patrol Cars across 2 road lanes
  for (let i = 0; i < info.cars; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const laneY = i % 2 === 0 ? 290 : 352;
    units.push({
      id: `w${info.wave}-car-${i}-${seed}`,
      kind: 'car',
      x: 75 + ((i * 190) % 640),
      y: laneY,
      baseY: laneY,
      vx: dir * (165 + (i % 3) * 32),
      phase: i * 0.8,
      radius: 48,
      cleared: false,
    });
  }

  // Spawn Police Squad across sidewalk and street flanks
  for (let i = 0; i < info.officers; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const row = i % 4;
    const y = 250 + row * 38;
    const x = 50 + ((i * 39 + row * 57) % 700);
    units.push({
      id: `w${info.wave}-off-${i}-${seed}`,
      kind: 'officer',
      x,
      y,
      baseY: y,
      vx: dir * (78 + (i % 5) * 18),
      phase: i * 0.65,
      radius: 30,
      cleared: false,
    });
  }

  // Spawn Police Helicopters in Vice skyline
  for (let i = 0; i < info.helis; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const y = 78 + i * 44;
    units.push({
      id: `w${info.wave}-heli-${i}-${seed}`,
      kind: 'heli',
      x: 110 + ((i * 230) % 580),
      y,
      baseY: y,
      vx: dir * (135 + i * 24),
      phase: i * 1.4,
      radius: 48,
      cleared: false,
    });
  }

  return units;
}

function draw2DBankWorld(ctx: CanvasRenderingContext2D, time: number, sirenPulse: boolean) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 260);
  skyGrad.addColorStop(0, '#3B146B');
  skyGrad.addColorStop(0.55, '#7B208F');
  skyGrad.addColorStop(1, '#F36A78');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, LOGICAL_W, 260);

  const sunGrad = ctx.createLinearGradient(0, 88, 0, 210);
  sunGrad.addColorStop(0, '#FFB458');
  sunGrad.addColorStop(1, '#F36A78');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(620, 165, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#250D47';
  const buildings = [
    [0, 145, 58, 105],
    [435, 130, 52, 120],
    [495, 108, 64, 142],
    [570, 142, 48, 108],
    [630, 118, 68, 132],
    [708, 136, 92, 114],
  ];
  buildings.forEach(([bx, by, bw, bh]) => {
    ctx.fillRect(bx, by, bw, bh);
  });

  ctx.strokeStyle = '#1B0835';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(748, 250);
  ctx.quadraticCurveTo(738, 195, 725, 164);
  ctx.stroke();

  ctx.fillStyle = '#1B0835';
  for (let a = -2.4; a <= 1.2; a += 0.72) {
    ctx.beginPath();
    ctx.ellipse(
      725 + Math.cos(a) * 18,
      164 + Math.sin(a) * 12,
      19,
      4.5,
      a,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Extruded 2.5D Bank Side Wall
  ctx.fillStyle = '#36235C';
  ctx.beginPath();
  ctx.moveTo(318, 86);
  ctx.lineTo(352, 100);
  ctx.lineTo(352, 248);
  ctx.lineTo(318, 248);
  ctx.closePath();
  ctx.fill();

  // Main Bank Facade
  ctx.fillStyle = '#ECE6F6';
  ctx.fillRect(62, 86, 256, 162);

  ctx.fillStyle = '#3B146B';
  ctx.fillRect(54, 72, 272, 18);
  ctx.fillStyle = '#FFB458';
  ctx.fillRect(58, 86, 264, 4);

  ctx.fillStyle = '#111827';
  ctx.fillRect(130, 96, 120, 28);
  ctx.strokeStyle = '#FFB458';
  ctx.lineWidth = 2;
  ctx.strokeRect(130, 96, 120, 28);
  ctx.fillStyle = '#FFB458';
  ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BANK', 190, 116);

  ctx.fillStyle = '#D5CCE8';
  [78, 110, 252, 284].forEach((cx) => {
    ctx.fillRect(cx, 128, 16, 120);
    ctx.fillStyle = '#B8ACDA';
    ctx.fillRect(cx + 11, 128, 5, 120);
    ctx.fillStyle = '#D5CCE8';
  });

  ctx.fillStyle = '#181029';
  ctx.fillRect(156, 152, 68, 96);
  const vaultGlow = ctx.createRadialGradient(190, 206, 6, 190, 206, 48);
  vaultGlow.addColorStop(0, 'rgba(255, 180, 88, 0.72)');
  vaultGlow.addColorStop(1, 'rgba(255, 180, 88, 0)');
  ctx.fillStyle = vaultGlow;
  ctx.fillRect(156, 152, 68, 96);

  ctx.fillStyle = '#64597A';
  ctx.fillRect(0, 246, LOGICAL_W, 22);
  ctx.fillStyle = '#85789E';
  ctx.fillRect(0, 246, LOGICAL_W, 4);

  ctx.fillStyle = '#1A1626';
  ctx.fillRect(0, 268, LOGICAL_W, LOGICAL_H - 268);

  ctx.strokeStyle = '#FFB458';
  ctx.lineWidth = 3;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  ctx.moveTo(0, 336);
  ctx.lineTo(LOGICAL_W, 336);
  ctx.stroke();
  ctx.setLineDash([]);

  if (sirenPulse) {
    const flash = Math.sin(time * 14) > 0;
    ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.14)' : 'rgba(59, 130, 246, 0.14)';
    ctx.fillRect(0, 268, LOGICAL_W, LOGICAL_H - 268);
  }
}

function drawBluefoxThief(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  scale = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const stride = Math.sin(time * 18);

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 34, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 10);
  ctx.lineTo(-4 + stride * 14, 30);
  ctx.moveTo(4, 10);
  ctx.lineTo(4 - stride * 14, 30);
  ctx.stroke();

  const bodyGrad = ctx.createLinearGradient(-12, -16, 12, 12);
  bodyGrad.addColorStop(0, '#3B82F6');
  bodyGrad.addColorStop(1, '#1D4ED8');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-11, -15, 22, 28, 6);
  ctx.fill();

  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.ellipse(-18, 2 + Math.abs(stride) * 2, 11, 13, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FDE68A';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', -18, 6 + Math.abs(stride) * 2);

  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(2, -25, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-7, -34);
  ctx.lineTo(-10, -47);
  ctx.lineTo(0, -37);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3, -36);
  ctx.lineTo(10, -47);
  ctx.lineTo(12, -34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#67E8F9';
  ctx.beginPath();
  ctx.roundRect(1, -29, 13, 6, 3);
  ctx.fill();

  ctx.restore();
}

function drawPatrolCar3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  time: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  const bob = Math.sin(time * 24) * 1.4;
  ctx.translate(0, bob);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 48, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const coneGrad = ctx.createLinearGradient(44, 4, 125, 4);
  coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(44, -2);
  ctx.lineTo(125, -18);
  ctx.lineTo(125, 22);
  ctx.lineTo(44, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(-45, -6, 92, 22, 6);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-16, -4, 34, 18);

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(-26, -6);
  ctx.lineTo(-14, -21);
  ctx.lineTo(18, -21);
  ctx.lineTo(30, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.moveTo(-11, -18);
  ctx.lineTo(15, -18);
  ctx.lineTo(24, -8);
  ctx.lineTo(-18, -8);
  ctx.closePath();
  ctx.fill();

  const flash = Math.sin(time * 18) > 0;
  ctx.fillStyle = flash ? '#EF4444' : '#3B82F6';
  ctx.fillRect(-5, -26, 7, 5);
  ctx.fillStyle = flash ? '#3B82F6' : '#EF4444';
  ctx.fillRect(2, -26, 7, 5);

  ctx.fillStyle = flash ? 'rgba(239,68,68,0.28)' : 'rgba(59,130,246,0.28)';
  ctx.beginPath();
  ctx.arc(2, -24, 18, 0, Math.PI * 2);
  ctx.fill();

  [-26, 26].forEach((wx) => {
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(wx, 15, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.arc(wx, 15, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawPoliceOfficer3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  time: number,
  phase: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * 0.85, 0.85);

  const stride = Math.sin(time * 12 + phase);

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 26, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3, 7);
  ctx.lineTo(-3 + stride * 9, 23);
  ctx.moveTo(3, 7);
  ctx.lineTo(3 - stride * 9, 23);
  ctx.stroke();

  const vestGrad = ctx.createLinearGradient(-10, -14, 10, 10);
  vestGrad.addColorStop(0, '#334155');
  vestGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = vestGrad;
  ctx.beginPath();
  ctx.roundRect(-10, -13, 20, 22, 5);
  ctx.fill();

  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(4, -5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, -21, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(1, -24, 9, 5);

  ctx.fillStyle = 'rgba(59, 130, 246, 0.88)';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(9, -12, 7, 22, 3);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawHelicopter3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  time: number,
  phase: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  const tilt = 0.08 * dir;
  ctx.rotate(tilt);

  const sweep = Math.sin(time * 3 + phase) * 28;
  const lightGrad = ctx.createLinearGradient(0, 16, sweep, 220);
  lightGrad.addColorStop(0, 'rgba(254, 249, 195, 0.34)');
  lightGrad.addColorStop(1, 'rgba(254, 249, 195, 0)');
  ctx.fillStyle = lightGrad;
  ctx.beginPath();
  ctx.moveTo(10, 16);
  ctx.lineTo(50 + sweep, 220);
  ctx.lineTo(-30 + sweep, 220);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-50, -6, 36, 7);
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(-52, -14, 7, 14);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-16, 17);
  ctx.lineTo(-10, 10);
  ctx.moveTo(14, 17);
  ctx.lineTo(10, 10);
  ctx.moveTo(-24, 17);
  ctx.lineTo(24, 17);
  ctx.stroke();

  const heliGrad = ctx.createLinearGradient(-22, -16, 28, 12);
  heliGrad.addColorStop(0, '#334155');
  heliGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = heliGrad;
  ctx.beginPath();
  ctx.ellipse(4, -2, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.ellipse(18, -3, 11, 8, 0.25, -1.2, 1.3);
  ctx.fill();

  ctx.fillStyle = Math.sin(time * 16 + phase) > 0 ? '#EF4444' : '#3B82F6';
  ctx.beginPath();
  ctx.arc(0, 11, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const bladeLen = 46 * Math.abs(Math.cos(time * 28));
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, -21, 5, 7);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(2 - bladeLen, -21);
  ctx.lineTo(2 + bladeLen, -21);
  ctx.stroke();

  ctx.restore();
}

export function KriminalBankModal({
  isOpen,
  onClose,
  onMissionSuccess,
}: KriminalBankModalProps) {
  const [seasonState, setSeasonState] = useState<GtaSeasonPassState>(() =>
    getSeasonPassState()
  );
  const completed = isMissionCompleted('kriminal-bank', seasonState);

  const [stage, setStage] = useState<ModalStage>('briefing');
  const [waveIdx, setWaveIdx] = useState<number>(0);
  const [counts, setCounts] = useState({ cars: 0, officers: 0, helis: 0 });
  const [waveSlam, setWaveSlam] = useState<WaveInfo | null>(null);
  const [muted, setMuted] = useState<boolean>(() => gtaAudio.isMuted());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const unitsRef = useRef<EnemyUnit[]>([]);
  const burstsRef = useRef<BurstEffect[]>([]);
  const stageRef = useRef<ModalStage>('briefing');
  const waveIdxRef = useRef<number>(0);
  const introStartRef = useRef<number>(0);
  const missionStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const isOpenRef = useRef<boolean>(isOpen);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    waveIdxRef.current = waveIdx;
  }, [waveIdx]);

  const syncRemainingCounts = useCallback(() => {
    let cars = 0;
    let officers = 0;
    let helis = 0;
    for (const u of unitsRef.current) {
      if (u.cleared) continue;
      if (u.kind === 'car') cars++;
      else if (u.kind === 'officer') officers++;
      else if (u.kind === 'heli') helis++;
    }
    setCounts({ cars, officers, helis });
    return cars + officers + helis;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const fresh = getSeasonPassState();
      setSeasonState(fresh);
      setStage('briefing');
      setWaveIdx(0);
      setWaveSlam(null);
      unitsRef.current = [];
      burstsRef.current = [];
    } else {
      gtaAudio.stopHeistBgm();
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
        introTimerRef.current = null;
      }
    }
    return () => {
      gtaAudio.stopHeistBgm();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
        introTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const startWave = useCallback(
    (idx: number) => {
      const info = WAVES[idx];
      setWaveIdx(idx);
      waveIdxRef.current = idx;
      setWaveSlam(info);

      gtaAudio.playWaveSlamSfx(info.wave);
      if (info.wave >= 2) {
        gtaAudio.playSirenBurst(2);
      }

      const nextUnits = createWaveUnits(info);
      unitsRef.current = nextUnits;
      syncRemainingCounts();

      setTimeout(() => {
        setWaveSlam((curr) => (curr?.wave === info.wave ? null : curr));
      }, 1350);
    },
    [syncRemainingCounts]
  );

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    gtaAudio.setMuted(next);
  };

  const handlePlay = () => {
    if (completed) return;
    gtaAudio.unlock();
    gtaAudio.startHeistBgm();
    gtaAudio.playSirenBurst(4);

    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    introStartRef.current = performance.now();
    burstsRef.current = [];
    unitsRef.current = [];
    setStage('intro');
    stageRef.current = 'intro';

    introTimerRef.current = setTimeout(() => {
      if (!isOpenRef.current) return;
      missionStartRef.current = Date.now();
      setStage('playing');
      stageRef.current = 'playing';
      startWave(0);
    }, 3500);
  };

  useEffect(() => {
    if (!isOpen || (stage !== 'intro' && stage !== 'playing')) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let prevTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prevTs) / 1000);
      prevTs = now;
      const tSec = now / 1000;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
          draw2DBankWorld(ctx, tSec, true);

          if (stageRef.current === 'intro') {
            const elapsed = (now - introStartRef.current) / 1000;
            const foxX = 185 + elapsed * 215;
            const foxY = 278;
            if (foxX < LOGICAL_W + 70) {
              drawBluefoxThief(ctx, foxX, foxY, tSec, 1.05);
            }

            if (elapsed > 0.55) {
              const carX = -90 + (elapsed - 0.55) * 265;
              drawPatrolCar3D(ctx, carX, 304, 1, tSec);
            }
          } else if (stageRef.current === 'playing') {
            // Draw in painter order: helis -> background officers -> cars -> foreground
            for (const u of unitsRef.current) {
              if (u.cleared) continue;

              u.x += u.vx * dt;
              if (u.kind === 'heli') {
                u.y = u.baseY + Math.sin(tSec * 3.4 + u.phase) * 14;
              }

              if (u.x < 46) {
                u.x = 46;
                u.vx = Math.abs(u.vx);
              } else if (u.x > LOGICAL_W - 46) {
                u.x = LOGICAL_W - 46;
                u.vx = -Math.abs(u.vx);
              }

              const dir = u.vx >= 0 ? 1 : -1;
              if (u.kind === 'officer') {
                drawPoliceOfficer3D(ctx, u.x, u.y, dir, tSec, u.phase);
              } else if (u.kind === 'car') {
                drawPatrolCar3D(ctx, u.x, u.y, dir, tSec);
              } else {
                drawHelicopter3D(ctx, u.x, u.y, dir, tSec, u.phase);
              }
            }

            burstsRef.current = burstsRef.current.filter((b) => {
              b.age += dt;
              if (b.age >= b.maxAge) return false;
              const p = b.age / b.maxAge;
              ctx.save();
              ctx.strokeStyle = b.color;
              ctx.globalAlpha = 1 - p;
              ctx.lineWidth = 4 * (1 - p) + 1;
              ctx.beginPath();
              ctx.arc(b.x, b.y, 12 + p * 44, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
              return true;
            });
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, stage]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stageRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const ly = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;

    let primaryHit: EnemyUnit | null = null;
    let bestDist = Infinity;

    for (const u of unitsRef.current) {
      if (u.cleared) continue;
      const dist = Math.hypot(lx - u.x, ly - u.y);
      if (dist <= u.radius + 16 && dist < bestDist) {
        bestDist = dist;
        primaryHit = u;
      }
    }

    if (!primaryHit) return;

    primaryHit.cleared = true;
    gtaAudio.playHitSfx(primaryHit.kind);
    burstsRef.current.push({
      x: primaryHit.x,
      y: primaryHit.y,
      age: 0,
      maxAge: 0.4,
      color: primaryHit.kind === 'heli' ? '#F36A78' : '#FFB458',
    });

    // If tapping a dense police squad cluster, clear up to 1 nearby officer right under finger
    if (primaryHit.kind === 'officer') {
      for (const other of unitsRef.current) {
        if (!other.cleared && other.kind === 'officer') {
          if (Math.hypot(lx - other.x, ly - other.y) <= 28) {
            other.cleared = true;
            burstsRef.current.push({
              x: other.x,
              y: other.y,
              age: 0,
              maxAge: 0.35,
              color: '#FFB458',
            });
            break;
          }
        }
      }
    }

    const left = syncRemainingCounts();

    if (left === 0) {
      const nextIdx = waveIdxRef.current + 1;
      if (nextIdx < WAVES.length) {
        setTimeout(() => {
          if (isOpenRef.current) startWave(nextIdx);
        }, 420);
      } else {
        gtaAudio.stopHeistBgm();
        const clearSec = Math.max(1, Math.round((Date.now() - missionStartRef.current) / 1000));
        setTimeout(() => {
          if (!isOpenRef.current) return;
          const nextState = completeKriminalBankMission(clearSec);
          setSeasonState(nextState);
          setStage('victory_anim');
          stageRef.current = 'victory_anim';
          onMissionSuccess?.(nextState);
        }, 380);
      }
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && stage !== 'victory_anim' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] w-screen h-[100dvh] bg-[#140A26] text-white flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kriminal-bank-title"
          >
            {/* Full-screen Header */}
            <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#3B146B] text-white text-[10px] font-extrabold uppercase tracking-wider">
                  Mission 01
                </span>
                <h2 id="kriminal-bank-title" className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Kriminal Bank
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
                  aria-label="Close Kriminal Bank"
                  className="w-10 h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={19} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Full-screen Body */}
            <div className="flex-1 flex flex-col justify-center overflow-y-auto p-3 sm:p-6">
              {stage === 'briefing' && (
                <div className="w-full max-w-2xl mx-auto space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {WAVES.map((w) => (
                      <div
                        key={w.wave}
                        className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 text-center"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#FFB458]">
                          {w.code}
                        </p>
                        <p className="text-sm font-bold text-white mt-1">
                          {w.summary}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl p-4 bg-gradient-to-r from-[#3B146B] via-[#7B208F] to-[#C9349B] border border-white/15 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white/15 text-[#FFB458] flex items-center justify-center shrink-0">
                      <Zap size={20} strokeWidth={2.4} />
                    </div>
                    <div className="text-sm">
                      <span className="font-extrabold text-[#FFB458]">20% OFF</span>{' '}
                      <span className="font-semibold text-white">Usage Limit (1 Jam)</span>
                    </div>
                  </div>

                  {completed ? (
                    <div className="w-full min-h-[54px] rounded-2xl bg-white/10 border border-white/15 text-white/80 font-bold text-sm flex items-center justify-center gap-2">
                      <Check size={18} className="text-[#FFB458]" />
                      <span>Misi Selesai (Sekali Main)</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePlay}
                      className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Play size={18} fill="currentColor" strokeWidth={2.2} />
                      <span>PLAY</span>
                    </button>
                  )}
                </div>
              )}

              {(stage === 'intro' || stage === 'playing') && (
                <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center gap-3 min-h-0">
                  {/* Compact HUD */}
                  <div className="flex items-center justify-between gap-2 text-xs font-bold flex-wrap shrink-0">
                    <span className="px-3 py-1 rounded-lg bg-[#3B146B] border border-white/15 text-[#FFB458] uppercase tracking-wider">
                      {stage === 'intro' ? 'Heist Escape' : `${WAVES[waveIdx].code} · ${WAVES[waveIdx].title}`}
                    </span>
                    {stage === 'playing' && (
                      <div className="flex items-center gap-2 font-mono text-xs text-white/90">
                        <span className="px-2.5 py-1 rounded bg-white/10">Mobil: {counts.cars}</span>
                        <span className="px-2.5 py-1 rounded bg-white/10">Polisi: {counts.officers}</span>
                        {counts.helis > 0 && (
                          <span className="px-2.5 py-1 rounded bg-[#C9349B]/60">Heli: {counts.helis}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Interactive 2D Bank World Canvas (Full-Screen Responsive) */}
                  <div className="relative w-full flex-1 min-h-[240px] max-h-[calc(100dvh-135px)] flex items-center justify-center">
                    <div className="relative w-full h-full max-w-full aspect-[800/420] max-h-full rounded-2xl overflow-hidden border border-white/15 bg-[#1A1626] touch-none select-none shadow-2xl">
                      <canvas
                        ref={canvasRef}
                        width={LOGICAL_W}
                        height={LOGICAL_H}
                        onPointerDown={handleCanvasPointerDown}
                        className="w-full h-full block cursor-crosshair"
                      />

                      {/* Dramatic Per-Wave Transition Slam */}
                      <AnimatePresence>
                        {waveSlam && (
                          <motion.div
                            key={waveSlam.wave}
                            initial={{ opacity: 0, scale: 1.48 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={{ duration: 0.34, ease: 'easeOut' }}
                            className="absolute inset-0 pointer-events-none flex items-center justify-center bg-gradient-to-r from-[#3B146B]/85 via-[#C9349B]/75 to-[#3B146B]/85 backdrop-blur-[2px]"
                          >
                            <div className="text-center px-4">
                              <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.28em] text-[#FFB458]">
                                {waveSlam.code}
                              </p>
                              <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1 drop-shadow-lg">
                                {waveSlam.title}
                              </h3>
                              <p className="text-xs sm:text-sm font-bold text-white/90 mt-1.5">
                                {waveSlam.summary}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-win Cinematic Vice City Animation + Smooth Reward Popup */}
      <KriminalBankVictorySequence
        isOpen={isOpen && stage === 'victory_anim'}
        onComplete={() => {
          onClose();
        }}
      />
    </>
  );
}
