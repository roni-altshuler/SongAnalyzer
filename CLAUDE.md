# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Next 16 dev server on :3000 (Turbopack)
npm run build             # Production build
npm run start             # Serve the build
npm run lint              # ESLint v9 flat config (eslint . --ext .ts,.tsx)
npm run typecheck         # tsc --noEmit
npm test                  # Vitest, all suites
npm test -- analyze       # Run a single suite (matches file name)
npm test -- -t "blend"    # Run tests whose name matches a pattern
npm run test:watch        # Vitest interactive
npm run test:e2e          # Playwright (boots `next dev` via webServer)
npm run seed:atlas        # tsx lib/seeds/build-seed-sql.ts > supabase/seed.sql
npm run seed:fingerprints # bulk-index Spotify previews into the Identify catalog
                          # (runs tsx with --conditions=react-server so `server-only`
                          #  modules resolve outside Next — don't drop that flag)

# Local Supabase (Docker required)
npx supabase start                    # boot Postgres + Auth + Storage locally
npx supabase db reset                 # re-apply every migration + seed.sql
SUPABASE_LOCAL=1 npm test             # also runs the otherwise-skipped RLS suite

# Vitest config is named `vitest.config.mts` (not .ts) — the .mts extension
# is required to avoid an ERR_REQUIRE_ESM crash from Vite 7. Don't rename it.
```

## Architecture

### The hybrid analysis engine

`/api/analyze` is a **blend of two engines**, not a single model call:

1. `lib/analysis/keyword.ts` — deterministic substring + regex over the lyrics. Always succeeds, synchronous, no network. This is the v1 engine, preserved verbatim so existing test fixtures still pass.
2. `lib/analysis/transformer.ts` — calls Hugging Face Inference (primary: `j-hartmann/emotion-english-distilroberta-base`, fallback: `bhadresh-savani/distilbert-base-uncased-emotion`). Wrapped in `AbortSignal.timeout(8000)`. Skipped entirely when `HUGGINGFACE_API_KEY` is unset.

`lib/analysis/blend.ts` merges them: when the transformer succeeds, its top emotion drives `mood`/`sentiment`; the keyword engine always provides `themes`; confidence is a 70/30 weighted average. **The route always returns 200 with engines metadata** — when the transformer fails (timeout, 503, no token), `engines.transformer.status` records the reason ('skipped' | 'unavailable' | 'timeout' | 'error') so the UI can show transparent provenance. Never throw from `/api/analyze` — fall back to the keyword result.

`lib/analysis/palette.ts` maps the resulting mood to a `{ from, to, glow }` hex triplet that propagates into the UI as CSS variables. `lib/analysis/cache.ts` exposes an `AnalysisCacheStore` interface and a SHA-256-keyed in-memory store; a Supabase-backed store can plug in via `setAnalysisCache(...)`.

### The audio engine (`lib/audio/*`, `lib/fingerprint/*`, `app/workers/*`)

Two client-side Web Worker pipelines, both fed from one decode
(`decodeFileToMono` in `lib/audio/analyze.ts`):

1. **Feature extraction (v2)** — `app/workers/audio-features.worker.ts` runs
   `lib/audio/features.ts`: Meyda (MFCC/chroma/rms/zcr) + hand-rolled tempo
   (`tempo.ts`, autocorrelation + octave correction + beat grid), key
   (`key.ts`, Krumhansl-Schmuckler), valence/arousal (`mood-map.ts`), and the
   48-dim sonic vector (`vector.ts`). **`lib/audio-analysis.ts` (the v1
   engine) is preserved verbatim as the fail-soft fallback** — any v2 failure
   returns a v1 result tagged `engineVersion: 'v1-fallback'`. Don't modify v1.
2. **Fingerprinting (Identify)** — `app/workers/fingerprint.worker.ts` runs
   `lib/fingerprint/constellation.ts` (Wang-2003 spectral-peak pairs, 24-bit
   packed hashes). Matching happens in the `match_fingerprints` Postgres RPC
   (service-role only); ingest is validated + first-write-wins in
   `lib/fingerprint/ingest.ts`. `/api/identify` mirrors `/api/analyze`'s
   always-200 posture. AudD is the env-gated (`AUDD_API_TOKEN`) world-catalog
   fallback — never required.

`app/hooks/useSongAnalysis.ts` is the one shared client pipeline: decode →
analyze (v2→v1) → fire-and-forget persistence (`/api/analyses`,
`/api/fingerprints`, `/api/songs/[id]/features`). All three feature pages
(/identify, /analyze, /discover) go through it — don't fork the flow.

Shared circumplex vocabulary: `MOOD_COORDS` in `lib/audio/mood-map.ts` places
the 13 palette moods on the valence/arousal plane; `lib/analysis/affect.ts`
projects lyrics results onto the same plane. The CombinedView agreement score
is a distance in that space — never reintroduce string-based agreement.

### The mood-color cascade

`app/providers/mood-theme-provider.tsx` exposes `useMoodTheme().setMoodColor({ from, to, glow })` and writes `--accent-from`, `--accent-to`, `--accent-glow` to `document.documentElement.style`. Every primitive (Card glow, Button gradient, Badge tint, Meter fill, mood-tinted Recharts bars, SongHero radial mask) consumes those vars, so a single state update repaints the entire tree. `AnalysisResults` calls `setMoodColor` on mount and `resetMoodColor` on unmount; `SongHero` does the same but with the cover-art palette from `node-vibrant`, overriding the engine-derived color.

This is **separate from light/dark theming**. There are two independent theme axes:
- Light vs. dark — toggled via the `light`/`dark` class on `<html>` by `app/providers/theme-provider.tsx`. Surface vars (`--bg-*`, `--text-*`, `--border-*`) swap.
- Mood color — toggled inline by `MoodThemeProvider`. Accent vars (`--accent-*`) swap.

Both axes work together. Don't try to merge them.

### External data sources (`lib/sources/*`)

`resolveSong(query)` orchestrates **Spotify (primary) → MusicBrainz + AcousticBrainz + Genius (enrichment in parallel)**. The resolver returns whatever it can get — every source has try/catch isolation so a MusicBrainz 503 doesn't abort the whole resolution.

Hard rules baked into the adapters:
- **Genius lyrics are never fetched or stored**. The `genius.ts` adapter only consumes `song_id`, cover art, producer credits. Storing or redistributing lyrics violates Genius's ToS — there's a load-bearing comment at the top of the file.
- **Spotify uses Client Credentials only** — not Authorization Code. No user OAuth. We get track search, metadata, cover art, and 30-second `preview_url`s; we do not touch the deprecated Audio Features endpoint (dead for new apps as of Nov 2024).
- **MusicBrainz requires a `User-Agent` header** or they block you. Rate-limited to 1 req/sec via an in-process queue.
- **AcousticBrainz returns null for post-2022 songs** (project stopped accepting submissions). That's expected, not a bug — fall back to the client-side analyzer on Spotify's 30s preview.

All `lib/sources/*.ts` start with `import 'server-only'`. The API routes return clean 503 JSON (`{ error: 'spotify_not_configured' }`, etc.) when env vars are missing — never throw 500.

### Data layer (`lib/db/*` + `lib/supabase/*` + `supabase/migrations/*`)

Schema lives in `supabase/migrations/0001_init.sql`: `profiles`, `songs`, `analyses`, `shares`, with RLS enabled on all tables. The Mood Atlas adds `atlas_aggregates` (materialized view) in `0002` and `analyses_with_song` (join view) in `0003`.

**Two client patterns**, picked deliberately per call site:
- `getServerSupabase()` (`lib/supabase/server.ts`) — async, reads cookies from `next/headers`, **respects RLS**. Use in RSC + API routes when the call should be gated by the current user's session.
- `getAdminSupabase()` (`lib/supabase/admin.ts`) — service-role, **bypasses RLS**. Server-only (throws if imported in a browser context). Used for anonymous inserts (the `/api/analyze` route writes to `analyses` without a user), for atlas read queries (the view is public anyway), and from `lib/db/songs.ts`.

`lib/db/song-store-adapter.ts` bridges `SongRow` (snake_case DB shape) ↔ `Song` (camelCase resolver shape from `lib/sources/types.ts`). Use `createSongStore()` to pass a `SongStore` to `resolveSong()` from an API route. These two type worlds are kept deliberately separate so the resolver stays unit-testable without Supabase.

### Fail-soft pattern

Pages that read from external systems (Supabase, Spotify, etc.) must not 500 when the system is unreachable. The pattern: wrap the data calls in a local `try<Get>` helper that swallows the error and returns `null`, then let the existing `notFound()` / empty-state path render. See `app/share/[slug]/page.tsx` for the canonical example (`tryGetAnalysis`, `tryGetSong`). The atlas pages do the same — `getAtlasOverview` etc. return empty results when the view is missing instead of throwing.

The exception is `/api/analyze`: it always returns 200 with the keyword fallback, never 503.

### Design system (`app/components/ui/*`)

Tailwind v4 with the `@theme` directive (`app/globals.css`). All colors, text scale, and easings are CSS variables — **never use raw hex or Tailwind palette colors in components**. Use the design tokens: `bg-[var(--bg-elev1)]`, `text-[var(--text-hi)]`, `border-[var(--border-subtle)]`, `[var(--accent-from)]`. The point is that the mood-color cascade can repaint the whole tree by mutating those vars.

Primitives in `app/components/ui/`: `Card` (variants: flat/elev1/elev2/glow), `Button`, `Tabs`, `Badge`, `Meter`, `Tooltip`, `Modal`, `Skeleton`, `Toast` (re-exports Sonner), `Spectrum`. Built on Radix Primitives + Framer Motion (`LazyMotion + domAnimation` only, never the full motion bundle). Reach for these before writing bespoke `<div className="bg-white rounded-2xl shadow-xl">`. If a variant is missing, ask before inlining Tailwind that breaks the design language.

Visual showcase: `/dev/components` — every primitive in every variant, with an interactive mood-color picker that repaints the page live. Use it to verify any new primitive lands correctly.

Typography: `Instrument Serif` (display, via `--font-display`), `Inter` (body, `--font-body`), `JetBrains Mono` (mono numerics, `--font-mono`). Registered via `next/font/google` in `app/layout.tsx`.

### Mood Atlas + seeding

`/atlas`, `/atlas/artist/[slug]`, `/atlas/genre/[name]` are public dashboards reading from the `atlas_aggregates` materialized view. The view does **not** auto-refresh — after any bulk insert into `analyses`, run `select public.refresh_atlas_aggregates();` in the Supabase SQL editor. There's an optional `pg_cron` pattern documented in the migration header but it's not enabled by default.

The dashboard ships with ~58 system-seed analyses so it looks populated on day one. The seed pipeline:
1. Source: `lib/seeds/atlas-seed-lyrics.ts` — synthetic artists, original lyric snippets. **No real artist names, no copyrighted lyrics.**
2. Builder: `lib/seeds/build-seed-sql.ts` — runs each row through `analyzeKeyword`, emits deterministic SQL (sha256-derived UUIDs, idempotent `on conflict do nothing`).
3. Output: `supabase/seed.sql`, regenerated via `npm run seed:atlas`.

If you add or change a seed row, regenerate the SQL — don't hand-edit `supabase/seed.sql`.

### Critical gotchas

- **`vitest.config.mts` extension matters**: `.mts` not `.ts`. Renaming breaks tests with `ERR_REQUIRE_ESM` (Vite 7 is ESM-only and Vitest's CJS config loader can't `require()` it).
- **Routes under `app/_*` don't route**. Next 16 skips any path containing `/_`. If you need a private-but-routable dev page, put it under `app/dev/` (the components showcase lives there for this reason).
- **`server-only` imports**. Vitest doesn't go through the Next bundler, so the `server-only` marker module would be unresolvable in unit tests. `vitest.config.mts` aliases it to Next's compiled empty stub. If you write a new server-only module imported by a test, the alias already covers you — don't add a second one.
- **OG image at `app/share/[slug]/opengraph-image.tsx` runs on the Edge runtime**. Don't import Node-only modules there (no `node:crypto`, no `fs`). System fonts only — `next/font/google` results don't make it to edge.
- **Email/auth callbacks live at `/api/auth/callback`**, registered with Supabase as the redirect URL. The middleware (`middleware.ts`) refreshes session cookies on `/account/:path*`, `/api/auth/:path*`, `/atlas/:path*`.
- **Workers must be instantiated as `new Worker(new URL('./x.worker.ts', import.meta.url))`** so Turbopack code-splits them. The runner helpers live in `app/workers/client.ts` — go through them.
- **Worker `postMessage` transfers the PCM buffer** — the `Float32Array` is unusable afterwards. `pcm.slice()` first if you need the samples twice (see `useSongAnalysis`).
- **`songs.sonic_vector` is locked at `vector(48)`** (pgvector dimension is part of the column type). Any change to the embedding layout must bump `EXTRACTOR_VERSION` in `lib/audio/vector.ts` and re-embed via a migration — never mix layouts under one version.
- **`/api/songs/[id]` takes a Spotify track ID, but `/api/songs/[id]/features` and `/similar` take the DB uuid** (returned by `POST /api/analyses` or `/api/identify`). The uuid check makes a mixed-up call fail with a clear 400.
- **Rate limiting is env-gated on Upstash** (`UPSTASH_REDIS_REST_URL/TOKEN`) with an in-memory per-instance fallback, and **fails open** — see `lib/rate-limit.ts`. Never let a limiter outage take a route down.

## Working in parallel

This repo was built in three waves on the `v2-overhaul` branch, with multiple subagents working in parallel under strict file-ownership boundaries. If a future task needs the same approach, the boundaries are:

- **Data layer**: `supabase/migrations/*`, `lib/supabase/*`, `lib/db/*` (except the adapter), `middleware.ts`, `app/api/auth/**`, `__tests__/rls.test.ts`
- **Design system**: `app/globals.css`, `app/components/ui/*`, `app/providers/mood-theme-provider.tsx`, `app/dev/components/page.tsx`, font registration in `app/layout.tsx`
- **Analysis engine**: `app/api/analyze/route.ts`, `lib/analysis/*`, `__tests__/engine-blend.test.ts`, fixtures under `__tests__/analysis-fixtures/`
- **External sources**: `lib/sources/*`, `app/api/songs/**`, `__tests__/sources/*`
- **Composed UI + share**: `app/page.tsx` (landing), `app/analyze/**`, `app/discover/**`, `app/components/{SongHero,SongSearch,CombinedView,WaveformPlayer,EngineProvenance,MoodRadarV2,AnalysisResults,SimilarSongs,...}.tsx`, `app/components/shell/*`, `app/hooks/useSongAnalysis.ts`, `app/share/**`, `app/api/analyses/**`
- **Mood Atlas**: `app/atlas/**`, `lib/atlas/*`, `lib/seeds/*`, `supabase/migrations/0002_*`, `0003_*`, `supabase/seed.sql`
- **Audio engine (v3)**: `lib/audio/*` (except the untouched `lib/audio-analysis.ts`), `lib/fingerprint/*`, `app/workers/*`, `app/identify/**`, `app/components/{IdentifyListener,LiveSpectrum}.tsx`, `app/api/identify/**`, `app/api/fingerprints/**`, `app/api/songs/[id]/{features,similar}/**`, `scripts/index-previews.ts`, migrations `0004_*`, `0005_*`, `0006_*`, `__tests__/{fingerprint,audio}/**`

The `SongRow` ↔ `Song` adapter (`lib/db/song-store-adapter.ts`) is the only file that intentionally bridges two layers' types.
