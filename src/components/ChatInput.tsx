import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Square, Link2, MoreHorizontal, Mic, Square as StopCircle, Upload, X, Image as ImageIcon, Video as VideoIcon, Eye, AlertTriangle, Clock, Film } from 'lucide-react';
import { cn } from '../lib/utils';
import { Connector, MediaAttachment } from '../types';
import { AnimatePresence, motion } from 'motion/react';

interface ChatInputProps {
  onSend: (message: string, media?: MediaAttachment[]) => void;
  isLoading: boolean;
  onStop?: () => void;
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
  onShowAllConnectors: () => void;
  onAutoEnableVision?: () => void;
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

export function ChatInput({ 
  onSend, 
  isLoading, 
  onStop, 
  connectors, 
  onToggleConnector, 
  onShowAllConnectors,
  onAutoEnableVision,
  isVisionActive,
  disabled 
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const [attachedMediaList, setAttachedMediaList] = useState<MediaAttachment[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [errorModal, setErrorModal] = useState<CustomErrorModal | null>(null);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const isManuallyStoppedRef = useRef(false);
  const sessionFinalsRef = useRef<string>('');
  const sessionInterimsRef = useRef<string>('');

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

  // Handle Multi-file upload dengan validasi maksimal 5 file & video maksimal 1 menit
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // 1. Cek Kuota Total Maksimal 5 File
    if (attachedMediaList.length + fileArray.length > 5) {
      setErrorModal({
        isOpen: true,
        title: "Batas Maksimal 5 File Terlampaui",
        message: "Anda hanya dapat mengunggah maksimal 5 file foto atau video secara bersamaan.",
        maxLimitInfo: `Saat ini: ${attachedMediaList.length} terunggah, mencoba menambah: ${fileArray.length} file.`
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingMedia(true);
    const newAttachments: MediaAttachment[] = [];

    for (const file of fileArray) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setErrorModal({
          isOpen: true,
          title: "Format File Tidak Didukung",
          message: `File "${file.name}" bukan format gambar atau video yang didukung. Harap pilih file JPG, PNG, WEBP, MP4, atau MOV.`,
          fileName: file.name
        });
        continue;
      }

      if (isVideo) {
        // Cek durasi video: Maksimal 1 menit (60 detik)
        try {
          const duration = await new Promise<number>((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            const objectUrl = URL.createObjectURL(file);
            
            video.onloadedmetadata = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(video.duration);
            };
            
            video.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error("Gagal membaca metadata video."));
            };
            
            video.src = objectUrl;
          });

          if (duration > 60) {
            setErrorModal({
              isOpen: true,
              title: "Durasi Video Melebihi Batas (Maks. 1 Menit)",
              message: `Video "${file.name}" berdurasi lebih dari 1 menit. Sistem membatasi durasi video maksimal 60 detik untuk pemrosesan AI Vision.`,
              fileName: file.name,
              durationInfo: `Durasi video: ${Math.round(duration)} detik • Maksimal: 60 detik`
            });
            continue; // Tolak video ini
          }

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newAttachments.push({
            url: dataUrl,
            type: 'video',
            name: file.name,
            size: file.size,
            duration: duration,
          });
        } catch (err: any) {
          setErrorModal({
            isOpen: true,
            title: "Gagal Membaca Video",
            message: `Gagal memproses metadata video "${file.name}". Pastikan format video didukung oleh browser Anda.`,
            fileName: file.name
          });
          continue;
        }
      } else {
        // Foto / Gambar
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newAttachments.push({
            url: dataUrl,
            type: 'image',
            name: file.name,
            size: file.size,
          });
        } catch (err) {
          setErrorModal({
            isOpen: true,
            title: "Gagal Membaca Foto",
            message: `Gagal membaca file gambar "${file.name}".`,
            fileName: file.name
          });
          continue;
        }
      }
    }

    if (newAttachments.length > 0) {
      setAttachedMediaList(prev => [...prev, ...newAttachments].slice(0, 5));
      // Otomatis aktifkan mode Vision
      if (onAutoEnableVision) {
        onAutoEnableVision();
      }
    }

    setIsProcessingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveSingleMedia = (indexToRemove: number) => {
    setAttachedMediaList(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAllMedia = () => {
    setAttachedMediaList([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachedMediaList.length > 0) && !isLoading) {
      onSend(input.trim(), attachedMediaList.length > 0 ? attachedMediaList : undefined);
      setInput('');
      setAttachedMediaList([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const activeConnectors = connectors.filter(c => c.isActive);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 pb-4 sm:pb-6 pt-1 select-none relative">
      {/* Hidden file input untuk multi-upload foto & video */}
      <input 
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
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
              className="relative w-full max-w-md bg-gray-950/95 border border-red-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)] z-10 overflow-hidden backdrop-blur-2xl"
            >
              {/* Glow Accent */}
              <div className="absolute -top-20 -right-20 w-44 h-44 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                  {errorModal.durationInfo ? <Film size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {errorModal.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 mt-2 leading-relaxed">
                    {errorModal.message}
                  </p>

                  {errorModal.fileName && (
                    <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-[11px] text-gray-300 font-mono truncate">
                      File: {errorModal.fileName}
                    </div>
                  )}

                  {errorModal.durationInfo && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-300 font-mono flex items-center gap-2">
                      <Clock size={14} className="shrink-0 text-red-400" />
                      <span>{errorModal.durationInfo}</span>
                    </div>
                  )}

                  {errorModal.maxLimitInfo && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/20 text-xs text-amber-300 font-medium">
                      {errorModal.maxLimitInfo}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setErrorModal(null)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-lg shadow-red-950/50 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  Mengerti & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative" ref={popupRef}>
        {/* POPUP GABUNGAN: CONNECT & UPLOAD (SAAT TOMBOL CONNECT DI-KLIK) */}
        <AnimatePresence>
          {isPopupOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-3 w-72 bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl z-20 overflow-hidden flex flex-col backdrop-blur-xl"
            >
              {/* Opsi 1: Upload Foto & Video */}
              <div className="p-2 border-b border-gray-900 bg-gray-900/30">
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
                      ? "opacity-50 cursor-not-allowed bg-gray-900/40 border-transparent"
                      : "hover:bg-blue-600/15 border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-sm">
                      <Upload size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                        Upload Foto & Video
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        Maks 5 file • Video maks 1 mnt
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded-full shrink-0">
                    Vision
                  </span>
                </button>
              </div>

              {/* Opsi 2: Daftar Konektor Aktif */}
              <div className="px-3 py-2 bg-gray-950 border-b border-gray-900 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Konektor Eksternal</span>
                <span className="text-[10px] text-gray-500">{activeConnectors.length} Aktif</span>
              </div>

              <div className="max-h-[160px] overflow-y-auto w-full divide-y divide-gray-900/60">
                {activeConnectors.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    Belum ada konektor yang aktif.
                  </div>
                ) : (
                  activeConnectors.map(connector => (
                    <div key={connector.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-5 h-5 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-300 shrink-0">
                          {connector.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-200 truncate">{connector.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleConnector(connector.id)}
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 cursor-pointer",
                          connector.isActive ? "bg-blue-600" : "bg-gray-700"
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
                className="flex items-center justify-center gap-2 p-2.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-900 transition-colors border-t border-gray-900 cursor-pointer"
              >
                <MoreHorizontal size={14} />
                Kelola Semua Konektor
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PREVIEW MEDIA DI ATAS INPUT PROMPT (MAKS 5 FILE) */}
        <AnimatePresence>
          {attachedMediaList.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="mb-2 p-2.5 bg-gray-950/95 border border-gray-800 rounded-2xl shadow-xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between pb-1.5 px-1 border-b border-gray-900 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-200">
                    File Terlampir ({attachedMediaList.length}/5)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium flex items-center gap-1">
                    <Eye size={10} /> Auto-Vision
                  </span>
                </div>
                {attachedMediaList.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearAllMedia}
                    className="text-[10px] text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 overflow-x-auto py-1">
                {attachedMediaList.map((item, index) => (
                  <div
                    key={index}
                    className="relative group flex items-center gap-2.5 p-1.5 pr-2 rounded-xl bg-gray-900 border border-gray-800 max-w-[240px] shrink-0"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 border border-gray-800 flex items-center justify-center">
                      {item.type === 'image' ? (
                        <img src={item.url} alt="Thumbnail" className="w-full h-full object-cover" />
                      ) : (
                        <video src={item.url} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                        {item.type === 'image' ? (
                          <ImageIcon size={14} className="text-white" />
                        ) : (
                          <VideoIcon size={14} className="text-cyan-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs text-gray-200 font-medium truncate max-w-[120px] sm:max-w-[140px]">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {item.type === 'video' && item.duration !== undefined
                          ? `Video • ${Math.round(item.duration)}s`
                          : `Foto • ${(item.size ? (item.size / 1024).toFixed(0) : 0)} KB`
                        }
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSingleMedia(index)}
                      className="w-6 h-6 rounded-lg bg-gray-800 hover:bg-red-500/20 hover:text-red-400 text-gray-400 flex items-center justify-center transition-all cursor-pointer border border-gray-700/60 hover:border-red-500/40 shrink-0"
                      title="Hapus file ini"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form 
          onSubmit={handleSubmit}
          className="relative flex items-end overflow-hidden rounded-2xl bg-gray-900 focus-within:bg-gray-900/90 border border-gray-800 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm"
        >
          {/* SATU TOMBOL NYATU (IKON LINK / CONNECTOR) SESUAI GAMBAR */}
          <div className="pl-2 pb-2 sm:pb-3 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsPopupOpen(!isPopupOpen)}
              className={cn(
                "p-2 rounded-xl transition-all shrink-0 h-[38px] w-[38px] flex items-center justify-center cursor-pointer",
                isPopupOpen || activeConnectors.length > 0 || attachedMediaList.length > 0
                  ? "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
              title="Konektor & Upload File"
            >
              {isProcessingMedia ? (
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
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
                  <div className="text-gray-300 text-sm truncate flex-1 pl-1">
                    {recordingText || "Mendengarkan..."}
                  </div>
                  <div className="flex items-center justify-center gap-1 h-6 mx-2 shrink-0">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-blue-500 rounded-full"
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    disabled 
                      ? "Kuota penuh, silakan reset kuota." 
                      : attachedMediaList.length > 0 
                        ? `Ketik pertanyaan tentang ${attachedMediaList.length} file terlampir ini...` 
                        : "Tanya tmpa chat sesuatu..."
                  }
                  className="w-full max-h-[150px] sm:max-h-[200px] bg-transparent text-gray-100 placeholder:text-gray-500 resize-none px-2 py-3.5 sm:py-4 pr-24 focus:outline-none focus:ring-0 border-none m-0 text-[15px] sm:text-base leading-relaxed overflow-y-auto"
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
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors bg-red-600/20 text-red-500 hover:bg-red-600/30 cursor-pointer"
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
                   (isLoading || disabled) ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-gray-800 text-gray-400 hover:text-white cursor-pointer hover:bg-gray-700"
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
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors bg-gray-800 text-gray-400 hover:text-white cursor-pointer"
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
                    ? "bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-md shadow-blue-900/20"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="text-center mt-2 text-xs text-gray-500 font-medium">
        tmpa chat dapat membuat kesalahan. Pertimbangkan untuk memverifikasi informasi penting.
      </div>
    </div>
  );
}
