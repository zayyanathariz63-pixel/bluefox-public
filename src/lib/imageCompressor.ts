/**
 * Utility Kompresi Gambar di Frontend Website (JavaScript / TypeScript)
 * Memeriksa apakah ukuran file berada di rentang 1MB–100MB.
 * Jika file melebihi 1MB, browser akan otomatis mengompres ukurannya
 * hingga menjadi di bawah 2MB sebelum diubah ke format Base64/dikirim.
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
    throw new Error("Ukuran file melebihi batas maksimal 100MB.");
  }

  // Jika ukuran file di bawah 1MB, tidak perlu dikompres
  if (file.size <= ONE_MB) {
    return await fileToBase64(file);
  }

  // Jika ukuran file antara 1MB - 100MB, kompres file di Canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = (event.target?.result as string) || '';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize rasio dimensi jika ukuran terlalu besar
        const MAX_DIMENSION = 1920;
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
          reject(new Error("Gagal menginisialisasi context canvas 2D."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Kompres dengan kualitas 0.7 (menghasilkan file jauh di bawah 2MB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedBase64);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
