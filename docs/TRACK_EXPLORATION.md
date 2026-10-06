# Track exploration handoff — October 6, 2026

Recognizing or selecting a track should lead to useful exploration even when
there is no playable clip. Previously, Identify discarded no-preview matches
from its analysis context, Discover hid download errors, and a late preview
could attach another track's insights to a newer selection.

The shared pipeline now acquires request identity at selection, before fetch
and blob conversion. It cancels previous preview downloads and ignores late
worker/persistence results after a new selection, reset or unmount. An
unattributed local upload clears unrelated song metadata. Failed analysis
returns failure and does not emit a success toast.

The same exploration card appears in Identify, Analyze and Discover. It keeps
track identity visible, announces download/measurement/readiness, exposes
failures and retries, and gives missing-preview tracks local-audio/lyrics
paths. Outbound provider links appear only for IDs already in metadata. These
are separate lyrics readings and provider pages; the app does not fetch Genius
lyrics or present artist annotations as its own interpretation. Clearing the
card returns keyboard focus to search. Starting another identification clears
the prior audio context.

Catalog unavailability, lookup errors and missing metadata are separate from a
completed lookup with no matching recording. Catalog match scores are labelled
as signals, not recognition accuracy. Audio insight copy refers to the measured
clip, not an entire recording.

## Verification

- Repository: `roni-altshuler/SongAnalyzer`; base `370f7a9468af36dac86802edb4e12edeab443f8c`.
  No open PRs existed at inspection. The saved checkout was clean; its existing
  work and main were preserved. No AGENTS.md or local skills were present;
  CLAUDE.md and the browser skill guides were inspected.
- Clean `npm ci` with a writable temporary cache, Next 16.3.6; local Node 24.19.0.
- Nine new hook regressions cover reversed downloads, reset during blob
  conversion, missing preview selection, unattributed uploads, late
  persistence, retry, audio failure, late worker completion and unmount.
- Full Vitest: 151 passed, 11 existing Supabase-gated tests skipped.
- Lint: no errors; 12 existing warnings. Changed files: no warnings.
- TypeScript and default Turbopack production build passed after regenerating
  stale restored `.next` types.
- All 17 Playwright tests passed against the fresh production build on port
  3108: eight existing smoke tests and nine handoff/recovery cases (including
  three responsive widths). Browser back/forward and the workbench local-file
  action passed; local uploads did not inherit selected-track metadata.
- Responsive browser checks at 390, 768 and 1440px: long track names, no
  horizontal overflow, reduced-motion preference, missing preview next steps.
  Dark and light themes passed; the new light card uses scoped cream surfaces.
  All new card actions measured at least 44px high. Keyboard retry and Clear-to-search focus passed. No page runtime errors in
  the tested flows. New-card axe checks (WCAG 2 A/AA, 2.1 AA, 2.2 AA) found zero
  violations for loading, no-preview, error and ready states in tested themes; this is a scoped check,
  not a whole-app accessibility certification.

Screenshots were captured from the final local production build. They use original synthetic audio and explicitly controlled metadata
responses. Matched-response fixtures verify the UI handoff, not live catalog
recognition or recognition accuracy. The zero-config catalog-unavailable test
reaches the real API. No private audio, provider audio, paid inference or
production jobs were used.

[Mobile dark](screenshots/track-exploration/identify-dark-390.png) ·
[Mobile cream](screenshots/track-exploration/identify-light-390.png) ·
[Tablet](screenshots/track-exploration/identify-dark-768.png) ·
[Desktop dark](screenshots/track-exploration/identify-dark-1440.png) ·
[Desktop cream](screenshots/track-exploration/identify-light-1440.png) ·
[Loading](screenshots/track-exploration/discover-loading-390.png) ·
[Recovery](screenshots/track-exploration/discover-error-light-390.png) ·
[Clip insights](screenshots/track-exploration/discover-ready-light-390.png) ·
[Unavailable catalog](screenshots/track-exploration/catalog-unavailable-390.png)

## What remains required

| Surface | Existing implementation | Prerequisite / limit |
|---|---|---|
| Catalog recognition | Browser constellation hashes → `/api/identify` → `match_fingerprints` RPC | Configured Supabase, applied migrations and indexed, appropriately licensed recordings. Live matching and RLS were unavailable for this pass. |
| World recognition | Optional AudD fallback after explicit consent | Existing token/provider entitlement required. Trial access is not unlimited free production recognition. No token or fallback call was added. |
| Name search | Spotify client-credentials metadata search | Existing configured credentials/access required. No account or credential setup was performed. |
| Audio insights | Existing browser v2 MIR engine with v1 fallback | A valid, appropriately licensed clip. Synthetic fixtures do not establish real-world tempo, key or mood accuracy. |
| Related-track discovery | Existing saved sonic vectors and similarity RPC | Working persistence, feature writes and comparable catalog recordings. The rail can still be empty; no recommendations were fabricated. |
| Lyrics exploration | User-pasted lyrics, optional translation/emotion model, metadata-only Genius adapter | User-provided text; existing optional inference configuration. No automatic lyrics retrieval, licensed full-lyrics catalog or sourced annotations implementation. |
| Library | Local lyrics-result history | No personal track favorites, playlists or discovery journal currently exists. |
| Sharing | Existing public permalink/OG routes | Supabase public-result reads. Missing-config OG/Twitter 500 was reproduced on the production build and remains separate follow-up; this PR does not change access or sharing policy. |

## Provider review finding

Spotify's [track reference](https://developer.spotify.com/documentation/web-api/reference/get-track)
marks `preview_url` nullable/deprecated. Its [Developer Policy](https://developer.spotify.com/policy)
requires attribution/deep links and restricts preview uses, analysis of Spotify
Content, AI/ML ingestion and replacement of core Spotify experiences. The
existing path `handleSongPicked` / `handleSearchPick` →
`useSongAnalysis.analyzeSong` → fetch `previewUrl` → `runAnalysis` extracts audio
features and attempts vector/fingerprint persistence; `scripts/index-previews.ts`
also indexes provider previews. Those existing uses require rights/policy
review before treating the Spotify integration as a production foundation.
This pass preserves that pre-existing path and changes its request lifecycle
and visible states; it does not establish permission, add content sources or analysis methods,
introduce streaming or test Spotify clips. Prefer optional outbound
listening links when planning new integration features.

The [Genius API introduction](https://genius.engineering/introducing-the-genius-api/)
describes metadata and annotation resources; it does not establish a blanket
full-lyrics reuse license. [AudD documentation](https://docs.audd.io/) describes
its token-based recognition API. No new provider was enabled.

Explicit same-recording association before combining lyrics and audio remains
separate follow-up work.

Next useful work: resolve source permissions, validate the configured catalog
and RLS independently, evaluate the existing audio engine on licensed held-out
recordings, and show actual similarity reasons/empty states before proposing
user-controlled discovery or a favorites journal. Sourced facts, artist
annotations, measured clip features and machine interpretations should remain
visibly distinguishable.
