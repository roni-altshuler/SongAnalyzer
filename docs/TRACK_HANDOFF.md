# Selected-track handoff

The production-browser baseline on main
`d314fb0a71d52322cc03854853a42f8c079c42d5` reproduced an interaction gap:
**select a track → Analyze lyrics** landed above an unfocused text field and
displayed two buttons named “Analyze lyrics.” The selected-card action changed
mode; the form button submitted text. The primary-looking alternative was local
audio, even though a catalog track cannot supply permitted audio here.

The [baseline report](TRACK_HANDOFF_BASELINE.json) records actual geometry and
focus from Chromium using original controlled metadata. Live search returned
503; the fixture does not establish a provider success or real artist identity.

| Viewport | Before: field Y / focus / identically named buttons | After: field Y / focus / identically named buttons |
| --- | --- | --- |
| 390 × 900, light | 1146.5px / BODY / 2 | 290.0px / lyrics / 1 |
| 1440 × 900, light | 1051.4px / BODY / 2 | 290.1px / lyrics / 1 |

The selected card now has one primary **Add lyrics** action. Across routes it
links to the existing input via `?mode=lyrics#lyrics`; within the workbench it
switches to that input and focuses it after mounting. The field immediately scrolls to the
center of the viewport. **Analyze lyrics** names only the actual text submit
button. Repeating Add lyrics preserves the current page's draft without
submitting it or fetching any lyrics.
The input copy describes permitted text and translation availability instead
of promising better model quality from longer text or guaranteed translation.

The secondary local-audio path uses a native **Audio options** disclosure, with
the existing scope warning and file action inside. Active loading, errors and
ready-state scope remain visible outside the disclosure. Selecting another
track closes prior optional controls. Existing Card/Button/Badge primitives,
fonts, palette, artist links, source branding and listening links are reused.
No background or ambient-animation change is part of this work.

PR16's selection boundary is preserved: only source metadata follows internal
navigation; lyrics drafts, files and results remain page-local. Clear and local
file selection remove unrelated attribution. Reload/new tab begins without a
selected track. The source hook, selection provider, recognition pipeline,
analysis algorithms and database/access rules are unchanged.

## Browser evidence

The [production report](TRACK_HANDOFF_QA.json) was recorded against `next start`
in the saved cloud environment. It contains six journeys: 390, 768 and 1440px,
each in light/dark with a saved theme opposite the OS preference. Light uses
reduced motion; dark uses normal motion. All six handoffs focused `#lyrics`
entirely inside the viewport and showed one Analyze lyrics submit control.
All 44 full-page Axe WCAG 2/2.1 A/AA scans passed with zero horizontal overflow.

- Keyboard Enter activates Add lyrics and artist links. Native Enter/Space
  opens/closes Audio options. Mode switching, repeated actions and selection
  replacement retain the intended input/context.
- Artist return and browser Back/Forward keep source metadata; leaving the
  workbench discards the text draft. A held lyrics response released after
  navigation cannot restore a reading or start its persistence request.
- Empty selection, live unconfigured search, held-request loading, retryable
  text errors and reload are explicit. Recognition-to-text handoff uses a
  controlled metadata response with no invented match scores; the real
  fingerprint worker processes an original generated WAV.
- A text reading is computed with the existing pure keyword/blend code on
  original demo text, then fulfilled locally to verify rendering. Its existing
  persistence request is intercepted with 503; no database record is created.
  This proves renderer behavior, not live transformer/provider quality.
- A local file runs through the real browser audio pipeline, clears unrelated
  song metadata and adds no audio-derived writes. No audio measurements are
  fabricated, and no private recording is used.

The [runtime manifest](TRACK_HANDOFF_RUNTIME.json) records source-map byte
equality, build ID, report hash and hashes of all screenshots. Before/after
selected-card screenshots use the same widths and theme. The before handoff
capture shows the full page from the top; the after handoff capture shows the
actual focused viewport. Screenshots are raw browser captures, not edited.
Local checks passed: 233 unit tests, 11 existing RLS skips, all 66 browser tests
against the final production build, lint (six existing warnings), TypeScript and
production build. The 11 action/navigation regressions also passed against the
development server used by CI. Browser retries are disabled.

Useful views: [before selected phone](screenshots/track-handoff/before-selected-390-light.png),
[after selected phone](screenshots/track-handoff/selected-390-light.png),
[before handoff](screenshots/track-handoff/before-handoff-390-light.png),
[focused handoff](screenshots/track-handoff/lyrics-handoff-390-light.png),
[optional audio](screenshots/track-handoff/audio-options-390-dark.png).

Reproduce the production evidence after building and serving on port 3157:

```bash
npm install --prefix /tmp/song-handoff-qa-tools --cache /tmp/song-handoff-npm-cache \
  --no-save --package-lock=false @axe-core/playwright@4.10.2
HANDOFF_AXE_PATH=/tmp/song-handoff-qa-tools/node_modules/@axe-core/playwright \
  npx tsx scripts/qa/track-handoff.ts
```

The browser executable, URL and output directory can be overridden through
`CHROMIUM_PATH`, `HANDOFF_QA_URL` and `HANDOFF_QA_OUTPUT`. Axe remains an external
QA-only install; no application dependency or paid service was added.

## Limits

Live Spotify/search/recognition and Supabase/RLS are unverified in this cloud
environment. Hosted browser verification remains unavailable; known Vercel
authorization failures are not bypassed. The existing missing-config OG/Twitter
limitation remains separate. No playback permission, Genius lyrics right,
recognition accuracy or model quality is implied. No predictive model, training,
credential, security/visibility setting, bot data or provider integration changed.
Existing confidence values and generated reading prose are not temporal
accuracy evidence; no modeling claim is made from these UI checks.
