# 🎵 Song Lyric Analyzer

A modern, minimalist web application that analyzes song lyrics to determine mood, vibe, and emotional insights. Built with Next.js, TypeScript, and Tailwind CSS.

## ✨ Features

- **Mood & Vibe Analysis**: Determines the emotional tone and atmosphere of song lyrics
- **Multi-Language Support**: Automatically detects and translates non-English lyrics for analysis
- **Detailed Insights**: Provides comprehensive analysis that becomes more detailed with longer lyric inputs
- **Modern UI**: Clean, professional, and highly intuitive interface
- **Real-time Analysis**: Fast processing with immediate results
- **Theme Detection**: Identifies key themes present in the lyrics
- **Sentiment Analysis**: Evaluates the overall emotional sentiment
- **Energy Level**: Assesses the energy and intensity of the song

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/roni-altshuler/SongAnalyzer.git
cd SongAnalyzer
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up environment variables:
```bash
cp .env.example .env
```

Add your Hugging Face API token to `.env` for enhanced translation features (optional):
```
HUGGINGFACE_API_KEY=your_token_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🎯 Usage

1. **Paste Lyrics**: Copy and paste full or partial song lyrics into the text area
2. **Analyze**: Click the "Analyze Lyrics" button or press Cmd/Ctrl+Enter
3. **View Results**: See the mood, vibe, energy level, sentiment, themes, and detailed analysis
4. **Multi-Language**: Non-English lyrics are automatically detected and analyzed

### Tips for Best Results

- Paste **full song lyrics** for the most detailed and accurate analysis
- Partial lyrics work too, but provide less comprehensive insights
- The app supports multiple languages with automatic translation
- More lyrics = more detailed analysis and higher confidence scores

## 🛠️ Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI/ML**: Hugging Face Inference (optional for translation)
- **Deployment**: Vercel-ready

## 📊 Analysis Components

The analyzer evaluates lyrics across multiple dimensions:

1. **Mood**: Emotional state (e.g., Melancholic, Euphoric, Peaceful)
2. **Vibe**: Overall atmosphere (e.g., Upbeat, Moody, Tranquil)
3. **Energy**: Intensity level (e.g., Very High, Moderate, Low)
4. **Sentiment**: Emotional direction (e.g., Positive, Negative, Neutral)
5. **Themes**: Key topics and subjects (e.g., Love, Hope, Nostalgia)
6. **Detailed Analysis**: Comprehensive narrative explaining the emotional journey

## 🌍 Multi-Language Support

The app includes built-in language detection for:
- Spanish, French, German, Italian, Portuguese
- Russian, Chinese, Japanese, Korean
- Arabic, Hebrew
- And more...

When a non-English language is detected, the app can translate it for analysis (requires Hugging Face API key for full translation features).

## 🏗️ Project Structure

```
SongAnalyzer/
├── app/
│   ├── api/
│   │   ├── analyze/     # Main analysis endpoint
│   │   └── translate/   # Translation endpoint
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main page component
├── public/              # Static assets
├── .env.example         # Environment variables template
├── next.config.js       # Next.js configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## 🚢 Deployment

The app is ready for deployment on Vercel:

```bash
npm run build
```

Or deploy with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roni-altshuler/SongAnalyzer)

## 📝 License

ISC

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 👤 Author

**Roni Altshuler**

---

Made with ❤️ using Next.js and Tailwind CSS