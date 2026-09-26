import { useState, useEffect } from 'react';

export type Language = 'id' | 'en';

export const translations = {
  id: {
    // General & Nav
    appName: "Bluefox AI",
    settings: "Pengaturan",
    settingsTitle: "Setelan TMPA",
    back: "Kembali",
    backToChat: "Kembali ke Chat",
    save: "Simpan",
    cancel: "Batal",
    delete: "Hapus",
    close: "Tutup",
    active: "Aktif",
    inactive: "Nonaktif",
    connected: "Terhubung",
    disconnected: "Terputus",
    loading: "Memuat...",
    newChat: "Chat Baru",
    chatHistory: "Riwayat Chat",
    searchHistory: "Cari riwayat chat...",
    noHistory: "Belum ada riwayat percakapan.",
    mainWebsite: "Web Utama (TMPA)",
    store: "Store",
    mcpIntegrations: "Integrasi Platform (MCP)",
    fileHistory: "File History",
    fileHistoryDesc: "Galeri berkas dan gambar lampiran yang tersimpan di memori perangkat",
    searchFiles: "Cari file lampiran...",
    allFiles: "Semua Berkas",
    images: "Gambar",
    documents: "Dokumen",
    noFilesYet: "Belum ada berkas lampiran yang tersimpan di memori lokal.",
    clearAllFiles: "Bersihkan Semua Berkas",
    confirmClearFiles: "Hapus semua file lampiran lokal di perangkat ini?",
    attachToChat: "Kirim ke Chat",
    fileDeleted: "File berhasil dihapus dari memori lokal.",
    allFilesCleared: "Semua file lokal berhasil dibersihkan.",
    logout: "Keluar Akun",
    plan: "Paket",
    language: "Bahasa",
    languageDesc: "Pilih bahasa tampilan antarmuka website (Indonesia / English)",
    selectLanguage: "Pilih Bahasa",
    indonesian: "Bahasa Indonesia",
    english: "English (US)",
    languageChanged: "Bahasa berhasil diubah ke Bahasa Indonesia!",

    // Sidebar & Chat Context Menu
    chatActions: "Kelola Percakapan",
    pinChat: "Sematkan Chat (Pin)",
    unpinChat: "Lepas Sematan (Unpin)",
    deleteChat: "Hapus Chat",
    confirmDeleteChat: "Apakah Anda yakin ingin menghapus percakapan ini?",
    chatPinned: "Chat berhasil disematkan ke paling atas!",
    chatUnpinned: "Sematan chat berhasil dilepas.",
    chatDeleted: "Percakapan berhasil dihapus.",
    holdToManage: "Tahan 1 detik untuk opsi pin & hapus",

    // Chat Interface
    emptyGreeting: "Apa yang bisa saya bantu hari ini?",
    emptySubGreeting: "Saya asisten AI profesional untuk bertukar ide, menulis kode, memecahkan masalah, dan tugas lainnya.",
    exportChat: "Ekspor Chat",
    exportMarkdown: "Format Markdown (.md)",
    exportJson: "Format JSON (.json)",
    chatExported: "Percakapan berhasil diekspor!",
    clearChat: "Bersihkan Chat",
    confirmClearChat: "Hapus seluruh pesan dalam sesi ini?",
    visionActive: "Vision Aktif",
    visionLockedAlert: "Mode Vision sedang aktif: Model dikunci ke Bluefox Pro (agnes-2.5-flash). Nonaktifkan Vision jika ingin memilih model lain.",
    inputPlaceholder: "Tanyakan apa saja atau ketik @ untuk perintah...",
    inputPlaceholderVision: "Unggah gambar/video atau tanyakan apa saja...",
    send: "Kirim",
    stop: "Hentikan",
    editMessage: "Edit pesan",
    copyMessage: "Salin teks",
    copied: "Tersalin!",
    regenerate: "Buat ulang",
    retry: "Jawab Ulang",
    resubmit: "Kirim Ulang",
    copy: "Salin",
    copyYourMessage: "Salin teks pesan Anda",
    copyCleanResponse: "Salin teks jawaban bersih",
    retryPrompt: "Minta AI menjawab ulang pertanyaan ini",
    stopGenerating: "Hentikan respons",
    thinkingGenerating: "Menyusun jawaban...",
    serverProcessingIssue: "Kendala Pemrosesan Server",
    suggestedSolution: "Saran Solusi:",
    httpStatus: "Status HTTP",
    technicalDetails: "Detail Teknis",
    associatedFiles: "Berkas Terkait",
    copyUuid: "Salin UUID",
    uuidCopied: "ID Pengguna berhasil disalin!",
    comingSoon: "Segera Hadir",
    userProfile: "Profil Pengguna",
    userId: "ID Pengguna",
    userTier: "Paket Pengguna",
    you: "Anda",
    assistant: "Bluefox AI",
    viewSources: "Lihat Sumber",
    sourcesTitle: "Sumber Informasi",
    openWebsite: "Buka Website",
    noSourcesAvailable: "Tidak ada data sumber tersedia.",
    verifiedSource: "Sumber Terverifikasi",
    searchEngineUsed: "Mesin Pencari",

    // Model Selector
    modelSelectTitle: "Pilih Model Kecerdasan Buatan",
    modelSelectSubtitle: "Ganti model bahasa sesuai kebutuhan analisis, coding, atau tugas sehari-hari Anda.",
    visionModeTitle: "Pengaturan Mode Vision",
    visionModeSubtitle: "Aktifkan analisis gambar dan video multimedia canggih menggunakan Agnes AI.",
    enableVision: "Aktifkan Vision",
    disableVision: "Nonaktifkan Vision",

    // Settings Menu Items
    accountInfo: "Info Akun",
    accountInfoDesc: "Kelola email, ID profil, dan foto profil Anda",
    activity: "Aktivitas",
    activityDesc: "Riwayat chat detail berserta penanda waktu pertama dibuat",
    usageLimits: "Batas Penggunaan",
    usageLimitsDesc: "Kuota batas model dan persentase penggunaan sisa",
    personalization: "Personalisasi",
    personalizationDesc: "Atur instruksi kustom Anda dan lihat aplikasi terhubung",
    customApi: "Custom API",
    customApiDesc: "Kelola hingga 10 API kustom (Limit: 10 req/menit & 50 req/hari)",
    deleteData: "Delete",
    deleteDataDesc: "Hapus semua media, semua sesi chat, atau hapus akun pengguna",
    connectedApps: "Aplikasi / Web Terhubung",
    connectedAppsDesc: "Gunakan produk kami secara lancar dan terintegrasi",

    // Account Subview
    username: "Nama Pengguna",
    registeredEmail: "Email Terdaftar",
    identifierId: "ID Pengenal",
    changePhotoDesc: "Klik gambar di atas untuk mengganti foto profil Anda",
    photoUpdated: "Foto profil berhasil diperbarui!",

    // Activity Subview
    chatHistoryDetail: "Riwayat Percakapan Detail",
    chatHistoryDetailDesc: "Melihat penanda pertama kali Anda membuat chat dengan asisten.",
    created: "Dibuat",
    updated: "Diperbarui",

    // Usage Subview
    usageTitle: "Batas Penggunaan Model Gabungan",
    usageDesc: "Persentase gabungan penggunaan seluruh model yang akan meningkat setelah setiap permintaan, hingga mencapai 100%.",
    totalQuota: "Kuota Keseluruhan",
    totalQuotaDesc: "Dihitung berdasarkan model yang digunakan dan waktu real-time",
    resetQuota: "Reset Kuota (Dev)",
    fiveHourLimit: "Batas 5 Jam",
    weeklyLimit: "Batas Mingguan",
    used: "Terpakai",
    remaining: "Sisa",
    usageReachedAlert: "Anda telah mencapai batas penggunaan. Semua model sementara dinonaktifkan.",
    modelConsumption: "Konsumsi Kuota Tiap Model",

    // Personalization Subview
    additionalSettings: "Pengaturan Tambahan",
    additionalSettingsDesc: "Sesuaikan gaya interaksi AI yang bekerja di belakang layar obrolan Anda.",
    customInstructionLabel: "Instruksi Kustom Sistem AI",
    customInstructionPlaceholder: "Contoh: 'Berbicaralah dengan nada santai', 'Selalu gunakan bahasa ramah kepada saya', dll...",
    customInstructionNotice: "Peraturan bawaan sistem kami akan tetap diterapkan secara ketat demi keamanan, namun petunjuk tambahan dari Anda akan disisipkan langsung setelah peraturan tersebut.",
    
    // Connected Apps & MCP Inside Personalization
    mcpHubTitle: "Integrasi Platform (MCP) & Layanan Terhubung",
    mcpHubDesc: "Hubungkan model AI dengan tool pihak ketiga seperti Supabase, Google Workspace, GitHub, Vercel, Figma, Airtable, dan Canva.",
    openMcpIntegrations: "Buka Pusat Integrasi Platform (MCP)",
    connectedStatusBadge: "11 Platform Tersedia",
    mcpIntroText: "Ekosistem Model Context Protocol (MCP) memungkinkan agen AI mengeksekusi aksi nyata, membaca basis data, dan memanipulasi file kerja Anda secara aman.",

    // Custom API Subview
    addNewApi: "Tambah API Baru",
    closeForm: "Tutup Formulir",
    apiNameLabel: "Nama API / Label",
    providerLabel: "Provider / Layanan",
    apiKeyLabel: "API Key / Token",
    modelIdLabel: "Model ID",
    saveApi: "Simpan API",
    activeUsed: "Aktif Digunakan",
    clickToActivate: "Klik Aktifkan",
    copiedKey: "API Key berhasil disalin!",
    apiDeleted: "API berhasil dihapus.",
    maxApiReached: "Maksimal 10 API telah tercapai!"
  },
  en: {
    // General & Nav
    appName: "Bluefox AI",
    settings: "Settings",
    settingsTitle: "TMPA Settings",
    back: "Back",
    backToChat: "Back to Chat",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    close: "Close",
    active: "Active",
    inactive: "Inactive",
    connected: "Connected",
    disconnected: "Disconnected",
    loading: "Loading...",
    newChat: "New Chat",
    chatHistory: "Chat History",
    searchHistory: "Search chat history...",
    noHistory: "No conversation history yet.",
    mainWebsite: "Main Website (TMPA)",
    store: "Store",
    mcpIntegrations: "Platform Integrations (MCP)",
    fileHistory: "File History",
    fileHistoryDesc: "Gallery of files and images stored in local storage",
    searchFiles: "Search attachments...",
    allFiles: "All Files",
    images: "Images",
    documents: "Documents",
    noFilesYet: "No file attachments stored in local storage yet.",
    clearAllFiles: "Clear All Files",
    confirmClearFiles: "Delete all local file attachments on this device?",
    attachToChat: "Attach to Chat",
    fileDeleted: "File deleted from local storage.",
    allFilesCleared: "All local files have been cleared.",
    logout: "Log Out",
    plan: "Plan",
    language: "Language",
    languageDesc: "Choose the website interface language (English / Indonesia)",
    selectLanguage: "Select Language",
    indonesian: "Bahasa Indonesia (Indonesian)",
    english: "English (US)",
    languageChanged: "Language successfully switched to English!",

    // Sidebar & Chat Context Menu
    chatActions: "Manage Conversation",
    pinChat: "Pin to Top",
    unpinChat: "Unpin Chat",
    deleteChat: "Delete Chat",
    confirmDeleteChat: "Are you sure you want to delete this conversation?",
    chatPinned: "Chat successfully pinned to top!",
    chatUnpinned: "Chat unpinned successfully.",
    chatDeleted: "Conversation deleted.",
    holdToManage: "Hold for 1 second for pin & delete options",

    // Chat Interface
    emptyGreeting: "How can I help you today?",
    emptySubGreeting: "I am a professional AI assistant here to brainstorm, write code, solve problems, and complete tasks.",
    exportChat: "Export Chat",
    exportMarkdown: "Markdown format (.md)",
    exportJson: "JSON format (.json)",
    chatExported: "Chat successfully exported!",
    clearChat: "Clear Chat",
    confirmClearChat: "Delete all messages in this conversation session?",
    visionActive: "Vision Active",
    visionLockedAlert: "Vision mode is active: Model is locked to Bluefox Pro (agnes-2.5-flash). Disable Vision to select another model.",
    inputPlaceholder: "Ask AI anything or type @ for commands...",
    inputPlaceholderVision: "Upload image/video or ask anything...",
    send: "Send",
    stop: "Stop",
    editMessage: "Edit message",
    copyMessage: "Copy text",
    copied: "Copied!",
    regenerate: "Regenerate response",
    retry: "Retry",
    resubmit: "Resubmit",
    copy: "Copy",
    copyYourMessage: "Copy your message text",
    copyCleanResponse: "Copy clean response text",
    retryPrompt: "Regenerate AI response",
    stopGenerating: "Stop generating",
    thinkingGenerating: "Thinking and generating response...",
    serverProcessingIssue: "Server Processing Issue",
    suggestedSolution: "Suggested Solution:",
    httpStatus: "HTTP Status",
    technicalDetails: "Technical Details",
    associatedFiles: "Associated Files",
    copyUuid: "Copy UUID",
    uuidCopied: "User ID copied to clipboard!",
    comingSoon: "Coming Soon",
    userProfile: "User Profile",
    userId: "User ID",
    userTier: "User Plan",
    you: "You",
    assistant: "Bluefox AI",
    viewSources: "View Sources",
    sourcesTitle: "Information Sources",
    openWebsite: "Open Website",
    noSourcesAvailable: "No source data available.",
    verifiedSource: "Verified Source",
    searchEngineUsed: "Search Engine",

    // Model Selector
    modelSelectTitle: "Select AI Model",
    modelSelectSubtitle: "Switch language models according to your analytical, coding, or daily productivity needs.",
    visionModeTitle: "Vision Mode Settings",
    visionModeSubtitle: "Enable advanced multimedia image and video understanding using Agnes AI.",
    enableVision: "Enable Vision",
    disableVision: "Disable Vision",

    // Settings Menu Items
    accountInfo: "Account Info",
    accountInfoDesc: "Manage your email, profile ID, and avatar photo",
    activity: "Activity",
    activityDesc: "Detailed conversation history with creation timestamps",
    usageLimits: "Usage Limits",
    usageLimitsDesc: "Model quota limits and remaining usage percentage",
    personalization: "Personalization",
    personalizationDesc: "Configure custom system instructions and connected apps",
    customApi: "Custom API",
    customApiDesc: "Manage up to 10 custom APIs (Limit: 10 req/min & 50 req/day)",
    deleteData: "Delete",
    deleteDataDesc: "Clear all media, delete all chat sessions, or delete user account",
    connectedApps: "Connected Apps & Websites",
    connectedAppsDesc: "Seamlessly integrate and link platform services",

    // Account Subview
    username: "Username",
    registeredEmail: "Registered Email",
    identifierId: "Identifier ID",
    changePhotoDesc: "Click the image above to change your profile picture",
    photoUpdated: "Profile picture updated successfully!",

    // Activity Subview
    chatHistoryDetail: "Detailed Chat History",
    chatHistoryDetailDesc: "View timestamps and details of conversations with the assistant.",
    created: "Created",
    updated: "Updated",

    // Usage Subview
    usageTitle: "Combined Model Usage Limit",
    usageDesc: "Combined usage percentage of all models which increases with every request up to 100%.",
    totalQuota: "Overall Quota",
    totalQuotaDesc: "Calculated dynamically based on the model used and real-time interval",
    resetQuota: "Reset Quota (Dev)",
    fiveHourLimit: "5-Hour Window Limit",
    weeklyLimit: "Weekly Limit",
    used: "Used",
    remaining: "Remaining",
    usageReachedAlert: "You have reached your usage limit. All models are temporarily paused.",
    modelConsumption: "Quota Consumption per Model",

    // Personalization Subview
    additionalSettings: "Additional Configuration",
    additionalSettingsDesc: "Customize how the AI responds and behaves behind the scenes.",
    customInstructionLabel: "Custom AI System Instructions",
    customInstructionPlaceholder: "e.g. 'Speak in a concise professional tone', 'Always format code in TypeScript', etc...",
    customInstructionNotice: "Our default security and safety guidelines will still strictly apply, with your additional instructions appended directly.",

    // Connected Apps & MCP Inside Personalization
    mcpHubTitle: "Platform Integrations (MCP) & Connected Services",
    mcpHubDesc: "Connect AI models with 3rd-party platforms like Supabase, Google Workspace, GitHub, Vercel, Figma, Airtable, and Canva.",
    openMcpIntegrations: "Open Platform Integrations (MCP)",
    connectedStatusBadge: "11 Platforms Available",
    mcpIntroText: "Model Context Protocol (MCP) enables your AI assistant to execute real actions, query databases, and manage your cloud tools securely.",

    // Custom API Subview
    addNewApi: "Add New API",
    closeForm: "Close Form",
    apiNameLabel: "API Name / Label",
    providerLabel: "Provider / Service",
    apiKeyLabel: "API Key / Token",
    modelIdLabel: "Model ID",
    saveApi: "Save API",
    activeUsed: "Active & In Use",
    clickToActivate: "Click to Activate",
    copiedKey: "API Key copied to clipboard!",
    apiDeleted: "API deleted successfully.",
    maxApiReached: "Maximum 10 APIs reached!"
  }
};

export function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem('tmpa_language');
    if (saved === 'en' || saved === 'id') return saved;
  } catch {}
  return 'id';
}

export function setSavedLanguage(lang: Language) {
  try {
    localStorage.setItem('tmpa_language', lang);
    window.dispatchEvent(new CustomEvent('tmpa_language_changed', { detail: lang }));
  } catch {}
}

export function useLanguage() {
  const [lang, setLang] = useState<Language>(getSavedLanguage);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) {
        setLang(customEvent.detail);
      } else {
        setLang(getSavedLanguage());
      }
    };
    window.addEventListener('tmpa_language_changed', handler);
    return () => window.removeEventListener('tmpa_language_changed', handler);
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    setSavedLanguage(newLang);
  };

  const currentDict = translations[lang] || translations.id;
  const tFunc = ((key: keyof typeof translations.id): string => {
    return (currentDict as any)[key] || (translations.id as any)[key] || key;
  }) as typeof currentDict & ((key: keyof typeof translations.id) => string);

  Object.assign(tFunc, currentDict);

  return { lang, changeLanguage, t: tFunc };
}
