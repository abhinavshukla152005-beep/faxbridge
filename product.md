# Product steering

FaxBridge is a clinic tool, not a demo. Write copy the way a receptionist would
read it: short, specific, no enthusiasm.

Rules the product must never break:

1. **Local by default.** No document content leaves the tab unless the user typed
   the destination URL themselves. Do not add analytics, telemetry or "sample"
   endpoints that carry text.
2. **Show uncertainty.** A field under 0.8 is flagged, not hidden and not rounded
   up. Never present a heuristic guess as a confirmed read.
3. **No silent guessing on dates.** Day-first, flagged. If two readings are both
   valid, the human decides.
4. **One page.** Saying "page 1 only" beats pretending to handle a 12-page filing.

Voice: plain declarative sentences. No exclamation marks, no "seamless",
"revolutionary", "AI-powered" or emoji in the UI.

When adding a feature, ask which requirement in
`.kiro/specs/faxbridge/requirements.md` it serves. If the answer is "none", add
the requirement first.
