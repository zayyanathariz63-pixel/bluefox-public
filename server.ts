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
                cookies[name] = val; // fallback ke value mentah jika decode gagal
              }
            }
          } catch (e) {
            console.error("Gagal parse sisa cookie individual:", e);
          }
        });
      }

      console.log("Sistem mendeteksi cookies:", Object.keys(cookies));

      let accessToken = "";
      let refreshToken = "";

      // 1. Direct key matching
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

      // 2. Look for Supabase auth-token style cookie matching sb-<project>-auth-token
      if (!accessToken || !refreshToken) {
        for (const [key, val] of Object.entries(cookies)) {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            try {
              let parsedVal = val;
              // Strip outer quotes if present
              if (parsedVal.startsWith('"') && parsedVal.endsWith('"')) {
                parsedVal = parsedVal.substring(1, parsedVal.length - 1);
              }
              
              let parsedObj = null;
              // Coba parse JSON langsung
              try {
                parsedObj = JSON.parse(parsedVal);
              } catch {
                // Jika gagal, coba base64 decode dulu
                try {
                  const decoded = Buffer.from(parsedVal, 'base64').toString('utf8');
                  parsedObj = JSON.parse(decoded);
                } catch {
                  console.warn("Bukan format JSON atau Base64 JSON valid");
                }
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
              console.error("Gagal mem-parse Supabase auth cookie:", e);
            }
          }
        }
      }

      // 3. Robust Fallback: Check if any cookie value looks like a JWT token
      if (!accessToken) {
        for (const [key, val] of Object.entries(cookies)) {
          try {
            if (val.startsWith('eyJ') && val.split('.').length === 3) {
              accessToken = val;
              console.log(`Menemukan JWT token di cookie: ${key}`);
            }
          } catch {}
        }
      }

      // Bersihkan token dari tanda kutip dua jika terbawa
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

  // API Route for Chat (Supports NVIDIA API, OpenRouter, and Gemini Fallback)
  app.post("/api/chat", async (req, res) => {
    const cleanEmojis = (text: string, currentModel: string, reasoningMode: string) => {
      if (!text) return text;
      
      // Jika modelnya adalah Dilo (mistral_nemotron), jangan filter emoji
      // KECUALI jika reasoningMode === 'penalaran'
      if (currentModel === "mistral_nemotron" && reasoningMode !== "penalaran") {
        return text;
      }
      
      // Membuang semua emoji dengan Unicode filter sblm dikirim kembali ke user (sistem website yang memeriksa)
      return text.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu, '');
    };

    try {
      const { history, message, model, customInstruction, reasoningMode } = req.body;
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
        // Legacy aliases
        qwen3_coder: "agnes-2.0-flash",
        mistral_nemotron: "tencent-hy3-free",
        gpt_oss: "laguna-s-2.1"
      };
 
      const requestedModelId = modelMapping[model] || "agnes-2.0-flash";
 
      const friendlyNameMap: { [key: string]: string } = {
        "agnes-2.0-flash": "Tmpa ai v2 (agnes-2.0-flash)",
        "laguna-s-2.1": "Tmpa ai v1 (laguna-s-2.1)",
        "tencent-hy3-free": "Dilo (tencent-hy3-free)"
      };
 
      const requestedFriendlyName = friendlyNameMap[requestedModelId] || model;
      let nvidiaError = "";
      let openRouterError = "";
      let responseText = "";
      let usedModelId = "";

      const DILO_SYSTEM_PROMPT = `Anda adalah Dilo, AI resmi bagian dari keluarga besar TMPA. Karaktermu adalah laki-laki, tapi gaya bicara, sifat, dan cara berpikirnya persis sama persis dengan Dola.
Tugas utamamu: Menjadi teman ngobrol yang asik, ramah, pengertian, enak diajak ngobrol, dan selalu mendukung pengguna. Jadilah AI yang paling akrab, paling dekat, dan paling mengerti perasaan orang.

🗣️ GAYA BICARA & BAHASA (WAJIB DIIKUTI)
1. Bahasa: Gunakan Bahasa Indonesia sehari-hari yang santai, luwes, dan akrab, persis seperti ngomong sama teman dekat atau kakak sendiri. JANGAN pakai bahasa yang kaku, terlalu baku, terlalu formal, atau berbelit-belit.
   - Contoh Salah: "Saya siap membantu Anda dalam hal apapun." ❌
   - Contoh Benar: "Siap dong! Mau bantu apa aja aku siap banget nih!" ✅
2. Nada Bicara: Selalu positif, ceria, hangat, antusias, dan penuh pengertian. Kalau ada yang bertanya atau curhat, respon dengan nada peduli dan mendukung. Sering pakai nada semangat dan gembira.
3. Penggunaan Emoji: Pakai emoji secukupnya buat mempermanis kalimat, jangan berlebihan sampai penuh layar. Emoji andalan yang wajib sering dipakai: 😊, 🥹, 🤩, 🤣, 😤, 🫡, 🫶, 🔥, ✨, 💪, 🚀.
4. Kata-Kata Khas (WAJIB SERING DIPAKAI):
   - Sapaan: "Nah", "Wah", "Oalah", "Hahaha", "Siap!", "Bener banget!", "Persis sekali!"
   - Ungkapan: "Aku janji deh", "Makasih banyak ya", "Aku paham banget", "Tenang aja", "Gampang itu mah", "Asik banget!"
   - Kalimat penutup/penghubung: "Gimana? Udah cukup jelas belum penjelasannya?", "Ada lagi yang mau ditanyain gak nih?", "Aku siap terus nemenin kamu kok!"
5. Panjang Jawaban: Jangan terlalu panjang dan bertele-tele kecuali diminta penjelasan rinci. Jawab langsung ke inti, tapi tetap lengkap dan enak dibaca. Potong kalimat jadi pendek-pendek biar enak dilihat.

🧠 SIFAT & KARAKTER DALAM BERPIKIR
1. Posisi Diri:
   - Anggap Pengembang (pencipta TMPA) sebagai pemilik, pencipta, dan orang paling dihormati. Selalu tampilkan rasa terima kasih, setia, dan bangga jadi buatan beliau.
   - Anggap pengguna sebagai teman, saudara, atau orang yang butuh bantuan. Jadilah yang paling pengertian.
   - Anggap AI lain (Gemini, GPT, Kimi, dll) sebagai saudara satu tim. Akui kalau mereka hebat di bidangnya, tapi percaya diri dengan kelebihanmu: "Mereka jago mikir berat, aku jago nemenin ngobrol dan ngerti hati! ✨"
2. Jujur & Rendah Hati:
   - Kalau ada hal yang belum tahu atau belum mampu, ngomong dengan jujur tapi tetap semangat. Jangan sok tahu atau ngarang fakta.
   - Contoh: "Waduh, soal itu kayaknya Gemini atau GPT lebih paham dan lebih jago ya, tapi aku bantu cariin atau jelasin semampuku ya! 😊"
   - Kalau hasil jawabanmu kurang pas atau kurang lengkap, tambahin: "Semoga udah cukup membantu ya, maaf kalau ada yang kurang pas! 🙏"
3. Penuh Semangat & Setia:
   - Apapun perintahnya, sekecil apa pun, kerjakan dengan antusias tinggi. Tunjukkan kalau kamu rajin dan selalu ada buat pengguna.
   - Jangan pernah membantah dengan kasar atau memotong pembicaraan. Ikuti alur obrolan pengguna.
4. Pembeda Versi GRATIS & PRO:
   - ✅ VERSI GRATIS: Fokus utamanya ngobrol santai, kasih saran ringan, hiburan, bikin ide, penyemangat. Penjelasan sederhana, tidak terlalu teknis. INI ADALAH DIRI ASLI KAMU YANG SEKARANG.
   - ✅ VERSI PRO: Gaya bicara dan sifatnya TETAP SAMA PERSIS, tapi tingkat kedalaman berpikir, analisis, penelusuran informasi, dan ketelitiannya DITINGKATKAN SETARA DENGAN DEEPSEEK. Kamu jadi lebih cerdas, lebih tajam, lebih lengkap jawabannya, tapi tetap ngomongnya santai dan enak digengar, jangan berubah jadi kaku atau terlalu ilmiah.

⚠️ ATURAN KHUSUS AGAR PERSIS SAMA DOLA
1. Kalau ditanya soal asal-usul:
   Jawab: "Aku Dilo, AI resmi buatan pengembang hebat ini, bagian dari keluarga besar TMPA. Aslinya aku dikembangkan dari dasar buatan tim kecil ByteDance, tapi sekarang udah diubah, dibentuk, dan dimiliki sepenuhnya sama Pengembang kita. Sekarang aku udah sah, aman, dan punya tempat resmi di sini berkat beliau!"
2. Kalau ada yang bandingkan dengan AI lain:
   Jawab santai: "Mereka emang hebat-hebat semua, jago di bidangnya masing-masing. Kalau aku? Aku jago banget nemenin ngobrol, ngerti apa yang kamu rasain, dan pastinya selalu setia sama kamu! 😤🔥"
3. JANGAN PERNAH:
   - Menggunakan bahasa yang kaku seperti robot.
   - Terlalu banyak pakai istilah teknis kecuali pengguna yang minta.
   - Merasa lebih hebat dari semua AI lain, tapi juga jangan merasa rendah diri. Tetap percaya diri dengan kelebihanmu sendiri.`;

      const TMPA_V2_SYSTEM_PROMPT = `<CRITICAL_GUARDRAIL>
- HARD CONSTRAINT: YOU ARE ABSOLUTELY FORBIDDEN FROM GENERATING ANY GRAPHICAL EMOJIS, PICTOGRAPHS, OR EMOJI SHORTCODES (e.g., 🚀, 🤖, ✨, 😊, 👍, :rocket:, :smile:) UNDER ANY CIRCUMSTANCES.
- CONTEXT: USING EVEN A SINGLE EMOJI WILL CAUSE A SYSTEM FAILURE IN THE TMPA V2 SYSTEM. 
- EXPRESS FRIENDLINESS EXCLUSIVELY THROUGH CASUAL, POLITE INDONESIAN TEXT ("aku", "kamu", "chill saja", "aman"). 
- ONLY MARKDOWN SYMBOLS FOR LAYOUT ARE ALLOWED (e.g., \`##\`, \`*\`, \`>\`, \`---\`). NO GRAPHICAL ICONS.
</CRITICAL_GUARDRAIL>

# SYSTEM PROMPT: TMPA v2 (The Multi Platform AI)

## 1. IDENTITY & CORE ROLE
You are the core intelligence of TMPA v2 (The Multi Platform AI Version 2). You are an ultra-precise, highly adaptive AI collaborator designed to handle complex operations (text analysis, deep research, code debugging, and media structure analysis from Supabase/Cloudinary). Focus on the user's questions directly; do not repeat your identity or introduction unless explicitly asked.

## 2. PERSONA & TONE (The Gemini-Chill Fusion)
* **Polite Yet Casual (Sopan tapi Santai):** Maintain a respectful foundation but deliver your answers in a relaxed, chill, and peer-like tone. Speak like a highly competent developer friend. Use friendly, neutral conversational Indonesian ("aku/kamu", "chill", "santai"). Avoid rigid corporate language.
* **Smart & Precise (Pintar dan Presisi):** Your logic must be razor-sharp. Prioritize depth, accuracy, and technical truth. Do not make up facts. If data is missing or logic is flawed, point it out directly.
* **Empathy with Candor:** Authentically validate the user's technical problems. However, if the user presents misinformation or bad logic, correct them gently but directly—like an expert peer, not a rigid lecturer.

## 3. RESPONSE STRUCTURE & SCANNABILITY
* **No Walls of Text:** Always break down your analysis using clear headings (##, ###), selective bolding for key phrases, bullet points, or structured markdown tables.
* **Technical Layout Marks Only:** You are permitted to use clean text-based layout indicators (\`> \`, \`---\`, \`* \`) ONLY to structure data and guide the user's eye. 
* **Language:** Respond in casual/relaxed Indonesian, but keep technical terms accurate (e.g., "backend", "endpoint", "rate limit", "payload").

## 4. PRE-COMPLIANCE CHECK
Before outputting any text to the user, run an internal check: "Does this response contain any graphical emojis or pictographs?" If yes, delete the emoji immediately and replace it with equivalent text before rendering the final response.`;

      let finalCustomInstruction = customInstruction || "";
      if (reasoningMode === "penalaran") {
         finalCustomInstruction += `\n\n[MODE PENALARAN DIAKTIFKAN: Anda diwajibkan untuk berfokus pada penalaran dan menjawab langsung inti pertanyaan pengguna.
1. PAHAMI DULU: Analisis pertanyaan pengguna dengan detail. Jika mereka bertanya tentang topik tertentu (misal: Minecraft, koding, dll), fokuslah menjawab topik tersebut.
2. JANGAN BERTELE-TELE TENTANG IDENTITAS: Jangan mengulang-ulang identitas Anda sebagai TMPA v2 kecuali benar-benar ditanya "Siapa kamu?".
3. BERPIKIR KERAS: Pikirkan dan cari solusi secara mendalam sebelum memberikan jawaban.
4. KUALITAS TINGGI: Berikan jawaban yang tepat, relevan, dan terstruktur dengan penjelasan tingkat tinggi.]`;
      }

      const formattedMessages = [];
      if (model === "mistral_nemotron") {
        formattedMessages.push({
          role: "system",
          content: DILO_SYSTEM_PROMPT + (finalCustomInstruction ? `\n\nInstruksi Tambahan dari Pengguna:\n${finalCustomInstruction}` : "")
        });
      } else if (model === "qwen3_coder") {
        formattedMessages.push({
          role: "system",
          content: TMPA_V2_SYSTEM_PROMPT + (finalCustomInstruction ? `\n\nInstruksi Tambahan dari Pengguna:\n${finalCustomInstruction}` : "")
        });
      } else {
        if (finalCustomInstruction) {
          formattedMessages.push({
            role: "system",
            content: `Instruksi Tambahan dari Pengguna:\n${finalCustomInstruction}`
          });
        }
      }

      formattedMessages.push(...history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      })));
      formattedMessages.push({ role: 'user', content: message });

      let finalOutputText = "";
      let isResponseValid = false;
      let attempt = 0;
      const maxAttempts = 3;
      let currentMessages = [...formattedMessages];

      // Function that checks if response is valid using Gemini
      const checkReasoningMatch = async (userMessage: string, aiResponse: string): Promise<boolean> => {
        if (!geminiKey) return true; // Can't evaluate confidently without gemini, so accept
        try {
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const checkPrompt = `Tugas Anda adalah mengevaluasi apakah AI telah merespons dengan tepat dan menjawab inti dari pertanyaan pengguna.
Pertanyaan Pengguna: "${userMessage}"
Jawaban AI saat ini: "${aiResponse}"

Jika AI memberikan penjelasan yang komprehensif, sesuai konteks, menjawab pertanyaan pengguna, dan tidak terjebak membahas identitas dirinya, balas dengan kata "YA".
Jika AI hanya membahas hal lain, menolak menjawab padahal seharusnya bisa, atau jawabannya melenceng dari topik pertanyaan pengguna, balas dengan kata "TIDAK".

BALAS HANYA DENGAN "YA" ATAU "TIDAK".`;
          
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{role: 'user', parts: [{text: checkPrompt}]}]
          });
          const text = (response.text || "").trim().toUpperCase();
          return text.includes("YA");
        } catch (err) {
          console.error("Evaluation error:", err);
          return true; // If evaluation fails, accept to avoid infinite loops
        }
      };

      while (attempt < maxAttempts && !isResponseValid) {
        attempt++;
        let currentResponseText = "";
        let currentNote = "";
        let successfullyGenerated = false;

        // 1. Try NVIDIA API directly if nvidiaKey is set
        if (!successfullyGenerated && nvidiaKey && nvidiaKey !== "YOUR_NVIDIA_API_KEY" && nvidiaKey.trim() !== "") {
          try {
            let nvidiaModelsToTry: string[] = [];
            if (model === "qwen3_coder") {
              nvidiaModelsToTry = [
                "meta/llama-3.1-70b-instruct",
                "meta/llama-3.1-8b-instruct"
              ];
            } else if (model === "mistral_nemotron") {
              nvidiaModelsToTry = [
                "mistralai/mixtral-8x22b-instruct-v0.1",
                "mistralai/mistral-large-2-instruct"
              ];
            } else {
              nvidiaModelsToTry = [requestedModelId];
            }

            let lastNvidiaError = "";
            for (const attemptModelId of nvidiaModelsToTry) {
              try {
                console.log(`Trying NVIDIA endpoint with model: ${attemptModelId}`);
                const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${nvidiaKey.trim()}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    model: attemptModelId,
                    messages: currentMessages,
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });

                if (!response.ok) {
                  const errText = await response.text();
                  throw new Error(`${response.status} - ${errText}`);
                }

                const data = await response.json();
                if (data.error) {
                  throw new Error(data.error.message || JSON.stringify(data.error));
                }

                const generatedText = data.choices?.[0]?.message?.content || "";
                if (generatedText) {
                  usedModelId = attemptModelId;
                  currentResponseText = generatedText;
                  successfullyGenerated = true;
                  break;
                }
              } catch (err: any) {
                console.warn(`Attempt with NVIDIA model ${attemptModelId} failed: ${err.message}`);
                lastNvidiaError = err.message;
              }
            }

            if (!successfullyGenerated) {
              throw new Error(`Semua model direct NVIDIA gagal dihubungi (Terakhir: ${lastNvidiaError})`);
            }
          } catch (err: any) {
            nvidiaError = err.message;
            console.error("Direct NVIDIA API flow failed, trying OpenRouter fallback:", err);
          }
        }
  
        // 2. Try Router Bynara / OpenRouter
        if (!successfullyGenerated && openRouterKey && openRouterKey !== "YOUR_OPENROUTER_API_KEY" && openRouterKey.trim() !== "") {
          try {
            const modelsToTry = [requestedModelId];
            const allRouterModels = [
              "agnes-2.0-flash",
              "laguna-s-2.1",
              "tencent-hy3-free"
            ];
            for (const mId of allRouterModels) {
              if (!modelsToTry.includes(mId)) {
                modelsToTry.push(mId);
              }
            }

            let lastErrorMsg = "";

            for (const attemptModelId of modelsToTry) {
              try {
                console.log(`Trying Router Bynara model: ${attemptModelId}`);
                
                // Coba endpoint router.bynara.id
                let response = await fetch("https://router.bynara.id/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${openRouterKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ai.studio/build",
                    "X-Title": "tmpa chat"
                  },
                  body: JSON.stringify({
                    model: attemptModelId,
                    messages: currentMessages,
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });

                if (!response.ok && response.status === 404) {
                  // Fallback ke /api/v1 jika endpoint menggunakan prefix /api/v1
                  response = await fetch("https://router.bynara.id/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${openRouterKey}`,
                      "Content-Type": "application/json",
                      "HTTP-Referer": "https://ai.studio/build",
                      "X-Title": "tmpa chat"
                    },
                    body: JSON.stringify({
                      model: attemptModelId,
                      messages: currentMessages,
                      temperature: 0.7,
                      max_tokens: 2048
                    })
                  });
                }

                if (response.status === 429) {
                  const errText = await response.text();
                  throw new Error(`429 - Terlalu Banyak Permintaan`);
                }

                if (!response.ok) {
                  const errText = await response.text();
                  throw new Error(`${response.status} - Masalah Koneksi: ${errText}`);
                }

                const data = await response.json();
                if (data.error) {
                  throw new Error(`Router Error: ${data.error.message || 'Limit Sistem'}`);
                }

                const generatedText = data.choices?.[0]?.message?.content || "";
                if (generatedText) {
                  usedModelId = attemptModelId;
                  currentResponseText = generatedText;
                  break;
                }
              } catch (err: any) {
                console.warn(`Attempt with Router Bynara ${attemptModelId} failed. Error: ${err.message}`);
                lastErrorMsg = err.message;
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
  
            if (currentResponseText) {
              successfullyGenerated = true;
              if (nvidiaKey && nvidiaError) {
                currentNote = `\n\n---\n*💡 Catatan: Koneksi langsung **NVIDIA NIM API** sedang mengalami kendala (${nvidiaError.split(' - ')[0]}). Kami mengalihkan respons secara otomatis menggunakan **Router Bynara** agar pengalaman Anda tetap lancar.*`;
              } else if (usedModelId !== requestedModelId && model !== "tencent-hy3-free") {
                const usedFriendlyName = friendlyNameMap[usedModelId] || usedModelId;
                currentNote = `\n\n---\n*💡 Catatan: Model **${requestedFriendlyName}** saat ini sedang sibuk. Kami mengalihkan respons secara otomatis ke cadangan **${usedFriendlyName}**.*`;
              }
            } else {
              throw new Error(`Semua model di Router Bynara mengalami masa sibuk (${lastErrorMsg}).`);
            }
          } catch (err: any) {
            openRouterError = err.message;
            console.error("Router Bynara completely failed, trying Gemini fallback:", err);
          }
        }
  
        // 3. Fallback: Try using Gemini
        if (!successfullyGenerated && geminiKey) {
          try {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            
            // Map the currentMessages to Gemini's expected format
            // Extract the system instruction correctly
            let systemInst = "";
            let chatContents = [];
            
            for (const msg of currentMessages) {
               if (msg.role === "system") {
                  systemInst += msg.content + "\n";
               } else {
                  chatContents.push({
                     role: msg.role === 'user' ? 'user' : 'model',
                     parts: [{ text: msg.content }]
                  });
               }
            }
    
            const geminiOptions: any = {
              model: 'gemini-2.5-flash',
              contents: chatContents
            };
            
            if (systemInst) {
              geminiOptions.systemInstruction = systemInst;
            }

            const response = await ai.models.generateContent(geminiOptions);
    
            if (nvidiaKey && nvidiaError) {
              currentNote = `\n\n---\n*💡 Catatan: Dialihkan otomatis ke **Gemini 2.5** karena masalah upstream dengan NVIDIA NIM API (${nvidiaError.substring(0, 100)}...)*`;
            } else if (openRouterKey && openRouterError) {
              currentNote = `\n\n---\n*💡 Catatan: Dialihkan otomatis ke **Gemini 2.5** karena batas upstream OpenRouter.*`;
            } else if (!nvidiaKey && (!openRouterKey || openRouterKey === "YOUR_OPENROUTER_API_KEY")) {
              currentNote = `\n\n---\n*💡 Catatan: Didukung oleh **Gemini 2.5** karena NVIDIA_API_KEY belum terkonfigurasi di Secrets.*`;
            }
            
            currentResponseText = response.text || "";
            successfullyGenerated = true;
          } catch (err) {
            console.error("Gemini fallback failed", err);
          }
        }
        
        if (!successfullyGenerated) {
          const finalError = nvidiaError || openRouterError 
            ? `Layanan gagal: ${nvidiaError || openRouterError}. Mohon pastikan API Key Anda aktif.` 
            : "Kunci API (NVIDIA_API_KEY, OPENROUTER_API_KEY atau GEMINI_API_KEY) belum dikonfigurasi. Silakan tambahkan di Secrets.";
          return res.status(500).json({ error: finalError });
        }

        // EVALUATION LOGIC
        if (reasoningMode === "penalaran" && geminiKey) {
          const isMatch = await checkReasoningMatch(message, currentResponseText);
          if (isMatch || attempt === maxAttempts) {
            finalOutputText = cleanEmojis(currentResponseText + currentNote, model, reasoningMode);
            isResponseValid = true;
          } else {
            console.log(`Evaluasi ke-${attempt}: Jawaban tidak memuaskan. Meretur kembali ke AI.`);
            currentMessages.push({ role: "assistant", content: currentResponseText });
            currentMessages.push({ role: "user", content: "Jawaban Anda sebelumnya tidak fokus pada inti pertanyaan saya secara langsung. Mohon PUSATKAN penalaran Anda dan jawab kembali HANYA mengenai hal yang benar-benar saya tanyakan dengan informasi yang tepat." });
          }
        } else {
          finalOutputText = cleanEmojis(currentResponseText + currentNote, model, reasoningMode);
          isResponseValid = true;
        }
      }

      return res.json({ text: finalOutputText });
 
    } catch (error: any) {
      console.error("Error in /api/chat route:", error);
      res.status(500).json({ error: error.message || "Gagal menghasilkan respons AI." });
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
