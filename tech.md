# Tech steering

- React 19 + TypeScript, Vite. No UI library: the fax-paper look is hand-written
  CSS in `src/index.css`.
- Tesseract.js (`eng`) runs in a worker. Keep one worker per session; call
  `terminate()` only when the tab closes.
- `worker.recognize(image, {}, { blocks: true })` — the third argument is
  required. Without it `data.blocks` is `undefined` and the overlay silently
  renders zero boxes.
- PDFs: `pdfjs-dist` rasterises page 1 at 2× before OCR. Keep the worker URL as a
  Vite `?url` import so it is bundled, not fetched from a CDN.
- Parsing code is pure and framework-free. No React imports under `src/lib`
  except `ocr.ts`, which touches the DOM canvas by nature.
- Tests: Vitest + fast-check. Property tests are reserved for normalisers
  (dates, phones) where the input space is large and the invariants are crisp.
- Every threshold that a judge or clinician could argue about lives in one named
  constant or one named function, never inline in a component.
- Bundle budget: keep the main chunk under ~800 kB gzipped; OCR and PDF workers
  load lazily on first use.
