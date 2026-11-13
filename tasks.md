# FaxBridge — Tasks

Ordered the way the spec was implemented. Each task names the requirement it
satisfies so a reviewer can check behaviour against intent.

## 1. Skeleton
- [x] 1.1 Vite + React + TypeScript app, no UI kit (R1)
- [x] 1.2 `lib/types.ts` — `Field`, `OcrWord`, `FaxRecord` (R3)

## 2. Recognition
- [x] 2.1 `lib/ocr.ts` worker singleton with progress callback (R2.1, R2.3)
- [x] 2.2 Request `blocks` output explicitly — v7 omits it by default (R2.2)
- [x] 2.3 `lib/pdf.ts` first-page rasteriser (R1.2)

## 3. Extraction
- [x] 3.1 `normalizeText`, `linesOf` (R3.1)
- [x] 3.2 Labelled extraction with priors (R3.2)
- [x] 3.3 `normalizeDate` with day-first ambiguity flag (R3.3, R3.4)
- [x] 3.4 `normalizePhone` for Indian formats (R3.5)
- [x] 3.5 Page-confidence scaling and review threshold (R3.6, R3.7)

## 4. Interface
- [x] 4.1 Drag/drop + picker + 8 MB guard (R1.1, R1.3, R1.4)
- [x] 4.2 Scan overlay whose boxes correspond to OCR words (R2.2, R4.1)
- [x] 4.3 Editable field list with confidence chips and review badges (R4.2, R4.3)
- [x] 4.4 Completion meter (R4.3)

## 5. Hand-off
- [x] 5.1 Copy JSON (R5.1)
- [x] 5.2 `.json` / `.csv` download (R5.2)
- [x] 5.3 Webhook route with CORS-aware result message (R5.3)

## 6. Proof
- [x] 6.1 Unit tests for extraction and normalisers (R3)
- [x] 6.2 Property tests: date round-trip, phone rejects short input (R3.3, R3.5)
- [x] 6.3 Synthetic sample fax generator (R7)
- [x] 6.4 Cached OCR fixture for CDN-offline demo (R7.2)

## 7. Still open
- [ ] 7.1 Multi-page PDFs
- [ ] 7.2 Field-level audit trail (who corrected what, when)
- [ ] 7.3 Language packs for Hindi and Marathi faxes
