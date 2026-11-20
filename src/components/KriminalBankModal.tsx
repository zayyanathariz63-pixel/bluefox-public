import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Shield, Zap, Check } from 'lucide-react';
import {
  completeKriminalBankMission,
  getSeasonPassState,
  isMissionCompleted,
  GtaSeasonPassState,
} from '../lib/gtaSeasonPass';

interface KriminalBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionSuccess?: (state: GtaSeasonPassState) => void;
}

type ModalStage = 'briefing' | 'intro' | 'playing' | 'victory';

interface EnemyUnit {
  id: string;
  wave: 1 | 2 | 3;
  x: number; // logical 0..800
  y: number; // logical 0..420
  vx: number;
  vy: number;
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
  count: number;
}

const LOGICAL_W = 800;
const LOGICAL_H = 420;

const WAVES: WaveInfo[] = [
  { wave: 1, code: 'WAVE 01', title: 'Police Squad', count: 5 },
  { wave: 2, code: 'WAVE 02', title: 'Patrol Cars', count: 4 },
  { wave: 3, code: 'WAVE 03', title: 'Police Helicopters', count: 3 },
];

function createWaveUnits(wave: 1 | 2 | 3, count: number): EnemyUnit[] {
  const units: EnemyUnit[] = [];
  for (let i = 0; i < count; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    if (wave === 1) {
      const y = 266 + (i % 3) * 34;
      units.push({
        id: `w1-${i}-${Date.now()}`,
        wave: 1,
        x: dir === 1 ? 80 + i * 95 : 720 - i * 85,
        y,
        baseY: y,
        vx: dir * (115 + (i % 3) * 28),
        vy: 0,
        phase: i * 1.3,
        radius: 38,
        cleared: false,
      });
    } else if (wave === 2) {
      const y = i % 2 === 0 ? 276 : 334;
      units.push({
        id: `w2-${i}-${Date.now()}`,
        wave: 2,
        x: dir === 1 ? 110 + i * 130 : 690 - i * 110,
        y,
        baseY: y,
        vx: dir * (185 + i * 32),
        vy: 0,
        phase: i * 0.9,
        radius: 52,
        cleared: false,
      });
    } else {
      const y = 94 + i * 42;
      units.push({
        id: `w3-${i}-${Date.now()}`,
        wave: 3,
        x: dir === 1 ? 120 + i * 170 : 680 - i * 140,
        y,
        baseY: y,
        vx: dir * (145 + i * 25),
        vy: 0,
        phase: i * 1.7,
        radius: 50,
        cleared: false,
      });
    }
  }
  return units;
}

function draw2DBankWorld(ctx: CanvasRenderingContext2D, time: number, sirenPulse: boolean) {
  // Sunset to Deep Violet sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 260);
  skyGrad.addColorStop(0, '#3B146B');
  skyGrad.addColorStop(0.55, '#7B208F');
  skyGrad.addColorStop(1, '#F36A78');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, LOGICAL_W, 260);

  // Vice City Setting Sun
  const sunGrad = ctx.createLinearGradient(0, 88, 0, 210);
  sunGrad.addColorStop(0, '#FFB458');
  sunGrad.addColorStop(1, '#F36A78');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(620, 165, 62, 0, Math.PI * 2);
  ctx.fill();

  // Horizon skyline silhouettes
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

  // Palm tree silhouettes right side
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

  // Stylized 2.5D VICE BANK Building (Left-Center)
  // Extruded right side wall
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

  // Roof cornice & pediment
  ctx.fillStyle = '#3B146B';
  ctx.fillRect(54, 72, 272, 18);
  ctx.fillStyle = '#FFB458';
  ctx.fillRect(58, 86, 264, 4);

  // BANK Signplate
  ctx.fillStyle = '#111827';
  ctx.fillRect(130, 96, 120, 28);
  ctx.strokeStyle = '#FFB458';
  ctx.lineWidth = 2;
  ctx.strokeRect(130, 96, 120, 28);
  ctx.fillStyle = '#FFB458';
  ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BANK', 190, 116);

  // Classical Marble Columns
  ctx.fillStyle = '#D5CCE8';
  [78, 110, 252, 284].forEach((cx) => {
    ctx.fillRect(cx, 128, 16, 120);
    ctx.fillStyle = '#B8ACDA';
    ctx.fillRect(cx + 11, 128, 5, 120);
    ctx.fillStyle = '#D5CCE8';
  });

  // Glowing Bank Vault Entrance
  ctx.fillStyle = '#181029';
  ctx.fillRect(156, 152, 68, 96);
  const vaultGlow = ctx.createRadialGradient(190, 206, 6, 190, 206, 48);
  vaultGlow.addColorStop(0, 'rgba(255, 180, 88, 0.72)');
  vaultGlow.addColorStop(1, 'rgba(255, 180, 88, 0)');
  ctx.fillStyle = vaultGlow;
  ctx.fillRect(156, 152, 68, 96);

  // Sidewalk
  ctx.fillStyle = '#64597A';
  ctx.fillRect(0, 246, LOGICAL_W, 22);
  ctx.fillStyle = '#85789E';
  ctx.fillRect(0, 246, LOGICAL_W, 4);

  // Two-Lane Asphalt Road
  ctx.fillStyle = '#1A1626';
  ctx.fillRect(0, 268, LOGICAL_W, LOGICAL_H - 268);

  // Dashed lane divider
  ctx.strokeStyle = '#FFB458';
  ctx.lineWidth = 3;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  ctx.moveTo(0, 336);
  ctx.lineTo(LOGICAL_W, 336);
  ctx.stroke();
  ctx.setLineDash([]);

  // Siren ambient reflection on asphalt
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

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 34, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (animated running stride)
  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 10);
  ctx.lineTo(-4 + stride * 14, 30);
  ctx.moveTo(4, 10);
  ctx.lineTo(4 - stride * 14, 30);
  ctx.stroke();

  // Torso (3D shaded cyber-blue jacket)
  const bodyGrad = ctx.createLinearGradient(-12, -16, 12, 12);
  bodyGrad.addColorStop(0, '#3B82F6');
  bodyGrad.addColorStop(1, '#1D4ED8');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-11, -15, 22, 28, 6);
  ctx.fill();

  // Loot cash bag carried behind/side
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.ellipse(-18, 2 + Math.abs(stride) * 2, 11, 13, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FDE68A';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', -18, 6 + Math.abs(stride) * 2);

  // Bluefox Head & Ears
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(2, -25, 13, 0, Math.PI * 2);
  ctx.fill();

  // Fox ears
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

  // Cyan visor
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

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 48, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Headlight cone
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

  // Lower car chassis (3D side face)
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(-45, -6, 92, 22, 6);
  ctx.fill();

  // White police door panel
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-16, -4, 34, 18);

  // Upper cabin & windshield (2.5D depth)
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(-26, -6);
  ctx.lineTo(-14, -21);
  ctx.lineTo(18, -21);
  ctx.lineTo(30, -6);
  ctx.closePath();
  ctx.fill();

  // Glass highlight
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.moveTo(-11, -18);
  ctx.lineTo(15, -18);
  ctx.lineTo(24, -8);
  ctx.lineTo(-18, -8);
  ctx.closePath();
  ctx.fill();

  // Flashing Red/Blue Lightbar
  const flash = Math.sin(time * 18) > 0;
  ctx.fillStyle = flash ? '#EF4444' : '#3B82F6';
  ctx.fillRect(-5, -26, 7, 5);
  ctx.fillStyle = flash ? '#3B82F6' : '#EF4444';
  ctx.fillRect(2, -26, 7, 5);

  // Lightbar glow halo
  ctx.fillStyle = flash ? 'rgba(239,68,68,0.28)' : 'rgba(59,130,246,0.28)';
  ctx.beginPath();
  ctx.arc(2, -24, 18, 0, Math.PI * 2);
  ctx.fill();

  // Spinning Wheels
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
  ctx.scale(dir, 1);

  const stride = Math.sin(time * 12 + phase);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 26, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Walking legs
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3, 7);
  ctx.lineTo(-3 + stride * 9, 23);
  ctx.moveTo(3, 7);
  ctx.lineTo(3 - stride * 9, 23);
  ctx.stroke();

  // Armor Vest (2.5D gradient)
  const vestGrad = ctx.createLinearGradient(-10, -14, 10, 10);
  vestGrad.addColorStop(0, '#334155');
  vestGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = vestGrad;
  ctx.beginPath();
  ctx.roundRect(-10, -13, 20, 22, 5);
  ctx.fill();

  // Badge glint
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(4, -5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Helmet & Visor
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, -21, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(1, -24, 9, 5);

  // Riot Shield facing front
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

  // Searchlight cone sweeping onto the street
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

  // Tail boom & rotor
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-50, -6, 36, 7);
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(-52, -14, 7, 14);

  // Skids
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

  // Fuselage 3D shaded body
  const heliGrad = ctx.createLinearGradient(-22, -16, 28, 12);
  heliGrad.addColorStop(0, '#334155');
  heliGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = heliGrad;
  ctx.beginPath();
  ctx.ellipse(4, -2, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cockpit glass
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.ellipse(18, -3, 11, 8, 0.25, -1.2, 1.3);
  ctx.fill();

  // Flashing belly beacon
  ctx.fillStyle = Math.sin(time * 16 + phase) > 0 ? '#EF4444' : '#3B82F6';
  ctx.beginPath();
  ctx.arc(0, 11, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Spinning Main Rotor Blur
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
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [waveSlam, setWaveSlam] = useState<WaveInfo | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      const fresh = getSeasonPassState();
      setSeasonState(fresh);
      setStage('briefing');
      setWaveIdx(0);
      setWaveSlam(null);
      unitsRef.current = [];
      burstsRef.current = [];
    } else if (introTimerRef.current) {
      clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
        introTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const startWave = useCallback((idx: number) => {
    const info = WAVES[idx];
    setWaveIdx(idx);
    waveIdxRef.current = idx;
    setWaveSlam(info);

    const nextUnits = createWaveUnits(info.wave, info.count);
    unitsRef.current = nextUnits;
    setRemainingCount(nextUnits.length);

    setTimeout(() => {
      setWaveSlam((curr) => (curr?.wave === info.wave ? null : curr));
    }, 1250);
  }, []);

  const handlePlay = () => {
    if (completed) return;
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

  // Animation loop for both Intro Cutscene and Playing Stage
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
            // Bluefox AI emerges from Bank vault (x=190) and exits right frame (x=860)
            const foxX = 185 + elapsed * 215;
            const foxY = 278;
            if (foxX < LOGICAL_W + 70) {
              drawBluefoxThief(ctx, foxX, foxY, tSec, 1.05);
            }

            // Police patrol car chases from behind left edge after 0.6s
            if (elapsed > 0.55) {
              const carX = -90 + (elapsed - 0.55) * 265;
              drawPatrolCar3D(ctx, carX, 304, 1, tSec);
            }
          } else if (stageRef.current === 'playing') {
            // Update & draw moving 3D-styled units
            for (const u of unitsRef.current) {
              if (u.cleared) continue;

              u.x += u.vx * dt;
              if (u.wave === 3) {
                u.y = u.baseY + Math.sin(tSec * 3.4 + u.phase) * 14;
              }

              // Bounce cleanly inside stage bounds
              if (u.x < 52) {
                u.x = 52;
                u.vx = Math.abs(u.vx);
              } else if (u.x > LOGICAL_W - 52) {
                u.x = LOGICAL_W - 52;
                u.vx = -Math.abs(u.vx);
              }

              const dir = u.vx >= 0 ? 1 : -1;
              if (u.wave === 1) {
                drawPoliceOfficer3D(ctx, u.x, u.y, dir, tSec, u.phase);
              } else if (u.wave === 2) {
                drawPatrolCar3D(ctx, u.x, u.y, dir, tSec);
              } else {
                drawHelicopter3D(ctx, u.x, u.y, dir, tSec, u.phase);
              }
            }

            // Update & draw impact bursts
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

    let hitUnit: EnemyUnit | null = null;
    let bestDist = Infinity;

    for (const u of unitsRef.current) {
      if (u.cleared) continue;
      const dx = lx - u.x;
      const dy = ly - u.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= u.radius + 14 && dist < bestDist) {
        bestDist = dist;
        hitUnit = u;
      }
    }

    if (!hitUnit) return;

    hitUnit.cleared = true;
    burstsRef.current.push({
      x: hitUnit.x,
      y: hitUnit.y,
      age: 0,
      maxAge: 0.42,
      color: '#FFB458',
    });

    const left = unitsRef.current.filter((u) => !u.cleared).length;
    setRemainingCount(left);

    if (left === 0) {
      const nextIdx = waveIdxRef.current + 1;
      if (nextIdx < WAVES.length) {
        setTimeout(() => {
          startWave(nextIdx);
        }, 380);
      } else {
        const clearSec = Math.max(1, Math.round((Date.now() - missionStartRef.current) / 1000));
        setTimeout(() => {
          const nextState = completeKriminalBankMission(clearSec);
          setSeasonState(nextState);
          setStage('victory');
          stageRef.current = 'victory';
          onMissionSuccess?.(nextState);
        }, 420);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kriminal-bank-title"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-2xl bg-[#140A26] text-white rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col"
          >
            {/* Minimal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] text-[#111827] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#3B146B] text-white text-[10px] font-extrabold uppercase tracking-wider">
                  Mission 01
                </span>
                <h2 id="kriminal-bank-title" className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Kriminal Bank
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Kriminal Bank"
                className="w-10 h-10 rounded-full bg-[#3B146B]/15 hover:bg-[#3B146B]/25 text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={19} strokeWidth={2.5} />
              </button>
            </div>

            {/* Clean Body */}
            <div className="p-4 sm:p-5">
              {stage === 'briefing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {WAVES.map((w) => (
                      <div
                        key={w.wave}
                        className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-center"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFB458]">
                          {w.code}
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                          {w.title}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl p-3.5 bg-gradient-to-r from-[#3B146B] via-[#7B208F] to-[#C9349B] border border-white/15 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/15 text-[#FFB458] flex items-center justify-center shrink-0">
                      <Zap size={18} strokeWidth={2.4} />
                    </div>
                    <div className="text-xs sm:text-sm">
                      <span className="font-extrabold text-[#FFB458]">20% OFF</span>{' '}
                      <span className="font-semibold text-white">Usage Limit (1 Jam)</span>
                    </div>
                  </div>

                  {completed ? (
                    <div className="w-full min-h-[50px] rounded-2xl bg-white/10 border border-white/15 text-white/80 font-bold text-sm flex items-center justify-center gap-2">
                      <Check size={18} className="text-[#FFB458]" />
                      <span>Misi Selesai (Sekali Main)</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePlay}
                      className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-[#F36A78] via-[#FF9B55] to-[#FFB458] hover:brightness-105 active:scale-[0.985] text-[#111827] font-extrabold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Play size={18} fill="currentColor" strokeWidth={2.2} />
                      <span>PLAY</span>
                    </button>
                  )}
                </div>
              )}

              {(stage === 'intro' || stage === 'playing') && (
                <div className="space-y-3">
                  {/* Minimal HUD */}
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-[#3B146B] border border-white/15 text-[#FFB458] uppercase tracking-wider">
                      {stage === 'intro' ? 'Heist Escape' : `${WAVES[waveIdx].code} · ${WAVES[waveIdx].title}`}
                    </span>
                    {stage === 'playing' && (
                      <span className="font-mono text-white/90">
                        Target: {remainingCount}
                      </span>
                    )}
                  </div>

                  {/* Interactive 2D Bank World Canvas */}
                  <div className="relative w-full aspect-[800/420] rounded-2xl overflow-hidden border border-white/15 bg-[#1A1626] touch-none select-none">
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
                          initial={{ opacity: 0, scale: 1.45 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.32, ease: 'easeOut' }}
                          className="absolute inset-0 pointer-events-none flex items-center justify-center bg-gradient-to-r from-[#3B146B]/85 via-[#C9349B]/75 to-[#3B146B]/85 backdrop-blur-[2px]"
                        >
                          <div className="text-center px-4">
                            <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.28em] text-[#FFB458]">
                              {waveSlam.code}
                            </p>
                            <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1 drop-shadow-lg">
                              {waveSlam.title}
                            </h3>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {stage === 'victory' && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#3B146B] via-[#7B208F] to-[#C9349B] text-[#FFB458] flex items-center justify-center shadow-lg">
                    <Shield size={28} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">Kriminal Bank Selesai</h3>
                    <p className="text-xs text-white/75 mt-1">
                      20% OFF Usage Limit aktif selama 1 jam.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#F36A78] to-[#FFB458] text-[#111827] font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={17} strokeWidth={2.6} />
                    <span>Selesai</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
