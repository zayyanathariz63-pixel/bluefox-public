import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  // API Route for Chat with Realtime Streaming & Autonomous Self-Validation
  app.post("/api/chat", async (req, res) => {
    const abortController = new AbortController();
    
    // Stop server-side processing immediately if user cancels / disconnects
    req.on("close", () => {
      if (!res.writableEnded) {
        console.log("🛑 Client disconnected / requested stop. Aborting AI generation.");
        abortController.abort();
      }
    });

    try {
      const { history = [], message = "", model = "agnes-2.0-flash", customInstruction = "", reasoningMode = "" } = req.body;
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY;

      const modelMapping: { [key: string]: string } = {
        agnes_2_0_flash: "agnes-2.0-flash",
        laguna_s_2_1: "laguna-s-2.1",
        tencent_hy3_free: "tencent-hy3-free",
        "agnes-2.0-flash": "agnes-2.0-flash",
        "laguna-s-2.1": "laguna-s-2.1",
        "tencent-hy3-free": "tencent-hy3-free",
        qwen3_coder: "agnes-2.0-flash",
        gpt_oss: "tencent-hy3-free",
        mistral_nemotron: "laguna-s-2.1"
      };

      const requestedModelId = modelMapping[model] || "agnes-2.0-flash";

      // Detect special trigger command modes
      const isVerifyAi = message.includes('[VERIFY-AI PROTOKOL') || message.toLowerCase().startsWith('@verifyai');
      const isDeepVerify = message.includes('[DEEP REASONING') || message.toLowerCase().startsWith('@deep verify');
      const isCreative = message.includes('[CREATIVE DYNAMIC') || message.toLowerCase().startsWith('@creative');

      // Base Prompts
      const DILO_SYSTEM_PROMPT = `Anda adalah Dilo, AI resmi keluarga besar TMPA. Ramah, santai, ceria, suportif. Gunakan bahasa Indonesia luwes sehari-hari.`;
      const TMPA_V2_SYSTEM_PROMPT = `Anda adalah TMPA v2 (The Multi Platform AI). Cerdas, presisi, chill, lugas, tanpa emoji jika mode normal.`;

      let systemPrompt = model === "mistral_nemotron" ? DILO_SYSTEM_PROMPT : TMPA_V2_SYSTEM_PROMPT;
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

      // Setup Server-Sent Events (SSE) for Realtime Streaming Typewriter
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const sendChunk = (text: string) => {
        if (!res.writableEnded && text) {
          res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
        }
      };

      const sendDone = (fullText: string) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
          res.end();
        }
      };

      let accumulatedText = "";
      let successfullyGenerated = false;

      // 1. Coba Gemini Streaming jika API Key tersedia
      if (geminiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const chatContents = [];
          
          for (const msg of formattedMessages) {
            if (msg.role !== "system") {
              chatContents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
              });
            }
          }

          const streamResult = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
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
          }
        } catch (geminiErr: any) {
          console.warn("⚠️ Gemini stream gagal/fallback:", geminiErr?.message || geminiErr);
        }
      }

      // 2. Fallback: Router Bynara / OpenRouter Streaming
      if (!successfullyGenerated && openRouterKey && openRouterKey !== "YOUR_OPENROUTER_API_KEY") {
        try {
          const modelsToTry = [requestedModelId, "agnes-2.0-flash", "laguna-s-2.1", "tencent-hy3-free"];
          for (const mId of modelsToTry) {
            if (abortController.signal.aborted) break;
            try {
              console.log(`Trying stream on Router Bynara: ${mId}`);
              const response = await fetch("https://router.bynara.id/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${openRouterKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://ai.studio/build",
                  "X-Title": "tmpa chat"
                },
                body: JSON.stringify({
                  model: mId,
                  messages: formattedMessages,
                  temperature: isCreative ? 0.95 : 0.7,
                  max_tokens: 3000,
                  stream: true
                }),
                signal: abortController.signal
              });

              if (response.ok && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done || abortController.signal.aborted) break;
                  
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data:")) continue;
                    const dataStr = trimmed.replace(/^data:\s*/, "");
                    if (dataStr === "[DONE]") continue;
                    try {
                      const json = JSON.parse(dataStr);
                      const delta = json.choices?.[0]?.delta?.content || "";
                      if (delta) {
                        accumulatedText += delta;
                        sendChunk(delta);
                      }
                    } catch {}
                  }
                }

                if (accumulatedText.trim().length > 0) {
                  successfullyGenerated = true;
                  break;
                }
              }
            } catch (rErr: any) {
              console.warn(`Router ${mId} failed:`, rErr?.message);
            }
          }
        } catch (routerErr: any) {
          console.error("Router error:", routerErr);
        }
      }

      // 3. Fallback: NVIDIA NIM API
      if (!successfullyGenerated && nvidiaKey && nvidiaKey !== "YOUR_NVIDIA_API_KEY") {
        try {
          const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${nvidiaKey.trim()}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "meta/llama-3.1-70b-instruct",
              messages: formattedMessages,
              temperature: 0.7,
              max_tokens: 2048
            }),
            signal: abortController.signal
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || "";
            if (text) {
              accumulatedText = text;
              sendChunk(text);
              successfullyGenerated = true;
            }
          }
        } catch (nvidiaErr: any) {
          console.error("NVIDIA API failed:", nvidiaErr);
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
