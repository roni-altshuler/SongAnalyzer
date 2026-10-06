# Track exploration and recording permission — October 6, 2026

Selecting or recognizing a recording now retains useful track details and
listening links without automatically downloading provider audio. The shared
card appears in Identify, Analyze and Discover, explains why audio insights are
unavailable, and offers a separate local-file or pasted-text reading. Clearing
returns focus to search; local files clear unrelated track attribution.

Verified Spotify/Genius adapters identify the source of the metadata they
actually supplied. Spotify content displays the official full mark and a direct
track link. Legacy database rows lack metadata provenance: they are labelled
catalog metadata with an unverified original source, while known item IDs can
still provide listening links. A provider ID never grants analysis permission.
Search uses a grid popup with separate selection/provider-link cells, keyboard
selection, adequate contrast, and no redundant query after selecting a result.

## Enforced recording boundary

The earlier flow was `analyzeSong` → fetch `previewUrl` → deterministic MIR DSP
and fingerprint computation → analysis/features/fingerprint writes. That is
an evidenced audio-analysis path, not evidence that the app sent provider audio
to an AI model. Spotify's [Developer Policy III.13](https://developer.spotify.com/policy)
prohibits analysis of Spotify Content. Other providers and arbitrary URLs do
not become permitted merely because they lack a Spotify ID.

This release therefore fails closed for **all remote recordings**:

- `useSongAnalysis.analyzeSong` selects metadata only, strips preview URLs, and
  performs no fetch, decode, DSP, fingerprinting, AI call, persistence or success
  toast. Repeated/direct calls and ID-stripped similar selections remain denied.
  There is no retry action that can bypass this policy.
- Spotify adapters, cached song-detail responses, legacy row projections and
  similar results do not expose preview URLs. The similar endpoint preserves
  known item IDs for outbound links without inventing source provenance.
- `/api/analyses` rejects audio/combined results and audio feature payloads
  relabelled as lyrics before external calls or database access.
  `/api/fingerprints` and `/api/songs/[id]/features` return HTTP 403
  `audio_persistence_disabled`. A client's `source: upload` or permission flag
  cannot authorize them. The server analysis and fingerprint ingestion helpers
  also reject audio writes on direct invocation.
- `seed:fingerprints` exits with status 1 before env loading, DB access, audio
  fetch or decoding. It contains no remaining provider-preview indexer.
- A user-chosen local File remains usable with the real browser MIR worker and
  existing DSP fallback. Its audio insights are session-only: no automatic
  fingerprint computation, catalog ingestion, server save or share ID.
  The local-file UI asks for audio the user owns or has permission to analyze.

Existing database records, preview fields, vectors and fingerprints are not
removed or rewritten. No migration, RLS, credentials, access setting or
production job was changed. Lyrics persistence retains its existing behavior.
A future audio persistence/indexing path needs reviewed recordings and
server-verifiable provenance and permission; browser flags are insufficient.

## Recognition lifetime and privacy

Identify acquires a synchronous operation lock before awaiting microphone
permission. It exposes the requesting state and cancellation. Generation and
mounted-state checks follow every async boundary, including decoding, worker
completion, fetch and response parsing. Navigation/cancellation invalidates the
operation, aborts requests, detaches/stops the recorder, clears its deadline,
stops media tracks and closes the capture context. Late catalog/AudD matches
cannot invoke the selected-track callback or announce success. A retained
analysis-hook callback cannot restart work after unmount.

Catalog unavailability, lookup errors and missing metadata remain distinct from
a completed no-match. Match scores are catalog signals, not calibrated accuracy.
Local audio estimates describe the chosen passage, not an entire recording.

AudD is optional and still requires existing configuration/entitlement. A miss
only offers a disclosure step: it names AudD, says the clip leaves the device,
explains recognition purpose and links the provider's privacy policy. Only
“Send clip to AudD” uploads; “Keep audio on device” clears the snippet and returns
focus to Start. The server requires the `audd-recognition` consent marker and
propagates cancellation to the existing provider adapter. Fallback metadata
resolution performs no catalog writes. The footer distinguishes local insights,
catalog hash queries and explicitly confirmed AudD audio transmission.

## Verification

Repository `roni-altshuler/SongAnalyzer`, base
`370f7a9468af36dac86802edb4e12edeab443f8c`, Next 16.3.6. No open PR existed at
initial inspection; the existing draft PR9 was reused for this revision.
Main and pre-existing work are preserved. CLAUDE.md, browser skill guides,
actual flows and existing tests were inspected; no applicable AGENTS.md was
present. Local commands used Node 24.19.0; CI uses Node 20.19.0.

- Vitest: **176 passed**, **11 existing Supabase-gated tests skipped**. Regression
  coverage includes direct remote calls, dropped IDs in a real similar-selection
  component flow, spoofed permission/source flags, server route/helper denials,
  no legacy preview overwrite, local worker identity/unmount, delayed recognition
  callbacks, capture cleanup/double start, AudD consent and cancelled relays.
- Lint, TypeScript and the default Turbopack production build pass. Lint has
  six pre-existing warnings outside the changed files; changed-file lint is clean.
- **21 Playwright tests passed** against the final production build and cover the real zero-config API, controlled matched/
  no-match metadata, prohibited-request absence, real synthetic local audio,
  provider disclosure/decline/confirmation, navigation during lookup, keyboard
  grid selection, Clear focus, browser history and direct HTTP denials.
- Actual cloud Chromium QA checks dark/light themes, 390/768/1440px, long names,
  reduced motion, responsive geometry and provider-mark loading. Scoped axe
  checks include the exploration card, search popup, AudD disclosure, microphone
  request state and local upload loading/error/ready: **21 scoped axe checks,
  zero violations**, no measured horizontal overflow, all provider marks loaded.
  New actions are at least 44px high; focus and keyboard flows passed. This is not a whole-app
  accessibility certification. See the verification report and screenshots below.

All audio fixtures are original four-second synthesized chords/pulses. Controlled
matched responses exercise presentation and lifecycle, not real recognition
quality. AudD responses are mocked before any external relay; no provider audio,
private audio, real microphone recording, paid API request or production job
was used. The real local audio engine is exercised without fabricated features.

[Mobile dark](screenshots/track-exploration/identify-dark-390.png) ·
[Mobile light](screenshots/track-exploration/identify-light-390.png) ·
[Tablet](screenshots/track-exploration/identify-dark-768.png) ·
[Desktop](screenshots/track-exploration/identify-dark-1440.png) ·
[AudD disclosure](screenshots/track-exploration/audd-consent-dark-390.png) ·
[Local insights](screenshots/track-exploration/local-ready-dark-390.png) ·
[Local error](screenshots/track-exploration/local-error-dark-390.png) ·
[Local loading](screenshots/track-exploration/local-loading-dark-390.png) ·
[Verification report](TRACK_EXPLORATION_QA.json)

## Remaining prerequisites and follow-ups

| Capability | Verified boundary / limitation |
|---|---|
| Catalog identification / RLS | Live Supabase was unavailable; 11 gated tests remain skipped. Existing catalog rights/content also need independent review. No access policy was altered. |
| Remote audio / fresh recommendations | Disabled pending reviewed recordings and enforceable permission. Legacy similarity reads remain intact; no newly measured recommendations are claimed. |
| AudD recognition | Existing optional integration with explicit consent; [AudD documentation](https://docs.audd.io/) and its pricing describe trial/paid access, not unlimited free production recognition. No credentials or real requests were added. |
| Lyrics | User-pasted text; optional existing inference configuration. Genius remains metadata only, with no full-lyrics scraping or fabricated artist annotations. |
| Share previews | The known missing-config OG/Twitter image 500 is outside this bounded change; invalid document slugs return a clean 404. |
| Measurement quality | Synthetic regression fixtures verify behavior, not real-world tempo/key/mood or recognition accuracy. No unsupported adaptive-model accuracy claim is made. |

Provider display follows Spotify's [design/attribution guidance](https://developer.spotify.com/documentation/design).
Logo provenance and the pinned download mirror are recorded in
[public/brands/README.md](../public/brands/README.md).
