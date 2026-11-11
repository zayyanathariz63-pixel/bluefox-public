import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Maximize2, Download, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageGenerationCardProps {
  isGenerating?: boolean;
  imageUrl?: string;
  prompt: string;
  onOpenMediaScreen?: (media: any) => void;
}

export function ImageGenerationCard({
  isGenerating = false,
  imageUrl,
  prompt,
  onOpenMediaScreen
}: ImageGenerationCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const safeName = (prompt || 'bluefox-image')
        .slice(0, 30)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      a.download = `${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="w-full max-w-[340px] sm:max-w-[400px] my-2 select-none">
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-300/80 dark:border-slate-700/80 shadow-md group bg-slate-100 dark:bg-slate-900">
        
        {/* 1. LOADING STATE: PERSEGI GRADIENT ABU-ABU YANG BERGANTI WARNANYA SECARA HALUS */}
        {isGenerating && (
          <div className="absolute inset-0 z-10 overflow-hidden">
            {/* Animasi Gradient Abu-abu yang Berganti Warna Halus (Light Mode) */}
            <motion.div 
              className="absolute inset-0"
              animate={{
                background: [
                  'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)',
                  'linear-gradient(225deg, #cbd5e1 0%, #94a3b8 50%, #e2e8f0 100%)',
                  'linear-gradient(315deg, #94a3b8 0%, #e2e8f0 50%, #cbd5e1 100%)',
                  'linear-gradient(45deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)'
                ]
              }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
            />

            {/* Dark Mode Overlay Gradient Shifter */}
            <motion.div 
              className="absolute inset-0 dark:block hidden"
              animate={{
                background: [
                  'linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)',
                  'linear-gradient(225deg, #334155 0%, #0f172a 50%, #1e293b 100%)',
                  'linear-gradient(315deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
                  'linear-gradient(45deg, #1e293b 0%, #334155 50%, #0f172a 100%)'
                ]
              }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
            />

            {/* Subtle Shimmer Wave */}
            <motion.div 
              className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-[1px]"
              animate={{
                opacity: [0.3, 0.7, 0.3]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </div>
        )}

        {/* 2. HASIL GAMBAR: PERALIHAN SMOOTH SAAT GAMBAR SELESAI */}
        {imageUrl && (
          <div 
            onClick={() => onOpenMediaScreen && onOpenMediaScreen({ url: imageUrl, type: 'image', name: prompt })}
            className={cn(
              "relative w-full h-full cursor-pointer overflow-hidden transition-all duration-700 ease-out",
              isGenerating ? "opacity-0 scale-95" : "opacity-100 scale-100"
            )}
          >
            <motion.img
              src={imageUrl}
              alt={prompt}
              data-ai-generated="true"
              data-generator="Bluefox AI"
              data-prompt={prompt}
              onLoad={() => setIsLoaded(true)}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: isLoaded ? 1 : 0.4, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-500"
            />

            {/* AI Generated Metadata Badge (Memastikan Gambar Dikenali Sebagai Buatan AI) */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-white text-[10px] font-semibold border border-white/20 shadow-xs z-10 pointer-events-none select-none">
              <Sparkles size={11} className="text-cyan-400" />
              <span>AI Generated</span>
            </div>

            {/* Gradient Dark Overlay on Hover for Action Buttons */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3.5" />

            {/* Top Hover Actions */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white backdrop-blur-md transition-all shadow-md cursor-pointer active:scale-90"
                title="Salin Link Gambar"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white backdrop-blur-md transition-all shadow-md cursor-pointer active:scale-90"
                title="Unduh Gambar"
              >
                <Download size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenMediaScreen) onOpenMediaScreen({ url: imageUrl, type: 'image', name: prompt });
                }}
                className="p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white backdrop-blur-md transition-all shadow-md cursor-pointer active:scale-90"
                title="Layar Penuh"
              >
                <Maximize2 size={14} />
              </button>
            </div>

            {/* Bottom Caption on Hover */}
            <div className="absolute bottom-0 inset-x-0 p-3.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <p className="text-xs text-white font-medium line-clamp-2 drop-shadow-sm">
                {prompt}
              </p>
              <span className="text-[10px] text-slate-300 font-mono mt-0.5 inline-block">
                Klik untuk memperbesar layar penuh
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
