import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ShieldCheck, 
  BrainCircuit, 
  BookmarkCheck, 
  UserCheck, 
  Activity, 
  Gauge, 
  Sliders, 
  Download, 
  Pin, 
  Trash2, 
  Palette,
  Terminal,
  CornerDownLeft,
  X
} from 'lucide-react';
import { TriggerCommand } from '../lib/commands';
import { cn } from '../lib/utils';

interface TriggerCommandModalProps {
  isOpen: boolean;
  commands: TriggerCommand[];
  selectedIndex: number;
  onSelectCommand: (command: TriggerCommand) => void;
  onClose: () => void;
  query: string;
}

const ICON_MAP: Record<string, any> = {
  ShieldCheck,
  BrainCircuit,
  Sparkles,
  BookmarkCheck,
  UserCheck,
  Activity,
  Gauge,
  Sliders,
  Download,
  Pin,
  Trash2,
  Palette
};

export function TriggerCommandModal({
  isOpen,
  commands,
  selectedIndex,
  onSelectCommand,
  onClose,
  query
}: TriggerCommandModalProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="absolute bottom-full left-0 right-0 mb-3 bg-[#0a0a0d]/95 backdrop-blur-xl border border-neutral-800/90 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-[380px] flex flex-col text-white"
        style={{
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)'
        }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/80 border-b border-neutral-800/80 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Terminal size={13} />
            </div>
            <span className="font-semibold text-gray-200 tracking-wide">
              Trigger Command System
            </span>
            {query && query !== '@' && (
              <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-blue-400 font-mono text-[11px]">
                {query}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 hidden sm:inline">
              {commands.length} perintah tersedia
            </span>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
              title="Tutup Menu"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Command List Container */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-neutral-800"
        >
          {commands.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Tidak ada trigger command yang cocok dengan "{query}"
            </div>
          ) : (
            commands.map((cmd, index) => {
              const IconComponent = ICON_MAP[cmd.iconName] || Terminal;
              const isSelected = index === selectedIndex;

              // Color style depending on category
              const categoryBadgeColor = 
                cmd.category === 'ai'
                  ? 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                  : cmd.category === 'system'
                  ? 'bg-blue-950/60 text-blue-300 border-blue-800/50'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50';

              const iconBgColor =
                cmd.category === 'ai'
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                  : cmd.category === 'system'
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';

              return (
                <div
                  key={cmd.id}
                  onClick={() => onSelectCommand(cmd)}
                  onMouseEnter={() => {}}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all text-left group select-none",
                    isSelected 
                      ? "bg-neutral-800/90 border border-blue-500/40 text-white shadow-md shadow-black/40" 
                      : "hover:bg-neutral-900/60 border border-transparent text-gray-300 hover:text-white"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "p-2 rounded-xl border flex-shrink-0 mt-0.5 transition-transform",
                    iconBgColor,
                    isSelected && "scale-105"
                  )}>
                    <IconComponent size={16} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "font-mono font-semibold text-[13px]",
                        isSelected ? "text-blue-300" : "text-gray-100"
                      )}>
                        {cmd.name}
                      </span>
                      
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md border font-medium",
                        categoryBadgeColor
                      )}>
                        {cmd.badge}
                      </span>

                      <span className="text-[10px] text-gray-500 font-sans ml-auto hidden sm:inline">
                        {cmd.categoryLabel}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1 line-clamp-1 leading-relaxed">
                      {cmd.description}
                    </p>

                    {isSelected && (
                      <div className="mt-1.5 pt-1.5 border-t border-neutral-700/60 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                        <span className="text-gray-400 truncate">
                          Contoh: <span className="text-blue-300">{cmd.example}</span>
                        </span>
                        <span className="flex items-center gap-1 text-gray-500 text-[10px] ml-2 flex-shrink-0">
                          <CornerDownLeft size={10} /> Enter untuk pilih
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-900 flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 text-[10px]">↓</kbd> Navigasi</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 text-[10px]">Enter</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 text-[10px]">Tab</kbd> Pilih</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 text-[10px]">Esc</kbd> Tutup</span>
          </div>
          <span className="text-gray-500 font-mono text-[10px] hidden md:inline">
            TMPA Command Router
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
