import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Activity, Shield, Settings2, Link2, 
  Camera, Clock, Calendar, Globe, Sparkles, Check,
  Key, Plus, Trash2, Eye, EyeOff, Copy, AlertCircle, Layers, ExternalLink, RotateCcw,
  HardDrive, AlertTriangle, Image as ImageIcon, Video as VideoIcon, Loader2,
  Share2, GitFork, Pencil, Radio
} from 'lucide-react';
import { cn } from '../lib/utils';
import { IntegrationsPage } from './IntegrationsPage';
import { RemoteControlPage } from './RemoteControlPage';
import { useLanguage, Language } from '../lib/i18n';
import { supabase, getModelDisplayName, isLocalDevMode, setLocalDevMode } from '../lib/supabase';
import { processAndCompressImage } from '../lib/imageCompressor';
import { 
  getSharedChatsRegistry, 
  getUniqueSharedChatsList,
  updateSharedChatMode, 
  revokeSharedChat, 
  getDefaultShareMode, 
  setDefaultShareMode, 
  ShareMode,
  SharedChatRecord
} from '../lib/shareChat';
import { 
  getStorageUsageStats, 
  clearAllStoredMedia, 
  clearAllChatSessions, 
  deleteUserAccount,
  StorageUsageStats 
} from '../lib/storageManager';
import { UserGradientAvatar } from './UserGradientAvatar';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customInstruction: string;
  setCustomInstruction: (val: string) => void;
  chatSessions: any[];
  hourlyUsage: number;
  weeklyUsage: number;
  resetUsage: () => void;
  onClearAllMedia?: () => void;
  onClearAllSessions?: () => void;
  onDeleteAccount?: () => void;
  user?: any;
  userTier?: string;
  onOpenSession?: (sessionId: string) => void;
  onAddSession?: (session: { id: string; title: string }) => void;
  onDevModeChange?: (active: boolean) => void;
}

type SubView = 'menu' | 'account' | 'activity' | 'usage' | 'personalization' | 'connected_apps' | 'integrations' | 'language' | 'delete' | 'share_chat' | 'remote_control' | 'redeem';

export function SettingsModal({ 
  isOpen, 
  onClose, 
  customInstruction, 
  setCustomInstruction, 
  chatSessions, 
  hourlyUsage, 
  weeklyUsage, 
  resetUsage,
  onClearAllMedia,
  onClearAllSessions,
  onDeleteAccount,
  user,
  userTier,
  onOpenSession,
  onAddSession,
  onDevModeChange
}: SettingsModalProps) {
  const { lang, changeLanguage, t } = useLanguage();
  const [currentView, setCurrentView] = useState<SubView>('menu');
  const [profilePic, setProfilePic] = useState('https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/TMPA%20storege/Desain%20tanpa%20judul_20260520_150307_0000.png');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Redeem & Development Mode (No Limit) states
  const [isDevMode, setIsDevMode] = useState<boolean>(() => isLocalDevMode());
  const [redeemCodeInput, setRedeemCodeInput] = useState<string>('');
  const [redeemLoading, setRedeemLoading] = useState<boolean>(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);

  // Share chat state
  const [sharedRegistry, setSharedRegistry] = useState<Record<string, SharedChatRecord>>(() => getSharedChatsRegistry());
  const [defaultShareMode, setDefaultShareModeState] = useState<ShareMode>(() => getDefaultShareMode());
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  // Storage & Delete states
  const [storageStats, setStorageStats] = useState<StorageUsageStats>(() => getStorageUsageStats());
  const [cooldownTarget, setCooldownTarget] = useState<'media' | 'sessions' | 'account' | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const cooldownTimerRef = useRef<any>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'media' | 'sessions' | 'account' | null;
  }>({ isOpen: false, type: null });
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

  // A. Saat User Redeem Kode (Sesuai spesifikasi prompt klien)
  async function submitRedeemCode(inputCode: string) {
    const code = (inputCode || '').trim();
    if (!code) {
      alert(lang === 'id' ? 'Silakan masukkan kode undangan!' : 'Please enter an invite code!');
      return;
    }

    setRedeemLoading(true);
    setRedeemError(null);
    setRedeemSuccessMsg(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user || user;
      if (!currentUser) {
        alert(lang === 'id' ? 'Silakan login terlebih dahulu!' : 'Please sign in first!');
        setRedeemLoading(false);
        return;
      }

      // Panggil fungsi RPC Supabase
      const { data, error } = await supabase.rpc('redeem_invite_code', {
        p_user_id: currentUser.id,
        p_code: code
      });

      if (error || !data || data.success === false) {
        const errorMsg = data?.message || error?.message || (lang === 'id' ? 'Gagal meredeem kode' : 'Failed to redeem code');
        setRedeemError(errorMsg);
        alert(errorMsg);
        setRedeemLoading(false);
        return;
      }

      // SIMPAN KE LOCALSTORAGE (Sesuai permintaan: tidak dicatat ke supabase untuk chat, cukup di local)
      localStorage.setItem('tmpa_dev_mode', 'true');
      setIsDevMode(true);
      setRedeemCodeInput('');
      const successNotice = data?.message || (lang === 'id' 
        ? 'Berhasil! Mode Development / No Limit diaktifkan di perangkat ini.' 
        : 'Success! Development Mode / No Limit activated on this device.');
      setRedeemSuccessMsg(successNotice);
      alert(successNotice);
      if (onDevModeChange) onDevModeChange(true);
    } catch (err: any) {
      const errorMsg = err?.message || (lang === 'id' ? 'Terjadi kesalahan sistem' : 'System error');
      setRedeemError(errorMsg);
      alert(errorMsg);
    } finally {
      setRedeemLoading(false);
    }
  }

  function handleDeactivateDevMode() {
    localStorage.removeItem('tmpa_dev_mode');
    setIsDevMode(false);
    setRedeemSuccessMsg(null);
    setRedeemError(null);
    if (onDevModeChange) onDevModeChange(false);
    showToast(lang === 'id' ? 'Mode Development dinonaktifkan di perangkat ini.' : 'Development Mode deactivated on this device.');
  }

  useEffect(() => {
    const savedPic = localStorage.getItem('tmpa_profile_pic');
    if (savedPic) setProfilePic(savedPic);

    const refreshStorage = () => {
      setStorageStats(getStorageUsageStats());
    };
    window.addEventListener('tmpa_media_cleared', refreshStorage);
    window.addEventListener('tmpa_sessions_cleared', refreshStorage);
    window.addEventListener('tmpa_storage_auto_purged', refreshStorage);

    return () => {
      window.removeEventListener('tmpa_media_cleared', refreshStorage);
      window.removeEventListener('tmpa_sessions_cleared', refreshStorage);
      window.removeEventListener('tmpa_storage_auto_purged', refreshStorage);
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleActionClick = (target: 'media' | 'sessions' | 'account') => {
    // Jika user klik lagi saat cooldown aktif, langsung buka popup konfirmasi
    if (cooldownTarget === target && cooldownSeconds > 0) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      setCooldownTarget(null);
      setCooldownSeconds(0);
      setConfirmModal({
        isOpen: true,
        type: target,
      });
      return;
    }

    // Klik pertama: mulai cooldown 5 detik
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    setCooldownTarget(target);
    setCooldownSeconds(5);

    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          setCooldownTarget(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelModal = () => {
    setConfirmModal({ isOpen: false, type: null });
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setCooldownTarget(null);
    setCooldownSeconds(0);
  };

  const handleExecuteDelete = async () => {
    if (!confirmModal.type) return;
    setIsExecutingDelete(true);
    try {
      if (confirmModal.type === 'media') {
        const res = clearAllStoredMedia();
        setStorageStats(getStorageUsageStats());
        onClearAllMedia?.();
        showToast(lang === 'id' 
          ? `Semua media dibersihkan (${res.bytesFreedKb} KB dibebaskan)` 
          : `All media cleared (${res.bytesFreedKb} KB freed)`);
      } else if (confirmModal.type === 'sessions') {
        clearAllChatSessions();
        setStorageStats(getStorageUsageStats());
        onClearAllSessions?.();
        showToast(lang === 'id' ? "Semua sesi chat berhasil dihapus" : "All chat sessions deleted");
      } else if (confirmModal.type === 'account') {
        await deleteUserAccount();
        setStorageStats(getStorageUsageStats());
        onDeleteAccount?.();
        showToast(lang === 'id' ? "Akun berhasil dihapus. Mengalihkan..." : "Account deleted. Redirecting...");
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      }
    } catch (err: any) {
      showToast(err?.message || "Gagal melakukan penghapusan data");
    } finally {
      setIsExecutingDelete(false);
      setConfirmModal({ isOpen: false, type: null });
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await processAndCompressImage(file);
        setProfilePic(compressedBase64);
        localStorage.setItem('tmpa_profile_pic', compressedBase64);
        showToast(t.photoUpdated);
      } catch (err: any) {
        showToast(err?.message || "Gagal mengunggah foto profil.");
      }
    }
  };

  const formatDate = (ts: number | undefined) => {
    if (!ts) return '-';
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}, ${date.getDate()} ${date.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long' })} ${date.getFullYear()}`;
  };



  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(lang === 'id' ? `${label} berhasil disalin!` : `${label} copied to clipboard!`);
  };

  const selectLanguageOption = (selectedLang: Language) => {
    changeLanguage(selectedLang);
    showToast(selectedLang === 'id' ? 'Bahasa berhasil diubah ke Bahasa Indonesia!' : 'Language successfully switched to English!');
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 bg-white text-slate-900 flex flex-col font-sans overflow-hidden app-clean-grid"
        >
          {/* Main List Menu View */}
          {currentView === 'menu' && (
            <div className="flex-1 overflow-y-auto w-full px-4 sm:px-6 md:px-8 py-6 max-w-2xl mx-auto flex flex-col">
              {/* Back & Title */}
              <div className="flex flex-col mb-8 mt-2">
                <button 
                  onClick={onClose} 
                  className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title={t.backToChat}
                >
                  <ArrowLeft size={22} />
                </button>
                <h1 className="text-3xl sm:text-4xl font-normal text-slate-900 mt-4 tracking-tight">
                  {t.settingsTitle}
                </h1>
              </div>

              {/* Settings Rows */}
              <div className="space-y-1.5">
                {/* 1. Info Akun (Interactive) */}
                <button
                  onClick={() => setCurrentView('account')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50">
                    <User size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.accountInfo}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.accountInfoDesc}</p>
                  </div>
                </button>

                {/* 2. Aktivitas (Interactive) */}
                <button
                  onClick={() => setCurrentView('activity')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-amber-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-amber-50">
                    <Activity size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.activity}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.activityDesc}</p>
                  </div>
                </button>

                {/* 3. Batas Penggunaan (Interactive) */}
                <button
                  onClick={() => setCurrentView('usage')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-rose-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-rose-50">
                    <Shield size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.usageLimits}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.usageLimitsDesc}</p>
                  </div>
                </button>

                {/* 3.5. Redeem Kode Undangan / Dev Mode (Interactive) */}
                <button
                  onClick={() => setCurrentView('redeem')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className={cn(
                    "mt-1 flex-shrink-0 transition-colors p-2 rounded-xl",
                    isDevMode 
                      ? "text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100" 
                      : "text-slate-400 group-hover:text-purple-600 bg-slate-100 group-hover:bg-purple-50"
                  )}>
                    <Key size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">
                        {t.redeemCode}
                      </h3>
                      {isDevMode ? (
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          No Limit Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-mono">
                          Dev Mode
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{t.redeemCodeDesc}</p>
                  </div>
                </button>

                {/* 4. Personalisasi (Interactive) */}
                <button
                  onClick={() => setCurrentView('personalization')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50">
                    <Settings2 size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold text-slate-900">{t.personalization}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{t.personalizationDesc}</p>
                  </div>
                </button>


                {/* 6. Bahasa / Language (Interactive) */}
                <button
                  onClick={() => setCurrentView('language')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-cyan-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-cyan-50">
                    <Globe size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900">{t.language}</h3>
                      <span className="text-[11px] font-semibold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full font-mono">
                        {lang === 'id' ? 'ID (Indonesia)' : 'EN (English)'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{t.languageDesc}</p>
                  </div>
                </button>

                {/* 6.5 Share chat */}
                <button
                  onClick={() => {
                    setCurrentView('share_chat');
                    setSharedRegistry(getSharedChatsRegistry());
                  }}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50">
                    <Share2 size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        Share chat
                      </h3>
                      <span className="text-[11px] font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-mono">
                        Read · Remix · Edit
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {lang === 'id' ? 'Kelola mode akses & tautan obrolan yang Anda bagikan' : 'Manage access modes and your shared chat links'}
                    </p>
                  </div>
                </button>

                {/* 6.6 Remote Control */}
                <button
                  onClick={() => setCurrentView('remote_control')}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 active:bg-slate-100 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50">
                    <Radio size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        Remote Control
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {lang === 'id' ? 'Kelola bot dan kontrol sesi jarak jauh' : 'Manage bots and remote session control'}
                    </p>
                  </div>
                </button>

                {/* 7. Delete (Interactive) */}
                <button
                  onClick={() => {
                    setCurrentView('delete');
                    setStorageStats(getStorageUsageStats());
                  }}
                  className="w-full text-left flex items-start gap-4 py-4 px-4 rounded-2xl border border-transparent hover:border-rose-200 hover:bg-rose-50/50 active:bg-rose-100/60 transition-all group cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-rose-600 transition-colors p-2 rounded-xl bg-slate-100 group-hover:bg-rose-50">
                    <Trash2 size={20} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-slate-900 group-hover:text-rose-600 transition-colors">
                        Delete
                      </h3>
                      <span className="text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-mono">
                        {lang === 'id' ? 'Media, Chat & Akun' : 'Media, Chat & Account'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{t.deleteDataDesc}</p>
                  </div>
                </button>

                {/* Destroy This Website Widget */}
                <div className="pt-6 pb-2 flex flex-col items-center justify-center gap-2 border-t border-slate-200/80 mt-6">
                  <span className="text-[11px] font-medium text-slate-400">
                    {lang === 'id' ? 'Mini Game Interaktif' : 'Interactive Mini Game'}
                  </span>
                  <a 
                    href="https://destroy.spritefusion.com/?from=badge&url=bluefox.tmpa.my.id" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block transition-transform hover:scale-105 active:scale-95"
                    title="Destroy this website"
                  >
                    <img 
                      src="https://destroy.spritefusion.com/badge.svg" 
                      alt="Destroy this website" 
                      width="180" 
                      height="40" 
                      className="h-9 w-auto rounded-lg shadow-2xs"
                    />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Subview Integrations */}
          {currentView === 'integrations' && (
            <div className="flex-1 overflow-y-auto bg-white flex flex-col w-full h-full text-slate-900 app-clean-grid">
              <IntegrationsPage onBack={() => setCurrentView('connected_apps')} isStandalone={false} />
            </div>
          )}

          {/* Subview Remote Control (Telegram Integration) */}
          {currentView === 'remote_control' && (
            <RemoteControlPage
              onBack={() => setCurrentView('menu')}
              onOpenSession={(sessId) => {
                onClose();
                if (onOpenSession) onOpenSession(sessId);
              }}
              onAddSession={(newSess) => {
                if (onAddSession) onAddSession(newSess);
              }}
            />
          )}

          {/* Subview Content */}
          {currentView !== 'menu' && currentView !== 'connected_apps' && currentView !== 'integrations' && currentView !== 'remote_control' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col w-full h-full text-slate-900">
              {/* Header inside sub-screen */}
              <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md py-4 px-4 sm:px-6 sticky top-0 z-10 flex items-center shadow-xs">
                <button 
                  onClick={() => setCurrentView('menu')}
                  className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={22} />
                </button>
                <span className="ml-3 font-semibold text-lg text-slate-900 capitalize">
                  {currentView === 'account' && t.accountInfo}
                  {currentView === 'activity' && t.activity}
                  {currentView === 'usage' && t.usageLimits}
                  {currentView === 'personalization' && t.personalization}
                  {currentView === 'language' && t.language}
                  {currentView === 'delete' && 'Delete'}
                  {currentView === 'share_chat' && (lang === 'id' ? 'Share chat' : 'Share chat')}
                  {currentView === 'redeem' && (lang === 'id' ? 'Redeem Kode Undangan' : 'Redeem Invite Code')}
                </span>
              </div>

              {/* Sub-screen body container */}
              <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full">
                
                {/* View: LANGUAGE / BAHASA */}
                {currentView === 'language' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">{t.selectLanguage}</h3>
                      <p className="text-slate-500 text-sm">{t.languageDesc}</p>
                    </div>

                    <div className="space-y-3">
                      {/* Indonesian Option */}
                      <div 
                        onClick={() => selectLanguageOption('id')}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                          lang === 'id' 
                            ? "bg-cyan-50 border-cyan-400 shadow-sm" 
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center text-xs font-bold font-mono text-cyan-800 border border-cyan-200 shadow-xs">
                            ID
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[16px] font-semibold text-slate-900">Bahasa Indonesia</h4>
                              {lang === 'id' && (
                                <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-300 px-1.5 py-0.2 rounded font-medium">
                                  {t.active}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Bahasa Indonesia baku dan natural untuk seluruh antarmuka & respons</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          lang === 'id' ? "bg-cyan-600 border-cyan-600 text-white font-bold" : "border-slate-300 group-hover:border-slate-400"
                        )}>
                          {lang === 'id' && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>

                      {/* English Option */}
                      <div 
                        onClick={() => selectLanguageOption('en')}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                          lang === 'en' 
                            ? "bg-blue-50 border-blue-400 shadow-sm" 
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xs font-bold font-mono text-blue-800 border border-blue-200 shadow-xs">
                            EN
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[16px] font-semibold text-slate-900">English (US)</h4>
                              {lang === 'en' && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.2 rounded font-medium">
                                  {t.active}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Standard English for all UI menus, system prompts, and options</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          lang === 'en' ? "bg-blue-600 border-blue-600 text-white font-bold" : "border-slate-300 group-hover:border-slate-400"
                        )}>
                          {lang === 'en' && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* View A. INFO AKUN */}
                {currentView === 'account' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="flex flex-col sm:items-center sm:flex-row gap-6 border-b border-slate-200 pb-8">
                      <div className="relative group">
                        <UserGradientAvatar 
                          userId={user?.id}
                          email={user?.email}
                          name={user?.user_metadata?.full_name}
                          size="xl"
                          className="w-24 h-24 text-3xl rounded-3xl shadow-md border-4 border-white"
                        />
                      </div>
                      <div className="text-left space-y-1">
                        <h4 className="text-xl font-bold text-slate-900">
                          {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'TMPA User'}
                        </h4>
                        <p className="text-sm text-slate-500">
                          {lang === 'id' 
                            ? 'Avatar digenerate otomatis dengan pola gradien unik berdasarkan akun Supabase Anda.' 
                            : 'Avatar dynamically generated with unique gradient patterns based on your Supabase account.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          {lang === 'id' ? 'Nama Pengguna' : 'Username'}
                        </label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-900 font-semibold text-[15px] shadow-xs">
                          {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'TMPA User'}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          {lang === 'id' ? 'Email Terdaftar' : 'Registered Email'}
                        </label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-900 font-semibold text-[15px] shadow-xs flex items-center justify-between">
                          <span className="truncate">{user?.email || 'user@tmpa.example'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          {lang === 'id' ? 'User Identifier (Supabase UUID)' : 'User Identifier (Supabase UUID)'}
                        </label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-700 font-mono text-sm leading-relaxed shadow-xs flex items-center justify-between gap-3">
                          <span className="truncate font-mono">{user?.id || 'tmpa-guest-uuid'}</span>
                          {user?.id && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(user.id);
                                showToast(lang === 'id' ? 'UUID berhasil disalin!' : 'UUID copied to clipboard!');
                              }}
                              className="px-2.5 py-1 text-xs font-sans font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Copy size={12} />
                              <span>{lang === 'id' ? 'Salin' : 'Copy'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          {lang === 'id' ? 'Status Paket Akun' : 'Account Plan Status'}
                        </label>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-blue-600 font-bold text-sm tracking-wide shadow-xs uppercase">
                          {userTier || 'FREE (DEFAULT)'}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {lang === 'id' ? 'Mode Pengembangan (No Limit)' : 'Development Mode (No Limit)'}
                          </label>
                          <button
                            type="button"
                            onClick={() => setCurrentView('redeem')}
                            className="text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
                          >
                            {isDevMode ? (lang === 'id' ? 'Kelola Kode' : 'Manage Code') : (lang === 'id' ? 'Tukarkan Kode' : 'Redeem Code')}
                          </button>
                        </div>
                        <div className={cn(
                          "p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs",
                          isDevMode 
                            ? "bg-emerald-50/70 border-emerald-300 text-emerald-900" 
                            : "bg-white border-slate-200 text-slate-700"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                              isDevMode ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                            )}>
                              <Key size={18} />
                            </div>
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-2">
                                <span>{isDevMode ? (lang === 'id' ? 'Aktif (Tanpa Batas Kuota)' : 'Active (No Limit)') : (lang === 'id' ? 'Mode Standar' : 'Standard Mode')}</span>
                                {isDevMode && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {isDevMode 
                                  ? (lang === 'id' ? 'Pengecekan batas kuota Supabase dilewati di perangkat ini.' : 'Supabase quota checks bypassed on this device.') 
                                  : (lang === 'id' ? 'Punya invite code? Aktifkan no limit di menu Redeem.' : 'Have an invite code? Activate no limit in Redeem menu.')}
                              </p>
                            </div>
                          </div>
                          {isDevMode ? (
                            <button
                              type="button"
                              onClick={handleDeactivateDevMode}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shrink-0"
                            >
                              {lang === 'id' ? 'Nonaktifkan' : 'Deactivate'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCurrentView('redeem')}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                              Redeem
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* View B. AKTIVITAS */}
                {currentView === 'activity' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {lang === 'id' ? 'Riwayat Percakapan' : 'Conversation History'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Melihat penanda sesi obrolan Anda dengan asisten.' : 'View session history of your conversations with the assistant.'}
                      </p>
                    </div>

                    {chatSessions.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 border border-dashed border-slate-300 rounded-3xl bg-white">
                        {lang === 'id' ? 'Belum ada aktivitas obrolan atau sesi Anda kosong.' : 'No chat activity or sessions found.'}
                      </div>
                    ) : (
                      <div className="grid gap-3.5">
                        {chatSessions.map((session) => (
                          <div key={session.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h4 className="text-base font-bold text-slate-900 truncate leading-tight select-none">
                              {session.title || (lang === 'id' ? "Percakapan baru..." : "New conversation...")}
                            </h4>
                            <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-blue-600" />
                                <span>{lang === 'id' ? 'Dibuat:' : 'Created:'} {formatDate(Number(session.id))}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span>{lang === 'id' ? 'Diperbarui:' : 'Updated:'} {formatDate(session.updatedAt || Number(session.id))}</span>
                              </div>
                            </div>
                            <div className="inline-flex items-center bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-700 capitalize">
                              Model: {getModelDisplayName(session.model)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* View C. BATAS PENGGUNAAN */}
                {currentView === 'usage' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {lang === 'id' ? 'Batas Penggunaan Model & Pencarian' : 'Model & Search Usage Limits'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Persentase gabungan penggunaan seluruh model dan pencarian web yang diakumulasikan per permintaan.' : 'Combined usage percentage of models and web search accumulated per request.'}
                      </p>
                    </div>

                    {/* Banner Indikator Mode Development (No Limit) */}
                    {isDevMode && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-4.5 flex items-start justify-between gap-3 shadow-xs">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                            <Sparkles size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-emerald-950 text-sm">
                                {lang === 'id' ? 'Mode Development / No Limit Aktif' : 'Development Mode / No Limit Active'}
                              </h4>
                              <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 border border-emerald-300 px-2 py-0.2 rounded-full font-mono uppercase">
                                Bypassed
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                              {lang === 'id'
                                ? 'Perangkat ini berjalan dalam mode bebas batas kuota (No Limit). Seluruh panggilan chat AI tidak memotong kuota database Supabase.'
                                : 'This device is running in No Limit mode. All AI chat requests bypass Supabase quota tracking and limits.'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentView('redeem')}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer shrink-0 shadow-2xs"
                        >
                          {lang === 'id' ? 'Pengaturan' : 'Settings'}
                        </button>
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="mb-2">
                        <h4 className="text-lg font-bold text-slate-900">{lang === 'id' ? 'Kuota Keseluruhan' : 'Total Quota'}</h4>
                        <p className="text-xs text-slate-500">{lang === 'id' ? 'Dihitung berdasarkan model dan pencarian yang digunakan' : 'Calculated based on models and searches used'}</p>
                      </div>
                      
                      <div className="space-y-5 mt-6">
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-900 mb-1.5">
                            <span>{lang === 'id' ? 'Batas 5 Jam' : '5-Hour Limit'}</span>
                            <span className={hourlyUsage >= 100 ? "text-rose-600 font-bold" : "text-blue-600 font-bold"}>
                              {lang === 'id' ? `Terpakai ${hourlyUsage.toFixed(1)}%` : `Used ${hourlyUsage.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                hourlyUsage >= 100 ? "bg-rose-500" : hourlyUsage > 75 ? "bg-amber-500" : "bg-blue-600"
                              )} 
                              style={{ width: `${hourlyUsage}%` }} 
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-900 mb-1.5">
                            <span>{lang === 'id' ? 'Batas Mingguan' : 'Weekly Limit'}</span>
                            <span className={weeklyUsage >= 100 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                              {lang === 'id' ? `Terpakai ${weeklyUsage.toFixed(1)}%` : `Used ${weeklyUsage.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                weeklyUsage >= 100 ? "bg-rose-500" : weeklyUsage > 75 ? "bg-amber-500" : "bg-emerald-600"
                              )} 
                              style={{ width: `${weeklyUsage}%` }} 
                            />
                          </div>
                        </div>

                        {(hourlyUsage >= 100 || weeklyUsage >= 100) && (
                          <div className="text-rose-700 text-xs mt-3 bg-rose-50 p-3.5 rounded-xl border border-rose-200 flex items-start gap-2">
                            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                            <span>{lang === 'id' ? 'Anda telah mencapai batas penggunaan. Semua model sementara dinonaktifkan.' : 'You have reached the usage limit. Models are temporarily paused.'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rincian Tarif Model & Pencarian */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          {lang === 'id' ? 'Rincian Tarif Limit Pencarian Web' : 'Web Search Usage Limit Rates'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {lang === 'id' ? 'Konsumsi kuota pencarian per 5 jam dan per minggu' : 'Search quota consumption per 5 hours and per week'}
                        </p>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left text-slate-700">
                          <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3.5">Jenis Pencarian</th>
                              <th className="py-2.5 px-3.5 text-blue-700">Per 5 Jam</th>
                              <th className="py-2.5 px-3.5 text-emerald-700">Per Minggu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Advanced search</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">10%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">5%</td>
                            </tr>
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Standard search</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">5%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">3%</td>
                            </tr>
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Map search advanced</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">13%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">7%</td>
                            </tr>
                            <tr className="hover:bg-slate-50/70">
                              <td className="py-2 px-3.5 font-sans font-medium text-slate-900">Map standard search</td>
                              <td className="py-2 px-3.5 text-blue-600 font-bold">7%</td>
                              <td className="py-2 px-3.5 text-emerald-600 font-bold">4%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="pt-2">
                        <h4 className="text-base font-bold text-slate-900 mb-1">
                          {lang === 'id' ? 'Rincian Tarif Model AI' : 'AI Model Usage Rates'}
                        </h4>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-xs text-left text-slate-700">
                            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3.5">Nama Model</th>
                                <th className="py-2.5 px-3.5 text-blue-700">Per 5 Jam</th>
                                <th className="py-2.5 px-3.5 text-emerald-700">Per Minggu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox pro (Vision Aktif)</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">19%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">14%</td>
                              </tr>
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox pro (Standar Teks)</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">13%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">10%</td>
                              </tr>
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox standard</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">12%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">9%</td>
                              </tr>
                              <tr className="hover:bg-slate-50/70">
                                <td className="py-2 px-3.5 font-sans font-medium text-slate-900">bluefox Dilo</td>
                                <td className="py-2 px-3.5 text-blue-600 font-bold">8%</td>
                                <td className="py-2 px-3.5 text-emerald-600 font-bold">6%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>


                  </div>
                )}

                {/* View D. PERSONALISASI */}
                {currentView === 'personalization' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {lang === 'id' ? 'Pengaturan Tambahan' : 'Additional Personalization'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Sesuaikan gaya interaksi AI yang bekerja di balik obrolan Anda.' : 'Customize AI interaction style for your chats.'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-900 block">
                        {lang === 'id' ? 'Instruksi Kustom Sistem AI' : 'Custom AI System Instructions'}
                      </label>
                      <textarea 
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder={lang === 'id' ? "Contoh: 'Berbicaralah dengan nada santai', 'Selalu berikan penjelasan terstruktur', dll..." : "Example: 'Always provide structured answers', 'Speak with a friendly tone', etc..."}
                        className="w-full h-36 bg-white border border-slate-200 rounded-xl p-4 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-y text-[15px] shadow-xs"
                      />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {lang === 'id' 
                          ? 'Petunjuk tambahan dari Anda akan disisipkan langsung ke prompt sistem AI.' 
                          : 'Your custom instructions will be appended to the AI system prompt.'}
                      </p>
                    </div>

                    <div className="pt-6 border-t border-slate-200">
                      <button 
                        onClick={() => setCurrentView('connected_apps')}
                        className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-5 transition-all flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100 group-hover:scale-105 transition-transform">
                            <Link2 size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[17px] font-bold text-slate-900">{t.connectedApps}</h4>
                              <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                                Coming Soon
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {lang === 'id' ? 'Gunakan produk kami secara lancar dan terintegrasi' : 'Seamlessly connect and integrate with external apps'}
                            </p>
                          </div>
                        </div>
                        <ArrowLeft size={18} className="rotate-180 text-slate-400 group-hover:translate-x-1 transition-all group-hover:text-blue-600" />
                      </button>
                    </div>
                  </div>
                )}

                {/* View 7: DELETE / PENGHAPUSAN DATA & AKUN */}
                {currentView === 'delete' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">
                        {lang === 'id' ? 'Pengaturan Penghapusan & Penyimpanan' : 'Deletion & Storage Management'}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {lang === 'id'
                          ? 'Kelola memori browser, hapus lampiran media, bersihkan seluruh riwayat chat, atau hapus akun pengguna.'
                          : 'Manage browser storage capacity, clear media attachments, delete chat history, or delete your user account.'}
                      </p>
                    </div>

                    {/* Storage Health & Stats Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                            <HardDrive size={18} />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-slate-900">
                              {lang === 'id' ? 'Penyimpanan Lokal Browser' : 'Browser Local Storage'}
                            </h5>
                            <p className="text-xs text-slate-500">
                              {lang === 'id' ? 'Kapasitas memori browser untuk data chat & file' : 'Browser memory quota for chat data & files'}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-xs font-mono font-semibold px-2.5 py-1 rounded-full border",
                          storageStats.percentageUsed > 80
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : storageStats.percentageUsed > 50
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          {storageStats.totalMb} MB / {storageStats.estimatedMaxMb} MB ({storageStats.percentageUsed}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            storageStats.percentageUsed > 80
                              ? "bg-rose-500"
                              : storageStats.percentageUsed > 50
                              ? "bg-amber-500"
                              : "bg-blue-600"
                          )}
                          style={{ width: `${Math.max(4, storageStats.percentageUsed)}%` }}
                        />
                      </div>

                      {/* Metrics breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                          <div className="text-slate-400 font-medium">{lang === 'id' ? 'Media Tersimpan' : 'Stored Media'}</div>
                          <div className="text-sm font-bold text-slate-800 mt-0.5">{storageStats.mediaCount} {lang === 'id' ? 'file' : 'files'}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                          <div className="text-slate-400 font-medium">{lang === 'id' ? 'Sesi Obrolan' : 'Chat Sessions'}</div>
                          <div className="text-sm font-bold text-slate-800 mt-0.5">{storageStats.sessionCount} {lang === 'id' ? 'sesi' : 'sessions'}</div>
                        </div>
                        <div className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                          <div className="text-slate-400 font-medium">{lang === 'id' ? 'Total Memori' : 'Total Space'}</div>
                          <div className="text-sm font-bold text-slate-800 mt-0.5">{storageStats.totalKb} KB</div>
                        </div>
                      </div>

                      {/* Auto-cleanup notification notice */}
                      <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-800">
                        <Shield size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>
                          {lang === 'id'
                            ? 'Sistem otomatis mengamankan obrolan: Jika penyimpanan penuh (Quota Exceeded), file media otomatis dibersihkan agar riwayat teks obrolan Anda tetap aman dan tidak crash.'
                            : 'Automatic storage safeguard: If storage quota is full, media attachments are automatically cleared to keep your chat history intact and responsive.'}
                        </span>
                      </div>
                    </div>

                    {/* Section: 3 Delete Options */}
                    <div className="space-y-3 pt-2">
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                        {lang === 'id' ? 'Pilihan Penghapusan Data' : 'Data Deletion Options'}
                      </h5>

                      {/* 1. Hapus Semua Media */}
                      <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex-shrink-0 mt-0.5">
                              <Camera size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h6 className="text-[15px] font-bold text-slate-900">
                                  {lang === 'id' ? '1. Hapus Semua Media' : '1. Delete All Media'}
                                </h6>
                                <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.2 rounded-full font-mono">
                                  {storageStats.mediaCount} Media
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                {lang === 'id'
                                  ? 'Membersihkan seluruh file gambar, dokumen, dan cache tmpa_media_* dari memori lokal. Riwayat teks obrolan tetap aman tersimpan.'
                                  : 'Clears all images, documents, and cached media from browser storage. Chat text history remains safe.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            onClick={() => handleActionClick('media')}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs",
                              cooldownTarget === 'media' && cooldownSeconds > 0
                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 animate-pulse ring-2 ring-amber-300"
                                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-98"
                            )}
                          >
                            <Trash2 size={14} />
                            {cooldownTarget === 'media' && cooldownSeconds > 0
                              ? (lang === 'id' ? `Klik Lagi untuk Konfirmasi (${cooldownSeconds}s)` : `Click Again to Confirm (${cooldownSeconds}s)`)
                              : (lang === 'id' ? 'Hapus Semua Media' : 'Delete All Media')}
                          </button>
                        </div>
                      </div>

                      {/* 2. Hapus Semua Sesi Chat */}
                      <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex-shrink-0 mt-0.5">
                              <RotateCcw size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h6 className="text-[15px] font-bold text-slate-900">
                                  {lang === 'id' ? '2. Hapus Semua Sesi Chat' : '2. Delete All Chat Sessions'}
                                </h6>
                                <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.2 rounded-full font-mono">
                                  {storageStats.sessionCount} {lang === 'id' ? 'Sesi' : 'Sessions'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                {lang === 'id'
                                  ? 'Menghapus seluruh riwayat percakapan dan seluruh sesi chat yang tersimpan di perangkat ini. Obrolan akan kembali bersih seperti baru.'
                                  : 'Permanently removes all conversation history and chat sessions stored in this browser.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            onClick={() => handleActionClick('sessions')}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs",
                              cooldownTarget === 'sessions' && cooldownSeconds > 0
                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 animate-pulse ring-2 ring-amber-300"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-98"
                            )}
                          >
                            <Trash2 size={14} />
                            {cooldownTarget === 'sessions' && cooldownSeconds > 0
                              ? (lang === 'id' ? `Klik Lagi untuk Konfirmasi (${cooldownSeconds}s)` : `Click Again to Confirm (${cooldownSeconds}s)`)
                              : (lang === 'id' ? 'Hapus Semua Sesi Chat' : 'Delete All Chat Sessions')}
                          </button>
                        </div>
                      </div>

                      {/* 3. Hapus Akun */}
                      <div className="bg-white border border-rose-200/80 hover:border-rose-300 rounded-2xl p-5 shadow-xs transition-all space-y-3 bg-gradient-to-b from-white to-rose-50/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl border border-rose-200 flex-shrink-0 mt-0.5">
                              <AlertCircle size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h6 className="text-[15px] font-bold text-rose-950">
                                  {lang === 'id' ? '3. Hapus Akun' : '3. Delete Account'}
                                </h6>
                                <span className="text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.2 rounded-full font-mono">
                                  Permanen
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {lang === 'id'
                                  ? 'Mengeluarkan akun Anda, menghapus foto profil, preferensi, riwayat chat, media, dan seluruh data pengguna dari perangkat ini.'
                                  : 'Sign out and delete your profile picture, custom instructions, chat history, media, and all local user data from this device.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            onClick={() => handleActionClick('account')}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs",
                              cooldownTarget === 'account' && cooldownSeconds > 0
                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 animate-pulse ring-2 ring-amber-300"
                                : "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 active:scale-98"
                            )}
                          >
                            <Trash2 size={14} />
                            {cooldownTarget === 'account' && cooldownSeconds > 0
                              ? (lang === 'id' ? `Klik Lagi untuk Konfirmasi (${cooldownSeconds}s)` : `Click Again to Confirm (${cooldownSeconds}s)`)
                              : (lang === 'id' ? 'Hapus Akun' : 'Delete Account')}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* View: SHARE CHAT SETTINGS */}
                {currentView === 'share_chat' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">
                        {lang === 'id' ? 'Pengaturan Share Chat' : 'Share Chat Settings'}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {lang === 'id'
                          ? 'Atur mode akses default (Read, Remix, Edit) dan kelola seluruh tautan obrolan yang telah Anda bagikan.'
                          : 'Configure default access mode (Read, Remix, Edit) and manage all your shared conversation links.'}
                      </p>
                    </div>

                    {/* Mode Default Selection Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <Share2 size={18} />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-900">
                            {lang === 'id' ? 'Mode Default Saat Membagikan' : 'Default Sharing Mode'}
                          </h5>
                          <p className="text-xs text-slate-500">
                            {lang === 'id' ? 'Pilihan mode awal saat membuka popup bagikan' : 'Initial mode applied when opening the share popup'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {/* Option 1: Read */}
                        <div 
                          onClick={() => {
                            setDefaultShareMode('read');
                            setDefaultShareModeState('read');
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            defaultShareMode === 'read'
                              ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Eye size={16} className={defaultShareMode === 'read' ? 'text-blue-600' : 'text-slate-400'} />
                            <span className="font-bold text-xs">Read</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {lang === 'id' ? 'Hanya baca, tanpa simpan & input hilang' : 'Read only, no saving, prompt hidden'}
                          </p>
                        </div>

                        {/* Option 2: Remix */}
                        <div 
                          onClick={() => {
                            setDefaultShareMode('remix');
                            setDefaultShareModeState('remix');
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            defaultShareMode === 'remix'
                              ? 'border-purple-500 bg-purple-50/70 text-purple-900 ring-1 ring-purple-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <GitFork size={16} className={defaultShareMode === 'remix' ? 'text-purple-600' : 'text-slate-400'} />
                            <span className="font-bold text-xs">Remix</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {lang === 'id' ? 'Lanjutkan konteks, buat sesi cabang baru' : 'Fork context into new branch session'}
                          </p>
                        </div>

                        {/* Option 3: Edit */}
                        <div 
                          onClick={() => {
                            setDefaultShareMode('edit');
                            setDefaultShareModeState('edit');
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            defaultShareMode === 'edit'
                              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-1 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Pencil size={16} className={defaultShareMode === 'edit' ? 'text-emerald-600' : 'text-slate-400'} />
                            <span className="font-bold text-xs">Edit</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {lang === 'id' ? 'Simpan penuh ke akun pengguna langsung' : 'Save full session into user account'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Shared Chats Registry List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-slate-800">
                          {lang === 'id' ? 'Daftar Obrolan yang Pernah Dibagikan' : 'Active Shared Chats'}
                        </h5>
                        <span className="text-xs text-slate-400 font-mono">
                          {Object.keys(sharedRegistry).length} {lang === 'id' ? 'tautan aktif' : 'active links'}
                        </span>
                      </div>

                      {getUniqueSharedChatsList().length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                            <Share2 size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">
                              {lang === 'id' ? 'Belum Ada Obrolan yang Dibagikan' : 'No Shared Chats Yet'}
                            </p>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                              {lang === 'id' 
                                ? 'Saat AI menjawab sesi chat untuk pertama kali, tombol Bagikan akan muncul di sebelah tombol unduh pada bilah atas.' 
                                : 'When the AI answers in a chat session for the first time, the Share button will appear next to the download button in the top bar.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {getUniqueSharedChatsList().map((item) => {
                            const effectiveId = item.id || item.sessionId;
                            return (
                            <div 
                              key={effectiveId}
                              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 transition-all hover:border-slate-300"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <h6 className="font-bold text-sm text-slate-900 truncate">
                                    {item.title}
                                  </h6>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ID: {effectiveId.slice(0, 16)}...
                                    </span>
                                    <span className="text-[10px] text-slate-400">·</span>
                                    <span className="text-[10px] text-slate-500">
                                      {new Date(item.createdAt).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                </div>

                                {/* Current Mode Badge */}
                                <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  item.mode === 'read'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : item.mode === 'remix'
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                  Mode: {item.mode.toUpperCase()}
                                </span>
                              </div>

                              {/* Mode Switcher Buttons */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                                  {lang === 'id' ? 'Ubah Mode:' : 'Change Mode:'}
                                </span>
                                {(['read', 'remix', 'edit'] as ShareMode[]).map((m) => (
                                  <button
                                    key={m}
                                    onClick={() => {
                                      updateSharedChatMode(effectiveId, m);
                                      setSharedRegistry(getSharedChatsRegistry());
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                      item.mode === m
                                        ? m === 'read'
                                          ? 'bg-blue-600 text-white shadow-xs'
                                          : m === 'remix'
                                          ? 'bg-purple-600 text-white shadow-xs'
                                          : 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {m === 'read' ? 'Read' : m === 'remix' ? 'Remix' : 'Edit'}
                                  </button>
                                ))}
                              </div>

                              {/* Link & Action Buttons */}
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                <input
                                  type="text"
                                  readOnly
                                  value={item.url || `https://bluefox.tmpa.my.id/share-${effectiveId}`}
                                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-600 truncate focus:outline-none"
                                />

                                <button
                                  onClick={() => {
                                    const targetUrl = item.url || `https://bluefox.tmpa.my.id/share-${effectiveId}`;
                                    navigator.clipboard.writeText(targetUrl);
                                    setCopiedShareId(effectiveId);
                                    setTimeout(() => setCopiedShareId(null), 2000);
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                  title={lang === 'id' ? 'Salin tautan' : 'Copy link'}
                                >
                                  {copiedShareId === effectiveId ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                  <span>{copiedShareId === effectiveId ? (lang === 'id' ? 'Tersalin' : 'Copied') : (lang === 'id' ? 'Salin' : 'Copy')}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    revokeSharedChat(effectiveId);
                                    setSharedRegistry(getSharedChatsRegistry());
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                  title={lang === 'id' ? 'Cabut / Hapus tautan ini' : 'Revoke this share link'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* View: REDEEM KODE UNDANGAN / DEV MODE */}
                {currentView === 'redeem' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {lang === 'id' ? 'Tukarkan Kode Undangan' : 'Redeem Invite Code'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                        {lang === 'id' 
                          ? 'Aktifkan Mode Development / No Limit di perangkat ini menggunakan invite code resmi.' 
                          : 'Activate Development Mode / No Limit on this device using an official invite code.'}
                      </p>
                    </div>

                    {/* Status Card */}
                    <div className={cn(
                      "p-5 rounded-2xl border transition-all shadow-sm space-y-3",
                      isDevMode 
                        ? "bg-emerald-50/70 border-emerald-300" 
                        : "bg-white border-slate-200"
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          <div className={cn(
                            "p-2.5 rounded-xl border flex-shrink-0 mt-0.5",
                            isDevMode 
                              ? "bg-emerald-100 border-emerald-200 text-emerald-700" 
                              : "bg-purple-50 border-purple-100 text-purple-600"
                          )}>
                            <Key size={22} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-base">
                                {isDevMode 
                                  ? (lang === 'id' ? 'Mode Development (No Limit) Aktif' : 'Development Mode (No Limit) Active')
                                  : (lang === 'id' ? 'Status Mode Development' : 'Development Mode Status')}
                              </h4>
                              {isDevMode ? (
                                <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Aktif
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-mono">
                                  Standar
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {isDevMode 
                                ? (lang === 'id' 
                                    ? 'Perangkat ini telah terverifikasi dan mode No Limit aktif secara lokal di browser. Obrolan AI berjalan tanpa pengecekan kuota database Supabase.'
                                    : 'This device is verified and No Limit mode is active locally in this browser. AI chats bypass Supabase quota limits.')
                                : (lang === 'id'
                                    ? 'Belum aktif. Masukkan kode undangan 1x pakai di bawah ini untuk mengaktifkan akses tanpa batas pada browser ini.'
                                    : 'Not active. Enter a 1-time invite code below to unlock unlimited AI chats on this browser.')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {isDevMode && (
                        <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-mono text-emerald-800">
                            localStorage: <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">tmpa_dev_mode = 'true'</code>
                          </span>
                          <button
                            type="button"
                            onClick={handleDeactivateDevMode}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                          >
                            {lang === 'id' ? 'Nonaktifkan Mode Dev' : 'Deactivate Dev Mode'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Input Redeem Form */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                          {lang === 'id' ? 'Masukkan Kode Undangan (Invite Code)' : 'Enter Invite Code'}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={redeemCodeInput}
                            onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !redeemLoading && redeemCodeInput.trim()) {
                                submitRedeemCode(redeemCodeInput);
                              }
                            }}
                            placeholder="Contoh: DEV-XXXX-XXXX"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm tracking-widest placeholder-slate-400 uppercase focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                            disabled={redeemLoading}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const clipText = await navigator.clipboard.readText();
                                if (clipText) setRedeemCodeInput(clipText.trim().toUpperCase());
                              } catch {}
                            }}
                            className="px-3.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                            title="Tempel dari Clipboard"
                          >
                            <Copy size={14} />
                            <span>Paste</span>
                          </button>
                        </div>
                      </div>

                      {redeemError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                          <AlertCircle size={15} className="shrink-0 text-rose-600" />
                          <span>{redeemError}</span>
                        </div>
                      )}

                      {redeemSuccessMsg && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                          <Check size={15} className="shrink-0 text-emerald-600 stroke-[3]" />
                          <span>{redeemSuccessMsg}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => submitRedeemCode(redeemCodeInput)}
                        disabled={redeemLoading || !redeemCodeInput.trim()}
                        className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {redeemLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>{lang === 'id' ? 'Memvalidasi Kode...' : 'Validating Code...'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            <span>{lang === 'id' ? 'Redeem Kode & Aktifkan No Limit' : 'Redeem Code & Activate No Limit'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connected Apps & MCP Hub Screen */}
          {currentView === 'connected_apps' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col w-full h-full text-slate-900">
              {/* Header inside sub-screen */}
              <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md py-4 px-4 sm:px-6 sticky top-0 z-10 flex items-center justify-between shadow-xs">
                <div className="flex items-center">
                  <button 
                    onClick={() => setCurrentView('personalization')}
                    className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={22} />
                  </button>
                  <span className="ml-3 font-bold text-lg text-slate-900">
                    {t.connectedApps}
                  </span>
                </div>
              </div>

              {/* Sub-screen body container */}
              <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full space-y-6">
                
                {/* 1. MCP Hub Featured Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5 relative overflow-hidden group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl">
                        <Layers size={26} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-bold text-slate-900">{t.mcpHubTitle}</h4>
                          <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                            Coming Soon
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-amber-600 font-mono">
                          {lang === 'id' ? 'Integrasi MCP Segera Hadir' : 'MCP Integration Coming Soon'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {t.mcpIntroText}
                  </p>

                  {/* Open MCP Settings Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => setCurrentView('integrations')}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold transition-all shadow-sm cursor-pointer text-sm"
                    >
                      <Layers size={18} />
                      <span>{t.openMcpIntegrations}</span>
                      <ArrowLeft size={16} className="rotate-180 ml-1" />
                    </button>
                  </div>
                </div>

                {/* 2. Connected Web Ecosystem Links */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                    {lang === 'id' ? 'Ekosistem Layanan Web TMPA' : 'TMPA Web Ecosystem'}
                  </h4>

                  {/* Main Website TMPA Link */}
                  <a
                    href="https://tmpa.my.id"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all group shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white rounded-xl border border-blue-100 transition-colors">
                        <Globe size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {t.mainWebsite}
                          </h5>
                          <span className="text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                            Online
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">https://tmpa.my.id</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </a>

                  {/* Store Link */}
                  <div
                    onClick={() => showToast(lang === 'id' ? 'TMPA Store segera hadir (Coming Soon)...' : 'TMPA Store is coming soon...')}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all group shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 transition-colors">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-[15px] font-bold text-slate-900">
                            {t.store}
                          </h5>
                          <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">TMPA Store & Marketplace AI Models</p>
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-mono font-semibold">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Popup Modal with 'Batalkan' & 'Hapus' */}
          <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl flex-shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-slate-900">
                    {confirmModal.type === 'media' && (lang === 'id' ? 'Konfirmasi Hapus Semua Media' : 'Confirm Clear All Media')}
                    {confirmModal.type === 'sessions' && (lang === 'id' ? 'Konfirmasi Hapus Sesi Chat' : 'Confirm Clear Chat Sessions')}
                    {confirmModal.type === 'account' && (lang === 'id' ? 'Konfirmasi Hapus Akun' : 'Confirm Delete Account')}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {confirmModal.type === 'media' && (lang === 'id'
                      ? 'Apakah Anda yakin ingin menghapus seluruh lampiran gambar, dokumen, dan file media yang tersimpan di memori browser? Teks pesan obrolan tetap aman.'
                      : 'Are you sure you want to clear all media attachments from local memory? Your text messages will be retained.')}
                    {confirmModal.type === 'sessions' && (lang === 'id'
                      ? 'Apakah Anda yakin ingin menghapus seluruh riwayat percakapan dan sesi chat? Tindakan ini permanen dan tidak dapat dibatalkan.'
                      : 'Are you sure you want to delete all chat sessions and conversation history? This action is permanent and cannot be undone.')}
                    {confirmModal.type === 'account' && (lang === 'id'
                      ? 'Apakah Anda yakin ingin menghapus akun? Anda akan dikeluarkan dan seluruh data pengguna, profil, dan riwayat akan dibersihkan dari perangkat ini.'
                      : 'Are you sure you want to delete your account? You will be signed out and all profile information and chat data will be removed from this device.')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleCancelModal}
                  disabled={isExecutingDelete}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {lang === 'id' ? 'Batalkan' : 'Cancel'}
                </button>
                <button
                  onClick={handleExecuteDelete}
                  disabled={isExecutingDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {isExecutingDelete 
                    ? (lang === 'id' ? 'Menghapus...' : 'Deleting...') 
                    : (lang === 'id' ? 'Hapus' : 'Delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

          {/* Subtle Clean Interactive Toast Box */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm py-3 px-5 rounded-full flex items-center gap-2 shadow-2xl tracking-normal border border-slate-800 whitespace-nowrap font-medium"
              >
                <Check size={16} className="text-emerald-400 stroke-[3]" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
