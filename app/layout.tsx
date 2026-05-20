import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { MoodThemeProvider } from './providers/mood-theme-provider';
import { Toaster } from './components/ui/Toast';

// Display serif for hero/editorial headings (Apple-Music-style)
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

// Body sans
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Numeric / debug mono (BPM, key, confidence values)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Song Analyzer — Lyrics & Audio Mood Detection',
  description:
    'Analyze song lyrics or audio files to determine mood, vibe, energy, and emotional insights',
  icons: {
    icon:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎵</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Set dark/light class BEFORE first paint to avoid FOUC.
            Dark is the brand default; `.light` is only applied if the user opted in. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  // Dark is the brand. Respect saved preference; otherwise honor
                  // the system pref (kept in sync with the existing ThemeProvider).
                  var useDark = saved ? saved === 'dark' : prefersDark;
                  var root = document.documentElement;
                  if (useDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                  } else {
                    root.classList.add('light');
                    root.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* MoodThemeProvider exposes setMoodColor() and writes --accent-* vars
            to <html>. Wrapping it OUTSIDE ThemeProvider so the mood accents
            survive light/dark toggles. */}
        <MoodThemeProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </MoodThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
