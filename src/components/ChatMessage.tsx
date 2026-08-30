import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Bot, User, Pencil, Power, Copy, Check, Globe, Sparkles, Search, ExternalLink, Zap, AlertCircle, Maximize2, Music, FileText, Play } from 'lucide-react';
import { Message, MediaAttachment } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { SourcesBottomSheet } from './SourcesBottomSheet';
import { useLanguage } from '../lib/i18n';

interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string, newText: string) => void;
  onStop?: () => void;
  onOpenMediaScreen?: (media: MediaAttachment) => void;
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
      <div className="relative group rounded-xl overflow-hidden my-4 border border-slate-700 bg-[#0f172a] shadow-md">
         <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] text-xs text-slate-300 border-b border-slate-700 select-none">
           <span className="font-mono lowercase text-slate-400">{language}</span>
           <button 
             onClick={handleCopy} 
             className="flex items-center gap-1.5 hover:text-white transition-all bg-slate-800/90 hover:bg-slate-700 px-2.5 py-1 rounded-md text-slate-300 cursor-pointer"
           >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
           </button>
         </div>
         <div className="overflow-x-auto p-4 text-[13px] sm:text-sm text-slate-100 font-mono">
            <code className={className} {...props}>{children}</code>
         </div>
      </div>
    );
  }
  
  return <code className={cn("bg-slate-100 text-blue-600 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-slate-200", className)} {...props}>{children}</code>;
};

// Custom Blockquote with blue lightning bolt for important information
const CustomBlockquote = ({ children, ...props }: any) => {
  return (
    <div className="my-3 p-3.5 rounded-r-xl rounded-l-md bg-blue-50/70 border-l-4 border-blue-500 border-t border-r border-b border-blue-100/80 shadow-xs flex items-start gap-2.5 text-slate-800 leading-relaxed text-[14px]">
      <div className="p-1 rounded-md bg-blue-100 text-blue-600 shrink-0 mt-0.5">
        <Zap size={14} className="fill-blue-500" />
      </div>
      <div className="flex-1 [&>p]:m-0 font-medium text-slate-800">
        {children}
      </div>
    </div>
  );
};

export function ChatMessage({ message, onEdit, onStop, onOpenMediaScreen }: ChatMessageProps) {
  const { lang, t } = useLanguage();
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.text);
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  const hasWebSources = !isUser && Boolean(message.sources && message.sources.length > 0);
  const isTavily = message.search_engine_used === 'tavily';

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

  const handleMessageTap = () => {
    if (isUser && onStop) {
      onStop();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "py-4 sm:py-5 px-4 sm:px-8 flex w-full border-b border-slate-100 transition-colors",
        isUser ? "bg-slate-50/60" : "bg-white"
      )}
    >
      <div className="max-w-3xl mx-auto flex w-full gap-3 sm:gap-4 relative">
        {/* Only show avatar for user, omit bot profile mascot completely */}
        {isUser ? (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm bg-slate-900 text-white">
            <User size={15} />
          </div>
        ) : null}

        <div className={cn("flex-1 w-0 min-w-0", !isUser && "pl-1 sm:pl-2")}>
          {isUser && (
            <div className="flex items-center mb-1.5 h-5 justify-between">
              <span className="font-semibold text-xs text-slate-500">
                {lang === 'id' ? 'Anda' : 'You'}
              </span>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-200/60 cursor-pointer"
                    title={t('editMessage')}
                  >
                    <Pencil size={13} />
                  </button>
                  {onStop && (
                    <button
                      onClick={onStop}
                      className="text-rose-500 hover:text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded transition-all cursor-pointer hover:bg-rose-100"
                      title={lang === 'id' ? "Hentikan AI" : "Stop AI"}
                    >
                      <Power size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          
          {message.media && (
            <div className="mb-3 flex items-center justify-start gap-2.5 overflow-x-auto py-1 max-w-full flex-nowrap">
              {(Array.isArray(message.media) ? message.media : [message.media]).map((item, idx) => {
                const isImg = item.type === 'image';
                const isVid = item.type === 'video';
                const isAud = item.type === 'audio';
                const isDoc = item.type === 'document' || item.type === 'file';

                return (
                  <div 
                    key={idx} 
                    onClick={() => onOpenMediaScreen && onOpenMediaScreen(item)}
                    className="relative group inline-block max-w-[260px] sm:max-w-xs shrink-0 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                  >
                    {isImg && (
                      <div className="relative overflow-hidden bg-slate-100">
                        <img
                          src={item.url}
                          alt={item.name || 'Uploaded file'}
                          className="max-h-48 sm:max-h-56 w-auto object-contain rounded-t-xl mx-auto group-hover:scale-102 transition-transform duration-200"
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
                          className="max-h-48 sm:max-h-56 w-full rounded-t-xl bg-black"
                        />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenMediaScreen) onOpenMediaScreen(item);
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white hover:bg-blue-600 transition-all backdrop-blur-xs cursor-pointer"
                          title="Layar Penuh"
                        >
                          <Maximize2 size={13} />
                        </button>
                      </div>
                    )}

                    {isAud && (
                      <div className="p-3 bg-slate-50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Music size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{item.name || 'Audio'}</p>
                          <p className="text-[10px] text-slate-500">{item.duration ? `${Math.round(item.duration)}s` : 'Audio'}</p>
                        </div>
                        <div className="p-1 text-slate-400 group-hover:text-blue-600">
                          <Maximize2 size={14} />
                        </div>
                      </div>
                    )}

                    {isDoc && (
                      <div className="p-3 bg-slate-50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{item.name || 'Dokumen'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {item.textContent ? `${item.textContent.length} karakter` : `${item.size ? (item.size/1024).toFixed(0) + ' KB' : 'Teks'}`}
                          </p>
                        </div>
                        <div className="p-1 text-slate-400 group-hover:text-blue-600">
                          <Maximize2 size={14} />
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 px-2.5 py-1.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="truncate max-w-[170px] font-medium">{item.name || (isVid ? 'Video' : isAud ? 'Audio' : isDoc ? 'Dokumen' : 'Foto')}</span>
                      {isVid && item.duration !== undefined && (
                        <span className="text-blue-600 font-mono text-[10px] shrink-0 font-medium">
                          {Math.round(item.duration)}s
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2.5 mt-2 w-full">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-white text-slate-900 rounded-xl p-3 text-sm border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[100px] shadow-sm"
                placeholder={t('inputPlaceholder')}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={handleCancel} 
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  {lang === 'id' ? 'Kirim & Perbarui' : 'Save & Resubmit'}
                </button>
              </div>
            </div>
          ) : (
            isUser ? (
              <div 
                onClick={handleMessageTap}
                className={cn(
                  "markdown-body text-slate-900 leading-relaxed text-[15px] transition-colors",
                  onStop && "cursor-pointer"
                )}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    code: CodeBlock,
                    blockquote: CustomBlockquote
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-start w-full">
                <div className="markdown-body text-[15px] text-slate-900 w-full leading-relaxed">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      code: CodeBlock,
                      blockquote: CustomBlockquote
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                </div>

                {/* Tombol Lihat Sumber di Chat Bubble */}
                {hasWebSources && (
                  <div className="mt-3 pt-1 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowSourcesModal(true)}
                      className="btn-sources inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-xs select-none cursor-pointer group"
                    >
                      <Globe size={13} className="text-blue-600 group-hover:rotate-12 transition-transform" />
                      <span>{t('viewSources')} ({message.sources?.length || 0})</span>
                      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ml-1 ${
                        isTavily 
                          ? 'bg-blue-100 text-blue-800 border-blue-200' 
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {isTavily ? 'Tavily' : 'DuckDuckGo'}
                      </span>
                    </button>
                  </div>
                )}

                {/* Bottom Sheet Modal Setengah Layar */}
                {hasWebSources && (
                  <SourcesBottomSheet
                    isOpen={showSourcesModal}
                    onClose={() => setShowSourcesModal(false)}
                    sources={message.sources}
                    engine={message.search_engine_used}
                  />
                )}
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}

