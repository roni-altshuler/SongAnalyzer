# Local listening windows — 2026-10-07

## Why this change

The reviewed main already had a dynamically imported WaveSurfer 7.12.7 player
for local files, a real MIR worker, a DSP fallback and whole-clip results.
The player exposed Play but no keyboard seeking or passage-level detail, and
a failed waveform load could leave an indefinite skeleton. Remote previews
and audio-derived writes are intentionally blocked by the reviewed PR9 policy.

This change extends that shared player with the installed BSD-3-Clause Regions
and Timeline plugins. [WaveSurfer](https://wavesurfer.xyz/) supplies waveform
visualization and playback, not music-analysis features. Native media playback
provides a rejectable start promise and library-owned blob URL/media cleanup.
No additional runtime dependency, provider request, model or training is added.

## Interaction and evidence

Select a window to pause playback, move to its start, highlight its range and
update detail. Play resumes inside that range or restarts at its start, stopping
at its end. The native range slider offers keyboard seeking; pointer waveform
seeking chooses the corresponding window. Restart, repeated selection, theme
changes and file replacement keep playback/detail synchronized. Theme and
clip-wide mood changes redraw canvas colors. Window buttons retain keyboard
focus and announce selection, without making the pointer canvas a keyboard
trap. Light mode uses the existing cream music-workbench surfaces.

Windows divide actual decoded duration continuously: a target of five seconds,
at least two windows for clips longer than one second, and at most twelve
controls. They are timed listening aids, not detected musical sections.

- RMS and peak use unnormalized locally decoded waveform PCM at 22.05 kHz,
  including every channel in that window. These are dBFS amplitude measurements,
  not LUFS or perceived loudness. Exact silence shows `Silent (−∞)`.
- Measurements scan at most one million PCM values per selected window. An
  over-budget window is unavailable with an explanation; missing/invalid samples
  are unavailable. There is no rescaling, feature interpolation or subsampling
  presented as an exact measurement.
- Estimated grid ticks count supplied unique worker grid instants, without
  boundary double-counting. They are not detected drum hits. A real empty grid
  yields zero; the real DSP fallback has no grid and shows Unavailable.
- Mood, key and tempo remain whole-clip worker/fallback estimates. No per-window
  model, confidence calibration or music accuracy claim is made.

Loading is a busy region with a status and hidden controls. A waveform decode
failure keeps the existing analysis visible and offers Retry waveform. A
rejected playback start offers a recoverable alert and restores Play. File
inputs reset after capture so selecting the same file starts a fresh reading.
Unmount/replacement pauses and destroys the owned player; late async loads or
play promises cannot update another file's controls.

## Validation

The original generated six-second chord/pulse WAV has a second-half gain of
0.2. Real Chromium playback and decoded signal detail show −20.6 dBFS then
−34.6 dBFS RMS, matching the expected approximately −14 dB amplitude change.
This is a controlled signal verification, not an evaluation of music models.
Another original WAV contains exact zero PCM to verify silence.

- `npm test`: 199 passed, 11 existing gated tests skipped.
- `npm run lint`: success, zero errors and six existing warnings; changed code
  is warning-free. `npm run typecheck` and Next 16.3.6 production build pass.
- All 39 Playwright regressions pass against that production build with zero
  retries. Seven new browser tests cover real worker/PCM detail, an internal
  playback boundary before file end, keyboard seeking, repeated/same-file
  replacement, navigation, silence, decode retry/cancellation, the actual DSP
  fallback and rejected native playback recovery.
- The five helper tests cover multi-channel RMS/peak arithmetic, continuous
  window coverage, time boundaries/formatting, invalid/silent/over-budget data
  and beat-grid availability/boundary counts.

Actual cloud browser interactions, responsive screenshots and scoped axe
results are retained in [LISTENING_WINDOWS_QA.json](LISTENING_WINDOWS_QA.json).
All 23 recorded checks have zero scoped axe violations, horizontal overflow,
uncaught page errors, POSTs or external requests. Replacement/navigation
verification observed both player blob URLs revoked and all four decode
contexts closed. These resource observations cover that tested sequence,
not a general memory-leak proof.

Representative inspected screenshots: [desktop light](screenshots/listening-windows/ready-light-1440.png),
[desktop dark](screenshots/listening-windows/ready-dark-1440.png),
[phone](screenshots/listening-windows/ready-light-390.png),
[loading](screenshots/listening-windows/loading-light-390.png),
[decode retry](screenshots/listening-windows/waveform-error-light-390.png),
[playback recovery](screenshots/listening-windows/playback-error-light-390.png),
[real fallback](screenshots/listening-windows/fallback-light-390.png) and
[silence](screenshots/listening-windows/silence-light-390.png).

The browser runs a local production server in the saved cloud environment,
using system Chromium via Playwright. This includes widths 390, 768 and 1440,
both themes, normal/reduced motion, focus outlines, pointer/keyboard seeking,
repeated selections, theme toggling, session discard and controlled negative
states. Screenshots are visually inspected; automated accessibility checks
cover the changed player/upload regions, not a whole-app WCAG certification.

## Boundaries and remaining prerequisites

All audio remains a local File in the session. Remote preview fetch/DSP denial,
audio write/indexing guards, AudD consent, Spotify attribution, worker/model
code, database schema and RLS remain unchanged. The browser observes no POST
or external service requests from this local flow. No audio or derived window
measurements are stored or shared.

Live Supabase/RLS and provider-backed results remain unverified because the
required live environment is unavailable. Previously denied Vercel/public-host
access was not retried or bypassed. The known missing-config OG/Twitter image
500 remains a separate follow-up. Other npm advisories remain after the narrow
[source-map-js patch](SOURCE_MAP_PATCH_2026-10-07.md). Draft PR review is required
before merging; no merge or production dispatch is performed.
