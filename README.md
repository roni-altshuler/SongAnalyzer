# 🎵 Song Lyric Analyzer

A modern web application that analyzes song lyrics to determine mood, vibe, energy, and emotional insights — powered by keyword-based NLP with optional Hugging Face translation.

**Live:** [songanalyzer.vercel.app](https://songanalyzer.vercel.app) *(if deployed)*

---

## Features

| Feature | Description |
|---------|-------------|
| **Mood & Vibe Analysis** | Determines emotional tone, atmosphere, energy, and sentiment |
| **Mood Radar Chart** | SVG spider chart visualising five mood dimensions |
| **Sample Lyrics** | One-click samples for instant demo (Pop, Ballad, Rock, Chill) |
| **Analysis History** | Saves past analyses to localStorage — view, restore, or delete |
| **Share / Export** | Copy a formatted text summary to clipboard |
| **Multi-Language** | Auto-detects 11+ languages; translates via Hugging Face models |
| **Dark Mode** | System-aware toggle with persistence |
| **Confidence Bar** | Animated visual indicator based on word count |
| **Loading Skeleton** | Polished skeleton UI while results load |
| **Keyboard Shortcut** | Cmd/Ctrl + Enter to analyze |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **AI/ML:** Hugging Face Inference (optional, for translation)
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
│   │   ├── analyze/route.ts     # Lyric analysis endpoint
│   │   └── translate/route.ts   # Translation endpoint
│   ├── components/
│   │   ├── AnalysisResults.tsx   # Results card with stat grid & detailed text
│   │   ├── AnalysisSkeleton.tsx  # Pulse-animated loading placeholder
│   │   ├── ConfidenceBar.tsx     # Animated confidence progress bar
│   │   ├── EmptyState.tsx        # Placeholder before first analysis
│   │   ├── HistoryPanel.tsx      # Collapsible analysis history list
│   │   ├── LyricsInput.tsx       # Textarea + word count + keyboard shortcut
│   │   ├── MoodRadar.tsx         # SVG radar / spider chart
│   │   ├── SampleLyricPicker.tsx # Horizontal card carousel
│   │   └── ThemeToggle.tsx       # Dark / light toggle button
│   ├── providers/
│   │   └── theme-provider.tsx    # React context for theme state
│   ├── globals.css               # Tailwind imports + custom animations
│   ├── layout.tsx                # Root layout + Vercel Analytics
│   └── page.tsx                  # Main page (assembles all components)
├── lib/
│   ├── history.ts                # localStorage history CRUD helpers
│   ├── language.ts               # Shared language detection patterns
│   ├── samples.ts                # Built-in sample lyrics data
│   └── types.ts                  # Shared TypeScript interfaces
├── __tests__/
│   ├── analyze.test.ts           # API route tests for /api/analyze
│   └── language.test.ts          # Unit tests for language utilities
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Analysis Dimensions

The analyzer evaluates lyrics across six dimensions:

1. **Mood** — Emotional state (e.g., Melancholic, Euphoric, Peaceful)
2. **Vibe** — Atmosphere (e.g., Upbeat, Moody, Tranquil)
3. **Energy** — Intensity level (Very High → Very Low)
4. **Sentiment** — Emotional direction (Very Positive → Very Negative)
5. **Themes** — Up to 5 key topics (Love, Hope, Struggle, etc.)
6. **Detailed Analysis** — Narrative summary of the emotional arc

The Mood Radar chart maps these into five visual axes: Energy, Positivity, Intensity, Complexity, and Emotion.

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

## Author

**Roni Altshuler**

---

Made with ❤️ using Next.js and Tailwind CSS