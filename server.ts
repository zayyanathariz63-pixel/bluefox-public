import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { executeDualEngineSearch, BLUEFOX_SYSTEM_PROMPT } from "./src/lib/search";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large file and vision payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Global CORS Middleware - Ensures browser preflights and iframe cross-origin calls succeed
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey, x-client-info"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  // API Route to extract Supabase session from HTTP-Only cookies
  app.get("/api/auth/cookie-session", (req, res) => {
    try {
      const cookies: Record<string, string> = {};
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
          try {
            const parts = cookie.split('=');
            if (parts.length >= 1) {
              const name = parts[0].trim();
              const val = parts.slice(1).join('=').trim();
              try {
                cookies[name] = decodeURIComponent(val);
              } catch {
                cookies[name] = val;
              }
            }
          } catch (e) {
            console.error("Gagal parse sisa cookie individual:", e);
          }
        });
      }

      let accessToken = "";
      let refreshToken = "";

      for (const [key, val] of Object.entries(cookies)) {
        try {
          const lowerKey = key.toLowerCase();
          if (lowerKey === 'access_token' || lowerKey === 'sb-access-token' || lowerKey.endsWith('access-token') || lowerKey.endsWith('access_token')) {
            accessToken = val;
          }
          if (lowerKey === 'refresh_token' || lowerKey === 'sb-refresh-token' || lowerKey.endsWith('refresh-token') || lowerKey.endsWith('refresh_token')) {
            refreshToken = val;
          }
        } catch {}
      }

      if (!accessToken || !refreshToken) {
        for (const [key, val] of Object.entries(cookies)) {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            try {
              let parsedVal = val;
              if (parsedVal.startsWith('"') && parsedVal.endsWith('"')) {
                parsedVal = parsedVal.substring(1, parsedVal.length - 1);
              }
              
              let parsedObj = null;
              try {
                parsedObj = JSON.parse(parsedVal);
              } catch {
                try {
                  const decoded = Buffer.from(parsedVal, 'base64').toString('utf8');
                  parsedObj = JSON.parse(decoded);
                } catch {}
              }

              if (parsedObj) {
                if (Array.isArray(parsedObj)) {
                  if (parsedObj[0]) accessToken = parsedObj[0];
                  if (parsedObj[1]) refreshToken = parsedObj[1];
                } else if (typeof parsedObj === 'object') {
                  accessToken = parsedObj.access_token || parsedObj.accessToken || accessToken;
                  refreshToken = parsedObj.refresh_token || parsedObj.refreshToken || refreshToken;
                }
              }
            } catch (e) {
              console.error("Gagal parse Supabase auth cookie:", e);
            }
          }
        }
      }

      if (!accessToken) {
        for (const [key, val] of Object.entries(cookies)) {
          try {
            if (val.startsWith('eyJ') && val.split('.').length === 3) {
              accessToken = val;
            }
          } catch {}
        }
      }

      if (accessToken && accessToken.startsWith('"') && accessToken.endsWith('"')) {
        accessToken = accessToken.substring(1, accessToken.length - 1);
      }
      if (refreshToken && refreshToken.startsWith('"') && refreshToken.endsWith('"')) {
        refreshToken = refreshToken.substring(1, refreshToken.length - 1);
      }

      if (accessToken) {
        return res.json({
          access_token: accessToken,
          refresh_token: refreshToken || accessToken
        });
      }

      return res.json({ access_token: null, refresh_token: null });
    } catch (routeError: any) {
      console.error("Crash di route cookie-session:", routeError);
      return res.json({ access_token: null, refresh_token: null, error: routeError.message });
    }
  });

  // API Route to securely expose Supabase client config to public static pages
  app.get("/api/config", (req, res) => {
    return res.json({
      supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co',
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'dummy_anon_key'
    });
  });

  // Helper function to strip emojis when needed
  const cleanEmojis = (text: string, currentModel: string, reasoningMode: string) => {
    if (!text) return text;
    if (currentModel === "mistral_nemotron" && reasoningMode !== "penalaran") {
      return text;
    }
    return text.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu, '');
  };

  // API Route for Standalone Web Search (Dual-Engine: Tavily -> DuckDuckGo)
  app.all("/api/search", async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).end();
    try {
      const payload = req.method === "GET" ? req.query : (req.body || {});
      const { query = "", force = true } = payload as any;
      const searchRes = await executeDualEngineSearch(String(query || ""), {
        forceSearch: force === true || force === "true",
        tavilyApiKey: process.env.TAVILY_API_KEY,
      });

      return res.json({
        status: "success",
        data: {
          has_sources: searchRes.has_sources,
          search_engine_used: searchRes.search_engine_used,
          sources: searchRes.sources,
        },
      });
    } catch (err: any) {
      console.error("Error in /api/search route:", err);
      return res.status(500).json({
        status: "error",
        message: err.message || "Gagal melakukan pencarian web",
      });
    }
  });

  // API Route for Chat with Realtime Streaming, Dual-Engine Search & Autonomous Self-Validation
  app.all("/api/chat", async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).end();
    const abortController = new AbortController();
    
    // Stop server-side processing immediately if user cancels / disconnects
    req.on("aborted", () => {
      console.log("🛑 Client aborted request.");
      abortController.abort();
    });

    try {
      const payload = req.method === "GET" ? req.query : (req.body || {});
      const { 
        history = [], 
        message = "", 
        model = "agnes-2.5-flash", 
        customInstruction = "", 
        reasoningMode = "", 
        smartSelectLevel = "",
        smart_select_level = "",
        reasoning_effort = "",
        forceSearch = false,
        isVision = false,
        is_vision = false,
        vision = false,
        imageUrl = null,
        image_url = null,
        stream = true,
        customApi = null
      } = payload as any;

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY;

      const DEFAULT_MODELS: Record<string, string> = {
        "bluefox-pro": "agnes-2.5-flash",
        "bluefox-standard": "jev",
        "bluefox-dilo": "laguna-s-2.1",
        "tmpa_v2": "jev",
        "tmpa_v1": "laguna-s-2.1",
        "dilo": "laguna-s-2.1",
        "agnes-2.5-flash": "agnes-2.5-flash",
        "jev": "jev",
        "laguna-s-2.1": "laguna-s-2.1",
        // Backward compatibility aliases
        "bluefox_pro": "agnes-2.5-flash",
        "bluefox_standard": "jev",
        "bluefox_standar": "jev",
        "bluefox_dilo": "laguna-s-2.1",
        "tencent-hy3-free": "jev",
        "tencent_hy3_free": "jev",
        "deepseek-v4.1-flash-free": "agnes-2.5-flash",
        "agnes-2.0-flash": "agnes-2.5-flash",
        "longcat-2.0-free": "laguna-s-2.1",
        "qwen3_coder": "agnes-2.5-flash",
        "gpt_oss": "jev",
        "mistral_nemotron": "laguna-s-2.1"
      };

      const requestedModelId = DEFAULT_MODELS[model] || "agnes-2.5-flash";

      // =========================================================================
      // 2.2 DUAL-ENGINE FALLBACK WEB SEARCH (TAVILY -> DUCKDUCKGO)
      // =========================================================================
      const searchRes = await executeDualEngineSearch(message, {
        forceSearch: forceSearch || message.toLowerCase().startsWith('@search') || message.toLowerCase().startsWith('@web'),
        tavilyApiKey: process.env.TAVILY_API_KEY,
        signal: abortController.signal,
      });

      // Detect special trigger command modes
      const isVerifyAi = message.includes('[VERIFY-AI PROTOKOL') || message.toLowerCase().startsWith('@verifyai');
      const isDeepVerify = message.includes('[DEEP REASONING') || message.toLowerCase().startsWith('@deep verify');
      const isCreative = message.includes('[CREATIVE DYNAMIC') || message.toLowerCase().startsWith('@creative');

      // Base Prompts according to PRD 3.3
      const DILO_SYSTEM_PROMPT = `Anda adalah Dilo, AI resmi keluarga besar TMPA. Ramah, santai, ceria, suportif. Gunakan bahasa Indonesia luwes sehari-hari.`;
      const TMPA_V2_SYSTEM_PROMPT = BLUEFOX_SYSTEM_PROMPT;

      let systemPrompt = model === "mistral_nemotron" ? DILO_SYSTEM_PROMPT : TMPA_V2_SYSTEM_PROMPT;

      // Inject web search data context if available
      if (searchRes.has_sources && searchRes.contextSnippet) {
        systemPrompt += `\n\n${searchRes.contextSnippet}`;
      }

      if (customInstruction) {
        systemPrompt += `\n\nInstruksi Kustom Pengguna:\n${customInstruction}`;
      }

      if (isVerifyAi) {
        systemPrompt += `\n\n[PROTOKOL VALIDASI & EVALUASI MANDIRI (@verifyai)]
Anda bertindak sebagai auditor cerdas dan validator mandiri.
Tugas Anda:
1. Evaluasi akurasi data, fakta, rumus matematika, logika koding, atau premis dari pesan sebelumnya.
2. Jika ada kesalahan, tunjukkan letak kekeliruan dengan jelas dan berikan pembetulan yang tepat.
3. Susun jawaban secara terstruktur:
   - 🔍 **Hasil Validasi & Evaluasi Fakta**
   - ⚡ **Klarifikasi / Koreksi**
   - 🎯 **Solusi / Jawaban Terverifikasi**`;
      } else if (isDeepVerify) {
        systemPrompt += `\n\n[PROTOKOL PENALARAN MENDALAM (@deep verify)]
Lakukan penalaran bertahap (step-by-step rigorous derivation).
Tugas Anda:
1. Dekomposisi masalah menjadi langkah-langkah logis fundamental.
2. Uji konsistensi internal setiap langkah sebelum menarik kesimpulan.
3. Tampilkan penalaran analitis yang terstruktur, tajam, dan tidak terbantahkan.`;
      } else if (isCreative) {
        systemPrompt += `\n\n[PROTOKOL KREATIVITAS MAKSIMAL (@creative)]
Gunakan diksi yang ekspresif, analogi segar, metafora hidup, dan eksplorasi ide yang out-of-the-box.
Hindari jawaban klise atau template umum. Hadirkan perspektif baru yang inspiratif dan memukau!`;
      } else if (reasoningMode === "penalaran") {
        systemPrompt += `\n\n[MODE PENALARAN DIAKTIFKAN: Fokus menjawab langsung inti pertanyaan dengan penjelasan analitis tingkat tinggi.]`;
      }

      // Format messages
      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...history.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        { role: 'user', content: message }
      ];

      const isSse = stream !== false && req.headers.accept?.includes("text/event-stream") !== false;

      if (isSse) {
        // Setup Server-Sent Events (SSE) for Realtime Streaming Typewriter
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        // Send initial search sources metadata to frontend immediately
        if (searchRes.has_sources) {
          res.write(`data: ${JSON.stringify({
            type: "search_sources",
            has_sources: true,
            search_engine_used: searchRes.search_engine_used,
            sources: searchRes.sources,
          })}\n\n`);
        }
      }

      const sendChunk = (text: string) => {
        if (isSse && !res.writableEnded && text) {
          res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
        }
      };

      const sendDone = (fullText: string) => {
        if (!res.writableEnded) {
          if (isSse) {
            res.write(`data: ${JSON.stringify({ 
              done: true, 
              fullText,
              conversation_id: req.body.conversation_id || null,
              has_sources: searchRes.has_sources,
              search_engine_used: searchRes.search_engine_used,
              sources: searchRes.sources,
            })}\n\n`);
            res.end();
          } else {
            // Kontrak Respon API Backend PRD 3.2
            res.json({
              status: "success",
              conversation_id: req.body.conversation_id || null,
              data: {
                reply: fullText,
                conversation_id: req.body.conversation_id || null,
                has_sources: searchRes.has_sources,
                search_engine_used: searchRes.search_engine_used,
                sources: searchRes.sources,
              }
            });
          }
        }
      };

      let accumulatedText = "";
      let successfullyGenerated = false;

      // 0. Coba Custom API jika disediakan oleh client / user
      if (customApi && customApi.apiKey && String(customApi.apiKey).trim()) {
        try {
          const endpoint = (customApi.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";
          console.log(`📡 [Custom API] Memanggil endpoint kustom: ${endpoint} (Model: ${customApi.model || "default"})`);
          const customRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${String(customApi.apiKey).trim()}`
            },
            body: JSON.stringify({
              model: customApi.model || "gpt-4o",
              messages: formattedMessages,
              temperature: isCreative ? 0.95 : 0.7,
              stream: false
            }),
            signal: abortController.signal
          });

          if (customRes.ok) {
            const data = await customRes.json();
            const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.reply || "";
            if (text && text.trim()) {
              accumulatedText = text;
              sendChunk(text);
              successfullyGenerated = true;
            }
          } else {
            console.warn(`⚠️ Custom API returned status ${customRes.status}`);
          }
        } catch (cErr: any) {
          console.warn("⚠️ Custom API request error:", cErr?.message || cErr);
        }
      }

      // Hitung tingkat Smart Select / penalaran (none, low, medium, high):
      const chosenLevel = (smartSelectLevel || smart_select_level || reasoning_effort || "").toLowerCase();
      const isPenalaranActive = reasoningMode === "penalaran" || chosenLevel === "high";

      // 1. Pemanggilan Utama: Supabase Edge Function 'bluefox-processor-'
      if (!successfullyGenerated) {
        try {
          const edgeUrl = "https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-processor-";
          const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_zXY2aPqOnPt7j1QKdoZFxQ_x6rOon0U";
          console.log(`📡 [Supabase Edge Function] Memanggil bluefox-processor- untuk: "${message.slice(0, 40)}" (Model: ${requestedModelId})`);

          const edgePayload: any = {
            message,
            history,
            conversation_id: req.body?.conversation_id || null,
            model: requestedModelId,
            is_vision: Boolean(isVision || is_vision || vision || imageUrl || image_url),
            imageUrl: imageUrl || image_url || null,
            image_url: imageUrl || image_url || null,
            reasoning_mode: reasoningMode,
            reasoningMode: reasoningMode,
            smart_select_level: chosenLevel,
            smartSelectLevel: chosenLevel,
            custom_instruction: customInstruction,
            customInstruction: customInstruction,
            customApi: customApi || null,
            custom_api: customApi || null,
            system_prompt: systemPrompt,
            stream: false
          };

          const edgeRes = await fetch(edgeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": anonKey,
              "Authorization": `Bearer ${anonKey}`
            },
            body: JSON.stringify(edgePayload),
            signal: abortController.signal
          });

          if (edgeRes.ok) {
            const edgeData = await edgeRes.json();
            const replyText = edgeData.reply || edgeData.text || edgeData.message || (edgeData.choices?.[0]?.message?.content) || "";
            if (replyText && replyText.trim()) {
              accumulatedText = replyText;
              if (isSse) {
                const words = replyText.match(/\S+\s*/g) || [replyText];
                for (const word of words) {
                  if (abortController.signal.aborted) break;
                  sendChunk(word);
                }
              }
              successfullyGenerated = true;
            }
          } else {
            console.warn(`⚠️ Supabase Edge Function bluefox-processor- returned status ${edgeRes.status}`);
          }
        } catch (edgeErr: any) {
          console.warn("⚠️ Supabase Edge Function bluefox-processor- error:", edgeErr?.message || edgeErr);
        }
      }

      // 2. Fallback: Gemini jika Edge Function mengalami kendala
      if (!successfullyGenerated && geminiKey) {
        try {
          const ai = new GoogleGenAI({ 
            apiKey: geminiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          const chatContents: any[] = [];
          
          for (const msg of formattedMessages) {
            if (msg.role !== "system") {
              const parts: any[] = [{ text: msg.content }];
              chatContents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts
              });
            }
          }

          // Handle inline image attachment if present
          const targetImg = imageUrl || image_url;
          if (targetImg && typeof targetImg === 'string' && targetImg.includes('base64,')) {
            const mimeMatch = targetImg.match(/data:([^;]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64Data = targetImg.split('base64,')[1];
            if (chatContents.length > 0) {
              const lastTurn = chatContents[chatContents.length - 1];
              if (lastTurn.role === 'user') {
                lastTurn.parts.unshift({
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                });
              }
            }
          }

          const geminiModelsToTry = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
          for (const gModel of geminiModelsToTry) {
            if (abortController.signal.aborted) break;
            try {
              const streamResult = await ai.models.generateContentStream({
                model: gModel,
                contents: chatContents,
                config: {
                  systemInstruction: systemPrompt,
                  temperature: isCreative ? 0.95 : (isVerifyAi || isDeepVerify ? 0.3 : 0.7),
                }
              });

              for await (const chunk of streamResult) {
                if (abortController.signal.aborted) {
                  console.log("🛑 Aborted during Gemini stream loop.");
                  break;
                }
                const chunkText = chunk.text;
                if (chunkText) {
                  accumulatedText += chunkText;
                  sendChunk(chunkText);
                }
              }

              if (accumulatedText.trim().length > 0) {
                successfullyGenerated = true;
                break;
              }
            } catch (innerGeminiErr: any) {
              console.warn(`⚠️ Model ${gModel} error:`, innerGeminiErr?.message || innerGeminiErr);
            }
          }
        } catch (geminiErr: any) {
          console.warn("⚠️ Gemini stream gagal/fallback:", geminiErr?.message || geminiErr);
        }
      }

      // 4. Jika semua provider gagal atau tidak ada API Key
      if (!successfullyGenerated) {
        const errorMsg = "⚠️ Layanan AI sedang tidak dapat dihubungi. Pastikan API Key Anda aktif di Settings atau periksa koneksi.";
        sendChunk(errorMsg);
        accumulatedText = errorMsg;
      }

      const finalText = cleanEmojis(accumulatedText, model, reasoningMode);
      sendDone(finalText);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("🛑 Request was aborted cleanly.");
        return;
      }
      console.error("Error in /api/chat route:", error);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message || "Gagal memproses pesan." })}\n\n`);
        res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
