import { SearchSource } from '../types';
import { supabase, supabaseUrl, supabaseKey } from './supabase';

export type SearchModeType = 'standard' | 'advanced' | 'map_standard' | 'map_advanced';

export interface SearchUsageRate {
  add5h: number;
  addWeekly: number;
}

export const SEARCH_USAGE_RATES: Record<SearchModeType, SearchUsageRate> = {
  advanced: { add5h: 10, addWeekly: 5 },
  standard: { add5h: 5, addWeekly: 3 },
  map_advanced: { add5h: 13, addWeekly: 7 },
  map_standard: { add5h: 7, addWeekly: 4 },
};

export interface SearchResultPayload {
  has_sources: boolean;
  search_engine_used: 'tavily' | 'duckduckgo' | string | null;
  sources: SearchSource[];
  contextSnippet: string;
  searchMode?: SearchModeType;
  queriesRun?: string[];
}

/**
 * 2.1 Intent Detection (Pendeteksian Niat)
 * Mendeteksi apakah pesan pengguna membutuhkan data web real-time.
 */
export function detectSearchIntent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // 1. Explicit search commands
  if (
    lower.startsWith('@search') ||
    lower.startsWith('@web') ||
    lower.startsWith('@cari') ||
    lower.startsWith('@browse') ||
    lower.startsWith('@google') ||
    lower.startsWith('@find') ||
    lower.startsWith('@internet') ||
    lower.startsWith('@online') ||
    lower.startsWith('search:') ||
    lower.startsWith('cari:') ||
    lower.startsWith('browse:') ||
    lower.startsWith('find:') ||
    lower.startsWith('/search') ||
    lower.startsWith('/web') ||
    lower.startsWith('/cari') ||
    lower.includes('@search') ||
    lower.includes('@web')
  ) {
    return true;
  }

  // 2. High-priority keyword triggers as stated in the PRD + search keywords
  const prdTriggers = [
    'cari',
    'search',
    'browsing',
    'browse',
    'googling',
    'carikan',
    'look up',
    'search for',
    'find out',
    'web search',
    'pencarian web',
    'cari tahu apakah',
    'apakah benar',
    'cek harga',
    'info terbaru',
    'informasi terbaru',
    'berita terbaru',
    'berita terkini',
    'harga terbaru',
    'update terbaru',
    'berita hari ini',
    'berita dari',
    'kabar terbaru',
    'kabar hari ini',
    'jadwal pertandingan',
    'skor pertandingan',
    'kurs rupiah',
    'kurs dollar',
    'cuaca hari ini',
    'cuaca sekarang',
    'siapa juara',
    'siapa pemenang',
    'kapan rilis',
    'tanggal rilis',
    'daftar harga',
    'harga pasar',
    'tren terbaru',
    'trending sekarang',
    'latest news',
    'current price',
    'today news',
    'release date',
    'match score',
    'weather today',
    'who won',
    'lokasi',
    'rute',
    'peta',
    'alamat',
    'rekomendasi tempat'
  ];

  for (const trigger of prdTriggers) {
    if (lower.includes(trigger)) return true;
  }

  // 3. Regular expressions for dynamic facts, years, and real-time questions
  const patterns = [
    /\b(harga|tarif|biaya|promo|diskon|price|cost)\s+([a-z0-9]+)/i,
    /\b(berita|kabar|isu|peristiwa|kejadian|news|headline)\s+(terkini|terbaru|hari ini|minggu ini|dari|tentang|today|latest)/i,
    /\b(apakah|benarkah|beneran|is it true that)\s+(sudah|sedang|ada|terjadi)/i,
    /\b(cek|cari|search|browse|browsing|find|lookup)\s+(informasi|data|fakta|spek|spesifikasi|berita|info|details)/i,
    /\b(rilis|launching|peluncuran|release|launch)\s+(tahun|bulan|terbaru|2024|2025|2026|2027)/i,
    /\b(presiden|menteri|gubernur|ceo|pemimpin|juara|skor|president|champion)\s+(sekarang|terbaru|saat ini|hari ini|current|now)/i,
    /\b(skor|hasil|klasemen|jadwal|score|standings|schedule)\s+(liga|piala|f1|motogp|badminton|esport|timnas|epl|nba|ucl)/i,
    /\b(dimana|lokasi|alamat|tempat makan|cafe terdekat|peta|rute|maps?)\b/i,
  ];

  return patterns.some(pattern => pattern.test(lower));
}

/**
 * Mendeteksi apakah query membutuhkan mode Advance Search untuk akurasi tinggi
 */
export function detectNeedAdvanceSearch(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // 1. Explicit advance keywords
  if (
    lower.includes('advance') ||
    lower.includes('akurat') ||
    lower.includes('presisi') ||
    lower.includes('detail') ||
    lower.includes('mendalam') ||
    lower.includes('komprehensif') ||
    lower.includes('spesifikasi lengkap') ||
    lower.includes('resmi') ||
    lower.includes('analisis') ||
    lower.includes('perbandingan') ||
    lower.includes('bandingkan') ||
    lower.includes('statistika') ||
    lower.includes('data statistik') ||
    lower.includes('laporan keuangan') ||
    lower.includes('saham') ||
    lower.includes('crypto') ||
    lower.includes('benchmark') ||
    lower.includes('jurnal') ||
    lower.includes('ilmiah') ||
    lower.includes('studi')
  ) {
    return true;
  }

  // 2. Pertanyaan berbasis tahun spesifik dan komparasi angka faktual
  if (
    /\b(2025|2026|2027)\b/.test(lower) ||
    /\b(vs|versus|dibandingkan|kelebihan dan kekurangan|mana yang lebih bagus)\b/i.test(lower) ||
    /\b(spesifikasi|arsitektur|algoritma|cara kerja mendalam)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Mendeteksi apakah query terkait Maps / Lokasi Geografis
 */
export function detectMapSearch(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return /\b(peta|map|maps|lokasi|arah|rute|alamat|jarak|terdekat|wisata|kuliner|restoran di|cafe di|hotel di)\b/i.test(lower);
}

/**
 * Membersihkan query pencarian dari prefix prompt / command agar hasil search akurat.
 */
export function cleanSearchQuery(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/^@(search|web|cari|browse|google|find|internet|online|map|maps)\s*/i, '')
    .replace(/^(search|cari|browse|find):\s*/i, '')
    .replace(/^\/(search|web|cari)\s*/i, '')
    .replace(/^(tolong\s+)?(cari tahu|carikan|cek|apakah benar|tolong cek|bantu cari|apa saja|apa|tolong carikan|search for|please search|look up)\s+/i, '')
    .trim();
}

/**
 * Menghasilkan 3-5 sub-queries cerdas untuk memperluas cakupan informasi web
 */
export function generateExpandedQueries(cleanQuery: string, count: number = 3): string[] {
  if (!cleanQuery) return [];
  const queries: string[] = [cleanQuery];

  const words = cleanQuery.split(/\s+/).filter(Boolean);

  // Variasi 2: Fokus data terbaru & akurat
  if (!cleanQuery.toLowerCase().includes('terbaru') && !cleanQuery.toLowerCase().includes('latest')) {
    queries.push(`${cleanQuery} terbaru berita fakta`);
  } else {
    queries.push(`${cleanQuery} rangkuman informasi resmi`);
  }

  // Variasi 3: Spesifik detail / fakta
  if (words.length > 2) {
    queries.push(`${words.slice(0, 4).join(' ')} update`);
  } else {
    queries.push(`${cleanQuery} penjelasan data akurat`);
  }

  // Variasi 4 & 5 jika count >= 4
  if (count >= 4) {
    queries.push(`${cleanQuery} review analisis`);
  }
  if (count >= 5) {
    queries.push(`${cleanQuery} sumber terpercaya`);
  }

  return queries.slice(0, Math.max(3, Math.min(5, count)));
}

/**
 * Pemanggilan Supabase Edge Function 'bluefox-search'
 * Endpoint: https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-search
 */
export async function searchWithSupabaseEdgeFunction(
  query: string,
  options?: { isAdvanced?: boolean; signal?: AbortSignal }
): Promise<{ success: boolean; sources: SearchSource[]; engineUsed?: string; error?: string }> {
  const cleanQ = cleanSearchQuery(query);
  if (!cleanQ) return { success: false, sources: [] };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const onAbort = () => controller.abort();
    if (options?.signal) {
      options.signal.addEventListener('abort', onAbort);
    }

    console.log(`🌐 [Supabase Edge Function] Memanggil bluefox-search (Advance: ${Boolean(options?.isAdvanced)}) untuk: "${cleanQ}"`);

    const requestPayload = {
      query: cleanQ,
      q: cleanQ,
      search: cleanQ,
      is_advanced: Boolean(options?.isAdvanced),
      advanced: Boolean(options?.isAdvanced),
      max_results: options?.isAdvanced ? 8 : 5,
    };

    // 1. Coba melalui supabase.functions.invoke('bluefox-search')
    try {
      const invokeRes = await supabase.functions.invoke('bluefox-search', {
        body: requestPayload,
      });

      clearTimeout(timeoutId);
      if (options?.signal) options.signal.removeEventListener('abort', onAbort);

      if (invokeRes.data && !invokeRes.error) {
        const payload = invokeRes.data;
        const rawSources = payload.sources || (Array.isArray(payload) ? payload : (payload.data?.sources || payload.results || payload.data?.results || payload.organic || []));
        
        if (Array.isArray(rawSources) && rawSources.length > 0) {
          const sources: SearchSource[] = rawSources.map((item: any, idx: number) => ({
            id: item.id || `src-${(idx + 1).toString().padStart(2, '0')}`,
            title: item.title || item.name || `Sumber Web ${idx + 1}`,
            url: item.url || item.link || 'https://google.com',
            snippet: (item.snippet || item.content || item.raw_content || item.description || '').trim().slice(0, 380),
          }));

          const engineUsed = payload.search_engine_used || payload.engine || payload.provider || 'tavily';
          console.log(`✅ [bluefox-search via SDK] Berhasil mendapatkan ${sources.length} sumber (Engine: ${engineUsed})`);
          return { success: true, sources, engineUsed };
        }
      }
    } catch (invokeErr: any) {
      console.warn("⚠️ supabase.functions.invoke error, mencoba direct fetch fallback:", invokeErr?.message);
    }

    // 2. Direct HTTPS fetch ke Edge Function
    const edgeFunctionUrl = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-search';
    const anonKey = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

    const directRes = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (options?.signal) options.signal.removeEventListener('abort', onAbort);

    if (directRes.ok) {
      const data = await directRes.json();
      const rawSources = data.sources || (Array.isArray(data) ? data : (data.data?.sources || data.results || data.data?.results || data.organic || []));

      if (Array.isArray(rawSources) && rawSources.length > 0) {
        const sources: SearchSource[] = rawSources.map((item: any, idx: number) => ({
          id: item.id || `src-${(idx + 1).toString().padStart(2, '0')}`,
          title: item.title || item.name || `Sumber Web ${idx + 1}`,
          url: item.url || item.link || 'https://google.com',
          snippet: (item.snippet || item.content || item.raw_content || item.description || '').trim().slice(0, 380),
        }));

        const engineUsed = data.search_engine_used || data.engine || data.provider || 'tavily';
        console.log(`✅ [bluefox-search direct fetch] Berhasil mendapatkan ${sources.length} sumber (Engine: ${engineUsed})`);
        return { success: true, sources, engineUsed };
      }
    }

    return { success: false, sources: [], error: `bluefox-search returned HTTP ${directRes.status}` };
  } catch (err: any) {
    console.warn("⚠️ [bluefox-search] Gagal:", err?.message || err);
    return { success: false, sources: [], error: err?.message || 'Gagal memanggil bluefox-search' };
  }
}

/**
 * Primary Direct Engine: Tavily AI Search dengan mode advance & basic
 */
export async function searchWithTavily(
  query: string, 
  apiKey?: string, 
  isAdvanced: boolean = false,
  signal?: AbortSignal
): Promise<{ success: boolean; sources: SearchSource[]; error?: string }> {
  const effectiveKey = apiKey || (typeof process !== 'undefined' ? process.env.TAVILY_API_KEY : '');
  if (!effectiveKey || effectiveKey === 'YOUR_TAVILY_API_KEY') {
    return { success: false, sources: [], error: 'Tavily API key is missing or not configured.' };
  }

  const cleanQ = cleanSearchQuery(query);
  if (!cleanQ) return { success: false, sources: [] };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), isAdvanced ? 6000 : 4000);

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: effectiveKey,
        query: cleanQ,
        search_depth: isAdvanced ? 'advanced' : 'basic',
        include_answer: true,
        max_results: isAdvanced ? 8 : 5,
      }),
      signal: signal || controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, sources: [], error: `Tavily returned HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0) {
      return { success: false, sources: [], error: 'Tavily returned 0 results.' };
    }

    const sources: SearchSource[] = results.map((item: any, idx: number) => ({
      id: `src-${(idx + 1).toString().padStart(2, '0')}`,
      title: item.title || `Sumber Web ${idx + 1}`,
      url: item.url || 'https://www.google.com',
      snippet: (item.content || item.snippet || item.raw_content || '').trim().slice(0, 350),
    }));

    return { success: true, sources };
  } catch (err: any) {
    return { success: false, sources: [], error: err.message || 'Tavily search network timeout or failed' };
  }
}

/**
 * Fallback Engine: DuckDuckGo Search
 */
export async function searchWithDuckDuckGo(
  query: string,
  signal?: AbortSignal
): Promise<{ success: boolean; sources: SearchSource[]; error?: string }> {
  const cleanQ = cleanSearchQuery(query);
  if (!cleanQ) return { success: false, sources: [] };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    // 1. DuckDuckGo HTML Search
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: signal || controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const sources: SearchSource[] = [];
      const resultBlocks = html.split(/class="result\s+results_links/g).slice(1);

      for (let i = 0; i < resultBlocks.length && sources.length < 6; i++) {
        const block = resultBlocks[i];
        const urlMatch = block.match(/href="([^"]+)"/);
        const titleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
                             block.match(/<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);

        if (urlMatch && titleMatch) {
          let rawUrl = urlMatch[1];
          if (rawUrl.includes('uddg=')) {
            const matchUddg = rawUrl.match(/uddg=([^&]+)/);
            if (matchUddg && matchUddg[1]) {
              try {
                rawUrl = decodeURIComponent(matchUddg[1]);
              } catch {}
            }
          }

          const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
          const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

          if (rawTitle && rawUrl.startsWith('http')) {
            sources.push({
              id: `src-${(sources.length + 1).toString().padStart(2, '0')}`,
              title: rawTitle,
              url: rawUrl,
              snippet: rawSnippet.slice(0, 350),
            });
          }
        }
      }

      if (sources.length > 0) {
        return { success: true, sources };
      }
    }

    // 2. DuckDuckGo Instant Answer API Fallback
    const apiRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&format=json&no_html=1&skip_disambig=1`, {
      signal: signal || controller.signal,
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      const sources: SearchSource[] = [];

      if (data.AbstractText && data.AbstractURL) {
        sources.push({
          id: 'src-01',
          title: data.Heading || data.AbstractSource || 'DuckDuckGo Instant Answer',
          url: data.AbstractURL,
          snippet: data.AbstractText.slice(0, 350),
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL && sources.length < 6) {
            sources.push({
              id: `src-${(sources.length + 1).toString().padStart(2, '0')}`,
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
              url: topic.FirstURL,
              snippet: topic.Text.slice(0, 350),
            });
          }
        }
      }

      if (sources.length > 0) {
        return { success: true, sources };
      }
    }

    return { success: false, sources: [], error: 'DuckDuckGo returned 0 results.' };
  } catch (err: any) {
    return { success: false, sources: [], error: err.message || 'DuckDuckGo search failed' };
  }
}

/**
 * 2.2 Dual-Engine Fallback Pipeline Execution dengan Multi-Query (3-5 Search) & Auto-Advance
 */
export async function executeDualEngineSearch(
  rawQuery: string,
  options?: {
    forceSearch?: boolean;
    forceAdvance?: boolean;
    tavilyApiKey?: string;
    signal?: AbortSignal;
  }
): Promise<SearchResultPayload> {
  const isNeeded = options?.forceSearch || detectSearchIntent(rawQuery);
  if (!isNeeded) {
    return {
      has_sources: false,
      search_engine_used: null,
      sources: [],
      contextSnippet: '',
    };
  }

  const cleanQ = cleanSearchQuery(rawQuery);
  const isMap = detectMapSearch(rawQuery);
  const isAdvance = Boolean(options?.forceAdvance || detectNeedAdvanceSearch(rawQuery));

  // Tentukan mode search untuk limit calculation
  let searchMode: SearchModeType = 'standard';
  if (isMap && isAdvance) searchMode = 'map_advanced';
  else if (isMap) searchMode = 'map_standard';
  else if (isAdvance) searchMode = 'advanced';

  // Perluas pencarian menjadi 3-5 sub-queries
  const searchQueries = generateExpandedQueries(cleanQ, isAdvance ? 5 : 3);
  console.log(`🔍 [Multi-Search] Menjalankan ${searchQueries.length} pencarian web (Mode: ${searchMode}, Advance: ${isAdvance})`);

  let allCollectedSources: SearchSource[] = [];
  let primaryEngineUsed: string = 'tavily';

  // Eksekusi multi-query: cari query utama + variasi
  for (let i = 0; i < searchQueries.length; i++) {
    const currentQ = searchQueries[i];

    // 1. Coba Edge Function 'bluefox-search'
    const edgeRes = await searchWithSupabaseEdgeFunction(currentQ, {
      isAdvanced: isAdvance,
      signal: options?.signal,
    });

    if (edgeRes.success && edgeRes.sources.length > 0) {
      primaryEngineUsed = edgeRes.engineUsed || 'tavily';
      allCollectedSources.push(...edgeRes.sources);
    } else {
      // 2. Direct Tavily Fallback
      const tavilyRes = await searchWithTavily(currentQ, options?.tavilyApiKey, isAdvance, options?.signal);
      if (tavilyRes.success && tavilyRes.sources.length > 0) {
        primaryEngineUsed = 'tavily';
        allCollectedSources.push(...tavilyRes.sources);
      } else {
        // 3. DuckDuckGo Fallback
        const ddgRes = await searchWithDuckDuckGo(currentQ, options?.signal);
        if (ddgRes.success && ddgRes.sources.length > 0) {
          primaryEngineUsed = 'duckduckgo';
          allCollectedSources.push(...ddgRes.sources);
        }
      }
    }

    // Jika sudah mengumpulkan cukup sumber unik (>= 5 sumber), kita bisa lanjut
    const uniqueUrlCount = new Set(allCollectedSources.map(s => s.url)).size;
    if (uniqueUrlCount >= (isAdvance ? 5 : 4)) break;
  }

  // Deduplikasi sumber berdasarkan URL
  const seenUrls = new Set<string>();
  const finalSources: SearchSource[] = [];

  for (const item of allCollectedSources) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    finalSources.push({
      ...item,
      id: `src-${(finalSources.length + 1).toString().padStart(2, '0')}`,
    });
    if (finalSources.length >= (isAdvance ? 5 : 4)) break;
  }

  if (finalSources.length > 0) {
    console.log(`✅ [Multi-Search Berhasil] Ditemukan ${finalSources.length} sumber terverifikasi via ${primaryEngineUsed}`);
    const engineType = primaryEngineUsed.toLowerCase().includes('duck') ? 'duckduckgo' : 'tavily';
    const contextSnippet = formatSearchContext(finalSources, engineType, isAdvance);
    return {
      has_sources: true,
      search_engine_used: primaryEngineUsed,
      sources: finalSources,
      contextSnippet,
      searchMode,
      queriesRun: searchQueries,
    };
  }

  console.warn('❌ [Multi-Search] Tidak ada sumber ditemukan untuk semua variasi query.');
  return {
    has_sources: false,
    search_engine_used: null,
    sources: [],
    contextSnippet: '',
    searchMode,
    queriesRun: searchQueries,
  };
}

/**
 * Pencegahan Serangan XSS: Sanitasi String
 */
export function sanitizeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format search sources into prompt injection context string
 */
export function formatSearchContext(
  sources: SearchSource[], 
  engine: 'tavily' | 'duckduckgo' | string,
  isAdvanced: boolean = false
): string {
  const isDdg = engine.toLowerCase().includes('duck');
  const engineLabel = isDdg ? 'DuckDuckGo Web Search' : (isAdvanced ? 'Tavily AI Advanced Search' : 'Tavily AI Search');
  const sourceBlocks = sources
    .map(
      (s, i) => {
        const trimmedSnippet = (s.snippet || '').trim().slice(0, 350);
        return `[Sumber ${i + 1}] ID: ${s.id}\nJudul: ${s.title}\nURL: ${s.url}\nRingkasan Fakta: ${trimmedSnippet}`;
      }
    )
    .join('\n\n');

  return `[DATA WEB TERBARU] (Hasil Mesin Pencari: ${engineLabel} - Akurasi Tinggi)\n${sourceBlocks}`;
}

/**
 * Konfigurasi System Prompt Bluefox
 */
export const BLUEFOX_SYSTEM_PROMPT = `[SYSTEM PROMPT INSTRUCTION FOR BLUEFOX]

Role: Kamu adalah AI Asisten resmi untuk ekosistem Bluefox / TMPA.
Kemampuan:
- Memproses analisis gambar & dokumen via agnes-2.5-flash.
- Mengolah tugas pemrograman & teks via tencent-hy3-free dan laguna-s-2.1.
- Meneruskan status error HTTP asli (400, 429, 500, 502, 504) secara transparan jika koneksi atau data mengalami kendala.

Aturan Output:
- Jangan menyembunyikan status kesalahan sistem.
- Berikan respon ringkas, terstruktur, dan bersih dari elemen tidak perlu.

Aturan Pencarian Web & Penggunaan Data:
1. Jika terdapat blok [DATA WEB TERBARU], gunakan informasi tersebut sebagai referensi utama jawabanmu.
2. Jawab pertanyaan pengguna secara ringkas, jelas, terstruktur, dan akurat.
3. Jangan menyertakan URL panjang secara langsung di dalam teks obrolan.
4. Apabila data dari web tidak ditemukan atau gagal, sampaikan secara jujur bahwa informasi terbaru belum tersedia.`;
