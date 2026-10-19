import React, { useState, useEffect } from 'react';
import { 
  X, UserPlus, Sparkles, Check, Trash2, ArrowRight, 
  ShieldCheck, Loader2, Users, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserGradientAvatar } from './UserGradientAvatar';
import { 
  SavedAccount, 
  getSavedAccounts, 
  removeSavedAccount, 
  getOrCreateDeviceId,
  syncDeviceAccountsFromServer 
} from '../lib/accountManager';
import { useLanguage } from '../lib/i18n';

interface ChooseAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentTier?: string;
  onSwitchAccount: (account: SavedAccount) => Promise<void>;
  onAddAccount: () => void;
  onCreateAccount: () => void;
}

export function ChooseAccountModal({
  isOpen,
  onClose,
  currentUser,
  currentTier = 'free',
  onSwitchAccount,
  onAddAccount,
  onCreateAccount,
}: ChooseAccountModalProps) {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  // Load saved accounts dari localStorage saat modal terbuka & sinkronkan dari server
  useEffect(() => {
    if (isOpen) {
      const currentDevId = getOrCreateDeviceId();
      setDeviceId(currentDevId);

      const list = getSavedAccounts(currentUser, currentTier);
      setAccounts(list);

      // Sinkronkan akun tambahan yang mungkin terhubung dengan device_id ini
      syncDeviceAccountsFromServer().then(synced => {
        if (synced && synced.length > 0) {
          setAccounts(synced);
        }
      });
    }
  }, [isOpen, currentUser, currentTier]);

  if (!isOpen) return null;

  const handleSelectAccount = async (acc: SavedAccount) => {
    if (acc.id === currentUser?.id) {
      onClose();
      return;
    }

    try {
      setSwitchingId(acc.id);
      await onSwitchAccount(acc);
      onClose();
    } catch (err) {
      console.error('Error switching account:', err);
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDeleteAccount = (e: React.MouseEvent, accId: string) => {
    e.stopPropagation();
    const updated = removeSavedAccount(accId);
    setAccounts(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
      {/* Backdrop Gelap */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
      />

      {/* Sheet dari Bawah Setengah Layar (Bottom Sheet) */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden"
      >
        {/* Drag Handle Top Indicator */}
        <div className="pt-3 pb-1 flex justify-center cursor-grab">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isId ? 'Pilih Akun' : 'Choose Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {accounts.length} {isId ? 'akun terdeteksi di perangkat ini' : 'accounts on this device'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* List Akun yang Ada di HP / Perangkat (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {accounts.map((acc) => {
            const isActive = acc.id === currentUser?.id || acc.email === currentUser?.email;
            const isSwitching = switchingId === acc.id;

            return (
              <div
                key={acc.id}
                onClick={() => handleSelectAccount(acc)}
                className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-blue-500/60 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500/50 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <UserGradientAvatar
                    userId={acc.id}
                    email={acc.email}
                    name={acc.name}
                    size="md"
                    className="w-11 h-11 rounded-xl shrink-0"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {acc.name || acc.email?.split('@')[0] || 'TMPA User'}
                      </span>
                      {acc.tier && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 shrink-0">
                          {acc.tier}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {acc.email}
                    </span>

                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      ID: {acc.id?.slice(0, 8)}...{acc.id?.slice(-4)}
                    </span>
                  </div>
                </div>

                {/* Status Indicator / Actions */}
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isSwitching ? (
                    <Loader2 size={18} className="text-blue-600 animate-spin" />
                  ) : isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                      <Check size={13} className="stroke-[3]" />
                      <span>{isId ? 'Aktif' : 'Active'}</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 group-hover:text-blue-600 font-medium hidden sm:inline">
                        {isId ? 'Pindah' : 'Switch'}
                      </span>
                      <ArrowRight size={15} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />

                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAccount(e, acc.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-1"
                          title={isId ? 'Hapus akun dari perangkat' : 'Remove from device'}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bagian Bawah: Tambah Akun atau Buat Akun Baru */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-2">
          {/* Tombol 1: Tambah Account */}
          <button
            onClick={() => {
              onClose();
              onAddAccount();
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm"
          >
            <UserPlus size={16} />
            <span>{isId ? 'Tambah Akun' : 'Add Account'}</span>
          </button>

          {/* Tombol 2: Buat Akun Baru (Created Account) */}
          <button
            onClick={() => {
              onClose();
              onCreateAccount();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
          >
            <Sparkles size={15} className="text-amber-500" />
            <span>{isId ? 'Buat Akun Baru (Created Account)' : 'Create New Account'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default ChooseAccountModal;
