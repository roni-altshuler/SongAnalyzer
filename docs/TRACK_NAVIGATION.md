# Selected-track navigation

The workbench previously discarded a selected track when its page unmounted.
On main `963c290c9a62b2cf84c5340690439d5cda8e2832`, the production-browser
journey **select track → artist profile → Back to exploring** returned to
Discover's empty start screen. The [baseline report](TRACK_NAVIGATION_BASELINE.json)
and [phone screenshot](screenshots/track-navigation/before-return-390-light.png)
record that behavior using original controlled metadata. Live search returned
503; this baseline does not establish provider success.

The application layout now retains only the selected track's named source
metadata in React memory during internal navigation. Artist profiles provide
an **Explore track** action on each known credit, reopening the explicit source
track in its original workbench. The action uses client navigation so opening
a link in another tab does not change the current tab's selection. Discover's
search placeholder becomes “Find another track…” while a track is selected.
Existing typography, surface colors, source attribution and artist identity
rules remain in use.

| Action | Result |
| --- | --- |
| Artist link, Back to exploring, workbench links, browser Back/Forward | Selected metadata remains available during this visit. |
| Explore a known artist credit | Explicitly replaces the current selection with that credit's source metadata. |
| Clear selected track | Clears selection across pages; browser Back does not resurrect it. |
| Choose a local file | Clears unrelated song attribution; the real local reading belongs to that page. |
| Leave the audio or lyrics page | Active files, playback, lyrics drafts and current results are discarded with their page; existing history previews remain separate. |
| Reload or start a new tab | Selected metadata starts empty; the separate existing artist metadata cache can supply an explicit Explore action. |

The provider enumerates permitted metadata fields and sanitizes artist credits.
Preview URLs, recordings, lyrics, measurements, results, extra payload fields
and credentials are excluded. It adds no browser storage, fetch, API route,
provider integration or database write. Existing request lifetime guards stop
retained callbacks from an unmounted workbench changing a later selection.
Identity continues to use source IDs, without splitting names or guessing
artist type. A reopened metadata credit does not imply identification or a
saved analysis.

## Verification

The [production-browser report](TRACK_NAVIGATION_QA.json) was captured with
system Chromium in the saved cloud environment against `next start`, not
against a development-only component renderer. The screenshots show original
controlled metadata and existing licensed brand assets; they are not real
Spotify search, artist, match-score or model-accuracy evidence.
All 47 accessibility scans passed, with zero measured horizontal overflow.
The [runtime evidence](TRACK_NAVIGATION_RUNTIME.json) records the production
build ID, source-map equality for the five changed runtime files, report hash
and hashes of all ten screenshots.

- Six journeys: 390, 768 and 1440 pixels, each in light and dark. Saved theme is
  opposite the OS preference; light uses reduced motion and dark normal motion.
- Artist and Explore actions work with native keyboard activation; artist
  headings receive focus. Explore targets are at least 44 pixels high.
- Repeated replacement/reopening keeps the exact track source ID. Clear stays
  cleared through browser history. Reload does not restore a selection.
- A held search response released after navigation cannot replace metadata.
- The original synthetic WAV runs through the real browser audio engine. Its
  selection clears metadata, and leaving removes its page-local audio/results.
  No feature result was fabricated or used as an accuracy assertion.
- Live unconfigured search, empty profiles, corrupt context with retry and
  storage-denied temporary context remain honest and actionable.
- Full-page Axe scans use WCAG 2 A/AA and 2.1 A/AA tags; the compact JSON records
  every scanned state, overflow measurement and observed network/page errors.

The unit regressions verify independent application roots/reload, metadata
whitelisting, cross-page clear, stale callbacks and local-file ownership.
The browser regressions exercise the actual routed journeys and storage cache.
Local verification passed: 230 unit tests (11 existing RLS tests skipped), all
61 Chromium browser tests against the production build, lint (six existing
warnings), TypeScript and the production build. No retries were enabled.

Reproduce production QA after `npm run build` and `npm run start -- --port 3147`:

```bash
# Install Axe outside the application; no app dependency change is needed.
npm install --prefix /tmp/song-navigation-qa-tools --cache /tmp/song-navigation-npm-cache \
  --no-save --package-lock=false @axe-core/playwright@4.10.2
NAVIGATION_AXE_PATH=/tmp/song-navigation-qa-tools/node_modules/@axe-core/playwright \
  npx tsx scripts/qa/track-navigation.ts
```

`CHROMIUM_PATH`, `NAVIGATION_QA_BASE_URL` and `NAVIGATION_QA_OUTPUT` can override
the system browser, production URL and output directory. The script fails on
unexpected accessibility violations, overflow, writes, external requests or
page errors in the six main journeys.

## Remaining data prerequisites

Live Spotify search is unconfigured in this environment. Supabase live/RLS
verification and hosted preview browser access remain unavailable; access
settings were not changed. The known missing-config OG/Twitter behavior is
outside this bounded navigation change. Recognition, remote-recording policy,
lyrics/audio models, estimates, history, server persistence and licensing
requirements are unchanged. No new service, credential, paid API, training,
accuracy claim or production dispatch was introduced.
