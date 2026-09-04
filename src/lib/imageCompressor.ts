/**
 * Utility Kompresi Gambar di Frontend Website (JavaScript / TypeScript)
 * Menggunakan URL.createObjectURL yang hemat memori (mencegah browser HP freeze),
 * urutan event listener onload/onerror sebelum img.src,
 * dimensi maksimal 1280px, dan kualitas JPEG 0.6.
 */

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function processAndCompressImage(file: File): Promise<string> {
  const ONE_MB = 1024 * 1024;
  const HUNDRED_MB = 100 * 1024 * 1024;

  if (file.size > HUNDRED_MB) {
    throw new Error("Ukuran file terlalu besar. Maksimal 100MB.");
  }

  // Jika file 1MB atau kurang, konversi langsung tanpa kompresi Canvas
  if (file.size <= ONE_MB) {
    return await fileToBase64(file);
  }

  // Jika ukuran file 1MB - 100MB, kompresi menggunakan ObjectURL (Sangat Hemat RAM)
  return new Promise<string>((resolve, reject) => {
    // Gunakan Blob URL agar tidak memakan RAM browser
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    // 1. Wajib pasang handler ONLOAD & ONERROR sebelum mengisi img.src
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Batasi dimensi maksimal 1280px agar proses cepat dan hasil di bawah 2MB
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
          reject(new Error("Gagal menginisialisasi context canvas 2D."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Hapus ObjectURL dari memori browser
        URL.revokeObjectURL(objectUrl);

        // Export gambar ke JPEG dengan kualitas 0.6
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressedBase64);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca gambar. Format file mungkin tidak didukung atau file corrupt."));
    };

    // 2. Pasang src SETELAH event handler di atas siap
    img.src = objectUrl;
  });
}

