# FaxBridge — Requirements

## Problem

Clinics, courts and pharmacies still exchange paperwork by fax. The receiving end
retypes it. That retyping is slow, error-prone, and usually sends patient data
through a third-party OCR API.

FaxBridge reads the fax in the browser and hands back structured fields. Nothing
is uploaded.

## Glossary

- **Fax**: a scanned page, delivered as an image or a PDF.
- **Record**: the set of eight fields extracted from one fax.
- **Review flag**: a field whose confidence is below 0.8 and therefore needs a human.
- **Local**: executed in the page's own tab, with no network request carrying the document.

## Requirements

### R1 — Ingest

1. WHEN the user selects an image file under 8 MB, THE SYSTEM SHALL render it as the scan preview.
2. WHEN the user selects a PDF, THE SYSTEM SHALL rasterise page 1 at 2× scale and treat it as the fax.
3. IF a file exceeds 8 MB, THEN THE SYSTEM SHALL refuse it with a readable message and keep the previous record.
4. WHEN a file is dragged onto the drop panel, THE SYSTEM SHALL treat it exactly like a file-picker selection.

### R2 — Recognise

1. WHEN a fax is ingested, THE SYSTEM SHALL run OCR locally and report progress as a 0–1 ratio.
2. WHEN OCR completes, THE SYSTEM SHALL expose every recognised word with its bounding box and confidence.
3. THE SYSTEM SHALL reuse one OCR worker per session so repeat faxes avoid re-initialising the engine.
4. IF OCR throws, THEN THE SYSTEM SHALL surface the error and return to the idle state without losing the last record.

### R3 — Extract

1. WHEN OCR text is available, THE SYSTEM SHALL extract: patient name, date of birth, patient ID, fax date, sender, recipient, phone/fax and reason.
2. WHEN a labelled line matches, THE SYSTEM SHALL score it at 0.92 before OCR adjustment.
3. WHEN a date is genuinely ambiguous (both parts ≤ 12), THE SYSTEM SHALL resolve it as day/month, score it 0.70, and flag it for review.
4. WHEN a date is impossible (e.g. 31 February), THE SYSTEM SHALL reject the candidate rather than record it.
5. WHEN no labelled phone exists, THE SYSTEM SHALL fall back to the first phone-shaped token at 0.50 confidence.
6. THE SYSTEM SHALL scale every field score by the page's median OCR confidence.
7. THE SYSTEM SHALL flag any field with a score in (0, 0.8) for review.

### R4 — Review

1. WHEN a field is focused or hovered, THE SYSTEM SHALL highlight the OCR words that produced it.
2. THE SYSTEM SHALL allow every field value to be corrected without discarding the record.
3. THE SYSTEM SHALL show completion as filled fields over total fields.

### R5 — Hand-off

1. WHEN the user copies, THE SYSTEM SHALL place the full record on the clipboard as JSON.
2. WHEN the user exports, THE SYSTEM SHALL produce a `.json` or `.csv` download.
3. WHEN the user supplies a webhook URL, THE SYSTEM SHALL POST the record as JSON and report the outcome, including CORS refusal.

### R6 — Privacy

1. THE SYSTEM SHALL perform ingest, OCR, extraction and export without uploading the document.
2. THE SYSTEM SHALL never send document content to a network endpoint that the user did not explicitly configure.

### R7 — Demo

1. WHEN `?demo=1` is present, THE SYSTEM SHALL process the bundled sample automatically.
2. WHEN `?demo=1&fixture=1` is present, THE SYSTEM SHALL replay the cached OCR result so the demo survives a blocked CDN.
