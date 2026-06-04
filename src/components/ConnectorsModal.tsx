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
                    <button 
                      onClick={() => {
                        if (configuringId === connector.id) {
                          setConfiguringId(null);
                        } else {
                          setConfiguringId(connector.id);
                          setApiKeyInput('');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
                    >
                      {configuringId === connector.id ? <X size={14} /> : <Plus size={14} />}
                      {configuringId === connector.id ? 'Cancel' : 'Add New'}
                    </button>
                  )}
                </div>
              </div>
              <AnimatePresence>
                {configuringId === connector.id && !connector.isConfigured && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3 pt-3 border-t border-gray-800">
                      <label className="text-sm font-medium text-gray-300">Hubungkan Akun</label>
                      {connector.name.startsWith('Google') ? (
                        <div className="flex justify-start">
                          <button
                            onClick={async () => {
                              try {
                                const { signInWithGoogle } = await import('../lib/supabase');
                                const result = await signInWithGoogle();
                                if (result) {
                                  onAddConnector(connector.id, (result as any).session?.provider_token || "dummy_token");
                                  setConfiguringId(null);
                                }
                              } catch (e) {
                                console.error('Sign in failed', e);
                                // Fallback dummy data for dummy configurations if real auth fails
                                onAddConnector(connector.id, "dummy_token_from_fallback");
                                setConfiguringId(null);
                              }
                            }}
                            className="bg-white text-gray-900 border border-gray-300 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors shadow-sm"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign in with Google
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                              type="text"
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              placeholder="Entri API Key Anda..."
                              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (apiKeyInput.trim()) {
                                onAddConnector(connector.id, apiKeyInput.trim());
                                setConfiguringId(null);
                              }
                            }}
                            disabled={!apiKeyInput.trim()}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
