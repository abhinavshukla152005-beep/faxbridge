# Devpost submission copy — FaxBridge

Everything below is paste-ready. Links marked `<TODO>` are the two things only
you can create (public GitHub repo, YouTube video).

---

## Name

FaxBridge

## Tagline (max ~200 chars)

Reads a scanned fax referral in the browser and returns eight structured fields
with a confidence score — without ever uploading the page.

## Category

Frankenstein — paper-era fax stitched to a browser OCR engine, a parser and a
webhook.

## Links

- Live app: https://faxbridge-demo.web.app/?demo=1
- Source: `<TODO: https://github.com/<you>/faxbridge>`
- Demo video: `<TODO: https://youtu.be/...>` (encoded copy in `video/faxbridge-demo.mp4`, 1:50)
- Blog post: https://faxbridge-demo.web.app/blog/

## Inspiration

A fax is the one document where the person handling it has the least authority
to send it somewhere new. Clinics still receive referrals, lab results and
discharge summaries as scanned paper, and someone retypes the same eight fields
into an EMR. The standard build — upload the PDF, call a cloud OCR API — moves
private medical information to a service the clinic has no relationship with.

I wanted to see how far a read could get inside the tab.

## What it does

Drop a scanned fax (image or PDF) and FaxBridge returns eight fields: patient
name, date of birth, patient ID, fax date, sender, recipient, phone and reason
for referral.

Every field carries a confidence score and can be edited before export. Hovering
a field highlights the exact words on the scan that produced it. Export is JSON,
CSV, or a POST to a webhook you supply.

The pipeline runs entirely client-side: pdf.js rasterises the page, Tesseract
runs in a Web Worker, and a line-based parser scores each field. There is no
backend and no upload path — close the tab and nothing is left.

The part I care most about: when the page says `DOB: 05/06/1980`, the tool does
not pick May 6th or June 5th and move on. It resolves day-first, scores the field
0.70 and flags it for review.

## How I built it

- **Vite + React + TypeScript**, hand-written CSS in a paper/ink palette.
- **pdf.js** rasterises page 1 at 2× so a already-faxed scan still has pixels to
  read.
- **Tesseract.js v7** in a worker, requesting `blocks` so every word comes back
  with a bounding box — those boxes are the overlay.
- **A pure parser module** (`extract.ts`) that scores labelled matches at 0.92
  and bare pattern matches at 0.50–0.55, then multiplies by the page's median
  word confidence.
- **Vitest + fast-check** for the date and phone normalisers, including a
  property that every valid calendar day survives a write-then-read round trip.

## How I used Kiro

Kiro was the spec layer, not an autocomplete. Everything Kiro-specific is
committed in [`.kiro/`](.kiro/):

- **Spec-driven development** — `.kiro/specs/faxbridge/requirements.md` holds
  R1–R7 in EARS form, with design and tasks derived from them. Requirement R3.3
  ("an ambiguous date must be flagged, never silently resolved") is the reason
  the ambiguity rule exists at all. Writing it down before the code forced the
  question the tool would otherwise answer by accident.
- **Steering** — `.kiro/steering/{product,tech,structure}.md`. Product holds the
  non-negotiables: local by default, show uncertainty, no silent date guessing.
  Tech records the two tesseract rules that cost me a debugging session.
- **Agent hooks** — `.kiro/hooks/`: `test-on-save` runs the suite on any source
  edit; `parser-guard` asks the agent to review `extract.ts` against R3 because
  that is the file where a tidy-up can silently change a score; `spec-drift`
  reconciles `tasks.md` when the requirements change.
- **Custom agents** — `.kiro/agents/ocr-reviewer.json` reviews extraction
  changes against R3. `privacy-auditor.json` looks for anything that moves fax
  content off-device: a fetch, a form post, an analytics call, a CDN that sees
  the image.
- **MCP** — `mcp/fax-tools/server.mjs`, a dependency-free stdio server with
  `normalize_date` and `validate_record`, registered in
  `.kiro/settings/mcp.json`, so date behaviour could be checked inside the agent
  loop instead of a scratch file.
- **Property-based testing** — fast-check properties over the normalisers.

## Challenges

Tesseract.js v7 returns no word data unless you ask: `data.blocks` is undefined
by default. My first build showed correct field values with every confidence at
51% and a 0% page score, because the confidence chain multiplied by nothing. It
was invisible in the UI — the values looked right, so the percentages read as
tesseract being pessimistic rather than the chain being broken. A tool whose
promise is calibrated uncertainty has to treat a confidence bug as a correctness
bug. The fix is one argument (`{ blocks: true }`); the lesson is in the steering
file.

The other hard part was refusing to be clever. Day-first vs month-first is
genuinely undecidable from the page, so the honest output is a correct-looking
value with a visible warning, not a silent 90%.

## Accomplishments

- 82 words read on the bundled sample, 96% median word confidence, 8/8 fields,
  ~4.5s warm in a desktop browser.
- Two fields flagged for review — both genuinely ambiguous dates, which is the
  system working.
- Eight tests, two of them properties over the normalisers.
- No network request on the ingest or OCR path.

## What I learned

The interesting decisions in this build were about what the tool should refuse
to answer. A spec written as requirements, rather than as a chat, is what kept
those decisions visible a few hours later.

## What's next

- Multi-page filings, joining fields across pages.
- Hindi and Marathi language packs — that is what arrives at a district hospital.
- An audit trail that records which fields a human changed, kept locally.

## Built with

react, typescript, vite, tesseract.js, pdf.js, vitest, fast-check, kiro, mcp,
firebase-hosting
