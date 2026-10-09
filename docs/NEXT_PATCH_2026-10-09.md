# Next.js patch verification — 2026-10-09

Next.js and eslint-config-next are pinned to **16.3.8**, from 16.3.6 on
main `c64b5b3863f27618fb1163522df47416588aa104`. No open PR duplicated this work.
The lockfile changes only the root manifest and 12 Next.js package entries:
Next.js, eslint-config-next, @next/env, @next/eslint-plugin-next and eight
platform SWC binaries. React/React DOM remain 19.2.1, source-map-js remains
1.2.2, and other lock entries are unchanged. There are no application-code,
framework-major, model, API-provider, middleware, credential, access-rule or
database changes.

## Advisory and compatibility evidence

The [official 16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8)
contains the relevant security fixes. This is the patched release in the
existing 16.3 line; npm audit also suggests 16.4.0, but that broader update is
unnecessary for these findings. Registry metadata reports Node `>=20.9.0` and
React `^19.0.0` compatibility, covering CI's Node 20.19.0 and locked React
19.2.1. Local checks use Node 24.19.0/npm 11.9.0; exact-head CI verifies the
repository's pinned Node 20.19.0 independently.

The [reviewed Image Optimization SSRF advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)
affects Next.js `>=16.0.0 <16.3.8`. It states apps without
`images.remotePatterns` are unaffected. This repository's next.config.js is
empty and has no remote patterns. No exposed SSRF path or incident was
established; this change patches the dependency rather than claiming an
application exploit.

The before audit identifies six advisory entries directly in Next.js, all
absent after the patch:

| Advisory | Audit severity | Subject |
|---|---|---|
| [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | High | Image Optimization SSRF |
| [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) | Moderate | Pending use-cache fill and Draft Mode content |
| [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) | Moderate | Self-hosted SSG/ISR cache poisoning |
| [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) | Moderate | Metadata image route dynamicParams bypass |
| [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | Moderate | SSG/ISR content substitution and persistent DoS |
| [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) | Low | Development MCP information disclosure |

The release also fixes GHSA-h694-7cp9-m8p3; it was not a finding in this
repository's before audit. No exploitability or validated model-accuracy claim
is inferred from an audit total or browser test.

## Detailed audit delta

[The complete before/after audit and lock-entry evidence](NEXT_PATCH_AUDIT_2026-10-09.json)
retain advisory identities, affected ranges, dependency paths and npm's
suggested fixes. Both `npm audit --json` commands exit 1 because findings
remain; `npm ci` succeeds from the updated lockfile.

| Reported package findings | Before | After |
|---|---:|---:|
| Critical | 0 | 0 |
| High | 19 | 18 |
| Moderate | 7 | 7 |
| Low | 2 | 2 |
| Total | 28 | 27 |

These are npm's package counts, including propagated transitive findings,
rather than counts of unique advisories or exposed application paths. Only
the `next` package finding disappears; no new package finding appears. The
updated eslint-config-next/@next/eslint-plugin-next still inherit a high
finding through fast-glob → micromatch → braces.

All remaining package identities are recorded explicitly:

| Severity | Packages |
|---|---|
| High (18) | @next/eslint-plugin-next; eslint-config-next; typescript-eslint; @typescript-eslint/eslint-plugin, parser, type-utils, typescript-estree and utils; brace-expansion; braces; browserslist; fast-glob; flatted; js-yaml; micromatch; minimatch; nanoid; picomatch |
| Moderate (7) | @humanfs/node; @jimp/core; @jimp/custom; @vibrant/image-node; ajv; file-type; node-vibrant |
| Low (2) | @babel/core; esbuild |

Their reachability and compatible updates require a separate bounded review.
In particular, npm's suggested eslint-config-next 14.2.35 and node-vibrant
3.1.6 are major downgrades. No blanket audit fix, forced downgrade, override
or unrelated dependency refresh was applied.

## Verification

- Clean `npm ci`: passed, installing 725 packages.
- `npm run lint`: passed with 0 errors and 6 existing warnings.
- `npm run typecheck`: passed.
- `npm test`: 207 passed; 11 local Supabase/RLS tests skipped.
- `npm run build`: passed on Next.js 16.3.8/Turbopack. Existing middleware
  and Edge-runtime deprecation notices remain.
- The repository's complete Playwright suite: **51 passed**, zero retries,
  against a fresh Next.js 16.3.8 development server in the saved cloud
  environment (system Chromium, one worker). The temporary config supplies
  the browser executable and isolated port only; repository tests/config
  are unchanged. Privacy, consent, fail-closed endpoints, genuine fallback,
  storage denial, hydration, reduced motion and playback tests all pass.

[The fresh production browser report](NEXT_PATCH_QA_2026-10-09.json) records
four complete journeys (390px and 1440px, light and dark), 108 checked states,
zero axe WCAG 2 A/AA and 2.1 A/AA violations, zero horizontal overflow, zero
page/hydration errors and the expected saved theme throughout. The real
Chromium version is 151.0.7922.173; axe-core/playwright is 4.10.2, installed
only in a temporary QA tools directory.

Each journey follows the actual navigation and native file chooser through
Identify, Discover, a source-qualified artist profile, Atlas, a genre page,
missing-share 404, lyrics, local audio and Combined view, including browser
history/reload. It checks real catalog/search/Atlas unavailability separately
from controlled no-match, loading, empty and API-error states. Artist/search
metadata are explicitly fictional UI fixtures with local placeholder art.

The keyword reading uses original test text. The audio reading uses an
original six-second synthetic WAV, the real MIR worker, Web Audio decoding
and real WaveSurfer playback. Keyboard seeking, selection, an internal
three-second playback boundary and theme toggles preserve the passage. The
waveform loading state defers its real decode promise; no audio feature is
mocked. Navigation/reload discards the local file and audio reading. Declining
the named AudD disclosure sends no clip.

Browser request records show no external requests, preview/provider calls,
fingerprint writes or audio-save requests. Catalog lookup sends JSON hashes;
only the original text reading attempts the existing lyrics persistence
endpoint. Audio analysis/playback creates no POST request. These observations
apply to the exercised journeys; they do not establish live provider or RLS
behavior. Automated accessibility checks complement the keyboard/visual
inspection and do not prove complete accessibility.

Screenshots were captured directly by Chromium and visually inspected:

| State | Screenshot |
|---|---|
| Real keyword reading, mobile light | [Lyrics](screenshots/next-patch/lyrics-light-390.png) |
| Real local waveform, worker reading and comparison, desktop dark | [Audio](screenshots/next-patch/audio-dark-1440.png) |
| Controlled lyrics API error, mobile dark | [Error](screenshots/next-patch/lyrics-error-dark-390.png) |
| Deferred real waveform decode, mobile light | [Loading](screenshots/next-patch/waveform-loading-light-390.png) |
| Named AudD disclosure from a controlled catalog miss, mobile light | [Consent](screenshots/next-patch/consent-light-390.png) |

## Limits

Live Supabase/RLS, authenticated/provider-backed recognition, Spotify search
and transformer inference remain unverified without the existing service
configuration. Their absence does not authorize changing access or creating
credentials. The known missing-config OG/Twitter image 500 remains outside
this dependency patch. Hosted preview browser access remains unavailable;
the fresh browser run uses the saved cloud environment's real Chromium and
local production build. No private recording, paid service, training,
production dispatch, merge or external announcement is involved.
