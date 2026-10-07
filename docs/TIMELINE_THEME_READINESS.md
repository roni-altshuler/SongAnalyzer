# Timeline theme readiness — 2026-10-07

Main CI [run 37624785309](https://github.com/roni-altshuler/SongAnalyzer/actions/runs/37624785309)
on `d114e106d2508a87d912fdb6b0be6a729fa24b35` passed 42 browser tests and
failed the final theme round-trip comparison. The test saved an empty initial
color, then correctly read `rgb(180, 180, 189)` after returning to dark mode.
Both live theme checks and passage/time assertions had already passed.

## Evidence and diagnosis

The exact failed `playwright-report` artifact is `11484026499`, SHA256
`3b0fdf866cc6951b567d3c1f32b404251d21dce10b57758be25d95aac3bf0ae0`.
Its source matches the main test. The `after@call@945` snapshot at the initial
color capture contains a timeline with no notch children; `before@call@949`
contains a replacement ruler with six notches. The trace's final screenshot
was visually inspected and shows the selected second passage and readable
dark-mode ruler. The trace does not record the evaluated handle's connectivity.

The installed WaveSurfer 7.12.7 Timeline plugin replaces its ruler on redraw.
On unmodified main, a controlled mutation of the existing mood token triggered
the real player observer → `setOptions` → redraw path. Retaining the original
node across that redraw reproduced `{ connected: false, color: "" }`; the
visible replacement had `{ connected: true, color: "rgb(180, 180, 189)" }`
and a positive width. Selection remained window 2 at `0:03.0`. No DOM removal
or computed-color stub was used. Four ordinary cold runs of the original test
passed; the intermittent failure was reproduced through its actual redraw
mechanism rather than claimed to occur on every start.

These observations support a test readiness/capture race. Production browser
checks also found correct colors and playback. The fix is confined to the test.

## Change

The color reader now uses `locator.evaluateAll` to resolve and read the current
ruler in one browser operation. It accepts a connected, positive-width ruler
with initialized secondary labels. The initial baseline must be a nonempty
RGB color matching the current `--text-med` token. The exact reading that
passes this assertion becomes the baseline, avoiding a second capture race.

Both theme directions still require the actual color to match the live token,
the first transition to change color, and the return to match the valid initial
color. Label opacity is checked initially and after each transition. Selection
and playback time must remain unchanged. Test retries stay at zero; assertion
timeouts and runtime code are unchanged.

## Verification

- Five separate fresh dev-server starts of the fixed theme test passed, zero retries.
- Full cold dev browser suite: **43 passed**, zero retries.
- Full production browser suite: **43 passed**, zero retries.
- Vitest: **199 passed, 11 skipped** (the existing gated Supabase/RLS suite).
- ESLint: **0 errors, 6 existing warnings**. TypeScript and production build passed.
- Actual production Chromium **151.0.7922.173**: eight fresh contexts covering
  390/1440px, both initial themes and normal/reduced motion. Native file chooser,
  keyboard selection/seek, both theme transitions, real redraw replacement and
  real native playback were exercised. Every internal first-window boundary
  paused at **3.000s** with animation frames held. No page errors, POST requests,
  external requests or horizontal overflow occurred. Scoped listening-player
  axe checks found **0 violations** in each context.

[Recorded browser evidence](TIMELINE_THEME_READINESS_QA.json) contains the
main reproduction and all eight production cases. Four full-page captures
were visually inspected for labels, selected passage, readable detail and
responsive layout:

| Width | Light | Dark |
| --- | --- | --- |
| 390px | [Capture](screenshots/timeline-theme-readiness/light-390.png) | [Capture](screenshots/timeline-theme-readiness/dark-390.png) |
| 1440px | [Capture](screenshots/timeline-theme-readiness/light-1440.png) | [Capture](screenshots/timeline-theme-readiness/dark-1440.png) |

Browser checks used the saved cloud environment's local production build and
original generated WAV, not hosted Vercel UI. Animation-frame suspension is a
controlled browser API simulation; native media playback/time updates are
real. There is no OS-minimization, live Supabase/RLS or music-model accuracy
claim. Existing share-image missing-configuration behavior and other prior
limits remain outside this follow-up.
