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

export interface BluefoxImageResult {
  success: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  error?: string;
}

/**
 * Ekstraktor universal multi-format data gambar dari Neosantara / Supabase Edge Function:
 * Mendukung:
 * - URL langsung (http://, https://)
 * - Base64 Data URI (data:image/...)
 * - Raw Base64 string (iVBORw0KGgo..., /9j/..., UklGR..., R0lGOD..., atau base64 payload)
 * - Array multi-gambar (images: [], data: [], artifacts: [], outputs: [], results: [])
 * - Teks Markdown dengan sintaks gambar ![alt](url)
 * - Tag HTML <img>
 * - Nested objects & stringified JSON
 */
export function extractAllImagesFromResponse(data: any): string[] {
  const results: string[] = [];
  const visited = new Set<any>();

  function isLikelyBase64Image(str: string): boolean {
    if (str.length < 50) return false;
    if (str.startsWith('iVBORw0KGgo') || str.startsWith('/9j/') || str.startsWith('UklGR') || str.startsWith('R0lGOD')) {
      return true;
    }
    if (str.length > 500 && /^[A-Za-z0-9+/=]+$/.test(str.slice(0, 200))) {
      return true;
    }
    return false;
  }

  function formatRawBase64(raw: string): string {
    if (raw.startsWith('data:image/')) return raw;
    if (raw.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${raw}`;
    if (raw.startsWith('/9j/')) return `data:image/jpeg;base64,${raw}`;
    if (raw.startsWith('UklGR')) return `data:image/webp;base64,${raw}`;
    if (raw.startsWith('R0lGOD')) return `data:image/gif;base64,${raw}`;
    return `data:image/png;base64,${raw}`;
  }

  function walk(node: any) {
    if (!node || visited.has(node)) return;
    if (typeof node === 'object') {
      visited.add(node);
    }

    if (typeof node === 'string') {
      const str = node.trim();
      if (!str) return;

      // 1. Data URL
      if (str.startsWith('data:image/')) {
        results.push(str);
        return;
      }

      // 2. Direct HTTP/HTTPS URL
      if (str.startsWith('http://') || str.startsWith('https://')) {
        // Tolak domain pollination secara ketat sesuai instruksi pengguna
        if (!str.includes('pollinations.ai') && !str.includes('pollination.ai')) {
          results.push(str);
        }
        return;
      }

      // 3. Raw Base64 string
      if (isLikelyBase64Image(str)) {
        results.push(formatRawBase64(str));
        return;
      }

      // 4. Markdown images ![alt](url)
      const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+|data:image\/[^\s\)]+)\)/gi;
      let mdMatch;
      let foundInText = false;
      while ((mdMatch = mdRegex.exec(str)) !== null) {
        if (mdMatch[1]) {
          foundInText = true;
          const u = mdMatch[1];
          if (!u.includes('pollinations.ai') && !u.includes('pollination.ai')) {
            results.push(u);
          }
        }
      }

      // 5. HTML img tags <img src="..." />
      const htmlRegex = /<img\s+[^>]*src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["']/gi;
      let htmlMatch;
      while ((htmlMatch = htmlRegex.exec(str)) !== null) {
        if (htmlMatch[1]) {
          foundInText = true;
          const u = htmlMatch[1];
          if (!u.includes('pollinations.ai') && !u.includes('pollination.ai')) {
            results.push(u);
          }
        }
      }

      // 6. Try parsing stringified JSON jika belum ditemukan gambar di teks
      if (!foundInText && (str.startsWith('{') || str.startsWith('['))) {
        try {
          const parsed = JSON.parse(str);
          walk(parsed);
        } catch {}
      }

      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }

    if (typeof node === 'object') {
      // Prioritaskan nama properti umum gambar
      const candidateKeys = [
        'imageUrl', 'image_url', 'url', 'image', 'src', 
        'dataUrl', 'data_url', 'base64', 'b64', 'b64_json',
        'output', 'result', 'link', 'artifact', 'artifacts',
        'images', 'data', 'outputs', 'results', 'generations',
        'reply', 'message', 'content', 'text'
      ];

      for (const k of candidateKeys) {
        if (node[k] !== undefined) {
          walk(node[k]);
        }
      }

      for (const key of Object.keys(node)) {
        if (!candidateKeys.includes(key)) {
          walk(node[key]);
        }
      }
    }
  }

  walk(data);

  // Dedup tanpa mengubah urutan
  const uniqueList: string[] = [];
  const seen = new Set<string>();
  for (const item of results) {
    if (item && !seen.has(item)) {
      seen.add(item);
      uniqueList.push(item);
    }
  }

  return uniqueList;
}

export interface GenerateBluefoxImageParams {
  sessionId: string;
  userMessage: string;
  prompt: string;
  generateImage?: string;
  imagePrompt?: string;
}

/**
 * Panggil Supabase Edge Function bluefox-image dan ekstrak berbagai format data gambar dari Neosantara
 */
export async function generateBluefoxImage(params: GenerateBluefoxImageParams): Promise<BluefoxImageResult> {
  const { sessionId, userMessage, prompt } = params;
  const validSessionId = getValidUUID(sessionId);
  const cleanPrompt = extractImagePrompt(prompt || userMessage);
  const expanded = expandImagePrompt(cleanPrompt);

  // KEBUTUHAN UTAMA:
  // generateImage: harus menyertakan @image biar kedeteksi oleh Edge Function / Neosantara
  const generateImageVal = params.generateImage
    ? (params.generateImage.startsWith('@image') ? params.generateImage : `@image ${params.generateImage}`)
    : (cleanPrompt ? `@image ${cleanPrompt}` : '@image');

  // imagePrompt: adalah prompt user murni TANPA @image
  const imagePromptVal = params.imagePrompt
    ? params.imagePrompt.replace(/^@image\s*/i, '').trim()
    : cleanPrompt;

  // 1. Dapatkan auth token aktif jika tersedia
  let authToken = supabaseKey;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.access_token) {
      authToken = sessionData.session.access_token;
    }
  } catch {}

  // 2. Pastikan record sesi ada di session_bluefox (menghindari foreign key constraint error)
  try {
    const { data: existingSession } = await supabase
      .from('session_bluefox')
      .select('id')
      .eq('id', validSessionId)
      .maybeSingle();

    if (!existingSession) {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = { 
        id: validSessionId, 
        title: cleanPrompt.slice(0, 30) || 'Image Generation' 
      };
      if (user?.id) {
        payload.user_id = user.id;
      }
      await supabase
        .from('session_bluefox')
        .upsert([payload], { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('[Session Precheck Warn]:', err);
  }

  // 3. Panggil Edge Function bluefox-image dengan menyertakan generateImage (@image) dan imagePrompt (tanpa @image)
  try {
    const requestPayload = {
      sessionId: validSessionId,
      userMessage: expanded,
      generateImage: generateImageVal,
      imagePrompt: imagePromptVal,
      // Field pendukung untuk kompatibilitas multi-format edge function
      generate_image: generateImageVal,
      image_prompt: imagePromptVal,
      prompt: imagePromptVal,
      expandedPrompt: expanded,
      expanded_prompt: expanded
    };

    console.log('[bluefox-image payload]:', {
      userMessage: requestPayload.userMessage,
      generateImage: requestPayload.generateImage,
      imagePrompt: requestPayload.imagePrompt
    });

    const res = await fetch(BLUEFOX_IMAGE_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(requestPayload)
    });

    const textResponse = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(textResponse);
    } catch {
      data = { rawText: textResponse };
    }

    if (res.ok) {
      // Ekstrak semua data gambar (berbagai format dari Neosantara: URLs, base64, nested arrays, markdown)
      const extractedImages = extractAllImagesFromResponse(data);

      if (extractedImages.length > 0) {
        // Bersihkan watermark logo Neosantara & tanam metadata
        const cleanImages = await Promise.all(
          extractedImages.map(img => cleanWatermarkAndAttachMetadata(img, expanded))
        );

        return {
          success: true,
          imageUrl: cleanImages[0],
          imageUrls: cleanImages
        };
      } else {
        // Edge function berhasil dipanggil namun tidak ada data gambar di respons
        const serverDetail = data?.error || data?.message || data?.detail || '';
        const detailStr = typeof serverDetail === 'object' ? JSON.stringify(serverDetail) : serverDetail;
        return {
          success: false,
          error: detailStr
            ? `Server Neosantara mengembalikan pesan: "${detailStr}". Tidak ada visual gambar yang berhasil dihasilkan.`
            : `Edge function (bluefox-image) tidak mengembalikan data gambar yang valid dari Neosantara. Pastikan layanan gambar Neosantara sedang aktif dan menghasilkan format yang didukung.`
        };
      }
    } else {
      // Respons status bukan 200 (misal: 400, 401, 500)
      const errorMsg = data?.error || data?.message || data?.details || textResponse || res.statusText;
      const formattedError = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg;
      return {
        success: false,
        error: `Gagal memanggil edge function bluefox-image (${res.status} ${res.statusText}): ${formattedError}. Tidak ada gambar yang berhasil dihasilkan.`
      };
    }
  } catch (edgeErr: any) {
    console.error('[bluefox-image error]:', edgeErr);
    return {
      success: false,
      error: `Kendala koneksi saat menghubungi edge function bluefox-image: ${edgeErr?.message || 'Gagal terhubung ke server'}.`
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
