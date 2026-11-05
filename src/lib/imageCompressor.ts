/**
 * Utility Pemrosesan Gambar & File Vision di Frontend Bluefox AI
 *
 * Aturan Vision Model:
 * 1. PNG (image/png) -> Otomatis dikonversi ke format JPG (image/jpeg) agar ringan dan hemat bandwidth.
 * 2. JPEG / JPG (image/jpeg) -> Format standar langsung didukung (kompresi Canvas jika > 1MB atau dimensi besar).
 * 3. WEBP (image/webp) -> Format visual modern didukung.
 * 4. GIF Non-Animasi (image/gif) -> Hanya frame pertama yang diambil via Canvas dan dikonversi ke JPG. Format animasi bergerak tidak didukung.
 */

// Konversi File ke Base64 Standar
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

export interface ProcessedVisionResult {
  dataUrl: string;
  name: string;
  type: string;
  size: number;
  originalName: string;
  originalType: string;
  convertedNote?: string;
}

/**
 * Konversi otomatis file PNG ke format JPG (image/jpeg)
 * Mengisi latar belakang transparan dengan putih agar tidak menjadi artefak hitam
 */
export function convertPngToJpg(file: File): Promise<ProcessedVisionResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIMENSION = 1440;
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
          reject(new Error("Gagal menginisialisasi Canvas untuk konversi PNG ke JPG."));
          return;
        }

        // Latar belakang putih untuk menangani transparansi PNG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(objectUrl);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const approxSize = Math.round((dataUrl.length * 3) / 4);

        const newName = file.name.replace(/\.png$/i, '') + '.jpg';
        resolve({
          dataUrl,
          name: newName,
          type: 'image/jpeg',
          size: approxSize,
          originalName: file.name,
          originalType: 'image/png',
          convertedNote: 'PNG otomatis dikonversi ke JPG agar ringan'
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`File PNG "${file.name}" tidak dapat dimuat atau rusak.`));
    };

    img.src = objectUrl;
  });
}

/**
 * Konversi file GIF Non-Animasi ke JPG
 * Hanya mengambil frame pertama secara statis
 */
export function convertGifFirstFrameToJpg(file: File): Promise<ProcessedVisionResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIMENSION = 1440;
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
          reject(new Error("Gagal menginisialisasi Canvas untuk GIF frame pertama."));
          return;
        }

        // Canvas hanya merender frame pertama (non-animasi) dari file GIF
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(objectUrl);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const approxSize = Math.round((dataUrl.length * 3) / 4);

        const newName = file.name.replace(/\.gif$/i, '') + '-frame1.jpg';
        resolve({
          dataUrl,
          name: newName,
          type: 'image/jpeg',
          size: approxSize,
          originalName: file.name,
          originalType: 'image/gif',
          convertedNote: 'GIF frame 1 (non-animasi) dikonversi ke JPG'
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`File GIF "${file.name}" tidak dapat dimuat atau rusak.`));
    };

    img.src = objectUrl;
  });
}

/**
 * Kompresi standar file JPEG / WEBP jika ukuran > 1MB atau dimensi > 1440px
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIMENSION = 1440;
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

        const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
        const outputMime = isWebp ? 'image/webp' : 'image/jpeg';
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(objectUrl);
        const compressedBase64 = canvas.toDataURL(outputMime, 0.85);
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

/**
 * Universal Processor untuk Gambar Vision:
 * - PNG -> Konversi ke JPG
 * - GIF -> Ambil frame 1 ke JPG
 * - WEBP / JPEG -> Pertahankan dan kompres jika perlu
 */
export async function processVisionImage(file: File): Promise<ProcessedVisionResult> {
  const lowerName = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // 1. PNG -> Otomatis dikonversi ke JPG
  if (type === 'image/png' || lowerName.endsWith('.png')) {
    return await convertPngToJpg(file);
  }

  // 2. GIF -> Ambil frame pertama saja, jadikan JPG non-animasi
  if (type === 'image/gif' || lowerName.endsWith('.gif')) {
    return await convertGifFirstFrameToJpg(file);
  }

  // 3. WEBP atau JPEG / JPG
  const ONE_MB = 1024 * 1024;
  let dataUrl: string;

  if (file.size > ONE_MB) {
    dataUrl = await compressImageFile(file);
  } else {
    dataUrl = await fileToBase64(file);
  }

  const approxSize = Math.round((dataUrl.length * 3) / 4);
  return {
    dataUrl,
    name: file.name,
    type: file.type || 'image/jpeg',
    size: approxSize,
    originalName: file.name,
    originalType: file.type || 'image/jpeg'
  };
}

// Fungsi kompatibilitas lama
export async function prepareFilePayload(file: File): Promise<string | null> {
  if (!file) return null;
  const HUNDRED_MB = 100 * 1024 * 1024;

  if (file.size > HUNDRED_MB) {
    throw new Error("Ukuran file melebihi batas maksimal 100MB.");
  }

  if (file.type.startsWith('image/')) {
    const res = await processVisionImage(file);
    return res.dataUrl;
  }

  return await fileToBase64(file);
}

export const processAndCompressImage = prepareFilePayload;
