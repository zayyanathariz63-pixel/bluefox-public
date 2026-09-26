import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { 
  Pencil, Power, Copy, Check, Globe, Zap, Maximize2, 
  Music, FileText, RotateCcw, AlertTriangle, Lightbulb, 
  HelpCircle, ShieldAlert, Sparkles 
} from 'lucide-react';
import { Message, MediaAttachment } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { SourcesBottomSheet } from './SourcesBottomSheet';
import { useLanguage } from '../lib/i18n';
import { ThinkingBlock } from './ThinkingBlock';
import { parseThinking } from '../lib/reasoning';

interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string, newText: string) => void;
  onRetry?: (id: string) => void;
  onStop?: () => void;
  onOpenMediaScreen?: (media: MediaAttachment) => void;
}

/**
 * Ekstraktor teks bersih untuk tombol salin:
 * - Menghilangkan blok <think>...</think>
 * - Menghilangkan tag HTML
 * - Menghilangkan tanda markdown backticks ``` / ` dan simbol header ###
 * - Mempertahankan SEMUA teks, angka, tanda baca, dan emoji
 */
export function extractCleanText(markdownText: string): string {
  if (!markdownText) return '';
  // 1. Hilangkan blok penalaran <think>...</think>
  let text = markdownText.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 2. Hilangkan tag HTML
  text = text.replace(/<[^>]+>/g, '');
  // 3. Hilangkan markdown image tags ![alt](url)
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  // 4. Ubah markdown link [teks](url) menjadi teks
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // 5. Bersihkan pembungkus codeblock ```lang ... ``` tapi pertahankan teks kodenya
  text = text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, '$1');
  text = text.replace(/```([\s\S]*?)```/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  // 6. Hilangkan baris separator tabel Markdown (|---|---|)
  text = text.replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, '');
  // 7. Bersihkan tanda pipa | pada tabel markdown tapi pertahankan teksnya
  text = text.replace(/^\|/gm, '').replace(/\|$/gm, '').replace(/\|/g, ' ');
  // 8. Hilangkan garis horizontal markdown (---, ***, ___)
  text = text.replace(/^[\t ]*[-*_]{3,}[\t ]*$/gm, '');
  // 9. Hilangkan penanda header markdown (#, ##, ###, dst)
  text = text.replace(/^#{1,6}\s+/gm, '');
  // 10. Hilangkan penanda bold, italic, strikethrough (**teks**, *teks*, __teks__, _teks_, ~~teks~~)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  // 11. Hilangkan penanda blockquote (>)
  text = text.replace(/^>\s*/gm, '');
  // 12. Hilangkan penanda bullet list (* , - , + ) di awal baris
  text = text.replace(/^[\t ]*[-*+]\s+/gm, '');
  // 13. Normalisasi spasi dan baris kosong berlebih
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

const CodeBlock = ({ className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  const isInline = !match && !String(children).includes('\n');

  if (!isInline) {
    const codeString = String(children).replace(/\n$/, '');
    const language = match ? match[1] : 'text';
    
    const handleCopy = () => {
      navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    
    return (
      <div className="relative group rounded-xl overflow-hidden my-3 border border-slate-700 bg-[#0f172a] shadow-md max-w-full">
         <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1e293b] text-xs text-slate-300 border-b border-slate-700 select-none">
           <span className="font-mono lowercase text-slate-400">{language}</span>
           <button 
             onClick={handleCopy} 
             className="flex items-center gap-1.5 hover:text-white transition-all bg-slate-800/90 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300 cursor-pointer text-[11px]"
           >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
           </button>
         </div>
         <div className="overflow-x-auto p-3 text-[13px] sm:text-sm text-slate-100 font-mono">
            <code className={className} {...props}>{children}</code>
         </div>
      </div>
    );
  }
  
  return <code className={cn("bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-slate-200 dark:border-slate-700", className)} {...props}>{children}</code>;
};

// Custom Blockquote dengan Ikon Lucide (Bukan emoji)
const CustomBlockquote = ({ children, ...props }: any) => {
  return (
    <div className="my-3 p-3.5 rounded-r-xl rounded-l-md bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-500 border-t border-r border-b border-blue-100/80 dark:border-blue-900/40 shadow-2xs flex items-start gap-2.5 text-slate-800 dark:text-slate-200 leading-relaxed text-[14px]">
      <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5">
        <Lightbulb size={14} className="fill-blue-500/20" />
      </div>
      <div className="flex-1 [&>p]:m-0 font-medium text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
};

export function ChatMessage({ message, onEdit, onRetry, onStop, onOpenMediaScreen }: ChatMessageProps) {
  const { lang, t } = useLanguage();
  const isId = lang === 'id';
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.text);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const hasWebSources = !isUser && Boolean(message.sources && message.sources.length > 0);
  const isTavily = message.search_engine_used === 'tavily';

  const { thinking, content, isThinkingComplete } = parseThinking(message.text, message.thinking);

  // Perbaikan Tombol Copy: Hanya menyalin teks bersih dan tanda baca (tanpa elemen/markdown artifacts)
  const handleCopyCleanMessage = () => {
    const raw = isUser ? message.text : (content || message.text || '');
    const cleanText = extractCleanText(raw);
    if (!cleanText) return;

    navigator.clipboard.writeText(cleanText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleSave = () => {
    if (editValue.trim() !== '' && onEdit) {
      onEdit(message.id, editValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(message.text);
    setIsEditing(false);
  };

  // Cek apakah pesan adalah kartu error sistem
  const isErrorMessage = !isUser && (
    message.text.includes('Kendala Pemrosesan') ||
    message.text.includes('Server Processing Issue') ||
    message.text.includes('HTTP 405') ||
    message.text.includes('HTTP 404') ||
    message.text.includes('HTTP 400') ||
    message.text.includes('HTTP 429') ||
    message.text.includes('HTTP 500') ||
    message.text.includes('Status HTTP') ||
    message.text.includes('HTTP Status') ||
    message.text.includes('### Permintaan') ||
    message.text.includes('### Endpoint') ||
    message.text.includes('### Metode') ||
    message.text.includes('### Waktu Tunggu') ||
    message.text.includes('### Kendala') ||
    message.text.includes('### ⚠️')
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "py-3 sm:py-4 px-4 sm:px-8 w-full transition-colors flex",
        // KEBUTUHAN 5: User di KANAN (justify-end), AI di KIRI (justify-start)
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex flex-col relative",
        // User bubble max-w 75-85% di kanan; AI bubble max-w 85-95% di kiri
        isUser ? "items-end max-w-[85%] sm:max-w-[75%]" : "items-start max-w-[95%] sm:max-w-[85%]"
      )}>
        {/* Lampiran Media User jika ada */}
        {message.media && (
          <div className={cn(
            "mb-2.5 flex items-center gap-2 overflow-x-auto py-1 max-w-full flex-nowrap",
            isUser ? "justify-end" : "justify-start"
          )}>
            {(Array.isArray(message.media) ? message.media : [message.media]).map((item, idx) => {
              const isImg = item.type === 'image';
              const isVid = item.type === 'video';
              const isAud = item.type === 'audio';
              const isDoc = item.type === 'document' || item.type === 'file';

              return (
                <div 
                  key={idx} 
                  onClick={() => onOpenMediaScreen && onOpenMediaScreen(item)}
                  className="relative group inline-block max-w-[240px] sm:max-w-[280px] shrink-0 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {isImg && (
                    <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={item.url}
                        alt={item.name || 'Uploaded file'}
                        className="max-h-44 sm:max-h-52 w-auto object-contain rounded-t-xl mx-auto group-hover:scale-102 transition-transform duration-200"
                      />
                      <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                        <Maximize2 size={13} />
                      </div>
                    </div>
                  )}

                  {isVid && (
                    <div className="relative bg-black rounded-t-xl overflow-hidden">
                      <video
                        src={item.url}
                        controls
                        className="max-h-44 sm:max-h-52 w-full rounded-t-xl bg-black"
                      />
                    </div>
                  )}

                  {isAud && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Music size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name || 'Audio'}</p>
                        <p className="text-[10px] text-slate-500">{item.duration ? `${Math.round(item.duration)}s` : 'Audio'}</p>
                      </div>
                    </div>
                  )}

                  {isDoc && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2.5">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        item.name.toLowerCase().endsWith('.pdf') ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      )}>
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name || 'Dokumen'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {item.name.toLowerCase().endsWith('.pdf') && item.pageCount
                            ? `PDF • ${item.pageCount} Halaman`
                            : item.textContent 
                            ? `${item.textContent.length.toLocaleString()} karakter` 
                            : `${item.size ? (item.size/1024).toFixed(0) + ' KB' : 'Teks'}`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 px-2.5 py-1 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate max-w-[150px] font-medium">{item.name || 'File'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* KEBUTUHAN 5: CHAT BUBBLE USER (Di Kanan, Tanpa 'You' / Logo) */}
        {/* ------------------------------------------------------------- */}
        {isUser ? (
          <div className="flex flex-col items-end w-full">
            {isEditing ? (
              <div className="flex flex-col gap-2 w-full min-w-[260px] sm:min-w-[340px]">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-3 text-sm border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y min-h-[90px] shadow-sm"
                  placeholder={t.inputPlaceholder}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={handleCancel} 
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    onClick={handleSave} 
                    className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                  >
                    {isId ? 'Kirim Ulang' : 'Resubmit'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Bubble Teks User */}
                <div className="bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs text-[15px] leading-relaxed break-words font-normal">
                  <div className="markdown-body text-white leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* KEBUTUHAN 6: Tombol Copy Teks di Bawah Bubble Chat User */}
                <div className="mt-1.5 flex items-center gap-1.5 text-slate-400 text-xs">
                  <button
                    onClick={handleCopyCleanMessage}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[11px] font-medium"
                    title={isId ? 'Salin teks pesan Anda' : 'Copy your message text'}
                  >
                    {copiedMessage ? (
                      <>
                        <Check size={12} className="text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">{isId ? 'Tersalin!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>{isId ? 'Salin' : 'Copy'}</span>
                      </>
                    )}
                  </button>

                  {/* Tombol Edit User Message */}
                  {onEdit && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[11px] font-medium"
                      title={t.editMessage}
                    >
                      <Pencil size={12} />
                      <span>Edit</span>
                    </button>
                  )}

                  {/* Tombol Stop AI jika sedang proses */}
                  {onStop && (
                    <button
                      onClick={onStop}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-[11px] font-medium"
                      title={isId ? 'Hentikan respons' : 'Stop generating'}
                    >
                      <Power size={12} />
                      <span>{t.stop}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* KEBUTUHAN 5: RESPON AI (Di Kiri)                             */
          /* ------------------------------------------------------------- */
          <div className="flex flex-col items-start w-full">
            {/* Blok Penalaran / Thinking */}
            {thinking ? (
              <ThinkingBlock
                thinking={thinking}
                isThinkingComplete={isThinkingComplete}
                reasoningEffort={message.reasoningEffort}
              />
            ) : null}

            {/* KEBUTUHAN 9: Kartu Error Cantik dengan Ikon Lucide (Bukan Emoji) */}
            {isErrorMessage ? (
              <div className="w-full my-2 p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/90 dark:border-rose-900/50 shadow-xs text-rose-900 dark:text-rose-200">
                <div className="flex items-center gap-2.5 mb-2 font-bold text-sm text-rose-800 dark:text-rose-300">
                  <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300">
                    <AlertTriangle size={16} />
                  </div>
                  <span>{isId ? 'Kendala Pemrosesan Server' : 'Server Processing Issue'}</span>
                </div>
                <div className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 markdown-body">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      code: CodeBlock,
                      blockquote: CustomBlockquote
                    }}
                  >
                    {message.text.replace(/###\s*⚠️/g, '###').replace(/💡/g, '')}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              /* Konten Utama Pesan AI Biasa */
              content ? (
                <div className="w-full text-[15px] text-slate-900 dark:text-slate-100 leading-relaxed font-normal break-words">
                  <div className="markdown-body">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        code: CodeBlock,
                        blockquote: CustomBlockquote
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                !isThinkingComplete && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    <span>{isId ? 'Menyusun jawaban...' : 'Thinking and generating response...'}</span>
                  </div>
                )
              )
            )}

            {/* KEBUTUHAN 6, 7 & 8: Action Bar di Bawah Jawaban AI */}
            {(content || message.text) && (
              <div className="mt-2.5 pt-0.5 flex items-center gap-2 flex-wrap select-none">
                {/* KEBUTUHAN 8: Tombol Salin (Hanya Teks & Tanda Baca Bersih) */}
                <button
                  onClick={handleCopyCleanMessage}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-2xs",
                    copiedMessage
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                  )}
                  title={isId ? "Salin teks jawaban bersih" : "Copy clean response text"}
                >
                  {copiedMessage ? (
                    <>
                      <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {isId ? 'Tersalin!' : 'Copied!'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} className="text-slate-500 dark:text-slate-400" />
                      <span>{isId ? 'Salin' : 'Copy'}</span>
                    </>
                  )}
                </button>

                {/* KEBUTUHAN 7: Tombol Retry / Jawab Ulang di Kanan Tombol Copy */}
                {onRetry && (
                  <button
                    onClick={() => onRetry(message.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title={isId ? "Minta AI menjawab ulang pertanyaan ini" : "Regenerate AI response"}
                  >
                    <RotateCcw size={13} className="text-slate-500 dark:text-slate-400" />
                    <span>{isId ? 'Jawab Ulang' : 'Retry'}</span>
                  </button>
                )}

                {/* Tombol Lihat Sumber Web */}
                {hasWebSources && (
                  <button
                    onClick={() => setShowSourcesModal(true)}
                    className="btn-sources inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-2xs select-none cursor-pointer group"
                  >
                    <Globe size={13} className="text-blue-600 dark:text-blue-400 group-hover:rotate-12 transition-transform" />
                    <span>{t.viewSources} ({message.sources?.length || 0})</span>
                    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ml-1 ${
                      isTavily 
                        ? 'bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800' 
                        : 'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                    }`}>
                      {isTavily ? 'Tavily' : 'DuckDuckGo'}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Bottom Sheet Modal Sumber Informasi */}
            {hasWebSources && (
              <SourcesBottomSheet
                isOpen={showSourcesModal}
                onClose={() => setShowSourcesModal(false)}
                sources={message.sources}
                engine={message.search_engine_used}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ChatMessage;
