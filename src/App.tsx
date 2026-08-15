import { useState, useRef, useEffect } from 'react';
import { Message, Connector } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { Bot, Sparkles, ChevronDown, Cpu, Layers, Menu, Store, Globe, Settings, LogOut, Brain, Zap, Download, Search, ArrowDown, Loader2, Eye, EyeOff, Lock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { SettingsModal } from './components/SettingsModal';
import { ConnectorsModal } from './components/ConnectorsModal';
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
  getUserLimits,
  getModelLimitCode
} from './lib/supabase';

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
  const ACCOUNT_SSO_URL = 'https://account.tmpa.my.id/account';
  const CLIENT_ID = 'bluefox-chat';
  
  let REDIRECT_URI = 'https://bluefox.tmpa.my.id';
  if (window.location.hostname === 'chat.tmpa.my.id') {
    REDIRECT_URI = 'https://chat.tmpa.my.id';
  } else if (window.location.hostname !== 'bluefox.tmpa.my.id') {
    REDIRECT_URI = window.location.origin;
  }

  const ssoUrl = new URL(ACCOUNT_SSO_URL);
  ssoUrl.searchParams.set('client_id', CLIENT_ID);
  ssoUrl.searchParams.set('redirect_uri', REDIRECT_URI);

  window.location.href = ssoUrl.toString();
}

export type SupportedModel = 'agnes-2.0-flash' | 'laguna-s-2.1' | 'tencent-hy3-free';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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

  const updateUsage = (model: string, isVision?: boolean) => {
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
      // Tmpa ai v1
      h = 12; // 12% per 5 jam
      w = 9;  // 9% weekly
    } else if (model === 'laguna-s-2.1' || model === 'mistral_nemotron') {
      // Dilo
      h = 8;  // 8% per 5 jam
      w = 6;  // 6% weekly
    } else {
      h = 12;
      w = 9;
    }
    
    const newEvent = { h, w, ts: Date.now() };
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const nextEvents = [...usageEvents.filter(e => e.ts > oneWeekAgo), newEvent];
    
    setUsageEvents(nextEvents);
    localStorage.setItem('ai_usage_events', JSON.stringify(nextEvents));
  };


  const [errorState, setErrorState] = useState<string | null>(null);
  const [reasoningMode, setReasoningMode] = useState<'standar' | 'penalaran'>('standar');
  const [isReasoningSelectorOpen, setIsReasoningSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [appState, setAppState] = useState<'landing' | 'login' | 'chat'>('landing');
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

    redirectToSSO();
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

        // 5. TIDAK ADA SESI: TAMPILKAN LANDING PAGE (JANGAN LANGSUNG REDIRECT)
        console.log("Tidak ada sesi terdeteksi. Menampilkan Landing Page.");
        setAppState('landing');
      } catch (err: any) {
        console.error("Gagal verifikasi sesi utama:", err);
        setAppState('landing');
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

  // Realtime & Load Chat History integration with Supabase
  useEffect(() => {
    if (appState !== 'chat' || !currentSessionId) return;

    const convId = currentSessionId;

    // Ambil Riwayat Chat saat pertama kali membuka room
    loadChatHistory(convId).then((data) => {
      if (data && data.length > 0) {
        const historyMsgs: Message[] = data.map((item: any) => ({
          id: item.id?.toString() || Date.now().toString() + Math.random(),
          role: (item.role === 'assistant' || item.role === 'model') ? 'model' : 'user',
          text: item.content || item.text || '',
        }));
        setMessages(historyMsgs);
      }
    }).catch((e) => {
      console.warn("Gagal memuat histori dari Supabase:", e);
    });

    // Mendengarkan Pesan Masuk secara REALTIME
    const unsubscribe = listenToRealtimeMessages(convId, (newMessage) => {
      console.log("[Realtime] Pesan baru diterima dari Supabase:", newMessage);
      const uiMsg: Message = {
        id: newMessage.id?.toString() || Date.now().toString(),
        role: (newMessage.role === 'assistant' || newMessage.role === 'model') ? 'model' : 'user',
        text: newMessage.content || newMessage.text || '',
      };

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === uiMsg.id || (m.text === uiMsg.text && m.role === uiMsg.role));
        if (exists) return prev;
        return [...prev, uiMsg];
      });

      if (newMessage.role === 'assistant' || newMessage.role === 'model') {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [appState, currentSessionId]);

  const saveSessionsToLocal = (sessions: any[]) => {
    setChatSessions(sessions);
    localStorage.setItem('tmpa_chat_sessions', JSON.stringify(sessions));
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
  };

  const loadSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages);
      setSelectedModel(session.model as any);
      setCurrentSessionId(session.id);
    }
    setIsSidebarOpen(false);
  };

  const handleEditMessage = (id: string, newText: string) => {
    const editIndex = messages.findIndex(m => m.id === id);
    if (editIndex === -1) return;

    const baseHistory = messages.slice(0, editIndex);
    handleSendMessage(newText, baseHistory);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (text: string, overrideMessages?: Message[], imageUrl?: string | null) => {
    const userText = text.trim();
    if ((!userText && !imageUrl) || isLoading) return;

    if (isUsageLimitReached) {
      alert("Telah mencapai batas penggunaan (100%). Menunggu reset.");
      return;
    }

    // 1. Set State Loading & Tampilkan pesan User di UI lebih dulu (Optimistic UI)
    setIsLoading(true);
    setErrorState(null);

    const baseMessages = overrideMessages ?? messages;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
    };
    
    // Determinasi model: Jika Vision Aktif -> Kunci paksa ke 'agnes-2.0-flash' (tmpa_v2)
    const currentEffectiveModel = isVisionActive ? 'agnes-2.0-flash' : selectedModel;
    updateUsage(currentEffectiveModel, isVisionActive);

    const updatedMessages = [...baseMessages, userMessage];
    setMessages(updatedMessages);

    let sessionId = getValidUUID(currentSessionId);
    let currentSessions = [...chatSessions];

    const sessionIdx = currentSessions.findIndex(s => s.id === sessionId);
    if (sessionIdx === -1) {
      const newSession = {
        id: sessionId,
        title: userText.length > 30 ? userText.substring(0, 30) + '...' : userText,
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

      // 2. Panggil Edge Function dan WAJIB ditunggu (await)
      const edgeRes = await invokeBluefoxProcessor(
        userText,
        currentSessionId || null,
        currentEffectiveModel,
        isVisionActive,
        imageUrl || null
      );

      // 3. Cek Error dari SDK Supabase (Masalah Jaringan / Timeout)
      if (edgeRes.error && !edgeRes.data) {
        console.error("SDK Error:", edgeRes.error);
        throw new Error(typeof edgeRes.error === 'string' ? edgeRes.error : "Gagal terhubung ke server. Periksa koneksi internetmu.");
      }

      // 4. Cek Error kustom dari Edge Function
      if (edgeRes.data && edgeRes.data.success === false) {
        throw new Error(edgeRes.data.error || "Gagal memproses pesan di AI server.");
      }

      // 5. Jika SUKSES dan balasan AI ada
      if (edgeRes.data && edgeRes.data.reply) {
        if (edgeRes.data.model_used) {
          console.log("Model Terpakai:", edgeRes.data.model_used);
        }
        console.log("Balasan AI:", edgeRes.data.reply);
        aiReplyText = edgeRes.data.reply;
        if (edgeRes.data.conversation_id) {
          effectiveConvId = edgeRes.data.conversation_id;
          setCurrentSessionId(effectiveConvId);
        }
      } else {
        // Fallback jika respons kosong / menggunakan fallback internal API
        console.warn("⚠️ Menggunakan fallback API internal /api/chat");
        const history = baseMessages.map(m => ({
          role: m.role,
          text: m.text
        }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history, message: userText, model: selectedModel, customInstruction, reasoningMode }),
          signal: abortControllerRef.current.signal
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "Format respons dari server tidak sesuai.");
        }

        const data = await res.json();
        aiReplyText = data.text || "Tidak ada respons yang diterima.";

        sendMessageToSupabase(userText, effectiveConvId, 'user').catch(() => {});
        sendMessageToSupabase(aiReplyText, effectiveConvId, 'assistant').catch(() => {});
      }
      
      // Update limit penggunaan ke tabel public.user_limits via RPC consume_ai_limit
      try {
        let activeUserId = user?.id;
        if (!activeUserId) {
          const { data: sessData } = await supabase.auth.getSession();
          activeUserId = sessData?.session?.user?.id;
        }

        if (activeUserId) {
          const modelCode = getModelLimitCode(selectedModel, isVisionActive);
          const limitRes = await consumeAiLimit(activeUserId, modelCode);

          if (limitRes && !limitRes.success) {
            alert(limitRes.message || "Batas penggunaan AI telah tercapai.");
          }

          if (limitRes && limitRes.used_5h !== undefined) {
            setDbLimits({
              used5h: limitRes.used_5h,
              usedWeekly: limitRes.used_weekly,
            });
          }
        }
      } catch (limitErr) {
        console.warn("Gagal update user_limits saat menerima jawaban AI:", limitErr);
      }

      // Tampilkan balasan AI ke UI
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiReplyText,
      };

      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);

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
        console.log('Request aborted by user');
        return;
      }
      // Tangkap error dan tampilkan di UI secara halus
      console.error("Catch Block Frontend Error:", err);
      const errMsg = err?.message || "Terjadi kesalahan saat memuat balasan.";
      setErrorState(errMsg);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ ${errMsg}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      // 6. Matikan indikator Loading setelah SEMUA proses selesai
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
      
      {!showSplash && !authChecking && !authError && appState === 'landing' && (
        <LandingPage onStart={handleLandingStart} />
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'login' && (
        <LoginPage onLoginSuccess={() => setAppState('chat')} onBack={() => setAppState('landing')} />
      )}
      
      {!showSplash && !authChecking && !authError && appState === 'chat' && (
        <div className="flex flex-col h-screen bg-black text-gray-100 font-sans selection:bg-blue-600/30 overflow-hidden relative">
        {/* Header */}
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-gray-900 border-opacity-80">
        <div className="max-w-5xl mx-auto px-3 md:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 -ml-2 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>

          {/* Model Selector Trigger */}
          <div className="flex items-center gap-2">
            <div 
              onClick={() => setIsModelSelectorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 border border-gray-800 transition-colors cursor-pointer text-xs font-semibold text-gray-300 active:scale-95"
            >
              <span>Model: <strong className="text-blue-500">
                {selectedModel === 'agnes-2.0-flash' ? 'Tmpa ai v2' : selectedModel === 'tencent-hy3-free' ? 'Tmpa ai v1' : 'Dilo'}
              </strong></span>
              {isVisionActive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">
                  <Eye size={10} /> Vision
                </span>
              )}
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-10 h-10 -mr-2 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Export Konversasi"
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
                    className="absolute right-0 top-12 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-20 py-1 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-gray-800/50 mb-1">
                      <p className="text-xs font-semibold text-gray-400">Export Chat</p>
                    </div>
                    <button
                      onClick={() => { exportChat('markdown'); setIsExportDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      Format Markdown (.md)
                    </button>
                    <button
                      onClick={() => { exportChat('json'); setIsExportDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
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
        <div className="w-full h-0.5 bg-gray-900 z-10 shrink-0 select-none pointer-events-none">
          <motion.div 
            className="h-full bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <main onScroll={handleScroll} className="flex-1 overflow-y-auto w-full scroll-smooth relative">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-14 h-14 md:w-16 md:h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 border border-blue-500/20 shrink-0"
            >
              <Bot size={28} className="md:w-8 md:h-8" />
            </motion.div>
            <h2 className="text-xl md:text-3xl font-medium text-white mb-3 tracking-tight text-center leading-tight">
              Apa yang bisa saya bantu hari ini?
            </h2>
            <p className="text-gray-400 max-w-md text-center text-xs md:text-sm mb-8 leading-relaxed px-4 md:px-0">
              Saya asisten AI profesional untuk bertukar ide, menulis kode, memecahkan masalah, dan tugas lainnya menggunakan model OpenRouter.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 max-w-2xl w-full mx-auto">
              {[
                "Tuliskan draf email lamaran kerja",
                "Jelaskan fisika kuantum dengan sederhana",
                "Buat rencana jadwal belajar 1 minggu",
                "Bantu saya mencari ide bisnis konten"
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-900 transition-all rounded-xl p-3.5 md:p-4 text-left group flex items-center justify-between"
                >
                  <span className="text-sm text-gray-300 group-hover:text-white leading-snug">{suggestion}</span>
                  <Sparkles size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pb-4">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} onEdit={handleEditMessage} onStop={isLoading ? stopGeneration : undefined} />
            ))}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="py-4 sm:py-6 px-4 sm:px-8 flex w-full bg-gray-900/30"
              >
                <div className="max-w-3xl mx-auto flex w-full gap-4 sm:gap-6">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-1">
                    <Bot size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="flex-1 w-0 pt-2 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
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
              className="bg-gray-800/80 hover:bg-gray-700/90 text-white p-2.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-gray-700 backdrop-blur-sm transition-colors group"
            >
              <ArrowDown size={20} className="group-hover:text-blue-400 transition-colors" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form */}
      <footer className="bg-black border-t border-gray-900 pt-2 shrink-0 relative z-20">
        <ChatInput 
          onSend={handleSendMessage} 
          isLoading={isLoading} 
          onStop={stopGeneration} 
          connectors={connectors}
          onToggleConnector={toggleConnector}
          onShowAllConnectors={() => setIsConnectorsModalOpen(true)}
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
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-gray-950 border-r border-gray-900 z-50 flex flex-col"
            >
              <div className="p-4 pt-6 flex-1 flex flex-col gap-1 overflow-y-auto">
                <button onClick={startNewChat} className="flex items-center gap-3 px-4 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium mb-3">
                  <Sparkles size={18} />
                  Chat Baru
                </button>

                {chatSessions.length > 0 && (
                  <div className="mb-2 mt-1 px-4">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="Cari riwayat chat..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>
                )}

                {chatSessions.length > 0 && (
                  <div className="mb-2 mt-3">
                    <span className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Riwayat Chat</span>
                  </div>
                )}
                
                {chatSessions
                  .filter((session) => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((session) => (
                  <button 
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-medium text-left
                      ${currentSessionId === session.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'}`}
                  >
                    <span className="truncate flex-1 text-sm">{session.title}</span>
                  </button>
                ))}

                {chatSessions.length > 0 && <div className="my-3 border-t border-gray-900" />}

                <button className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-900 rounded-xl transition-colors text-sm font-medium">
                  <Store size={18} />
                  Store
                </button>
                <button className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-900 rounded-xl transition-colors text-sm font-medium">
                  <Globe size={18} />
                  Web utama (TMPA)
                </button>
                <button onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-900 rounded-xl transition-colors text-sm font-medium cursor-pointer">
                  <Settings size={18} />
                  Setting
                </button>
              </div>

              <div className="p-4 border-t border-gray-900 flex flex-col gap-4">
                <div className="flex items-center gap-3 px-2">
                  <img src="https://jjlanjshpyklqayjzxyy.supabase.co/storage/v1/object/public/TMPA%20storege/Desain%20tanpa%20judul_20260520_150307_0000.png" alt="TMPA Logo" className="w-10 h-10 rounded-full object-cover bg-black" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white truncate w-[160px]">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'TMPA User'}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 mt-0.5 truncate w-[160px]">
                      Plan: {userTier}
                    </span>
                    <span className="text-xs text-gray-400 truncate w-[160px] opacity-75 mt-0.5">
                      {user?.email || 'user@tmpa.example'}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center w-full gap-2 px-4 py-2.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                >
                  <LogOut size={16} />
                  Logout
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
              className="absolute inset-0 bg-black/75 backdrop-blur-sm" 
              onClick={() => setIsModelSelectorOpen(false)}
            />
            
            {/* Panel (Drops from the Top down to ~half screen) */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[75vh] md:max-h-[55vh] bg-gray-950 border-b border-gray-900 shadow-2xl z-40 overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-900">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-white tracking-tight">Pilih Model AI</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Tentukan model yang disukai untuk memproses obrolan Anda</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setIsModelSelectorOpen(false);
                        setIsVisionSelectorOpen(true);
                      }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                        isVisionActive 
                          ? 'text-cyan-300 bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30' 
                          : 'text-gray-300 hover:text-white bg-gray-900 border border-gray-800 hover:bg-gray-800'
                      }`}
                    >
                      {isVisionActive ? <Eye size={14} className="text-cyan-400" /> : <EyeOff size={14} />}
                      Vision {isVisionActive ? '(Aktif)' : ''}
                    </button>
                    <button 
                      onClick={() => {
                        setIsModelSelectorOpen(false);
                        setIsReasoningSelectorOpen(true);
                      }}
                      className="text-xs font-semibold text-[#1a73e8] hover:text-white bg-[#1a73e8]/10 border border-[#1a73e8]/30 hover:bg-[#1a73e8]/20 px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Brain size={14} />
                      Penalaran
                    </button>
                    <button 
                      onClick={() => setIsModelSelectorOpen(false)}
                      className="text-xs font-semibold text-gray-300 hover:text-white bg-gray-900 border border-gray-800 hover:bg-gray-800 px-3 py-1.5 rounded-full transition-all cursor-pointer"
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
                    className="mb-4 p-3 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 text-xs flex items-center gap-2"
                  >
                    <Lock size={14} className="text-cyan-400 shrink-0" />
                    <span>{visionLockedNotice}</span>
                  </motion.div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {/* Tmpa ai v2 (agnes-2.0-flash) Choice */}
                  <button 
                    onClick={() => handleSelectModel('agnes-2.0-flash')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      selectedModel === 'agnes-2.0-flash' 
                        ? 'bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/30' 
                        : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'agnes-2.0-flash' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                      }`}>
                        <Bot size={18} />
                      </div>
                      {isVisionActive && (
                        <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Eye size={10} /> Vision Aktif
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-white text-sm md:text-base leading-snug">Tmpa ai v2</h4>
                    <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase mt-1">power by agnes-2.0-flash</span>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      Model AI cerdas multimodal berkecepatan tinggi dengan kapabilitas analisis visual komprehensif, coding, dan penalaran mutakhir.
                    </p>
                  </button>

                  {/* Tmpa ai v1 (tencent-hy3-free) Choice */}
                  <button 
                    onClick={() => handleSelectModel('tencent-hy3-free')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all relative ${
                      isVisionActive 
                        ? 'opacity-60 bg-gray-950/60 border-gray-900 cursor-not-allowed' 
                        : selectedModel === 'tencent-hy3-free'
                          ? 'bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/10 cursor-pointer' 
                          : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'tencent-hy3-free' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                      }`}>
                        <Cpu size={18} />
                      </div>
                      {isVisionActive && (
                        <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                          <Lock size={11} /> Terkunci
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-white text-sm md:text-base leading-snug">Tmpa ai v1</h4>
                    <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase mt-1">power by tencent-hy3-free</span>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      Model open-source modular generasi baru yang sangat optimal, super cepat, efisien, dan andal untuk percakapan sehari-hari.
                    </p>
                  </button>

                  {/* Dilo (laguna-s-2.1) Choice */}
                  <button 
                    onClick={() => handleSelectModel('laguna-s-2.1')}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all relative ${
                      isVisionActive 
                        ? 'opacity-60 bg-gray-950/60 border-gray-900 cursor-not-allowed' 
                        : selectedModel === 'laguna-s-2.1'
                          ? 'bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/10 cursor-pointer' 
                          : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3.5 md:mb-4">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                        selectedModel === 'laguna-s-2.1' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                      }`}>
                        <Layers size={18} />
                      </div>
                      {isVisionActive && (
                        <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                          <Lock size={11} /> Terkunci
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-white text-sm md:text-base leading-snug">Dilo</h4>
                    <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase mt-1">power by laguna-s-2.1</span>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
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
              className="absolute inset-0 bg-black/75 backdrop-blur-sm" 
              onClick={() => setIsVisionSelectorOpen(false)}
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[80vh] md:max-h-[60vh] bg-gray-950 border-t border-gray-900 shadow-2xl z-40 overflow-y-auto rounded-t-3xl"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-900">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                      <Eye size={20} className="text-cyan-400" />
                      Pengaturan Mode Vision
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Tentukan apakah mode pemrosesan visual aktif atau nonaktif</p>
                  </div>
                  <button 
                    onClick={() => setIsVisionSelectorOpen(false)}
                    className="text-xs font-semibold text-gray-300 hover:text-white bg-gray-900 border border-gray-800 hover:bg-gray-800 px-3 py-1.5 rounded-full transition-all cursor-pointer"
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
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-500/40' 
                        : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isVisionActive ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]' : 'bg-gray-800 text-gray-400'}`}>
                          <Eye size={18} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
                            Aktifkan Vision (Agnes AI)
                            {isVisionActive && (
                              <span className="text-[11px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full">
                                Sedang Digunakan
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-cyan-400 font-mono">model: agnes-2.0-flash</span>
                        </div>
                      </div>
                      {isVisionActive && (
                        <div className="w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed pl-12">
                      Mengaktifkan kemampuan analisis visual. Sistem akan otomatis memanggil dan mengunci model ke <strong className="text-cyan-300">Agnes AI (agnes-2.0-flash)</strong> sehingga model tidak dapat diubah selama mode Vision menyala.
                    </p>
                  </button>

                  {/* Option: No Vision */}
                  <button 
                    onClick={handleDisableVision}
                    className={`flex flex-col text-left p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      !isVisionActive 
                        ? 'bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/30' 
                        : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${!isVisionActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                          <EyeOff size={18} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
                            No Vision
                            {!isVisionActive && (
                              <span className="text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                                Standar Teks
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-gray-400 font-mono">Bebas memilih model</span>
                        </div>
                      </div>
                      {!isVisionActive && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed pl-12">
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
              className="absolute inset-0 bg-black/75 backdrop-blur-sm" 
              onClick={() => setIsReasoningSelectorOpen(false)}
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[75vh] md:max-h-[55vh] bg-gray-950 border-t border-gray-900 shadow-2xl z-40 overflow-y-auto rounded-t-3xl"
            >
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-900">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-white tracking-tight">Pilih Mode Penalaran</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Atur seberapa pintar AI dalam berpikir sebelum merespons</p>
                  </div>
                  <button 
                    onClick={() => setIsReasoningSelectorOpen(false)}
                    className="text-xs font-semibold text-gray-300 hover:text-white bg-gray-900 border border-gray-800 hover:bg-gray-800 px-3 py-1.5 rounded-full transition-all cursor-pointer"
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
                        ? 'bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/10' 
                        : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reasoningMode === 'standar' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                         <Zap size={16} />
                       </div>
                       <h4 className="font-semibold text-white text-sm md:text-base">Standar</h4>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed pl-11">
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
                        ? 'bg-[#1a73e8]/10 border-[#1a73e8] shadow-sm shadow-[#1a73e8]/10' 
                        : 'bg-gray-900/40 border-gray-900 hover:border-gray-800 hover:bg-gray-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reasoningMode === 'penalaran' ? 'bg-[#1a73e8] text-white' : 'bg-gray-800 text-gray-400'}`}>
                         <Brain size={16} />
                       </div>
                       <h4 className="font-semibold text-white text-sm md:text-base">Penalaran</h4>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed pl-11">
                      AI wajib memahami konteks, berpikir keras, dan mencari solusi terlebih dahulu sebelum memberikan jawaban terbaik.
                    </p>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
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
        resetUsage={() => { setUsageEvents([]); localStorage.setItem('ai_usage_events', '[]'); }}
      />

      <ConnectorsModal
        isOpen={isConnectorsModalOpen}
        onClose={() => setIsConnectorsModalOpen(false)}
        connectors={connectors}
        onToggleConnector={toggleConnector}
        onAddConnector={(id, apiKey) => {
          setConnectors(prev => prev.map(c => c.id === id ? { ...c, isConfigured: true, isActive: true, apiKey } : c));
        }}
      />
    </div>
      )}
    </>
  );
}
