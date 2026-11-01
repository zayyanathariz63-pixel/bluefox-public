import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RewardType, 
  MONSTER_CONFIGS, 
  getNextSpawnTimestamps, 
  rescheduleNextSpawn, 
  catchHalloweenMonster,
  isHalloweenEventActive 
} from '../lib/halloweenManager';
import { 
  BatSvg, 
  PumpkinSvg, 
  SkeletonSkullSvg, 
  HalloweenCandySvg 
} from './HalloweenSvgAssets';

interface ActiveMonster {
  id: string;
  type: RewardType;
  spawnTime: number;
  durationMs: number;
  xPercent: number; // 0 - 100
  yPercent: number; // 0 - 100
  positionStyle?: 'bottom-edge' | 'top-float' | 'fly-across';
}

interface CandyPopup {
  id: number;
  earned: number;
  x: number;
  y: number;
  monsterName: string;
}

// Audio chime using Web Audio API for rewarding interaction
function playCatchSound(type: RewardType) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play a friendly magical chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    const baseFreq = type === 'bat' ? 520 : type === 'pumpkin' ? 659 : 784;

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.18);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.25, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.25);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch {}
}

export const HalloweenMonsterSpawner: React.FC = () => {
  const [activeMonster, setActiveMonster] = useState<ActiveMonster | null>(null);
  const [popups, setPopups] = useState<CandyPopup[]>([]);
  const activeMonsterRef = useRef<ActiveMonster | null>(null);
  activeMonsterRef.current = activeMonster;

  const despawnTimeoutRef = useRef<any>(null);

  // Spawn monster function
  const spawnMonster = (type: RewardType) => {
    // If a monster is already on screen, don't spawn another one over it
    if (activeMonsterRef.current) return;

    const config = MONSTER_CONFIGS[type];
    const durationMs = config.displayDurationSeconds * 1000;

    let positionStyle: 'bottom-edge' | 'top-float' | 'fly-across' = 'fly-across';
    let xPercent = 50;
    let yPercent = 50;

    if (type === 'bat') {
      positionStyle = 'fly-across';
      yPercent = 15 + Math.random() * 55; // 15% to 70% height
      xPercent = -10;
    } else if (type === 'pumpkin') {
      positionStyle = 'bottom-edge';
      const edgePositions = [15, 50, 85];
      xPercent = edgePositions[Math.floor(Math.random() * edgePositions.length)];
      yPercent = 90;
    } else if (type === 'skeleton') {
      positionStyle = 'top-float';
      xPercent = 20 + Math.random() * 60;
      yPercent = 20;
    }

    const newMonster: ActiveMonster = {
      id: `${type}_${Date.now()}`,
      type,
      spawnTime: Date.now(),
      durationMs,
      xPercent,
      yPercent,
      positionStyle
    };

    setActiveMonster(newMonster);

    // Auto despawn timer (Missed by user)
    if (despawnTimeoutRef.current) clearTimeout(despawnTimeoutRef.current);
    despawnTimeoutRef.current = setTimeout(() => {
      handleMiss(type);
    }, durationMs + 200);
  };

  // User misses the monster
  const handleMiss = (type: RewardType) => {
    setActiveMonster(null);
    rescheduleNextSpawn(type);
  };

  // User catches the monster!
  const handleCatch = (e: React.MouseEvent | React.TouchEvent, monster: ActiveMonster) => {
    e.stopPropagation();
    if (despawnTimeoutRef.current) clearTimeout(despawnTimeoutRef.current);

    const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
    const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);

    playCatchSound(monster.type);
    const res = catchHalloweenMonster(monster.type);

    // Show popup candy toast
    const newPopup: CandyPopup = {
      id: Date.now() + Math.random(),
      earned: res.earned,
      x: clientX,
      y: clientY,
      monsterName: MONSTER_CONFIGS[monster.type].name
    };
    setPopups(prev => [...prev, newPopup]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== newPopup.id));
    }, 2000);

    setActiveMonster(null);
  };

  // Spawner loop: checks every 1 second
  useEffect(() => {
    if (!isHalloweenEventActive()) return;

    const interval = setInterval(() => {
      if (activeMonsterRef.current) return;

      const timestamps = getNextSpawnTimestamps();
      const now = Date.now();

      // Priority: skeleton > pumpkin > bat
      if (now >= timestamps.skeleton) {
        spawnMonster('skeleton');
      } else if (now >= timestamps.pumpkin) {
        spawnMonster('pumpkin');
      } else if (now >= timestamps.bat) {
        spawnMonster('bat');
      }
    }, 1000);

    // Listener for manual testing triggers
    const handleForceSpawn = (e: any) => {
      if (e.detail && MONSTER_CONFIGS[e.detail as RewardType]) {
        spawnMonster(e.detail as RewardType);
      }
    };
    window.addEventListener('tmpa_halloween_force_spawn', handleForceSpawn);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tmpa_halloween_force_spawn', handleForceSpawn);
      if (despawnTimeoutRef.current) clearTimeout(despawnTimeoutRef.current);
    };
  }, []);

  if (!isHalloweenEventActive()) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      {/* Floating Candy Reward Popups */}
      {popups.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, scale: 0.5, y: p.y, x: p.x }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1, 0.9], y: p.y - 75 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          className="fixed pointer-events-none z-[10000] -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/90 border border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.8)] backdrop-blur-md"
        >
          <HalloweenCandySvg size={24} />
          <div className="flex flex-col">
            <span className="text-sm font-black font-mono text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]">
              +{p.earned} CANDY!
            </span>
            <span className="text-[10px] text-orange-200/90 font-semibold font-mono">
              {p.monsterName} Tertangkap
            </span>
          </div>
        </motion.div>
      ))}

      {/* Active Spawning Monster */}
      <AnimatePresence>
        {activeMonster && (
          <div key={activeMonster.id} className="w-full h-full relative">
            
            {/* 1. BAT: Flies across the screen */}
            {activeMonster.type === 'bat' && (
              <motion.div
                initial={{ x: '-120px', y: `${activeMonster.yPercent}vh`, rotate: 10, scale: 0.9 }}
                animate={{ 
                  x: ['calc(-120px)', 'calc(50vw)', 'calc(100vw + 120px)'],
                  y: [
                    `${activeMonster.yPercent}vh`, 
                    `${activeMonster.yPercent - 12}vh`, 
                    `${activeMonster.yPercent + 10}vh`, 
                    `${activeMonster.yPercent}vh`
                  ],
                  rotate: [10, -15, 12, -8, 10]
                }}
                transition={{ 
                  duration: activeMonster.durationMs / 1000, 
                  ease: 'linear' 
                }}
                onClick={(e) => handleCatch(e, activeMonster)}
                className="absolute pointer-events-auto cursor-pointer p-3 group focus:outline-hidden touch-manipulation"
                title="Kelelawar! Klik untuk +1 Candy"
              >
                <div className="relative flex flex-col items-center">
                  {/* Subtle target hint */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-bold text-amber-300 bg-black/80 px-2 py-0.5 rounded-full border border-purple-500/50 mb-1 shadow-md whitespace-nowrap">
                    Klik! +1 Candy
                  </span>
                  
                  {/* Flying Bat SVG */}
                  <div className="transition-transform group-hover:scale-125 group-active:scale-95 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]">
                    <BatSvg size={70} animateFlap={true} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. PUMPKIN: Peeks up from screen edge for 5 seconds */}
            {activeMonster.type === 'pumpkin' && (
              <motion.div
                initial={{ y: 120, opacity: 0 }}
                animate={{ 
                  y: [120, 0, -8, 0], 
                  opacity: 1 
                }}
                exit={{ y: 120, opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{ 
                  position: 'absolute', 
                  left: `${activeMonster.xPercent}%`, 
                  bottom: '12px',
                  transform: 'translateX(-50%)' 
                }}
                onClick={(e) => handleCatch(e, activeMonster)}
                className="pointer-events-auto cursor-pointer p-3 group focus:outline-hidden touch-manipulation"
                title="Labu Mistis! Klik sebelum 5 detik!"
              >
                <div className="relative flex flex-col items-center">
                  {/* Floating Timer Badge (5s Countdown) */}
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.9, 1.05, 0.9] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="flex items-center gap-1 text-[11px] font-mono font-extrabold text-amber-300 bg-black/90 px-2.5 py-1 rounded-full border border-orange-500/80 shadow-[0_0_12px_rgba(249,115,22,0.8)] mb-1 whitespace-nowrap"
                  >
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                    <span>KLIK! +2 CANDY</span>
                  </motion.div>

                  {/* Jack-o'-Lantern SVG */}
                  <div className="transition-transform group-hover:scale-120 group-active:scale-95 drop-shadow-[0_0_20px_rgba(249,115,22,0.9)] animate-bounce">
                    <PumpkinSvg size={75} glow={true} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. SKELETON: Descends from top of screen for 5 seconds */}
            {activeMonster.type === 'skeleton' && (
              <motion.div
                initial={{ y: -150, opacity: 0 }}
                animate={{ 
                  y: [ -150, 20, 0, 10, 0 ], 
                  opacity: 1 
                }}
                exit={{ y: -150, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ 
                  position: 'absolute', 
                  left: `${activeMonster.xPercent}%`, 
                  top: '20px',
                  transform: 'translateX(-50%)' 
                }}
                onClick={(e) => handleCatch(e, activeMonster)}
                className="pointer-events-auto cursor-pointer p-3 group focus:outline-hidden touch-manipulation"
                title="Tengkorak Keramat! Klik untuk +4 Candy!"
              >
                <div className="relative flex flex-col items-center">
                  {/* Floating Target Badge */}
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.9, 1.05, 0.9] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="flex items-center gap-1 text-[11px] font-mono font-extrabold text-cyan-300 bg-black/90 px-3 py-1 rounded-full border border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.8)] mb-1 whitespace-nowrap"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>SENTUH TENGKORAK! +4 CANDY</span>
                  </motion.div>

                  {/* Spectral Skeleton Skull SVG */}
                  <div className="transition-transform group-hover:scale-120 group-active:scale-95 drop-shadow-[0_0_25px_rgba(129,140,248,0.95)]">
                    <SkeletonSkullSvg size={80} glow={true} />
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
