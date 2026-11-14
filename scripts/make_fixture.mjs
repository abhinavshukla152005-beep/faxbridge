import { readFile, writeFile } from 'node:fs/promises';
import { createWorker } from 'tesseract.js';

const worker = await createWorker('eng');
const buffer = await readFile('public/sample-referral.png');
const started = Date.now();
const { data } = await worker.recognize(buffer, {}, { blocks: true });

const words = (data.blocks ?? []).flatMap((block) =>
  block.paragraphs.flatMap((paragraph) =>
    paragraph.lines.flatMap((line) =>
      line.words.map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
      })),
    ),
  ),
);

const fixture = {
  text: data.text,
  words,
  width: 1000,
  height: 1290,
  ms: Date.now() - started,
};

await writeFile('public/demo-ocr.json', JSON.stringify(fixture));
console.log(`wrote public/demo-ocr.json (${words.length} words)`);
await worker.terminate();
