import * as pdfjsLib from 'pdfjs-dist';

// Konfigurasi worker PDF.js agar kompatibel dengan Vite dan browser
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

/**
 * Mengekstrak seluruh teks dari file PDF secara bersih per halaman
 * sehingga model DeepSeek dapat membaca dan menganalisis isi dokumen PDF sepenuhnya.
 */
export async function extractTextFromPdf(file: File): Promise<{ text: string; numPages: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });
    
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    let combinedText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean);
      
      const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
      if (pageText) {
        combinedText += `\n[Halaman ${i}/${numPages}]\n${pageText}\n`;
      }
    }

    return {
      text: combinedText.trim(),
      numPages,
    };
  } catch (error: any) {
    console.error('Error saat membaca file PDF:', error);
    throw new Error(error?.message || 'Gagal mengekstrak teks dari file PDF.');
  }
}
