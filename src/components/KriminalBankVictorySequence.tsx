import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Check } from 'lucide-react';
import { gtaAudio } from '../lib/gtaAudio';

interface KriminalBankVictorySequenceProps {
  isOpen: boolean;
  onComplete: () => void;
}

// Timeline constants (ms) — adjust speeds cleanly here
const TIMELINE = {
  hold: 800,
  travel: 2700,
  pulse: 700,
  out: 1700,
  textOffset: 800,
  popupDelay: 1000,
};

function easeInOutCubic(x: number): number {
  const clamped = Math.min(1, Math.max(0, x));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function GiftTrophyVectorSvg() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14 mx-auto" fill="none" aria-hidden="true">
      <rect
        x="10"
        y="26"
        width="44"
        height="28"
        rx="6"
        fill="url(#giftBoxBody)"
        stroke="#FFB458"
        strokeWidth="2.5"
      />
      <rect
        x="7"
        y="18"
        width="50"
        height="11"
        rx="4"
        fill="url(#giftLidBody)"
        stroke="#FFB458"
        strokeWidth="2.5"
      />
      <rect x="28" y="18" width="8" height="36" fill="#FFB458" />
      <path
        d="M32 18C26 18 19 15 19 10.5C19 7.5 22.5 6 25.5 7.5C29 9.2 31.5 14 32 18Z"
        fill="#FFB458"
      />
      <path
        d="M32 18C38 18 45 15 45 10.5C45 7.5 41.5 6 38.5 7.5C35 9.2 32.5 14 32 18Z"
        fill="#FFB458"
      />
      <defs>
        <linearGradient id="giftBoxBody" x1="10" y1="26" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7B208F" />
          <stop offset="1" stopColor="#C9349B" />
        </linearGradient>
        <linearGradient id="giftLidBody" x1="7" y1="18" x2="57" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F36A78" />
          <stop offset="1" stopColor="#FF9B55" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function KriminalBankVictorySequence({
  isOpen,
  onComplete,
}: KriminalBankVictorySequenceProps) {
  const camRef = useRef<SVGGElement | null>(null);
  const lineRef = useRef<SVGRectElement | null>(null);
  const darkRef = useRef<HTMLDivElement | null>(null);

  const [node2Lit, setNode2Lit] = useState(false);
  const [missionVisible, setMissionVisible] = useState(false);
  const [missionUp, setMissionUp] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setNode2Lit(false);
      setMissionVisible(false);
      setMissionUp(false);
      setPopupVisible(false);
      return;
    }

    setNode2Lit(false);
    setMissionVisible(false);
    setMissionUp(false);
    setPopupVisible(false);

    const t1 = TIMELINE.hold;
    const t2 = t1 + TIMELINE.travel;
    const t3 = t2 + TIMELINE.pulse;
    const t4 = t3 + TIMELINE.out;
    const tText = t3 + TIMELINE.textOffset;
    const tPop = t4 + TIMELINE.popupDelay;

    const flags = { travelSfx: false, lit: false, text: false, pop: false };
    const start = performance.now();
    let rafId = 0;

    const setCam = (cx: number, cy: number, z: number) => {
      if (!camRef.current) return;
      camRef.current.setAttribute(
        'transform',
        `translate(800,450) scale(${z}) translate(${-cx},${-cy})`
      );
    };

    if (lineRef.current) lineRef.current.setAttribute('width', '0');
    if (darkRef.current) darkRef.current.style.opacity = '0';
    setCam(330, 450, 1.7);

    const tick = (now: number) => {
      const t = now - start;
      let cx = 330;
      const cy = 450;
      let z = 1.7;

      if (t < t1) {
        // Hold on Node 1
      } else if (t < t2) {
        if (!flags.travelSfx) {
          flags.travelSfx = true;
          gtaAudio.playLineTravelSfx();
        }
        const p = easeInOutCubic((t - t1) / TIMELINE.travel);
        cx = lerp(330, 850, p);
        if (lineRef.current) lineRef.current.setAttribute('width', String(700 * p));
      } else {
        cx = 850;
        if (lineRef.current) lineRef.current.setAttribute('width', '700');
        if (!flags.lit) {
          flags.lit = true;
          setNode2Lit(true);
          gtaAudio.playNodeUnlockSfx();
        }
        if (t >= t3) {
          const q = easeInOutCubic((t - t3) / TIMELINE.out);
          z = lerp(1.7, 0.55, q);
          cx = lerp(850, 800, q);
          if (darkRef.current) darkRef.current.style.opacity = String(0.78 * q);
        }
      }

      setCam(cx, cy, z);

      if (t >= tText && !flags.text) {
        flags.text = true;
        setMissionVisible(true);
      }

      if (t >= tPop && !flags.pop) {
        flags.pop = true;
        setMissionUp(true);
        setPopupVisible(true);
        gtaAudio.playVictoryBgmAndPopupSfx();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="fixed inset-0 z-[95] overflow-hidden select-none"
          style={{
            background:
              'linear-gradient(180deg, #F36A78 0%, #F87572 35%, #FF9B55 70%, #FFB458 100%)',
            fontFamily: "'Bitter', Georgia, serif",
          }}
        >
          {/* Top-left stacked GTA-style Logo */}
          <div
            className="absolute left-[4vw] top-[4vh] z-[2] lowercase leading-[0.95] text-[#F36A78]"
            style={{
              fontFamily: "'Rubik Mono One', Impact, sans-serif",
              fontSize: 'clamp(18px, 4.2vw, 56px)',
              WebkitTextStroke: '0.28em #000',
              paintOrder: 'stroke fill',
            }}
          >
            grand
            <br />
            theft
            <br />
            bluefox
          </div>

          {/* Animated SVG Camera World */}
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <linearGradient
                id="vicLineGrad"
                gradientUnits="userSpaceOnUse"
                x1="150"
                x2="850"
                y1="0"
                y2="0"
              >
                <stop offset="0" stopColor="#F36A78" />
                <stop offset="1" stopColor="#7B208F" />
              </linearGradient>
              <linearGradient id="vicNodeGrad">
                <stop offset="0" stopColor="#7B208F" />
                <stop offset="1" stopColor="#F36A78" />
              </linearGradient>
              <filter id="vicGlow" x="-20%" y="-300%" width="140%" height="700%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g ref={camRef} transform="translate(800,450) scale(1.7) translate(-330,-450)">
              {/* Uncompleted gray line */}
              <rect
                x="150"
                y="445"
                width="1700"
                height="10"
                rx="5"
                fill="#5a4650"
                opacity="0.3"
              />
              {/* Lit traveling progress line */}
              <rect
                ref={lineRef}
                x="150"
                y="445"
                width="0"
                height="10"
                rx="5"
                fill="url(#vicLineGrad)"
                filter="url(#vicGlow)"
              />

              {/* Node 1 (Lit) */}
              <circle cx="150" cy="450" r="85" fill="url(#vicNodeGrad)" />
              <text
                x="150"
                y="490"
                textAnchor="middle"
                fontSize="130"
                fontWeight="800"
                fontFamily="Bitter, Georgia, serif"
                fill="#FF9B55"
              >
                1
              </text>
              <text
                x="150"
                y="640"
                textAnchor="middle"
                fontSize="64"
                fontWeight="800"
                fontFamily="Bitter, Georgia, serif"
                fill="#000"
              >
                Kriminal
              </text>
              <text
                x="150"
                y="715"
                textAnchor="middle"
                fontSize="64"
                fontWeight="800"
                fontFamily="Bitter, Georgia, serif"
                fill="#000"
              >
                bank
              </text>

              {/* Node 2 Locked State */}
              <circle cx="850" cy="450" r="85" fill="#5a4650" opacity="0.35" />
              <text
                x="850"
                y="490"
                textAnchor="middle"
                fontSize="130"
                fontWeight="800"
                fontFamily="Bitter, Georgia, serif"
                fill="#7a6a70"
                opacity="0.6"
              >
                2
              </text>

              {/* Node 2 Unlocked + Expanding Pulse */}
              <g
                style={{
                  opacity: node2Lit ? 1 : 0,
                  transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {node2Lit && (
                  <motion.circle
                    cx="850"
                    cy="450"
                    r="85"
                    fill="none"
                    stroke="#F36A78"
                    strokeWidth="8"
                    initial={{ scale: 1, opacity: 0.95 }}
                    animate={{ scale: 1.95, opacity: 0 }}
                    transition={{ duration: 1, repeat: 1, ease: 'easeOut' }}
                    style={{ transformOrigin: '850px 450px' }}
                  />
                )}
                <circle cx="850" cy="450" r="85" fill="url(#vicNodeGrad)" />
                <text
                  x="850"
                  y="490"
                  textAnchor="middle"
                  fontSize="130"
                  fontWeight="800"
                  fontFamily="Bitter, Georgia, serif"
                  fill="#FF9B55"
                >
                  2
                </text>
              </g>

              <text
                x="850"
                y="640"
                textAnchor="middle"
                fontSize="64"
                fontWeight="800"
                fontFamily="Bitter, Georgia, serif"
                fill="#000"
              >
                Escape from
              </text>
              <text
                x="850"
                y="715"
                textAnchor="middle"
                fontSize="64"
                fontWeight="800"
                fontFamily="Bitter, Georgia, serif"
                fill="#000"
              >
                prison
              </text>
            </g>
          </svg>

          {/* Smooth dark vignette */}
          <div
            ref={darkRef}
            className="absolute inset-0 bg-black pointer-events-none z-[3]"
            style={{ opacity: 0 }}
          />

          {/* Smooth MISSION 1 COMPLETE banner (glides upward smoothly using transform) */}
          <div
            className="absolute inset-0 flex items-center justify-center z-[4] pointer-events-none px-4"
            style={{
              opacity: missionVisible ? 1 : 0,
              transform: missionUp
                ? 'translateY(-24vh) scale(0.84)'
                : missionVisible
                ? 'translateY(0) scale(1)'
                : 'translateY(0) scale(1.4)',
              transition:
                'opacity 650ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
              fontFamily: "'Rubik Mono One', Impact, sans-serif",
              fontSize: 'clamp(24px, 6.2vw, 84px)',
              lineHeight: 1.04,
              color: '#FF9B55',
              textAlign: 'center',
              textShadow: '0 4px 0 #7B208F, 0 0 32px rgba(243, 106, 120, 0.65)',
            }}
          >
            <span>
              MISSION 1
              <br />
              COMPLETE
            </span>
          </div>

          {/* Smooth Vice-City Reward Popup replacing emoji + placeholder reward */}
          <div
            className="absolute left-1/2 top-[58%] w-[min(88vw,390px)] z-[5] rounded-3xl p-6 text-center border-2 border-[#FFB458]/80 shadow-[0_24px_64px_rgba(243,106,120,0.42)]"
            style={{
              background: 'linear-gradient(165deg, #2B1052 0%, #3B146B 52%, #591878 100%)',
              opacity: popupVisible ? 1 : 0,
              pointerEvents: popupVisible ? 'auto' : 'none',
              transform: popupVisible
                ? 'translate(-50%, -50%) scale(1)'
                : 'translate(-50%, -36%) scale(0.84)',
              transition:
                'opacity 500ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <motion.div
              animate={popupVisible ? { y: [0, -7, 0] } : undefined}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-2"
            >
              <GiftTrophyVectorSvg />
            </motion.div>

            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFB458]/15 border border-[#FFB458]/40 text-[#FFB458] text-[11px] font-extrabold tracking-widest uppercase">
              <Zap size={11} strokeWidth={2.6} />
              HADIAH MISI 1
            </span>

            <h2 className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
              GTA Limit 20% OFF
            </h2>
            <p className="mt-1 mb-5 text-sm text-white/80 font-sans leading-relaxed">
              Diskon 20% pemakaian limit AI selama 1 jam aktif & Node 2 terbuka.
            </p>

            <button
              type="button"
              onClick={onComplete}
              className="w-full min-h-[48px] rounded-full font-extrabold text-base text-[#111827] border-2 border-[#111827] flex items-center justify-center gap-2 shadow-lg transition-transform duration-150 hover:brightness-105 active:scale-95 cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, #F36A78 0%, #FF9B55 50%, #FFB458 100%)',
                fontFamily: "'Bitter', Georgia, serif",
              }}
            >
              <Check size={18} strokeWidth={2.8} />
              <span>KLAIM & OK</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
