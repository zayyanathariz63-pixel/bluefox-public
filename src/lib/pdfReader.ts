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

export interface PdfSlideResult {
  pageNumber: number;
  totalPages: number;
  dataUrl: string;
  name: string;
  size: number;
  text: string;
}

/**
 * Mengekstrak seluruh teks dari file PDF secara bersih per halaman
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

/**
 * Konversi setiap slide/halaman file PDF menjadi gambar JPG (image/jpeg)
 * Memungkinkan model Vision menganalisis slide presentasi / dokumen secara visual
 * tanpa beban memori tinggi (kompresi JPG ringan per halaman).
 */
export async function convertPdfToJpgSlides(
  file: File, 
  maxPages: number = 8
): Promise<PdfSlideResult[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const pagesToRender = Math.min(totalPages, maxPages);
    const slides: PdfSlideResult[] = [];

    const baseName = file.name.replace(/\.pdf$/i, '');

    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      
      // Ambil teks halaman
      let pageText = '';
      try {
        const textContent = await page.getTextContent();
        const strings = textContent.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
          .filter(Boolean);
        pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
      } catch {
        pageText = '';
      }

      // Hitung skala viewport agar resolusi jernih namun tetap ringan (maksimal lebar ~1280px)
      const baseViewport = page.getViewport({ scale: 1.0 });
      const maxDim = Math.max(baseViewport.width, baseViewport.height);
      const targetScale = Math.min(1.5, Math.max(0.8, 1280 / maxDim));
      const viewport = page.getViewport({ scale: targetScale });

      // Siapkan Canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        continue;
      }

      // Beri warna latar putih untuk slide
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render halaman PDF ke canvas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderContext: any = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Konversi ke format JPG dengan kompresi 0.82 agar ringan
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const approxSize = Math.round((jpgDataUrl.length * 3) / 4);

      slides.push({
        pageNumber: pageNum,
        totalPages: totalPages,
        dataUrl: jpgDataUrl,
        name: `${baseName} (Slide ${pageNum} dari ${totalPages}).jpg`,
        size: approxSize,
        text: pageText,
      });
    }

    return slides;
  } catch (error: any) {
    console.error('Error saat konversi PDF ke slide JPG:', error);
    throw new Error(error?.message || 'Gagal mengonversi halaman PDF menjadi gambar slide JPG.');
  }
}
