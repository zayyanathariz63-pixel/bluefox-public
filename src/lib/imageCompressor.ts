/**
 * Utility Pemrosesan File di Frontend Website (JavaScript / TypeScript)
 * Memisahkan penanganan file berdasarkan tipe MIME (file.type):
 * 1. Gambar (image/*): Jika <= 1MB dikonversi langsung via fileToBase64, jika 1MB–100MB dikompres via Canvas (URL.createObjectURL).
 * 2. Audio (MP3, WAV, dsb.) atau file non-gambar: Langsung dibaca ke Base64 via FileReader tanpa melalui Canvas gambar.
 * 3. Batas ukuran maksimal file: 100MB.
 */

// Konversi File ke Base64 Standar (Untuk MP3 / Audio / Gambar <= 1MB / Dokumen)
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Gagal mengonversi file ke format Base64."));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

// Khusus kompresi file Gambar menggunakan ObjectURL & Canvas (Hemat RAM)
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    // Pasang handler onload dan onerror sebelum mengisi img.src
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIMENSION = 1280;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          fileToBase64(file).then(resolve).catch(reject);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(objectUrl);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressedBase64);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Format gambar tidak valid atau file rusak."));
    };

    img.src = objectUrl;
  });
}

// Fungsi universal untuk memproses Gambar, MP3, dan dokumen lainnya
export async function prepareFilePayload(file: File): Promise<string | null> {
  if (!file) return null;

  const ONE_MB = 1024 * 1024;
  const HUNDRED_MB = 100 * 1024 * 1024;

  if (file.size > HUNDRED_MB) {
    throw new Error("Ukuran file melebihi batas maksimal 100MB.");
  }

  // 1. Jika tipe file adalah GAMBAR, jalankan kompresi Canvas jika > 1MB
  if (file.type.startsWith('image/')) {
    if (file.size <= ONE_MB) {
      return await fileToBase64(file);
    }
    return await compressImageFile(file);
  }

  // 2. Jika tipe file adalah AUDIO (MP3, WAV, dsb) atau file lain
  // BACA LANGSUNG TANPA KANVAS GAMBAR
  return await fileToBase64(file);
}

// Alias untuk kompatibilitas fungsi sebelumnya
export const processAndCompressImage = prepareFilePayload;


