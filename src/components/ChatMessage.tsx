import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Bot, User, Pencil, Power, Copy, Check } from 'lucide-react';
import { Message } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

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
      <div className="relative group rounded-xl overflow-hidden my-4 border border-gray-800 bg-[#0d1117] shadow-sm">
         <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] text-xs text-gray-400 border-b border-gray-800 select-none">
           <span className="font-mono lowercase">{language}</span>
           <button 
             onClick={handleCopy} 
             className="flex items-center gap-1.5 hover:text-white transition-all bg-gray-800/50 hover:bg-gray-700 px-2 py-1 rounded-md"
           >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy code</span>
                </>
              )}
           </button>
         </div>
         <div className="overflow-x-auto p-4 text-[13px] sm:text-sm">
            <code className={className} {...props}>{children}</code>
         </div>
      </div>
    );
  }
  
  return <code className={cn("bg-gray-800/60 text-blue-200 px-1.5 py-0.5 rounded-md text-[0.9em] font-mono", className)} {...props}>{children}</code>;
};

export function ChatMessage({ message, onEdit, onStop }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.text);

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "py-4 sm:py-6 px-4 sm:px-8 flex w-full group",
        isUser ? "bg-black" : "bg-gray-900/30",
        isEditing && "bg-gray-900/20"
      )}
    >
      <div className="max-w-3xl mx-auto flex w-full gap-4 sm:gap-6 relative">
        <div className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 sm:mt-1",
          isUser ? "bg-blue-600/20 text-blue-500" : "bg-blue-600 text-white"
        )}>
          {isUser ? <User size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Bot size={16} className="sm:w-[18px] sm:h-[18px]" />}
        </div>
        <div className="flex-1 w-0 pt-0.5 sm:pt-1 min-w-0">
          <div className="flex items-center mb-1 h-5">
            <span className="font-medium text-xs sm:text-sm text-gray-400">
              {isUser ? 'You' : 'tmpa chat'}
            </span>
            {isUser && !isEditing && (
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-500 hover:text-gray-300 md:opacity-0 opacity-100 md:group-hover:opacity-100 transition-opacity"
                  title="Edit message"
                >
                  <Pencil size={14} />
                </button>
                {onStop && (
                  <button
                    onClick={onStop}
                    className="text-red-500 hover:text-red-400 bg-red-950/20 border border-red-500/40 p-1 rounded-md md:opacity-0 opacity-100 md:group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white"
                    title="Hentikan AI (Restart Respon)"
                  >
                    <Power size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {message.media && (
            <div className="mb-3 flex flex-wrap gap-2.5">
              {(Array.isArray(message.media) ? message.media : [message.media]).map((item, idx) => (
                <div key={idx} className="relative inline-block max-w-sm rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={item.name || 'Uploaded photo'}
                      className="max-h-60 sm:max-h-72 w-auto object-contain rounded-t-xl"
                    />
                  ) : (
                    <video
                      src={item.url}
                      controls
                      className="max-h-60 sm:max-h-72 w-full rounded-t-xl bg-black"
                    />
                  )}
                  <div className="text-[11px] text-gray-400 px-2.5 py-1 bg-gray-900/90 border-t border-gray-800 flex items-center justify-between gap-2">
                    <span className="truncate max-w-[180px]">{item.name || (item.type === 'video' ? 'Video' : 'Foto')}</span>
                    {item.type === 'video' && item.duration !== undefined && (
                      <span className="text-cyan-400 font-mono text-[10px] shrink-0">
                        {Math.round(item.duration)}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-3 mt-2 w-full pr-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-gray-950 text-gray-100 rounded-xl p-3 text-[15px] sm:text-base border border-gray-800 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 resize-y min-h-[120px] transition-all"
                placeholder="Edit pesan Anda..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={handleCancel} 
                  className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors border border-gray-800"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
                >
                  Kirim & Perbarui
                </button>
              </div>
            </div>
          ) : (
            isUser ? (
              <div 
                onClick={handleMessageTap}
                className={cn(
                  "markdown-body text-gray-200 leading-relaxed font-sans text-[15px] sm:text-base transition-colors",
                  onStop && "cursor-pointer hover:text-gray-300"
                )}
                title={onStop ? "Tekan untuk menghentikan respons AI" : undefined}
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
              <div className="markdown-body text-[15px] sm:text-base">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    code: CodeBlock
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}
