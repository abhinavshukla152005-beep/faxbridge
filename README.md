# FaxBridge

The fax machine never died. Clinics, courts and pharmacies still receive
paperwork on it, and someone still retypes every page into a system.

FaxBridge reads a fax in the browser and hands back eight structured fields —
name, date of birth, patient ID, fax date, sender, recipient, phone and reason —
with a confidence score on each one. The document never leaves the tab.

Built for **Kiroween 2026**, Frankenstein category: paper-era fax stitched to a
browser OCR engine, a parser and a webhook.

## Try it

Live: **<https://faxbridge-demo.web.app/?demo=1>**

Locally:

```bash
npm install
npm run dev
```

- `/` — drop a scan, or press **Use sample**
- `/?demo=1` — runs the bundled sample automatically
- `/?demo=1&fixture=1` — replays a cached OCR result, so the demo still works if
  the OCR language CDN is blocked

## Demo video

`video/faxbridge-demo.mp4` — just under two minutes, recorded from the deployed
app by `scripts/record-demo.mjs` (headless Edge over the DevTools protocol, so
the footage is the real pipeline rather than a mock). `scripts/build-video.mjs`
burns in the captions; there is no narration track.

Long-form write-up: <https://faxbridge-demo.web.app/blog/>
(canonical markdown in [`blog/kiroween-faxbridge.md`](blog/kiroween-faxbridge.md)).

## How it works

```
file ──► pdf rasteriser ──► tesseract worker ──► parser ──► review UI ──► JSON / CSV / webhook
```

1. **Ingest.** Image or PDF. PDFs are rasterised at 2× and page 1 is read.
2. **Recognise.** Tesseract runs in a worker; every word comes back with a
   bounding box and a confidence, which is what the overlay draws.
3. **Extract.** Labelled lines are scored 0.92; generic pattern matches score
   lower. Every score is multiplied by the page's median word confidence.
4. **Review.** Below 0.8 a field is flagged. Ambiguous dates (`05/06/1980`) are
   resolved day-first, scored 0.70 and flagged — never silently guessed.
5. **Hand off.** Copy JSON, download JSON/CSV, or POST to a webhook you supply.

## How Kiro was used

Everything Kiro-specific lives in [`.kiro/`](.kiro/) and is intentionally committed.

| Kiro feature | Where | What it did |
| --- | --- | --- |
| Spec-driven development | `.kiro/specs/faxbridge/` | Requirements (R1–R7) written before code; design and tasks derived from them |
| Steering | `.kiro/steering/` | Product, tech and structure rules; the "never hide a guess" rule shaped the confidence model |
| Agent hooks | `.kiro/hooks/` | `npm test` on every source edit; a parser review prompt that fires when `extract.ts` changes; a spec-drift check |
| Custom agents | `.kiro/agents/` | `ocr-reviewer` (checks extraction diffs against R3) and `privacy-auditor` (hunts for anything that moves fax content off-device) |
| MCP | `mcp/fax-tools/server.mjs` | `normalize_date` and `validate_record`, so date behaviour could be checked mid-build instead of in a scratch file |
| Property-based testing | `src/lib/extract.test.ts` | Date round-trip across every valid day; phone normaliser rejects short input |

The spec was the reason the ambiguity rule exists: writing R3.3 down forced the
question "what does `05/06` actually mean here", which is the one place this tool
could quietly produce a wrong record.

## Tests

```bash
npm test
```

8 tests, including two fast-check properties over the date and phone normalisers.

## Limits

- Page 1 only. Multi-page filings need the fields joined across pages.
- English only. Hindi and Marathi packs are the next step.
- No storage: close the tab and the record is gone. That is the privacy promise.
- The webhook export is CORS-bound; a browser cannot deliver to a server that
  does not allow it, and the UI says so rather than failing silently.

## Licence

MIT — see [LICENSE](LICENSE).
