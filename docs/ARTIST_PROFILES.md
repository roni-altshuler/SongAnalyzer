# Artist identity profiles

## Behavior and scope

The selected-track card now lists each source artist credit separately, in
provider order. A known ID opens `/artists/<provider>/<id>`; a credit without an
ID stays visible and unlinked. Names containing commas, “feat.” or “&” remain
single names. Different IDs and provider namespaces remain separate even when
their names match. Existing Atlas name-slug pages remain available.

The profile shows known source identity and artist-page link, an explicit
Person/Group/Unknown type, and metadata for tracks explored in this tab. It
does not claim that a track has a saved analysis. Biography, related saved
readings and permitted artist imagery have explicit unavailable states.
The light profile uses warm cream surfaces and the existing music typography;
the dark profile retains the existing brand. Provider marks and direct item
links accompany Spotify metadata.

Spotify search/detail artists and Genius primary/featured artist fields supply
ordered IDs, names and links without additional requests. The existing
MusicBrainz recording-search adapter also preserves artist IDs, credited names
and literal `artist.type` evidence. Spotify/Genius do not provide the
Person/Group distinction here. MusicBrainz types other than Person/Group stay
Unknown. The Spotify resolver retains Spotify artist identity; it does not
merge MusicBrainz or Genius artists into it by a name match. Person/Group
browser scenarios exercise explicit contract fixtures, not a new live artist
lookup or cross-provider identity resolution.

## Tab context and failure states

`lib/artists/context.ts` stores a bounded metadata-only cache in sessionStorage
(40 profiles, 20 tracks per profile, maximum 256,000 serialized characters).
Membership and deduplication use source-qualified artist and track IDs. The
clicked artist remains available when a large collaboration exceeds the
profile bound; the original track credit order remains intact.

Only title, display credits, source IDs/links, album/year, metadata source and
an allowed exploration-page origin are retained. The cache excludes cover
images, arbitrary artist assets, preview URLs, audio, lyrics, measurements,
analysis results and credentials. It performs no account or database writes.

Profiles first render a real hydration-loading state. A route opened without
this tab’s metadata shows an honest empty/reference state. Unreadable/corrupt
storage shows a retryable error. Storage-write denial/quota failure retains
useful metadata in memory for SPA navigation and labels it temporary; reload
persistence is not promised. Browser Back/Forward and reload work when the
tab cache is available. Profile headings receive programmatic focus after
loading; links and buttons retain visible keyboard focus.

## Visual asset contract

`lib/artists/assets.ts` accepts only reviewed registry records with:

- An exact provider-qualified artist identity and visual kind.
- Verified official provenance and a public HTTPS source URL.
- Approved display permission, a public permission/license evidence URL and
  attribution text.
- Explicit Person evidence for a portrait, or Group evidence for a band logo.

Album-cover assets are always rejected. Browser/API/session payloads cannot
populate the registry. Approved originals use `object-contain`, have source
and attribution links, and fall back accessibly on image-load failure. The
registry is currently empty: no asset with reviewed display permission was
available in this scope. Generic music/person/group glyphs are labeled as
missing imagery rather than presented as an artist’s likeness or logo.

[Spotify Get Track](https://developer.spotify.com/documentation/web-api/reference/get-track)
provides ordered artist IDs/names/links and album artwork. Its image-display
notes require attribution, direct Spotify links and unmodified visuals.
[Spotify Get Artist](https://developer.spotify.com/documentation/web-api/reference/get-an-artist)
documents artist images but no band-logo field; its `type: artist` does not
identify a Person or Group. This change does not call that endpoint, infer
display rights from an API URL, or introduce a paid/image/biography service.

## Data prerequisites and retained protections

The songs schema persists a display artist string, not ordered artist IDs.
Fresh credits survive source/resolver and metadata-upsert return values, but
are not added to existing database columns. Legacy cached/saved/share rows
therefore cannot reliably connect provider-qualified profiles to saved
readings. The profile links to the public Atlas generally and reports related
readings as unavailable. A durable artist-credit relationship and deliberate
backfill would be a separate reviewed data change; schema, RLS, account
visibility and access settings were not changed here.

Actual official portraits/logos require matching, reviewed source and display
permission records. Rich biography/type discovery would require a separately
reviewed data source; no new calls or credentials were introduced. Public
deployment browsing remains blocked by this environment’s proxy, and live
Supabase/RLS verification remains unavailable. The known missing-config
OG/Twitter 500 is outside this artist-identity change.

All protections from PR #9 remain: no remote-preview analysis, no new
audio-derived persistence/indexing, local File analysis stays session-only,
and AudD still requires named disclosure, explicit confirmation and a server
consent marker. No production jobs, live audio uploads or permission changes
were performed.

## Verification

Local validation uses the saved cloud environment and a production Next.js
16.3.6 build served to real Chromium on localhost. Controlled metadata fixtures
are original and do not assert live artist identity, imagery rights or audio
measurements. See [machine-readable browser evidence](ARTIST_PROFILES_QA.json)
and [screenshots](screenshots/artist-profiles/).

Validation on the final implementation: 194 unit tests passed, with the existing
11 Supabase-gated tests skipped; TypeScript and production build passed;
repository lint had zero errors and six existing warnings, with changed files
clean. All 32 Playwright tests passed on the production server with zero retries.
The responsive/state matrix completed 26 scoped axe checks with zero violations,
no horizontal overflow, no page errors and no prohibited requests.

The focused unit tests cover source ordering/IDs/links, namespace separation,
explicit type evidence, visual permission rejection, track membership and
deduplication, corrupt/denied/quota storage, forbidden-field exclusion and
bounded large collaborations. Browser regressions cover keyboard navigation
and heading focus, collaborator links, history/reload, direct-link empty and
invalid-route states, legacy labels, storage error/retry/denial, explicit type
fixtures, genuine hydration loading and long-name phone wrapping.

Responsive visual/a11y checks cover 390/768/1440 px in light/dark themes and
phone empty, loading, error, temporary, Person, Group and long-name scenarios.
Axe scopes are the new profile and selected-track regions, not a whole-app
accessibility certification. Checks assert no horizontal overflow, loaded
Spotify marks at least 90 px wide, no artist-figure album image, no page errors
and no remote-preview, artist-API or audio-write requests.
