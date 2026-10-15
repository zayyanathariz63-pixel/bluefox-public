/**
 * Helper untuk merekam dan mengunduh animasi Bluefox Motion
 * Mendukung opsi:
 * 1. Download MP4 (merekam video 3.5 detik dari canvas/iframe)
 * 2. Download Code (mengunduh berkas .html)
 * 3. Download Code & MP4 (mengunduh keduanya)
 */

export function downloadMotionCode(code: string, customName?: string) {
  if (!code) return;
  const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = customName || `bluefox-motion-${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function recordAndDownloadMotionMp4(
  iframe: HTMLIFrameElement | null,
  durationSeconds: number = 3.5,
  onProgress?: (progressPercent: number) => void
): Promise<boolean> {
  let stream: MediaStream | null = null;
  let intervalId: any = null;

  // 1. Coba deteksi canvas langsung di dalam dokumen iframe
  try {
    const doc = iframe?.contentDocument || (iframe?.contentWindow ? (iframe.contentWindow as any).document : null);
    const canvas = doc?.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas && typeof (canvas as any).captureStream === 'function') {
      stream = (canvas as any).captureStream(30);
    }
  } catch (err) {
    console.warn('[motionRecorder] Tidak dapat membaca canvas dari iframe langsung:', err);
  }

  // 2. Jika tidak ada canvas langsung, buat canvas perekam offscreen 1280x720
  if (!stream) {
    const offscreen = document.createElement('canvas');
    offscreen.width = 1280;
    offscreen.height = 720;
    const ctx = offscreen.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, 1280, 720);

      try {
        const doc = iframe?.contentDocument || (iframe?.contentWindow ? (iframe.contentWindow as any).document : null);
        const svgEl = doc?.querySelector('svg');
        if (svgEl) {
          const svgXml = new XMLSerializer().serializeToString(svgEl);
          const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
          const svgUrl = URL.createObjectURL(svgBlob);
          const img = new Image();
          img.src = svgUrl;
          await new Promise((r) => {
            img.onload = r;
            img.onerror = r;
            setTimeout(r, 500);
          });
          ctx.drawImage(img, (1280 - 640) / 2, (720 - 640) / 2, 640, 640);
          URL.revokeObjectURL(svgUrl);
        }
      } catch (err) {
        console.warn('[motionRecorder] SVG render fallback:', err);
      }
    }

    if (typeof (offscreen as any).captureStream === 'function') {
      stream = (offscreen as any).captureStream(30);
    }
  }

  // 3. Fallback jika browser benar-benar tidak mendukung captureStream
  if (!stream) {
    throw new Error('Browser Anda belum mendukung perekaman visual langsung. Gunakan opsi Download Code.');
  }

  // 4. Pilih format rekaman
  let mimeType = 'video/webm';
  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }
  }

  return new Promise<boolean>((resolve, reject) => {
    try {
      const recorder = new MediaRecorder(stream!, {
        mimeType,
        videoBitsPerSecond: 4000000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        clearInterval(intervalId);
        const videoBlob = new Blob(chunks, { 
          type: mimeType.includes('mp4') ? 'video/mp4' : 'video/webm' 
        });
        const url = URL.createObjectURL(videoBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bluefox-motion-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve(true);
      };

      recorder.start(100);

      const startTime = Date.now();
      const totalMs = durationSeconds * 1000;
      intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(Math.round((elapsed / totalMs) * 100), 99);
        if (onProgress) onProgress(pct);

        if (elapsed >= totalMs) {
          clearInterval(intervalId);
          if (recorder.state === 'recording') {
            if (onProgress) onProgress(100);
            recorder.stop();
          }
        }
      }, 100);
    } catch (err) {
      clearInterval(intervalId);
      reject(err);
    }
  });
}
