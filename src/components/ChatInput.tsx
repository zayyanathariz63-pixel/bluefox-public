import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Square, Link2, MoreHorizontal, Mic, Square as StopCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Connector } from '../types';
import { AnimatePresence, motion } from 'motion/react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
  onShowAllConnectors: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, onStop, connectors, onToggleConnector, onShowAllConnectors, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const recognitionRef = useRef<any>(null);

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
            alert('Akses mikrofon ditolak. Mohon izinkan mikrofon di browser Anda.');
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

    // Ask for system microphone permissions first
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the tracks immediately as we just needed to prompt for permission
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Microphone access denied:", err);
        alert('Akses mikrofon ditolak atau tidak tersedia. Mohon izinkan mikrofon di pengaturan browser atau sistem Anda.');
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
      alert("Browser Anda tidak mendukung fitur pengenalan suara.");
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
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
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
      <div className="relative" ref={popupRef}>
        <AnimatePresence>
          {isPopupOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-3 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-20 overflow-hidden flex flex-col"
            >
              <div className="px-3 py-2 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">Active Connectors</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto w-full">
                {activeConnectors.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Belum ada konektor aktif.
                  </div>
                ) : (
                  activeConnectors.map(connector => (
                    <div key={connector.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300 shrink-0">
                          {connector.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-200 truncate">{connector.name}</span>
                      </div>
                      <button
                        onClick={() => onToggleConnector(connector.id)}
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
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
                onClick={() => {
                  setIsPopupOpen(false);
                  onShowAllConnectors();
                }}
                className="flex items-center justify-center gap-2 p-2.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border-t border-gray-800"
              >
                <MoreHorizontal size={14} />
                Show More Config
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form 
          onSubmit={handleSubmit}
          className="relative flex items-end overflow-hidden rounded-2xl bg-gray-900 focus-within:bg-gray-900/90 border border-gray-800 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm"
        >
          <div className="pl-2 pb-2 sm:pb-3 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsPopupOpen(!isPopupOpen)}
              className={cn(
                "p-2 rounded-xl transition-colors shrink-0 h-[38px] w-[38px] flex items-center justify-center",
                isPopupOpen || activeConnectors.length > 0 ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
              title="Connectors"
            >
              <Link2 className="w-5 h-5" />
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
                  placeholder={disabled ? "Kuota penuh, silakan reset kuota." : "Tanya tmpa chat sesuatu..."}
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
                disabled={!input.trim() || disabled || isRecording}
                className={cn(
                  "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl outline-none transition-colors",
                  input.trim() && !disabled && !isRecording
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
