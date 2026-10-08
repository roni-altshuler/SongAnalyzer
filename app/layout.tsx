import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { MoodThemeProvider } from './providers/mood-theme-provider';
import { Toaster } from './components/ui/Toast';
import NavBar from './components/shell/NavBar';
import SiteFooter from './components/shell/SiteFooter';
import ThemeScript from './components/ThemeScript';

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
  title: 'SongAnalyzer — Identify Songs & Decode Their Mood',
  description:
    'Explore tracks and artist credits, read lyrics, and measure permitted local audio. Compare estimated mood insights and listen to selected passages.',
  // Favicon: Next.js auto-detects app/icon.svg, no explicit `icons` field
  // needed. The previous inline 🎵 emoji icon felt cartoony; the SVG at
  // app/icon.svg is the spectrum-bars mark from the design system.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Apply a valid saved choice or system preference before first paint.
            A blocked store must not prevent theme initialization. */}
        <ThemeScript />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* MoodThemeProvider exposes setMoodColor() and writes --accent-* vars
            to <html>. Wrapping it OUTSIDE ThemeProvider so the mood accents
            survive light/dark toggles. */}
        <MoodThemeProvider>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <NavBar />
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </div>
          </ThemeProvider>
        </MoodThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
