/**
 * Bluefox Motion Video & Code Recorder Engine
 * Mengonversi dan merekam animasi visual (HTML, CSS Keyframes, SVG, maupun Canvas)
 * ke dalam video berkualitas tinggi (.mp4 / .webm) secara real-time dan bebas galat.
 */

import { sanitizeMotionHtml } from './motion';

/**
 * Opsi 2: Download Kode Animasi (.html)
 */
export function downloadMotionCode(code: string, customName?: string) {
  if (!code) return;
  const fullHtml = sanitizeMotionHtml(code);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = customName || `bluefox-motion-${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper untuk parsing warna dan gradasi CSS ke Canvas Gradient
 */
function createCssGradientOrColor(
  bgStr: string,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D
): CanvasGradient | string | null {
  if (!bgStr || bgStr === 'none' || bgStr === 'transparent') return null;

  try {
    // 1. Radial gradient
    if (bgStr.includes('radial-gradient')) {
      const colors = bgStr.match(/(?:rgba?|hsla?)\([^)]+\)|#[0-9a-fA-F]{3,8}|(?:cyan|blue|purple|indigo|pink|rose|slate|white|black)/gi);
      if (colors && colors.length > 0) {
        const cx = width / 2;
        const cy = height / 2;
        const r = Math.max(width, height) / 2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        if (colors.length === 1) {
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, '#020617');
        } else {
          colors.forEach((col, idx) => {
            grad.addColorStop(idx / (colors.length - 1), col);
          });
        }
        return grad;
      }
    }

    // 2. Linear gradient
    if (bgStr.includes('linear-gradient')) {
      let angleDeg = 135;
      const degMatch = bgStr.match(/(\d+)deg/i);
      if (degMatch) {
        angleDeg = parseFloat(degMatch[1]);
      } else if (bgStr.includes('to right')) {
        angleDeg = 90;
      } else if (bgStr.includes('to bottom')) {
        angleDeg = 180;
      }

      const rad = ((angleDeg - 90) * Math.PI) / 180;
      const x0 = width / 2 - (Math.cos(rad) * width) / 2;
      const y0 = height / 2 - (Math.sin(rad) * height) / 2;
      const x1 = width / 2 + (Math.cos(rad) * width) / 2;
      const y1 = height / 2 + (Math.sin(rad) * height) / 2;

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      const colors = bgStr.match(/(?:rgba?|hsla?)\([^)]+\)|#[0-9a-fA-F]{3,8}|(?:cyan|blue|purple|indigo|pink|rose|slate|white|black)/gi);
      if (colors && colors.length > 0) {
        if (colors.length === 1) {
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, '#0b0f19');
        } else {
          colors.forEach((col, idx) => {
            grad.addColorStop(idx / (colors.length - 1), col);
          });
        }
        return grad;
      }
    }

    // 3. Solid color
    if (bgStr.startsWith('#') || bgStr.startsWith('rgb') || bgStr.startsWith('hsl')) {
      return bgStr;
    }
  } catch (err) {
    console.warn('[motionRecorder] Gradient parsing fallback:', err);
  }

  return null;
}

/**
 * Live DOM to Canvas Rasterizer
 * Menggambar seluruh elemen DOM, animasi CSS keyframes, transformasi 2D/3D,
 * bayangan bercahaya (glow), dan elemen visual ke kanvas secara frame-by-frame.
 */
function renderDomTreeToCanvas(
  sourceDoc: Document,
  sourceWin: Window,
  ctx: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number
) {
  // Ukuran viewport sumber
  const docEl = sourceDoc.documentElement;
  const body = sourceDoc.body;
  if (!body) return;

  const srcWidth = Math.max(docEl.clientWidth, body.clientWidth, 640);
  const srcHeight = Math.max(docEl.clientHeight, body.clientHeight, 360);

  const scaleX = targetWidth / srcWidth;
  const scaleY = targetHeight / srcHeight;

  // 1. Gambar latar belakang halaman
  ctx.save();
  const bodyStyle = sourceWin.getComputedStyle(body);
  const docStyle = sourceWin.getComputedStyle(docEl);

  let bgFill: any = null;
  if (bodyStyle.backgroundImage && bodyStyle.backgroundImage !== 'none') {
    bgFill = createCssGradientOrColor(bodyStyle.backgroundImage, targetWidth, targetHeight, ctx);
  }
  if (!bgFill && bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && bodyStyle.backgroundColor !== 'transparent') {
    bgFill = bodyStyle.backgroundColor;
  }
  if (!bgFill && docStyle.backgroundImage && docStyle.backgroundImage !== 'none') {
    bgFill = createCssGradientOrColor(docStyle.backgroundImage, targetWidth, targetHeight, ctx);
  }
  if (!bgFill && docStyle.backgroundColor && docStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && docStyle.backgroundColor !== 'transparent') {
    bgFill = docStyle.backgroundColor;
  }
  if (!bgFill) {
    bgFill = '#0b0f19'; // Default Bluefox dark background
  }

  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.restore();

  // 2. Ambil semua elemen di dalam body
  const allElements = Array.from(body.querySelectorAll('*')) as HTMLElement[];

  for (const el of allElements) {
    // Lewati tag script, style, meta, dll
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'title') {
      continue;
    }

    try {
      const style = sourceWin.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const opacity = parseFloat(style.opacity || '1');
      if (opacity <= 0.01) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const x = rect.left * scaleX;
      const y = rect.top * scaleY;
      const w = rect.width * scaleX;
      const h = rect.height * scaleY;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Handle Transform (Matrix 2D / 3D)
      if (style.transform && style.transform !== 'none') {
        const matrixMatch = style.transform.match(/matrix\(([^)]+)\)/);
        if (matrixMatch) {
          const vals = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()));
          if (vals.length === 6) {
            const centerX = x + w / 2;
            const centerY = y + h / 2;
            ctx.translate(centerX, centerY);
            ctx.transform(vals[0], vals[1], vals[2], vals[3], vals[4] * scaleX, vals[5] * scaleY);
            ctx.translate(-centerX, -centerY);
          }
        }
      }

      // Box Shadow / Glow
      if (style.boxShadow && style.boxShadow !== 'none') {
        const shadowMatch = style.boxShadow.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-z]+)\s+(-?\d+px)?\s*(-?\d+px)?\s*(\d+px)/);
        if (shadowMatch) {
          ctx.shadowColor = shadowMatch[1] || 'rgba(56, 189, 248, 0.5)';
          const blurVal = parseFloat(shadowMatch[4] || '10') * scaleX;
          ctx.shadowBlur = Math.min(blurVal, 40);
        }
      }

      // Border Radius (Lingkaran atau Persegi Melengkung)
      const isCircle = style.borderRadius.includes('50%') || (Math.abs(w - h) < 2 && parseFloat(style.borderRadius) >= w / 2);
      ctx.beginPath();
      if (isCircle) {
        ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      } else {
        const radius = Math.min(parseFloat(style.borderRadius || '0') * scaleX, w / 2, h / 2);
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, y, w, h, Math.max(0, radius));
        } else {
          ctx.rect(x, y, w, h);
        }
      }

      // Isi Latar Elemen
      let elBg: any = null;
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        elBg = createCssGradientOrColor(style.backgroundImage, w, h, ctx);
      }
      if (!elBg && style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        elBg = style.backgroundColor;
      }

      if (elBg) {
        ctx.fillStyle = elBg;
        ctx.fill();
      }

      // Garis Tepi (Border)
      const borderTopW = parseFloat(style.borderTopWidth || '0') * scaleX;
      const borderRightW = parseFloat(style.borderRightWidth || '0') * scaleX;
      const borderBottomW = parseFloat(style.borderBottomWidth || '0') * scaleX;
      const borderLeftW = parseFloat(style.borderLeftWidth || '0') * scaleX;
      const maxBorderW = Math.max(borderTopW, borderRightW, borderBottomW, borderLeftW);

      if (maxBorderW > 0.5 && style.borderStyle !== 'none') {
        // Cek jika border berbeda warna (seperti pada Cyberpunk Loader ring spinner)
        if (isCircle && (style.borderTopColor !== 'transparent' || style.borderRightColor !== 'transparent')) {
          ctx.lineWidth = maxBorderW;
          // Gambar busur dengan warna border yang aktif
          const cx = x + w / 2;
          const cy = y + h / 2;
          const r = Math.min(w, h) / 2;

          if (style.borderTopColor && style.borderTopColor !== 'transparent') {
            ctx.beginPath();
            ctx.strokeStyle = style.borderTopColor;
            ctx.arc(cx, cy, r, -Math.PI * 0.75, -Math.PI * 0.25);
            ctx.stroke();
          }
          if (style.borderRightColor && style.borderRightColor !== 'transparent') {
            ctx.beginPath();
            ctx.strokeStyle = style.borderRightColor;
            ctx.arc(cx, cy, r, -Math.PI * 0.25, Math.PI * 0.25);
            ctx.stroke();
          }
          if (style.borderBottomColor && style.borderBottomColor !== 'transparent') {
            ctx.beginPath();
            ctx.strokeStyle = style.borderBottomColor;
            ctx.arc(cx, cy, r, Math.PI * 0.25, Math.PI * 0.75);
            ctx.stroke();
          }
          if (style.borderLeftColor && style.borderLeftColor !== 'transparent') {
            ctx.beginPath();
            ctx.strokeStyle = style.borderLeftColor;
            ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 1.25);
            ctx.stroke();
          }
        } else {
          ctx.lineWidth = maxBorderW;
          ctx.strokeStyle = style.borderColor || style.borderTopColor || '#38bdf8';
          ctx.stroke();
        }
      }

      // Handle SVG Path / Shapes
      if (tag === 'path') {
        const d = el.getAttribute('d');
        if (d && typeof Path2D !== 'undefined') {
          const p = new Path2D(d);
          if (style.fill && style.fill !== 'none') {
            ctx.fillStyle = style.fill;
            ctx.fill(p);
          }
          if (style.stroke && style.stroke !== 'none') {
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = parseFloat(style.strokeWidth || '1') * scaleX;
            ctx.stroke(p);
          }
        }
      } else if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || '0') * scaleX;
        const cy = parseFloat(el.getAttribute('cy') || '0') * scaleY;
        const r = parseFloat(el.getAttribute('r') || '0') * scaleX;
        if (r > 0) {
          ctx.beginPath();
          ctx.arc(x + cx, y + cy, r, 0, Math.PI * 2);
          if (style.fill && style.fill !== 'none') {
            ctx.fillStyle = style.fill;
            ctx.fill();
          }
          if (style.stroke && style.stroke !== 'none') {
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = parseFloat(style.strokeWidth || '1') * scaleX;
            ctx.stroke();
          }
        }
      }

      // Teks Langsung
      const text = el.innerText || el.textContent;
      if (text && el.children.length === 0 && text.trim().length > 0) {
        ctx.fillStyle = style.color || '#ffffff';
        const fontSize = Math.max(10, parseFloat(style.fontSize || '14') * scaleX);
        ctx.font = `${style.fontWeight || 'normal'} ${fontSize}px ${style.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text.trim(), x + w / 2, y + h / 2);
      }

      ctx.restore();
    } catch (elErr) {
      // Abaikan error pada elemen tertentu agar perekaman terus berjalan lancar
    }
  }
}

/**
 * Opsi 1 & 3: Merekam Animasi Menjadi Video MP4 / WebM
 * Menggunakan kanvas 1280x720 30FPS yang aktif di-render ulang setiap frame,
 * sehingga video hasil unduhan menampilkan animasi visual secara nyata dan penuh warna.
 */
export async function recordAndDownloadMotionMp4(
  iframe: HTMLIFrameElement | null,
  durationSeconds: number = 3.5,
  onProgress?: (progressPercent: number) => void,
  motionCodeFallback?: string
): Promise<{ success: boolean; format: 'mp4' | 'webm'; fileName: string }> {
  let tempHostContainer: HTMLElement | null = null;
  let sourceDoc: Document | null = null;
  let sourceWin: Window | null = null;
  let directCanvas: HTMLCanvasElement | null = null;

  // 1. Coba baca dari iframe yang sedang aktif di UI
  if (iframe) {
    try {
      sourceDoc = iframe.contentDocument || (iframe.contentWindow ? (iframe.contentWindow as any).document : null);
      sourceWin = iframe.contentWindow || null;
      if (sourceDoc) {
        directCanvas = sourceDoc.querySelector('canvas') as HTMLCanvasElement | null;
      }
    } catch (err) {
      console.warn('[motionRecorder] Tidak dapat membaca dokumen iframe langsung, menggunakan host terisolasi:', err);
    }
  }

  // 2. Jika dokumen iframe tidak dapat diakses (misal karena isolasi sandbox iframe),
  // buat elemen host terisolasi di background yang terjamin dapat diakses tanpa cross-origin block.
  if ((!sourceDoc || !sourceWin) && motionCodeFallback) {
    try {
      tempHostContainer = document.createElement('div');
      tempHostContainer.style.position = 'fixed';
      tempHostContainer.style.left = '-9999px';
      tempHostContainer.style.top = '-9999px';
      tempHostContainer.style.width = '1280px';
      tempHostContainer.style.height = '720px';
      tempHostContainer.style.opacity = '0';
      tempHostContainer.style.pointerEvents = 'none';
      tempHostContainer.style.zIndex = '-9999';

      const hostIframe = document.createElement('iframe');
      hostIframe.style.width = '1280px';
      hostIframe.style.height = '720px';
      hostIframe.style.border = 'none';
      tempHostContainer.appendChild(hostIframe);
      document.body.appendChild(tempHostContainer);

      const htmlToRender = sanitizeMotionHtml(motionCodeFallback);
      hostIframe.srcdoc = htmlToRender;

      await new Promise<void>((resolve) => {
        hostIframe.onload = () => resolve();
        setTimeout(resolve, 500); // Safety timeout
      });

      sourceDoc = hostIframe.contentDocument || (hostIframe.contentWindow ? (hostIframe.contentWindow as any).document : null);
      sourceWin = hostIframe.contentWindow || null;
      if (sourceDoc) {
        directCanvas = sourceDoc.querySelector('canvas') as HTMLCanvasElement | null;
      }
    } catch (hostErr) {
      console.warn('[motionRecorder] Error saat menyiapkan host perekaman:', hostErr);
    }
  }

  // 3. Siapkan Master Recording Canvas 1280x720
  const recordingCanvas = document.createElement('canvas');
  recordingCanvas.width = 1280;
  recordingCanvas.height = 720;
  const ctx = recordingCanvas.getContext('2d', { alpha: false });

  if (!ctx) {
    if (tempHostContainer) tempHostContainer.remove();
    throw new Error('Gagal menginisialisasi konteks kanvas 2D');
  }

  // Gambar frame awal
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, 1280, 720);

  // 4. Inisialisasi MediaStream dari Canvas
  let stream: MediaStream | null = null;
  if (directCanvas && typeof (directCanvas as any).captureStream === 'function') {
    try {
      stream = (directCanvas as any).captureStream(30);
    } catch (e) {
      console.warn('[motionRecorder] Direct canvas captureStream fallback:', e);
    }
  }

  if (!stream && typeof (recordingCanvas as any).captureStream === 'function') {
    stream = (recordingCanvas as any).captureStream(30);
  }

  if (!stream) {
    if (tempHostContainer) tempHostContainer.remove();
    throw new Error('Browser atau WebView perangkat belum mendukung perekaman visual langsung. Gunakan opsi "Download code".');
  }

  // 5. Tentukan format perekam (MP4 didahulukan jika didukung, jika tidak gunakan WebM)
  let chosenMime = 'video/webm';
  let fileExt: 'mp4' | 'webm' = 'webm';

  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      chosenMime = 'video/mp4;codecs=avc1';
      fileExt = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      chosenMime = 'video/mp4';
      fileExt = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      chosenMime = 'video/webm;codecs=vp9';
      fileExt = 'webm';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      chosenMime = 'video/webm;codecs=vp8';
      fileExt = 'webm';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      chosenMime = 'video/webm';
      fileExt = 'webm';
    }
  }

  return new Promise<{ success: boolean; format: 'mp4' | 'webm'; fileName: string }>((resolve, reject) => {
    let animFrameId: number | null = null;
    let progressIntervalId: any = null;
    let isFinished = false;

    try {
      const recorder = new MediaRecorder(stream!, {
        mimeType: chosenMime,
        videoBitsPerSecond: 4000000 // 4 Mbps high bitrate
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Loop rendering aktif 30 FPS untuk mengupdate Master Recording Canvas
      const renderLoop = () => {
        if (isFinished) return;

        if (sourceDoc && sourceWin) {
          if (directCanvas) {
            try {
              ctx.drawImage(directCanvas, 0, 0, 1280, 720);
            } catch {}
          } else {
            renderDomTreeToCanvas(sourceDoc, sourceWin, ctx, 1280, 720);
          }
        }

        animFrameId = requestAnimationFrame(renderLoop);
      };

      // Tangani event selesai merekam
      recorder.onstop = () => {
        isFinished = true;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (progressIntervalId) clearInterval(progressIntervalId);

        if (tempHostContainer) {
          try {
            tempHostContainer.remove();
          } catch {}
        }

        const videoBlob = new Blob(chunks, {
          type: fileExt === 'mp4' ? 'video/mp4' : 'video/webm'
        });

        const downloadFileName = `bluefox-motion-${Date.now()}.${fileExt}`;
        const downloadUrl = URL.createObjectURL(videoBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        resolve({
          success: true,
          format: fileExt,
          fileName: downloadFileName
        });
      };

      // Mulai rendering dan perekaman
      renderLoop();
      recorder.start(100);

      const startTime = Date.now();
      const totalMs = durationSeconds * 1000;

      progressIntervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(Math.round((elapsed / totalMs) * 100), 99);
        if (onProgress) onProgress(pct);

        if (elapsed >= totalMs) {
          clearInterval(progressIntervalId);
          if (onProgress) onProgress(100);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 100);
    } catch (recErr) {
      isFinished = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (progressIntervalId) clearInterval(progressIntervalId);
      if (tempHostContainer) {
        try {
          tempHostContainer.remove();
        } catch {}
      }
      reject(recErr);
    }
  });
}
