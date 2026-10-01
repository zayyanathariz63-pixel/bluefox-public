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
  X,
  Image as ImageIcon,
  Video
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
  Palette,
  Image: ImageIcon,
  Video
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
        className="absolute bottom-full left-0 right-0 mb-3 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-[380px] flex flex-col text-slate-900"
        style={{
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)'
        }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
              <Terminal size={13} />
            </div>
            <span className="font-semibold text-slate-800 tracking-wide">
              Trigger Command System
            </span>
            {query && query !== '@' && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 font-mono text-[11px] font-semibold">
                {query}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              {commands.length} perintah tersedia
            </span>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
              title="Tutup Menu"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Command List Container */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-slate-200"
        >
          {commands.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Tidak ada trigger command yang cocok dengan "{query}"
            </div>
          ) : (
            commands.map((cmd, index) => {
              const IconComponent = ICON_MAP[cmd.iconName] || Terminal;
              const isSelected = index === selectedIndex;

              // Color style depending on category
              const categoryBadgeColor = 
                cmd.category === 'ai'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : cmd.category === 'system'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';

              const iconBgColor =
                cmd.category === 'ai'
                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                  : cmd.category === 'system'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200';

              return (
                <div
                  key={cmd.id}
                  onClick={() => onSelectCommand(cmd)}
                  onMouseEnter={() => {}}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all text-left group select-none",
                    isSelected 
                      ? "bg-blue-50/90 border border-blue-300 text-slate-900 shadow-sm" 
                      : "hover:bg-slate-50 border border-transparent text-slate-700 hover:text-slate-900"
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
                        isSelected ? "text-blue-700 font-bold" : "text-slate-900"
                      )}>
                        {cmd.name}
                      </span>
                      
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md border font-semibold",
                        categoryBadgeColor
                      )}>
                        {cmd.badge}
                      </span>

                      <span className="text-[10px] text-slate-500 font-sans ml-auto hidden sm:inline">
                        {cmd.categoryLabel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-1 leading-relaxed">
                      {cmd.description}
                    </p>

                    {isSelected && (
                      <div className="mt-1.5 pt-1.5 border-t border-blue-200/80 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                        <span className="text-slate-600 truncate">
                          Contoh: <span className="text-blue-700 font-medium">{cmd.example}</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 text-[10px] ml-2 flex-shrink-0">
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
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] shadow-xs">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] shadow-xs">↓</kbd> Navigasi</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] shadow-xs">Enter</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] shadow-xs">Tab</kbd> Pilih</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] shadow-xs">Esc</kbd> Tutup</span>
          </div>
          <span className="text-slate-500 font-mono text-[10px] hidden md:inline font-medium">
            TMPA Command Router
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
