import { X, Layers, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Connector } from '../types';
import { useState } from 'react';
import { isUserAdmin } from '../lib/accountManager';

interface ConnectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
  onAddConnector: (id: string, apiKey: string) => void;
  onOpenIntegrations?: () => void;
  user?: any;
}

export function ConnectorsModal({ isOpen, onClose, connectors, onToggleConnector, onAddConnector, onOpenIntegrations, user }: ConnectorsModalProps) {
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-900"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">App Connectors & Integrasi</h2>
            <p className="text-sm text-slate-500 mt-1">Hubungkan aplikasi dan website untuk memberikan akses data kepada AI.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {onOpenIntegrations && (
          <div className="px-6 pt-4 pb-1">
            <button
              onClick={() => {
                onClose();
                onOpenIntegrations();
              }}
              className="w-full p-4 rounded-2xl bg-blue-50/70 border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-between group cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Layers size={20} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      Integrasi Platform MCP TMPA (11 Layanan)
                    </h4>
                    {isUserAdmin(user) ? (
                      <span className="text-[10px] font-bold uppercase bg-amber-500/15 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-2xs">
                        <ShieldCheck size={11} className="text-amber-600" />
                        Akses Admin
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-mono">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {isUserAdmin(user)
                      ? 'Akses penuh ke ekosistem 11 platform integrasi MCP untuk Administrator.'
                      : 'Supabase, Google Workspace, GitHub, Vercel, Figma, Airtable, Make, dll.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold hidden sm:inline ${isUserAdmin(user) ? 'text-blue-600 font-bold' : 'text-amber-600'}`}>
                  {isUserAdmin(user) ? 'Buka MCP' : 'Coming Soon'}
                </span>
                <ArrowRight size={18} className="text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {connectors.map(connector => (
            <div key={connector.id} className="flex flex-col p-4 rounded-2xl border border-slate-200 bg-white group hover:border-slate-300 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base font-bold text-slate-700">
                    {connector.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{connector.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{connector.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connector.isConfigured ? (
                    <button
                      onClick={() => onToggleConnector(connector.id)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                        connector.isActive ? "bg-blue-600" : "bg-slate-200"
                      )}
                    >
                      <span 
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs",
                          connector.isActive ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  ) : (
                    <span className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 select-none">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

