import React from 'react';
import { cn } from '../lib/utils';

interface UserGradientAvatarProps {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showPattern?: boolean;
}

// 12 Palet Warna Gradien Berbeda & Unik
const PALETTES = [
  { from: '#3b82f6', via: '#8b5cf6', to: '#ec4899', name: 'Cosmic Nebula' },
  { from: '#06b6d4', via: '#10b981', to: '#3b82f6', name: 'Cyber Emerald' },
  { from: '#f97316', via: '#ef4444', to: '#8b5cf6', name: 'Solar Sunset' },
  { from: '#8b5cf6', via: '#d946ef', to: '#06b6d4', name: 'Neon Dream' },
  { from: '#10b981', via: '#059669', to: '#047857', name: 'Deep Mint' },
  { from: '#6366f1', via: '#3b82f6', to: '#0284c7', name: 'Electric Ocean' },
  { from: '#eab308', via: '#f97316', to: '#dc2626', name: 'Amber Inferno' },
  { from: '#ec4899', via: '#f43f5e', to: '#fb923c', name: 'Coral Flare' },
  { from: '#0284c7', via: '#0d9488', to: '#16a34a', name: 'Teal Aurora' },
  { from: '#7c3aed', via: '#9333ea', to: '#4f46e5', name: 'Amethyst Mystic' },
  { from: '#14b8a6', via: '#06b6d4', to: '#2563eb', name: 'Borealis' },
  { from: '#f43f5e', via: '#be185d', to: '#6b21a8', name: 'Berry Velvet' },
];

// Helper string hash sederhana deterministik
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function UserGradientAvatar({
  userId,
  email,
  name,
  size = 'md',
  className,
  showPattern = true,
}: UserGradientAvatarProps) {
  const seed = userId || email || name || 'default-tmpa-user';
  const hash = hashString(seed);

  // Pilih palet warna berdasarkan hash
  const paletteIndex = hash % PALETTES.length;
  const palette = PALETTES[paletteIndex];

  // Sudut gradien bervariasi (45, 90, 135, 180, 225, 270, 315)
  const angle = (hash % 8) * 45;

  // Pola visual unik (0: cincin geometris, 1: grid heksagon, 2: diagonal waves, 3: concentric circles)
  const patternType = (hash >> 3) % 4;

  // Ambil inisial nama atau email
  const initial = (name || email || 'U').charAt(0).toUpperCase();

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-12 h-12 text-base rounded-2xl',
    xl: 'w-16 h-16 text-xl rounded-2xl',
  }[size];

  const backgroundStyle = {
    background: `linear-gradient(${angle}deg, ${palette.from}, ${palette.via}, ${palette.to})`,
  };

  return (
    <div
      style={backgroundStyle}
      className={cn(
        'relative shrink-0 flex items-center justify-center font-bold text-white shadow-sm overflow-hidden select-none border border-white/20',
        sizeClasses,
        className
      )}
      title={email || userId || 'User Avatar'}
    >
      {/* Pola Geometris Abstrak Varian Dinamis */}
      {showPattern && (
        <svg
          className="absolute inset-0 w-full h-full opacity-25 mix-blend-overlay pointer-events-none"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {patternType === 0 && (
            <>
              <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2" strokeDasharray="3 3" />
              <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="1.5" />
              <line x1="0" y1="20" x2="40" y2="20" stroke="white" strokeWidth="1" opacity="0.6" />
            </>
          )}
          {patternType === 1 && (
            <>
              <rect x="6" y="6" width="28" height="28" rx="6" stroke="white" strokeWidth="1.5" />
              <path d="M6 20L34 20M20 6L20 34" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
            </>
          )}
          {patternType === 2 && (
            <>
              <path d="M-5 10Q10 0 25 10T55 10" stroke="white" strokeWidth="2" />
              <path d="M-5 25Q10 15 25 25T55 25" stroke="white" strokeWidth="2" />
              <path d="M-5 40Q10 30 25 40T55 40" stroke="white" strokeWidth="2" />
            </>
          )}
          {patternType === 3 && (
            <>
              <polygon points="20,4 36,34 4,34" stroke="white" strokeWidth="1.5" />
              <circle cx="20" cy="24" r="5" fill="white" opacity="0.4" />
            </>
          )}
        </svg>
      )}

      {/* Inisial Teks di Atas Gradient */}
      <span className="relative z-10 drop-shadow-xs tracking-wider">
        {initial}
      </span>
    </div>
  );
}
