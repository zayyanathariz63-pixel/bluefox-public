import { X, Search, Plus, Power, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Connector } from '../types';
import { useState } from 'react';

interface ConnectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
  onAddConnector: (id: string, apiKey: string) => void;
}

export function ConnectorsModal({ isOpen, onClose, connectors, onToggleConnector, onAddConnector }: ConnectorsModalProps) {
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">App Connectors</h2>
            <p className="text-sm text-gray-400 mt-1">Hubungkan aplikasi dan website untuk memberikan akses data kepada AI.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {connectors.map(connector => (
            <div key={connector.id} className="flex flex-col p-4 rounded-xl border border-gray-800 bg-[#0d1117] group hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
                    {connector.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-200">{connector.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{connector.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connector.isConfigured ? (
                    <button
                      onClick={() => onToggleConnector(connector.id)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        connector.isActive ? "bg-blue-600" : "bg-gray-700"
                      )}
                    >
                      <span 
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          connector.isActive ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  ) : (
                    <span className="flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/80 text-gray-400 border border-gray-700/50 select-none">
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
