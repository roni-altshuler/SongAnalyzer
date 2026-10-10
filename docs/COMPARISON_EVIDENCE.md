# Comparison evidence

On main `c6c70099aa03acf285bd654b3f057966e6f230cc`, original pasted text plus an
independently generated six-second WAV produced “Agreement 53%” and “The words
are brighter than the sound.” The view gave neither input provenance nor a
song-correspondence limitation. Unknown mood labels also defaulted to `(0, 0)`;
two unsupported readings could therefore display 100%.

The [baseline record](COMPARISON_EVIDENCE_BASELINE.json) and
[before screenshot](screenshots/comparison-evidence/before-1440-dark.png) capture
the real keyword/MIR flow. Neither input is a copyrighted song or private clip.

## Result and boundary

- Input cards show analyzed word count, session-only filename, analyzed duration
  and the projection basis: weighted emotion scores, preset mood label, signal
  estimate, or unavailable coordinates.
- **Estimated proximity** preserves the existing geometric calculation for valid
  readings. Copy describes estimates and explicitly separates distance from
  model accuracy, song identity and intended meaning.
- Unsupported labels, invalid/nonfinite coordinates and missing MIR coordinates
  withhold the map and percentage. Both original readings remain inspectable.
  Failed/skipped text engines cannot supply stale scores as successful evidence.
- A native keyboard-operable disclosure explains each projection and shows an
  accessible coordinate table. The audio point describes the analyzed recording;
  selecting a listening window does not recompute it.
- Circle/diamond markers, contrasting outlines and separate labels make color
  supplementary. Existing theme tokens and responsive cards supply the layout.

This is a presentation/projection validation change. Analysis engines, measured
audio features, distance math, provider calls, permissions, persistence, RLS and
the theme system are unchanged. No model was trained or evaluated. No audio,
filename or audio-derived result is newly sent to a server or external service.

## Verification, 2026-10-10

| Check | Observed result |
|---|---|
| Vitest | 225 passed; 11 existing RLS tests skipped |
| ESLint | No errors; six existing warnings |
| TypeScript | Passed |
| Production build | Passed on Next.js 16.3.8; existing middleware/Edge deprecation notices |
| Full Playwright suite | 55 passed, zero retries |
| Production Chromium | Seven journeys; 56 full-page WCAG 2 A/AA and 2.1 A/AA scans with no detected violations or horizontal overflow |

The 18 focused unit cases cover supported mappings, weighted text scores,
stale/malformed metadata, valid zero, invalid/missing signal coordinates,
replacement results, translated word-count provenance and the former false 100%. Four new browser tests exercise
real keyword/MIR readings at 390px and 1440px, native keyboard disclosure and
theme changes, local-file replacement, empty/loading/error states and a real DSP
fallback after controlled worker-startup failure.

The [production report](COMPARISON_EVIDENCE_QA.json) records browser version,
viewport, compact accessibility results, SVG text/outline contrast and actual
observed worker coordinates. The minimum measured SVG text contrast is 5.617:1
and marker-outline contrast is 16.376:1 against the map surface. Local checks
used Node 24.19.0; the existing CI workflow pins Node 20.19.0.
Each normal journey covers empty/text-only,
held lyrics loading, controlled lyrics failure and real retry, held waveform
loading with an available comparison, collapsed/expanded evidence, keyboard
window selection and real playback boundary stop, theme changes, replacement,
invalid WAV decoding and navigation/back. The four width/theme combinations are
390px/1440px × light/dark, with saved theme opposite OS preference. Light uses
reduced motion; dark uses normal motion. Finite entrance animations settle
before contrast scanning.

The original text and WAV run through the existing engines. The table's audio
coordinates are checked against unmodified worker replies, and the valid
six-second example still displays 53%. One additional journey deliberately
changes only the text mood label to an unsupported value; persistence of that
controlled metadata is blocked. Another fails feature-worker startup and lets
the unchanged DSP engine read PCM. Its real “Balanced” output has no supported
position, so the audio comparison is honestly unavailable. No extracted audio
feature is mocked. Every journey checks for page errors, external requests and
audio/server writes. Only the existing original-text analysis and lyrics-save
attempts occur.

Independent review caught that `wordCount` comes from `analyzeKeyword(text)`
after `maybeTranslate`; `blendResults` retains that analyzed count. The caption
now says **analyzed words**, with **Translated text reading** when appropriate.
A focused regression and an additional production-browser presentation fixture
check a translated result with nine analyzed words against the 17-word original
input. That fixture changes only translation/count metadata and blocks its
persistence; it does not call or validate a translation provider. The real MIR
worker continues to analyze the original local WAV.

Screenshots below are actual browser component captures, manually inspected.
They use the tested responsive width with a tall capture viewport to prevent
sticky navigation from covering the expanded card; journeys use 900px height.

| State | Light | Dark |
|---|---|---|
| Mobile, 390px | [Expanded evidence](screenshots/comparison-evidence/real-engines-390-light.png) | [Expanded evidence](screenshots/comparison-evidence/real-engines-390-dark.png) |
| Desktop, 1440px | [Expanded evidence](screenshots/comparison-evidence/real-engines-1440-light.png) | [Expanded evidence](screenshots/comparison-evidence/real-engines-1440-dark.png) |
| Unavailable coordinates | [Controlled unmapped text](screenshots/comparison-evidence/controlled-unmapped-text-390-light.png) | [Real DSP fallback](screenshots/comparison-evidence/real-dsp-fallback-390-dark.png) |
| Translated count provenance | [Controlled translated result](screenshots/comparison-evidence/controlled-translated-text-390-light.png) | — |

## Reproduce

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and
`npm run test:e2e`. Standard Playwright installs its Chromium via
`npx playwright install chromium`. The saved cloud run used system Chromium
with a temporary config selecting `/usr/bin/chromium`, one worker and no retries;
application browser tests and dependency manifests were unchanged by that setup.

Start the production build separately with `npm run start -- --port 3141`, then:

```sh
npm install --prefix /tmp/song-comparison-qa-tools --no-save --package-lock=false @axe-core/playwright@4.10.2
COMPARISON_AXE_PATH=/tmp/song-comparison-qa-tools/node_modules/@axe-core/playwright \
CHROMIUM_PATH=/usr/bin/chromium \
COMPARISON_QA_BASE_URL=http://localhost:3141 \
npx tsx scripts/qa/comparison-evidence.ts
```

The committed script writes a compact report and seven screenshots to
`/tmp/song-comparison-qa`; `COMPARISON_QA_OUTPUT` can select another directory.
Axe is an external QA-only installation; no app dependency was added.

## Limits

These checks establish interaction, metadata handling and presentation behavior,
not music-model accuracy or assistive-technology completeness. Automated axe
scans complement manual keyboard, visual and SVG contrast checks. There is no
benchmark dataset or confidence calibration. The weighted-model path is covered
by controlled unit metadata; live Hugging Face inference, Supabase/RLS, AudD and
provider catalog behavior were not exercised or reconfigured. Browser QA uses
the production build in the saved cloud environment, not a hosted Vercel visit.
The known missing-config share OG/Twitter 500 remains a separate follow-up.
