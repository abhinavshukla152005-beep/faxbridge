import { createWorker, type Worker } from 'tesseract.js';
import type { OcrResult, OcrWord } from './types';

let workerPromise: Promise<Worker> | null = null;

export function getWorker(onProgress?: (ratio: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (message) => {
        if (message.status === 'recognizing text' && onProgress) onProgress(message.progress);
      },
    });
  }
  return workerPromise;
}

export function medianConfidence(words: OcrWord[]): number {
  const values = words.map((word) => word.confidence).filter((value) => value > 0).sort((a, b) => a - b);
  if (!values.length) return 0;
  return values[Math.floor(values.length / 2)];
}

export async function imageToCanvas(source: Blob | string): Promise<HTMLCanvasElement> {
  const bitmap = typeof source === 'string' ? await loadImage(source) : await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser');
  context.drawImage(bitmap as CanvasImageSource, 0, 0);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the sample fax'));
    image.src = src;
  });
}

export async function recognize(
  source: Blob | string,
  onProgress?: (ratio: number) => void,
): Promise<OcrResult> {
  const started = performance.now();
  const canvas = await imageToCanvas(source);
  const worker = await getWorker(onProgress);
  // `blocks` is not part of the default output; request it explicitly so the
  // word bounding boxes needed by the scan overlay are actually populated.
  const { data } = await worker.recognize(canvas, {}, { blocks: true });

  const words: OcrWord[] = (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) =>
        line.words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1,
          },
        })),
      ),
    ),
  );

  return {
    text: data.text,
    words,
    width: canvas.width,
    height: canvas.height,
    ms: Math.round(performance.now() - started),
  };
}
