import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<'ambient' | 'logo' | 'hidden'>('ambient');

  useEffect(() => {
    // Show logo stage earlier to avoid waiting too long
    const ambientTimer = setTimeout(() => {
      setStage('logo');
    }, 500); // 0.5s of pure black/ambient before logo appears

    // Fade out everything after 3-4 seconds
    const transitionTimer = setTimeout(() => {
      setStage('hidden');
      setTimeout(onComplete, 800);
    }, 4000);

    return () => {
      clearTimeout(ambientTimer);
      clearTimeout(transitionTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage !== 'hidden' && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#00050b] overflow-hidden"
        >
          {/* Smooth Ambient Glowing Orbs Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dark deep blue center glow */}
            <motion.div
              animate={{
                scale: [1, 1.2, 0.9, 1.1, 1],
                opacity: [0.4, 0.7, 0.4, 0.6, 0.4],
                x: ['-5vw', '5vw', '-3vw', '4vw', '-5vw'],
                y: ['-5vh', '5vh', '3vh', '-4vh', '-5vh'],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[80vw] h-[80vw] md:w-[600px] md:h-[600px] rounded-full bg-[#0a3b66] blur-[80px] md:blur-[120px]"
            />
            {/* Brighter cyan moving orb */}
            <motion.div
              animate={{
                x: ['-25vw', '30vw', '-10vw', '20vw', '-25vw'],
                y: ['-20vh', '15vh', '25vh', '-10vh', '-20vh'],
                scale: [1, 1.3, 0.8, 1.2, 1],
                opacity: [0.3, 0.8, 0.3, 0.6, 0.3],
              }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[50vw] h-[50vw] md:w-[400px] md:h-[400px] rounded-full bg-[#0099ff]/30 blur-[60px] md:blur-[80px]"
            />
            {/* Additional moving blue orb */}
            <motion.div
              animate={{
                x: ['25vw', '-20vw', '15vw', '-25vw', '25vw'],
                y: ['20vh', '-25vh', '10vh', '20vh', '20vh'],
                scale: [1, 0.9, 1.4, 1, 1],
                opacity: [0.2, 0.7, 0.2, 0.5, 0.2],
              }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[60vw] h-[60vw] md:w-[450px] md:h-[450px] rounded-full bg-[#00bfff]/20 blur-[70px] md:blur-[100px]"
            />
          </div>

          {/* Logo Reveal */}
          <AnimatePresence>
            {stage === 'logo' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                transition={{ 
                  duration: 1,
                  ease: [0.16, 1, 0.3, 1] // Custom smooth easing
                }}
                className="relative z-10 flex flex-col items-center justify-center"
              >
                {/* 
                  Menggunakan gambar logo dari file eksternal 
                */}
                <div className="relative flex items-center justify-center p-4">
                   <img 
                      src="https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/TMPA%20storege/Desain%20tanpa%20judul_20260520_150307_0000.png" 
                      alt="TMPA Logo" 
                      className="w-56 h-56 md:w-72 md:h-72 object-contain drop-shadow-[0_0_15px_rgba(0,153,255,0.3)] select-none pointer-events-none"
                      onError={(e) => {
                        // Fallback message
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                   />
                   <div className="hidden text-white flex-col items-center justify-center w-56 h-56 text-center bg-gray-900 rounded-full border border-gray-700 shadow-xl">
                     <p className="text-xs text-gray-400 mb-2">Upload gambar logo<br/>TMPA ke folder <code className="text-blue-400 text-[10px]">public/</code><br/>dengan nama fle:<br/><code className="text-blue-400 font-bold">logo.png</code></p>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
