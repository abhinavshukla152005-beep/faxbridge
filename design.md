# FaxBridge — Design

## Shape

A single-page React app. There is no server in the data path: OCR, parsing and
export all run in the tab. That constraint is the product, not a shortcut —
patient data never leaves the device.

```
file ──► pdf.ts (PDF only) ──► ocr.ts (tesseract worker) ──► extract.ts ──► App state ──► UI / export
```

## Modules

| Module | Responsibility | Deliberately knows nothing about |
| --- | --- | --- |
| `lib/ocr.ts` | Own the worker, return words + boxes | React, fields |
| `lib/pdf.ts` | Rasterise page 1 | OCR, fields |
| `lib/extract.ts` | Text → scored fields | DOM, OCR engine |
| `lib/export.ts` | Record → JSON/CSV | UI |
| `components/ScanViewer.tsx` | Scan + bbox overlay | Extraction |
| `components/FieldList.tsx` | Editable fields, confidence chips | OCR |

`extract.ts` is pure. Every rule in the requirements maps to a function that
takes strings and returns data, which is why it is the only module with tests
that must stay green.

## Confidence model

Field score = label prior × page factor.

- Label prior: 0.92 for a labelled match, 0.55 for a generic date scan, 0.50 for a generic phone scan. An ambiguous date subtracts 0.22.
- Page factor: `clamp(medianWordConfidence / 90, 0.55, 1)`.

The product rule that falls out of this: below 0.8 the field is flagged, and the
UI never pretends a guess is a fact. A scribbled fax should slow the user down,
not lie to them.

## Why day-first

`05/06/1980` is 5 June in India and 6 May in the US. The tool is built for the
Indian paperwork it was born from, so it resolves day-first, drops the score to
0.70 and asks for a human. Guessing silently would be the only real bug here.

## Asset and CDN strategy

Tesseract's language data comes from a CDN on first use (~4 s cold, ~950 ms warm
in the demo machine). If that CDN is unreachable, `?fixture=1` replays a cached
OCR result for the bundled sample so a judge can still see the product working.

## Non-goals

- No multi-page documents. Page 1 only, stated in the UI.
- No cloud sync, accounts or storage. The record lives in the tab.
- No LLM in the extraction path: a hallucinated patient name is worse than a
  blank field.
