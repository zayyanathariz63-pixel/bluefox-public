import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Connector, MediaAttachment, ChatSession, SearchSource } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { VerifyPage } from './components/VerifyPage';
import { Bot, Sparkles, ChevronDown, ChevronUp, Cpu, Layers, Menu, Store, Globe, Settings, LogOut, Brain, Zap, Download, Search, ArrowDown, Loader2, Eye, EyeOff, Lock, Check, Pin, PinOff, Trash2, MoreVertical, X, RotateCcw, SlidersHorizontal, Sliders, Copy, Image as ImageIcon, SquarePen, Home, Share2, Film, Users, ShieldCheck } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { SettingsModal } from './components/SettingsModal';
import { ShareChatModal } from './components/ShareChatModal';
import { ConnectorsModal } from './components/ConnectorsModal';
import { IntegrationsPage } from './components/IntegrationsPage';
import { MediaScreenViewer } from './components/MediaScreenViewer';
import { QuotaExceededModal } from './components/QuotaExceededModal';
import { UserGradientAvatar } from './components/UserGradientAvatar';
import { FileHistoryModal } from './components/FileHistoryModal';
import { MotionPanel } from './components/MotionPanel';
import { MotionManualModal } from './components/MotionManualModal';
import { MotionLoadingProgress } from './components/MotionLoadingProgress';
import { ChooseAccountModal } from './components/ChooseAccountModal';
import { 
  SavedAccount, 
  recordCurrentSession, 
  switchSavedAccount,
  getOrCreateDeviceId,
  registerAccountDeviceSession,
  getSavedAccounts,
  isUserAdmin
} from './lib/accountManager';
import { BLUEFOX_MOTION_SYSTEM_PROMPT, processUserInput, parseAiResponse, invokeMotionGenerator } from './lib/motion';
import { useLanguage } from './lib/i18n';
import { 
  saveBase64ToLocalStorage, 
  getFileFromLocalStorage 
} from './lib/fileStorage';
import { 
  supabase, 
  exchangeSsoTicket, 
  listenToRealtimeMessages, 
  listenToBluefoxSessionMessages,
  sendMessageToSupabase, 
  loadChatHistory,
  getValidUUID,
  hasValidConfig,
  getUserLimits,
  resetUserLimits,
  consumeAiLimit,
  supabaseKey,
  invokeBluefoxProcessor,
  DEFAULT_MODELS,
  getModelDisplayName,
  createNewSession,
  fetchUserSessions,
  getUserSessions,
  saveChatTurn,
  sendChatMessage,
  saveMessage,
  loadChatSession,
  loadChatMessages,
  openChatRoom,
  getAllSessions,
  deleteChatSession,
  deleteSessionById,
  deleteSessionByTitle,
  getLoggedInUser,
  setCurrentSessionId as setSupabaseSessionId
} from './lib/supabase';
import { initTheme, parseThemeCommand } from './lib/theme';
import { getActiveMemories, saveActiveMemory, clearActiveMemories } from './lib/commands';
import { executeDualEngineSearch, detectSearchIntent, SearchModeType, BLUEFOX_SYSTEM_PROMPT } from './lib/search';
import { 
  getReasoningEffort, 
  getSmartSelectEffort, 
  SmartSelectLevel, 
  SMART_SELECT_CONFIG, 
  SMART_SELECT_STEPS 
} from './lib/reasoning';
import { safeSaveSessionsToLocal, autoPurgeMediaIfStorageFull } from './lib/storageManager';
import { ShareMode, parseSharedDataFromUrl, getSharedChatsRegistry } from './lib/shareChat';
import { getAppStyle, AppStyle } from './lib/styleManager';

// Fungsi pembaca cookie domain bersama (.tmpa.my.id)
function getSharedTmpaSession() {
  const name = "tmpa_session=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
  }
  return "";
}

// Fungsi untuk mengambil token dari cookie tmpa_session
function getTmpaSession() {
  return getSharedTmpaSession();
}

export function redirectToSSO() {
  const ACCOUNT_SSO_URL = 'https://account.tmpa.my.id/sso/authorize';
  const CLIENT_ID = 'bluefox-chat';
  
  let REDIRECT_URI = 'https://bluefox.tmpa.my.id/ticket';
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'chat.tmpa.my.id') {
      REDIRECT_URI = 'https://chat.tmpa.my.id/ticket';
    } else if (window.location.hostname.includes('tmpa.my.id')) {
      REDIRECT_URI = `${window.location.origin}/ticket`;
    } else if (window.location.origin) {
      REDIRECT_URI = `${window.location.origin}/ticket`;
    }
  }

  const deviceId = getOrCreateDeviceId();

  const ssoUrl = new URL(ACCOUNT_SSO_URL);
  ssoUrl.searchParams.set('client_id', CLIENT_ID);
  ssoUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  ssoUrl.searchParams.set('device_id', deviceId);

  console.log("🔄 [SSO Redirect] Mengarahkan ke:", ssoUrl.toString());
  window.location.href = ssoUrl.toString();
}

/**
 * Mengubah baris dari tabel message_bluefox (yang menyimpan user_message dan ai_response per turn)
 * menjadi urutan Message[] untuk UI obrolan.
 */
function parseBluefoxMessages(rows: any[]): Message[] {
  const result: Message[] = [];
  if (!Array.isArray(rows)) return result;

  rows.forEach((item: any, idx: number) => {
    let mediaItems: MediaAttachment[] | undefined = undefined;
    if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
      mediaItems = item.attachments.map((att: any) => {
        const localData = att.local_id ? getFileFromLocalStorage(att.local_id) : null;
        return {
          id: att.local_id || att.id,
          name: att.name || 'Lampiran',
          type: att.type || (att.name?.endsWith('.pdf') ? 'document' : 'image'),
          size: att.size || 0,
          url: localData?.base64 || '',
          textContent: att.textContent,
          pageCount: att.pageCount
        };
      });
    }

    // Format Baru: Kolom user_message & ai_response (disimpan sekaligus per chat turn)
    if (item.user_message !== undefined || item.ai_response !== undefined) {
      if (item.user_message) {
        result.push({
          id: `${item.id || idx}_u`,
          role: 'user',
          text: item.user_message,
          media: mediaItems
        });
      }
      if (item.ai_response) {
        result.push({
          id: `${item.id || idx}_a`,
          role: 'model',
          text: item.ai_response
        });
      }
    } else if (item.content) {
      // Kompatibilitas format legacy jika ada
      result.push({
        id: item.id?.toString() || `${Date.now()}_${idx}`,
        role: (item.sender === 'assistant' || item.sender === 'model') ? 'model' : 'user',
        text: item.content || '',
        media: mediaItems
      });
    }
  });

  return result;
}

export type SupportedModel = 'agnes-2.5-flash' | 'tencent-hy3-free' | 'laguna-s-2.1';

export default function App() {
  const { lang, changeLanguage, t } = useLanguage();
  
  // Ambil sesi obrolan yang tersimpan seketika dari localStorage
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tmpa_chat_sessions');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
    return [];
  });

  // Tentukan session id yang aktif seketika
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const lastId = localStorage.getItem('tmpa_last_active_session_id');
      if (lastId) return lastId;
    }
    return null;
  });

  // Tentukan pesan awal seketika sesuai session yang aktif
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const lastId = localStorage.getItem('tmpa_last_active_session_id');
        if (lastId) {
          const saved = localStorage.getItem('tmpa_chat_sessions');
          if (saved) {
            const sessions: ChatSession[] = JSON.parse(saved);
            const active = sessions.find(s => s.id === lastId);
            if (active && active.messages) return active.messages;
          }
        }
      } catch {}
    }
    return [];
  });

  // State untuk Media Screen Viewer Fullscreen (/screen-:id)
  const [fullscreenMedia, setFullscreenMedia] = useState<MediaAttachment | null>(null);

  const [selectedModel, setSelectedModel] = useState<SupportedModel>(() => {
    try {
      const saved = localStorage.getItem('tmpa_selected_model');
      if (saved === 'agnes-2.5-flash' || saved === 'tencent-hy3-free' || saved === 'laguna-s-2.1') {
        return saved as SupportedModel;
      }
      // Migrasi model lama ke lineup baru:
      if (saved === 'agnes-2.0-flash' || saved === 'bluefox_pro' || saved === 'deepseek-v4.1-flash-free') {
        return 'agnes-2.5-flash';
      }
      if (saved === 'bluefox_standard' || saved === 'tmpa_v1') {
        return 'tencent-hy3-free';
      }
      if (saved === 'bluefox_dilo' || saved === 'longcat-2.0-free' || saved === 'dilo') {
        return 'laguna-s-2.1';
      }
    } catch {}
    return 'agnes-2.5-flash';
  });
  const [isVisionActive, setIsVisionActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tmpa_vision_active') === 'true';
    } catch {
      return false;
    }
  });
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isVisionSelectorOpen, setIsVisionSelectorOpen] = useState(false);
  const [visionLockedNotice, setVisionLockedNotice] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState(false);
  const [isFileHistoryOpen, setIsFileHistoryOpen] = useState(false);



  // State for Bluefox Motion (Animasi visual berbasis kode)
  const [isMotionPanelOpen, setIsMotionPanelOpen] = useState(false);
  const [activeMotionCode, setActiveMotionCode] = useState<string>('');
  const [isMotionManualModalOpen, setIsMotionManualModalOpen] = useState(false);
  const [isMotionLoading, setIsMotionLoading] = useState<boolean>(false);
  const [isMotionFinalizing, setIsMotionFinalizing] = useState<boolean>(false);
  const motionFinalizeResolverRef = useRef<(() => void) | null>(null);



  const handleManualMotionSubmit = (code: string, note?: string) => {
    // 2.A: Mode Opsi Kode Manual (Langsung bungkus ke tag renderer tanpa panggil AI)
    const processResult = processUserInput(code, true);
    if (processResult.type === 'RENDER_MOTION' && processResult.code) {
      const motionCode = processResult.code;
      const userTitle = note?.trim() || (lang === 'id' ? 'Animasi Kode Manual' : 'Manual Motion Code');

      const userMessageId = Date.now().toString();
      const userMsg: Message = {
        id: userMessageId,
        role: 'user',
        text: `\`\`\`html\n${motionCode}\n\`\`\``
      };

      const aiMessageId = (Date.now() + 1).toString();
      const aiReplyText = lang === 'id'
        ? `Berikut adalah visualisasi animasi untuk **${userTitle}** yang langsung dirender ke iframe:\n\n[BLUEFOX_MOTION]\n${motionCode}\n[/BLUEFOX_MOTION]`
        : `Here is the live animation visualization for **${userTitle}** rendered into the iframe:\n\n[BLUEFOX_MOTION]\n${motionCode}\n[/BLUEFOX_MOTION]`;

      const aiMsg: Message = {
        id: aiMessageId,
        role: 'model',
        text: aiReplyText,
        motionCode: motionCode,
        isManualMotion: true
      };

      const nextMessages = [...messages, userMsg, aiMsg];
      setMessages(nextMessages);

      // Otomatis buka panel samping & suntikkan kode ke iframe srcdoc
      setActiveMotionCode(motionCode);
      setIsMotionPanelOpen(true);

      const convId = currentSessionId || getValidUUID(null);
      if (!currentSessionId) {
        setCurrentSessionId(convId);
      }

      saveChatTurn(convId, userMsg.text, aiReplyText).catch(() => {});
      saveSessionsToLocal(
        chatSessions.map(s => s.id === convId ? { ...s, messages: nextMessages, updatedAt: Date.now() } : s)
      );
    }
  };


  
  // State for Long-Press (1s) Chat Session Action Modal & Toast
  const [contextMenuSession, setContextMenuSession] = useState<ChatSession | null>(null);
  const [showActionToast, setShowActionToast] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const [connectors, setConnectors] = useState<Connector[]>([
    { id: '1', name: 'Google Drive', description: 'Akses dan kelola file dokumen', isActive: false, isConfigured: false },
    { id: '2', name: 'Google Calendar', description: 'Lihat dan kelola jadwal acara', isActive: false, isConfigured: false },
    { id: '3', name: 'Google Sheets', description: 'Akses dan baca spreadsheet', isActive: false, isConfigured: false },
    { id: '4', name: 'Google Slides', description: 'Akses presentasi Google', isActive: false, isConfigured: false },
    { id: '5', name: 'Google Gmail', description: 'Baca dan kirim email', isActive: false, isConfigured: false },
  ]);

  const toggleConnector = (id: string) => {
    setConnectors(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const handleEnableVision = () => {
    setIsVisionActive(true);
    setSelectedModel('agnes-2.5-flash');
    try {
      localStorage.setItem('tmpa_vision_active', 'true');
    } catch {}
    setIsVisionSelectorOpen(false);
  };

  const handleDisableVision = () => {
    setIsVisionActive(false);
    try {
      localStorage.setItem('tmpa_vision_active', 'false');
    } catch {}
    setIsVisionSelectorOpen(false);
  };

  const handleSelectModel = (modelId: SupportedModel) => {
    if (isVisionActive && modelId !== 'agnes-2.5-flash') {
      setVisionLockedNotice("Mode Vision sedang aktif: Model dikunci ke Bluefox Pro (agnes-2.5-flash). Nonaktifkan Vision di menu Vision jika ingin memilih model lain.");
      setTimeout(() => setVisionLockedNotice(null), 4000);
      return;
    }
    setSelectedModel(modelId);
    try {
      localStorage.setItem('tmpa_selected_model', modelId);
      localStorage.setItem('tmpa_model_mode', 'bluefox');
    } catch {}
    setIsModelSelectorOpen(false);
    setShowActionToast(lang === 'id' 
      ? `Beralih ke model ${getModelDisplayName(modelId)}` 
      : `Switched to ${getModelDisplayName(modelId)}`);
    setTimeout(() => setShowActionToast(null), 2500);
  };

  const [dbLimits, setDbLimits] = useState<{ used5h: number; usedWeekly: number } | null>(null);

  // Status Mode Development / No Limit dari localStorage browser
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tmpa_dev_mode') === 'true';
    }
    return false;
  });

  // Status Gaya Tampilan Aplikasi (Normal vs Blue Rilis)
  const [appStyle, setAppStyle] = useState<AppStyle>(() => getAppStyle());

  useEffect(() => {
    const syncDevMode = () => {
      setIsDevMode(localStorage.getItem('tmpa_dev_mode') === 'true');
    };
    const syncAppStyle = () => {
      setAppStyle(getAppStyle());
    };
    window.addEventListener('storage', syncDevMode);
    window.addEventListener('storage', syncAppStyle);
    window.addEventListener('tmpa_app_style_changed', syncAppStyle);
    return () => {
      window.removeEventListener('storage', syncDevMode);
      window.removeEventListener('storage', syncAppStyle);
      window.removeEventListener('tmpa_app_style_changed', syncAppStyle);
    };
  }, []);

  const isBlueRilis = appStyle === 'blue_rilis';

  const [usageEvents, setUsageEvents] = useState<{h: number, w: number, ts: number}[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ai_usage_events') || '[]');
    } catch {
      return [];
    }
  });

  const getUsage = () => {
    if (dbLimits) {
      return {
        hourly: Math.min(100, Math.max(0, dbLimits.used5h)),
        weekly: Math.min(100, Math.max(0, dbLimits.usedWeekly)),
      };
    }

    return { 
      hourly: 0, 
      weekly: 0 
    };
  };

  const usage = getUsage();
  // Validasi limit: Sumber kebenaran utama adalah tabel public.user_limits di database Supabase.
  // Pengguna HANYA diblokir jika data tabel used_5h >= 100 ATAU used_weekly >= 100.
  // Jika Mode Development aktif (No Limit), limit tidak pernah memblokir user.
  const isUsageLimitReached = isDevMode 
    ? false 
    : Boolean(dbLimits && (dbLimits.used5h >= 100 || dbLimits.usedWeekly >= 100));

  const updateUsage = (
    model: string, 
    isVision?: boolean, 
    searchMode?: 'standard' | 'advanced' | 'map_standard' | 'map_advanced'
  ) => {
    // Abaikan dan jangan rekam pemotongan kuota jika Mode Development aktif secara lokal
    if (isDevMode || (typeof window !== 'undefined' && localStorage.getItem('tmpa_dev_mode') === 'true')) {
      return;
    }

    let h = 0, w = 0;
    if (model === 'agnes-2.5-flash' || model === 'deepseek-v4.1-flash-free' || model === 'agnes-2.0-flash' || model === 'bluefox_pro' || model === 'qwen3_coder') {
      if (isVision) {
        h = 5; // Bluefox pro vision: 5% per 5 jam
        w = 7; // Bluefox pro vision: 7% weekly
      } else {
        h = 3; // Bluefox pro standar: 3% per 5 jam
        w = 4; // Bluefox pro standar: 4% weekly
      }
    } else if (model === 'tencent-hy3-free' || model === 'bluefox_standard' || model === 'tmpa_v1' || model === 'gpt_oss') {
      // bluefox standard
      h = 2; // 2% per 5 jam
      w = 3; // 3% weekly
    } else if (model === 'laguna-s-2.1' || model === 'bluefox_dilo' || model === 'dilo' || model === 'longcat-2.0-free' || model === 'mistral_nemotron') {
      // bluefox Dilo
      h = 2; // 2% per 5 jam
      w = 2; // 2% weekly
    } else {
      h = 2;
      w = 3;
    }

    if (searchMode) {
      if (searchMode === 'advanced') {
        h += 5;
        w += 3;
      } else if (searchMode === 'standard') {
        h += 3;
        w += 2;
      } else if (searchMode === 'map_advanced') {
        h += 7;
        w += 4;
      } else if (searchMode === 'map_standard') {
        h += 6;
        w += 3;
      }
    }
    
    const newEvent = { h, w, ts: Date.now() };
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const nextEvents = [...usageEvents.filter(e => e.ts > oneWeekAgo), newEvent];
    
    setUsageEvents(nextEvents);
    localStorage.setItem('ai_usage_events', JSON.stringify(nextEvents));
  };


  const [errorState, setErrorState] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [smartSelectLevel, setSmartSelectLevel] = useState<SmartSelectLevel>('auto');
  const [isSmartSelectOpen, setIsSmartSelectOpen] = useState(false);
  const reasoningMode: 'standar' | 'penalaran' = smartSelectLevel === 'high' ? 'penalaran' : 'standar';
  const [quotaModalInfo, setQuotaModalInfo] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    used5h?: number;
    usedWeekly?: number;
  }>({
    isOpen: false,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleResetLimits = async () => {
    setUsageEvents([]);
    localStorage.setItem('ai_usage_events', '[]');
    setDbLimits({ used5h: 0, usedWeekly: 0 });
    
    let targetUserId = user?.id;
    if (!targetUserId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) targetUserId = authData.user.id;
      } catch {}
    }
    if (!targetUserId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) targetUserId = sessionData.session.user.id;
      } catch {}
    }

    if (targetUserId) {
      await resetUserLimits(targetUserId);
    }
    showToast(lang === 'id' ? 'Kuota dan limit penggunaan AI berhasil direset ke 0% (Dev Mode)!' : 'Usage limits successfully reset to 0% (Dev Mode)!');
    setShowActionToast(lang === 'id' ? 'Limit AI direset ke 0% (Dev Mode)' : 'AI limits reset to 0% (Dev Mode)');
    setTimeout(() => setShowActionToast(null), 3000);
  };
  const isReasoningSelectorOpen = isSmartSelectOpen;
  const setIsReasoningSelectorOpen = setIsSmartSelectOpen;
  const [searchQuery, setSearchQuery] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharedAccessMode, setSharedAccessMode] = useState<ShareMode | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const hasExistingSession = localStorage.getItem('tmpa_chat_sessions') || localStorage.getItem('tmpa_last_active_session_id') || localStorage.getItem('tmpa_user_profile');
      const isSpecialRoute = window.location.pathname.startsWith('/screen-') || 
        window.location.pathname.startsWith('/share-') ||
        window.location.hash.includes('share-') ||
        window.location.search.includes('share=') ||
        window.location.pathname.startsWith('/verify') || 
        window.location.pathname.startsWith('/integrations');
      if (hasExistingSession || isSpecialRoute) return false;
    }
    return true;
  });

  const [appState, setAppState] = useState<'landing' | 'login' | 'chat' | 'verify' | 'integrations'>(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/verify')) return 'verify';
      if (currentPath.startsWith('/settings/integrations') || currentPath.startsWith('/integrations')) return 'integrations';
      const isShareRoute = currentPath.startsWith('/share-') || 
        window.location.hash.includes('share-') ||
        window.location.search.includes('share=');
      if (isShareRoute) return 'chat';
      const lastSessionId = localStorage.getItem('tmpa_last_active_session_id');
      const localSessions = localStorage.getItem('tmpa_chat_sessions');
      if (lastSessionId || (localSessions && localSessions !== '[]') || currentPath.startsWith('/screen-')) {
        return 'chat';
      }
    }
    return 'landing';
  });
  const [user, setUser] = useState<any>(null);
  const [userTier, setUserTier] = useState<string>('Loading...');
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncingSSO, setIsSyncingSSO] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Mendeteksi parameter SSO...');
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMenuLoadMoreOpen, setIsMenuLoadMoreOpen] = useState(false);
  const [isChooseAccountOpen, setIsChooseAccountOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserStoppedRef = useRef(false);
  const typewriterIntervalRef = useRef<any>(null);
  const isExchangingRef = useRef(false);

  // Rekam akun aktif saat ini ke daftar akun lokal perangkat (localStorage)
  useEffect(() => {
    if (user) {
      recordCurrentSession(user, userTier);
    }
  }, [user, userTier]);

  const handleLandingStart = async () => {
    if (user) {
      setAppState('chat');
      return;
    }
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session && session.user) {
        setUser(session.user);
        setAppState('chat');
        return;
      }
    } catch (err) {
      console.warn("Gagal cek session saat klik Start:", err);
    }

    // Arahkan ke halaman verifikasi sesi Bluefox (/verify)
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'bluefox.tmpa.my.id') {
        window.location.href = 'https://bluefox.tmpa.my.id/verify';
        return;
      } else if (window.location.hostname.includes('tmpa.my.id')) {
        window.location.href = `${window.location.origin}/verify`;
        return;
      }
    }

    // Lingkungan preview / local dev: langsung masuk ke chat
    setAppState('chat');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Gagal signOut manual:", err);
    }
    setUser(null);
    setAppState('landing');
  };

  // Handler Berpindah Akun Instan dari Popup Bottom Sheet
  const handleSwitchAccount = async (account: SavedAccount) => {
    setShowActionToast(lang === 'id' ? `Beralih ke ${account.email}...` : `Switching to ${account.email}...`);
    try {
      const res = await switchSavedAccount(account);
      if (res.success) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          setUser(authData.user);
          try {
            const limits = await getUserLimits(authData.user.id);
            if (limits) {
              setDbLimits({
                used5h: limits.used_5h,
                usedWeekly: limits.used_weekly,
              });
            }
          } catch {}
          fetchUserSessions();
        } else {
          setUser({
            id: account.id,
            email: account.email,
            user_metadata: { full_name: account.name }
          } as any);
        }
        setShowActionToast(lang === 'id' ? `Berhasil masuk sebagai ${account.name || account.email}` : `Logged in as ${account.name || account.email}`);
        setTimeout(() => setShowActionToast(null), 2500);
      } else {
        setShowActionToast(lang === 'id' ? 'Gagal beralih akun. Silakan login kembali.' : 'Failed to switch account.');
        setTimeout(() => setShowActionToast(null), 3000);
      }
    } catch (err: any) {
      console.error("Gagal beralih akun:", err);
      setShowActionToast(lang === 'id' ? 'Gagal beralih akun' : 'Failed to switch account');
      setTimeout(() => setShowActionToast(null), 2500);
    }
  };

  const handleAddAccount = () => {
    // 1. Cek apakah ada akun lain di penyimpanan lokal perangkat
    const localAccounts = getSavedAccounts(user, userTier);
    const otherAccounts = localAccounts.filter(a => a.id !== user?.id && a.email !== user?.email);
    if (otherAccounts.length > 0) {
      setShowActionToast(lang === 'id' ? `Ditemukan ${otherAccounts.length} akun lain di perangkat ini.` : `Found ${otherAccounts.length} other accounts.`);
      setTimeout(() => setShowActionToast(null), 2500);
      setIsChooseAccountOpen(true);
    } else {
      // 2. Jika belum ada akun lain, buka alur penambahan akun dengan tmpa_device_id
      redirectToSSO();
    }
  };

  const handleCreateAccount = () => {
    // Proses sama seperti saat user pertama kali masuk (SSO dengan tmpa_device_id)
    redirectToSSO();
  };

  const sortSessions = (sessions: ChatSession[]) => {
    // Deduplikasi ketat berdasarkan ID sesi agar tidak ada sesi duplikat di sidebar
    const seen = new Set<string>();
    const unique: ChatSession[] = [];
    for (const s of sessions) {
      if (!s || !s.id) continue;
      if (!seen.has(s.id)) {
        seen.add(s.id);
        unique.push(s);
      }
    }
    return unique.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  };

  const saveSessionsToLocal = (sessions: ChatSession[]) => {
    const sorted = sortSessions(sessions);
    setChatSessions(sorted);
    safeSaveSessionsToLocal(sorted);
  };

  const startNewChat = () => {
    // 1. Hentikan pemrosesan AI jika sedang berjalan
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isUserStoppedRef.current = true;
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    setIsLoading(false);
    setErrorState(null);

    // 2. Kosongkan riwayat percakapan dan reset ID sesi
    setMessages([]);
    setCurrentSessionId(null);
    setSupabaseSessionId(null);

    // 3. Bersihkan cache sesi aktif di localStorage
    try {
      localStorage.removeItem('tmpa_last_active_session_id');
    } catch {}

    // 4. Tutup sidebar
    setIsSidebarOpen(false);
  };

  const loadSession = async (sessionId: string) => {
    if (!sessionId) return;
    setIsSidebarOpen(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setErrorState(null);

    setCurrentSessionId(sessionId);
    setSupabaseSessionId(sessionId);
    try {
      localStorage.setItem('tmpa_last_active_session_id', sessionId);
    } catch {}

    // 1. Bersihkan layar UI chat dan TAMPILKAN ulang seluruh data dari Supabase
    try {
      const dbMsgs = await openChatRoom(sessionId);
      const hydratedMessages = parseBluefoxMessages(dbMsgs);
      if (hydratedMessages && hydratedMessages.length > 0) {
        setMessages(hydratedMessages);
        return;
      }
    } catch (err) {
      console.warn("Gagal openChatRoom dari Supabase:", err);
    }

    // Fallback jika sudah ada di cache lokal
    const session = chatSessions.find(s => s.id === sessionId);
    if (session && session.messages && session.messages.length > 0) {
      setMessages(session.messages);
      if (session.model) {
        setSelectedModel(session.model as any);
      }
    } else {
      setMessages([]);
    }

    // Pastikan ID sesi ini terdaftar di chatSessions agar tidak terbagi dua saat pengguna mengirim chat
    setChatSessions((prev) => {
      if (prev.some(s => s.id === sessionId)) return prev;
      return sortSessions([
        {
          id: sessionId,
          title: session?.title || 'Percakapan',
          messages: session?.messages || [],
          updatedAt: Date.now(),
          model: (session?.model as any) || 'agnes-2.5-flash',
          isPinned: false
        },
        ...prev
      ]);
    });
  };

  // Sinkronisasi Sesi & Seluruh Isi Chat Lintas Perangkat langsung dari Supabase (tanpa membajak room aktif)
  const syncSessionsFromSupabase = useCallback(async (options?: { preferredSessionId?: string | null; isInitialMount?: boolean }) => {
    try {
      const dbSessions = await fetchUserSessions();
      if (dbSessions && dbSessions.length > 0) {
        const formatted: ChatSession[] = dbSessions.map((s: any) => ({
          id: s.id,
          title: s.title || 'Percakapan',
          messages: [],
          updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
          model: 'agnes-2.5-flash',
          isPinned: false
        }));

        setChatSessions((prev) => {
          const pinnedMap = new Map(prev.filter(p => p.isPinned).map(p => [p.id, true]));
          const prevMessagesMap = new Map(prev.map(p => [p.id, p.messages || []]));
          const combined = formatted.map(f => ({
            ...f,
            isPinned: pinnedMap.has(f.id),
            messages: prevMessagesMap.get(f.id) || []
          }));
          return sortSessions(combined);
        });

        // Buka sesi HANYA jika diminta secara eksplisit via preferredSessionId ATAU saat pertama kali aplikasi dibuka dengan sesi tersimpan
        if (options?.preferredSessionId && dbSessions.some((s: any) => s.id === options.preferredSessionId)) {
          await loadSession(options.preferredSessionId);
        } else if (options?.isInitialMount) {
          const savedLastId = typeof window !== 'undefined' ? localStorage.getItem('tmpa_last_active_session_id') : null;
          if (savedLastId && dbSessions.some((s: any) => s.id === savedLastId)) {
            await loadSession(savedLastId);
          }
        }
      }
    } catch (err) {
      console.warn("Gagal sinkronisasi sesi dari Supabase:", err);
    }
  }, []);

  useEffect(() => {
    initTheme();
    const saved = localStorage.getItem('tmpa_chat_sessions');
    if (saved) {
      try {
        setChatSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }

    // Muat daftar sesi dari database Supabase (tabel session_bluefox milik user)
    syncSessionsFromSupabase({ isInitialMount: true });

    const savedInstruction = localStorage.getItem('tmpa_custom_instruction');
    if (savedInstruction) {
      setCustomInstruction(savedInstruction);
    }

    async function checkAuthAndCallback() {
      try {
        setAuthChecking(true);
        const urlParams = new URLSearchParams(window.location.search);
        const currentPath = window.location.pathname;

        // 0. CEK RUTE /verify (VerifyPage)
        if (currentPath.startsWith('/verify') || urlParams.get('page') === 'verify' || urlParams.get('view') === 'verify') {
          setAppState('verify');
          setAuthChecking(false);
          setShowSplash(false);
          return;
        }

        // 0.1 CEK RUTE /settings/integrations atau /integrations (IntegrationsPage)
        if (
          currentPath.startsWith('/settings/integrations') || 
          currentPath.startsWith('/integrations') ||
          urlParams.get('page') === 'integrations' || 
          urlParams.get('view') === 'integrations'
        ) {
          setAppState('integrations');
          setAuthChecking(false);
          setShowSplash(false);
          return;
        }

        // 1. TANGKAP PARAMETER TIKET SSO (?ticket=... ATAU PATH /ticket)
        const ticketParam = urlParams.get('ticket');
        const isTicketPath = currentPath.startsWith('/ticket') || urlParams.has('ticket');

        if (isTicketPath) {
          if (!ticketParam) {
            // Jika tidak ada tiket (misal membuka /ticket secara manual), lemparkan ke Hub SSO
            redirectToSSO();
            return;
          }

          // 🔒 2. CEK PENGUNCI: Gunakan sessionStorage & useRef agar tidak dieksekusi 2x
          const ticketLockKey = `sso_lock_${ticketParam}`;
          if (isExchangingRef.current || sessionStorage.getItem(ticketLockKey)) {
            console.log("🔒 [Bluefox SSO] Tiket sedang/sudah diproses, mencegah eksekusi ganda:", ticketParam);
            return;
          }

          // Tandai bahwa proses penukaran sedang berjalan
          isExchangingRef.current = true;
          sessionStorage.setItem(ticketLockKey, 'processing');

          // Hapus parameter ticket dari URL browser secara diam-diam agar tidak dipanggil ulang
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);

          // Ada tiket -> Tukarkan via Edge Function exchange-sso-ticket
          setIsSyncingSSO(true);
          setSyncStatus(lang === 'id' ? 'Memverifikasi Sesi... Mohon tunggu sebentar, sedang menyambungkan akun Anda.' : 'Verifying Session... Please wait a moment, connecting your account.');
          console.log("[Bluefox Chat] Tiket SSO terdeteksi, memproses autentikasi...");

          try {
            const edgeData = await exchangeSsoTicket(ticketParam);

            setSyncStatus('Menyiapkan sesi aplikasi...');

            let activeUser = null;

            // Jika Edge Function mengembalikan token_hash
            if (edgeData?.token_hash) {
              const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: edgeData.token_hash,
                type: 'magiclink',
              });

              if (verifyError) {
                console.error(`[Auth Error] Gagal memverifikasi sesi: ${verifyError.message}`);
                throw verifyError;
              }

              console.log("🎉 [Bluefox Chat] Berhasil Login sebagai:", authData.user?.email);
              activeUser = authData.user;
            } 
            // Jika Edge Function mengembalikan session langsung
            else if (edgeData?.session) {
              const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
                access_token: edgeData.session.access_token,
                refresh_token: edgeData.session.refresh_token,
              });

              if (sessionErr) {
                console.error(`[Auth Error] Gagal memasang sesi: ${sessionErr.message}`);
                throw sessionErr;
              }

              activeUser = sessionData?.user;
            }

            // Simpan profil pengguna lokal jika ada
            if (edgeData?.user_profile) {
              localStorage.setItem('tmpa_user_profile', JSON.stringify(edgeData.user_profile));
            }

            // Jika belum terambil, coba ambil dari current session
            if (!activeUser) {
              const { data: { user } } = await supabase.auth.getUser();
              activeUser = user;
            }

            if (activeUser) {
              setUser(activeUser);

              // Buat 1 ID unik untuk user itu yang disimpan di local bernama "tmpa_device_id"
              // dan simpan akun ke daftar akun lokal
              registerAccountDeviceSession(
                activeUser,
                {
                  access_token: edgeData?.session?.access_token,
                  refresh_token: edgeData?.session?.refresh_token
                },
                userTier
              );
              try {
                const userEmail = activeUser.email || '';
                const userName = activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'TMPA User';
                const userId = activeUser.id;
                await supabase
                  .from('users')
                  .upsert(
                    [{ email: userEmail, nama: userName, user_id: userId, id: userId }],
                    { onConflict: 'email' }
                  );
              } catch (uErr) {
                console.warn("Gagal upsert user via ticket:", uErr);
              }

              // Ambil plan
              try {
                const { data: profil } = await supabase
                  .from('users')
                  .select('plan')
                  .eq('id', activeUser.id)
                  .single();

                if (profil && profil.plan) {
                  setUserTier(profil.plan.toUpperCase());
                } else {
                  setUserTier("FREE (DEFAULT)");
                }
              } catch (e) {
                setUserTier("FREE (DEFAULT)");
              }

              setSyncStatus('Selesai! Membuka ruang chat...');
              setAppState('chat');

              // Bersihkan URL dari parameter ?ticket=... agar tampil cantik di browser
              window.history.replaceState({}, document.title, cleanUrl);
              return;
            } else {
              throw new Error("Gagal memperoleh data user dari tiket SSO.");
            }
          } catch (ticketErr: any) {
            console.error("Gagal melakukan exchange tiket SSO di Bluefox:", ticketErr);
            sessionStorage.removeItem(ticketLockKey);
            isExchangingRef.current = false;
            setErrorState(`[Bluefox Login] ${ticketErr.message || 'Tiket SSO tidak valid'}`);
            setAppState('landing');
            return;
          } finally {
            setIsSyncingSSO(false);
          }
        }

        // 2. Tangkap token dari URL lama (access_token & refresh_token jika ada)
        let accessToken = urlParams.get('access_token');
        let refreshToken = urlParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = accessToken || hashParams.get('access_token');
          refreshToken = refreshToken || hashParams.get('refresh_token');
        }

        if (accessToken && refreshToken) {
          setIsSyncingSSO(true);
          setSyncStatus('Menyinkronkan Sesi Menggunakan Supabase...');
          
          try {
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken.trim(),
              refresh_token: refreshToken.trim()
            });

            if (!sessionError && data && data.user) {
              const activeUser = data.user;
              setUser(activeUser);
              
              setSyncStatus('Menyinkronkan profil pengguna ke database...');
              const userEmail = activeUser.email || '';
              const userName = activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'TMPA User';
              const userId = activeUser.id;

              try {
                await supabase
                  .from('users')
                  .upsert(
                    [{ email: userEmail, nama: userName, user_id: userId, id: userId }], 
                    { onConflict: 'email' }
                  );
              } catch (upsertErr) {
                console.warn("Gagal melakukan upsert user saat SSO:", upsertErr);
              }

              try {
                const { data: profil } = await supabase
                  .from('users')
                  .select('plan')
                  .eq('id', activeUser.id)
                  .single();

                if (profil && profil.plan) {
                  setUserTier(profil.plan.toUpperCase());
                } else {
                  setUserTier("FREE (DEFAULT)");
                }
              } catch (err) {
                setUserTier("FREE (DEFAULT)");
              }

              setSyncStatus('Sinkronisasi berhasil! Membuka ruang chat...');
              setAppState('chat');

              const cleanUrl = window.location.origin + '/';
              window.history.replaceState({}, document.title, cleanUrl);
              return;
            } else {
              setAppState('landing');
            }
          } catch (e: any) {
            console.error("Gagal menukarkan token dengan Supabase:", e);
            setAppState('landing');
          } finally {
            setIsSyncingSSO(false);
          }
        }

        // 3. Coba cari di cookie klien 'tmpa_session' (cookie domain bersama .tmpa.my.id)
        const clientCookieToken = getSharedTmpaSession();
        if (clientCookieToken) {
          try {
            let parsedAccessToken = clientCookieToken;
            let parsedRefreshToken = clientCookieToken;
            
            if (clientCookieToken.trim().startsWith('{')) {
              try {
                const cookieObj = JSON.parse(clientCookieToken);
                parsedAccessToken = cookieObj.access_token || cookieObj.accessToken || clientCookieToken;
                parsedRefreshToken = cookieObj.refresh_token || cookieObj.refreshToken || parsedAccessToken;
              } catch (e) {
                console.warn("Gagal parse JSON dari cookie tmpa_session:", e);
              }
            }
            
            const { data: sessData, error: sessErr } = await supabase.auth.setSession({
              access_token: parsedAccessToken.trim(),
              refresh_token: parsedRefreshToken.trim()
            });
            
            if (!sessErr && sessData && sessData.user) {
              const activeUser = sessData.user;
              setUser(activeUser);
              
              const userEmail = activeUser.email || '';
              const userName = activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'TMPA User';
              const userId = activeUser.id;

              try {
                await supabase
                  .from('users')
                  .upsert(
                    [{ email: userEmail, nama: userName, user_id: userId, id: userId }], 
                    { onConflict: 'email' }
                  );
              } catch (upsertErr) {
                console.warn("Gagal upsert cookie user:", upsertErr);
              }

              try {
                const { data: profil } = await supabase
                  .from('users')
                  .select('plan')
                  .eq('id', activeUser.id)
                  .single();

                if (profil && profil.plan) {
                  setUserTier(profil.plan.toUpperCase());
                } else {
                  setUserTier("FREE (DEFAULT)");
                }
              } catch (err) {
                setUserTier("FREE (DEFAULT)");
              }
              
              setAppState('chat');
              return;
            }
          } catch (sessErr: any) {
            console.error("Gagal inisialisasi sesi via cookie tmpa_session:", sessErr);
          }
        }

        // 4. Coba cari sesi lokal Supabase
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (!error && session && session.user) {
            setUser(session.user);
            setAppState('chat');
            return;
          }
        } catch (localSessErr) {
          console.warn("Gagal mendapatkan sesi lokal:", localSessErr);
        }

        // 5. TIDAK ADA SESI: JIKA USER SUDAH ADA SESI LOKAL, TETAP DI CHAT TANPA LOADING
        const hasLocalSessions = localStorage.getItem('tmpa_chat_sessions');
        const lastSessionId = localStorage.getItem('tmpa_last_active_session_id');
        if ((hasLocalSessions && hasLocalSessions !== '[]') || lastSessionId) {
          console.log("Sesi lokal pengguna ditemukan. Mempertahankan ruang chat.");
          setAppState('chat');
        } else {
          console.log("Tidak ada sesi terdeteksi. Menampilkan Landing Page.");
          setAppState('landing');
        }
      } catch (err: any) {
        console.error("Gagal verifikasi sesi utama:", err);
        const hasLocalSessions = localStorage.getItem('tmpa_chat_sessions');
        if (hasLocalSessions && hasLocalSessions !== '[]') {
          setAppState('chat');
        } else {
          setAppState('landing');
        }
      } finally {
        setAuthChecking(false);
      }
    }

    checkAuthAndCallback();

    // Listener perubahan state auth (menjaga sesi tetap hidup saat token direfresh otomatis)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔔 Auth Event terjadi:", event);
      if (session?.user) {
        setUser(session.user);
        setAppState('chat');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAppState('landing');
      }
    });

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (user && hasValidConfig) {
      const fetchTierAndLimits = async () => {
        try {
          // Gunakan .maybeSingle() agar PostgREST tidak mengembalikan status HTTP 406 (Not Acceptable) jika baris user belum dibuat
          const { data: profil, error } = await supabase
            .from('users')
            .select('plan')
            .eq('id', user.id)
            .maybeSingle();

          if (!error && profil?.plan) {
            setUserTier(profil.plan.toUpperCase());
          } else if (user.user_metadata?.plan || (user as any).app_metadata?.plan) {
            setUserTier((user.user_metadata?.plan || (user as any).app_metadata?.plan).toUpperCase());
          } else {
            setUserTier("FREE (DEFAULT)");
          }
        } catch {
          setUserTier("FREE (DEFAULT)");
        }

        // Sinkronisasi limit dari tabel user_limits
        try {
          const limits = await getUserLimits(user.id);
          if (limits) {
            setDbLimits({
              used5h: limits.used_5h,
              usedWeekly: limits.used_weekly,
            });
          }
        } catch (lErr) {
          console.warn("Gagal inisialisasi user_limits:", lErr);
        }
      };
      fetchTierAndLimits();
      syncSessionsFromSupabase();
    }
  }, [user, syncSessionsFromSupabase]);

  const handleCustomInstructionChange = (val: string) => {
    setCustomInstruction(val);
    localStorage.setItem('tmpa_custom_instruction', val);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Realtime & Load Chat History integration with Supabase (Anti-duplicate logic)
  useEffect(() => {
    if (appState !== 'chat' || !currentSessionId) return;

    const convId = currentSessionId;

    // Helper deduplikasi pesan
    const mergeWithoutDuplicates = (existing: Message[], incoming: Message[]): Message[] => {
      const result = [...existing];
      for (const inc of incoming) {
        const incText = (inc.text || '').trim();
        const idx = result.findIndex(
          (m) => m.id === inc.id || (m.role === inc.role && m.text.trim() === incText && incText.length > 0)
        );
        if (idx === -1) {
          result.push(inc);
        } else {
          result[idx] = { ...result[idx], id: inc.id };
        }
      }
      return result;
    };

    // Ambil Riwayat Chat saat pertama kali membuka room dari tabel message_bluefox
    loadChatSession(convId).then((res) => {
      const historyMsgs = parseBluefoxMessages(res);
      if (historyMsgs && historyMsgs.length > 0) {
        setMessages((prev) => {
          if (prev.length === 0) return historyMsgs;
          return mergeWithoutDuplicates(prev, historyMsgs);
        });
      } else {
        // Fallback ke tabel legacy jika ada
        loadChatHistory(convId).then((data) => {
          if (data && data.length > 0) {
            const legacyMsgs: Message[] = data.map((item: any) => ({
              id: item.id?.toString() || Date.now().toString() + Math.random(),
              role: (item.role === 'assistant' || item.role === 'model') ? 'model' : 'user',
              text: item.content || item.text || '',
            }));
            
            setMessages((prev) => {
              if (prev.length === 0) return legacyMsgs;
              return mergeWithoutDuplicates(prev, legacyMsgs);
            });
          }
        }).catch(() => {});
      }
    }).catch((e) => {
      console.warn("Gagal memuat histori dari Supabase:", e);
    });

    // Mendengarkan Pesan Masuk secara REALTIME tanpa duplikasi
    const unsubscribe = listenToRealtimeMessages(convId, (newMessage) => {
      console.log("[Realtime] Pesan baru diterima dari Supabase:", newMessage);
      const incText = (newMessage.content || newMessage.text || '').trim();
      const uiRole = (newMessage.role === 'assistant' || newMessage.role === 'model') ? 'model' : 'user';
      const uiId = newMessage.id?.toString() || Date.now().toString();

      setMessages((prev) => {
        // Cek apakah pesan sudah ada di state (berdasarkan id atau isi teks & role)
        const existsIndex = prev.findIndex(
          (m) => m.id === uiId || (m.role === uiRole && m.text.trim() === incText && incText.length > 0)
        );

        if (existsIndex !== -1) {
          // Update id agar tersinkron dengan DB tanpa membuat duplikat bubble
          const updated = [...prev];
          updated[existsIndex] = { ...updated[existsIndex], id: uiId };
          return updated;
        }

        const uiMsg: Message = {
          id: uiId,
          role: uiRole,
          text: newMessage.content || newMessage.text || '',
        };
        return [...prev, uiMsg];
      });

      if (uiRole === 'model') {
        setIsLoading(false);
      }
    });

    // Mendengarkan Pesan Masuk dua arah dari message_bluefox (sinkronisasi Web <-> Telegram Bot)
    const unsubscribeBluefox = listenToBluefoxSessionMessages(convId, (row) => {
      console.log("[Realtime Bluefox] Pesan baru dari Telegram/Web:", row);
      if (row.user_message) {
        setMessages(prev => {
          const exists = prev.some(m => m.role === 'user' && m.text.trim() === row.user_message.trim());
          if (exists) return prev;
          return [...prev, {
            id: `${row.id}_u`,
            role: 'user',
            text: row.user_message
          }];
        });
      }
      if (row.ai_response) {
        setMessages(prev => {
          const exists = prev.some(m => m.role === 'model' && m.text.trim() === row.ai_response.trim());
          if (exists) return prev;
          return [...prev, {
            id: `${row.id}_a`,
            role: 'model',
            text: row.ai_response
          }];
        });
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeBluefox();
    };
  }, [appState, currentSessionId]);

  const handleTogglePinChat = (session: ChatSession) => {
    const isCurrentlyPinned = Boolean(session.isPinned);
    const updatedSessions = chatSessions.map(s => 
      s.id === session.id ? { ...s, isPinned: !isCurrentlyPinned, updatedAt: Date.now() } : s
    );
    saveSessionsToLocal(updatedSessions);
    setShowActionToast(!isCurrentlyPinned ? t.chatPinned : t.chatUnpinned);
    setTimeout(() => setShowActionToast(null), 2500);
    setContextMenuSession(null);
  };

  const handleDeleteChatSession = async (session: ChatSession) => {
    await deleteSessionById(session.id);
    const updatedSessions = chatSessions.filter(s => s.id !== session.id);
    setChatSessions(updatedSessions);
    saveSessionsToLocal(updatedSessions);
    if (currentSessionId === session.id) {
      startNewChat();
    }
    setShowActionToast(t.chatDeleted);
    setTimeout(() => setShowActionToast(null), 2500);
    setContextMenuSession(null);
  };

  const startLongPress = (session: ChatSession) => {
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    isLongPressRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setContextMenuSession(session);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(60); } catch {}
      }
    }, 1000); // Tahan tepat 1 detik (1000ms)
  };

  const cancelLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // Handler untuk membuka halaman media fullscreen (/screen-:id)
  const handleOpenMediaScreen = (mediaItem: MediaAttachment) => {
    const mediaId = mediaItem.id || 'media-' + Math.random().toString(36).substring(2, 9);
    const resolvedMedia: MediaAttachment = { ...mediaItem, id: mediaId };
    try {
      localStorage.setItem(`tmpa_media_${mediaId}`, JSON.stringify(resolvedMedia));
    } catch {
      // Jika penyimpanan penuh, langsung bersihkan media lama untuk memberi ruang
      autoPurgeMediaIfStorageFull();
      try {
        localStorage.setItem(`tmpa_media_${mediaId}`, JSON.stringify(resolvedMedia));
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({ screenId: mediaId }, '', `/screen-${mediaId}`);
    }
    setFullscreenMedia(resolvedMedia);
  };

  const handleCloseMediaScreen = () => {
    setFullscreenMedia(null);
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/screen-')) {
      window.history.pushState(null, '', '/');
    }
  };

  // Event listener untuk sinkronisasi pembersihan storage secara global
  useEffect(() => {
    const handleMediaCleared = () => {
      // Bersihkan base64 url dari state aktif agar hemat memori
      setMessages(prev => prev.map(m => {
        let updatedMedia = m.media;
        if (updatedMedia) {
          if (Array.isArray(updatedMedia)) {
            updatedMedia = updatedMedia.map(item => item.url?.startsWith('data:') ? { ...item, url: '' } : item);
          } else if (updatedMedia.url?.startsWith('data:')) {
            updatedMedia = { ...updatedMedia, url: '' };
          }
        }
        return { ...m, media: updatedMedia };
      }));
    };

    const handleSessionsCleared = () => {
      setChatSessions([]);
      setMessages([]);
      setCurrentSessionId(null);
    };

    const handleAutoPurged = () => {
      setShowActionToast(t.used ? 'Memori penuh: Media otomatis dibersihkan' : 'Storage full: Media auto-cleared');
      setTimeout(() => setShowActionToast(null), 3000);
    };

    window.addEventListener('tmpa_media_cleared', handleMediaCleared);
    window.addEventListener('tmpa_sessions_cleared', handleSessionsCleared);
    window.addEventListener('tmpa_storage_auto_purged', handleAutoPurged);

    return () => {
      window.removeEventListener('tmpa_media_cleared', handleMediaCleared);
      window.removeEventListener('tmpa_sessions_cleared', handleSessionsCleared);
      window.removeEventListener('tmpa_storage_auto_purged', handleAutoPurged);
    };
  }, [t]);

  // Deteksi rute URL /screen-:id secara langsung (saat dibuka / direfresh)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/screen-')) {
        const sId = path.replace(/^\/screen-/, '');
        try {
          const cached = localStorage.getItem(`tmpa_media_${sId}`);
          if (cached) {
            setFullscreenMedia(JSON.parse(cached));
            return;
          }
        } catch {}

        // Cari di seluruh riwayat sesi
        const found = chatSessions
          .flatMap(s => s.messages)
          .flatMap(m => (m.media ? (Array.isArray(m.media) ? m.media : [m.media]) : []))
          .find(m => m.id === sId || (m.url && m.url.includes(sId)));

        if (found) {
          setFullscreenMedia(found);
        }
      } else {
        setFullscreenMedia(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState();
    return () => window.removeEventListener('popstate', handlePopState);
  }, [chatSessions]);

  // Deteksi rute URL /share-(ID) untuk mode: Read, Remix, Edit
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCheckSharedRoute = async () => {
      const { sessionId, mode, snapshotData } = parseSharedDataFromUrl();
      if (!sessionId) return;

      console.log('🔗 [Share Route Detected]', { sessionId, mode, hasSnapshot: Boolean(snapshotData) });

      // Pastikan tampilan diarahkan langsung ke percakapan dan tutup splash
      setShowSplash(false);
      setAppState('chat');

      const resolvedMode: ShareMode = mode || 'read';

      // 1. Ekstrak pesan dari snapshotData, registry lokal, chatSessions, atau Supabase
      let loadedMessages: Message[] = [];
      let sessionTitle = 'Obrolan Dibagikan';
      let sessionModel: SupportedModel = selectedModel;

      if (snapshotData && Array.isArray(snapshotData.messages) && snapshotData.messages.length > 0) {
        loadedMessages = snapshotData.messages;
        if (snapshotData.title) sessionTitle = snapshotData.title;
        if (snapshotData.model) sessionModel = snapshotData.model;
      } else {
        const registry = getSharedChatsRegistry();
        const recorded = registry[sessionId] || Object.values(registry).find(r => r.id === sessionId || r.sessionId === sessionId);
        if (recorded && recorded.messagesSnapshot && recorded.messagesSnapshot.length > 0) {
          loadedMessages = recorded.messagesSnapshot;
          sessionTitle = recorded.title;
        } else {
          const localMatch = chatSessions.find(s => s.id === sessionId || (recorded && s.id === recorded.sessionId));
          if (localMatch && localMatch.messages && localMatch.messages.length > 0) {
            loadedMessages = localMatch.messages;
            sessionTitle = localMatch.title;
          } else {
            try {
              const res = await openChatRoom(sessionId);
              if (res && Array.isArray(res) && res.length > 0) {
                loadedMessages = res.map((m: any) => ({
                  id: m.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  role: (m.sender === 'user' || m.role === 'user') ? 'user' : 'model',
                  text: m.content || m.message || m.text || '',
                }));
              }
            } catch (err) {
              console.warn('Gagal memuat pesan share dari Supabase:', err);
            }
          }
        }
      }

      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }

      if (resolvedMode === 'read') {
        // Mode Read: Hanya bisa baca, input prompt hilang, sesi tidak disimpan di chat user
        setSharedAccessMode('read');
        setCurrentSessionId(sessionId);
      } else if (resolvedMode === 'remix') {
        // Mode Remix: Semua konteks window terbawa ke bawah, sesi awal tidak disimpan ke list sampai user chat
        setSharedAccessMode('remix');
        setCurrentSessionId(`remix_${sessionId}`);
      } else if (resolvedMode === 'edit') {
        // Mode Edit: Melanjutkan sesi chat sepenuhnya, langsung tersimpan di riwayat user walaupun belum mengetik
        setSharedAccessMode(null);
        setCurrentSessionId(sessionId);

        setChatSessions((prev) => {
          const exists = prev.some(s => s.id === sessionId);
          if (exists) return prev;
          const newSession: ChatSession = {
            id: sessionId,
            title: sessionTitle,
            model: sessionModel,
            updatedAt: Date.now(),
            messages: loadedMessages,
            isPinned: false,
          };
          const updated = [newSession, ...prev];
          safeSaveSessionsToLocal(updated);
          try {
            localStorage.setItem('tmpa_last_active_session_id', sessionId);
          } catch {}
          return updated;
        });
      }
    };

    handleCheckSharedRoute();
    window.addEventListener('popstate', handleCheckSharedRoute);
    return () => window.removeEventListener('popstate', handleCheckSharedRoute);
  }, []);

  const handleEditMessage = (id: string, newText: string) => {
    const editIndex = messages.findIndex(m => m.id === id);
    if (editIndex === -1) return;

    const baseHistory = messages.slice(0, editIndex);
    handleSendMessage(newText, baseHistory);
  };

  const handleRetryMessage = (aiMessageId: string) => {
    const aiIdx = messages.findIndex(m => m.id === aiMessageId);
    if (aiIdx === -1) return;

    // Temukan pesan user terdekat sebelum pesan AI ini
    const prevUserMsg = [...messages.slice(0, aiIdx)].reverse().find(m => m.role === 'user');
    if (!prevUserMsg) return;

    // Ambil index pesan user tersebut untuk menentukan base history sebelum pesan user
    const userIdx = messages.findIndex(m => m.id === prevUserMsg.id);
    const baseHistory = userIdx > 0 ? messages.slice(0, userIdx) : [];

    // Potong state pesan sampai sebelum pesan user tersebut, lalu kirim ulang
    setMessages(baseHistory);
    handleSendMessage(prevUserMsg.text, baseHistory, null, prevUserMsg.media);
  };

  const stopGeneration = () => {
    isUserStoppedRef.current = true;
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (motionFinalizeResolverRef.current) {
      motionFinalizeResolverRef.current();
      motionFinalizeResolverRef.current = null;
    }
    setIsMotionLoading(false);
    setIsMotionFinalizing(false);
    setIsLoading(false);
  };

  const handleSendMessage = async (
    text: string, 
    overrideMessages?: Message[], 
    imageUrl?: string | null, 
    media?: MediaAttachment | MediaAttachment[]
  ) => {
    isUserStoppedRef.current = false;
    const userText = text.trim();
    const mediaList: MediaAttachment[] = Array.isArray(media) ? media : (media ? [media] : []);
    const hasMedia = mediaList.length > 0;
    if ((!userText && !imageUrl && !hasMedia) || isLoading) return;

    // =========================================================================
    // 0. CEK INTERCEPT SYSTEM CONTROLLER (@image, @video, @bluefox, @theme, @memory standalone)
    // =========================================================================
    const lowerText = userText.toLowerCase();



    const isBluefoxCmd = lowerText.startsWith('@bluefox');
    const isThemeCmd = lowerText.startsWith('@theme');
    const isMemoryStandalone = lowerText === '@memory' || lowerText.startsWith('@memory list') || lowerText.startsWith('@memory save') || (lowerText.startsWith('@memory ') && !lowerText.includes('?'));

    if (isBluefoxCmd || isThemeCmd || isMemoryStandalone) {
      let systemReply = '';
      let shouldDeleteSession = false;

      const baseMessages = overrideMessages ?? messages;
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: userText,
        media: media,
      };
      const updatedMessages = [...baseMessages, userMessage];

      // A. COMMAND @bluefox
      if (isBluefoxCmd) {
        const subCmd = lowerText.replace(/^@bluefox\s*/, '').trim();

        if (subCmd.startsWith('profile')) {
          const adminRowEn = isUserAdmin(user) ? '\n| **Role / Privilege** | `[ADMINISTRATOR]` |' : '';
          const adminRowId = isUserAdmin(user) ? '\n| **Peran / Hak Akses** | `[ADMINISTRATOR]` |' : '';

          systemReply = lang === 'en' ? `### User Profile (Bluefox System Controller)

| Account Data | Information Detail |
| :--- | :--- |
| **User ID** | \`${user?.id || 'guest-user'}\` |
| **Active Email** | \`${user?.email || 'user@example.com'}\` |
| **Tier / Plan** | \`${userTier || 'Tier 1 Pro'}\` |${adminRowEn}
| **Active Session ID** | \`${currentSessionId || 'New Session'}\` |
| **Authentication Status** | \`[VERIFIED & ACTIVE]\` |
| **System Time** | \`${new Date().toLocaleString('en-US')}\` |`
          : `### Profil Pengguna (Bluefox System Controller)

| Data Akun | Detail Informasi |
| :--- | :--- |
| **User ID** | \`${user?.id || 'guest-user'}\` |
| **Email Aktif** | \`${user?.email || 'user@example.com'}\` |
| **Paket / Tier** | \`${userTier || 'Tier 1 Pro'}\` |${adminRowId}
| **Sesi ID Aktif** | \`${currentSessionId || 'Sesi Baru'}\` |
| **Status Autentikasi** | \`[TERVERIFIKASI & AKTIF]\` |
| **Waktu Sistem** | \`${new Date().toLocaleString('id-ID')}\` |`;
        } else if (subCmd.startsWith('activity')) {
          systemReply = lang === 'en' ? `### Activity Log (Bluefox System Controller)

- **Total Saved Sessions:** ${chatSessions.length} sessions
- **Active Session:** ${currentSessionId || 'New'} (${updatedMessages.length} messages)
- **Active Model:** \`${selectedModel}\`

**Recent Sessions:**
${chatSessions.slice(0, 5).map((s, i) => `${i + 1}. **${s.title}** ${s.isPinned ? '[PINNED]' : ''}\n   - Model: \`${s.model || 'Standard'}\` • Messages: ${s.messages?.length || 0}\n   - Last modified: ${new Date(s.updatedAt).toLocaleString('en-US')}`).join('\n\n') || '_No session history recorded yet._'}`
          : `### Log Aktivitas Percakapan (Activity Log)

- **Total Sesi Tersimpan:** ${chatSessions.length} sesi
- **Sesi Aktif:** ${currentSessionId || 'Baru'} (${updatedMessages.length} pesan)
- **Model Aktif:** \`${selectedModel}\`

**Daftar Sesi Terbaru:**
${chatSessions.slice(0, 5).map((s, i) => `${i + 1}. **${s.title}** ${s.isPinned ? '[DISEMATKAN]' : ''}\n   - Model: \`${s.model || 'Standard'}\` • Pesan: ${s.messages?.length || 0}\n   - Terakhir diubah: ${new Date(s.updatedAt).toLocaleString('id-ID')}`).join('\n\n') || '_Belum ada riwayat sesi lain._'}`;
        } else if (subCmd.startsWith('kuota') || subCmd.startsWith('quota')) {
          const devModeNotice = isDevMode ? (
            lang === 'en' 
              ? '\n| **Development Mode** | `[NO LIMIT - ACTIVE]` | Supabase quota limits are bypassed on this device |'
              : '\n| **Mode Development** | `[NO LIMIT - AKTIF]` | Pengecekan & kuota Supabase dilewati di perangkat ini |'
          ) : '';

          systemReply = lang === 'en' ? `### Quota & Usage Monitor (Bluefox Controller)

| Quota Parameter | Usage Status | Description |
| :--- | :--- | :--- |
| **Rolling Limit (5 Hours)** | \`${dbLimits?.used5h ?? 0}% used\` | Remaining: \`${Math.max(0, 100 - (dbLimits?.used5h ?? 0))}%\` |
| **Weekly Limit** | \`${dbLimits?.usedWeekly ?? 0}% used\` | Remaining: \`${Math.max(0, 100 - (dbLimits?.usedWeekly ?? 0))}%\` |${devModeNotice}
| **System Status** | \`${isDevMode ? '[NO LIMIT - DEV MODE]' : '[NORMAL OPERATIONAL]'}\` | ${isDevMode ? 'Unlimited AI queries enabled' : 'Auto quota reset window every 5 hours'} |

_Developer Tip: Type \`@bluefox reset\` to reset all AI model usage limits to 0%._`
          : `### Indikator Batas Penggunaan (Quota Monitor)

| Parameter Kuota | Status Penggunaan | Keterangan |
| :--- | :--- | :--- |
| **Rolling Limit (5 Jam)** | \`${dbLimits?.used5h ?? 0}% terpakai\` | Sisa: \`${Math.max(0, 100 - (dbLimits?.used5h ?? 0))}%\` |
| **Batas Mingguan (Weekly)** | \`${dbLimits?.usedWeekly ?? 0}% terpakai\` | Sisa: \`${Math.max(0, 100 - (dbLimits?.usedWeekly ?? 0))}%\` |${devModeNotice}
| **Status Sistem** | \`${isDevMode ? '[NO LIMIT - DEV MODE]' : '[OPERASIONAL NORMAL]'}\` | ${isDevMode ? 'Akses tanpa batas aktif di perangkat ini' : 'Reset kuota otomatis tiap 5 jam'} |

_Tip Pengujian: Ketik \`@bluefox reset\` untuk mereset seluruh batas penggunaan AI ke 0%._`;
        } else if (subCmd.startsWith('reset')) {
          await handleResetLimits();
          systemReply = lang === 'en' ? `### Quota & Usage Limits Reset Successfully (Dev Mode)

- **Rolling Limit (5 Hours):** \`0% used\` (Remaining 100%)
- **Weekly Limit:** \`0% used\` (Remaining 100%)
- **Database Table \`user_limits\`:** Synchronized back to 0%.

All AI models have been re-enabled and are ready for queries.`
          : `### Kuota & Batas Penggunaan Berhasil Direset (Dev Mode)

- **Rolling Limit (5 Jam):** \`0% terpakai\` (Sisa 100%)
- **Batas Mingguan (Weekly):** \`0% terpakai\` (Sisa 100%)
- **Tabel \`user_limits\`:** Berhasil disinkronisasi ulang ke 0%.

Semua model AI telah aktif kembali dan siap digunakan.`;
        } else if (subCmd.startsWith('personalization')) {
          const instructionText = userText.replace(/^@bluefox\s+personalization\s*/i, '').trim();
          if (instructionText) {
            localStorage.setItem('tmpa_custom_instruction', instructionText);
            setCustomInstruction(instructionText);
            setShowActionToast(lang === 'id' ? 'Personalisasi AI berhasil diperbarui!' : 'AI Personalization updated!');
            setTimeout(() => setShowActionToast(null), 2500);
            systemReply = lang === 'en' ? `### AI Personalization Saved

Your custom system instructions have been updated:
> *"**${instructionText}**"*

The AI model will apply this context to all future responses.`
            : `### Personalisasi AI Berhasil Disimpan

Instruksi sistem kustom Anda telah diperbarui:
> *"**${instructionText}**"*

AI akan menerapkan preferensi ini ke setiap respons percakapan berikutnya.`;
          } else {
            const currentInst = localStorage.getItem('tmpa_custom_instruction') || customInstruction;
            systemReply = lang === 'en' ? `### Current AI Personalization

${currentInst ? `Active instructions:\n> *"**${currentInst}**"*` : '_No custom personalization instruction configured yet._'}

_Tip: Type \`@bluefox personalization [your instructions]\` to update._`
            : `### Personalisasi AI Saat Ini

${currentInst ? `Instruksi aktif:\n> *"**${currentInst}**"*` : '_Belum ada instruksi personalisasi yang tersimpan._'}

_Tip: Ketik \`@bluefox personalization [instruksi kamu]\` untuk mengubah instruksi._`;
          }
        } else if (subCmd.startsWith('download')) {
          const sessionToDl = chatSessions.find(s => s.id === currentSessionId) || {
            title: 'Bluefox Chat Session',
            messages: updatedMessages
          };
          const mdContent = [
            `# Bluefox Chat Export: ${sessionToDl.title}`,
            `> Date: ${new Date().toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')} | Model: ${selectedModel}`,
            '',
            '---',
            '',
            ...updatedMessages.map(m => `### ${m.role === 'user' ? 'User' : 'Bluefox AI'}\n\n${m.text}\n`)
          ].join('\n\n');

          const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(sessionToDl.title || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setShowActionToast(lang === 'id' ? 'Berkas markdown (.md) berhasil diunduh!' : 'Markdown (.md) file downloaded!');
          setTimeout(() => setShowActionToast(null), 2500);
          systemReply = lang === 'en' ? `### Chat Download Completed

This session's conversation has been formatted and exported as a **.md** (Markdown) file.`
          : `### Unduhan Percakapan Berhasil

Percakapan sesi ini telah dikonversi dan diunduh secara otomatis sebagai berkas **.md** (Markdown).`;
        } else if (subCmd.startsWith('delete')) {
          shouldDeleteSession = true;
          setShowActionToast(lang === 'id' ? 'Sesi percakapan berhasil dihapus!' : 'Chat session deleted!');
          setTimeout(() => setShowActionToast(null), 2500);
          systemReply = lang === 'en' ? `### Chat Session Deleted

The current chat session has been permanently removed from system storage.`
          : `### Sesi Percakapan Dihapus

Sesi percakapan ini telah dihapus dari riwayat sistem.`;
        } else if (subCmd.startsWith('pin')) {
          if (currentSessionId) {
            const updatedSessions = chatSessions.map(s => 
              s.id === currentSessionId ? { ...s, isPinned: !s.isPinned } : s
            ).sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
            saveSessionsToLocal(updatedSessions);
            const isNowPinned = updatedSessions.find(s => s.id === currentSessionId)?.isPinned;
            setShowActionToast(isNowPinned ? (lang === 'id' ? 'Chat berhasil disematkan di atas' : 'Chat pinned to top') : (lang === 'id' ? 'Sematkan chat dilepas' : 'Chat unpinned'));
            setTimeout(() => setShowActionToast(null), 2500);
            systemReply = lang === 'en' ? `### Pin Status Updated

This chat session is now **${isNowPinned ? 'PINNED at the top' : 'UNPINNED'}**.`
            : `### Status Pin Diperbarui

Sesi percakapan ini sekarang **${isNowPinned ? 'DISEMATKAN di posisi paling atas' : 'DILEPAS dari sematan'}**.`;
          } else {
            systemReply = lang === 'en' ? `### Pin Session

_Please send at least one message in this chat before pinning it to the top._`
            : `### Sematkan Chat

_Ketik dan kirim setidaknya satu pesan terlebih dahulu untuk menyematkan sesi ini ke daftar riwayat teratas._`;
          }
        } else {
          systemReply = lang === 'en' ? `### Bluefox System Controller

Available commands:
- \`@bluefox profile\` : View account info and session status
- \`@bluefox activity\` : View activity summary and recent chats
- \`@bluefox quota\` : View 5-hour rolling, weekly & custom API limits
- \`@bluefox personalization [text]\` : Set custom system prompt
- \`@bluefox download\` : Export chat history to .md file
- \`@bluefox delete\` : Delete current session
- \`@bluefox pin\` : Pin session to the top of your list`
          : `### Bluefox System Controller

Daftar perintah yang tersedia:
- \`@bluefox profile\` : Tampilkan detail akun & status sesi
- \`@bluefox activity\` : Ringkasan aktivitas percakapan
- \`@bluefox kuota\` : Indikator limit 5 jam, mingguan & custom API
- \`@bluefox personalization [instruksi]\` : Atur prompt sistem kustom
- \`@bluefox download\` : Ekspor riwayat sesi ke berkas .md
- \`@bluefox delete\` : Hapus sesi aktif
- \`@bluefox pin\` : Sematkan sesi ke daftar teratas`;
        }
      } 
      // B. COMMAND @theme
      else if (isThemeCmd) {
        const themeResult = parseThemeCommand(userText);
        setShowActionToast(themeResult.message.split('\n')[0]);
        setTimeout(() => setShowActionToast(null), 2500);
        
        const changesTable = themeResult.changes && themeResult.changes.length > 0 
          ? `\n\n| ${lang === 'en' ? 'Property' : 'Target Properti'} | ${lang === 'en' ? 'Value' : 'Nilai Warna / Styling'} |\n| :--- | :--- |\n${themeResult.changes.map(c => `| **${c.target}** | \`${c.value}\` |`).join('\n')}`
          : '';

        systemReply = lang === 'en' ? `### Visual Customization Controller (@theme)

**Status:** \`${themeResult.success ? '[APPLIED SUCCESSFULLY]' : '[INVALID FORMAT]'}\`

${themeResult.message}${changesTable}

_Tip: You can return to the default clean theme at any time by typing \`@theme reset\`._`
        : `### Visual Customization Controller (@theme)

**Status:** \`${themeResult.success ? '[BERHASIL DITERAPKAN]' : '[FORMAT TIDAK SESUAI]'}\`

${themeResult.message}${changesTable}

_Tip: Anda dapat mereset ke tema default kapan saja dengan mengetik \`@theme reset\`._`;
      }
      // C. COMMAND @memory standalone
      else if (isMemoryStandalone) {
        const memoryContent = userText.replace(/^@memory\s*/i, '').trim();
        if (memoryContent && memoryContent !== 'list') {
          saveActiveMemory(memoryContent);
          setShowActionToast(lang === 'id' ? 'Memori baru tersimpan!' : 'New memory saved!');
          setTimeout(() => setShowActionToast(null), 2500);
          const allMem = getActiveMemories();
          systemReply = lang === 'en' ? `### Conversation Memory Saved

The following context has been saved to your active memory:
> *"**${memoryContent}**"*

**Current Active Memories (${allMem.length}):**
${allMem.map((m, i) => `${i + 1}. ${m}`).join('\n')}

_The AI will automatically reference this context in future queries._`
          : `### Memori Konteks Percakapan Tersimpan

Konteks berikut telah disimpan ke dalam memori aktif:
> *"**${memoryContent}**"*

**Daftar Memori Aktif Saat Ini (${allMem.length}):**
${allMem.map((m, i) => `${i + 1}. ${m}`).join('\n')}

_AI akan secara otomatis mengingat informasi ini pada setiap percakapan mendatang._`;
        } else {
          const allMem = getActiveMemories();
          systemReply = lang === 'en' ? `### Context Memory Manager (@memory)

${allMem.length > 0 ? `**Active Memories (${allMem.length}):**\n${allMem.map((m, i) => `${i + 1}. ${m}`).join('\n')}` : '_No contextual memories saved yet._'}

**Usage:**
- Save memory: \`@memory I am a software engineer\`
- Clear memories: \`@memory clear\``
          : `### Manajer Memori Konteks (@memory)

${allMem.length > 0 ? `**Daftar Memori Aktif (${allMem.length}):**\n${allMem.map((m, i) => `${i + 1}. ${m}`).join('\n')}` : '_Belum ada memori kontekstual yang tersimpan._'}

**Cara Penggunaan:**
- Simpan memori baru: \`@memory Saya seorang frontend engineer\`
- Bersihkan memori: \`@memory clear\``;
        }
      }

      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: systemReply,
      };

      if (shouldDeleteSession && currentSessionId) {
        const targetSession = chatSessions.find(s => s.id === currentSessionId);
        if (targetSession) {
          handleDeleteChatSession(targetSession);
        }
        return;
      }

      const finalMessages = [...updatedMessages, systemMessage];
      setMessages(finalMessages);

      let sessionId = getValidUUID(currentSessionId);
      let currentSessions = [...chatSessions];
      const sessionIdx = currentSessions.findIndex(s => s.id === sessionId);
      if (sessionIdx === -1) {
        const newSession = {
          id: sessionId,
          title: userText.length > 30 ? userText.substring(0, 30) + '...' : userText,
          messages: finalMessages,
          updatedAt: Date.now(),
          model: selectedModel
        };
        currentSessions = [newSession, ...currentSessions];
      } else {
        currentSessions[sessionIdx] = {
          ...currentSessions[sessionIdx],
          messages: finalMessages,
          updatedAt: Date.now()
        };
      }
      saveSessionsToLocal(currentSessions);
      return;
    }

    // 1. Tampilkan UI loading & bersihkan error state
    const isMotionReq = lowerText.includes('@motion');
    setIsMotionLoading(isMotionReq);
    setIsMotionFinalizing(false);
    setIsLoading(true);
    setErrorState(null);

    let timeoutId: any = null;
    let aiReplyText = '';
    let effectiveConvId = currentSessionId || getValidUUID(null);

    try {
      // Ambil UUID user yang sedang login secara dinamis
      let activeUserId = user?.id;
      if (!activeUserId) {
        const { data: authData } = await supabase.auth.getUser();
        activeUserId = authData?.user?.id;
      }

      // 3 model bawaan Bluefox (Bluefox Pro, Bluefox Standard, Bluefox Dilo)
      const currentModelName = (selectedModel || 'agnes-2.5-flash').trim();
      const isBluefoxNative = true;

      // Filter HANYA gambar nyata (WebP, PNG, GIF, JPG/JPEG) untuk pemrosesan vision
      const imageAttachments = mediaList.filter(m => 
        m.type === 'image' || 
        (m.url && m.url.startsWith('data:image/'))
      );
      const onlyImageUrl = imageAttachments.length > 0 ? imageAttachments[0].url : (imageUrl || null);
      const hasRealImage = Boolean(onlyImageUrl);

      // Vision mode HANYA aktif jika dinyalakan manual ATAU ada lampiran gambar nyata
      // Dokumen, berkas teks (TXT/MD), PDF, JSON, YAML, kode program BUKAN vision
      const isVisionNow = Boolean(isVisionActive || hasRealImage);
      // Vision terkunci ke Bluefox Pro (agnes-2.5-flash) tanpa fallback
      const currentEffectiveModel = isVisionNow 
        ? 'agnes-2.5-flash' 
        : selectedModel;

      // =========================================================================
      // B. PENGECEKAN LIMIT KLIEN: CEK LANGSUNG KE TABEL public.user_limits DI SUPABASE
      // =========================================================================
      // 1. Cek apakah mode dev aktif secara lokal di browser
      const isDevModeLocal = typeof window !== 'undefined' && localStorage.getItem('tmpa_dev_mode') === 'true';

      if (isDevModeLocal || isDevMode) {
        console.log('Mode Development aktif (No Limit). Melewati pengecekan kuota.');
      } else {
        // 2. Ambil user UUID jika login
        let userUuid = user?.id;
        if (!userUuid) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          userUuid = authUser?.id;
        }

        if (userUuid) {
          // Panggil consumeAiLimit yang memeriksa langsung ke tabel public.user_limits
          const limitResult = await consumeAiLimit(userUuid, currentEffectiveModel, isVisionNow);

          // HANYA jika kuota di tabel public.user_limits benar-benar telah mencapai 100%
          if (limitResult.isLimitExceeded) {
            setIsLoading(false);
            setIsMotionLoading(false);
            const errorMessage = limitResult.message || (lang === 'id' ? 'Batas penggunaan kuota Anda telah tercapai.' : 'Your usage limit has been reached.');
            setErrorState(errorMessage);
            setQuotaModalInfo({
              isOpen: true,
              title: lang === 'id' ? 'Batas Penggunaan Tercapai' : 'Usage Limit Reached',
              message: errorMessage,
              used5h: limitResult.used_5h ?? 100,
              usedWeekly: limitResult.used_weekly ?? 100
            });
            return; // Hentikan eksekusi, pesan tidak dikirim ke AI
          }

          // Sinkronkan data persentase terbaru dari tabel public.user_limits ke state UI
          if (limitResult.used_5h !== undefined || limitResult.used_weekly !== undefined) {
            setDbLimits({
              used5h: limitResult.used_5h ?? 0,
              usedWeekly: limitResult.used_weekly ?? 0
            });
          }

          if (limitResult.isDevMode) {
            setIsDevMode(true);
          }
        }
      }

      // =========================================================================
      // ENRICH AI PROMPT UNTUK PERINTAH MODUL AI (@verifyai, @deep verify, @creative)
      // =========================================================================
      const baseMessages = overrideMessages ?? messages;
      let effectiveAiPrompt = userText;

      if (lowerText.startsWith('@verifyai')) {
        const lastAiMsg = [...baseMessages].reverse().find(m => m.role === 'model');
        const focusText = userText.replace(/^@verifyai\s*/i, '').trim();
        effectiveAiPrompt = `[VERIFY-AI PROTOKOL KOREKSI & VALIDASI MANDIRI]\nMohon evaluasi ulang dan koreksi jawaban AI sebelumnya secara kritis dan komprehensif. Periksa kebenaran fakta, data numerik, rumus, logika inferensi, dan jika terdapat kesalahan atau hal yang kurang tepat, perbaiki secara transparan dan detail.\n\n${lastAiMsg ? `Konteks Jawaban AI Sebelumnya:\n"""\n${lastAiMsg.text}\n"""\n` : ''}${focusText ? `Fokus Evaluasi Khusus: ${focusText}` : 'Lakukan evaluasi menyeluruh dan berikan jawaban yang sudah dikoreksi.'}`;
      } else if (lowerText.startsWith('@deep verify')) {
        const query = userText.replace(/^@deep\s+verify\s*/i, '').trim();
        effectiveAiPrompt = `[DEEP REASONING & VERIFICATION PROTOCOL]\nLakukan analisis mendalam dan pemikiran bertahap (step-by-step reasoning) yang terstruktur secara analitis, kritis, dan terverifikasi secara logis sebelum memberikan kesimpulan akhir.\n\nTopik/Pertanyaan:\n${query}`;
      } else if (lowerText.startsWith('@creative')) {
        const query = userText.replace(/^@creative\s*/i, '').trim();
        effectiveAiPrompt = `[CREATIVE DYNAMIC STYLE PROTOCOL]\nAktifkan parameter kreasi ide eksploratif, variasi diksi yang kaya dan ekspresif, eksploratif, serta hasilkan ide-ide inovatif dan out-of-the-box.\n\nTopik/Instruksi:\n${query}`;
      } else if (lowerText.includes('@motion')) {
        // Mode @motion: Menggunakan System Prompt khusus Bluefox Motion
        const motionQuery = userText.replace(/@motion\s*/gi, '').trim();
        effectiveAiPrompt = `${BLUEFOX_MOTION_SYSTEM_PROMPT}\n\nInstruksi Animasi Pengguna:\n${motionQuery || userText}`;
      }

      const activeMemories = getActiveMemories();
      if (activeMemories.length > 0 && !lowerText.startsWith('@verifyai')) {
        effectiveAiPrompt = `[KONTEKS MEMORI PENGGUNA YANG TERSIMPAN:\n${activeMemories.map(m => `- ${m}`).join('\n')}]\n\n${effectiveAiPrompt}`;
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: userText,
        media: media,
      };

      const updatedMessages = [...baseMessages, userMessage];
      setMessages(updatedMessages);

      // Simpan berkas lampiran ke Local Storage dan siapkan attachmentMetadata untuk database
      const attachmentMetadata: any[] = [];
      for (const m of mediaList) {
        if (m.url) {
          const saved = saveBase64ToLocalStorage(m.url, m.name || 'image.png', m.type || 'image/png', m.size);
          if (saved) {
            attachmentMetadata.push({
              local_id: saved.local_id,
              name: saved.name,
              type: saved.type,
              size: saved.size,
              pageCount: (m as any).pageCount,
            });
          }
        }
      }

      // Pastikan sessionId konsisten untuk seluruh percakapan aktif
      if (sharedAccessMode === 'remix') {
        const forkedId = getValidUUID(null);
        effectiveConvId = forkedId;
        setCurrentSessionId(forkedId);
        setSupabaseSessionId(forkedId);
        setSharedAccessMode(null);
        try {
          localStorage.setItem('tmpa_last_active_session_id', forkedId);
        } catch {}
      } else if (!currentSessionId) {
        try {
          const sessionTitle = userText.length > 30 ? userText.substring(0, 30) + '...' : (userText || 'Percakapan Baru');
          const sessionResult = await createNewSession(sessionTitle, effectiveConvId);
          if (sessionResult && sessionResult.id) {
            effectiveConvId = sessionResult.id;
          }
        } catch (err) {
          console.warn("Info createNewSession di session_bluefox:", err);
        }

        setCurrentSessionId(effectiveConvId);
        setSupabaseSessionId(effectiveConvId);
        try {
          localStorage.setItem('tmpa_last_active_session_id', effectiveConvId);
        } catch {}
      } else {
        effectiveConvId = currentSessionId;
      }

      let currentSessions = [...chatSessions];
      const sessionIdx = currentSessions.findIndex(s => s.id === effectiveConvId);
      if (sessionIdx === -1) {
        const sessionTitle = userText.length > 30 ? userText.substring(0, 30) + '...' : (userText || 'Percakapan Baru');
        const newSession = {
          id: effectiveConvId,
          title: sessionTitle,
          messages: updatedMessages,
          updatedAt: Date.now(),
          model: selectedModel
        };
        currentSessions = [newSession, ...currentSessions];
      } else {
        currentSessions[sessionIdx] = {
          ...currentSessions[sessionIdx],
          messages: updatedMessages,
          updatedAt: Date.now()
        };
      }
      
      saveSessionsToLocal(currentSessions);

      // Kompatibilitas backup
      sendMessageToSupabase(userText, effectiveConvId, 'user').catch(err => {
        console.warn("Info sendMessageToSupabase pengguna:", err);
      });

      abortControllerRef.current = new AbortController();
      timeoutId = setTimeout(() => abortControllerRef.current?.abort(), isMotionReq ? 600000 : 80000);

      // =========================================================================
      // DUAL-ENGINE FALLBACK WEB SEARCH INTENT DETECTION & CONTEXT INJECTION (3-5 MULTI-SEARCH + ADVANCE)
      // =========================================================================
      let attachedSources: SearchSource[] = [];
      let attachedEngine: 'tavily' | 'duckduckgo' | string | undefined = undefined;

      const isSearchTriggered = detectSearchIntent(userText) || lowerText.startsWith('@search') || lowerText.startsWith('@web') || lowerText.startsWith('@cari');
      if (isSearchTriggered) {
        try {
          const searchPayload = await executeDualEngineSearch(userText, {
            forceSearch: true,
            signal: abortControllerRef.current?.signal,
          });

          const mode: SearchModeType = searchPayload.searchMode || 'standard';
          updateUsage(currentEffectiveModel, isVisionNow, mode);

          if (searchPayload.has_sources && searchPayload.sources.length > 0) {
            attachedSources = searchPayload.sources;
            attachedEngine = searchPayload.search_engine_used || 'tavily';
            if (searchPayload.contextSnippet) {
              effectiveAiPrompt += `\n\n${searchPayload.contextSnippet}`;
            }
          }
        } catch (searchErr) {
          console.warn("Client-side search error:", searchErr);
        }
      }

      // Setup placeholder message for real-time streaming typewriter display
      const currentReasoningEffort = getSmartSelectEffort(currentEffectiveModel, smartSelectLevel);

      const aiMessageId = (Date.now() + 1).toString();
      const initialAiMessage: Message = {
        id: aiMessageId,
        role: 'model',
        text: '',
        reasoningEffort: currentReasoningEffort,
        has_sources: attachedSources.length > 0,
        search_engine_used: attachedEngine,
        sources: attachedSources.length > 0 ? attachedSources : undefined,
      };
      setMessages([...updatedMessages, initialAiMessage]);

      // Ekstrak teks dari lampiran file multi-format (TXT, MD, JSON, YAML, PDF, kode sumber)
      const docTexts = mediaList
        .filter(m => m.textContent && m.textContent.trim().length > 0)
        .map(m => `\n\n--- [Isi Berkas Lampiran: ${m.name}${m.pageCount ? ` (${m.pageCount} Halaman)` : ''}] ---\n${m.textContent}\n--- [Akhir Berkas: ${m.name}] ---`)
        .join('\n');

      let promptToSend = effectiveAiPrompt;
      if (docTexts) {
        if (effectiveAiPrompt.trim()) {
          promptToSend = `${effectiveAiPrompt}\n\n${docTexts}`;
        } else {
          const fileNames = mediaList.map(m => m.name).join(', ');
          promptToSend = `Berikut adalah berkas lampiran (${fileNames}) yang saya unggah:\n${docTexts}\n\nTolong baca, telaah, dan berikan analisis atau ringkasan lengkap dari isi berkas di atas.`;
        }
      } else if (!promptToSend.trim() && onlyImageUrl) {
        promptToSend = "Tolong jelaskan dan analisis gambar ini secara detail.";
      } else if (!promptToSend.trim()) {
        promptToSend = "Halo";
      }

      // Siapkan riwayat pesan sebelumnya untuk konteks backend
      const formattedHistory = baseMessages
        .slice(-10)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text,
          content: m.text,
          message: m.text
        }));

      // =========================================================================
      // STRICT VERIFICATION: 3 MODEL BAWAAN BLUEFOX VS MODEL CUSTOM API
      // 1. Identifikasi apakah nama model yang dipilih cocok dengan 3 model bawaan Bluefox:
      //    - agnes-2.5-flash (Bluefox Pro)
      //    - tencent-hy3-free (Bluefox Standard)
      //    - laguna-s-2.1 (Bluefox Dilo)
      // =========================================================================
      // Ambil nama model yang dipilih user
      const rawChosenName = (currentEffectiveModel || selectedModel || 'agnes-2.5-flash').trim();

      // Cek kecocokan terhadap 3 model bawaan Bluefox
      const isAgnesMatch = 
        rawChosenName === 'agnes-2.5-flash' || 
        rawChosenName === 'bluefox_pro' || 
        rawChosenName === 'agnes-2.0-flash' ||
        currentEffectiveModel === 'agnes-2.5-flash' ||
        selectedModel === 'agnes-2.5-flash';

      const isTencentMatch = 
        rawChosenName === 'tencent-hy3-free' || 
        rawChosenName === 'bluefox_standard' || 
        rawChosenName === 'jev' || 
        rawChosenName === 'tmpa_v1' ||
        currentEffectiveModel === 'tencent-hy3-free' ||
        selectedModel === 'tencent-hy3-free';

      const isLagunaMatch = 
        rawChosenName === 'laguna-s-2.1' || 
        rawChosenName === 'bluefox_dilo' || 
        rawChosenName === 'dilo' || 
        rawChosenName === 'longcat-2.0-free' ||
        currentEffectiveModel === 'laguna-s-2.1' ||
        selectedModel === 'laguna-s-2.1';

      const isMotionTriggered = lowerText.includes('@motion');
      const activeSystemPrompt = isMotionTriggered
        ? `${BLUEFOX_SYSTEM_PROMPT}\n\n${BLUEFOX_MOTION_SYSTEM_PROMPT}`
        : BLUEFOX_SYSTEM_PROMPT;
      const effectiveCustomInstruction = isMotionTriggered
        ? (customInstruction ? `${customInstruction}\n\n${BLUEFOX_MOTION_SYSTEM_PROMPT}` : BLUEFOX_MOTION_SYSTEM_PROMPT)
        : (customInstruction || "");

      let internalModelId = 'agnes-2.5-flash';
      if (isLagunaMatch) {
        internalModelId = 'laguna-s-2.1';
      } else if (isTencentMatch) {
        internalModelId = 'jev';
      } else {
        internalModelId = 'agnes-2.5-flash';
      }

      const chatPayload: any = {
        message: promptToSend,
        prompt: promptToSend,
        history: formattedHistory,
        conversation_id: effectiveConvId,
        session_id: effectiveConvId,
        user_id: activeUserId || user?.id || null,
        userId: activeUserId || user?.id || null,
        is_bluefox_native: true,
        isBluefoxNative: true,
        model: internalModelId,
        model_id: internalModelId,
        modelId: internalModelId,
        id_model: internalModelId,
        selected_model: selectedModel,
        selected_model_id: selectedModel,
        selectedModel: selectedModel,
        raw_model: currentEffectiveModel || selectedModel,
        raw_model_id: currentEffectiveModel || selectedModel,
        resolved_model: internalModelId,
        resolvedModel: internalModelId,
        model_name: getModelDisplayName(selectedModel),
        is_vision: isVisionNow,
        isVision: isVisionNow,
        reasoning_mode: smartSelectLevel === 'high' ? 'penalaran' : 'standar',
        reasoningMode: smartSelectLevel === 'high' ? 'penalaran' : 'standar',
        smart_select_level: smartSelectLevel,
        smartSelectLevel: smartSelectLevel,
        customInstruction: effectiveCustomInstruction,
        custom_instruction: effectiveCustomInstruction,
        system_prompt: activeSystemPrompt,
        systemPrompt: activeSystemPrompt,
        stream: false
      };

      if (onlyImageUrl) {
        chatPayload.image_url = onlyImageUrl;
        chatPayload.imageUrl = onlyImageUrl;
        chatPayload.image = onlyImageUrl;
        if (onlyImageUrl.includes('base64,')) {
          const b64 = onlyImageUrl.split('base64,')[1];
          chatPayload.image_base64 = b64;
          chatPayload.base64_image = b64;
        }
      }

      // Panggil Supabase Edge Function:
      // Khusus untuk @motion memanggil 'motion-generator' (mencegah timeout proses generate animasi yang lama)
      let response: Response;
      let motionEdgeData: any = null;
      let motionMessageId: string | undefined = undefined;

      if (isMotionTriggered) {
        // 1. Simpan pesan user terlebih dahulu ke tabel message_bluefox
        try {
          const { data: insertedMsg, error: insertError } = await supabase
            .from('message_bluefox')
            .insert({
              session_id: effectiveConvId,
              user_message: userText,
              ai_response: 'Memulai proses...'
            })
            .select()
            .single();

          if (!insertError && insertedMsg) {
            motionMessageId = insertedMsg.id;
            console.log('[message_bluefox] Pesan @motion berhasil disimpan, ID:', insertedMsg.id);
          } else if (insertError) {
            console.warn('[message_bluefox] Info simpan pesan awal @motion:', insertError.message);
          }
        } catch (dbErr) {
          console.warn('[message_bluefox] Error simpan awal @motion:', dbErr);
        }

        // 2. Panggil Edge Function motion-generator secara asinkron
        try {
          motionEdgeData = await invokeMotionGenerator({
            ...chatPayload,
            message_id: motionMessageId,
            prompt: userText,
            session_id: effectiveConvId
          }, abortControllerRef.current?.signal);
        } catch (motionErr: any) {
          if (abortControllerRef.current?.signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          console.warn("⚠️ Direct motion-generator error, fallback to bluefox-processor:", motionErr?.message);
          motionEdgeData = await invokeBluefoxProcessor(chatPayload, abortControllerRef.current?.signal);
        }

        // KETIKA WEBSITE MENDAPATKAN RESPON AI DARI @MOTION:
        // Otomatis kasih animasi "rander full code & preview" selama 20 detik baru diberikan ke user
        setIsMotionFinalizing(true);
        await new Promise<void>((resolve) => {
          motionFinalizeResolverRef.current = resolve;
          // Guard timeout 21 detik jika komponen unmount
          setTimeout(() => {
            if (motionFinalizeResolverRef.current) {
              motionFinalizeResolverRef.current();
              motionFinalizeResolverRef.current = null;
            }
          }, 21000);
        });

        response = new Response(JSON.stringify(motionEdgeData), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        try {
          const edgeData = await invokeBluefoxProcessor(chatPayload, abortControllerRef.current.signal);
          response = new Response(JSON.stringify(edgeData), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (edgeErr: any) {
          if (abortControllerRef.current?.signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          console.warn("⚠️ Direct Edge Function error:", edgeErr?.message);

        const isAuthError = edgeErr?.status === 401 || edgeErr?.status === 403 || /autentikasi|unauthorized|jwt|token/i.test(edgeErr?.message || '');
        let fallbackHandled = false;

        // Coba fallback ke /api/chat HANYA jika bukan auth error (karena 401 harus ditangani oleh Supabase, bukan /api/chat)
        if (!isAuthError) {
          try {
            const chatRes = await fetch("/api/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              credentials: "include",
              body: JSON.stringify(chatPayload),
              signal: abortControllerRef.current.signal
            });
            // Abaikan respons 405 (Method Not Allowed) atau 404 (Not Found) yang umum terjadi pada hosting statis seperti Vercel / Cloudflare Pages
            if (chatRes.status !== 405 && chatRes.status !== 404) {
              response = chatRes;
              fallbackHandled = true;
            } else {
              console.warn(`⚠️ Rute /api/chat tidak aktif di host ini (HTTP ${chatRes.status}). Mengabaikan fallback static.`);
            }
          } catch (chatFetchErr) {
            console.warn("⚠️ Fallback /api/chat gagal:", chatFetchErr);
          }
        }

        if (!fallbackHandled) {
          // Gunakan status error asli dari Edge Function agar pesan error akurat (bukan 405 Method Not Allowed / 404)
          const errorStatus = edgeErr?.status || (isAuthError ? 401 : 500);
          const errorPayload = {
            success: false,
            error: edgeErr?.message || (isAuthError ? "Autentikasi gagal" : "Edge function error"),
            status: errorStatus
          };
          response = new Response(JSON.stringify(errorPayload), {
            status: errorStatus,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    if (abortControllerRef.current?.signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      let result: any = {};
      try {
        const textResp = await response.text();
        try {
          result = JSON.parse(textResp);
        } catch {
          result = { rawText: textResp };
        }
      } catch {
        result = {};
      }

      // Ekstraksi jawaban teks universal dari berbagai format respons AI
      // (OpenAI choices[0].message.content, Router Bynara, Supabase Edge, nested data, Gemini candidates, dan SSE rawText)
      let extractedReply = '';

      if (typeof result?.reply === 'string' && result.reply.trim()) {
        extractedReply = result.reply;
      } else if (typeof result?.text === 'string' && result.text.trim()) {
        extractedReply = result.text;
      } else if (typeof result?.response === 'string' && result.response.trim()) {
        extractedReply = result.response;
      } else if (typeof result?.message_text === 'string' && result.message_text.trim()) {
        extractedReply = result.message_text;
      } else if (result?.choices?.[0]?.message?.content) {
        extractedReply = result.choices[0].message.content;
      } else if (result?.choices?.[0]?.text) {
        extractedReply = result.choices[0].text;
      } else if (result?.choices?.[0]?.delta?.content) {
        extractedReply = result.choices[0].delta.content;
      } else if (result?.data?.reply) {
        extractedReply = result.data.reply;
      } else if (result?.data?.choices?.[0]?.message?.content) {
        extractedReply = result.data.choices[0].message.content;
      } else if (result?.data?.content) {
        extractedReply = result.data.content;
      } else if (result?.data?.text) {
        extractedReply = result.data.text;
      } else if (typeof result?.message === 'string' && result.message.trim() && result.success !== false && !result.error) {
        extractedReply = result.message;
      } else if (result?.message?.content && typeof result.message.content === 'string') {
        extractedReply = result.message.content;
      } else if (typeof result?.content === 'string' && result.content.trim()) {
        extractedReply = result.content;
      } else if (typeof result?.output === 'string' && result.output.trim()) {
        extractedReply = result.output;
      } else if (typeof result?.result === 'string' && result.result.trim()) {
        extractedReply = result.result;
      } else if (typeof result?.answer === 'string' && result.answer.trim()) {
        extractedReply = result.answer;
      } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
        extractedReply = result.candidates[0].content.parts[0].text;
      } else if (typeof result?.rawText === 'string' && result.rawText.trim()) {
        const raw = result.rawText;
        const sseMatches = raw.match(/data:\s*(\{.*\})/g);
        if (sseMatches && sseMatches.length > 0) {
          let combinedStream = '';
          for (const m of sseMatches) {
            try {
              const parsed = JSON.parse(m.replace(/^data:\s*/, ''));
              const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || parsed.delta || parsed.reply || '';
              combinedStream += delta;
            } catch {}
          }
          if (combinedStream.trim()) {
            extractedReply = combinedStream;
          }
        }
        if (!extractedReply && !raw.startsWith('{') && raw.length > 5) {
          extractedReply = raw;
        }
      }

      // Khusus untuk respons @motion dari generate-animation:
      // Pastikan kode terbungkus dalam [BLUEFOX_MOTION] jika edge function mengembalikan kode langsung
      if (isMotionTriggered) {
        const directCode = result?.code || result?.animation || result?.generated_code || result?.html || motionEdgeData?.code || motionEdgeData?.animation || motionEdgeData?.generated_code || motionEdgeData?.html;
        if (directCode && typeof directCode === 'string' && !extractedReply.includes('[BLUEFOX_MOTION]')) {
          extractedReply = `Tentu, berikut adalah animasi visual berbasis kode yang telah dibuat:\n\n[BLUEFOX_MOTION]\n${directCode.trim()}\n[/BLUEFOX_MOTION]`;
        } else if (extractedReply && !extractedReply.includes('[BLUEFOX_MOTION]')) {
          if (extractedReply.includes('<!DOCTYPE') || extractedReply.includes('<html') || (extractedReply.includes('<style') && extractedReply.includes('<div')) || extractedReply.includes('<svg')) {
            extractedReply = `Berikut animasi visual berbasis kode yang siap dirender:\n\n[BLUEFOX_MOTION]\n${extractedReply.trim()}\n[/BLUEFOX_MOTION]`;
          }
        }
      }

      if (result?.data?.sources && Array.isArray(result.data.sources) && result.data.sources.length > 0) {
        attachedSources = result.data.sources;
        if (result.data.search_engine_used) {
          attachedEngine = result.data.search_engine_used;
        }
      }

      const hasValidText = Boolean(extractedReply && extractedReply.trim().length > 0);
      const isExplicitError = !response.ok || result.success === false || (result.error && !hasValidText);

      if (isExplicitError) {
        const status = response.status;
        const rawError = String(result.error || (result.success === false && result.message) || result.rawText || '').trim();
        const isId = lang === 'id';

        let errorCategory = isId ? `Status Server AI (HTTP ${status || 'Error'})` : `AI Server Status (HTTP ${status || 'Error'})`;
        let friendlyReason = '';
        let suggestion = '';

        if (status === 400 || /bad request|invalid request/i.test(rawError)) {
          errorCategory = isId ? 'Permintaan Tidak Valid (HTTP 400 Bad Request)' : 'Invalid Request (HTTP 400 Bad Request)';
          friendlyReason = rawError || (isId ? 'Parameter atau struktur data payload yang dikirimkan ke server tidak sesuai dengan format yang diharapkan.' : 'The payload parameters or data structure sent to the server do not match the expected format.');
          suggestion = isId ? 'Periksa kelengkapan pesan atau format berkas lampiran yang diunggah.' : 'Check the message content or uploaded attachment format.';
        } else if (status === 404 || /not found/i.test(rawError)) {
          errorCategory = isId ? 'Endpoint Tidak Ditemukan (HTTP 404 Not Found)' : 'Endpoint Not Found (HTTP 404 Not Found)';
          friendlyReason = rawError || (isId ? 'Endpoint fungsi server pemrosesan tidak dapat diakses atau rute belum terdaftar.' : 'The processing server function endpoint cannot be reached or the route is not registered.');
          suggestion = isId ? 'Pastikan URL fungsi Edge Supabase tepat dan aktif.' : 'Ensure the Supabase Edge function URL is correct and active.';
        } else if (status === 413 || /payload|too large|request entity|size/i.test(rawError)) {
          errorCategory = isId ? 'Ukuran Permintaan Terlalu Besar (HTTP 413 Payload Too Large)' : 'Payload Too Large (HTTP 413 Payload Too Large)';
          friendlyReason = isId ? 'Isi teks berkas atau prompt yang dikirimkan melebihi batas kapasitas transmisi server.' : 'The prompt or file text content exceeds the server transmission limit.';
          suggestion = isId ? 'Kurangi isi teks berkas lampiran atau unggah potongan teks yang lebih ringkas.' : 'Reduce file attachment text or upload smaller excerpts.';
        } else if (status === 429 || /rate limit|quota|exceeded|too many/i.test(rawError)) {
          errorCategory = isId ? 'Batas Permintaan Tercapai (HTTP 429 Rate Limit)' : 'Rate Limit Reached (HTTP 429 Rate Limit)';
          friendlyReason = isId ? 'Frekuensi penggunaan model AI sementara telah mencapai batas kuota server.' : 'AI model request frequency has reached the server rate limit.';
          suggestion = isId ? 'Mohon tunggu 1 hingga 2 menit sebelum mencoba mengirimkan pertanyaan kembali.' : 'Please wait 1 to 2 minutes before resubmitting your query.';
        } else if (status === 401 || status === 403 || /jwt|unauthorized|auth|autentikasi|permission/i.test(rawError)) {
          errorCategory = isId ? `Sesi Autentikasi Kedaluwarsa (HTTP ${status || 401})` : `Authentication Expired (HTTP ${status || 401})`;
          friendlyReason = isId ? 'Sesi otentikasi akun Anda telah kedaluwarsa atau belum terverifikasi dengan server Supabase.' : 'Your session authentication has expired or is not verified with the server.';
          suggestion = isId ? 'Silakan muat ulang (refresh) halaman aplikasi atau masuk kembali (login) melalui halaman verifikasi untuk memperbarui sesi.' : 'Please refresh the page or re-login to renew your account session.';
        } else if (status === 502 || /bad gateway/i.test(rawError)) {
          errorCategory = isId ? 'Gerbang Bermasalah (HTTP 502 Bad Gateway)' : 'Bad Gateway (HTTP 502 Bad Gateway)';
          friendlyReason = rawError || (isId ? 'Server perantara (Edge/Gateway) menerima respons tidak valid dari model AI upstream.' : 'The gateway/edge server received an invalid upstream AI response.');
          suggestion = isId ? 'Tunggu beberapa saat atau gunakan model alternatif.' : 'Wait a few moments or try an alternative AI model.';
        } else if (status === 504 || /timeout|gateway/i.test(rawError)) {
          errorCategory = isId ? 'Waktu Pemrosesan Habis (HTTP 504 Gateway Timeout)' : 'Gateway Timeout (HTTP 504 Gateway Timeout)';
          friendlyReason = isId ? 'Server AI membutuhkan waktu pemrosesan lebih lama dari batas respons jaringan.' : 'The AI server took longer to process than the network response window allows.';
          suggestion = isId ? 'Gunakan berkas dengan teks yang lebih ringkas atau tanyakan hal yang lebih terfokus.' : 'Use shorter text files or ask more focused questions.';
        } else if (status === 405 || /method not allowed/i.test(rawError)) {
          errorCategory = isId ? 'Metode Tidak Diizinkan (HTTP 405 Method Not Allowed)' : 'Method Not Allowed (HTTP 405 Method Not Allowed)';
          friendlyReason = isId ? 'Server perantara atau proksi hosting memblokir transmisi metode HTTP.' : 'The proxy or hosting gateway blocked HTTP transmission.';
          suggestion = isId ? 'Sistem telah memperbarui rute transmisi otomatis ke Supabase Edge Function.' : 'System has switched transmission directly to Supabase Edge Function.';
        } else if (/vision|image|unsupported|mime/i.test(rawError)) {
          errorCategory = isId ? 'Kendala Format Media' : 'Media Format Issue';
          friendlyReason = isId ? 'Server AI tidak dapat mengenali atau memproses berkas media yang dilampirkan.' : 'The AI server could not recognize the attached media file format.';
          suggestion = isId ? 'Pastikan gambar berformat WebP, PNG, atau GIF, dan dokumen berupa teks (TXT, MD, JSON, YAML) atau PDF.' : 'Ensure image is WebP, PNG, or GIF, and document is valid text (TXT, MD, PDF).';
        } else if (status >= 500) {
          errorCategory = isId ? `Kendala Server Internal (HTTP ${status})` : `Internal Server Error (HTTP ${status})`;
          friendlyReason = rawError || (isId ? 'Server pemrosesan AI mengalami kendala internal sementara.' : 'AI processing server encountered a temporary internal issue.');
          suggestion = isId ? 'Tunggu beberapa detik dan coba kirimkan kembali pertanyaan Anda.' : 'Wait a few moments and try sending your prompt again.';
        } else {
          errorCategory = isId ? `Kendala Pemrosesan (HTTP ${status || 'Error'})` : `Processing Issue (HTTP ${status || 'Error'})`;
          friendlyReason = rawError || (isId ? 'Gagal menerima respons yang valid dari server AI.' : 'Failed to receive a valid response from the AI server.');
          suggestion = isId ? 'Periksa koneksi internet Anda atau coba ajukan kembali pertanyaan.' : 'Check your internet connection or try asking again.';
        }

        const formattedError = [
          `### ${errorCategory}`,
          '',
          friendlyReason,
          '',
          `| Parameter | ${isId ? 'Detail Keterangan' : 'Description'} |`,
          '| :--- | :--- |',
          `| **${isId ? 'Status HTTP' : 'HTTP Status'}** | \`${status || 'Error'}\` |`,
          `| **${isId ? 'Detail Teknis' : 'Technical Details'}** | \`${(rawError || (isId ? 'Tidak ada detail teknis tambahan' : 'No additional technical details')).slice(0, 200)}\` |`,
          mediaList.length > 0 ? `| **${isId ? 'Berkas Terkait' : 'Associated Files'}** | ${mediaList.map(m => `\`${m.name}\``).join(', ')} |` : '',
          '',
          `> **${isId ? 'Saran Solusi:' : 'Suggested Solution:'}**`,
          `> ${suggestion}`
        ].filter(Boolean).join('\n');

        throw new Error(formattedError);
      }

      if (hasValidText) {
        let fullReply = extractedReply;
        const rawThinking = result.thinking || result.reasoning || result.reasoning_content || result.thought || '';
        if (rawThinking && !fullReply.includes('<think>')) {
          fullReply = `<think>${rawThinking}</think>\n\n${fullReply}`;
        }

        // If edge response already returns sources, use them
        if (result.sources && Array.isArray(result.sources)) {
          attachedSources = result.sources;
          attachedEngine = result.search_engine_used || attachedEngine || 'tavily';
        }

        // Tampilkan teks dengan efek ketikan (Typewriter Streaming) per kata seperti GPT / Gemini
        const tokens = fullReply.match(/\S+\s*/g) || [fullReply];
        let currentTyped = '';

        await new Promise<void>((resolve) => {
          let tokenIndex = 0;
          const chunkSize = Math.max(1, Math.floor(tokens.length / 80));
          const intervalMs = 16;

          typewriterIntervalRef.current = setInterval(() => {
            if (abortControllerRef.current?.signal.aborted) {
              if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
              typewriterIntervalRef.current = null;
              resolve();
              return;
            }

            for (let i = 0; i < chunkSize && tokenIndex < tokens.length; i++) {
              currentTyped += tokens[tokenIndex];
              tokenIndex++;
            }

            aiReplyText = currentTyped;
            setMessages(prev => {
              const next = [...prev];
              const targetIdx = next.findIndex(m => m.id === aiMessageId);
              if (targetIdx !== -1) {
                next[targetIdx] = { 
                  ...next[targetIdx], 
                  text: currentTyped,
                  reasoningEffort: currentReasoningEffort,
                  has_sources: attachedSources.length > 0,
                  search_engine_used: attachedEngine,
                  sources: attachedSources.length > 0 ? attachedSources : undefined
                };
              }
              return next;
            });

            if (tokenIndex >= tokens.length) {
              if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
              typewriterIntervalRef.current = null;
              resolve();
            }
          }, intervalMs);
        });
      }

      if (!aiReplyText.trim()) {
        aiReplyText = lang === 'id' ? "Respons AI tidak menghasilkan teks." : "AI response produced no text.";
        setMessages(prev => {
          const next = [...prev];
          const targetIdx = next.findIndex(m => m.id === aiMessageId);
          if (targetIdx !== -1) {
            next[targetIdx] = { 
              ...next[targetIdx], 
              text: aiReplyText,
              reasoningEffort: currentReasoningEffort,
              has_sources: attachedSources.length > 0,
              search_engine_used: attachedEngine,
              sources: attachedSources.length > 0 ? attachedSources : undefined
            };
          }
          return next;
        });
      }

      // Simpan percakapan ke tabel message_bluefox & perbarui timestamp session_bluefox
      if (motionMessageId) {
        (async () => {
          try {
            await supabase
              .from('message_bluefox')
              .update({
                ai_response: aiReplyText,
                attachments: attachmentMetadata || []
              })
              .eq('id', motionMessageId);
            console.log('[Supabase message_bluefox] Baris berhasil diperbarui dengan respon akhir AI');
          } catch (err) {
            console.warn("⚠️ [Supabase message_bluefox] Info update respon AI:", err);
          }
        })();
      } else {
        saveChatTurn(effectiveConvId, userText, aiReplyText, attachmentMetadata).catch(err => {
          console.warn("⚠️ [Supabase message_bluefox] Info simpan pesan (saveChatTurn):", err);
        });
      }
      sendMessageToSupabase(aiReplyText, effectiveConvId, 'assistant').catch(err => {
        console.warn("⚠️ [Supabase] Info simpan pesan asisten:", err);
      });

      // Ekstrak kode animasi [BLUEFOX_MOTION] dari respon AI
      const parsedMotion = parseAiResponse(aiReplyText);
      const detectedMotionCode = (parsedMotion.hasMotionCode && parsedMotion.codeToRender)
        ? parsedMotion.codeToRender
        : undefined;

      if (detectedMotionCode) {
        // Otomatis buka panel samping & suntikkan kode ke iframe srcdoc sesuai alur eksekusi Bluefox
        setActiveMotionCode(detectedMotionCode);
        setIsMotionPanelOpen(true);
      }

      const finalMessages = [...updatedMessages, {
        id: aiMessageId,
        role: 'model' as const,
        text: aiReplyText,
        reasoningEffort: currentReasoningEffort,
        has_sources: attachedSources.length > 0,
        search_engine_used: attachedEngine,
        sources: attachedSources.length > 0 ? attachedSources : undefined,
        motionCode: detectedMotionCode
      }];

      if (detectedMotionCode) {
        setMessages(finalMessages);
      }

      setChatSessions(prev => {
        const next = [...prev];
        const updateIdx = next.findIndex(s => s.id === effectiveConvId);
        if (updateIdx !== -1) {
          next[updateIdx] = {
            ...next[updateIdx],
            id: effectiveConvId,
            messages: finalMessages,
            updatedAt: Date.now()
          };
        } else {
          next.unshift({
            id: effectiveConvId,
            title: userText.length > 30 ? userText.substring(0, 30) + '...' : userText,
            messages: finalMessages,
            updatedAt: Date.now(),
            model: selectedModel
          });
        }
        saveSessionsToLocal(next);
        return next;
      });

      // Sinkronisasi ringan daftar sesi untuk memperbarui judul di sidebar tanpa mengganggu chat aktif
      fetchUserSessions().then((dbSessions) => {
        if (dbSessions && dbSessions.length > 0) {
          const formatted: ChatSession[] = dbSessions.map((s: any) => ({
            id: s.id,
            title: s.title || 'Percakapan',
            messages: s.id === effectiveConvId ? finalMessages : [],
            updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
            model: 'agnes-2.5-flash',
            isPinned: false
          }));

          setChatSessions((prev) => {
            const pinnedMap = new Map(prev.filter(p => p.isPinned).map(p => [p.id, true]));
            const prevMessagesMap = new Map(prev.map(p => [p.id, p.messages || []]));
            const combined = formatted.map(f => ({
              ...f,
              isPinned: pinnedMap.has(f.id),
              messages: f.id === effectiveConvId ? finalMessages : (prevMessagesMap.get(f.id) || [])
            }));
            return sortSessions(combined);
          });
        }
      }).catch(() => {});
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (isUserStoppedRef.current) {
          console.log('Request stopped by user');
          if (aiReplyText && aiReplyText.trim()) {
            sendMessageToSupabase(aiReplyText, effectiveConvId, 'assistant').catch(() => {});
          }
          return;
        }

        // Penanganan waktu tunggu timeout 80 detik
        const isId = lang === 'id';
        const timeoutMsg = [
          `### ${isId ? 'Waktu Tunggu Pemrosesan Habis (Timeout 80 Detik)' : 'Processing Timeout (80s Timeout)'}`,
          '',
          isId 
            ? 'Server AI membutuhkan waktu lebih dari 80 detik untuk memproses permintaan ini sehingga koneksi dihentikan otomatis.'
            : 'The AI server took more than 80 seconds to complete this request and the connection was automatically closed.',
          '',
          `| Parameter | ${isId ? 'Keterangan' : 'Detail'} |`,
          '| :--- | :--- |',
          `| **${isId ? 'Batas Waktu' : 'Time Limit'}** | ${isId ? '80 Detik' : '80 Seconds'} |`,
          mediaList.length > 0 ? `| **${isId ? 'Berkas Lampiran' : 'Attachment Files'}** | ${mediaList.map(m => `\`${m.name}\``).join(', ')} |` : '',
          '',
          `> **${isId ? 'Saran Solusi:' : 'Suggested Solution:'}**`,
          isId 
            ? '> - Jika berkas teks atau PDF cukup panjang, coba tanyakan bagian spesifik atau ringkas isi berkas.\n> - Coba kirimkan kembali pertanyaan dengan model AI alternatif.'
            : '> - If the text file or PDF is long, try asking about specific sections.\n> - Try resubmitting your query using an alternative AI model.'
        ].filter(Boolean).join('\n');

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: timeoutMsg,
        };
        setMessages(prev => {
          const filtered = prev.filter(m => m.text.trim() !== '');
          return [...filtered, errorMessage];
        });
        showToast(isId ? "Waktu tunggu permintaan habis (Timeout)" : "Request timed out");
        return;
      }

      console.error("[FRONTEND CRASH ERROR]:", err);
      const isId = lang === 'id';
      const rawErrMsg = String(err?.message || (isId ? "Gagal memproses pesan dari Edge Function." : "Failed to process message from Edge Function.")).trim();
      const isAlreadyFormatted = rawErrMsg.includes('### ') || rawErrMsg.includes('| :--- |');

      const fullDisplay = isAlreadyFormatted ? rawErrMsg : [
        `### ${isId ? 'Kendala Komunikasi Server' : 'Server Communication Issue'}`,
        '',
        rawErrMsg.includes('Failed to fetch') 
          ? (isId 
              ? 'Gagal menghubungi server AI. Kemungkinan koneksi internet Anda terputus atau server tidak dapat dijangkau.'
              : 'Failed to reach AI server. Your connection might be offline or the server is temporarily unreachable.')
          : rawErrMsg,
        '',
        mediaList.length > 0 ? `| Parameter | ${isId ? 'Keterangan' : 'Detail'} |\n| :--- |\n| **${isId ? 'Berkas Terkait' : 'Associated Files'}** | ${mediaList.map(m => `\`${m.name}\``).join(', ')} |\n` : '',
        `> **${isId ? 'Saran Solusi:' : 'Suggested Solution:'}**`,
        isId 
          ? '> Periksa koneksi internet Anda atau muat ulang halaman jika masalah terus berlanjut.'
          : '> Check your internet connection or refresh the page if the issue persists.'
      ].filter(Boolean).join('\n');

      setErrorState(rawErrMsg);
      showToast(isId ? "Terjadi kendala pemrosesan" : "Processing error occurred");

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: fullDisplay,
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.text.trim() !== '');
        return [...filtered, errorMessage];
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      // Matikan loading animasi (...) dalam kondisi apapun
      setIsLoading(false);
      setIsMotionLoading(false);
      setIsMotionFinalizing(false);
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    if (confirm("Hapus seluruh percakapan?")) {
      setMessages([]);
    }
  };

  const exportChat = (format: 'markdown' | 'json') => {
    if (messages.length === 0) return;
    const fileName = `chat-export-${Date.now()}`;
    let content = '';

    if (format === 'json') {
      content = JSON.stringify(messages, null, 2);
    } else {
      content = messages.map(m => `**${m.role === 'user' ? 'You' : 'AI'}**: \n${m.text}`).join('\n\n---\n\n');
    }

    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.${format === 'json' ? 'json' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const lastAiMessage = [...messages].reverse().find(m => m.role === 'model');
  const maxExpectedLength = 4000;
  const progressPercent = lastAiMessage ? Math.min((lastAiMessage.text.length / maxExpectedLength) * 100, 100) : 0;

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom > 150) {
      setIsScrolledUp(true);
    } else {
      setIsScrolledUp(false);
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      {!showSplash && isSyncingSSO && (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#00050b] text-white px-6">
          <div className="max-w-md w-full bg-gray-900/40 border border-blue-500/10 p-8 rounded-2xl backdrop-blur-2xl text-center space-y-6 shadow-2xl">
            <div className="relative flex justify-center">
              {/* Pulsing deep glow ring */}
              <div className="absolute inset-0 w-16 h-16 bg-blue-500/20 rounded-full filter blur-xl animate-pulse mx-auto"></div>
              {/* Spinner */}
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-white bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
                Sinkronisasi Akun...
              </h2>
              <p className="text-gray-400 text-sm font-medium">
                {syncStatus}
              </p>
            </div>
            
            <div className="pt-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                Sistem Otentikasi Terenkripsi TMPA
              </span>
            </div>
          </div>
        </div>
      )}

      {!showSplash && !isSyncingSSO && authChecking && (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#00050b] text-white">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-400 font-medium text-sm">Memverifikasi sesi dari website utama, silakan tunggu...</p>
        </div>
      )}

      {!showSplash && !authChecking && authError && (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#00050b] text-white px-6 text-center">
          <div className="max-w-md bg-gray-900/50 border border-red-500/20 p-8 rounded-2xl backdrop-blur-xl">
            <h2 className="text-xl font-bold text-red-400 mb-3">Gagal Memverifikasi Sesi</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              {authError}
            </p>
            <button
              onClick={() => { setAuthError(null); setAppState('landing'); }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'verify' && (
        <VerifyPage />
      )}

      {!showSplash && !authChecking && !authError && appState === 'integrations' && (
        <IntegrationsPage onBack={() => setAppState(user ? 'chat' : 'landing')} user={user} />
      )}

      {!showSplash && !authChecking && !authError && appState === 'landing' && (
        <LandingPage onStart={handleLandingStart} />
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'login' && (
        <LoginPage onLoginSuccess={() => setAppState('chat')} onBack={() => setAppState('landing')} />
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'chat' && (
        <div className={cn(
          "flex flex-col h-screen font-sans selection:bg-blue-600/20 overflow-hidden relative transition-colors",
          isBlueRilis 
            ? "bg-[#070b14] text-slate-100" 
            : "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 app-clean-grid"
        )}>
          {/* Subtle light & dark blue backdrop glow for Blue Rilis Home */}
          {isBlueRilis && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-b from-blue-600/20 via-cyan-500/10 to-transparent blur-3xl rounded-full" />
              <div className="absolute -bottom-40 right-10 w-[500px] h-[350px] bg-gradient-to-t from-blue-900/30 via-blue-800/10 to-transparent blur-3xl rounded-full" />
              <div className="absolute -bottom-40 left-10 w-[500px] h-[350px] bg-gradient-to-t from-indigo-950/25 via-sky-900/10 to-transparent blur-3xl rounded-full" />
            </div>
          )}

        {/* Header */}
        <header className={cn(
          "sticky top-0 z-20 backdrop-blur-xl shadow-xs transition-colors",
          isBlueRilis 
            ? "bg-[#090f1d]/85 border-b border-blue-500/25 text-white" 
            : "bg-white/90 dark:bg-slate-950/90 border-b border-slate-200/80 dark:border-slate-800/80"
        )}>
        <div className="max-w-5xl mx-auto px-3 md:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={cn(
                "w-10 h-10 -ml-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                isBlueRilis 
                  ? "text-slate-300 hover:text-white hover:bg-slate-800/60" 
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
              )}
              title={lang === 'id' ? "Buka Menu & Riwayat" : "Open Menu"}
            >
              <Menu size={20} />
            </button>
            <button 
              onClick={startNewChat}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                isBlueRilis 
                  ? "text-slate-300 hover:text-white hover:bg-slate-800/60" 
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
              )}
              title={lang === 'id' ? "Percakapan Baru" : "New Chat"}
            >
              <SquarePen size={18} />
            </button>
          </div>

          {/* Model Selector Trigger & Dev Mode Badge */}
          <div className="flex items-center gap-2">
            {(() => {
              const modelDisplayName = selectedModel === 'agnes-2.5-flash'
                ? 'bluefox pro' 
                : selectedModel === 'tencent-hy3-free' 
                ? 'bluefox standard' 
                : 'bluefox Dilo';
              const currentEffort = getSmartSelectEffort(selectedModel, smartSelectLevel);
              const effortLabel = currentEffort.charAt(0).toUpperCase() + currentEffort.slice(1);

              return (
                <div 
                  onClick={() => setIsModelSelectorOpen(true)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors cursor-pointer text-xs font-semibold active:scale-95 shadow-xs",
                    isBlueRilis 
                      ? "bg-slate-900/80 hover:bg-slate-850 border border-blue-500/30 text-slate-200" 
                      : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  )}
                  title="Pilih Model AI & Smart Select"
                >
                  <span className="flex items-center gap-1.5">
                    <strong className="text-blue-600 dark:text-blue-400 font-bold">{modelDisplayName}</strong>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      ({effortLabel})
                    </span>
                  </span>
                  {isVisionActive && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                      <Eye size={10} /> Vision
                    </span>
                  )}
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                </div>
              );
            })()}

            {isDevMode && (
              <span
                onClick={() => setIsSettingsOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold font-mono tracking-tight cursor-pointer hover:bg-emerald-100 transition-colors shadow-2xs"
                title="Mode Development (No Limit) Aktif di Browser Ini"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                NO LIMIT
              </span>
            )}
          </div>

          <div className="relative shrink-0 flex items-center gap-1">
            {/* Fitur Bagikan ketika AI menjawab sesi chat untuk pertama kali di sebelah tombol download */}
            {messages.some(m => m.role === 'model' && m.text.trim().length > 0) && (
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                title={lang === 'id' ? "Bagikan Obrolan" : "Share Chat"}
              >
                <Share2 size={15} />
                <span className="hidden sm:inline">{lang === 'id' ? "Bagikan" : "Share"}</span>
              </button>
            )}

            {/* Tombol Panel Samping Bluefox Motion */}
            {activeMotionCode && (
              <button
                onClick={() => setIsMotionPanelOpen(!isMotionPanelOpen)}
                className={cn(
                  "h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 border",
                  isMotionPanelOpen
                    ? "text-white bg-blue-600 border-blue-600 hover:bg-blue-700"
                    : "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800"
                )}
                title={lang === 'id' ? "Buka/Tutup Panel Animasi (Motion)" : "Toggle Motion Panel"}
              >
                <Film size={15} />
                <span className="hidden sm:inline">Motion</span>
              </button>
            )}

            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title={lang === 'id' ? "Export Konversasi" : "Export Chat"}
            >
              <Download size={18} />
            </button>
            <AnimatePresence>
              {isExportDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsExportDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lang === 'id' ? 'Export Chat' : 'Export Chat'}</p>
                    </div>
                    <button
                      onClick={() => { exportChat('markdown'); setIsExportDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Format Markdown (.md)
                    </button>
                    <button
                      onClick={() => { exportChat('json'); setIsExportDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Format JSON (.json)
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Progress Bar (AI response length indicator) */}
      {messages.length > 0 && lastAiMessage && (
        <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-800 z-10 shrink-0 select-none pointer-events-none">
          <motion.div 
            className="h-full bg-blue-600 rounded-r-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}

      {/* Container Kolom Chat & Panel Samping Bluefox Motion */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Main Chat Area */}
          <main onScroll={handleScroll} className="flex-1 overflow-y-auto w-full scroll-smooth relative">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto">
            <h2 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight text-center leading-tight">
              {lang === 'id' ? 'Apa yang bisa saya bantu hari ini?' : 'How can I assist you today?'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md text-center text-xs md:text-sm mb-8 leading-relaxed px-4 md:px-0">
              {lang === 'id' 
                ? 'Asisten AI cerdas untuk bertukar ide, penulisan kode, penelusuran web real-time, dan otomasi tugas.' 
                : 'Intelligent AI assistant for coding, real-time web search, data synthesis, and task automation.'}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 w-full">
              {(lang === 'id' ? [
                "Tuliskan draf email lamaran kerja",
                "@search berita teknologi AI terkini hari ini",
                "Buat rencana jadwal belajar 1 minggu",
                "Jelaskan konsep machine learning sederhana"
              ] : [
                "Draft a professional job application email",
                "@search latest AI tech news today",
                "Create a 1-week study schedule plan",
                "Explain core machine learning concepts simply"
              ]).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-sm transition-all rounded-xl p-3.5 md:p-4 text-left group flex items-center justify-between cursor-pointer"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-snug">{suggestion}</span>
                  <Sparkles size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pb-4">
            {messages.map(msg => (
              <ChatMessage 
                key={msg.id} 
                message={msg} 
                onEdit={handleEditMessage} 
                onRetry={handleRetryMessage}
                onStop={isLoading ? stopGeneration : undefined} 
                onOpenMediaScreen={handleOpenMediaScreen}
                onOpenMotionPanel={(code) => {
                  setActiveMotionCode(code);
                  setIsMotionPanelOpen(true);
                }}
              />
            ))}
            {isLoading && (
              isMotionLoading ? (
                <MotionLoadingProgress
                  isFinalizing={isMotionFinalizing}
                  onFinalizeComplete={() => {
                    if (motionFinalizeResolverRef.current) {
                      motionFinalizeResolverRef.current();
                      motionFinalizeResolverRef.current = null;
                    }
                  }}
                  onStop={stopGeneration}
                />
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="py-4 sm:py-5 px-4 sm:px-8 flex w-full"
                >
                  <div className="max-w-3xl mx-auto flex w-full items-center gap-1.5 pl-1 sm:pl-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Floating scroll to bottom button */}
      <AnimatePresence>
        {isScrolledUp && messages.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-[90px] md:bottom-[100px] right-6 z-30"
          >
            <button
              onClick={scrollToBottom}
              className="bg-white dark:bg-slate-800 text-slate-700 dark:text-white p-2.5 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 transition-colors group cursor-pointer"
            >
              <ArrowDown size={18} className="group-hover:text-blue-600 transition-colors" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dev Mode Limit Alert Banner */}
      {isUsageLimitReached && (
        <div className="bg-rose-50 dark:bg-rose-950/80 border-t border-b border-rose-200 dark:border-rose-800/80 px-4 py-2.5 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-semibold">{lang === 'id' ? 'Batas Kuota Tercapai (100%)' : 'Usage Limit Reached (100%)'}</span>
            <span className="hidden sm:inline opacity-80">{lang === 'id' ? '— Semua model AI sementara dijeda.' : '— All AI models are temporarily paused.'}</span>
          </div>
          <button
            onClick={handleResetLimits}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
            title={lang === 'id' ? "Reset batas penggunaan AI untuk tahap develop / pengujian" : "Reset AI usage limits for testing"}
          >
            <RotateCcw size={13} />
            <span>{lang === 'id' ? 'Reset Limit (Dev)' : 'Reset Quota (Dev)'}</span>
          </button>
        </div>
      )}

      {/* Input Form / Read Mode Indicator */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 pt-2 shrink-0 relative z-20">
        {sharedAccessMode === 'read' ? (
          <div className="py-5 px-4 flex flex-col items-center justify-center gap-2.5 max-w-xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-xs">
              <Eye size={15} />
              <span>
                {lang === 'id' 
                  ? 'Mode Baca (Read) — Anda hanya dapat membaca obrolan ini. Input prompt disembunyikan dan sesi tidak disimpan ke akun Anda.' 
                  : 'Read Mode — You can only read this conversation. Prompt input is hidden and session is not saved.'}
              </span>
            </div>
            <button
              onClick={() => {
                setSharedAccessMode(null);
                startNewChat();
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              {lang === 'id' ? 'Mulai Percakapan Baru Saya Sendiri' : 'Start My Own New Conversation'}
            </button>
          </div>
        ) : (
          <>
            {sharedAccessMode === 'remix' && (
              <div className="px-4 pb-1.5 max-w-4xl mx-auto flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                  <span>
                    {lang === 'id'
                      ? 'Mode Remix: Semua konteks percakapan terbawa ke bawah. Kirim pesan untuk membuat dan menyimpan sesi cabang baru Anda.'
                      : 'Remix Mode: Full conversation context retained. Send a message to fork and save into your own session.'}
                  </span>
                </div>
              </div>
            )}
            <ChatInput 
              onSend={(text, media) => handleSendMessage(text, undefined, undefined, media)} 
              onSubmitManualMotion={handleManualMotionSubmit}
              isLoading={isLoading} 
              onStop={stopGeneration} 
              connectors={connectors}
              onToggleConnector={toggleConnector}
              onShowAllConnectors={() => setIsConnectorsModalOpen(true)}
              onAutoEnableVision={handleEnableVision}
              onDisableVision={handleDisableVision}
              isVisionActive={isVisionActive}
              disabled={isUsageLimitReached}
              onOpenMotionManual={() => setIsMotionManualModalOpen(true)}
              onOpenMotionPanel={() => setIsMotionPanelOpen(true)}
              appStyle={appStyle}
            />
          </>
        )}
      </footer>
    </div>

    {/* Panel Samping Bluefox Motion */}
    {isMotionPanelOpen && (
      <MotionPanel
        isOpen={isMotionPanelOpen}
        onClose={() => setIsMotionPanelOpen(false)}
        motionCode={activeMotionCode}
        onUpdateCode={(newCode) => setActiveMotionCode(newCode)}
      />
    )}
  </div>

      {/* Slide-down Model Selector Overlay (Half-screen Dropdown from the Top) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "fixed top-0 left-0 bottom-0 w-[280px] z-50 flex flex-col shadow-2xl transition-colors",
                isBlueRilis 
                  ? "bg-[#090f1d]/90 backdrop-blur-2xl border-r border-blue-500/20 text-slate-100 shadow-[0_0_50px_rgba(15,23,42,0.8)]" 
                  : "bg-white border-r border-slate-200 text-slate-900"
              )}
            >
              <div className="p-4 pt-6 flex-1 flex flex-col gap-1 overflow-y-auto">
                {/* 1. BAGIAN ATAS: Chat Baru & Menu Utama (Store, MCP, Web Utama, Setting) */}
                <button 
                  onClick={startNewChat} 
                  className="flex items-center gap-3 px-4 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-semibold mb-2 shadow-sm cursor-pointer"
                >
                  <Sparkles size={18} />
                  <span>{t.newChat}</span>
                </button>

                <div className="space-y-1 mb-3">
                  {/* 1. Store (di bawah new chat) */}
                  <button 
                    onClick={() => {
                      setShowActionToast(lang === 'id' ? 'Membuka TMPA Store...' : 'Opening TMPA Store...');
                      setTimeout(() => setShowActionToast(null), 2000);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <Store size={18} className="text-amber-500" />
                    <span>{t.store}</span>
                  </button>

                  {/* 2. File history (di bawah store) */}
                  <button 
                    onClick={() => { setIsFileHistoryOpen(true); setIsSidebarOpen(false); }} 
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <ImageIcon size={18} className="text-cyan-600" />
                    <span>{t.fileHistory || (lang === 'id' ? 'File history' : 'File history')}</span>
                  </button>

                  {/* 3. Setting (di bawah file history) */}
                  <button 
                    onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }} 
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <Settings size={18} className="text-purple-600" />
                    <span>{t.settings}</span>
                  </button>

                  {/* 4. Load more (di bawah setting) */}
                  <button 
                    onClick={() => setIsMenuLoadMoreOpen(prev => !prev)} 
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isMenuLoadMoreOpen ? 'rotate-180 text-blue-600' : ''}`} />
                      <span>Load more</span>
                    </div>
                  </button>

                  {/* Isi Load more: Website utama dan MCP */}
                  {isMenuLoadMoreOpen && (
                    <div className="pl-3.5 space-y-1 pt-1 pb-1 border-l-2 border-slate-200 ml-4">
                      {/* Website utama */}
                      <button 
                        onClick={() => { window.location.href = "https://tmpa.my.id"; }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                      >
                        <Globe size={16} className="text-blue-600" />
                        <span>{lang === 'id' ? 'Website utama' : 'Main Website'}</span>
                      </button>

                      {/* MCP */}
                      <button 
                        onClick={() => { setAppState('integrations'); setIsSidebarOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                      >
                        <Layers size={16} className="text-emerald-600" />
                        <span>MCP</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="my-1 border-t border-slate-200" />

                {/* 2. BAGIAN TENGAH: Riwayat Chat User (Dengan Search, Pin Priority, dan Tahan 1 Detik untuk Pin/Hapus) */}
                <div className="flex-1 flex flex-col pt-2 min-h-0">
                  <div className="flex items-center justify-between px-3 mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t.chatHistory}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {lang === 'id' ? 'Tahan 1dtk: Opsi' : 'Hold 1s: Options'}
                    </span>
                  </div>

                  {chatSessions.length > 0 && (
                    <div className="mb-2.5 px-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder={t.searchHistory} 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Chat Session List: Sorted so pinned always stays at top */}
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {chatSessions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {lang === 'id' ? 'Belum ada riwayat percakapan' : 'No chat history yet'}
                      </div>
                    ) : (
                      chatSessions
                        .filter((session) => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .sort((a, b) => {
                          if (a.isPinned && !b.isPinned) return -1;
                          if (!a.isPinned && b.isPinned) return 1;
                          return (b.updatedAt || 0) - (a.updatedAt || 0);
                        })
                        .map((session) => {
                          const isActive = currentSessionId === session.id;
                          const isPinned = Boolean(session.isPinned);

                          return (
                            <div
                              key={session.id}
                              onMouseDown={() => startLongPress(session)}
                              onMouseUp={cancelLongPress}
                              onMouseLeave={cancelLongPress}
                              onTouchStart={() => startLongPress(session)}
                              onTouchEnd={cancelLongPress}
                              onTouchMove={cancelLongPress}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                cancelLongPress();
                                setContextMenuSession(session);
                              }}
                              onClick={() => {
                                if (isLongPressRef.current) {
                                  isLongPressRef.current = false;
                                  return;
                                }
                                loadSession(session.id);
                              }}
                              className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition-all text-sm font-medium cursor-pointer select-none
                                ${isActive ? 'bg-blue-50 border border-blue-200 text-blue-700 font-semibold' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent'}
                                ${isPinned ? 'bg-amber-50/70 border-amber-200 text-amber-900' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {isPinned && (
                                  <Pin size={13} className="text-amber-500 flex-shrink-0 rotate-45" />
                                )}
                                <span className={`truncate text-xs ${isPinned ? 'text-amber-900 font-bold' : ''}`}>
                                  {session.title}
                                </span>
                              </div>

                              {/* Tombol Opsi Cepat / Context Menu Trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelLongPress();
                                  setContextMenuSession(session);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-slate-200/60 cursor-pointer flex-shrink-0"
                                title={lang === 'id' ? 'Opsi Percakapan' : 'Chat Options'}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* 3. BAGIAN BAWAH: Profil User & Logout */}
              <div className={cn(
                "p-4 border-t flex flex-col gap-3 transition-colors",
                isBlueRilis ? "border-blue-500/20 bg-slate-900/60" : "border-slate-200 bg-slate-50/50"
              )}>
                <div className="flex items-center gap-3 px-2">
                  <UserGradientAvatar 
                    userId={user?.id}
                    email={user?.email}
                    name={user?.user_metadata?.full_name}
                    size="md"
                    className="w-10 h-10 rounded-xl"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn(
                        "text-sm font-semibold truncate",
                        isBlueRilis ? "text-slate-100" : "text-slate-900"
                      )}>
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'TMPA User'}
                      </span>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-500">
                          {userTier}
                        </span>
                        {isUserAdmin(user) && (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-extrabold uppercase tracking-wider shadow-2xs">
                            <ShieldCheck size={10} className="text-amber-500" />
                            <span>Admin</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs truncate",
                      isBlueRilis ? "text-slate-400" : "text-slate-500"
                    )} title={user?.email || ''}>
                      {user?.email || 'user@tmpa.example'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400 truncate" title={user?.id || 'UUID'}>
                        ID: {user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : 'tmpa-guest'}
                      </span>
                      {user?.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(user.id);
                            setShowActionToast(lang === 'id' ? 'ID Pengguna disalin!' : 'User ID copied!');
                            setTimeout(() => setShowActionToast(null), 2000);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
                          title={lang === 'id' ? 'Salin UUID' : 'Copy UUID'}
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* DUA TOMBOL DI BAWAH ACCOUNT USER */}
                <div className="flex flex-col gap-2 pt-1">
                  {/* 1. Chos account */}
                  <button 
                    type="button"
                    onClick={() => {
                      setIsChooseAccountOpen(true);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer shadow-2xs group transition-all",
                      isBlueRilis 
                        ? "border-blue-500/30 bg-slate-800/60 hover:bg-slate-750 text-slate-200 hover:text-white" 
                        : "border-slate-200 bg-white hover:bg-blue-50/70 hover:border-blue-300 text-slate-700 hover:text-blue-700"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users size={17} className="text-blue-500 group-hover:scale-110 transition-transform" />
                      <span>{lang === 'id' ? 'Chos account' : 'Choose account'}</span>
                    </div>
                    <ChevronDown size={15} className="text-slate-400 group-hover:text-blue-500 -rotate-90 transition-transform" />
                  </button>

                  {/* 2. Logout pada umumnya */}
                  <button 
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center w-full gap-2.5 px-3.5 py-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors text-sm font-semibold cursor-pointer border border-transparent hover:border-rose-200"
                  >
                    <LogOut size={17} />
                    <span>{t.logout}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Setengah Layar Bottom Sheet: Choose Account */}
      <AnimatePresence>
        {isChooseAccountOpen && (
          <ChooseAccountModal
            isOpen={isChooseAccountOpen}
            onClose={() => setIsChooseAccountOpen(false)}
            currentUser={user}
            currentTier={userTier}
            onSwitchAccount={handleSwitchAccount}
            onAddAccount={handleAddAccount}
            onCreateAccount={handleCreateAccount}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModelSelectorOpen && (
          <div className="fixed inset-0 z-30 flex flex-col justify-start">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs" 
              onClick={() => setIsModelSelectorOpen(false)}
            />
            
            {/* Panel (Drops from the Top down to ~half screen) */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[75vh] md:max-h-[55vh] bg-white border-b border-slate-200 shadow-2xl z-40 overflow-y-auto text-slate-900"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Pilih Model AI</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Tentukan model yang disukai untuk memproses obrolan Anda</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setIsModelSelectorOpen(false);
                        setIsVisionSelectorOpen(true);
                      }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                        isVisionActive 
                          ? 'text-cyan-700 bg-cyan-50 border border-cyan-300 hover:bg-cyan-100' 
                          : 'text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isVisionActive ? <Eye size={14} className="text-cyan-600" /> : <EyeOff size={14} />}
                      Vision {isVisionActive ? '(Aktif)' : ''}
                    </button>
                    <button 
                      onClick={() => {
                        setIsModelSelectorOpen(false);
                        setIsSmartSelectOpen(true);
                      }}
                      className="text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
                      title="Atur tingkat penalaran Smart Select"
                    >
                      <SlidersHorizontal size={14} />
                      Smart Select: {getSmartSelectEffort(selectedModel, smartSelectLevel).toUpperCase()}
                    </button>
                    <button 
                      onClick={() => setIsModelSelectorOpen(false)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {visionLockedNotice && (
                  <motion.div 
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs flex items-center gap-2"
                  >
                    <Lock size={14} className="text-cyan-600 shrink-0" />
                    <span>{visionLockedNotice}</span>
                  </motion.div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {/* Bluefox Pro (agnes-2.5-flash) Choice */}
                  <button 
                    onClick={() => handleSelectModel('agnes-2.5-flash')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      selectedModel === 'agnes-2.5-flash'
                        ? 'bg-blue-50/70 border-2 border-blue-600 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'agnes-2.5-flash' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Bot size={18} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const effort = getSmartSelectEffort('agnes-2.5-flash', smartSelectLevel);
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                              effort === 'high' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                              effort === 'medium' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                              effort === 'low' ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}>
                              <Sliders size={10} /> Smart Select: {effort.toUpperCase()}
                            </span>
                          );
                        })()}
                        {isVisionActive && (
                          <span className="text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Eye size={10} /> Vision Aktif
                          </span>
                        )}
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug">bluefox pro</h4>
                    <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase mt-1">power by agnes-2.5-flash</span>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Model penalaran tingkat tinggi Agnes 2.5 Flash dengan pemahaman kode, analisis visual multimodal terpadu, pemrosesan dokumen, dan Smart Select hingga tingkat High.
                    </p>
                  </button>

                  {/* bluefox standard (tencent-hy3-free) Choice */}
                  <button 
                    onClick={() => handleSelectModel('tencent-hy3-free')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all relative ${
                      isVisionActive 
                        ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed' 
                        : selectedModel === 'tencent-hy3-free'
                          ? 'bg-blue-50/70 border-2 border-blue-600 shadow-sm cursor-pointer' 
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'tencent-hy3-free' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Cpu size={18} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const effort = getSmartSelectEffort('tencent-hy3-free', smartSelectLevel);
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                              effort === 'high' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                              effort === 'medium' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                              effort === 'low' ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}>
                              <Sliders size={10} /> Smart Select: {effort.toUpperCase()}
                            </span>
                          );
                        })()}
                        {isVisionActive && (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Lock size={11} /> Terkunci
                          </span>
                        )}
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug">bluefox standard</h4>
                    <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase mt-1">power by tencent-hy3-free</span>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Model pengolah teks & pemrograman cepat dan tangguh. Smart Select bawaan Medium dan dapat diatur fleksibel hingga High.
                    </p>
                  </button>

                  {/* bluefox Dilo (laguna-s-2.1) Choice */}
                  <button 
                    onClick={() => handleSelectModel('laguna-s-2.1')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all relative ${
                      isVisionActive 
                        ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed' 
                        : selectedModel === 'laguna-s-2.1'
                          ? 'bg-blue-50/70 border-2 border-blue-600 shadow-sm cursor-pointer' 
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'laguna-s-2.1' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Layers size={18} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const effort = getSmartSelectEffort('laguna-s-2.1', smartSelectLevel);
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                              effort === 'high' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                              effort === 'medium' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                              effort === 'low' ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}>
                              <Sliders size={10} /> Smart Select: {effort.toUpperCase()}
                            </span>
                          );
                        })()}
                        {isVisionActive && (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Lock size={11} /> Terkunci
                          </span>
                        )}
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug">bluefox Dilo</h4>
                    <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase mt-1">power by laguna-s-2.1</span>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Teman ngobrol ramah dan santai dengan Smart Select hemat (Low). Dapat ditarik fleksibel dari None hingga High.
                    </p>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVisionSelectorOpen && (
          <div className="fixed inset-0 z-30 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs" 
              onClick={() => setIsVisionSelectorOpen(false)}
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[80vh] md:max-h-[60vh] bg-white border-t border-slate-200 shadow-2xl z-40 overflow-y-auto rounded-t-3xl text-slate-900"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <Eye size={20} className="text-cyan-600" />
                      Pengaturan Mode Vision
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Tentukan apakah mode pemrosesan visual aktif atau nonaktif</p>
                  </div>
                  <button 
                    onClick={() => setIsVisionSelectorOpen(false)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
                
                <div className="flex flex-col gap-3 md:gap-4">
                  {/* Option: Aktifkan Vision */}
                  <button 
                    onClick={handleEnableVision}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      isVisionActive 
                        ? 'bg-cyan-50 border-2 border-cyan-500 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isVisionActive ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Eye size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                            Aktifkan Vision (Bluefox Pro)
                            {isVisionActive && (
                              <span className="text-[11px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-300 px-2 py-0.5 rounded-full">
                                Sedang Digunakan
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-cyan-600 font-mono font-medium">model: agnes-2.5-flash (tanpa fallback)</span>
                        </div>
                      </div>
                      {isVisionActive && (
                        <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pl-12">
                      Mengaktifkan kemampuan analisis visual. Sistem akan otomatis memanggil dan mengunci model ke <strong className="text-cyan-700">Bluefox Pro (agnes-2.5-flash)</strong> tanpa fallback karena pemrosesan gambar & visual didukung oleh model Agnes 2.5 Flash.
                    </p>
                  </button>

                  {/* Option: No Vision */}
                  <button 
                    onClick={handleDisableVision}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      !isVisionActive 
                        ? 'bg-blue-50 border-2 border-blue-600 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${!isVisionActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <EyeOff size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                            No Vision
                            {!isVisionActive && (
                              <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full">
                                Standar Teks
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">Bebas memilih model</span>
                        </div>
                      </div>
                      {!isVisionActive && (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-12">
                      Mode percakapan standar tanpa analisis visual khusus. Anda bebas memilih model apa saja (Tmpa ai v2, Tmpa ai v1, atau Dilo).
                    </p>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSmartSelectOpen && (
          <div className="fixed inset-0 z-30 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs" 
              onClick={() => setIsSmartSelectOpen(false)}
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[85vh] md:max-h-[72vh] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl z-40 overflow-y-auto rounded-t-3xl text-slate-900 dark:text-slate-100"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800">
                      <SlidersHorizontal size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Smart Select</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {smartSelectLevel === 'auto' ? 'Mode Auto' : `Level ${smartSelectLevel.toUpperCase()}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tarik slider dari None hingga High untuk mengatur kedalaman proses berpikir AI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setIsSmartSelectOpen(false);
                        setIsModelSelectorOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                    >
                      Pilih Model
                    </button>
                    <button 
                      onClick={() => setIsSmartSelectOpen(false)}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-1.5 rounded-full transition-all cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {/* Interactive Drag/Pull Range Slider (None -> Low -> Medium -> High) */}
                {(() => {
                  const STEPS: Array<'none' | 'low' | 'medium' | 'high'> = ['none', 'low', 'medium', 'high'];
                  const currentEffort = getSmartSelectEffort(selectedModel, smartSelectLevel);
                  const activeStepIndex = smartSelectLevel === 'auto' 
                    ? (currentEffort === 'none' ? 0 : currentEffort === 'low' ? 1 : currentEffort === 'medium' ? 2 : 3)
                    : (smartSelectLevel === 'none' ? 0 : smartSelectLevel === 'low' ? 1 : smartSelectLevel === 'medium' ? 2 : 3);

                  const progressPercentage = (activeStepIndex / 3) * 100;
                  const activeColorClass = activeStepIndex === 3 
                    ? 'from-blue-600 via-indigo-600 to-purple-600' 
                    : activeStepIndex === 2 
                    ? 'from-blue-500 to-indigo-600' 
                    : activeStepIndex === 1 
                    ? 'from-sky-400 to-blue-500' 
                    : 'from-slate-400 to-slate-500';

                  return (
                    <div className="mb-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Sliders size={13} className="text-purple-600 dark:text-purple-400" />
                          Tarik Kontrol Smart Select:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSmartSelectLevel('auto')}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer border ${
                              smartSelectLevel === 'auto'
                                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                            }`}
                            title="Kembali ke setelan otomatis bawaan tiap model"
                          >
                            Auto Mode {smartSelectLevel === 'auto' ? '(Aktif)' : ''}
                          </button>
                        </div>
                      </div>

                      {/* Slider Track with Custom Progress Bar */}
                      <div className="relative pt-6 pb-2 px-1">
                        {/* Background Track */}
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                          <div 
                            className={`h-full bg-gradient-to-r ${activeColorClass} transition-all duration-300 rounded-full`}
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>

                        {/* Native Range Input overlay for dragging */}
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="1"
                          value={activeStepIndex}
                          onChange={(e) => {
                            const newIdx = parseInt(e.target.value, 10);
                            const nextLevel = STEPS[newIdx] || 'medium';
                            setSmartSelectLevel(nextLevel);
                          }}
                          className="absolute top-5 left-0 w-full h-5 opacity-0 cursor-pointer z-20"
                          aria-label="Tarik tingkat Smart Select"
                        />

                        {/* Step Markers & Clickable Stops */}
                        <div className="relative flex justify-between mt-3 text-xs">
                          {STEPS.map((stepKey, idx) => {
                            const isCurrent = activeStepIndex === idx;
                            const isPassed = activeStepIndex >= idx;
                            return (
                              <button
                                key={stepKey}
                                type="button"
                                onClick={() => setSmartSelectLevel(stepKey)}
                                className={`flex flex-col items-center group cursor-pointer transition-all ${
                                  isCurrent ? 'scale-105 font-bold' : 'opacity-70 hover:opacity-100'
                                }`}
                              >
                                <span className={`w-3.5 h-3.5 rounded-full mb-1 border-2 transition-all flex items-center justify-center ${
                                  isCurrent 
                                    ? 'bg-purple-600 border-white ring-2 ring-purple-400 scale-125' 
                                    : isPassed 
                                    ? 'bg-blue-600 border-white' 
                                    : 'bg-slate-300 dark:bg-slate-600 border-white dark:border-slate-800'
                                }`} />
                                <span className={`text-[11px] uppercase font-bold ${
                                  isCurrent 
                                    ? 'text-purple-700 dark:text-purple-300' 
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                  {stepKey}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Current Status Banner */}
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <span>Target model aktif ({selectedModel === 'agnes-2.5-flash' ? 'bluefox pro' : selectedModel === 'tencent-hy3-free' ? 'bluefox standard' : 'bluefox Dilo'}):</span>
                          <strong className="text-purple-700 dark:text-purple-300 uppercase font-bold">
                            Smart Select: {currentEffort}
                          </strong>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Geser pin atau klik salah satu kartu di bawah
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* 4 Cards: None -> Low -> Medium -> High */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* Step 1: None */}
                  <button 
                    type="button"
                    onClick={() => setSmartSelectLevel('none')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      smartSelectLevel === 'none' 
                        ? 'bg-slate-100/90 dark:bg-slate-800 border-2 border-slate-600 dark:border-slate-400 shadow-sm' 
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${smartSelectLevel === 'none' ? 'bg-slate-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          <Zap size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">None</h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              0% Thinking
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Tanpa penalaran / respon instan</span>
                        </div>
                      </div>
                      {smartSelectLevel === 'none' && (
                        <div className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-12">
                      AI langsung menjawab teks seketika tanpa meluangkan waktu penalaran latar belakang. Paling cepat untuk pertanyaan singkat dan to-the-point.
                    </p>
                  </button>

                  {/* Step 2: Low */}
                  <button 
                    type="button"
                    onClick={() => setSmartSelectLevel('low')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      smartSelectLevel === 'low' 
                        ? 'bg-sky-50/90 dark:bg-sky-950/60 border-2 border-sky-600 shadow-sm' 
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${smartSelectLevel === 'low' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">Low</h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                              33% Thinking
                            </span>
                          </div>
                          <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Penalaran ringan & hemat</span>
                        </div>
                      </div>
                      {smartSelectLevel === 'low' && (
                        <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-12">
                      Proses berpikir singkat untuk menyelaraskan konteks percakapan. Tingkat bawaan default untuk model <strong>bluefox Dilo</strong>.
                    </p>
                  </button>

                  {/* Step 3: Medium */}
                  <button 
                    type="button"
                    onClick={() => setSmartSelectLevel('medium')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      smartSelectLevel === 'medium' 
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 border-2 border-blue-600 shadow-sm' 
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${smartSelectLevel === 'medium' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          <Cpu size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">Medium</h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              66% Thinking
                            </span>
                          </div>
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Penalaran seimbang & terstruktur</span>
                        </div>
                      </div>
                      {smartSelectLevel === 'medium' && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-12">
                      Analisis logika dan pemecahan langkah berimbang. Sangat cocok untuk diskusi mendalam, penulisan, dan riset umum. Bawaan <strong>bluefox standard</strong>.
                    </p>
                  </button>

                  {/* Step 4: High */}
                  <button 
                    type="button"
                    onClick={() => setSmartSelectLevel('high')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      smartSelectLevel === 'high' 
                        ? 'bg-purple-50/90 dark:bg-purple-950/60 border-2 border-purple-600 shadow-sm' 
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${smartSelectLevel === 'high' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          <Brain size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">High</h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 animate-pulse">
                              100% Paling Tinggi
                            </span>
                          </div>
                          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">Daya pemikiran tertinggi</span>
                        </div>
                      </div>
                      {smartSelectLevel === 'high' && (
                        <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-12">
                      Daya pikir paling mendalam dan menyeluruh untuk coding rumit, matematika, logika ilmiah, serta visual kompleks. Bawaan <strong>bluefox pro</strong>.
                    </p>
                  </button>
                </div>

                {/* Auto Mode Breakdown Explainer */}
                <div className="mt-5 p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Ringkasan Level Berpikir per Model:
                    </span>
                    {smartSelectLevel !== 'auto' && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                        *Ditentukan manual ({smartSelectLevel.toUpperCase()})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                      Bluefox Pro: <strong>{getSmartSelectEffort('agnes-2.5-flash', smartSelectLevel).toUpperCase()}</strong>
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                      Bluefox Standard: <strong>{getSmartSelectEffort('tencent-hy3-free', smartSelectLevel).toUpperCase()}</strong>
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
                      Bluefox Dilo: <strong>{getSmartSelectEffort('laguna-s-2.1', smartSelectLevel).toUpperCase()}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Long-Press (1s) Chat Session Action Modal */}
      <AnimatePresence>
        {contextMenuSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setContextMenuSession(null)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl z-10 overflow-hidden text-slate-900 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {contextMenuSession.isPinned && (
                      <span className="p-1 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
                        <Pin size={12} className="rotate-45" />
                      </span>
                    )}
                    <h3 className="font-bold text-slate-900 text-base truncate">
                      {contextMenuSession.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'id' ? 'Kelola Sesi Percakapan' : 'Manage Chat Session'}
                  </p>
                </div>
                <button 
                  onClick={() => setContextMenuSession(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {/* 1. Pin / Unpin Button */}
                <button
                  onClick={() => handleTogglePinChat(contextMenuSession)}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all text-left cursor-pointer group ${
                    contextMenuSession.isPinned
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/80'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    contextMenuSession.isPinned 
                      ? 'bg-slate-200 text-slate-700' 
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {contextMenuSession.isPinned ? <PinOff size={18} /> : <Pin size={18} className="rotate-45" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 flex items-center justify-between">
                      <span>{contextMenuSession.isPinned ? t.unpinChat : t.pinChat}</span>
                      <span className="text-[10px] uppercase font-bold text-amber-700 font-mono tracking-wider">
                        {contextMenuSession.isPinned ? 'Unpin' : 'Pin Top'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contextMenuSession.isPinned 
                        ? (lang === 'id' ? 'Kembalikan ke urutan normal' : 'Return to standard order')
                        : (lang === 'id' ? 'Pindahkan ke paling atas & kunci posisi' : 'Move to very top & keep position')}
                    </p>
                  </div>
                </button>

                {/* 2. Delete Chat Button */}
                <button
                  onClick={() => handleDeleteChatSession(contextMenuSession)}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 transition-all text-left cursor-pointer group"
                >
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Trash2 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-rose-700 flex items-center justify-between">
                      <span>{t.deleteChat}</span>
                      <span className="text-[10px] uppercase font-bold text-rose-600 font-mono">Delete</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'id' ? 'Hapus riwayat obrolan ini secara permanen' : 'Permanently remove this conversation'}
                    </p>
                  </div>
                </button>
              </div>

              {/* Cancel Button */}
              <div className="pt-1">
                <button
                  onClick={() => setContextMenuSession(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Toast Feedback */}
      <AnimatePresence>
        {showActionToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-neutral-700 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md text-sm font-medium"
          >
            <Check size={16} className="text-emerald-400 flex-shrink-0" />
            <span>{showActionToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        customInstruction={customInstruction} 
        setCustomInstruction={handleCustomInstructionChange} 
        chatSessions={chatSessions} 
        hourlyUsage={usage.hourly}
        weeklyUsage={usage.weekly}
        resetUsage={handleResetLimits}
        user={user}
        userTier={userTier}
        onClearAllMedia={() => {
          setChatSessions(prev => prev.map(s => ({
            ...s,
            messages: s.messages.map(m => ({
              ...m,
              media: Array.isArray(m.media) 
                ? m.media.map(item => ({ ...item, url: '' })) 
                : (m.media ? { ...m.media, url: '' } : undefined)
            }))
          })));
          setMessages(prev => prev.map(m => ({
            ...m,
            media: Array.isArray(m.media) 
              ? m.media.map(item => ({ ...item, url: '' })) 
              : (m.media ? { ...m.media, url: '' } : undefined)
          })));
        }}
        onClearAllSessions={() => {
          setChatSessions([]);
          setMessages([]);
          setCurrentSessionId(null);
        }}
        onDeleteAccount={() => {
          setUser(null);
          setChatSessions([]);
          setMessages([]);
          setCurrentSessionId(null);
        }}
        onOpenSession={(sessionId) => {
          loadSession(sessionId);
        }}
        onAddSession={(newSession) => {
          const formattedSession: ChatSession = {
            id: newSession.id,
            title: newSession.title,
            messages: [],
            updatedAt: Date.now(),
            model: selectedModel,
          };
          setChatSessions(prev => {
            if (prev.some(s => s.id === newSession.id)) return prev;
            return [formattedSession, ...prev];
          });
        }}
        onDevModeChange={(active) => setIsDevMode(active)}
        appStyle={appStyle}
      />

      <ConnectorsModal
        isOpen={isConnectorsModalOpen}
        onClose={() => setIsConnectorsModalOpen(false)}
        connectors={connectors}
        onToggleConnector={toggleConnector}
        onAddConnector={(id, apiKey) => {
          setConnectors(prev => prev.map(c => c.id === id ? { ...c, isConfigured: true, isActive: true, apiKey } : c));
        }}
        onOpenIntegrations={() => {
          setAppState('integrations');
          setIsConnectorsModalOpen(false);
        }}
        user={user}
      />

      <MediaScreenViewer 
        media={fullscreenMedia} 
        onClose={handleCloseMediaScreen} 
      />

      <QuotaExceededModal
        isOpen={quotaModalInfo.isOpen}
        onClose={() => setQuotaModalInfo(prev => ({ ...prev, isOpen: false }))}
        onReset={handleResetLimits}
        title={quotaModalInfo.title}
        message={quotaModalInfo.message}
        used5h={quotaModalInfo.used5h}
        usedWeekly={quotaModalInfo.usedWeekly}
      />

      <FileHistoryModal
        isOpen={isFileHistoryOpen}
        onClose={() => setIsFileHistoryOpen(false)}
      />

      <ShareChatModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        session={chatSessions.find(s => s.id === currentSessionId) || {
          id: currentSessionId || `session_${Date.now()}`,
          title: messages.find(m => m.role === 'user')?.text.slice(0, 45) || (lang === 'id' ? 'Obrolan Bluefox' : 'Bluefox Chat'),
          model: selectedModel,
          updatedAt: Date.now(),
          messages: messages,
        }}
        lang={lang}
      />

      <MotionManualModal
        isOpen={isMotionManualModalOpen}
        onClose={() => setIsMotionManualModalOpen(false)}
        onSubmitManualCode={handleManualMotionSubmit}
      />
    </div>
      )}
    </>
  );
}
