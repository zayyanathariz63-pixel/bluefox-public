import { supabase, supabaseKey, supabaseUrl } from './supabase';

// State recorder & chunks audio in-memory
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let activeStream: MediaStream | null = null;

const EDGE_FUNCTION_NAME = 'bluefox-stt-transcribe';
const DIRECT_EDGE_URL = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/bluefox-stt-transcribe';

/**
 * Mendeteksi MIME type audio yang didukung browser
 */
function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  const preferred = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];
  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * 1. Mulai Merekam Audio dari Mikrofon
 */
export async function startRecording(): Promise<MediaStream> {
  // Bersihkan recorder lama jika ada
  cancelRecording();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    activeStream = stream;
    audioChunks = [];

    const mimeType = getSupportedAudioMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    // Ambil potongan setiap 250ms untuk memastikan data audio terisi
    mediaRecorder.start(250);

    return stream;
  } catch (err: any) {
    console.error('Gagal mengakses mikrofon:', err);
    throw err;
  }
}

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animFrameId: number | null = null;

/**
 * Mendengarkan tingkat volume suara secara real-time dari mikrofon
 */
export function attachAudioVolumeListener(stream: MediaStream, onVolume: (vol: number) => void): void {
  try {
    stopAudioVolumeListener();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length; // 0 - 255
      // Sensitivitas volume suara: jika rata-rata frekuensi > 10, ada suara manusia
      const normalized = Math.min(1, Math.max(0, (avg - 8) / 60));
      onVolume(normalized);
      animFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  } catch (err) {
    console.warn('AudioContext volume metering error:', err);
  }
}

export function stopAudioVolumeListener(): void {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (audioContext) {
    try {
      audioContext.close();
    } catch {}
    audioContext = null;
    analyser = null;
  }
}

/**
 * 2. Membatalkan Rekaman tanpa Mengirim ke Server
 */
export function cancelRecording(): void {
  stopAudioVolumeListener();
  try {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  } catch {}

  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }

  mediaRecorder = null;
  audioChunks = [];
}

/**
 * 3. Berhenti dan Langsung Kirim ke Edge Function Supabase (In-Memory)
 * Mengembalikan teks hasil transkripsi dari Supabase
 */
export async function stopAndSendRecording(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      return reject(new Error('Perekam audio belum dimulai'));
    }

    const currentRecorder = mediaRecorder;
    const currentStream = activeStream;

    currentRecorder.onstop = async () => {
      try {
        const mimeType = currentRecorder.mimeType || 'audio/webm';
        // Gabungkan chunk audio di RAM menjadi satu kesatuan Blob
        const audioBlob = new Blob(audioChunks, { type: mimeType });

        if (audioBlob.size === 0) {
          throw new Error('Tidak ada data suara yang terekam. Silakan coba bicara lagi.');
        }

        // Tentukan ekstensi berkas yang cocok
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
        const fileName = `voice-input.${ext}`;

        // Bungkus Blob ke dalam FormData (in-memory, tanpa lewat storage fisik)
        const formData = new FormData();
        formData.append('file', audioBlob, fileName);

        let transcribedText = '';

        // Cara 1: Menggunakan supabase.functions.invoke
        try {
          const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
            body: formData,
          });

          if (!error && data) {
            transcribedText = data.text || data.transcription || data.result || '';
            if (typeof data === 'string') transcribedText = data;
          } else if (error) {
            console.warn('supabase.functions.invoke info:', error);
          }
        } catch (invokeErr) {
          console.warn('Gagal lewat functions.invoke, mencoba direct fetch:', invokeErr);
        }

        // Cara 2: Fallback direct fetch ke URL Edge Function resmi Supabase
        if (!transcribedText) {
          const targetUrl = DIRECT_EDGE_URL || `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${EDGE_FUNCTION_NAME}`;
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`Edge Function error (${response.status}): ${errBody || response.statusText}`);
          }

          const resData = await response.json();
          transcribedText = resData?.text || resData?.transcription || resData?.result || '';
          if (typeof resData === 'string') transcribedText = resData;
        }

        resolve((transcribedText || '').trim());
      } catch (err) {
        console.error('Gagal mengirim rekaman audio ke Supabase:', err);
        reject(err);
      } finally {
        stopAudioVolumeListener();
        // Matikan akses track mikrofon setelah selesai
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop());
        }
        mediaRecorder = null;
        activeStream = null;
        audioChunks = [];
      }
    };

    try {
      if (currentRecorder.state !== 'inactive') {
        currentRecorder.stop();
      } else {
        currentRecorder.onstop(new Event('stop'));
      }
    } catch (stopErr) {
      reject(stopErr);
    }
  });
}
