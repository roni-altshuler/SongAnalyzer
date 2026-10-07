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
clip-wide mood changes redraw canvas colors; timeline labels use inherited
theme variables and full opacity. Window buttons retain keyboard
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

Hiding the page or receiving `pagehide` pauses the owned player. Returning
never resumes it automatically; a Play promise settling after hide/return is
also paused. These listeners are removed on replacement/unmount. Native
media `timeupdate` enforces and clamps the selected end even when the
WaveSurfer animation-frame timer is suspended. The fallback has browser
event latency and is a listening aid, not a sample-accurate audio edit.

## Validation

The original generated six-second chord/pulse WAV has a second-half gain of
0.2. Real Chromium playback and decoded signal detail show −20.6 dBFS then
−34.6 dBFS RMS, matching the expected approximately −14 dB amplitude change.
This is a controlled signal verification, not an evaluation of music models.
Another original WAV contains exact zero PCM to verify silence.

- `npm test`: 199 passed, 11 existing gated tests skipped.
- `npm run lint`: success, zero errors and six existing warnings; changed code
  is warning-free. `npm run typecheck` and Next 16.3.6 production build pass.
- All 43 Playwright regressions pass against that production build with zero
  retries. Eleven new browser tests cover real worker/PCM detail, an internal
  playback boundary before file end, keyboard seeking, repeated/same-file
  replacement, navigation, silence, decode retry/cancellation, the actual DSP
  fallback and rejected native playback recovery.
  The review regressions additionally exercise suspended animation frames,
  repeated visibility/pagehide pauses, no restart on return, listener cleanup,
  a late Play promise and live timeline-label theme colors.
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

## Playback review reproduction and fix

At initial head `d86a518996f38b4b269aeb3a04f87d25d40df9cc`, controlled
animation-frame suspension after Play left native audio still playing at
4.138356 seconds beyond the first window's three-second end. The initial
timeline color also stayed RGB(74,74,85) after a light-to-dark toggle, where
the expected theme color was RGB(180,180,189).

The [before/after browser evidence](LISTENING_WINDOWS_BOUNDARY_QA.json) records
the same suspension after the fix: native media is paused at exactly three
seconds at both 390px and 1440px. Three repeated hide/return cycles per width
retain paused time and selection. Both live theme changes resolve the expected
label colors with opacity one; inspected [phone](screenshots/listening-windows/boundary-return-dark-390.png)
and [desktop](screenshots/listening-windows/boundary-return-light-1440.png)
captures show the readable ruler and return-to-Play instruction. Scoped axe,
overflow, page-error and POST checks pass for both cases.

Headless Chromium tab switching kept `document.visibilityState` visible, so
that attempt is not represented as a real hidden/minimized-window test.
Frame suspension and visibility/pagehide transitions are controlled browser
API simulations; playback and native media time updates are real. No OS
minimized-window verification or sample-accurate playback guarantee is claimed.

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
