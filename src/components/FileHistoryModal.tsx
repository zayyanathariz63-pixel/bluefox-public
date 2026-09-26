import React, { useState, useEffect } from 'react';
import { 
  X, Trash2, Download, Eye, Image as ImageIcon, 
  Search, HardDrive, AlertTriangle, Check, ArrowDownToLine, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { 
  getAllLocalFiles, 
  deleteLocalFile, 
  clearAllLocalFiles, 
  LocalStoredFile 
} from '../lib/fileStorage';

interface FileHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile?: (file: LocalStoredFile) => void;
}

export function FileHistoryModal({ isOpen, onClose, onSelectFile }: FileHistoryModalProps) {
  const { lang, t } = useLanguage();
  const isId = lang === 'id';

  const [files, setFiles] = useState<LocalStoredFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<LocalStoredFile | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadFiles = () => {
    const loaded = getAllLocalFiles();
    setFiles(loaded);
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => loadFiles();
    window.addEventListener('bluefox_files_updated', handleUpdate);
    return () => window.removeEventListener('bluefox_files_updated', handleUpdate);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    deleteLocalFile(id);
    loadFiles();
    if (selectedPreview?.id === id) {
      setSelectedPreview(null);
    }
    showToast(isId ? 'File berhasil dihapus dari penyimpanan lokal' : 'File deleted from local storage');
  };

  const handleClearAll = () => {
    clearAllLocalFiles();
    loadFiles();
    setSelectedPreview(null);
    setShowClearConfirm(false);
    showToast(isId ? 'Semua lampiran lokal berhasil dibersihkan' : 'All local attachments cleared');
  };

  const handleDownload = (file: LocalStoredFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const a = document.createElement('a');
      a.href = file.base64;
      a.download = file.name || 'bluefox-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(isId ? 'Mengunduh file...' : 'Downloading file...');
    } catch {
      showToast(isId ? 'Gagal mengunduh file' : 'Failed to download file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleDateString(isId ? 'id-ID' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.type && f.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ImageIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isId ? 'Riwayat Lampiran & Gambar' : 'File History & Attachments'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {files.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isId 
                  ? 'Gambar disimpan aman di Local Storage perangkat Anda seperti di GPT.' 
                  : 'Images are stored safely in your device Local Storage just like in GPT.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                title={isId ? 'Bersihkan semua lampiran' : 'Clear all attachments'}
              >
                <Trash2 size={14} />
                <span>{isId ? 'Hapus Semua' : 'Clear All'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={t.close}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Storage Info */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isId ? 'Cari nama file lampiran...' : 'Search attachment name...'}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <HardDrive size={13} className="text-slate-400" />
              <span>{isId ? 'Total Penyimpanan:' : 'Storage Used:'}</span>
              <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                {formatFileSize(totalBytes)}
              </span>
            </div>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="sm:hidden text-rose-600 text-xs font-semibold cursor-pointer"
              >
                {isId ? 'Hapus Semua' : 'Clear All'}
              </button>
            )}
          </div>
        </div>

        {/* Modal Body: File Grid */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
          {files.length === 0 ? (
            <div className="h-full py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
                <ImageIcon size={32} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {isId ? 'Belum Ada Lampiran' : 'No Attachments Yet'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                {isId 
                  ? 'File atau gambar yang Anda unggah saat chatting dengan Bluefox AI akan otomatis tercatat dan tersimpan di sini.' 
                  : 'Files and images you upload while chatting with Bluefox AI will be automatically saved here.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {isId ? 'Mulai Percakapan' : 'Start Chatting'}
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {isId ? 'Tidak ada file yang sesuai dengan pencarian' : 'No files match your search'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {filteredFiles.map((file) => {
                const isImage = file.type?.startsWith('image') || file.base64?.startsWith('data:image');

                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedPreview(file)}
                    className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs hover:shadow-md cursor-pointer overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                      {isImage ? (
                        <img
                          src={file.base64}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon size={28} />
                          <span className="text-[10px] mt-1 font-mono uppercase">{file.type?.split('/')[1] || 'FILE'}</span>
                        </div>
                      )}

                      {/* Hover Overlay Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPreview(file);
                          }}
                          className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-colors cursor-pointer shadow-sm"
                          title={isId ? 'Lihat Ukuran Penuh' : 'View Full Size'}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownload(file, e)}
                          className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-colors cursor-pointer shadow-sm"
                          title={isId ? 'Unduh File' : 'Download File'}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(file.id, e)}
                          className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer shadow-sm"
                          title={isId ? 'Hapus File' : 'Delete File'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2.5 flex flex-col justify-between flex-1 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{formatDate(file.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>
            {isId ? 'Hanya disimpan di browser Anda' : 'Stored only in your browser storage'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>

      {/* Enlarged Single File Preview Dialog */}
      <AnimatePresence>
        {selectedPreview && (
          <div 
            className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setSelectedPreview(null)}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80">
                <div className="flex items-center gap-3 truncate pr-4">
                  <ImageIcon size={18} className="text-blue-400 shrink-0" />
                  <span className="font-semibold text-sm truncate">{selectedPreview.name}</span>
                  <span className="text-xs text-slate-400 font-mono shrink-0">
                    ({formatFileSize(selectedPreview.size)})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(selectedPreview)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={isId ? 'Unduh' : 'Download'}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedPreview.id)}
                    className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 transition-colors cursor-pointer"
                    title={isId ? 'Hapus' : 'Delete'}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedPreview(null)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Preview Image Content */}
              <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh] bg-black/40">
                <img
                  src={selectedPreview.base64}
                  alt={selectedPreview.name}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Preview Footer */}
              <div className="px-5 py-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{formatDate(selectedPreview.createdAt)}</span>
                <span className="font-mono text-[11px]">{selectedPreview.id}</span>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal to Clear All Files */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-70 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {isId ? 'Hapus Semua Lampiran?' : 'Clear All Attachments?'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {isId 
                    ? 'Tindakan ini akan menghapus semua gambar dan file dari Local Storage perangkat Anda. Data tidak dapat dikembalikan.' 
                    : 'This action will delete all image files from your device Local Storage. This cannot be undone.'}
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  {isId ? 'Ya, Hapus Semua' : 'Yes, Clear All'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-80 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl border border-slate-700 flex items-center gap-2 pointer-events-none"
          >
            <Check size={14} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileHistoryModal;
