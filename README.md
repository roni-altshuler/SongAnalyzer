# SongAnalyzer

> Identify a song from ten seconds of its beat. Decode its mood from lyrics and audio. Discover what feels the same — and let the song tint the page.

SongAnalyzer is a music-streaming-dark Next.js app built around three surfaces. **Identify** (`/identify`) fingerprints instrumental audio in your browser — a Wang-2003 spectral-peak constellation computed in a Web Worker; only integer hashes reach the server — and matches it against the catalog of everything the app has analyzed, with an optional AudD world-catalog fallback. **Analyze** (`/analyze`) reads songs through two engines: lyrics via a hybrid transformer + keyword pipeline, audio via a real MIR engine (Meyda MFCC/chroma, beat grid, key detection, valence/arousal) with the original DSP engine as a fail-soft fallback. **Discover** (`/discover`) walks a 48-dimension sonic-fingerprint space (pgvector) to find songs that *feel* the same. The dominant emotion drives an accent gradient that cascades through the entire UI in real time.

**Live:** [songanalyzer.vercel.app](https://songanalyzer.vercel.app)

---

## What you can do

| | |
|---|---|
| **Identify a song** | Hold your device to the music (or upload a clip). A constellation fingerprint is computed in a Web Worker and matched via a Postgres RPC against every song the app has analyzed — audio never leaves the browser for catalog matches. Env-gated AudD fallback covers the world catalog. |
| **Paste lyrics** | Hybrid transformer + keyword engine returns mood, vibe, energy, sentiment, themes, and a per-engine provenance trail. Confidence calibrated, dominant emotion mapped, mood color computed server-side. |
| **Upload audio** | The v2 MIR engine (Web Worker) extracts a beat grid + tempo (octave-corrected autocorrelation), musical key (Krumhansl-Schmuckler over chroma), MFCC timbre stats, spectral flux, and a valence/arousal reading — with the original lightweight DSP engine as an automatic fallback. |
| **Discover similar songs** | Every analysis persists a 48-dim sonic fingerprint (pgvector, HNSW cosine). The "feels like this" rail walks the catalog by sound, not genre tags. |
| **Search a song** | Typeahead against Spotify (Client Credentials) returns metadata, cover art, and 30-second previews. Genius enrichment for IDs and album info only — never lyrics, by ToS. MusicBrainz + AcousticBrainz fill in open audio features when available. |
| **Share a result** | Each analysis can be marked public; you get a permalink (`/share/<slug>`) and a 1200×630 OG image generated at the edge using the song's mood-color palette. |
| **Mood Atlas** | A public dashboard (`/atlas`) aggregating every visible analysis into a global mood distribution, browseable genres, per-artist mood-over-time, and theme clouds. |
| **Combined view** | When the same song has both a lyrics analysis and an audio analysis, both are projected onto a shared valence/arousal plane — the agreement score is a distance in emotion space, drawn on a live circumplex map, surfacing the classic "happy melody / sad lyrics" tension. |
| **Mood-color cascade** | When a result lands, `--accent-from / --accent-to / --accent-glow` are written to `<html>` and every primitive (cards, buttons, badges, charts, hero glow) repaints in the song's color. |
| **Multi-language** | Built-in detection across 11+ languages; auto-translates via Helsinki-NLP through the Hugging Face Inference API when a token is configured. |
| **History** | Local analyses persist to `localStorage`; signed-in users get a Supabase-backed list. |

## Architecture in one breath

```
┌──────────────────────────────────────────────────────────────────┐
│ Next.js 16 App Router · TypeScript · Tailwind v4 · React 19      │
├──────────────────────────────────────────────────────────────────┤
│  app/                                                            │
│    page.tsx              ── home (lyrics + audio modes)          │
│    share/[slug]/         ── permalink + edge-rendered OG image   │
│    atlas/                ── public Mood Atlas dashboard          │
│    api/analyze           ── hybrid engine endpoint               │
│    api/songs/{search,id} ── Spotify/Genius/MB/AB orchestration   │
│    api/analyses/share    ── mark-public + slug return            │
│    api/auth/callback     ── Supabase OAuth code exchange         │
│    components/ui/        ── Card, Button, Tabs, Badge, Meter,    │
│                             Tooltip, Modal, Skeleton, Toast,     │
│                             Spectrum                             │
│    components/           ── SongHero, SongSearch, CombinedView,  │
│                             WaveformPlayer, EngineProvenance,    │
│                             MoodRadarV2, AnalysisResults, …      │
│    providers/            ── MoodThemeProvider, theme-provider    │
│  lib/                                                            │
│    analysis/             ── keyword + transformer engines, blend │
│    sources/              ── spotify, genius, musicbrainz,        │
│                             acousticbrainz, resolveSong          │
│    db/                   ── songs, analyses, shares, store-adapter│
│    supabase/             ── client, server, admin, middleware    │
│    seeds/                ── atlas-seed-lyrics + builder script   │
│  supabase/migrations/    ── schema, RLS, atlas_aggregates view   │
└──────────────────────────────────────────────────────────────────┘
```

## Tech stack

- **Framework:** Next.js 16 (App Router) on Turbopack
- **Language / runtime:** TypeScript 5, React 19, Node 20+
- **Styling:** Tailwind v4 with CSS-variable `@theme` tokens. Display: Instrument Serif. Body: Inter. Mono: JetBrains Mono.
- **Primitives:** Radix UI (Dialog, Tabs, Tooltip, Slot, Popover) + Framer Motion (`LazyMotion + domAnimation`) + Sonner toasts
- **Persistence + auth:** Supabase (Postgres, RLS, Auth, Storage) via `@supabase/ssr`
- **Analysis:** Hugging Face Inference (`@huggingface/inference`) — `j-hartmann/emotion-english-distilroberta-base` primary, `bhadresh-savani/distilbert-base-uncased-emotion` fallback
- **Audio:** Web Audio API + `wavesurfer.js@7` (lazy-loaded)
- **External data:** Spotify Web API (Client Credentials), Genius (metadata only — ToS), MusicBrainz, AcousticBrainz
- **Charts:** Recharts (Atlas dashboard only)
- **Color extraction:** `node-vibrant`
- **Testing:** Vitest + Playwright (E2E smoke)
- **Deployment:** Vercel (Edge runtime for OG images)

## Getting started

### Prerequisites

- Node.js 20+ (Vite 7 requires `^20.19.0 || >=22.12.0`)
- npm
- (Optional) Docker + Supabase CLI for local Postgres

### Install

```bash
git clone https://github.com/roni-altshuler/SongAnalyzer.git
cd SongAnalyzer
npm install
```

### Environment variables

Everything is optional — the app degrades gracefully when keys are missing:

```bash
cp .env.example .env.local
```

| Variable | Without it… |
|---|---|
| `HUGGINGFACE_API_KEY` | Transformer engine is `skipped`; keyword fallback runs alone. No non-English translation. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No persistence, no auth, no share URLs (`/share/<bad-slug>` returns a clean 404). Atlas pages show an empty state. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes (anonymous analyses, song upserts, fingerprint catalog, atlas refresh) fail. Reads still work. |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | `/api/songs/search` returns 503 (`spotify_not_configured`); SongSearch shows an inline notice. |
| `GENIUS_ACCESS_TOKEN` | Genius enrichment skipped in `resolveSong`; everything else still resolves. |
| `AUDD_API_TOKEN` | Identify's world-catalog fallback is skipped — misses show a clean "not in catalog yet" state. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting falls back to an in-memory per-instance sliding window (fine for dev). |
| `SUPABASE_LOCAL=1` | Enables the RLS test suite (`__tests__/rls.test.ts`). Requires a running `supabase start`. |

### Develop

```bash
npm run dev      # http://localhost:3000 — boots in ~1.5s
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint
npm test         # Vitest (81 tests, 8 RLS skipped without local Supabase)
```

Visit `/dev/components` for the design-system showcase — every primitive in every variant, with an interactive mood-color picker that repaints the page live.

## The hybrid analysis engine

The `/api/analyze` route blends two engines:

1. **Transformer** (`lib/analysis/transformer.ts`) — calls the HF Inference API with an 8-second `AbortSignal.timeout`. On 503 it falls back from the primary model to the secondary; on any further failure (rate limit, timeout, missing token) it returns `null` and the route records `engines.transformer.status` accordingly.
2. **Keyword** (`lib/analysis/keyword.ts`) — deterministic, synchronous, always succeeds. Inherited verbatim from v1 so the existing test fixtures still pass.

`lib/analysis/blend.ts` merges them: when the transformer succeeds, its top emotion drives `mood` and `sentiment`; the keyword engine always provides `themes`; confidence is a 70/30 weighted average. The result includes a `moodColor: { from, to, glow }` triplet derived from the dominant emotion via `lib/analysis/palette.ts`, which the front-end pushes into CSS variables.

A SHA-256-keyed cache (`lib/analysis/cache.ts`) lets future re-analyses of the same lyrics short-circuit. The in-memory store is the default; a Supabase-backed store can plug in via `setAnalysisCache(...)`.

## Design system

The music-streaming-dark theme is built from CSS variables registered in `app/globals.css` with Tailwind v4's `@theme` directive:

- Surface depths: `--bg-base`, `--bg-elev1`, `--bg-elev2`, `--bg-elev3`
- Text: `--text-hi`, `--text-med`, `--text-low`
- Accents (live, mood-driven): `--accent-from`, `--accent-to`, `--accent-glow`
- State: `--state-success`, `--state-warn`, `--state-error`
- Easings: `--ease-out`, `--ease-in-out`

`<MoodThemeProvider>` lets any component call `setMoodColor({ from, to, glow })` and have the gradient cascade everywhere — the analyze flow uses the engine-derived color, `SongHero` overrides it with the cover-art palette via `node-vibrant`, and the showcase page lets you pick manually. All primitives respect `prefers-reduced-motion`.

## Data layer

Supabase Postgres schema (in `supabase/migrations/0001_init.sql`):

- `profiles` — mirrors `auth.users`
- `songs` — canonical track records keyed by Spotify / Genius / MusicBrainz IDs
- `analyses` — every analysis, with `system_seed`, `is_public`, `share_slug`, and the full `result jsonb`
- `shares` — view-count + cached OG image path

RLS is enabled across all tables. Public reads are gated on `is_public OR system_seed`; writes go through the service-role client (`lib/supabase/admin.ts`) so anonymous analyses can be inserted by the API route. The `SongRow` ↔ `Song` adapter (`lib/db/song-store-adapter.ts`) bridges snake_case DB shapes to the camelCase resolver world.

To run Supabase locally:

```bash
npx supabase start              # boots a local stack via Docker
npx supabase db reset           # applies every migration + seed.sql
SUPABASE_LOCAL=1 npm test       # adds the RLS suite to the test run
```

## Multi-language

Built-in detection for: Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, and Hebrew. When a non-English language is detected and `HUGGINGFACE_API_KEY` is set, the lyrics are translated via Helsinki-NLP models before analysis.

## Deployment

The app is Vercel-ready. The OG image route at `/share/[slug]/opengraph-image` runs on the Edge runtime; everything else on Node. Add the env vars above to your Vercel project; the Supabase migrations need to be pushed separately:

```bash
npx supabase db push            # against a hosted project
```

Or deploy with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roni-altshuler/SongAnalyzer)

## Mood Atlas

The Mood Atlas is a public, research-flavored dashboard at `/atlas` that aggregates every visible (public or system-seeded) analysis into cross-catalog views:

- **Overview** (`/atlas`) — global mood distribution, browseable genre tiles, top artists.
- **Per-artist** (`/atlas/artist/[slug]`) — mood-over-time area chart of the artist's discography, mood mix, and a clickable list of every analyzed song.
- **Per-genre** (`/atlas/genre/[name]`) — mood distribution, top artists in the genre, and a weighted theme cloud.

The atlas reads from a materialized view (`atlas_aggregates`) plus an `analyses_with_song` convenience join, both created by `supabase/migrations/0002_atlas_view.sql` and `0003_atlas_view_helpers.sql`. Pages render an empty-state card when no data is present, so the dashboard is safe to visit before the seed has been applied locally.

### Seeding the atlas

The Mood Atlas ships with ~60 synthetic-artist analyses so the dashboard looks populated on day one. Seed lyrics live in [`lib/seeds/atlas-seed-lyrics.ts`](lib/seeds/atlas-seed-lyrics.ts); a deterministic builder script emits the corresponding SQL.

Regenerate `supabase/seed.sql`:

```bash
# emit seed SQL (deterministic — same input produces identical output)
npx tsx lib/seeds/build-seed-sql.ts > supabase/seed.sql
```

Apply the seed to a local Supabase stack:

```bash
npx supabase db reset       # re-applies every migration + seed.sql
```

### Refreshing the materialized view

`atlas_aggregates` does **not** auto-refresh. After seeding (or after any bulk insert of public analyses) run:

```sql
select public.refresh_atlas_aggregates();
```

in the Supabase SQL editor (or `psql`). The function is `security definer`, so the service role can call it from server code if/when we add an admin RPC.

### Scheduling nightly refreshes (optional)

Supabase exposes `pg_cron` as an opt-in extension per project. We do **not** enable it in the migrations — flipping it on is a project-level decision. When you're ready:

```sql
-- in the Supabase SQL editor, project owner
create extension if not exists pg_cron;

select cron.schedule(
  'refresh-atlas-aggregates',
  '17 3 * * *',                            -- nightly 03:17 UTC
  $$ select public.refresh_atlas_aggregates(); $$
);
```

The seed corpus is intentionally synthetic (fictional artist names, original lyric snippets) — no copyrighted material is shipped or stored. Genius lyrics are never fetched or persisted by design; the Genius adapter only consumes IDs and metadata.

## Contributing

Issues and PRs welcome. Run `npm test` before opening one — `tsc --noEmit` and `npm run lint` are part of CI.

## Author

**Roni Altshuler**

---

Made with care using Next.js, Tailwind, Supabase, and a soft spot for editorial typography.
