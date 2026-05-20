# 🎵 Song Analyzer

A modern web application that analyzes **song lyrics** *and* **audio files** to determine mood, vibe, energy, and emotional insights. Lyrics analysis uses keyword-based NLP with optional Hugging Face translation. Audio analysis uses the Web Audio API to extract tempo, energy, spectral brightness, and dynamics — all client-side.

**Live:** [songanalyzer.vercel.app](https://songanalyzer.vercel.app) *(if deployed)*

---

## Features

| Feature | Description |
|---------|-------------|
| **Lyrics Mode** | Paste lyrics → get mood, vibe, energy, sentiment, themes |
| **Audio Mode** | Upload MP3/MP4/WAV/etc. → detect mood from beat, rhythm, and tone |
| **Mood Radar Chart** | SVG spider chart visualising five mood dimensions (lyrics) |
| **Audio Feature Bars** | Visual bars for RMS energy, brightness, dynamics, percussiveness |
| **BPM Detection** | Automatic tempo estimation via onset autocorrelation |
| **Sample Lyrics** | One-click samples for instant demo (Pop, Ballad, Rock, Chill) |
| **Analysis History** | Saves past lyric analyses to localStorage — view, restore, or delete |
| **Share / Export** | Copy a formatted text summary to clipboard (both modes) |
| **Multi-Language** | Auto-detects 11+ languages; translates via Hugging Face models |
| **Dark Mode** | System-aware toggle with persistence |
| **Confidence Bar** | Animated visual indicator based on input length / duration |
| **Loading Skeleton** | Polished skeleton UI while results load |
| **Keyboard Shortcut** | Cmd/Ctrl + Enter to analyze lyrics |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Audio Analysis:** Web Audio API (client-side, zero dependencies)
- **AI/ML:** Hugging Face Inference (optional, for translation)
- **Testing:** Vitest
- **Analytics:** Vercel Analytics
- **Deployment:** Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/roni-altshuler/SongAnalyzer.git
cd SongAnalyzer
npm install
```

### Environment Variables (optional)

```bash
cp .env.example .env
```

Add a [Hugging Face token](https://huggingface.co/settings/tokens) for translation support:

```
HUGGINGFACE_API_KEY=your_token_here
```

### Development

```bash
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint
npm test           # run tests
```

## Project Structure

```
SongAnalyzer/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts          # Lyric analysis endpoint
│   │   └── translate/route.ts        # Translation endpoint
│   ├── components/
│   │   ├── AnalysisResults.tsx        # Lyrics results card
│   │   ├── AnalysisSkeleton.tsx       # Pulse-animated loading placeholder
│   │   ├── AudioAnalysisResults.tsx   # Audio results card with feature bars
│   │   ├── AudioUpload.tsx            # Drag-and-drop audio file uploader
│   │   ├── ConfidenceBar.tsx          # Animated confidence progress bar
│   │   ├── EmptyState.tsx             # Placeholder before first analysis
│   │   ├── HistoryPanel.tsx           # Collapsible analysis history list
│   │   ├── LyricsInput.tsx            # Textarea + word count + shortcut
│   │   ├── ModeTabs.tsx               # Lyrics / Audio mode switcher
│   │   ├── MoodRadar.tsx              # SVG radar / spider chart
│   │   ├── SampleLyricPicker.tsx      # Horizontal card carousel
│   │   └── ThemeToggle.tsx            # Dark / light toggle button
│   ├── providers/
│   │   └── theme-provider.tsx         # React context for theme state
│   ├── globals.css                    # Tailwind imports + animations
│   ├── layout.tsx                     # Root layout + Vercel Analytics
│   └── page.tsx                       # Main page (both modes)
├── lib/
│   ├── audio-analysis.ts             # Client-side Web Audio API analysis
│   ├── history.ts                     # localStorage history CRUD helpers
│   ├── language.ts                    # Shared language detection patterns
│   ├── samples.ts                     # Built-in sample lyrics data
│   └── types.ts                       # Shared TypeScript interfaces
├── __tests__/
│   ├── analyze.test.ts                # API route tests for /api/analyze
│   ├── audio-analysis.test.ts         # Unit tests for audio feature mapping
│   └── language.test.ts               # Unit tests for language utilities
├── .env.example
├── vitest.config.ts
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Analysis Dimensions

### Lyrics Mode

The lyric analyzer evaluates text across six dimensions:

1. **Mood** — Emotional state (e.g., Melancholic, Euphoric, Peaceful)
2. **Vibe** — Atmosphere (e.g., Upbeat, Moody, Tranquil)
3. **Energy** — Intensity level (Very High → Very Low)
4. **Sentiment** — Emotional direction (Very Positive → Very Negative)
5. **Themes** — Up to 5 key topics (Love, Hope, Struggle, etc.)
6. **Detailed Analysis** — Narrative summary of the emotional arc

The Mood Radar chart maps these into five visual axes: Energy, Positivity, Intensity, Complexity, and Emotion.

### Audio Mode

The audio analyzer processes uploaded files entirely client-side using the Web Audio API:

| Feature | How it's measured |
|---------|-------------------|
| **Tempo (BPM)** | Onset-based autocorrelation on the down-mixed mono signal |
| **RMS Energy** | Root-mean-square loudness, normalised 0-1 |
| **Spectral Centroid** | Frequency-weighted centre of mass (brightness in Hz) |
| **Dynamic Range** | Std-dev of short-term RMS windows (variation in loudness) |
| **Zero-Crossing Rate** | Percussiveness / noisiness indicator |

These features are mapped to **Mood**, **Vibe**, **Energy**, **Sentiment**, **Tempo**, and **Characteristics** using heuristic rules.

Supported formats: MP3, MP4, M4A, AAC, OGG, WAV, WebM.

## Multi-Language Support

Built-in detection for: Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, and Hebrew.

When a non-English language is detected and a Hugging Face API key is configured, the lyrics are translated via Helsinki-NLP models before analysis.

## Deployment

```bash
npm run build
```

Or deploy with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roni-altshuler/SongAnalyzer)

## Contributing

Contributions, issues, and feature requests are welcome!

## Mood Atlas

The Mood Atlas is a public, research-flavored dashboard at `/atlas` that aggregates every visible (public or system-seeded) analysis into cross-catalog views:

- **Overview** (`/atlas`) — global mood distribution, browseable genre tiles, top artists.
- **Per-artist** (`/atlas/artist/[slug]`) — mood-over-time area chart of the artist's discography, mood mix, and a clickable list of every analyzed song.
- **Per-genre** (`/atlas/genre/[name]`) — mood distribution, top artists in the genre, and a weighted theme cloud.

The atlas reads from a materialized view (`atlas_aggregates`) plus a `analyses_with_song` convenience join, both created by `supabase/migrations/0002_atlas_view.sql` and `0003_atlas_view_helpers.sql`. Pages render an empty-state card when no data is present, so the dashboard is safe to visit before the seed has been applied locally.

### Seeding the atlas

The Mood Atlas ships with ~60 synthetic-artist analyses so the dashboard looks populated on day one. Seed lyrics live in [`lib/seeds/atlas-seed-lyrics.ts`](lib/seeds/atlas-seed-lyrics.ts); a deterministic builder script emits the corresponding SQL.

Regenerate `supabase/seed.sql`:

```bash
# one-time, if tsx is not already installed
npm install -D tsx

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

The seed corpus is intentionally synthetic (fictional artist names, original lyric snippets) — no copyrighted material is shipped or stored.

## Author

**Roni Altshuler**

---

Made with ❤️ using Next.js and Tailwind CSS