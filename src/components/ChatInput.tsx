import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Loader2, Square, Link2, MoreHorizontal, Mic, Upload, X, Eye, AlertTriangle, Clock, Film, Music, FileText, Globe, ExternalLink, Square as StopCircle, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Connector, MediaAttachment } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { TriggerCommandModal } from './TriggerCommandModal';
import { filterTriggerCommands, TRIGGER_COMMANDS, TriggerCommand } from '../lib/commands';
import { prepareFilePayload, processAndCompressImage } from '../lib/imageCompressor';
import { extractTextFromPdf } from '../lib/pdfReader';

interface ChatInputProps {
  onSend: (message: string, media?: MediaAttachment[]) => void;
  isLoading: boolean;
  onStop?: () => void;
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
  onShowAllConnectors: () => void;
  onAutoEnableVision?: () => void;
  onDisableVision?: () => void;
  isVisionActive?: boolean;
  disabled?: boolean;
}

interface CustomErrorModal {
  isOpen: boolean;
  title: string;
  message: string;
  fileName?: string;
  durationInfo?: string;
  maxLimitInfo?: string;
}

interface DetectedDomain {
  domain: string;
  url: string;
}

export function ChatInput({ 
  onSend, 
  isLoading, 
  onStop, 
  connectors, 
  onToggleConnector, 
  onShowAllConnectors,
  onAutoEnableVision,
  onDisableVision,
  isVisionActive,
  disabled 
}: ChatInputProps) {
  const { lang, t } = useLanguage();
  const [input, setInput] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const [attachedMediaList, setAttachedMediaList] = useState<MediaAttachment[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [errorModal, setErrorModal] = useState<CustomErrorModal | null>(null);
  const [domainConfirmTarget, setDomainConfirmTarget] = useState<DetectedDomain | null>(null);

  // Trigger Command (@) state
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [filteredCommands, setFilteredCommands] = useState<TriggerCommand[]>(TRIGGER_COMMANDS);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const isManuallyStoppedRef = useRef(false);
  const sessionFinalsRef = useRef<string>('');
  const sessionInterimsRef = useRef<string>('');

  // Real-time domain detection from input text (Google AI Mode style)
  const detectedDomains = useMemo<DetectedDomain[]>(() => {
    if (!input || input.trim().length < 4) return [];
    
    // Ignore internal @ commands
    if (input.startsWith('@') && !input.includes(' ')) return [];

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|ai|me|co|app|dev|tech|site|online|xyz|info|biz|tv|cc|my\.id|ac\.id|go\.id|co\.id|sch\.id|or\.id|biz\.id|web\.id|id)\b(?:\/[^\s]*)?/gi;

    const list: DetectedDomain[] = [];
    const seen = new Set<string>();

    let match;
    // 1. Check full URLs with protocol
    while ((match = urlRegex.exec(input)) !== null) {
      try {
        const full = match[0];
        const parsed = new URL(full);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (host && !seen.has(host)) {
          seen.add(host);
          list.push({
            domain: host,
            url: full
          });
        }
      } catch {}
    }

    // 2. Check plain domain names
    while ((match = domainRegex.exec(input)) !== null) {
      const full = match[0];
      const matchIndex = match.index;
      // Skip email address parts
      if (matchIndex > 0 && input[matchIndex - 1] === '@') continue;

      const rawDomain = full.split('/')[0].toLowerCase();
      const cleanHost = rawDomain.replace(/^www\./, '');
      if (cleanHost && !seen.has(cleanHost)) {
        seen.add(cleanHost);
        const targetUrl = full.startsWith('http://') || full.startsWith('https://') ? full : `https://${full}`;
        list.push({
          domain: cleanHost,
          url: targetUrl
        });
      }
    }

    return list.slice(0, 3); // Max 3 domains
  }, [input]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'id-ID';

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
             sessionFinalsRef.current += (sessionFinalsRef.current ? ' ' : '') + finalTranscript.trim();
          }
          sessionInterimsRef.current = interimTranscript;
          
          setRecordingText(
            (sessionFinalsRef.current + (sessionInterimsRef.current ? ' ' + sessionInterimsRef.current : '')).trim()
          );
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error === 'not-allowed') {
            setErrorModal({
              isOpen: true,
              title: "Akses Mikrofon Ditolak",
              message: "Mohon izinkan akses mikrofon di pengaturan browser Anda untuk menggunakan fitur input suara."
            });
            isManuallyStoppedRef.current = true;
            setIsRecording(false);
          }
        };

        recognitionRef.current.onend = () => {
          if (!isManuallyStoppedRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              setIsRecording(false);
            }
          } else {
            setIsRecording(false);
          }
        };
      }
    }
  }, []);

  const handleStartRecording = async () => {
    if (isRecording) return;
    setRecordingText('');
    sessionFinalsRef.current = '';
    sessionInterimsRef.current = '';
    isManuallyStoppedRef.current = false;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Microphone access denied:", err);
        setErrorModal({
          isOpen: true,
          title: "Izin Mikrofon Diperlukan",
          message: "Akses mikrofon tidak diizinkan atau tidak tersedia di browser Anda."
        });
        return;
      }
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
    } else {
      setErrorModal({
        isOpen: true,
        title: "Perangkat Tidak Mendukung",
        message: "Browser yang Anda gunakan saat ini tidak mendukung fitur Speech Recognition."
      });
    }
  };

  const handleStopRecording = () => {
    isManuallyStoppedRef.current = true;
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const fullText = (sessionFinalsRef.current + (sessionInterimsRef.current ? ' ' + sessionInterimsRef.current : '')).trim();
    if (fullText) {
      setInput((prev) => prev + (prev ? ' ' : '') + fullText);
    }
    setRecordingText('');
    sessionFinalsRef.current = '';
    sessionInterimsRef.current = '';
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  };

  // Trigger File Picker
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle Multi-file upload dengan validasi format spesifik:
  // Diizinkan: Webp, PNG, Gift (GIF), TXT, MD, JSON, YML, YAML, PDF (ekstraksi teks via pdfjs), dan semua kode program
  // Ditolak: Semua format lainnya termasuk MP4 dan MP3
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // 1. Cek Kuota Total Maksimal 5 File
    if (attachedMediaList.length + fileArray.length > 5) {
      setErrorModal({
        isOpen: true,
        title: "Batas Maksimal 5 File Terlampaui",
        message: "Anda hanya dapat mengunggah maksimal 5 file (gambar, PDF, atau dokumen/kode) secara bersamaan.",
        maxLimitInfo: `Saat ini: ${attachedMediaList.length} terunggah, mencoba menambah: ${fileArray.length} file.`
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingMedia(true);
    const newAttachments: MediaAttachment[] = [];

    // Format Gambar yang diizinkan (WebP, PNG, GIF/Gift, JPEG/JPG)
    const allowedImageExts = ['.webp', '.png', '.gif', '.jpeg', '.jpg'];
    const isImageFile = (file: File, lower: string) => {
      if (allowedImageExts.some(ext => lower.endsWith(ext))) return true;
      if (file.type === 'image/webp' || file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/jpeg') return true;
      return false;
    };

    // Format PDF (Membutuhkan library pemroses / pembaca)
    const isPdfFile = (file: File, lower: string) => {
      return lower.endsWith('.pdf') || file.type === 'application/pdf';
    };

    // Format Data & Teks spesifik (txt, MD, Json, Yml, Yaml)
    const allowedDataAndTextExts = ['.txt', '.md', '.markdown', '.json', '.yml', '.yaml'];

    // Semua format file kode program yang didukung untuk dibaca
    const allowedCodeExts = [
      // Web / Frontend / JS / TS
      '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
      // Python & Jupyter
      '.py', '.pyw', '.ipynb',
      // Web styles & markup
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      // C / C++ / C#
      '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs',
      // Java / Kotlin / Scala / JVM
      '.java', '.kt', '.kts', '.scala', '.groovy', '.clj',
      // Systems & Backend
      '.go', '.rs', '.php', '.rb',
      // Mobile
      '.swift', '.dart',
      // Shell / CLI / Scripts
      '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
      // Database & API
      '.sql', '.sqlite', '.prisma', '.graphql', '.gql',
      // Data formats & Configs kode
      '.toml', '.ini', '.env', '.xml', '.csv', '.tsv', '.log', '.diff', '.patch', '.conf', '.cfg',
      // Bahasa Pemrograman Lainnya
      '.r', '.lua', '.pl', '.perl', '.sol', '.proto', '.asm', '.s', '.zig', '.nim', '.ex', '.exs', '.erl', '.hs', '.v', '.sv'
    ];

    const isCodeOrTextFile = (file: File, lower: string) => {
      if (allowedDataAndTextExts.some(ext => lower.endsWith(ext))) return true;
      if (allowedCodeExts.some(ext => lower.endsWith(ext))) return true;
      if (file.type === 'text/plain' || file.type === 'application/json' || file.type === 'text/markdown') return true;
      return false;
    };

    try {
      for (const file of fileArray) {
        const lowerName = file.name.toLowerCase();
        const fileId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Cek eksplisit jika pengguna mencoba mengunggah MP4, MP3, atau file audio/video lainnya
        const isVideoAttempt = file.type.startsWith('video/') || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.3gp'].some(ext => lowerName.endsWith(ext));
        const isAudioAttempt = file.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.wma', '.opus', '.aiff'].some(ext => lowerName.endsWith(ext));

        if (isVideoAttempt || isAudioAttempt) {
          setErrorModal({
            isOpen: true,
            title: "Format Video/Audio Ditolak",
            message: `File "${file.name}" tidak diizinkan. Sesuai kebijakan format, file audio (MP3, dll) dan video (MP4, dll) ditolak.\n\nFormat yang diizinkan:\n• Gambar: WebP, PNG, GIF\n• Dokumen & Teks: PDF (ekstraksi teks), TXT, MD\n• Data: JSON, YAML, YML\n• Kode Program: Semua file kode pemrograman`,
            fileName: file.name
          });
          continue;
        }

        const isImage = isImageFile(file, lowerName);
        const isPdf = isPdfFile(file, lowerName);
        const isCodeOrText = isCodeOrTextFile(file, lowerName);

        // Jika bukan gambar, bukan PDF, dan bukan file kode/teks yang diizinkan -> TOLAK
        if (!isImage && !isPdf && !isCodeOrText) {
          setErrorModal({
            isOpen: true,
            title: "Format File Tidak Didukung",
            message: `File "${file.name}" ditolak. Format yang diizinkan:\n• Gambar: WebP, PNG, GIF\n• Dokumen: PDF (bisa dibaca), TXT, MD\n• Data: JSON, YAML, YML\n• Kode: Semua format file kode program (.js, .ts, .py, .java, .cpp, .html, .css, .sql, dll)\n\nFile lain termasuk video (MP4) dan audio (MP3) ditolak.`,
            fileName: file.name
          });
          continue;
        }

        // 1. Pemrosesan PDF (Menggunakan library pdfjs-dist untuk mengekstrak isi teks agar dapat dibaca AI)
        if (isPdf) {
          try {
            let extracted = { text: '', numPages: 1 };
            try {
              extracted = await extractTextFromPdf(file);
            } catch (pdfErr: any) {
              console.warn("Gagal mengekstrak teks PDF dengan pdfjs-dist:", pdfErr);
              extracted = { text: `[Dokumen PDF: ${file.name}]`, numPages: 1 };
            }

            const { text: pdfText, numPages } = extracted;

            if (pdfText && pdfText.length > 60000) {
              setErrorModal({
                isOpen: true,
                title: "Isi Dokumen PDF Terlalu Panjang",
                message: `File PDF "${file.name}" (${numPages} halaman) memiliki ${pdfText.length.toLocaleString()} karakter (melebihi batas 60.000 karakter). Harap gunakan dokumen PDF yang lebih ringkas.`,
                fileName: file.name,
                maxLimitInfo: `Total karakter: ${pdfText.length.toLocaleString()} • Batas: 60.000 karakter`
              });
              continue;
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            newAttachments.push({
              id: fileId,
              url: dataUrl,
              type: 'document',
              name: file.name,
              size: file.size,
              textContent: pdfText || `[Isi PDF: ${file.name} (${numPages} halaman)]`,
              pageCount: numPages,
            });
          } catch (err: any) {
            setErrorModal({
              isOpen: true,
              title: "Gagal Membaca File PDF",
              message: `File PDF "${file.name}" tidak dapat dibaca. Pastikan file valid dan tidak dikunci sandi.`,
              fileName: file.name
            });
            continue;
          }
        }
        // 2. Pemrosesan File Kode & Teks (TXT, MD, JSON, YML, YAML, dan semua kode pemrograman)
        else if (isCodeOrText) {
          try {
            let textContent = '';
            try {
              textContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
              });
            } catch {
              textContent = `[File: ${file.name}]`;
            }

            if (!textContent || textContent.trim().length === 0) {
              setErrorModal({
                isOpen: true,
                title: "Berkas Teks Kosong",
                message: `Berkas "${file.name}" tidak memiliki isi teks untuk dibaca (0 karakter). Harap unggah berkas yang berisi teks.`,
                fileName: file.name
              });
              continue;
            }

            if (textContent && textContent.length > 50000) {
              setErrorModal({
                isOpen: true,
                title: "Isi File Terlalu Panjang (Maks. 50.000 Karakter)",
                message: `File "${file.name}" memiliki ${textContent.length.toLocaleString()} karakter (melebihi batas 50.000 karakter). Harap unggah kode atau teks yang lebih ringkas.`,
                fileName: file.name,
                maxLimitInfo: `Total karakter: ${textContent.length.toLocaleString()} • Batas: 50.000 karakter`
              });
              continue;
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            newAttachments.push({
              id: fileId,
              url: dataUrl,
              type: 'document',
              name: file.name,
              size: file.size,
              textContent: textContent,
            });
          } catch (err: any) {
            setErrorModal({
              isOpen: true,
              title: "Gagal Membaca Berkas",
              message: `Gagal membaca isi berkas "${file.name}".`,
              fileName: file.name
            });
            continue;
          }
        }
        // 3. Pemrosesan Gambar (WebP, PNG, GIF, JPEG)
        else if (isImage) {
          try {
            const dataUrl = await prepareFilePayload(file);
            if (!dataUrl) continue;

            newAttachments.push({
              id: fileId,
              url: dataUrl,
              type: 'image',
              name: file.name,
              size: file.size,
            });
          } catch (err: any) {
            setErrorModal({
              isOpen: true,
              title: "Gagal Memproses Gambar",
              message: err?.message || `Gagal membaca file gambar "${file.name}".`,
              fileName: file.name
            });
            continue;
          }
        }
      }

      if (newAttachments.length > 0) {
        setAttachedMediaList(prev => [...prev, ...newAttachments].slice(0, 5));
        // Otomatis aktifkan mode Vision jika ada gambar terunggah
        const hasVisionMedia = newAttachments.some(a => a.type === 'image');
        if (hasVisionMedia && onAutoEnableVision) {
          onAutoEnableVision();
        }
      }
    } catch (unexpectedErr: any) {
      console.error("[FRONTEND FILE PROCESS ERROR]:", unexpectedErr);
      setErrorModal({
        isOpen: true,
        title: "Kendala Pemrosesan File",
        message: unexpectedErr?.message || "Terjadi kesalahan saat memproses lampiran file.",
      });
    } finally {
      setIsProcessingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveSingleMedia = (indexToRemove: number) => {
    const updated = attachedMediaList.filter((_, idx) => idx !== indexToRemove);
    setAttachedMediaList(updated);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Jika semua foto/video telah ditutup, matikan mode Vision otomatis
    if (updated.length === 0 && onDisableVision) {
      onDisableVision();
    }
  };

  const handleClearAllMedia = () => {
    setAttachedMediaList([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Matikan mode Vision otomatis saat semua foto ditutup
    if (onDisableVision) {
      onDisableVision();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (val: string) => {
    setInput(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const textAfterAt = val.slice(atIndex);
      // Only show menu if query starts with @ and hasn't exceeded a reasonable length
      if (textAfterAt.length <= 35) {
        const matched = filterTriggerCommands(textAfterAt);
        if (matched.length > 0) {
          setCommandQuery(textAfterAt);
          setFilteredCommands(matched);
          setIsCommandModalOpen(true);
          setCommandSelectedIndex(0);
          return;
        }
      }
    }
    setIsCommandModalOpen(false);
  };

  const handleSelectCommand = (cmd: TriggerCommand) => {
    const atIndex = input.lastIndexOf('@');
    let newInput = '';
    if (atIndex !== -1) {
      newInput = input.slice(0, atIndex) + cmd.name + (cmd.hasParameter ? ' ' : '');
    } else {
      newInput = cmd.name + (cmd.hasParameter ? ' ' : '');
    }
    setInput(newInput);
    setIsCommandModalOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachedMediaList.length > 0) && !isLoading) {
      onSend(input.trim(), attachedMediaList.length > 0 ? attachedMediaList : undefined);
      setInput('');
      setIsCommandModalOpen(false);
      setAttachedMediaList([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isCommandModalOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const selectedCmd = filteredCommands[commandSelectedIndex];
        if (selectedCmd) {
          handleSelectCommand(selectedCmd);
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const selectedCmd = filteredCommands[commandSelectedIndex];
        // If user is just selecting command from list (input starts with @ and hasn't provided arguments)
        const parts = input.trim().split(/\s+/);
        if (selectedCmd && (parts.length <= 2 && input.startsWith('@'))) {
          e.preventDefault();
          handleSelectCommand(selectedCmd);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsCommandModalOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const activeConnectors = connectors.filter(c => c.isActive);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 pb-4 sm:pb-6 pt-1 select-none relative">
      {/* Hidden file input untuk format yang diizinkan (WebP, PNG, GIF, PDF, TXT, MD, JSON, YML, YAML, Kode Program) */}
      <input 
        ref={fileInputRef}
        type="file"
        multiple
        accept=".webp,.png,.gif,.jpg,.jpeg,image/webp,image/png,image/gif,image/jpeg,.pdf,application/pdf,.txt,.md,.markdown,.json,.yml,.yaml,.js,.jsx,.ts,.tsx,.py,.ipynb,.html,.css,.scss,.java,.kt,.c,.cpp,.h,.hpp,.cs,.go,.rs,.php,.rb,.sh,.bash,.zsh,.sql,.vue,.svelte,.xml,.toml,.ini,.env,.graphql,.proto,.sol,.dart,.swift,.lua,.r"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* POPUP PERINGATAN KUSTOM YANG ELEGAN (ANTI-BROWSER ALERT) */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setErrorModal(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative w-full max-w-md bg-white border border-rose-200 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden text-slate-900"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  {errorModal.durationInfo ? <Film size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    {errorModal.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    {errorModal.message}
                  </p>

                  {errorModal.fileName && (
                    <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-mono truncate">
                      File: {errorModal.fileName}
                    </div>
                  )}

                  {errorModal.durationInfo && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-mono flex items-center gap-2">
                      <Clock size={14} className="shrink-0 text-rose-600" />
                      <span>{errorModal.durationInfo}</span>
                    </div>
                  )}

                  {errorModal.maxLimitInfo && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                      {errorModal.maxLimitInfo}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setErrorModal(null)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  Mengerti & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP KONFIRMASI REDIRECT KE WEBSITE EKSTERNAL (DOMAIN DETECTION) */}
      <AnimatePresence>
        {domainConfirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDomainConfirmTarget(null)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: "spring", damping: 26, stiffness: 330 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 text-slate-900 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setDomainConfirmTarget(null)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Batal"
              >
                <X size={18} />
              </button>

              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Globe size={24} />
                </div>
                <div className="flex-1 pr-6">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full inline-block mb-1">
                    Tautan Terdeteksi
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Kunjungi Website
                  </h3>
                </div>
              </div>

              {/* Exact user request wording: "apakah kamu mau ke website tersebut?" */}
              <p className="text-sm text-slate-700 mb-4 leading-relaxed font-semibold">
                Apakah kamu mau ke website tersebut?
              </p>

              {/* Target Website preview card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  <img 
                    src={`https://www.google.com/s2/favicons?domain=${domainConfirmTarget.domain}&sz=64`} 
                    alt="" 
                    className="w-4 h-4 object-contain"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {domainConfirmTarget.domain}
                  </span>
                  <span className="text-[11px] text-blue-600 truncate font-mono">
                    {domainConfirmTarget.url}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDomainConfirmTarget(null)}
                  className="w-1/2 sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 transition-all shadow-xs cursor-pointer active:scale-95 text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open(domainConfirmTarget.url, '_blank', 'noopener,noreferrer');
                    }
                    setDomainConfirmTarget(null);
                  }}
                  className="w-1/2 sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                >
                  <span>Redirect</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative" ref={popupRef}>
        {/* TRIGGER COMMAND (@) FLOATING AUTOCOMPLETE MODAL */}
        <TriggerCommandModal
          isOpen={isCommandModalOpen}
          commands={filteredCommands}
          selectedIndex={commandSelectedIndex}
          onSelectCommand={handleSelectCommand}
          onClose={() => setIsCommandModalOpen(false)}
          query={commandQuery}
        />

        {/* POPUP GABUNGAN: CONNECT & UPLOAD (SAAT TOMBOL CONNECT DI-KLIK) */}
        <AnimatePresence>
          {isPopupOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden flex flex-col backdrop-blur-xl text-slate-900"
            >
              {/* Opsi 1: Upload File Lengkap (Foto, Video, Audio, Dokumen) */}
              <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                <button
                  type="button"
                  onClick={() => {
                    setIsPopupOpen(false);
                    handleUploadClick();
                  }}
                  disabled={attachedMediaList.length >= 5 || isProcessingMedia}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left group cursor-pointer",
                    attachedMediaList.length >= 5
                      ? "opacity-50 cursor-not-allowed bg-slate-100 border-transparent text-slate-400"
                      : "hover:bg-blue-50 border-blue-200 bg-blue-50/50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-xs">
                      <Upload size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        Pilih File dari Perangkat
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        PDF, WebP, PNG, GIF, TXT, MD, JSON, YAML, Kode
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded-full shrink-0">
                    File Pilihan
                  </span>
                </button>
              </div>

              {/* Opsi 2: Daftar Konektor Aktif */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Konektor Eksternal</span>
                <span className="text-[10px] text-slate-500 font-medium">{activeConnectors.length} Aktif</span>
              </div>

              <div className="max-h-[160px] overflow-y-auto w-full divide-y divide-slate-100">
                {activeConnectors.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Belum ada konektor yang aktif.
                  </div>
                ) : (
                  activeConnectors.map(connector => (
                    <div key={connector.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                          {connector.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-800 font-medium truncate">{connector.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleConnector(connector.id)}
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 cursor-pointer",
                          connector.isActive ? "bg-blue-600" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            connector.isActive ? "translate-x-3.5" : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsPopupOpen(false);
                  onShowAllConnectors();
                }}
                className="flex items-center justify-center gap-2 p-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors border-t border-slate-100 cursor-pointer"
              >
                <MoreHorizontal size={14} />
                Kelola Semua Konektor
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PREVIEW MEDIA DI ATAS INPUT PROMPT (MAKS 5 FILE - HORIZONTAL SCROLL KE KIRI) */}
        <AnimatePresence>
          {attachedMediaList.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="mb-2 p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between pb-1.5 px-1 border-b border-slate-100 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-800">
                    File Terlampir ({attachedMediaList.length}/5)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold flex items-center gap-1">
                    <Eye size={10} /> Auto-Vision
                  </span>
                </div>
                {attachedMediaList.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearAllMedia}
                    className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer font-medium"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              {/* Container Horizontal Scroll ke Kiri */}
              <div className="flex items-center justify-start gap-2 overflow-x-auto py-1 px-0.5 flex-nowrap scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {attachedMediaList.map((item, index) => {
                  const isImg = item.type === 'image';
                  const isVid = item.type === 'video';
                  const isAud = item.type === 'audio';
                  const isDoc = item.type === 'document' || item.type === 'file';

                  return (
                    <div
                      key={index}
                      className="relative group flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-slate-50 border border-slate-200 w-[190px] sm:w-[210px] shrink-0 shadow-xs"
                    >
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200 flex items-center justify-center">
                        {isImg && (
                          <>
                            <img src={item.url} alt="Thumbnail" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                              <ImageIcon size={12} className="text-white drop-shadow" />
                            </div>
                          </>
                        )}
                        {isVid && (
                          <>
                            <video src={item.url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                              <VideoIcon size={12} className="text-cyan-300 drop-shadow" />
                            </div>
                          </>
                        )}
                        {isAud && (
                          <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Music size={15} />
                          </div>
                        )}
                        {isDoc && (
                          <div className="w-full h-full bg-amber-100 flex items-center justify-center text-amber-700">
                            <FileText size={15} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs text-slate-800 font-medium truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {item.name.toLowerCase().endsWith('.pdf') && item.pageCount
                            ? `PDF • ${item.pageCount} Halaman`
                            : isDoc && item.textContent
                            ? `${item.name.split('.').pop()?.toUpperCase() || 'Dokumen'} • ${item.textContent.length.toLocaleString()} k`
                            : isImg
                            ? `Gambar • ${(item.size ? (item.size / 1024).toFixed(0) : 0)} KB`
                            : `Berkas • ${(item.size ? (item.size / 1024).toFixed(0) : 0)} KB`
                          }
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSingleMedia(index)}
                        className="w-5 h-5 rounded-md bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all cursor-pointer border border-slate-200 hover:border-rose-200 shrink-0 shadow-xs"
                        title="Hapus file ini"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PREVIEW DOMAIN TERDETEKSI (GOOGLE AI SEARCH / AI MODE STYLE) */}
        <AnimatePresence>
          {detectedDomains.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              className="mb-2 p-2 bg-gradient-to-r from-blue-50/90 via-slate-50/90 to-cyan-50/90 border border-blue-200/80 rounded-2xl shadow-xs flex items-center justify-between gap-2 overflow-hidden backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto py-0.5 scrollbar-none">
                {detectedDomains.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDomainConfirmTarget(item)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-slate-800 hover:text-blue-700 transition-all shadow-xs cursor-pointer group active:scale-95 shrink-0"
                    title={`Klik untuk mengunjungi ${item.domain}`}
                  >
                    <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`} 
                        alt="" 
                        className="w-3.5 h-3.5 object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <Globe size={13} className="text-blue-600 hidden group-hover:block" />
                    </div>
                    <span className="text-xs font-semibold tracking-tight truncate max-w-[150px] sm:max-w-[220px]">
                      {item.domain}
                    </span>
                    <span className="text-[10px] text-blue-600 bg-blue-100/70 font-semibold px-1.5 py-0.5 rounded-md hidden sm:inline flex items-center gap-1">
                      Kunjungi Web <ExternalLink size={10} className="inline ml-0.5" />
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 font-medium shrink-0 hidden md:block pl-1 pr-1 font-mono">
                Web Terdeteksi
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form 
          onSubmit={handleSubmit}
          className="relative flex items-end overflow-hidden rounded-2xl bg-white border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm"
        >
          {/* SATU TOMBOL NYATU (IKON LINK / CONNECTOR) */}
          <div className="pl-2 pb-2 sm:pb-3 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsPopupOpen(!isPopupOpen)}
              className={cn(
                "p-2 rounded-xl transition-all shrink-0 h-[38px] w-[38px] flex items-center justify-center cursor-pointer",
                isPopupOpen || activeConnectors.length > 0 || attachedMediaList.length > 0
                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
              title="Konektor & Upload File"
            >
              {isProcessingMedia ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : (
                <Link2 className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex-1 relative min-h-[52px] sm:min-h-[56px] flex items-center">
            <AnimatePresence mode="popLayout">
              {isRecording ? (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="w-full flex items-center justify-between px-2 pr-28"
                >
                  <div className="text-slate-800 text-sm font-medium truncate flex-1 pl-1">
                    {recordingText || "Mendengarkan..."}
                  </div>
                  <div className="flex items-center justify-center gap-1 h-6 mx-2 shrink-0">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-blue-600 rounded-full"
                        animate={{ height: ['40%', '100%', '40%'] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.textarea
                  key="textarea"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    disabled 
                      ? (lang === 'id' ? "Kuota penuh, silakan reset kuota." : "Usage limit reached, please reset.") 
                      : attachedMediaList.length > 0 
                        ? (lang === 'id' ? `Ketik pertanyaan tentang ${attachedMediaList.length} file terlampir ini...` : `Ask about these ${attachedMediaList.length} attached files...`)
                        : t.inputPlaceholder
                  }
                  className="w-full max-h-[150px] sm:max-h-[200px] bg-transparent text-slate-800 placeholder:text-slate-400 resize-none px-2 py-3.5 sm:py-4 pr-24 focus:outline-none focus:ring-0 border-none m-0 text-[15px] sm:text-base leading-relaxed overflow-y-auto"
                  rows={1}
                  disabled={isLoading || disabled}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 flex items-center justify-center gap-1.5">
            {isRecording ? (
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200"
                title="Hentikan rekaman"
              >
                <StopCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px] fill-current" />
              </button>
            ) : (
               <button
                 type="button"
                 onClick={handleStartRecording}
                 disabled={isLoading || disabled}
                 className={cn(
                   "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors",
                   (isLoading || disabled) ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer hover:bg-slate-200"
                 )}
                 title="Bicara"
               >
                 <Mic className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
               </button>
            )}

            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
                title="Hentikan respons"
              >
                <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!input.trim() && attachedMediaList.length === 0) || disabled || isRecording}
                className={cn(
                  "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors",
                  (input.trim() || attachedMediaList.length > 0) && !disabled && !isRecording
                    ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm shadow-blue-600/20"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="text-center mt-2 text-xs text-slate-400 font-medium">
        tmpa chat dapat membuat kesalahan. Pertimbangkan untuk memverifikasi informasi penting.
      </div>
    </div>
  );
}
