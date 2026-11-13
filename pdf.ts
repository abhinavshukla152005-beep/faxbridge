import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function firstPageToBlob(file: File): Promise<{ blob: Blob; pages: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = window.document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser');
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Could not rasterise PDF'))), 'image/png');
  });
  return { blob, pages: document.numPages };
}
