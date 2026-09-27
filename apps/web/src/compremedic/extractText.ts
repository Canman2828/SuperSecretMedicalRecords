// Turns an uploaded photo, PDF, or Word document into plain text, entirely in the browser.
// The file never leaves the device: images and scanned pages are read with Tesseract (OCR),
// PDFs with a text layer are read directly, and .docx files are unzipped with mammoth.
// Heavy libraries are imported on demand so they don't weigh down the rest of the site.

export type ExtractMethod = 'photo' | 'pdf' | 'scanned-pdf' | 'docx';

export interface Extracted {
  text: string;
  method: ExtractMethod;
  /** OCR confidence 0..1; undefined when the text was read directly (not OCR). */
  confidence?: number;
}

export type OnProgress = (label: string, fraction?: number) => void;

export const ACCEPT = 'image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MAX_PDF_OCR_PAGES = 10;

export class ExtractError extends Error {}

export async function extractText(file: File, onProgress: OnProgress): Promise<Extracted> {
  const name = file.name.toLowerCase();
  let result: Extracted;

  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/.test(name)) {
    result = await ocrImages([file], onProgress);
    result.method = 'photo';
  } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    result = await readPdf(file, onProgress);
  } else if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    result = await readDocx(file, onProgress);
  } else if (name.endsWith('.doc')) {
    throw new ExtractError('Older .doc files aren’t supported. Save it as .docx or PDF and try again.');
  } else {
    throw new ExtractError('That file type isn’t supported. Use a photo, a PDF or a Word (.docx) document.');
  }

  result.text = tidy(result.text);
  if (result.text.replace(/\W/g, '').length < 3) {
    throw new ExtractError(
      result.method === 'photo' || result.method === 'scanned-pdf'
        ? 'We couldn’t find any text. Try a sharper, well-lit photo with the text filling the frame.'
        : 'That document doesn’t seem to contain any text.',
    );
  }
  return result;
}

/** Normalize whitespace but keep line and paragraph breaks (labels are line-based). */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/-\n(?=[a-z])/g, '') // re-join words hyphenated across lines
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type ImageInput = File | HTMLCanvasElement;

async function ocrImages(images: ImageInput[], onProgress: OnProgress): Promise<Extracted> {
  onProgress('Getting the text reader ready…');
  const { createWorker } = await import('tesseract.js');
  let page = 0;
  const worker = await createWorker('eng', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const label = images.length > 1 ? `Reading text, page ${page + 1} of ${images.length}…` : 'Reading text…';
        onProgress(label, (page + m.progress) / images.length);
      }
    },
  });
  try {
    const texts: string[] = [];
    let confidence = 0;
    for (; page < images.length; page++) {
      const { data } = await worker.recognize(images[page]);
      texts.push(data.text);
      confidence += data.confidence / 100;
    }
    return { text: texts.join('\n\n'), method: 'photo', confidence: confidence / images.length };
  } finally {
    await worker.terminate();
  }
}

async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

async function readPdf(file: File, onProgress: OnProgress): Promise<Extracted> {
  onProgress('Opening the PDF…');
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress(`Reading page ${p} of ${doc.numPages}…`, p / doc.numPages);
      const content = await (await doc.getPage(p)).getTextContent();
      pages.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''));
    }
    const text = pages.join('\n\n');
    if (text.replace(/\s/g, '').length >= 20) return { text, method: 'pdf' };

    // No text layer: it's a scan. Render the pages and OCR them.
    const count = Math.min(doc.numPages, MAX_PDF_OCR_PAGES);
    const canvases: HTMLCanvasElement[] = [];
    for (let p = 1; p <= count; p++) {
      onProgress(`Preparing scanned page ${p} of ${count}…`);
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      canvases.push(canvas);
    }
    const ocr = await ocrImages(canvases, onProgress);
    return { ...ocr, method: 'scanned-pdf' };
  } finally {
    void task.destroy();
  }
}

async function readDocx(file: File, onProgress: OnProgress): Promise<Extracted> {
  onProgress('Opening the Word document…');
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: value, method: 'docx' };
}
