import { useState, useRef, useEffect } from 'react';
import { Message, Connector, MediaAttachment, ChatSession, SearchSource } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { VerifyPage } from './components/VerifyPage';
import { Bot, Sparkles, ChevronDown, Cpu, Layers, Menu, Store, Globe, Settings, LogOut, Brain, Zap, Download, Search, ArrowDown, Loader2, Eye, EyeOff, Lock, Check, Pin, PinOff, Trash2, MoreVertical, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { SettingsModal } from './components/SettingsModal';
import { ConnectorsModal } from './components/ConnectorsModal';
import { IntegrationsPage } from './components/IntegrationsPage';
import { MediaScreenViewer } from './components/MediaScreenViewer';
import { useLanguage } from './lib/i18n';
import { 
  supabase, 
  exchangeSsoTicket, 
  listenToRealtimeMessages, 
  sendMessageToSupabase, 
  loadChatHistory,
  getValidUUID,
  hasValidConfig,
  invokeBluefoxProcessor,
  consumeAiLimit,
  consumeSearchLimit,
  getUserLimits,
  resetUserLimits,
  getModelLimitCode
} from './lib/supabase';
import { getActiveCustomApi, recordCustomApiRequest } from './lib/customApi';
import { initTheme, parseThemeCommand } from './lib/theme';
import { getActiveMemories, saveActiveMemory, clearActiveMemories } from './lib/commands';
import { executeDualEngineSearch, detectSearchIntent, SearchModeType } from './lib/search';

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

  const ssoUrl = new URL(ACCOUNT_SSO_URL);
  ssoUrl.searchParams.set('client_id', CLIENT_ID);
  ssoUrl.searchParams.set('redirect_uri', REDIRECT_URI);

  console.log("🔄 [SSO Redirect] Mengarahkan ke:", ssoUrl.toString());
  window.location.href = ssoUrl.toString();
}

export type SupportedModel = 'agnes-2.0-flash' | 'laguna-s-2.1' | 'tencent-hy3-free';

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
      try {
        const saved = localStorage.getItem('tmpa_chat_sessions');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) return parsed[0].id;
        }
      } catch {}
    }
    return null;
  });

  // Tentukan pesan awal seketika sesuai session yang aktif
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const lastId = localStorage.getItem('tmpa_last_active_session_id');
        const saved = localStorage.getItem('tmpa_chat_sessions');
        if (saved) {
          const sessions: ChatSession[] = JSON.parse(saved);
          const active = sessions.find(s => s.id === lastId) || sessions[0];
          if (active && active.messages) return active.messages;
        }
      } catch {}
    }
    return [];
  });

  // State untuk Media Screen Viewer Fullscreen (/screen-:id)
  const [fullscreenMedia, setFullscreenMedia] = useState<MediaAttachment | null>(null);

  const [selectedModel, setSelectedModel] = useState<SupportedModel>('agnes-2.0-flash');
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
    setSelectedModel('agnes-2.0-flash');
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
    if (isVisionActive && modelId !== 'agnes-2.0-flash') {
      setVisionLockedNotice("Mode Vision sedang aktif: Model dikunci ke Agnes AI (agnes-2.0-flash). Nonaktifkan Vision di menu Vision jika ingin memilih model lain.");
      setTimeout(() => setVisionLockedNotice(null), 4000);
      return;
    }
    setSelectedModel(modelId);
    setIsModelSelectorOpen(false);
  };

  const [dbLimits, setDbLimits] = useState<{ used5h: number; usedWeekly: number } | null>(null);

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

    const now = Date.now();
    const fiveHoursAgo = now - 5 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    let hourly = 0;
    let weekly = 0;
    
    for (const ev of usageEvents) {
      if (ev.ts > fiveHoursAgo) hourly += ev.h;
      if (ev.ts > oneWeekAgo) weekly += ev.w;
    }
    
    return { 
      hourly: Math.min(100, hourly), 
      weekly: Math.min(100, weekly) 
    };
  };

  const usage = getUsage();
  const isUsageLimitReached = usage.hourly >= 100 || usage.weekly >= 100;

  const updateUsage = (
    model: string, 
    isVision?: boolean, 
    searchMode?: 'standard' | 'advanced' | 'map_standard' | 'map_advanced'
  ) => {
    let h = 0, w = 0;
    if (model === 'agnes-2.0-flash' || model === 'qwen3_coder') {
      if (isVision) {
        h = 19; // Vision: 19% per 5 jam
        w = 14; // Vision: 14% weekly
      } else {
        h = 13; // Non vision: 13% per 5 jam
        w = 10; // Non vision: 10% weekly
      }
    } else if (model === 'tencent-hy3-free' || model === 'gpt_oss') {
      // bluefox standard
      h = 12; // 12% per 5 jam
      w = 9;  // 9% weekly
    } else if (model === 'laguna-s-2.1' || model === 'mistral_nemotron') {
      // bluefox Dilo
      h = 8;  // 8% per 5 jam
      w = 6;  // 6% weekly
    } else {
      h = 12;
      w = 9;
    }

    if (searchMode) {
      if (searchMode === 'advanced') {
        h += 10;
        w += 5;
      } else if (searchMode === 'standard') {
        h += 5;
        w += 3;
      } else if (searchMode === 'map_advanced') {
        h += 13;
        w += 7;
      } else if (searchMode === 'map_standard') {
        h += 7;
        w += 4;
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
  const [reasoningMode, setReasoningMode] = useState<'standar' | 'penalaran'>('standar');

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
  const [isReasoningSelectorOpen, setIsReasoningSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const hasExistingSession = localStorage.getItem('tmpa_chat_sessions') || localStorage.getItem('tmpa_last_active_session_id') || localStorage.getItem('tmpa_user_profile');
      const isSpecialRoute = window.location.pathname.startsWith('/screen-') || window.location.pathname.startsWith('/verify') || window.location.pathname.startsWith('/integrations');
      if (hasExistingSession || isSpecialRoute) return false;
    }
    return true;
  });

  const [appState, setAppState] = useState<'landing' | 'login' | 'chat' | 'verify' | 'integrations'>(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/verify')) return 'verify';
      if (currentPath.startsWith('/settings/integrations') || currentPath.startsWith('/integrations')) return 'integrations';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typewriterIntervalRef = useRef<any>(null);
  const isExchangingRef = useRef(false);

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

    // Navigasi internal untuk preview / local env
    try {
      window.history.pushState(null, '', '/verify');
    } catch {}
    setAppState('verify');
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
          setSyncStatus('🔄 Memverifikasi Sesi... Mohon tunggu sebentar, sedang menyambungkan akun Anda.');
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
                alert(`[Auth Error] Gagal memverifikasi sesi: ${verifyError.message}`);
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
                alert(`[Auth Error] Gagal memasang sesi: ${sessionErr.message}`);
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

              // Upsert user
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
            alert(`[Bluefox Login Gagal] ${ticketErr.message || 'Tiket SSO tidak valid'}`);
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
    }
  }, [user]);

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

    // Ambil Riwayat Chat saat pertama kali membuka room
    loadChatHistory(convId).then((data) => {
      if (data && data.length > 0) {
        const historyMsgs: Message[] = data.map((item: any) => ({
          id: item.id?.toString() || Date.now().toString() + Math.random(),
          role: (item.role === 'assistant' || item.role === 'model') ? 'model' : 'user',
          text: item.content || item.text || '',
        }));
        
        setMessages((prev) => {
          if (prev.length === 0) return historyMsgs;
          return mergeWithoutDuplicates(prev, historyMsgs);
        });
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

    return () => {
      unsubscribe();
    };
  }, [appState, currentSessionId]);

  const sortSessions = (sessions: ChatSession[]) => {
    return [...sessions].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  };

  const saveSessionsToLocal = (sessions: ChatSession[]) => {
    const sorted = sortSessions(sessions);
    setChatSessions(sorted);
    localStorage.setItem('tmpa_chat_sessions', JSON.stringify(sorted));
  };

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

  const handleDeleteChatSession = (session: ChatSession) => {
    const updatedSessions = chatSessions.filter(s => s.id !== session.id);
    saveSessionsToLocal(updatedSessions);
    if (currentSessionId === session.id) {
      setMessages([]);
      setCurrentSessionId(null);
      try {
        localStorage.removeItem('tmpa_last_active_session_id');
      } catch {}
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

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    try {
      localStorage.removeItem('tmpa_last_active_session_id');
    } catch {}
    setIsSidebarOpen(false);
  };

  const loadSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages);
      setSelectedModel(session.model as any);
      setCurrentSessionId(session.id);
      try {
        localStorage.setItem('tmpa_last_active_session_id', session.id);
      } catch {}
    }
    setIsSidebarOpen(false);
  };

  // Handler untuk membuka halaman media fullscreen (/screen-:id)
  const handleOpenMediaScreen = (mediaItem: MediaAttachment) => {
    const mediaId = mediaItem.id || 'media-' + Math.random().toString(36).substring(2, 9);
    const resolvedMedia: MediaAttachment = { ...mediaItem, id: mediaId };
    try {
      localStorage.setItem(`tmpa_media_${mediaId}`, JSON.stringify(resolvedMedia));
    } catch {}
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

  const handleEditMessage = (id: string, newText: string) => {
    const editIndex = messages.findIndex(m => m.id === id);
    if (editIndex === -1) return;

    const baseHistory = messages.slice(0, editIndex);
    handleSendMessage(newText, baseHistory);
  };

  const stopGeneration = () => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (
    text: string, 
    overrideMessages?: Message[], 
    imageUrl?: string | null, 
    media?: MediaAttachment | MediaAttachment[]
  ) => {
    const userText = text.trim();
    const hasMedia = Boolean(media && (Array.isArray(media) ? media.length > 0 : true));
    if ((!userText && !imageUrl && !hasMedia) || isLoading) return;

    // =========================================================================
    // 0. CEK INTERCEPT SYSTEM CONTROLLER (@bluefox, @theme, @memory standalone)
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
          systemReply = lang === 'en' ? `### User Profile (Bluefox System Controller)

| Account Data | Information Detail |
| :--- | :--- |
| **User ID** | \`${user?.id || 'guest-user'}\` |
| **Active Email** | \`${user?.email || 'user@example.com'}\` |
| **Tier / Plan** | \`${userTier || 'Tier 1 Pro'}\` |
| **Active Session ID** | \`${currentSessionId || 'New Session'}\` |
| **Authentication Status** | \`[VERIFIED & ACTIVE]\` |
| **System Time** | \`${new Date().toLocaleString('en-US')}\` |`
          : `### Profil Pengguna (Bluefox System Controller)

| Data Akun | Detail Informasi |
| :--- | :--- |
| **User ID** | \`${user?.id || 'guest-user'}\` |
| **Email Aktif** | \`${user?.email || 'user@example.com'}\` |
| **Paket / Tier** | \`${userTier || 'Tier 1 Pro'}\` |
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
          const activeCustomApi = getActiveCustomApi();
          systemReply = lang === 'en' ? `### Quota & Usage Monitor (Bluefox Controller)

| Quota Parameter | Usage Status | Description |
| :--- | :--- | :--- |
| **Rolling Limit (5 Hours)** | \`${dbLimits?.used5h ?? 0}% used\` | Remaining: \`${Math.max(0, 100 - (dbLimits?.used5h ?? 0))}%\` |
| **Weekly Limit** | \`${dbLimits?.usedWeekly ?? 0}% used\` | Remaining: \`${Math.max(0, 100 - (dbLimits?.usedWeekly ?? 0))}%\` |
| **Custom API Limit** | \`${activeCustomApi ? activeCustomApi.name : 'No active custom API'}\` | 10 req/min • 50 req/day |
| **System Status** | \`[NORMAL OPERATIONAL]\` | Auto quota reset window every 5 hours |

_Developer Tip: Type \`@bluefox reset\` to reset all AI model usage limits to 0%._`
          : `### Indikator Batas Penggunaan (Quota Monitor)

| Parameter Kuota | Status Penggunaan | Keterangan |
| :--- | :--- | :--- |
| **Rolling Limit (5 Jam)** | \`${dbLimits?.used5h ?? 0}% terpakai\` | Sisa: \`${Math.max(0, 100 - (dbLimits?.used5h ?? 0))}%\` |
| **Batas Mingguan (Weekly)** | \`${dbLimits?.usedWeekly ?? 0}% terpakai\` | Sisa: \`${Math.max(0, 100 - (dbLimits?.usedWeekly ?? 0))}%\` |
| **Custom API Limit** | \`${activeCustomApi ? activeCustomApi.name : 'Tidak ada Custom API aktif'}\` | 10 req/menit • 50 req/hari |
| **Status Sistem** | \`[OPERASIONAL NORMAL]\` | Reset kuota otomatis tiap 5 jam |

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

    // 1. Ambil UUID user yang sedang login secara dinamis
    let activeUserId = user?.id;
    if (!activeUserId) {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        alert("Silakan login terlebih dahulu!");
        return;
      }
      activeUserId = authData.user.id;
    }

    // 2. Cek limit Custom API jika ada Custom API yang aktif (10 req/menit & 50 req/hari)
    const activeCustomApi = getActiveCustomApi();
    if (activeCustomApi) {
      const customLimitCheck = recordCustomApiRequest();
      if (!customLimitCheck.success) {
        alert(customLimitCheck.error || "(custom API limit) Batas penggunaan tercapai!");
        return;
      }
    }

    // 3. Tentukan model code ('v2_vision' | 'v2_non_vision' | 'v1' | 'dilo')
    const isVisionNow = Boolean(isVisionActive || hasMedia);
    const currentEffectiveModel = isVisionNow ? 'agnes-2.0-flash' : selectedModel;
    const modelCode = getModelLimitCode(selectedModel, isVisionNow);

    // 4. Potong limit di Supabase via consume_ai_limit SEBELUM request AI diproses
    const limitRes = await consumeAiLimit(activeUserId, modelCode);
    if (!limitRes.success) {
      alert(limitRes.message || "Gagal memproses limit!");
      return; // Hentikan kirim pesan ke AI jika limit habis
    }

    if (limitRes.used_5h !== undefined) {
      setDbLimits({
        used5h: limitRes.used_5h,
        usedWeekly: limitRes.used_weekly,
      });
    }

    console.log("Sisa limit 5h:", limitRes.remaining_5h);
    console.log("Sisa limit weekly:", limitRes.remaining_weekly);

    // 4. Update usage local state & Tampilkan pesan User di UI (Optimistic UI)
    updateUsage(currentEffectiveModel, isVisionNow);
    setIsLoading(true);
    setErrorState(null);

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

    let sessionId = getValidUUID(currentSessionId);
    let currentSessions = [...chatSessions];

    const sessionIdx = currentSessions.findIndex(s => s.id === sessionId);
    if (sessionIdx === -1) {
      const newSession = {
        id: sessionId,
        title: userText.length > 30 ? userText.substring(0, 30) + '...' : (userText || 'Lampiran Media'),
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

    try {
      abortControllerRef.current = new AbortController();
      let aiReplyText = '';
      let effectiveConvId = currentSessionId || sessionId;

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

          // Potong kuota limit pencarian
          const mode: SearchModeType = searchPayload.searchMode || 'standard';
          if (activeUserId) {
            consumeSearchLimit(activeUserId, mode).catch(() => {});
          }
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
      const aiMessageId = (Date.now() + 1).toString();
      const initialAiMessage: Message = {
        id: aiMessageId,
        role: 'model',
        text: '',
        has_sources: attachedSources.length > 0,
        search_engine_used: attachedEngine,
        sources: attachedSources.length > 0 ? attachedSources : undefined,
      };
      setMessages([...updatedMessages, initialAiMessage]);

      const mediaUrls = Array.isArray(media)
        ? media.map(m => m.url)
        : (media ? [media.url] : (imageUrl ? [imageUrl] : []));

      // 1. Panggil Edge Function Bluefox Processor utama (https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-)
      const edgeRes = await invokeBluefoxProcessor(
        effectiveAiPrompt,
        currentSessionId || null,
        currentEffectiveModel,
        isVisionNow,
        mediaUrls.length > 0 ? mediaUrls : null,
        abortControllerRef.current.signal
      );

      if (abortControllerRef.current?.signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (edgeRes.data && edgeRes.data.success !== false && (edgeRes.data.reply || edgeRes.data.text || edgeRes.data.response)) {
        const fullReply = edgeRes.data.reply || edgeRes.data.text || edgeRes.data.response || '';
        if (edgeRes.data.conversation_id) {
          effectiveConvId = edgeRes.data.conversation_id;
          setCurrentSessionId(effectiveConvId);
        }

        // If edge response already returns sources, use them
        if (edgeRes.data.sources && Array.isArray(edgeRes.data.sources)) {
          attachedSources = edgeRes.data.sources;
          attachedEngine = edgeRes.data.search_engine_used || attachedEngine || 'tavily';
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

      } else {
        // Fallback jika Edge Function mengalami kendala: coba server fallback /api/chat
        console.warn("⚠️ Edge Function tidak memberikan balasan sukses, mencoba fallback internal /api/chat...", edgeRes.error);
        const history = baseMessages.map(m => ({
          role: m.role,
          text: m.text
        }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            history, 
            message: effectiveAiPrompt, 
            model: currentEffectiveModel, 
            customInstruction, 
            reasoningMode 
          }),
          signal: abortControllerRef.current.signal
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = edgeRes.error || errData?.error || "Gagal menghubungi layanan AI server.";
          throw new Error(errMsg);
        }

        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);

                if (parsed.type === 'search_sources' || (parsed.sources && parsed.sources.length > 0)) {
                  attachedSources = parsed.sources;
                  attachedEngine = parsed.search_engine_used || attachedEngine || 'tavily';
                  setMessages(prev => {
                    const next = [...prev];
                    const targetIdx = next.findIndex(m => m.id === aiMessageId);
                    if (targetIdx !== -1) {
                      next[targetIdx] = { 
                        ...next[targetIdx], 
                        has_sources: true, 
                        search_engine_used: attachedEngine, 
                        sources: attachedSources 
                      };
                    }
                    return next;
                  });
                }

                if (parsed.delta) {
                  aiReplyText += parsed.delta;
                  setMessages(prev => {
                    const next = [...prev];
                    const targetIdx = next.findIndex(m => m.id === aiMessageId);
                    if (targetIdx !== -1) {
                      next[targetIdx] = { 
                        ...next[targetIdx], 
                        text: aiReplyText,
                        has_sources: attachedSources.length > 0,
                        search_engine_used: attachedEngine,
                        sources: attachedSources.length > 0 ? attachedSources : undefined
                      };
                    }
                    return next;
                  });
                } else if (parsed.done && parsed.fullText) {
                  aiReplyText = parsed.fullText;
                  if (parsed.sources && parsed.sources.length > 0) {
                    attachedSources = parsed.sources;
                    attachedEngine = parsed.search_engine_used || attachedEngine;
                  }
                  setMessages(prev => {
                    const next = [...prev];
                    const targetIdx = next.findIndex(m => m.id === aiMessageId);
                    if (targetIdx !== -1) {
                      next[targetIdx] = { 
                        ...next[targetIdx], 
                        text: aiReplyText,
                        has_sources: attachedSources.length > 0,
                        search_engine_used: attachedEngine,
                        sources: attachedSources.length > 0 ? attachedSources : undefined
                      };
                    }
                    return next;
                  });
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch {}
            }
          }
        }
      }

      if (!aiReplyText.trim()) {
        aiReplyText = "⚠️ Respons AI tidak menghasilkan teks.";
        setMessages(prev => {
          const next = [...prev];
          const targetIdx = next.findIndex(m => m.id === aiMessageId);
          if (targetIdx !== -1) {
            next[targetIdx] = { 
              ...next[targetIdx], 
              text: aiReplyText,
              has_sources: attachedSources.length > 0,
              search_engine_used: attachedEngine,
              sources: attachedSources.length > 0 ? attachedSources : undefined
            };
          }
          return next;
        });
      }

      sendMessageToSupabase(userText, effectiveConvId, 'user').catch(() => {});
      sendMessageToSupabase(aiReplyText, effectiveConvId, 'assistant').catch(() => {});

      const finalMessages = [...updatedMessages, {
        id: aiMessageId,
        role: 'model' as const,
        text: aiReplyText,
        has_sources: attachedSources.length > 0,
        search_engine_used: attachedEngine,
        sources: attachedSources.length > 0 ? attachedSources : undefined,
      }];

      const updateIdx = currentSessions.findIndex(s => s.id === sessionId || s.id === effectiveConvId);
      if (updateIdx !== -1) {
        currentSessions[updateIdx] = {
          ...currentSessions[updateIdx],
          id: effectiveConvId,
          messages: finalMessages,
          updatedAt: Date.now()
        };
        saveSessionsToLocal([...currentSessions]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request stopped by user');
        return;
      }
      console.error("Catch Block Frontend Error:", err);
      const errMsg = err?.message || "Terjadi kesalahan saat memuat balasan.";
      setErrorState(errMsg);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ ${errMsg}`,
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.text.trim() !== '');
        return [...filtered, errorMessage];
      });
    } finally {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      setIsLoading(false);
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
        <IntegrationsPage onBack={() => setAppState(user ? 'chat' : 'landing')} />
      )}

      {!showSplash && !authChecking && !authError && appState === 'landing' && (
        <LandingPage onStart={handleLandingStart} />
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'login' && (
        <LoginPage onLoginSuccess={() => setAppState('chat')} onBack={() => setAppState('landing')} />
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'chat' && (
        <div className="flex flex-col h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600/20 overflow-hidden relative app-clean-grid">
        {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 md:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Model Selector Trigger */}
          <div className="flex items-center gap-2">
            <div 
              onClick={() => setIsModelSelectorOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 active:scale-95 shadow-xs"
            >
              <span>Model: <strong className="text-blue-600 dark:text-blue-400">
                {selectedModel === 'agnes-2.0-flash' ? 'bluefox pro' : selectedModel === 'tencent-hy3-free' ? 'bluefox standard' : 'bluefox Dilo'}
              </strong></span>
              {isVisionActive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                  <Eye size={10} /> Vision
                </span>
              )}
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
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
                onStop={isLoading ? stopGeneration : undefined} 
                onOpenMediaScreen={handleOpenMediaScreen}
              />
            ))}
            {isLoading && (
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

      {/* Input Form */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 pt-2 shrink-0 relative z-20">
        <ChatInput 
          onSend={(text, media) => handleSendMessage(text, undefined, undefined, media)} 
          isLoading={isLoading} 
          onStop={stopGeneration} 
          connectors={connectors}
          onToggleConnector={toggleConnector}
          onShowAllConnectors={() => setIsConnectorsModalOpen(true)}
          onAutoEnableVision={handleEnableVision}
          onDisableVision={handleDisableVision}
          isVisionActive={isVisionActive}
          disabled={isUsageLimitReached}
        />
      </footer>

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
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white border-r border-slate-200 z-50 flex flex-col text-slate-900 shadow-2xl"
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
                  <button 
                    onClick={() => { window.location.href = "https://tmpa.my.id"; }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <Globe size={18} className="text-blue-600" />
                    <span>{t.mainWebsite}</span>
                  </button>

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

                  <button 
                    onClick={() => { setAppState('integrations'); setIsSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <Layers size={18} className="text-emerald-600" />
                    <span>{t.mcpIntegrations}</span>
                  </button>

                  <button 
                    onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }} 
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    <Settings size={18} className="text-purple-600" />
                    <span>{t.settings}</span>
                  </button>
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
              <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col gap-3">
                <div className="flex items-center gap-3 px-2">
                  <img src="https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/Video%20atau%20asset/T_20260809_163901_0000.png" alt="Bluefox AI Logo" className="w-10 h-10 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0 shadow-xs" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'TMPA User'}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 truncate">
                      Plan: {userTier}
                    </span>
                    <span className="text-xs text-slate-500 truncate">
                      {user?.email || 'user@tmpa.example'}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center w-full gap-2 px-4 py-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors text-sm font-semibold cursor-pointer border border-transparent hover:border-rose-200"
                >
                  <LogOut size={16} />
                  <span>{t.logout}</span>
                </button>
              </div>
            </motion.div>
          </>
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
                        setIsReasoningSelectorOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Brain size={14} />
                      Penalaran
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
                  {/* Tmpa ai v2 (agnes-2.0-flash) Choice */}
                  <button 
                    onClick={() => handleSelectModel('agnes-2.0-flash')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      selectedModel === 'agnes-2.0-flash' 
                        ? 'bg-blue-50/70 border-2 border-blue-600 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'agnes-2.0-flash' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Bot size={18} />
                      </div>
                      {isVisionActive && (
                        <span className="text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Eye size={10} /> Vision Aktif
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug">bluefox pro</h4>
                    <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase mt-1">power by agnes-2.0-flash</span>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Model AI cerdas multimodal berkecepatan tinggi dengan kapabilitas analisis visual komprehensif, coding, dan penalaran mutakhir.
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
                      {isVisionActive && (
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Lock size={11} /> Terkunci
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug">bluefox standard</h4>
                    <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase mt-1">power by tencent-hy3-free</span>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Model open-source modular generasi baru yang sangat optimal, super cepat, efisien, dan andal untuk percakapan sehari-hari.
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
                      {isVisionActive && (
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Lock size={11} /> Terkunci
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug">bluefox Dilo</h4>
                    <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase mt-1">power by laguna-s-2.1</span>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Teman ngobrol serba guna Platform TMPA. Sangat ramah, empati, santai, dan enak diajak bicara untuk menemani keseharian Anda.
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
                            Aktifkan Vision (Agnes AI)
                            {isVisionActive && (
                              <span className="text-[11px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-300 px-2 py-0.5 rounded-full">
                                Sedang Digunakan
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-cyan-600 font-mono font-medium">model: agnes-2.0-flash</span>
                        </div>
                      </div>
                      {isVisionActive && (
                        <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pl-12">
                      Mengaktifkan kemampuan analisis visual. Sistem akan otomatis memanggil dan mengunci model ke <strong className="text-cyan-700">Agnes AI (agnes-2.0-flash)</strong> sehingga model tidak dapat diubah selama mode Vision menyala.
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
        {isReasoningSelectorOpen && (
          <div className="fixed inset-0 z-30 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs" 
              onClick={() => setIsReasoningSelectorOpen(false)}
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[75vh] md:max-h-[55vh] bg-white border-t border-slate-200 shadow-2xl z-40 overflow-y-auto rounded-t-3xl text-slate-900"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Pilih Mode Penalaran</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Atur seberapa pintar AI dalam berpikir sebelum merespons</p>
                  </div>
                  <button 
                    onClick={() => setIsReasoningSelectorOpen(false)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
                
                <div className="flex flex-col gap-3 md:gap-4">
                  <button 
                    onClick={() => {
                      setReasoningMode('standar');
                      setIsReasoningSelectorOpen(false);
                    }}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer ${
                      reasoningMode === 'standar' 
                        ? 'bg-blue-50 border-2 border-blue-600 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reasoningMode === 'standar' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                         <Zap size={16} />
                       </div>
                       <h4 className="font-bold text-slate-900 text-sm md:text-base">Standar</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-11">
                      Merespons dengan cepat dan langsung berdasarkan pengetahuan bawaan.
                    </p>
                  </button>

                  <button 
                    onClick={() => {
                      setReasoningMode('penalaran');
                      setIsReasoningSelectorOpen(false);
                    }}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer ${
                      reasoningMode === 'penalaran' 
                        ? 'bg-blue-50 border-2 border-blue-600 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reasoningMode === 'penalaran' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                         <Brain size={16} />
                       </div>
                       <h4 className="font-bold text-slate-900 text-sm md:text-base">Penalaran</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-11">
                      AI wajib memahami konteks, berpikir keras, dan mencari solusi terlebih dahulu sebelum memberikan jawaban terbaik.
                    </p>
                  </button>
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
      />

      <MediaScreenViewer 
        media={fullscreenMedia} 
        onClose={handleCloseMediaScreen} 
      />
    </div>
      )}
    </>
  );
}
