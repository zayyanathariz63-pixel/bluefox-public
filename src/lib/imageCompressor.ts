/**
 * Utility Kompresi Gambar di Frontend Website (JavaScript / TypeScript)
 * Aturan:
 * 1. File <= 2MB (di bawah 1-2MB): Langsung kirim TANPA KOMPRES (fileToBase64).
 * 2. File 2MB - 100MB: Kompres menggunakan ObjectURL & Canvas agar ukuran menjadi di bawah 2MB.
 * 3. File > 100MB: Ditolak dengan pesan batas maksimal 100MB.
 */

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

export async function processAndCompressImage(file: File): Promise<string> {
  const TWO_MB = 2 * 1024 * 1024; // 2MB
  const HUNDRED_MB = 100 * 1024 * 1024; // 100MB

  if (file.size > HUNDRED_MB) {
    throw new Error("Ukuran file terlalu besar. Maksimal 100MB.");
  }

  // Jika ukuran file di bawah 1-2MB (<= 2MB), LANGSUNG KIRIM TANPA KOMPRES
  if (file.size <= TWO_MB) {
    console.log(`[Image] File "${file.name}" berukuran ${(file.size / (1024 * 1024)).toFixed(2)}MB (<= 2MB): langsung dikonversi tanpa kompresi Canvas.`);
    return await fileToBase64(file);
  }

  // Jika ukuran file antara 2MB - 100MB, kompresi menggunakan ObjectURL & Canvas (Sangat Hemat RAM)
  console.log(`[Image] File "${file.name}" berukuran ${(file.size / (1024 * 1024)).toFixed(2)}MB (> 2MB): mengompresi gambar via Canvas...`);

  return new Promise<string>((resolve) => {
    // Timeout pelindung: jika pemrosesan Canvas macet > 5 detik, fallback ke file original agar request tetap terkirim
    const fallbackTimer = setTimeout(async () => {
      console.warn("[Image] Timeout proses kompresi, fallback langsung mengirim Base64 asli.");
      try {
        const fallback = await fileToBase64(file);
        resolve(fallback);
      } catch {
        resolve('');
      }
    }, 5000);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    // 1. Wajib pasang handler ONLOAD & ONERROR sebelum mengisi img.src
    img.onload = () => {
      clearTimeout(fallbackTimer);
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
          fileToBase64(file).then(resolve);
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
        console.warn("[Image] Gagal kompres Canvas, fallback ke Base64 langsung:", err);
        fileToBase64(file).then(resolve);
      }
    };

    img.onerror = () => {
      clearTimeout(fallbackTimer);
      URL.revokeObjectURL(objectUrl);
      console.warn("[Image] Gagal memuat gambar untuk kompresi, fallback ke Base64 langsung.");
      fileToBase64(file).then(resolve);
    };

    // 2. Pasang src SETELAH event handler di atas siap
    img.src = objectUrl;
  });
}

