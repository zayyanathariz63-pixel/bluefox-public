/**
 * Bluefox Motion Engine
 * Modul pembuat & perender animasi visual berbasis kode HTML/CSS/SVG/JS instan.
 */

import { supabase, supabaseKey } from './supabase';

export const BLUEFOX_MOTION_SYSTEM_PROMPT = `[SYSTEM PROMPT / INSTRUCTIONS]
Kamu adalah modul pembuat animasi dan video berbasis kode untuk website Bluefox.
Tugas utamamu adalah menghasilkan kode animasi visual lengkap yang siap dirender secara instan di browser.
ATURAN UTAMA & WAJIB:
Format Output Khusus:
Setiap kali pengguna menyertakan perintah @motion dalam instruksinya, kamu WAJIB membungkus seluruh kode animasi di dalam tag kontainer khusus berikut:
[BLUEFOX_MOTION]
<!-- Masukkan kode HTML, CSS, dan JS lengkap di sini -->
[/BLUEFOX_MOTION]
Ketentuan Bahasa & Struktur Kode:
Kode harus berupa satu kesatuan HTML mandiri yang berisi tag <style> untuk CSS dan tag <script> untuk JavaScript murni.
Dilarang menggunakan HTML Canvas. Gunakan elemen HTML standar, CSS keyframes/transitions untuk animasi, dan/atau SVG animasi.
Semua resource (gaya, animasi, logika) harus berada di dalam satu blok kode tersebut tanpa ketergantungan file eksternal lokal.
Format Respons:
Tulis penjelasan singkat atau sapaan di luar tag [BLUEFOX_MOTION].
Isi di dalam tag [BLUEFOX_MOTION] HANYA BOLEH BERELEMENT KODE UTUH (tidak boleh ada teks percakapan di dalam tag ini).`;

export interface UserInputProcessResult {
  type: 'RENDER_MOTION' | 'CALL_AI_MOTION' | 'CALL_AI_REGULAR';
  code?: string;
  prompt?: string;
}

export interface ParsedAiMotionResponse {
  hasMotionCode: boolean;
  chatMessage: string;
  codeToRender: string | null;
}

/**
 * 2.A. Pengecekan Input Pengguna (Sebelum dikirim ke AI)
 * Memeriksa apakah input pengguna memicu mode @motion atau input kode manual
 */
export function processUserInput(userMessage: string, isManualCodeMode?: boolean): UserInputProcessResult {
  if (isManualCodeMode) {
    // Mode Opsi Kode Manual: Langsung bungkus ke tag renderer tanpa panggil AI
    return {
      type: "RENDER_MOTION",
      code: userMessage
    };
  } else if (userMessage && userMessage.includes("@motion")) {
    // Mode Prompt AI: Kirim pesan ke LLM menggunakan System Prompt khusus
    return {
      type: "CALL_AI_MOTION",
      prompt: userMessage
    };
  } else {
    // Chat biasa
    return {
      type: "CALL_AI_REGULAR",
      prompt: userMessage
    };
  }
}

/**
 * 2.B. Pengecekan Respon AI (Extractor Kode)
 * Memeriksa apakah respon AI mengandung tag [BLUEFOX_MOTION] untuk dirender
 */
export function parseAiResponse(aiResponseText: string): ParsedAiMotionResponse {
  if (!aiResponseText) {
    return {
      hasMotionCode: false,
      chatMessage: '',
      codeToRender: null
    };
  }

  const motionRegex = /\[BLUEFOX_MOTION\]([\s\S]*?)\[\/BLUEFOX_MOTION\]/i;
  const match = aiResponseText.match(motionRegex);

  if (match && match[1]) {
    let extractedCode = match[1].trim();

    // Jika AI secara tidak sengaja menambahkan pembungkus markdown ```html ... ``` di dalam tag [BLUEFOX_MOTION]
    if (extractedCode.startsWith('```html')) {
      extractedCode = extractedCode.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    } else if (extractedCode.startsWith('```')) {
      extractedCode = extractedCode.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    }

    let cleanTextMessage = aiResponseText.replace(motionRegex, '').trim();
    if (!cleanTextMessage) {
      cleanTextMessage = 'Berikut adalah animasi visual berbasis kode yang telah dibuat dan siap dilihat pada pratinjau di bawah ini:';
    }

    return {
      hasMotionCode: true,
      chatMessage: cleanTextMessage, // Teks respon percakapan AI di balon chat
      codeToRender: extractedCode     // Kode animasi visual yang dikirim ke pratinjau
    };
  }

  // 2. Deteksi jika kode berada dalam blok markdown ```html ... ``` atau ``` ... ```
  const codeBlockRegex = /```(?:html|xml|svg)?\s*([\s\S]*?(?:<!DOCTYPE|<html|<svg|<canvas|<style|<script)[\s\S]*?)```/i;
  const blockMatch = aiResponseText.match(codeBlockRegex);

  if (blockMatch && blockMatch[1]) {
    const extractedCode = blockMatch[1].trim();
    let cleanTextMessage = aiResponseText.replace(codeBlockRegex, '').trim();
    if (!cleanTextMessage) {
      cleanTextMessage = 'Berikut adalah animasi visual berbasis kode yang telah dibuat dan siap dilihat pada pratinjau di bawah ini:';
    }

    return {
      hasMotionCode: true,
      chatMessage: cleanTextMessage,
      codeToRender: extractedCode
    };
  }

  // 3. Deteksi jika respon mentah adalah dokumen HTML / SVG mandiri
  if (
    aiResponseText.includes('<!DOCTYPE html>') || 
    (aiResponseText.includes('<html') && aiResponseText.includes('</html>')) ||
    (aiResponseText.includes('<svg') && aiResponseText.includes('</svg>') && (aiResponseText.includes('<animate') || aiResponseText.includes('keyframes') || aiResponseText.includes('<style')))
  ) {
    return {
      hasMotionCode: true,
      chatMessage: 'Berikut adalah animasi visual berbasis kode yang telah dibuat dan siap dilihat pada pratinjau di bawah ini:',
      codeToRender: aiResponseText.trim()
    };
  }

  return {
    hasMotionCode: false,
    chatMessage: aiResponseText,
    codeToRender: null
  };
}

/**
 * Menyiapkan HTML aman & terstandarisasi untuk disuntikkan ke iframe srcdoc
 */
export function sanitizeMotionHtml(rawCode: string, theme: 'dark' | 'light' = 'dark'): string {
  if (!rawCode) return '';
  let code = rawCode.trim();

  // Jika kode hanya berupa potongan SVG atau CSS/HTML tanpa DOCTYPE, bungkus ke dokumen lengkap
  const hasHtmlTag = /<html[\s>]/i.test(code);
  const hasBodyTag = /<body[\s>]/i.test(code);

  if (hasHtmlTag && hasBodyTag) {
    return code;
  }

  const bgColor = theme === 'dark' ? '#0b0f19' : '#f8fafc';
  const textColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${bgColor};
      color: ${textColor};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
}

/**
 * Koleksi Preset Animasi Siap Pakai untuk Mode Kode Manual
 */
export interface MotionPreset {
  id: string;
  title: string;
  description: string;
  code: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'pulsing-circle',
    title: 'Lingkaran Berdenyut (Pulse)',
    description: 'Animasi lingkaran membesar dan mengecil dengan gradien bercahaya',
    code: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
    overflow: hidden;
  }
  .pulse-container {
    position: relative;
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .circle {
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #6366f1 100%);
    border-radius: 50%;
    box-shadow: 0 0 35px rgba(56, 189, 248, 0.6);
    animation: pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    z-index: 2;
  }
  .wave {
    position: absolute;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 2px solid rgba(56, 189, 248, 0.7);
    animation: ripple 2.2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
  }
  .wave:nth-child(2) {
    animation-delay: 0.7s;
  }
  @keyframes pulse {
    0% { transform: scale(0.9); box-shadow: 0 0 20px rgba(56, 189, 248, 0.4); }
    50% { transform: scale(1.25); box-shadow: 0 0 50px rgba(56, 189, 248, 0.9); }
    100% { transform: scale(0.9); box-shadow: 0 0 20px rgba(56, 189, 248, 0.4); }
  }
  @keyframes ripple {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(2.6); opacity: 0; }
  }
</style>
</head>
<body>
  <div class="pulse-container">
    <div class="wave"></div>
    <div class="wave"></div>
    <div class="circle"></div>
  </div>
</body>
</html>`
  },
  {
    id: 'cyber-loader',
    title: 'Cyberpunk Ring Loader',
    description: 'Cincin neon futuristik berputar bertingkat dengan aksen cyan & ungu',
    code: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #090d16;
    overflow: hidden;
  }
  .loader {
    position: relative;
    width: 140px;
    height: 140px;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 4px solid transparent;
  }
  .ring-1 {
    border-top-color: #06b6d4;
    border-right-color: #06b6d4;
    filter: drop-shadow(0 0 8px #06b6d4);
    animation: spin 1.4s linear infinite;
  }
  .ring-2 {
    inset: 12px;
    border-bottom-color: #a855f7;
    border-left-color: #a855f7;
    filter: drop-shadow(0 0 8px #a855f7);
    animation: spin-reverse 2s linear infinite;
  }
  .ring-3 {
    inset: 24px;
    border-top-color: #3b82f6;
    border-left-color: #3b82f6;
    animation: spin 2.8s linear infinite;
  }
  .core {
    position: absolute;
    inset: 44px;
    background: radial-gradient(circle, #38bdf8 0%, transparent 75%);
    border-radius: 50%;
    animation: glow 1.8s ease-in-out infinite alternate;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes spin-reverse {
    to { transform: rotate(-360deg); }
  }
  @keyframes glow {
    from { transform: scale(0.8); opacity: 0.5; }
    to { transform: scale(1.3); opacity: 1; }
  }
</style>
</head>
<body>
  <div class="loader">
    <div class="ring ring-1"></div>
    <div class="ring ring-2"></div>
    <div class="ring ring-3"></div>
    <div class="core"></div>
  </div>
</body>
</html>`
  },
  {
    id: 'floating-blobs',
    title: 'Morphing Aurora Blobs',
    description: 'Bentuk organik SVG bertransformasi halus dengan warna gradasi dinamis',
    code: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #030712;
    overflow: hidden;
  }
  .blob {
    width: 180px;
    height: 180px;
    background: linear-gradient(45deg, #ec4899, #8b5cf6, #3b82f6);
    border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
    animation: morph 6s ease-in-out infinite alternate;
    box-shadow: 0 0 45px rgba(139, 92, 246, 0.5);
  }
  @keyframes morph {
    0% {
      border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
      transform: rotate(0deg) scale(1);
    }
    50% {
      border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
      transform: rotate(180deg) scale(1.15);
    }
    100% {
      border-radius: 50% 60% 30% 60% / 40% 70% 50% 60%;
      transform: rotate(360deg) scale(0.95);
    }
  }
</style>
</head>
<body>
  <div class="blob"></div>
</body>
</html>`
  }
];

/**
 * URL Supabase Edge Function khusus untuk Bluefox Motion:
 * Mencegah timeout proses generator animasi berdurasi panjang
 */
export const MOTION_EDGE_FUNCTION_URL = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/generate-animation';

/**
 * Memanggil Edge Function khusus 'generate-animation' untuk request @motion
 */
export async function invokeMotionGenerator(payload: any, signal?: AbortSignal) {
  const edgeFunctionUrl = MOTION_EDGE_FUNCTION_URL;
  const anonKey = supabaseKey || (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zXY2aPqOnPt7j1QKdoZFxQ_x6rOon0U';

  let authToken = anonKey;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.access_token) {
      authToken = sessionData.session.access_token;
    }
  } catch (authErr) {
    console.warn("⚠️ Gagal membaca access token sesi Supabase untuk motion:", authErr);
  }

  const promptText = payload.prompt || payload.userText || payload.text || '';
  const safePayload = {
    ...payload,
    prompt: promptText,
    userText: promptText,
    query: promptText,
    system_instruction: BLUEFOX_MOTION_SYSTEM_PROMPT,
    system_prompt: BLUEFOX_MOTION_SYSTEM_PROMPT,
    mode: 'motion',
    is_motion: true,
  };

  console.log('[MOTION EDGE FUNCTION DISPATCH]', {
    endpoint: edgeFunctionUrl,
    promptSample: promptText.slice(0, 100)
  });

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(safePayload),
    signal,
  });

  if (!response.ok) {
    const textError = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(textError);
    } catch {
      parsed = { error: textError };
    }
    const err: any = new Error(parsed?.error || parsed?.message || `Edge function generate-animation returned HTTP ${response.status}`);
    err.status = response.status;
    err.data = parsed;
    throw err;
  }

  const data = await response.json();
  return data;
}
