import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PumpkinSvg, 
  SkeletonSkullSvg, 
  GhostSvg, 
  HeadlessHorsemanSvg, 
  BatSvg 
} from './HalloweenSvgAssets';

export type EasterEggType = 'pumpkin' | 'skeleton' | 'ghost' | 'headless' | 'all' | null;

interface HalloweenEasterEggProps {
  type: EasterEggType;
  onComplete: () => void;
}

export const HalloweenEasterEgg: React.FC<HalloweenEasterEggProps> = ({ type, onComplete }) => {
  useEffect(() => {
    if (!type) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 4500);
    return () => clearTimeout(timer);
  }, [type, onComplete]);

  if (!type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
        {/* Type: PUMPKIN / PUMKIN */}
        {(type === 'pumpkin' || type === 'all') && (
          <>
            {[...Array(type === 'all' ? 6 : 9)].map((_, i) => {
              const startX = 8 + (i * 10);
              const duration = 2.8 + (i % 3) * 0.4;
              const delay = (i % 4) * 0.2;
              const size = 50 + (i % 3) * 16;
              return (
                <motion.div
                  key={`pumpkin-${i}`}
                  initial={{ y: '110vh', x: `${startX}vw`, opacity: 0, rotate: -20 }}
                  animate={{ 
                    y: '-15vh', 
                    opacity: [0, 1, 1, 0], 
                    rotate: [ -20, 25, -15, 30 ],
                    x: [`${startX}vw`, `${startX + ((i % 2 === 0 ? 1 : -1) * 8)}vw`, `${startX}vw`]
                  }}
                  transition={{ duration, delay, ease: 'easeOut' }}
                  className="absolute select-none"
                >
                  <PumpkinSvg size={size} glow={true} />
                </motion.div>
              );
            })}
          </>
        )}

        {/* Type: SKELETON */}
        {(type === 'skeleton' || type === 'all') && (
          <>
            {[...Array(type === 'all' ? 5 : 8)].map((_, i) => {
              const startY = 15 + (i * 10);
              const duration = 3.2 + (i % 3) * 0.3;
              const delay = (i % 3) * 0.25;
              const size = 52 + (i % 3) * 14;
              return (
                <motion.div
                  key={`skeleton-${i}`}
                  initial={{ x: '-15vw', y: `${startY}vh`, opacity: 0, scale: 0.8 }}
                  animate={{ 
                    x: '115vw', 
                    opacity: [0, 1, 1, 0], 
                    rotate: [0, 15, -15, 0],
                    y: [`${startY}vh`, `${startY - 8}vh`, `${startY + 8}vh`, `${startY}vh`]
                  }}
                  transition={{ duration, delay, ease: 'linear' }}
                  className="absolute select-none flex items-center gap-2"
                >
                  <SkeletonSkullSvg size={size} glow={true} />
                </motion.div>
              );
            })}
          </>
        )}

        {/* Type: GHOST */}
        {(type === 'ghost' || type === 'all') && (
          <>
            {[...Array(type === 'all' ? 5 : 8)].map((_, i) => {
              const startX = 12 + (i * 11);
              const duration = 3.5 + (i % 2) * 0.5;
              const delay = (i % 4) * 0.2;
              const size = 60 + (i % 3) * 15;
              return (
                <motion.div
                  key={`ghost-${i}`}
                  initial={{ y: '105vh', x: `${startX}vw`, opacity: 0, scale: 0.7 }}
                  animate={{ 
                    y: '-20vh', 
                    opacity: [0, 0.95, 0.95, 0],
                    x: [`${startX}vw`, `${startX - 10}vw`, `${startX + 10}vw`, `${startX}vw`],
                    rotate: [-10, 10, -10]
                  }}
                  transition={{ duration, delay, ease: 'easeInOut' }}
                  className="absolute select-none"
                >
                  <GhostSvg size={size} />
                </motion.div>
              );
            })}
          </>
        )}

        {/* Type: HEADLESS HORSE MAN */}
        {(type === 'headless' || type === 'all') && (
          <motion.div
            initial={{ x: '-35vw', y: '55vh', opacity: 0, scale: 0.9 }}
            animate={{ 
              x: '120vw', 
              opacity: [0, 1, 1, 0],
              y: ['55vh', '50vh', '58vh', '52vh', '55vh']
            }}
            transition={{ duration: 4.2, ease: 'easeInOut' }}
            className="absolute select-none flex items-center"
          >
            <HeadlessHorsemanSvg size={90} />
            <div className="hidden sm:block ml-4 bg-black/90 text-orange-400 border border-orange-500/60 px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest shadow-xl">
              THE HEADLESS HORSEMAN
            </div>
          </motion.div>
        )}

        {/* Spooky Banner for 'all' / 'halloween' */}
        {type === 'all' && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.05, 1, 1, 0.9], opacity: [0, 1, 1, 1, 0] }}
            transition={{ duration: 3.5, ease: 'easeOut' }}
            className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-full bg-black/90 border-2 border-orange-500 text-orange-300 shadow-[0_0_35px_rgba(249,115,22,0.6)] backdrop-blur-md"
          >
            <PumpkinSvg size={28} glow={true} />
            <span className="text-sm sm:text-base font-extrabold tracking-wider font-mono uppercase bg-gradient-to-r from-orange-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
              HALLOWEEN 2026 IS HERE!
            </span>
            <BatSvg size={36} animateFlap={true} />
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
