import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Bot, User, Pencil, Power, Copy, Check, Globe, Sparkles, Search, ExternalLink } from 'lucide-react';
import { Message } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { SourcesBottomSheet } from './SourcesBottomSheet';
import { useLanguage } from '../lib/i18n';

interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string, newText: string) => void;
  onStop?: () => void;
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
      <div className="relative group rounded-xl overflow-hidden my-4 border border-slate-700 dark:border-slate-800 bg-[#0f172a] shadow-sm">
         <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] text-xs text-slate-300 border-b border-slate-700 select-none">
           <span className="font-mono lowercase text-slate-400">{language}</span>
           <button 
             onClick={handleCopy} 
             className="flex items-center gap-1.5 hover:text-white transition-all bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 rounded-md text-slate-300"
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
  
  return <code className={cn("bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-slate-200 dark:border-slate-700", className)} {...props}>{children}</code>;
};

export function ChatMessage({ message, onEdit, onStop }: ChatMessageProps) {
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
        "py-4 sm:py-5 px-4 sm:px-8 flex w-full border-b border-slate-100/80 dark:border-slate-800/40",
        isUser ? "bg-slate-50/50 dark:bg-slate-900/20" : "bg-white dark:bg-transparent"
      )}
    >
      <div className="max-w-3xl mx-auto flex w-full gap-3 sm:gap-4 relative">
        <div className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
          isUser ? "bg-slate-900 dark:bg-slate-800 text-white" : "bg-blue-600 text-white"
        )}>
          {isUser ? <User size={15} /> : <Bot size={15} />}
        </div>
        <div className="flex-1 w-0 pt-0.5 min-w-0">
          <div className="flex items-center mb-1 h-5 justify-between">
            <span className="font-semibold text-xs text-slate-500 dark:text-slate-400">
              {isUser ? (lang === 'id' ? 'Anda' : 'You') : 'Bluefox AI'}
            </span>
            {isUser && !isEditing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded"
                  title={t('editMessage')}
                >
                  <Pencil size={13} />
                </button>
                {onStop && (
                  <button
                    onClick={onStop}
                    className="text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 p-1 rounded transition-all cursor-pointer"
                    title={lang === 'id' ? "Hentikan AI" : "Stop AI"}
                  >
                    <Power size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {message.media && (
            <div className="mb-3 flex items-center justify-start gap-2.5 overflow-x-auto py-1 max-w-full flex-nowrap">
              {(Array.isArray(message.media) ? message.media : [message.media]).map((item, idx) => (
                <div key={idx} className="relative inline-block max-w-[260px] sm:max-w-xs shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-sm">
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={item.name || 'Uploaded file'}
                      className="max-h-48 sm:max-h-56 w-auto object-contain rounded-t-xl mx-auto"
                    />
                  ) : (
                    <video
                      src={item.url}
                      controls
                      className="max-h-48 sm:max-h-56 w-full rounded-t-xl bg-black"
                    />
                  )}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 px-2.5 py-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate max-w-[180px]">{item.name || (item.type === 'video' ? 'Video' : 'Photo')}</span>
                    {item.type === 'video' && item.duration !== undefined && (
                      <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px] shrink-0 font-medium">
                        {Math.round(item.duration)}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2.5 mt-2 w-full">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl p-3 text-sm border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[100px] shadow-sm"
                placeholder={t('inputPlaceholder')}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={handleCancel} 
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
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
                  "markdown-body text-slate-900 dark:text-slate-100 leading-relaxed text-[15px] transition-colors",
                  onStop && "cursor-pointer"
                )}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    code: CodeBlock
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-start w-full">
                <div className="markdown-body text-[15px] text-slate-900 dark:text-slate-100 w-full">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      code: CodeBlock
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
                      className="btn-sources inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-sm select-none cursor-pointer group"
                    >
                      <Globe size={13} className="text-blue-600 dark:text-blue-400 group-hover:rotate-12 transition-transform" />
                      <span>{t('viewSources')} ({message.sources?.length || 0})</span>
                      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ml-1 ${
                        isTavily 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-700' 
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-700'
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

