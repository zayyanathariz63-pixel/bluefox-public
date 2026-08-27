import { SearchSource } from '../types';
import { supabase, supabaseUrl, supabaseKey } from './supabase';

export interface SearchResultPayload {
  has_sources: boolean;
  search_engine_used: 'tavily' | 'duckduckgo' | string | null;
  sources: SearchSource[];
  contextSnippet: string;
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
    lower.startsWith('search:') ||
    lower.startsWith('/search')
  ) {
    return true;
  }

  // 2. High-priority keyword triggers as stated in the PRD
  const prdTriggers = [
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
    'trending sekarang'
  ];

  for (const trigger of prdTriggers) {
    if (lower.includes(trigger)) return true;
  }

  // 3. Regular expressions for dynamic facts, years, and real-time questions
  const patterns = [
    /\b(harga|tarif|biaya|promo|diskon)\s+([a-z0-9]+)/i,
    /\b(berita|kabar|isu|peristiwa|kejadian)\s+(terkini|terbaru|hari ini|minggu ini|dari|tentang)/i,
    /\b(apakah|benarkah|beneran)\s+(sudah|sedang|ada|terjadi)/i,
    /\b(cek|cari|search|browsing)\s+(informasi|data|fakta|spek|spesifikasi|berita)/i,
    /\b(rilis|launching|peluncuran)\s+(tahun|bulan|terbaru|2024|2025|2026|2027)/i,
    /\b(presiden|menteri|gubernur|ceo|pemimpin|juara|skor)\s+(sekarang|terbaru|saat ini|hari ini)/i,
    /\b(skor|hasil|klasemen|jadwal)\s+(liga|piala|f1|motogp|badminton|esport|timnas)/i,
  ];

  return patterns.some(pattern => pattern.test(lower));
}

/**
 * Membersihkan query pencarian dari prefix prompt / command agar hasil search akurat.
 */
export function cleanSearchQuery(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/^@(search|web)\s*/i, '')
    .replace(/^search:\s*/i, '')
    .replace(/^\/search\s*/i, '')
    .replace(/^(tolong\s+)?(cari tahu|carikan|cek|apakah benar|tolong cek|bantu cari|apa saja|apa)\s+/i, '')
    .trim();
}

/**
 * [ 3 ] Pemanggilan Supabase Edge Function 'bluefox-search'
 * Endpoint: https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-search
 */
export async function searchWithSupabaseEdgeFunction(
  query: string,
  signal?: AbortSignal
): Promise<{ success: boolean; sources: SearchSource[]; engineUsed?: string; error?: string }> {
  const cleanQ = cleanSearchQuery(query);
  if (!cleanQ) return { success: false, sources: [] };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const onAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    console.log(`🌐 [Supabase Edge Function] Memanggil bluefox-search untuk: "${cleanQ}"`);

    // 1. Coba melalui supabase.functions.invoke()
    try {
      const invokeRes = await supabase.functions.invoke('bluefox-search', {
        body: { query: cleanQ },
      });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);

      if (invokeRes.data && !invokeRes.error) {
        const payload = invokeRes.data;
        const rawSources = payload.sources || (Array.isArray(payload) ? payload : (payload.data?.sources || payload.results || []));
        
        if (Array.isArray(rawSources) && rawSources.length > 0) {
          const sources: SearchSource[] = rawSources.map((item: any, idx: number) => ({
            id: item.id || `src-${(idx + 1).toString().padStart(2, '0')}`,
            title: item.title || `Sumber Web ${idx + 1}`,
            url: item.url || 'https://google.com',
            snippet: (item.snippet || item.content || item.raw_content || '').trim().slice(0, 300),
          }));

          const engineUsed = payload.search_engine_used || payload.engine || 'tavily';
          console.log(`✅ [bluefox-search via SDK] Berhasil mendapatkan ${sources.length} sumber (Engine: ${engineUsed})`);
          return { success: true, sources, engineUsed };
        }
      }
    } catch (invokeErr: any) {
      console.warn("⚠️ supabase.functions.invoke error, mencoba direct fetch fallback:", invokeErr?.message);
    }

    // 2. Direct HTTPS fetch ke https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-search
    const edgeFunctionUrl = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-search';
    const anonKey = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

    const directRes = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ query: cleanQ }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onAbort);

    if (directRes.ok) {
      const data = await directRes.json();
      const rawSources = data.sources || (Array.isArray(data) ? data : (data.data?.sources || data.results || []));

      if (Array.isArray(rawSources) && rawSources.length > 0) {
        const sources: SearchSource[] = rawSources.map((item: any, idx: number) => ({
          id: item.id || `src-${(idx + 1).toString().padStart(2, '0')}`,
          title: item.title || `Sumber Web ${idx + 1}`,
          url: item.url || 'https://google.com',
          snippet: (item.snippet || item.content || item.raw_content || '').trim().slice(0, 300),
        }));

        const engineUsed = data.search_engine_used || data.engine || 'tavily';
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
 * 3.1 Primary Direct Engine: Tavily AI Search (Timeout strictly 4000ms / 4s per PRD [5])
 */
export async function searchWithTavily(
  query: string, 
  apiKey?: string, 
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
    // PRD [5]: Pengaturan Batas Waktu Respon (Timeout) Tavily API maksimal 4 detik (4.000 ms)
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: effectiveKey,
        query: cleanQ,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
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
      snippet: (item.content || item.snippet || item.raw_content || '').trim().slice(0, 300),
    }));

    return { success: true, sources };
  } catch (err: any) {
    return { success: false, sources: [], error: err.message || 'Tavily search network timeout or failed' };
  }
}

/**
 * 3.1 Fallback Engine: DuckDuckGo Search (Zero API Key Requirement)
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

      // Extract result anchors and snippets using robust regex
      const resultBlocks = html.split(/class="result\s+results_links/g).slice(1);

      for (let i = 0; i < resultBlocks.length && sources.length < 5; i++) {
        const block = resultBlocks[i];

        // Title and URL extraction
        const urlMatch = block.match(/href="([^"]+)"/);
        const titleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
                             block.match(/<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);

        if (urlMatch && titleMatch) {
          let rawUrl = urlMatch[1];
          // DuckDuckGo redirect wrapper: /l/?uddg=...
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
              snippet: rawSnippet.slice(0, 320),
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
          snippet: data.AbstractText.slice(0, 320),
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL && sources.length < 5) {
            sources.push({
              id: `src-${(sources.length + 1).toString().padStart(2, '0')}`,
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
              url: topic.FirstURL,
              snippet: topic.Text.slice(0, 320),
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
 * 2.2 Dual-Engine Fallback Pipeline Execution
 * Alur: Supabase Edge Function (bluefox-search) -> Direct Tavily AI -> DuckDuckGo Fallback
 */
export async function executeDualEngineSearch(
  rawQuery: string,
  options?: {
    forceSearch?: boolean;
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
  console.log(`🔍 [Web Search] Memulai pencarian web untuk: "${cleanQ}"`);

  // Step 1: Panggil Supabase Edge Function 'bluefox-search' (User Edge Engine)
  console.log('⚡ [Web Search] Mencoba Edge Function: bluefox-search...');
  const edgeSearchResult = await searchWithSupabaseEdgeFunction(cleanQ, options?.signal);

  if (edgeSearchResult.success && edgeSearchResult.sources.length > 0) {
    console.log(`✅ [Web Search] bluefox-search Sukses (${edgeSearchResult.sources.length} sumber ditemukan)`);
    const engineType = (edgeSearchResult.engineUsed?.toLowerCase().includes('duck') ? 'duckduckgo' : 'tavily') as 'tavily' | 'duckduckgo';
    const contextSnippet = formatSearchContext(edgeSearchResult.sources, engineType);
    return {
      has_sources: true,
      search_engine_used: edgeSearchResult.engineUsed || 'tavily',
      sources: edgeSearchResult.sources,
      contextSnippet,
    };
  }

  // Step 2: Fallback Direct Primary Engine (Tavily AI)
  console.log('⚡ [Web Search] Mencoba Direct Tavily AI...');
  const tavilyResult = await searchWithTavily(cleanQ, options?.tavilyApiKey, options?.signal);

  if (tavilyResult.success && tavilyResult.sources.length > 0) {
    console.log(`✅ [Web Search] Direct Tavily AI Sukses (${tavilyResult.sources.length} sumber ditemukan)`);
    const contextSnippet = formatSearchContext(tavilyResult.sources, 'tavily');
    return {
      has_sources: true,
      search_engine_used: 'tavily',
      sources: tavilyResult.sources,
      contextSnippet,
    };
  }

  // Step 3: Fallback Engine (DuckDuckGo)
  console.warn(`⚠️ [Web Search] Edge & Tavily tidak menghasilkan data, mengaktifkan Fallback: DuckDuckGo...`);
  const ddgResult = await searchWithDuckDuckGo(cleanQ, options?.signal);

  if (ddgResult.success && ddgResult.sources.length > 0) {
    console.log(`✅ [Web Search] DuckDuckGo Fallback Sukses (${ddgResult.sources.length} sumber ditemukan)`);
    const contextSnippet = formatSearchContext(ddgResult.sources, 'duckduckgo');
    return {
      has_sources: true,
      search_engine_used: 'duckduckgo',
      sources: ddgResult.sources,
      contextSnippet,
    };
  }

  console.warn('❌ [Web Search] Semua mesin pencari web tidak menghasilkan data.');
  return {
    has_sources: false,
    search_engine_used: null,
    sources: [],
    contextSnippet: '',
  };
}

/**
 * 4.3 & [5] Pencegahan Serangan XSS: Sanitasi String
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
 * PRD [5]: Ringkasan teks (snippet) yang dikirim ke LLM dipotong maksimal 200 karakter per sumber
 */
export function formatSearchContext(sources: SearchSource[], engine: 'tavily' | 'duckduckgo' | string): string {
  const isDdg = engine.toLowerCase().includes('duck');
  const engineLabel = isDdg ? 'DuckDuckGo Web Search' : 'Tavily AI Search';
  const sourceBlocks = sources
    .map(
      (s, i) => {
        const trimmedSnippet = (s.snippet || '').trim().slice(0, 200);
        return `[Sumber ${i + 1}] ID: ${s.id}\nJudul: ${s.title}\nURL: ${s.url}\nRingkasan Fakta: ${trimmedSnippet}`;
      }
    )
    .join('\n\n');

  return `[DATA WEB TERBARU] (Hasil Mesin Pencari: ${engineLabel})\n${sourceBlocks}`;
}

/**
 * 3.3 Konfigurasi System Prompt Bluefox
 */
export const BLUEFOX_SYSTEM_PROMPT = `Kamu adalah Bluefox, asisten AI yang akurat dan terpercaya.

Aturan Pencarian Web & Penggunaan Data:
1. Jika terdapat blok [DATA WEB TERBARU], gunakan informasi tersebut sebagai referensi utama jawabanmu.
2. Jawab pertanyaan pengguna secara ringkas, jelas, dan mudah dipahami.
3. Jangan menyertakan URL panjang secara langsung di dalam teks obrolan.
4. Apabila data dari web tidak ditemukan atau gagal, sampaikan secara jujur bahwa informasi terbaru belum tersedia.`;
