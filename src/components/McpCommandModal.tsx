import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Mail, 
  HardDrive, 
  FileText, 
  Calendar, 
  Table, 
  Cpu, 
  Sparkles, 
  Terminal,
  CornerDownLeft,
  X,
  Radio,
  ShieldCheck
} from 'lucide-react';
import { McpToolCommand } from '../lib/mcpTools';
import { cn } from '../lib/utils';

interface McpCommandModalProps {
  isOpen: boolean;
  commands: McpToolCommand[];
  selectedIndex: number;
  onSelectCommand: (command: McpToolCommand) => void;
  onClose: () => void;
  query: string;
  isCallingEdge?: boolean;
}

const ICON_MAP: Record<string, any> = {
  Layers,
  Mail,
  HardDrive,
  FileText,
  Calendar,
  Table,
  Cpu
};

export function McpCommandModal({
  isOpen,
  commands,
  selectedIndex,
  onSelectCommand,
  onClose,
  query,
  isCallingEdge
}: McpCommandModalProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll item terpilih ke view
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
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-full left-0 right-0 mb-2.5 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-xl border border-slate-200 dark:border-blue-500/25 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-[320px] flex flex-col text-slate-900 dark:text-slate-100 max-w-lg mx-auto sm:max-w-none"
        style={{
          boxShadow: '0 16px 36px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)'
        }}
      >
        {/* Header Bar Kecil & Elegan */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <Terminal size={12} />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight text-[11px] sm:text-xs truncate">
              Google Workspace & MCP
            </span>
            {query && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800 font-mono text-[10px] font-semibold shrink-0">
                {query}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Badge Admin */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
              <ShieldCheck size={11} className="text-amber-500" />
              <span>Admin</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* List Perintah MCP */}
        <div 
          ref={listRef} 
          className="overflow-y-auto max-h-[240px] divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5 scrollbar-thin"
        >
          {commands.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Tidak ada perintah MCP yang cocok dengan &quot;{query}&quot;
            </div>
          ) : (
            commands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComponent = ICON_MAP[cmd.icon] || Sparkles;

              return (
                <div
                  key={cmd.id}
                  onClick={() => onSelectCommand(cmd)}
                  className={cn(
                    "flex items-start gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors select-none text-left",
                    isSelected 
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 shadow-2xs" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-lg shrink-0 mt-0.5 transition-colors",
                    isSelected 
                      ? "bg-blue-600 text-white" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  )}>
                    <IconComponent size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {cmd.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                        {cmd.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {cmd.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="shrink-0 flex items-center gap-1 text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 mt-1">
                      <span>Pilih</span>
                      <CornerDownLeft size={11} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info Singkat */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Gunakan &uarr;&darr; untuk memilih, Enter untuk menerapkan</span>
          <span className="text-amber-600/90 dark:text-amber-400/90 font-semibold">Khusus Badge Admin</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
