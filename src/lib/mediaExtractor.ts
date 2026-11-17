import JSZip from 'jszip';
import { ExtractedFrameData, MediaAttachment } from '../types';

export const MAX_VIDEO_DURATION_SECONDS = 120; // 2 menit
export const MAX_AUDIO_DURATION_SECONDS = 180; // 3 menit

const MIN_JPG_BYTES = 100 * 1024;
const MAX_JPG_BYTES = 300 * 1024;

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.3gp', '.m4v', '.ogv'];
const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.wma', '.opus', '.aiff', '.weba'];

export class MediaDurationExceededError extends Error {
  duration: number;
  maxDuration: number;
  mediaKind: 'video' | 'audio';

  constructor(mediaKind: 'video' | 'audio', duration: number, maxDuration: number) {
    const label = mediaKind === 'video' ? 'video' : 'audio';
    const maxMins = Math.round(maxDuration / 60);
    super(`Durasi ${label} (${duration.toFixed(1)} detik) melebihi batas maksimal ${maxMins} menit (${maxDuration} detik).`);
    this.name = 'MediaDurationExceededError';
    this.duration = duration;
    this.maxDuration = maxDuration;
    this.mediaKind = mediaKind;
  }
}

export function detectVideoOrAudioKind(file: File): 'video' | 'audio' | null {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith('video/') || VIDEO_EXTS.some(ext => lower.endsWith(ext))) {
    return 'video';
  }
  if (file.type.startsWith('audio/') || AUDIO_EXTS.some(ext => lower.endsWith(ext))) {
    return 'audio';
  }
  return null;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function padFrameIndex(num: number): string {
  return String(num).padStart(4, '0');
}

function sanitizeBaseName(name: string): string {
  const stripped = name.replace(/\.[^/.]+$/, '');
  const safe = stripped.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'media_bundle';
}

export function readMediaDuration(file: File, kind: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    if (kind === 'video') {
      (el as HTMLVideoElement).muted = true;
      (el as HTMLVideoElement).playsInline = true;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('Waktu membaca metadata media habis. Pastikan berkas valid.'));
      }
    }, 15000);

    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('error', onError);
      URL.revokeObjectURL(objUrl);
      el.removeAttribute('src');
      el.load();
    };

    const onLoaded = () => {
      if (settled) return;
      settled = true;
      const dur = el.duration;
      cleanup();
      if (!Number.isFinite(dur) || dur <= 0) {
        reject(new Error('Durasi berkas media tidak valid atau bernilai nol.'));
        return;
      }
      resolve(dur);
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Format media tidak didukung oleh browser ini.'));
    };

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onError);
    el.src = objUrl;
    el.load();
  });
}

async function decodeAudioBuffer(file: File): Promise<AudioBuffer | null> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioCtx();
    const arrayBuf = await file.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  } finally {
    if (audioCtx && typeof audioCtx.close === 'function') {
      audioCtx.close().catch(() => {});
    }
  }
}

function computePerSecondAudioTimeline(audioBuffer: AudioBuffer | null, maxSec: number) {
  const timeline: Array<{
    detik: number;
    timestamp: string;
    status_audio_point: string;
    rms_level: number;
  }> = [];

  if (!audioBuffer) {
    for (let sec = 0; sec <= maxSec; sec++) {
      timeline.push({
        detik: sec,
        timestamp: formatClock(sec),
        status_audio_point: 'tidak_ada_audio',
        rms_level: 0,
      });
    }
    return timeline;
  }

  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  for (let sec = 0; sec <= maxSec; sec++) {
    const startSample = Math.floor(sec * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor((sec + 1) * sampleRate));
    if (startSample >= totalSamples || endSample <= startSample) {
      timeline.push({
        detik: sec,
        timestamp: formatClock(sec),
        status_audio_point: 'hening',
        rms_level: 0,
      });
      continue;
    }

    let sumSq = 0;
    const step = Math.max(1, Math.floor((endSample - startSample) / 2000));
    let count = 0;
    for (let i = startSample; i < endSample; i += step) {
      const val = channelData[i];
      sumSq += val * val;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    const roundedRms = Math.round(rms * 10000) / 10000;
    timeline.push({
      detik: sec,
      timestamp: formatClock(sec),
      status_audio_point: rms >= 0.01 ? 'aktif' : 'hening',
      rms_level: roundedRms,
    });
  }

  return timeline;
}

function encodeMonoWavBuffer(audioBuffer: AudioBuffer, targetRate = 16000): Blob {
  const origRate = audioBuffer.sampleRate;
  const outRate = Math.min(origRate, targetRate);
  const numChannels = audioBuffer.numberOfChannels;
  const origLength = audioBuffer.length;
  const ratio = origRate / outRate;
  const outLength = Math.max(1, Math.floor(origLength / ratio));

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const buffer = new ArrayBuffer(44 + outLength * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let k = 0; k < str.length; k++) {
      view.setUint8(offset + k, str.charCodeAt(k));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + outLength * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, outLength * 2, true);

  let offset = 44;
  for (let i = 0; i < outLength; i++) {
    const srcIdx = Math.min(origLength - 1, Math.floor(i * ratio));
    let mixed = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      mixed += channels[ch][srcIdx];
    }
    mixed /= numChannels;
    const clamped = Math.max(-1, Math.min(1, mixed));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function seekVideoElement(videoEl: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const target = Math.max(0, timeSec);

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        videoEl.removeEventListener('seeked', onSeeked);
        resolve();
      }
    }, 3000);

    const onSeeked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      videoEl.removeEventListener('seeked', onSeeked);
      requestAnimationFrame(() => resolve());
    };

    if (Math.abs(videoEl.currentTime - target) < 0.015 && videoEl.readyState >= 2) {
      clearTimeout(timer);
      settled = true;
      requestAnimationFrame(() => resolve());
      return;
    }

    videoEl.addEventListener('seeked', onSeeked);
    try {
      videoEl.currentTime = target;
    } catch (err) {
      clearTimeout(timer);
      videoEl.removeEventListener('seeked', onSeeked);
      reject(err);
    }
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal mengonversi frame canvas ke JPEG.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

async function captureFrameWithTargetSize(
  videoEl: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<Blob> {
  const vw = videoEl.videoWidth || 1280;
  const vh = videoEl.videoHeight || 720;
  const dimensionCaps = [1280, 960, 720, 540];
  let bestBlob: Blob | null = null;

  for (let d = 0; d < dimensionCaps.length; d++) {
    const maxDim = dimensionCaps[d];
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const targetW = Math.max(2, Math.round(vw * scale));
    const targetH = Math.max(2, Math.round(vh * scale));

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(videoEl, 0, 0, targetW, targetH);

    let blob = await canvasToJpegBlob(canvas, 0.8);

    if (blob.size > MAX_JPG_BYTES) {
      const lowQualities = [0.68, 0.56, 0.44, 0.34, 0.24];
      for (const q of lowQualities) {
        blob = await canvasToJpegBlob(canvas, q);
        if (blob.size <= MAX_JPG_BYTES) break;
      }
    } else if (blob.size < MIN_JPG_BYTES && d === 0) {
      const highQualities = [0.9, 0.95, 0.98];
      for (const q of highQualities) {
        const candidate = await canvasToJpegBlob(canvas, q);
        blob = candidate;
        if (candidate.size >= MIN_JPG_BYTES && candidate.size <= MAX_JPG_BYTES) break;
        if (candidate.size > MAX_JPG_BYTES) {
          blob = await canvasToJpegBlob(canvas, q - 0.05);
          break;
        }
      }
    }

    bestBlob = blob;
    if (blob.size <= MAX_JPG_BYTES) break;
  }

  if (!bestBlob) {
    throw new Error('Gagal menghasilkan frame JPEG.');
  }
  return bestBlob;
}

export async function finalizeZipWithPrompt(
  attachment: MediaAttachment,
  promptJson: Record<string, any>
): Promise<{ zipBase64: string; zipDataUrl: string; zipSize: number }> {
  if (!attachment.zipBase64) {
    return { zipBase64: '', zipDataUrl: '', zipSize: 0 };
  }
  try {
    const zip = await JSZip.loadAsync(attachment.zipBase64, { base64: true });
    zip.file('prompt_user.json', JSON.stringify(promptJson, null, 2));
    const updatedBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const updatedDataUrl = await blobToDataUrl(updatedBlob);
    const updatedBase64 = updatedDataUrl.split(',')[1] || attachment.zipBase64;
    return {
      zipBase64: updatedBase64,
      zipDataUrl: updatedDataUrl,
      zipSize: updatedBlob.size,
    };
  } catch {
    return {
      zipBase64: attachment.zipBase64,
      zipDataUrl: attachment.zipDataUrl || `data:application/zip;base64,${attachment.zipBase64}`,
      zipSize: attachment.zipSize || 0,
    };
  }
}

export async function extractVideoToAttachment(
  file: File,
  knownDuration: number,
  onProgress: (percent: number, status: string, subStatus?: string) => void
): Promise<MediaAttachment> {
  if (knownDuration > MAX_VIDEO_DURATION_SECONDS) {
    throw new MediaDurationExceededError('video', knownDuration, MAX_VIDEO_DURATION_SECONDS);
  }

  const videoUrl = URL.createObjectURL(file);
  const videoEl = document.createElement('video');
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = 'auto';
  videoEl.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    }, 10000);
    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      videoEl.removeEventListener('loadeddata', onReady);
      videoEl.removeEventListener('error', onErr);
      resolve();
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      videoEl.removeEventListener('loadeddata', onReady);
      videoEl.removeEventListener('error', onErr);
      reject(new Error('Gagal menyiapkan pemutar video untuk ekstraksi.'));
    };
    videoEl.addEventListener('loadeddata', onReady);
    videoEl.addEventListener('error', onErr);
    videoEl.load();
  });

  const zip = new JSZip();
  const baseName = sanitizeBaseName(file.name);
  const maxSec = Math.floor(knownDuration);

  onProgress(8, 'Mengekstrak jalur audio dari video...', 'Memproses dekode audio');
  const decodedAudio = await decodeAudioBuffer(file);
  const audioTimeline = computePerSecondAudioTimeline(decodedAudio, maxSec);

  const hasAudioTrack = Boolean(decodedAudio);
  const audioZipPath = hasAudioTrack ? 'audio/audio_track.wav' : null;

  if (decodedAudio && audioZipPath) {
    onProgress(15, 'Mengemas jalur audio ke WAV...', 'Menambahkan audio ke arsip JSZip');
    const wavBlob = encodeMonoWavBuffer(decodedAudio, 16000);
    zip.file(audioZipPath, wavBlob);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Konteks canvas 2D tidak tersedia.');
  }

  const imagesFolder = zip.folder('images');
  const extractedFrames: ExtractedFrameData[] = [];
  const totalSteps = maxSec + 1;

  for (let sec = 0; sec <= maxSec; sec++) {
    const safeSeek = Math.min(sec, Math.max(0, knownDuration - 0.04));
    await seekVideoElement(videoEl, safeSeek);

    const jpgBlob = await captureFrameWithTargetSize(videoEl, canvas, ctx);
    const frameDataUrl = await blobToDataUrl(jpgBlob);
    const frameName = `frame_${padFrameIndex(sec + 1)}.jpg`;
    const kb = Math.round((jpgBlob.size / 1024) * 10) / 10;

    if (imagesFolder) {
      imagesFolder.file(frameName, jpgBlob);
    }

    extractedFrames.push({
      detik: sec,
      timestamp: formatClock(sec),
      nama_file_gambar: frameName,
      ukuran_kb: kb,
      dataUrl: frameDataUrl,
    });

    const pct = 18 + ((sec + 1) / totalSteps) * 64;
    onProgress(
      Math.round(pct),
      `Mengekstrak frame ${sec + 1} dari ${totalSteps}...`,
      `${frameName} (${kb} KB)`
    );
  }

  videoEl.removeAttribute('src');
  videoEl.load();

  const audioPayloadJson = {
    file_name: 'audio.json',
    source_file: file.name,
    media_type: 'video',
    has_audio: hasAudioTrack,
    audio_zip_path: audioZipPath,
    format: hasAudioTrack ? 'audio/wav' : null,
    sample_rate: hasAudioTrack ? 16000 : null,
    duration_seconds: Math.round(knownDuration * 100) / 100,
    timeline_audio: audioTimeline,
  };

  const imagesPayloadJson = {
    file_name: 'gambar.json',
    source_file: file.name,
    media_type: 'video',
    fps: 1,
    total_frames: extractedFrames.length,
    target_size_kb: '100-300',
    frames: extractedFrames.map((f) => ({
      detik: f.detik,
      timestamp: f.timestamp,
      nama_file_gambar: `images/${f.nama_file_gambar}`,
      ukuran_kb: f.ukuran_kb,
    })),
  };

  const promptPayloadJson = {
    file_name: 'prompt_user.json',
    source_file: file.name,
    media_type: 'video',
    duration_seconds: Math.round(knownDuration * 100) / 100,
    total_frames: extractedFrames.length,
    has_audio: hasAudioTrack,
    prompt_user: '',
  };

  const timestampsPayload = {
    source_file: file.name,
    media_type: 'video',
    duration_seconds: Math.round(knownDuration * 100) / 100,
    fps: 1,
    has_audio: hasAudioTrack,
    audio_file: audioZipPath,
    total_frames: extractedFrames.length,
    timeline: extractedFrames.map((f, idx) => ({
      detik: f.detik,
      timestamp: f.timestamp,
      nama_file_gambar: `images/${f.nama_file_gambar}`,
      ukuran_gambar_kb: f.ukuran_kb,
      status_audio_point: audioTimeline[idx]?.status_audio_point || 'tidak_ada_audio',
      rms_level: audioTimeline[idx]?.rms_level || 0,
    })),
  };

  zip.file('audio.json', JSON.stringify(audioPayloadJson, null, 2));
  zip.file('gambar.json', JSON.stringify(imagesPayloadJson, null, 2));
  zip.file('prompt_user.json', JSON.stringify(promptPayloadJson, null, 2));
  zip.file('timestamps.json', JSON.stringify(timestampsPayload, null, 2));

  onProgress(85, 'Mengemas gambar dan audio ke JSZip...', 'Membuat arsip .zip untuk server');

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (meta) => {
      const zipPct = 85 + meta.percent * 0.14;
      onProgress(Math.round(zipPct), 'Mengemas gambar dan audio ke JSZip...', `${Math.round(meta.percent)}%`);
    }
  );

  const zipDataUrl = await blobToDataUrl(zipBlob);
  const zipBase64 = zipDataUrl.split(',')[1] || '';
  const zipFileName = `${baseName}_bundle.zip`;

  onProgress(100, 'Ekstraksi dan pengemasan JSZip selesai.', 'Menampilkan video di ruang obrolan');

  return {
    id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    url: videoUrl,
    type: 'video',
    name: file.name,
    size: file.size,
    duration: knownDuration,
    extractedFrames,
    audioPayloadJson,
    imagesPayloadJson,
    promptPayloadJson,
    zipFileName,
    zipBase64,
    zipDataUrl,
    zipSize: zipBlob.size,
  };
}

export async function extractAudioToAttachment(
  file: File,
  knownDuration: number,
  onProgress: (percent: number, status: string, subStatus?: string) => void
): Promise<MediaAttachment> {
  if (knownDuration > MAX_AUDIO_DURATION_SECONDS) {
    throw new MediaDurationExceededError('audio', knownDuration, MAX_AUDIO_DURATION_SECONDS);
  }

  onProgress(15, 'Mendekode berkas audio...', file.name);
  const audioUrl = URL.createObjectURL(file);
  const baseName = sanitizeBaseName(file.name);
  const maxSec = Math.floor(knownDuration);
  const decodedAudio = await decodeAudioBuffer(file);
  const audioTimeline = computePerSecondAudioTimeline(decodedAudio, maxSec);

  const zip = new JSZip();
  let audioZipPath = 'audio/audio_track.wav';
  let audioFormat = 'audio/wav';

  if (decodedAudio) {
    onProgress(50, 'Mengonversi audio ke WAV untuk arsip JSZip...', 'Menghindari format MP3/video mentah');
    const wavBlob = encodeMonoWavBuffer(decodedAudio, 16000);
    zip.file(audioZipPath, wavBlob);
  } else {
    const ext = (file.name.split('.').pop() || 'wav').toLowerCase();
    audioZipPath = `audio/${baseName}.${ext}`;
    audioFormat = file.type || 'audio/wav';
    zip.file(audioZipPath, file);
  }

  const audioPayloadJson = {
    file_name: 'audio.json',
    source_file: file.name,
    media_type: 'audio',
    has_audio: true,
    audio_zip_path: audioZipPath,
    format: audioFormat,
    duration_seconds: Math.round(knownDuration * 100) / 100,
    timeline_audio: audioTimeline,
  };

  const imagesPayloadJson = {
    file_name: 'gambar.json',
    source_file: file.name,
    media_type: 'audio',
    fps: 0,
    total_frames: 0,
    frames: [],
  };

  const promptPayloadJson = {
    file_name: 'prompt_user.json',
    source_file: file.name,
    media_type: 'audio',
    duration_seconds: Math.round(knownDuration * 100) / 100,
    total_frames: 0,
    has_audio: true,
    prompt_user: '',
  };

  const timestampsPayload = {
    source_file: file.name,
    media_type: 'audio',
    duration_seconds: Math.round(knownDuration * 100) / 100,
    fps: 0,
    has_audio: true,
    audio_file: audioZipPath,
    total_frames: 0,
    timeline: audioTimeline.map((pt) => ({
      detik: pt.detik,
      timestamp: pt.timestamp,
      nama_file_gambar: null,
      status_audio_point: pt.status_audio_point,
      rms_level: pt.rms_level,
    })),
  };

  zip.folder('images');
  zip.file('audio.json', JSON.stringify(audioPayloadJson, null, 2));
  zip.file('gambar.json', JSON.stringify(imagesPayloadJson, null, 2));
  zip.file('prompt_user.json', JSON.stringify(promptPayloadJson, null, 2));
  zip.file('timestamps.json', JSON.stringify(timestampsPayload, null, 2));

  onProgress(80, 'Mengemas audio ke arsip JSZip...', 'Membuat file .zip untuk server');

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipDataUrl = await blobToDataUrl(zipBlob);
  const zipBase64 = zipDataUrl.split(',')[1] || '';
  const zipFileName = `${baseName}_bundle.zip`;

  onProgress(100, 'Ekstraksi audio ke JSZip selesai.', 'Audio siap dikirim');

  return {
    id: `audio-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    url: audioUrl,
    type: 'audio',
    name: file.name,
    size: file.size,
    duration: knownDuration,
    extractedFrames: [],
    audioPayloadJson,
    imagesPayloadJson,
    promptPayloadJson,
    zipFileName,
    zipBase64,
    zipDataUrl,
    zipSize: zipBlob.size,
  };
}
