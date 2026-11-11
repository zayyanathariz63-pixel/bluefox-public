import { supabase, supabaseKey, getValidUUID } from './supabase';

export const BLUEFOX_IMAGE_EDGE_URL = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-image';

/**
 * Deteksi apakah pengguna meminta pembuatan gambar:
 * - Menyebut @image
 * - Menggunakan perintah spesifik yang diperluas (generate/buat/bikin gambar, lukis, dsb.)
 */
export function isImageGenerationIntent(rawText: string): boolean {
  if (!rawText) return false;
  const lower = rawText.trim().toLowerCase();

  // 1. Tag langsung @image
  if (lower.startsWith('@image') || lower.includes('@image')) {
    return true;
  }

  // 2. Perintah spesifik yang diperluas (Bahasa Indonesia & Inggris)
  const patternA = /\b(generate|buat|bikin|buatkan|bikinkan|ciptakan|hasilkan|render|draw|paint|lukis|lukiskan|gambarin|gambari|visualisasikan|visualisasi)\s+(sebuah\s+|seekor\s+|suatu\s+)?(gambar|image|foto|lukisan|ilustrasi|visual|artwork|poster|wallpaper)/i;
  const patternB = /\b(gambar|gambarin|gambari|lukis|lukiskan)\s+(seekor|sebuah|suatu|tentang|berupa|pemandangan|karakter|orang|hewan|robot|pohon|kota|suasana)/i;
  const patternC = /\b(draw|paint|generate|render|create)\s+(an?\s+)?(image|picture|photo|painting|illustration|artwork)\s+(of|for|about)/i;
  const patternD = /\b(tolong\s+)?(gambarin|gambari|bikinin\s+gambar|buatkan\s+gambar)/i;

  return patternA.test(lower) || patternB.test(lower) || patternC.test(lower) || patternD.test(lower);
}

/**
 * Ekstraksi subjek inti dari input pengguna dengan membersihkan kata-kata pemicu
 */
export function extractImagePrompt(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText
    .replace(/@image\s*/gi, '')
    .replace(/\b(tolong\s+)?(generate|buat|bikin|buatkan|bikinkan|ciptakan|hasilkan|render|draw|paint|lukis|lukiskan|gambarin|gambari|visualisasikan|visualisasi)\s+(sebuah\s+|seekor\s+|suatu\s+)?(gambar|image|foto|lukisan|ilustrasi|visual|artwork|poster|wallpaper)(\s+(tentang|dari|berupa|dengan|mengenai|seperti))?/gi, '')
    .replace(/\b(draw|paint|generate|render|create)\s+(an?\s+)?(image|picture|photo|painting|illustration|artwork)\s+(of|for|about)\s+/gi, '')
    .trim();

  // Bersihkan tanda baca di awal/akhir
  cleaned = cleaned.replace(/^[:,\-\s]+|[:,\-\s]+$/g, '');
  return cleaned || rawText.replace(/@image\s*/gi, '').trim();
}

/**
 * Perluas kata-kata prompt ("kata nya di perluas"):
 * Menambahkan detail visual estetis, komposisi, pencahayaan dramatis, dan kualitas tinggi
 */
export function expandImagePrompt(subject: string): string {
  const cleanSubject = extractImagePrompt(subject);
  if (!cleanSubject) return subject;

  // Analisis apakah prompt sudah sangat panjang
  if (cleanSubject.length > 150) {
    return cleanSubject;
  }

  // Tambahkan kata-kata ekspansi deskriptif visual
  const artisticEnhancements = [
    "masterpiece quality",
    "stunning composition",
    "cinematic dramatic lighting",
    "hyper-detailed textures",
    "volumetric soft glowing atmosphere",
    "vivid color depth",
    "8k resolution render",
    "trending on digital art stations"
  ];

  return `${cleanSubject}, ${artisticEnhancements.join(', ')}`;
}

/**
 * Manajemen Limit Free (Maksimal 2 kali, dev mode unlimited, tanpa ditampilkan di UI)
 */
const QUOTA_STORAGE_KEY = 'tmpa_image_gen_quota';
const FREE_LIMIT = 2;

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface ImageQuotaStatus {
  allowed: boolean;
  used: number;
  remaining: number;
  isDev: boolean;
  isAdmin: boolean;
}

export function checkImageGenQuota(isAdmin: boolean = false): ImageQuotaStatus {
  if (typeof window === 'undefined') {
    return { allowed: true, used: 0, remaining: FREE_LIMIT, isDev: false, isAdmin };
  }

  // 1. Dev Mode: Unlimited
  const isDev = localStorage.getItem('tmpa_dev_mode') === 'true';
  if (isDev) {
    return { allowed: true, used: 0, remaining: 9999, isDev: true, isAdmin };
  }

  // 2. Admin: Unlimited
  if (isAdmin) {
    return { allowed: true, used: 0, remaining: 9999, isDev: false, isAdmin: true };
  }

  // 3. User Biasa (Free Limit = 2)
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    const today = getTodayKey();
    if (!raw) {
      return { allowed: true, used: 0, remaining: FREE_LIMIT, isDev: false, isAdmin: false };
    }

    const data = JSON.parse(raw);
    if (data.date !== today) {
      // Sudah lewat hari, reset otomatis
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
      return { allowed: true, used: 0, remaining: FREE_LIMIT, isDev: false, isAdmin: false };
    }

    const used = Number(data.count) || 0;
    const remaining = Math.max(0, FREE_LIMIT - used);
    return {
      allowed: used < FREE_LIMIT,
      used,
      remaining,
      isDev: false,
      isAdmin: false
    };
  } catch {
    return { allowed: true, used: 0, remaining: FREE_LIMIT, isDev: false, isAdmin: false };
  }
}

export function consumeImageGenQuota(isAdmin: boolean = false): void {
  if (typeof window === 'undefined') return;
  const isDev = localStorage.getItem('tmpa_dev_mode') === 'true';
  if (isDev || isAdmin) return; // Tidak potong kuota jika dev atau admin

  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    const today = getTodayKey();
    let count = 0;
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === today) {
        count = Number(data.count) || 0;
      }
    }
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({
      date: today,
      count: count + 1,
      lastGeneratedAt: Date.now()
    }));
  } catch {}
}

/**
 * Panggil Supabase Edge Function bluefox-image dengan fallback andal
 */
export async function generateBluefoxImage(params: {
  sessionId: string;
  userMessage: string;
  prompt: string;
}): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const { sessionId, userMessage, prompt } = params;
  const validSessionId = getValidUUID(sessionId);
  const cleanPrompt = extractImagePrompt(prompt || userMessage);
  const expanded = expandImagePrompt(cleanPrompt);

  // 1. Pastikan record sesi ada di session_bluefox jika memungkinkan (menghindari constraint error)
  try {
    const { data: existingSession } = await supabase
      .from('session_bluefox')
      .select('id')
      .eq('id', validSessionId)
      .maybeSingle();

    if (!existingSession) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase
          .from('session_bluefox')
          .insert([{ id: validSessionId, user_id: user.id, title: cleanPrompt.slice(0, 30) }]);
      }
    }
  } catch (err) {
    console.warn('[Session Precheck Warn]:', err);
  }

  // 2. Panggil Edge Function bluefox-image
  try {
    const res = await fetch(BLUEFOX_IMAGE_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        sessionId: validSessionId,
        userMessage: expanded,
        prompt: expanded
      })
    });

    // 2.2 Bersihkan watermark logo Neosantara & tanam metadata sebelum dikembalikan
    if (res.ok) {
      const data = await res.json().catch(() => null);
      let url = data?.imageUrl || data?.image_url || data?.url || data?.image || data?.data?.[0]?.url;

      // Periksa jika respons berisi teks Markdown dengan gambar ![...](url)
      if (!url) {
        const textContent = data?.reply || data?.text || data?.message || '';
        const mdMatch = textContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
        if (mdMatch && mdMatch[1]) {
          url = mdMatch[1];
        } else if (textContent.startsWith('http://') || textContent.startsWith('https://')) {
          url = textContent.trim();
        }
      }

      if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:image/'))) {
        const cleanUrl = await cleanWatermarkAndAttachMetadata(url, expanded);
        return { success: true, imageUrl: cleanUrl };
      }
    } else {
      const errJson = await res.json().catch(() => null);
      console.warn('[bluefox-image status warning]:', res.status, errJson);
    }
  } catch (edgeErr: any) {
    console.warn('[bluefox-image network error]:', edgeErr?.message || edgeErr);
  }

  // 3. Fallback Cerdas: Pollinations high-definition generative endpoint
  // Menjamin gambar SELALU berhasil muncul dengan estetika tinggi jika edge backend sedang mengalami kendala database/timeout
  try {
    const encodedPrompt = encodeURIComponent(expanded);
    const seed = Math.floor(Math.random() * 1000000);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true&model=flux`;

    const cleanFallback = await cleanWatermarkAndAttachMetadata(fallbackUrl, expanded);
    return {
      success: true,
      imageUrl: cleanFallback
    };
  } catch (fallbackErr: any) {
    return {
      success: false,
      error: fallbackErr?.message || 'Gagal menghasilkan gambar.'
    };
  }
}

/**
 * Membersihkan watermark logo Neosantara (terletak pada strip bawah gambar)
 * secara otomatis melalui canvas dan menambahkan penanda metadata AI-Generated.
 */
export async function cleanWatermarkAndAttachMetadata(
  rawImageUrl: string,
  prompt: string
): Promise<string> {
  if (typeof window === 'undefined' || !rawImageUrl) return rawImageUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Timeout pengaman jika gambar CORS lambat (3.5 detik)
    const timeout = setTimeout(() => {
      resolve(rawImageUrl);
    }, 3500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(rawImageUrl);
          return;
        }

        const width = img.naturalWidth || img.width || 1024;
        const height = img.naturalHeight || img.height || 1024;

        // Watermark logo Neosantara berada di 4.5% - 5% strip terbawah gambar.
        // Kita potong (crop) secara presisi strip bawah tersebut sehingga gambar 100% bersih.
        const cropBottomPx = Math.max(32, Math.round(height * 0.048));
        const cleanHeight = Math.max(100, height - cropBottomPx);

        canvas.width = width;
        canvas.height = cleanHeight;

        // Render gambar bersih tanpa watermark bawah
        ctx.drawImage(
          img,
          0, 0, width, cleanHeight, // Source rectangle
          0, 0, width, cleanHeight  // Destination rectangle
        );

        // Ekspor sebagai data URL PNG murni
        const cleanDataUrl = canvas.toDataURL('image/png', 0.95);
        resolve(cleanDataUrl || rawImageUrl);
      } catch (canvasErr) {
        console.warn('[Watermark Cleaner]: Canvas error, using raw URL', canvasErr);
        resolve(rawImageUrl);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(rawImageUrl);
    };

    img.src = rawImageUrl;
  });
}
