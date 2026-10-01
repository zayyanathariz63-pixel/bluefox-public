import { supabase } from './supabase';
import { BluefoxCustomApi } from '../types';

/**
 * 1. Menyimpan Konfigurasi API User dari Frontend
 * Data ini disimpan langsung ke tabel bluefox_custom_api di Supabase.
 */
export async function saveUserCustomApi(formData: {
  name: string;
  apiType: 'image' | 'video';
  endpointUrl: string;
  modelId: string;
  apiKey: string;
}): Promise<{ success: boolean; data?: BluefoxCustomApi; error?: string }> {
  // Mendapatkan session user yang sedang login
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert('Anda harus login terlebih dahulu.');
    return { success: false, error: 'Anda harus login terlebih dahulu.' };
  }

  const { data, error } = await supabase
    .from('bluefox_custom_api')
    .insert([
      {
        user_id: user.id,
        name: formData.name,              // Contoh: "My SDXL Server"
        api_type: formData.apiType,        // 'image' atau 'video'
        endpoint_url: formData.endpointUrl, // 'https://api.domainuser.com/v1/generate'
        model_id: formData.modelId,        // 'sdxl-v1-0' atau 'runway-gen2'
        api_key_encrypted: formData.apiKey // Disimpan ke kolom enkripsi
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Gagal menyimpan konfigurasi API:', error.message);
    alert('Gagal menyimpan: ' + error.message);
    return { success: false, error: error.message };
  } else {
    alert('Custom API berhasil disimpan!');
    return { success: true, data: data as BluefoxCustomApi };
  }
}

/**
 * Mengambil daftar konfigurasi Custom API milik user dari tabel bluefox_custom_api
 */
export async function getUserCustomApis(): Promise<BluefoxCustomApi[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('bluefox_custom_api')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Gagal mengambil daftar custom API:', error.message);
      return [];
    }
    return (data as BluefoxCustomApi[]) || [];
  } catch (err) {
    console.error('Error getUserCustomApis:', err);
    return [];
  }
}

/**
 * Menghapus konfigurasi Custom API dari tabel bluefox_custom_api
 */
export async function deleteUserCustomApi(apiId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bluefox_custom_api')
      .delete()
      .eq('id', apiId);

    if (error) {
      console.error('Gagal menghapus custom API:', error.message);
      alert('Gagal menghapus API: ' + error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleteUserCustomApi:', err);
    return false;
  }
}

/**
 * Mengambil informasi penggunaan harian dari tabel bluefox_usage_custom_api (Limit 100 req/hari)
 */
export async function getUserCustomApiDailyUsage(): Promise<{ usedToday: number; dailyLimit: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { usedToday: 0, dailyLimit: 100 };

    const todayStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('bluefox_usage_custom_api')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('usage_date', todayStr)
      .maybeSingle();

    if (!error && data) {
      return { usedToday: data.request_count || 0, dailyLimit: 100 };
    }
    return { usedToday: 0, dailyLimit: 100 };
  } catch {
    return { usedToday: 0, dailyLimit: 100 };
  }
}

/**
 * 3. Sistem Polling untuk Generasi Video (Asynchronous)
 * Khusus pembuatan video, jalankan fungsi pemantau (polling loop) di frontend yang mengecek status secara berkala tiap 5 detik hingga video selesai diproses.
 */
export function startVideoPolling(
  taskId: string, 
  selectedApiId: string, 
  onProgress?: (msg: string) => void,
  onFinish?: (videoUrl: string) => void,
  onFail?: (errMsg: string) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    // Tampilkan indikator loading di UI
    if (onProgress) {
      onProgress('Sedang memproses video...');
    }

    let attempts = 0;
    const maxAttempts = 120; // 120 * 5s = 10 menit

    const pollInterval = setInterval(async () => {
      attempts++;
      if (onProgress) {
        onProgress(`Sedang memproses video... (${attempts * 5} detik)`);
      }

      // Panggil Edge Function khusus pengecekan status
      const { data, error } = await supabase.functions.invoke('check-video-status', {
        body: {
          task_id: taskId,
          api_id: selectedApiId
        }
      });

      if (error) {
        clearInterval(pollInterval);
        alert('Gagal mengecek status video.');
        if (onFail) onFail('Gagal mengecek status video: ' + error.message);
        resolve(null);
        return;
      }

      // Jika video selesai dibuat
      if (data?.status === 'completed' || data?.status === 'succeeded') {
        clearInterval(pollInterval);
        const resolvedUrl = data.video_url || (Array.isArray(data.output) ? data.output[0] : null) || data.data?.video_url || data.data?.url;
        if (resolvedUrl) {
          if (onFinish) onFinish(resolvedUrl);
          resolve(resolvedUrl);
        } else {
          const errMsg = 'URL video tidak ditemukan pada data hasil.';
          if (onFail) onFail(errMsg);
          resolve(null);
        }
      } 
      // Jika proses gagal di API user
      else if (data?.status === 'failed') {
        clearInterval(pollInterval);
        alert('Proses pembuatan video di server kustom gagal.');
        if (onFail) onFail('Proses pembuatan video di server kustom gagal.');
        resolve(null);
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        alert('Waktu tunggu proses video telah habis (Timeout 10 menit).');
        if (onFail) onFail('Timeout 10 menit tercapai.');
        resolve(null);
      }
    }, 5000); // Polling setiap 5000ms (5 detik)
  });
}

/**
 * 2. Memanggil Edge Function Saat Generasi Gambar/Video
 * Ketika user menekan tombol Generate, frontend Bluefox memanggil Supabase Edge Function generate-custom-api
 * agar proses pemicuan rate limit (100 request/hari) dan dekripsi API key dilakukan di server.
 */
export async function handleGenerateContent(
  prompt: string, 
  selectedApiId: string,
  callbacks?: {
    setLoadingState?: (loading: boolean, message?: string) => void;
    displayGeneratedImage?: (imageUrl: string) => void;
    displayGeneratedVideo?: (videoUrl: string) => void;
    onError?: (errText: string) => void;
  }
): Promise<{ type: 'image' | 'video'; url: string; raw?: any } | null> {
  try {
    if (callbacks?.setLoadingState) {
      callbacks.setLoadingState(true, 'Mengirim permintaan generasi ke server...');
    }

    // Memanggil Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('generate-custom-api', {
      body: {
        api_id: selectedApiId,
        prompt: prompt
      }
    });

    // Jika terjadi error kuota habis (HTTP 429) atau error lainnya
    if (error) {
      if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
      const is429 = error.status === 429 || (error as any).code === 429 || error.message?.includes('429');
      if (is429) {
        alert('Batas harian 100 request untuk Custom API telah tercapai. Silakan coba lagi besok.');
        if (callbacks?.onError) callbacks.onError('Batas harian 100 request untuk Custom API telah tercapai.');
      } else {
        alert('Terjadi kesalahan: ' + error.message);
        if (callbacks?.onError) callbacks.onError(error.message);
      }
      return null;
    }

    if (!data) {
      if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
      alert('Terjadi kesalahan: Respons data kosong dari server.');
      return null;
    }

    // Penanganan berdasarkan tipe API
    if (data.type === 'image') {
      if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
      // Menampilkan gambar langsung ke UI Bluefox
      const imgUrl = data.data?.image_url || data.data?.url || data.image_url || data.url;
      if (imgUrl) {
        if (callbacks?.displayGeneratedImage) {
          callbacks.displayGeneratedImage(imgUrl);
        }
        return { type: 'image', url: imgUrl, raw: data };
      } else {
        alert('URL gambar tidak ditemukan di hasil respons server.');
        return null;
      }
    } else if (data.type === 'video') {
      // Jika video, dapatkan Task ID dan mulai polling status
      const taskId = data.data?.task_id || data.data?.id || data.task_id || data.id;
      if (!taskId) {
        // Cek jika video langsung tersedia tanpa task polling
        const directVideoUrl = data.data?.video_url || data.video_url || data.data?.url || data.url;
        if (directVideoUrl) {
          if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
          if (callbacks?.displayGeneratedVideo) {
            callbacks.displayGeneratedVideo(directVideoUrl);
          }
          return { type: 'video', url: directVideoUrl, raw: data };
        }
        if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
        alert('Task ID video tidak ditemukan pada respons server.');
        return null;
      }

      const videoUrl = await startVideoPolling(
        taskId, 
        selectedApiId,
        (progressMsg) => {
          if (callbacks?.setLoadingState) {
            callbacks.setLoadingState(true, progressMsg);
          }
        },
        (finishedUrl) => {
          if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
          if (callbacks?.displayGeneratedVideo) {
            callbacks.displayGeneratedVideo(finishedUrl);
          }
        },
        (err) => {
          if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
          if (callbacks?.onError) callbacks.onError(err);
        }
      );

      if (videoUrl) {
        return { type: 'video', url: videoUrl, raw: data };
      }
      return null;
    } else {
      // Fallback jika respon memiliki url langsung
      const fallbackUrl = data.data?.image_url || data.data?.url || data.image_url || data.video_url || data.url;
      if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
      if (fallbackUrl) {
        const isVideo = fallbackUrl.endsWith('.mp4') || fallbackUrl.includes('video');
        if (isVideo && callbacks?.displayGeneratedVideo) {
          callbacks.displayGeneratedVideo(fallbackUrl);
        } else if (callbacks?.displayGeneratedImage) {
          callbacks.displayGeneratedImage(fallbackUrl);
        }
        return { type: isVideo ? 'video' : 'image', url: fallbackUrl, raw: data };
      }
      alert('Tipe respon tidak dikenali: ' + data.type);
      return null;
    }

  } catch (err: any) {
    if (callbacks?.setLoadingState) callbacks.setLoadingState(false);
    console.error('Error saat eksekusi:', err);
    alert('Error saat eksekusi: ' + (err?.message || err));
    if (callbacks?.onError) callbacks.onError(err?.message || String(err));
    return null;
  }
}
