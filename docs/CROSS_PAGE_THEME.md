# Consistent music workbench themes — 2026-10-08

Starting from main `e08d15328bf8f04984710d8d6eec7d3e65b9d153`, the audit followed
home → identification → discovery/search → selected track → artist profiles →
Atlas/genre → missing reading → lyrics/evidence → local audio/listening windows →
comparison → navigation away/back and reload. The repository had no open PRs.
The existing track/profile/listening-window work remains in place.

## Verified problems and changes

The original production journey ignored live system-theme changes. Denied
access to theme storage caused a client error. Light profiles and listening
windows used warm surfaces while the surrounding workbench used cooler white
surfaces. A saved light theme with a dark system preference rendered a black
Next.js default 404 body and different typography. Captions and warning badges
failed contrast checks, the legacy lyrics radar used a separate slate/blue
style, and confidence labels landed on a generic wrapper rather than the actual
progressbar.

Shared cream/off-white surfaces now cover the shell and pages. Dark mode keeps
the existing near-black surface hierarchy. Caption, state, mood-text, primary
action and focus colors remain readable against these surfaces. Mood accent
values, radar calculations and audio/lyrics models are unchanged. The radar
uses the existing theme tokens and has an accessible description.

A synchronous head script applies a valid saved choice or the system theme
before paint, even when theme storage is blocked. The provider follows system
changes until the user chooses a theme, synchronizes other-tab changes, and
supports a temporary choice when storage writes fail. It reapplies the theme
after hydration/recovery. The inline script is inert during soft navigation,
following the installed Next.js before-paint guidance. Decorative spectra use
rounded coordinates to avoid server/browser floating-point attribute differences;
they stay static through first hydration and honor live reduced-motion changes.

The themed 404 offers home/workbench links. Search loading, unavailable, empty
and error states have appropriate status/alert semantics. Search setup secrets
and database-reset instructions are no longer presented as product actions.
Atlas overview and canonical genre pages hide unknown totals on failed reads,
while successful empty reads retain zero totals and an empty state. The existing
query helpers opt into reporting errors for these two pages; the database
requests, visible-row filter, schema, RLS and other callers are unchanged.
Homepage descriptions now reflect local audio, available catalog lookup and
explicit AudD disclosure/confirmation.

## Verification

Final results and captures are recorded in [browser evidence](CROSS_PAGE_THEME_QA.json).
The saved cloud environment ran Chromium 151.0.7922.173 against a fresh local
production build, at 390px and 1440px in light and dark mode. Saved choices were
opposite the system preference. Light cases used reduced motion; dark cases used
normal motion. Finite UI entrance animations were allowed to finish before axe
snapshots; animation preferences and interactions were exercised separately.

The journeys used native navigation/menu actions, native file choosers, keyboard
window selection/seek, real browser playback, theme toggles, reload and
back/forward. Original generated WAV PCM went through the real MIR worker and
waveform decoder; no audio feature responses were mocked. Pasted original text
went through the real keyword endpoint with transformer status `skipped` because
no token was configured. Catalog metadata/profile credits were clearly fictional
UI fixtures. Search loading/empty/error, lyrics loading/error, AudD no-match
availability and held waveform decode were controlled boundary simulations.
AudD consent was declined; no provider relay was called. The initial unconfigured
search and recognition-catalog errors were real responses.

The full browser suite also exercises genuinely missing profile context, corrupt
profile context/recovery, pre-hydration loading, waveform/playback errors and DSP
fallback. Tests for successful empty Atlas reads and reported service failures use
mocked database responses; no live Supabase/RLS claim is made.

- Production browser suite: **51 passed**, zero retries.
- Cold dev browser suite: **51 passed**, zero retries.
- Vitest: **207 passed, 11 skipped** (the existing gated Supabase/RLS suite).
- ESLint: **0 errors, 6 existing warnings**; TypeScript and production build passed.
- Four full production journeys: **122 settled whole-page axe snapshots, zero
  WCAG 2/2.1 A/AA violations**. No client/hydration errors, horizontal overflow,
  prohibited provider/preview requests or audio-analysis POSTs occurred.
- The real first listening-window playback paused at the internal **3.0s**
  boundary. Selecting window 2 and theme changes preserved the selection;
  navigation away/back and reload cleared local audio as intended.

The [original main audit](CROSS_PAGE_THEME_BASELINE_QA.json) records the previous
contrast and system/storage failures. Normal-motion entrance frames can have
transiently low opacity; final accessibility snapshots wait for finite UI
animations, while held loading states remain held.

## Captures

| View | Capture |
| --- | --- |
| Mobile home, light | [390px](screenshots/cross-page-theme/home-light-390.png) |
| Desktop home, dark | [1440px](screenshots/cross-page-theme/home-dark-1440.png) |
| Lyrics/radar, light | [390px](screenshots/cross-page-theme/lyrics-light-390.png) |
| Lyrics/radar, dark | [1440px](screenshots/cross-page-theme/lyrics-dark-1440.png) |
| Artist profile, light | [390px](screenshots/cross-page-theme/artist-light-390.png) |
| Missing reading, saved light / dark OS | [Before](screenshots/cross-page-theme/before-404-light-390.png) · [After](screenshots/cross-page-theme/404-light-390.png) |
| Real words/audio comparison, light | [390px component](screenshots/cross-page-theme/comparison-light-390.png) |
| Local listening window, dark | [1440px component](screenshots/cross-page-theme/listening-window-dark-1440.png) |

The captures were visually inspected for shared surfaces, readable text,
responsive layout, persistent shell, estimate/provenance display and listening
selection. Component captures use a taller browser viewport at the same width
so the sticky navigation does not obscure their heading.

## Limits

Hosted Vercel preview/browser access remains blocked by the previously reported
access denial; it was not retried or bypassed. These are actual cloud-browser
checks of the local production build, not hosted-preview certification. Live
Supabase/RLS and configured provider catalog behavior remain unavailable. Existing
missing-config OG/Twitter-image 500 behavior is outside this change. No access,
credentials, migrations, audio persistence/indexing policy, model training,
accuracy claims, production workflow dispatch, deployment or merge was introduced.
