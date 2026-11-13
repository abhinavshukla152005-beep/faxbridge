# Structure steering

```
.kiro/            specs, steering, hooks, agents, mcp config (must stay committed)
mcp/fax-tools/    stdio MCP server used while building
public/           sample fax + cached OCR fixture
scripts/          sample and fixture generators (Node + Python)
src/lib/          pure logic: extract, export, ocr, pdf, types
src/components/   presentation only
```

Rules:

- A new parse rule goes in `src/lib/extract.ts` and gets a test in
  `src/lib/extract.test.ts` in the same change.
- A new field is added to `LABELS`, to `FieldKey`, and to the sample fax, in that
  order.
- Components receive data and callbacks; they never import the OCR engine.
- Anything generated (fixtures, sample images) is produced by a script in
  `scripts/`, never edited by hand.
- `.kiro/` is part of the submission. Never add it to `.gitignore`.
