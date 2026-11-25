import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Zap, ShieldCheck } from 'lucide-react';
import { gtaAudio } from '../lib/gtaAudio';

interface CheaterVictorySequenceProps {
  isOpen: boolean;
  onComplete: () => void;
}

type VictoryPhase = 'cutscene' | 'blackout_load' | 'bar_anim';

const BAR_TIMELINE = {
  hold: 600,
  travel: 2300,
  pulse: 650,
  out: 1500,
  textOffset: 750,
  popupDelay: 850,
};

function easeInOutCubic(x: number): number {
  const clamped = Math.min(1, Math.max(0, x));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function easeInCubic(x: number): number {
  const clamped = Math.min(1, Math.max(0, x));
  return clamped * clamped * clamped;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function CheaterVictorySequence({
  isOpen,
  onComplete,
}: CheaterVictorySequenceProps) {
  const [phase, setPhase] = useState<VictoryPhase>('cutscene');

  // Phase 1: Cutscene refs & smile progress
  const cutsceneCamRef = useRef<SVGGElement | null>(null);
  const [smileAmt, setSmileAmt] = useState<number>(0);

  // Phase 2: Blackout loader progress (0 -> 100)
  const [loadPct, setLoadPct] = useState<number>(0);

  // Phase 3: Standard Mission Complete Bar Animation
  const camRef = useRef<SVGGElement | null>(null);
  const line3Ref = useRef<SVGRectElement | null>(null);
  const darkRef = useRef<HTMLDivElement | null>(null);

  const [rewardLit, setRewardLit] = useState(false);
  const [missionVisible, setMissionVisible] = useState(false);
  const [missionUp, setMissionUp] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  // Reset all states when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setPhase('cutscene');
      setSmileAmt(0);
      setLoadPct(0);
      setRewardLit(false);
      setMissionVisible(false);
      setMissionUp(false);
      setPopupVisible(false);
      return;
    }

    setPhase('cutscene');
    setSmileAmt(0);
    setLoadPct(0);
    setRewardLit(false);
    setMissionVisible(false);
    setMissionUp(false);
    setPopupVisible(false);
  }, [isOpen]);

  // Phase 1: Camera pulls out from laptop -> Bluefox face -> Evil smile + Zoom in + Riser SFX
  useEffect(() => {
    if (!isOpen || phase !== 'cutscene') return;

    const pullOutMs = 1550;
    const smileZoomMs = 2600;
    const totalCutsceneMs = pullOutMs + smileZoomMs;
    const start = performance.now();
    let riserStarted = false;
    let rafId = 0;

    const setCutCam = (cx: number, cy: number, z: number) => {
      if (!cutsceneCamRef.current) return;
      cutsceneCamRef.current.setAttribute(
        'transform',
        `translate(480,270) scale(${z}) translate(${-cx},${-cy})`
      );
    };

    // Start tightly zoomed into the laptop screen at bottom center (480, 392)
    setCutCam(480, 392, 2.45);

    const tick = (now: number) => {
      const elapsed = now - start;

      if (elapsed < pullOutMs) {
        const p = easeInOutCubic(elapsed / pullOutMs);
        const cx = 480;
        const cy = lerp(392, 250, p);
        const z = lerp(2.45, 1.0, p);
        setCutCam(cx, cy, z);
        setSmileAmt(0);
      } else if (elapsed < totalCutsceneMs) {
        if (!riserStarted) {
          riserStarted = true;
          gtaAudio.playEvilRiserSfx();
        }
        const q = (elapsed - pullOutMs) / smileZoomMs;
        const zoomProgress = easeInCubic(q);
        const smileProgress = easeInOutCubic(Math.min(1, q * 1.15));

        const cx = 480;
        const cy = lerp(250, 206, zoomProgress);
        const z = lerp(1.0, 2.25, zoomProgress);
        setCutCam(cx, cy, z);
        setSmileAmt(smileProgress);
      } else {
        setSmileAmt(1);
        setPhase('blackout_load');
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, phase]);

  // Phase 2: Instant Black Screen + Loading Bar 0% -> 100%
  useEffect(() => {
    if (!isOpen || phase !== 'blackout_load') return;

    const loadDuration = 1650;
    const start = performance.now();
    let rafId = 0;
    let doneTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / loadDuration);
      const pct = Math.min(100, Math.round(easeInOutCubic(p) * 100));
      setLoadPct(pct);
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setLoadPct(100);
        doneTimer = setTimeout(() => {
          setPhase('bar_anim');
        }, 220);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [isOpen, phase]);

  // Phase 3: Standard Mission 3 Complete Moving Bar Animation
  useEffect(() => {
    if (!isOpen || phase !== 'bar_anim') return;

    const t1 = BAR_TIMELINE.hold;
    const t2 = t1 + BAR_TIMELINE.travel;
    const t3 = t2 + BAR_TIMELINE.pulse;
    const t4 = t3 + BAR_TIMELINE.out;
    const tText = t3 + BAR_TIMELINE.textOffset;
    const tPop = t4 + BAR_TIMELINE.popupDelay;

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

    if (line3Ref.current) line3Ref.current.setAttribute('width', '0');
    if (darkRef.current) darkRef.current.style.opacity = '0';
    setCam(1550, 450, 1.65);

    const tick = (now: number) => {
      const t = now - start;
      let cx = 1550;
      const cy = 450;
      let z = 1.65;

      if (t >= t1 && t < t2) {
        if (!flags.travelSfx) {
          flags.travelSfx = true;
          gtaAudio.playLineTravelSfx();
        }
        const p = easeInOutCubic((t - t1) / BAR_TIMELINE.travel);
        cx = lerp(1550, 2120, p);
        if (line3Ref.current) line3Ref.current.setAttribute('width', String(570 * p));
      } else if (t >= t2) {
        cx = 2120;
        if (line3Ref.current) line3Ref.current.setAttribute('width', '570');
        if (!flags.lit) {
          flags.lit = true;
          setRewardLit(true);
          gtaAudio.playNodeUnlockSfx();
        }
        if (t >= t3) {
          const q = easeInOutCubic((t - t3) / BAR_TIMELINE.out);
          z = lerp(1.65, 0.56, q);
          cx = lerp(2120, 1180, q);
          if (darkRef.current) darkRef.current.style.opacity = String(0.8 * q);
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
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, phase]);

  // Smile mouth SVG path interpolator (neutral -> evil smirk)
  const cornerRaise = lerp(0, 14, smileAmt);
  const curveDrop = lerp(0, 16, smileAmt);
  const eyeSquint = lerp(0, 6.5, smileAmt);
  const mouthPath = `M ${446 - smileAmt * 6} ${244 - cornerRaise * 0.45} Q 480 ${
    244 + curveDrop
  } ${514 + smileAmt * 6} ${244 - cornerRaise}`;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9500] overflow-hidden select-none bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Mission 3 Complete"
        >
          {/* PHASE 1: Laptop pull-out -> Bluefox face -> Evil Smile + Zoom-in + Riser */}
          {phase === 'cutscene' && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background:
                  'radial-gradient(circle at 50% 58%, #3B146B 0%, #17082C 55%, #07030F 100%)',
              }}
            >
              <svg
                viewBox="0 0 960 540"
                preserveAspectRatio="xMidYMid slice"
                className="w-full h-full"
              >
                <defs>
                  <radialGradient id="bfMonitorGlow" cx="50%" cy="65%" r="55%">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
                    <stop offset="55%" stopColor="#C9349B" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#140826" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="bfFurGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="55%" stopColor="#1D4ED8" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                  <linearGradient id="bfCheekGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#E0F2FE" />
                    <stop offset="100%" stopColor="#93C5FD" />
                  </linearGradient>
                  <linearGradient id="bfHoodieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E1B4B" />
                    <stop offset="100%" stopColor="#09061A" />
                  </linearGradient>
                </defs>

                <g
                  ref={cutsceneCamRef}
                  transform="translate(480,270) scale(2.45) translate(-480,-392)"
                >
                  {/* Dark cyber room backdrop */}
                  <rect x="-200" y="-200" width="1360" height="940" fill="#0B0418" />
                  <circle cx="480" cy="300" r="340" fill="url(#bfMonitorGlow)" />

                  {/* Subtle background server grid lines */}
                  <g opacity="0.16" stroke="#C9349B" strokeWidth="1.5">
                    <line x1="120" y1="60" x2="120" y2="480" />
                    <line x1="840" y1="60" x2="840" y2="480" />
                    <line x1="60" y1="140" x2="900" y2="140" />
                    <line x1="60" y1="320" x2="900" y2="320" />
                  </g>

                  {/* Bluefox shoulders & dark cyber jacket */}
                  <path
                    d="M 275 465 Q 320 320 480 315 Q 640 320 685 465 Z"
                    fill="url(#bfHoodieGrad)"
                    stroke="#38BDF8"
                    strokeOpacity={0.25 + smileAmt * 0.4}
                    strokeWidth="2.5"
                  />
                  {/* Collar accents */}
                  <path
                    d="M 405 322 L 480 368 L 555 322"
                    fill="none"
                    stroke="#C9349B"
                    strokeWidth="4"
                  />

                  {/* Bluefox Head & Ears */}
                  <g>
                    {/* Left Ear */}
                    <polygon
                      points="385,172 356,70 442,126"
                      fill="url(#bfFurGrad)"
                      stroke="#0F172A"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    />
                    <polygon points="391,156 371,94 424,132" fill="#F36A78" opacity="0.82" />

                    {/* Right Ear */}
                    <polygon
                      points="575,172 604,70 518,126"
                      fill="url(#bfFurGrad)"
                      stroke="#0F172A"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    />
                    <polygon points="569,156 589,94 536,132" fill="#F36A78" opacity="0.82" />

                    {/* Head Base */}
                    <path
                      d="M 382 192 Q 382 114 480 114 Q 578 114 578 192 Q 592 232 548 260 Q 512 284 480 286 Q 448 284 412 260 Q 368 232 382 192 Z"
                      fill="url(#bfFurGrad)"
                      stroke="#090D1A"
                      strokeWidth="4.5"
                    />

                    {/* Cheek Fur Patches */}
                    <path
                      d="M 388 214 Q 424 218 448 242 Q 466 266 480 282 Q 440 278 410 256 Q 378 234 388 214 Z"
                      fill="url(#bfCheekGrad)"
                    />
                    <path
                      d="M 572 214 Q 536 218 512 242 Q 494 266 480 282 Q 520 278 550 256 Q 582 234 572 214 Z"
                      fill="url(#bfCheekGrad)"
                    />

                    {/* Glowing Eyes (narrowing menacingly during evil smile) */}
                    <g>
                      <ellipse
                        cx="438"
                        cy="192"
                        rx="19"
                        ry={Math.max(7, 14 - eyeSquint)}
                        fill="#0F172A"
                      />
                      <ellipse
                        cx="439"
                        cy="192"
                        rx="12"
                        ry={Math.max(4.5, 9 - eyeSquint * 0.6)}
                        fill={smileAmt > 0.3 ? '#FFB458' : '#38BDF8'}
                      />
                      <circle cx="443" cy="189" r="3" fill="#FFFFFF" />

                      <ellipse
                        cx="522"
                        cy="192"
                        rx="19"
                        ry={Math.max(7, 14 - eyeSquint)}
                        fill="#0F172A"
                      />
                      <ellipse
                        cx="521"
                        cy="192"
                        rx="12"
                        ry={Math.max(4.5, 9 - eyeSquint * 0.6)}
                        fill={smileAmt > 0.3 ? '#FFB458' : '#38BDF8'}
                      />
                      <circle cx="525" cy="189" r="3" fill="#FFFFFF" />

                      {/* Sharp slanted brows */}
                      <path
                        d={`M 412 ${173 + smileAmt * 6} L 458 ${180 + smileAmt * 8}`}
                        stroke="#090D1A"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      <path
                        d={`M 548 ${173 + smileAmt * 6} L 502 ${180 + smileAmt * 8}`}
                        stroke="#090D1A"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    </g>

                    {/* Fox Nose */}
                    <polygon points="471,222 489,222 480,234" fill="#090D1A" />

                    {/* Mouth morphing into Evil Grin */}
                    <path
                      d={mouthPath}
                      fill="none"
                      stroke="#090D1A"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    {smileAmt > 0.45 && (
                      <path
                        d={`M 454 ${245 - cornerRaise * 0.25} Q 480 ${
                          244 + curveDrop * 0.88
                        } 508 ${245 - cornerRaise * 0.68}`}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={Math.min(3.5, (smileAmt - 0.45) * 6)}
                        strokeLinecap="round"
                        opacity={(smileAmt - 0.45) * 1.6}
                      />
                    )}
                  </g>

                  {/* Foreground Underground Laptop (screen facing camera/Bluefox) */}
                  <g transform="translate(0, 12)">
                    {/* Desk surface */}
                    <rect x="180" y="458" width="600" height="90" rx="8" fill="#120622" />
                    {/* Laptop Base */}
                    <polygon
                      points="310,458 650,458 690,482 270,482"
                      fill="#1E1B4B"
                      stroke="#7B208F"
                      strokeWidth="2.5"
                    />
                    {/* Laptop Lid & Screen */}
                    <rect
                      x="325"
                      y="318"
                      width="310"
                      height="142"
                      rx="10"
                      fill="#0B0719"
                      stroke="#C9349B"
                      strokeWidth="4"
                    />
                    <rect x="339" y="330" width="282" height="118" rx="5" fill="#091526" />
                    {/* Laptop Screen Readout */}
                    <text
                      x="480"
                      y="362"
                      textAnchor="middle"
                      fontSize="13"
                      fontFamily="monospace"
                      fontWeight="700"
                      fill="#38BDF8"
                    >
                      GTB_UNDERGROUND_OS // ROOT
                    </text>
                    <text
                      x="480"
                      y="395"
                      textAnchor="middle"
                      fontSize="24"
                      fontFamily="monospace"
                      fontWeight="900"
                      fill="#FFB458"
                    >
                      1.000 / 1.000
                    </text>
                    <rect x="372" y="410" width="216" height="10" rx="5" fill="#1E293B" />
                    <rect x="372" y="410" width="216" height="10" rx="5" fill="#10B981" />
                    <text
                      x="480"
                      y="436"
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="700"
                      fill="#34D399"
                    >
                      TARGET TERCAPAI · PAYLOAD AKTIF
                    </text>
                  </g>
                </g>
              </svg>
            </div>
          )}

          {/* PHASE 2: Sudden Pure Black Screen + Loading Bar 0% -> 100% */}
          {phase === 'blackout_load' && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center px-6">
              <div className="w-full max-w-md space-y-3">
                <div className="flex items-center justify-between text-xs font-mono font-bold tracking-wider">
                  <span className="text-white/80 uppercase">MEMUAT...</span>
                  <span className="text-[#FFB458] tabular-nums">{loadPct}%</span>
                </div>
                <div className="w-full h-3.5 rounded-full bg-white/10 border border-white/15 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-none"
                    style={{
                      width: `${loadPct}%`,
                      background:
                        'linear-gradient(90deg, #7B208F 0%, #C9349B 55%, #FFB458 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PHASE 3: Standard Mission 3 Complete Moving Bar Animation */}
          {phase === 'bar_anim' && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, #F36A78 0%, #F87572 35%, #FF9B55 70%, #FFB458 100%)',
                fontFamily: "'Bitter', Georgia, serif",
              }}
            >
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

              <svg
                viewBox="0 0 1600 900"
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient
                    id="m3GlPrev"
                    gradientUnits="userSpaceOnUse"
                    x1="150"
                    x2="1550"
                    y1="0"
                    y2="0"
                  >
                    <stop offset="0" stopColor="#7B208F" />
                    <stop offset="1" stopColor="#C9349B" />
                  </linearGradient>
                  <linearGradient id="m3NodeGrad">
                    <stop offset="0" stopColor="#7B208F" />
                    <stop offset="1" stopColor="#F36A78" />
                  </linearGradient>
                  <linearGradient
                    id="m3GlReward"
                    gradientUnits="userSpaceOnUse"
                    x1="1550"
                    x2="2120"
                    y1="0"
                    y2="0"
                  >
                    <stop offset="0" stopColor="#7B208F" />
                    <stop offset="50%" stopColor="#C9349B" />
                    <stop offset="100%" stopColor="#FFB458" />
                  </linearGradient>
                  <filter id="m3Glow" x="-20%" y="-300%" width="140%" height="700%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <g ref={camRef} transform="translate(800,450) scale(1.65) translate(-1550,-450)">
                  {/* Track background */}
                  <rect
                    x="150"
                    y="445"
                    width="1970"
                    height="10"
                    rx="5"
                    fill="#5a4650"
                    opacity="0.3"
                  />
                  {/* Segments 1 -> 2 -> 3 */}
                  <rect
                    x="150"
                    y="445"
                    width="1400"
                    height="10"
                    rx="5"
                    fill="url(#m3GlPrev)"
                    filter="url(#m3Glow)"
                  />
                  {/* Segment 3 -> Reward */}
                  <rect
                    ref={line3Ref}
                    x="1550"
                    y="445"
                    width="0"
                    height="10"
                    rx="5"
                    fill="url(#m3GlReward)"
                    filter="url(#m3Glow)"
                  />

                  {/* Node 1 */}
                  <circle cx="150" cy="450" r="85" fill="url(#m3NodeGrad)" />
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
                    fontSize="60"
                    fontWeight="800"
                    fontFamily="Bitter, Georgia, serif"
                    fill="#000"
                  >
                    Kriminal bank
                  </text>

                  {/* Node 2 */}
                  <circle cx="850" cy="450" r="85" fill="url(#m3NodeGrad)" />
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
                  <text
                    x="850"
                    y="640"
                    textAnchor="middle"
                    fontSize="60"
                    fontWeight="800"
                    fontFamily="Bitter, Georgia, serif"
                    fill="#000"
                  >
                    Escape prison
                  </text>

                  {/* Node 3 */}
                  <circle cx="1550" cy="450" r="85" fill="url(#m3NodeGrad)" />
                  <text
                    x="1550"
                    y="490"
                    textAnchor="middle"
                    fontSize="130"
                    fontWeight="800"
                    fontFamily="Bitter, Georgia, serif"
                    fill="#FF9B55"
                  >
                    3
                  </text>
                  <text
                    x="1550"
                    y="640"
                    textAnchor="middle"
                    fontSize="64"
                    fontWeight="800"
                    fontFamily="Bitter, Georgia, serif"
                    fill="#000"
                  >
                    cheater
                  </text>

                  {/* End Reward Node Locked */}
                  <circle cx="2120" cy="450" r="90" fill="#5a4650" opacity="0.35" />
                  <text
                    x="2120"
                    y="475"
                    textAnchor="middle"
                    fontSize="74"
                    fontWeight="800"
                    fontFamily="Bitter, Georgia, serif"
                    fill="#7a6a70"
                    opacity="0.7"
                  >
                    30%
                  </text>

                  {/* End Reward Node Lit */}
                  <g
                    style={{
                      opacity: rewardLit ? 1 : 0,
                      transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {rewardLit && (
                      <motion.circle
                        cx="2120"
                        cy="450"
                        r="90"
                        fill="none"
                        stroke="#FFB458"
                        strokeWidth="9"
                        initial={{ scale: 1, opacity: 0.95 }}
                        animate={{ scale: 1.95, opacity: 0 }}
                        transition={{ duration: 1, repeat: 1, ease: 'easeOut' }}
                        style={{ transformOrigin: '2120px 450px' }}
                      />
                    )}
                    <circle
                      cx="2120"
                      cy="450"
                      r="90"
                      fill="#3B146B"
                      stroke="#FFB458"
                      strokeWidth="8"
                    />
                    <text
                      x="2120"
                      y="475"
                      textAnchor="middle"
                      fontSize="74"
                      fontWeight="800"
                      fontFamily="Bitter, Georgia, serif"
                      fill="#FFB458"
                    >
                      30%
                    </text>
                  </g>
                  <text
                    x="2120"
                    y="640"
                    textAnchor="middle"
                    fontSize="58"
                    fontWeight="800"
                    fontFamily="Bitter, Georgia, serif"
                    fill="#000"
                  >
                    GTB Limit 30%
                  </text>
                </g>
              </svg>

              <div
                ref={darkRef}
                className="absolute inset-0 bg-black pointer-events-none z-[3]"
                style={{ opacity: 0 }}
              />

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
                  MISSION 3
                  <br />
                  COMPLETE
                </span>
              </div>

              <div
                className="absolute left-1/2 top-[58%] w-[min(88vw,395px)] z-[5] rounded-3xl p-6 text-center border-2 border-[#FFB458]/80 shadow-[0_24px_64px_rgba(243,106,120,0.42)]"
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
                  className="mb-2 flex justify-center"
                >
                  <div className="w-20 h-16 rounded-2xl bg-[#FFB458]/15 border border-[#FFB458]/50 flex items-center justify-center shadow-inner text-[#FFB458]">
                    <Zap size={34} strokeWidth={2.5} />
                  </div>
                </motion.div>

                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFB458]/15 border border-[#FFB458]/40 text-[#FFB458] text-[11px] font-extrabold tracking-widest uppercase">
                  <ShieldCheck size={12} strokeWidth={2.5} />
                  <span>HADIAH MISI 3</span>
                </span>

                <h2 className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
                  GTB Limit 30%
                </h2>
                <p className="mt-1 mb-5 text-sm text-white/80 font-sans leading-relaxed">
                  1.000 korban tercapai! Diskon pemakaian limit AI 30% OFF aktif di akun Bluefox
                  Anda.
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
                  <span>AKTIFKAN &amp; OK</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
