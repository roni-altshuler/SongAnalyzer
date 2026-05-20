import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAnalysisBySlug } from '@/lib/db/analyses';
import { getSongById } from '@/lib/db/songs';
import { incrementViewCount } from '@/lib/db/shares';
import { moodToColor } from '@/lib/analysis/palette';
import type { AnalysisResult, EngineProvenance as EngineProvenanceType } from '@/lib/types';
import SongHero from '@/app/components/SongHero';
import EngineProvenance from '@/app/components/EngineProvenance';
import MoodRadarV2 from '@/app/components/MoodRadarV2';
import ShareFooter from './ShareFooter';
import { Card, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Meter } from '@/app/components/ui/Meter';
import { extractOgPayload } from './og-data';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Read the `result` jsonb off an analyses row and coerce it to the in-app
 * `AnalysisResult` shape. The DB stores a looser `AnalysisResultJson` so we
 * defensively normalize fields here.
 */
function asAnalysisResult(result: unknown): AnalysisResult {
  const r = (result ?? {}) as Record<string, unknown>;
  return {
    mood: typeof r.mood === 'string' ? r.mood : 'Contemplative',
    vibe: typeof r.vibe === 'string' ? r.vibe : 'Reflective',
    energy: typeof r.energy === 'string' ? r.energy : 'Moderate',
    sentiment: typeof r.sentiment === 'string' ? r.sentiment : 'Neutral/Mixed',
    themes: Array.isArray(r.themes)
      ? (r.themes as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
    detailedAnalysis:
      typeof r.detailedAnalysis === 'string' ? r.detailedAnalysis : '',
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
    wordCount: typeof r.wordCount === 'number' ? r.wordCount : 0,
    originalLanguage:
      typeof r.originalLanguage === 'string' ? r.originalLanguage : undefined,
    translated: typeof r.translated === 'boolean' ? r.translated : undefined,
    engines: (r.engines as EngineProvenanceType | undefined) ?? undefined,
    moodColor:
      r.moodColor &&
      typeof r.moodColor === 'object' &&
      'from' in (r.moodColor as object) &&
      'to' in (r.moodColor as object)
        ? (r.moodColor as { from: string; to: string; glow: string })
        : undefined,
  };
}

/**
 * Fail-soft wrapper around `getAnalysisBySlug`. When Supabase env vars are
 * missing or the table is unreachable we treat that as "not found" so the
 * page 404s cleanly instead of 500-ing. This matches the atlas pages'
 * behavior and keeps dev-without-Supabase usable.
 */
async function tryGetAnalysis(slug: string) {
  try {
    return await getAnalysisBySlug(slug);
  } catch (err) {
    console.warn('[share] getAnalysisBySlug failed:', err);
    return null;
  }
}

async function tryGetSong(id: string) {
  try {
    return await getSongById(id);
  } catch (err) {
    console.warn('[share] getSongById failed:', err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const analysis = await tryGetAnalysis(slug);
  if (!analysis || !analysis.is_public) {
    return { title: 'Share not found · Song Analyzer' };
  }

  const song = analysis.song_id ? await tryGetSong(analysis.song_id) : null;
  const payload = extractOgPayload(analysis, song);

  const titleText = song
    ? `${payload.title} — ${payload.artist} · ${payload.mood} · Song Analyzer`
    : `${payload.mood} · Song Analyzer`;

  return {
    title: titleText,
    description: `Mood: ${payload.mood} · Vibe: ${payload.vibe} · Sentiment: ${payload.sentiment}`,
    openGraph: {
      title: titleText,
      description: `Mood: ${payload.mood} · Vibe: ${payload.vibe}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description: `Mood: ${payload.mood} · Vibe: ${payload.vibe}`,
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { slug } = await params;

  const analysis = await tryGetAnalysis(slug);
  if (!analysis || !analysis.is_public) {
    notFound();
  }

  // Best-effort view count bump (don't 500 the page on a shares-table write error).
  try {
    await incrementViewCount(analysis.id);
  } catch (err) {
    console.warn('[share] incrementViewCount failed:', err);
  }

  const song = analysis.song_id ? await tryGetSong(analysis.song_id) : null;
  const result = asAnalysisResult(analysis.result);
  const moodColor = result.moodColor ?? moodToColor(result.mood);

  // Build a Spotify / Genius external link if we have IDs on the resolved song.
  const spotifyUrl = song?.spotify_id
    ? `https://open.spotify.com/track/${song.spotify_id}`
    : null;
  const geniusUrl = song?.genius_id
    ? `https://genius.com/songs/${song.genius_id}`
    : null;

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-hi)]"
      // Set initial accent server-side so the gradient feels right before
      // SongHero's client-side vibrant pass takes over.
      style={{
        ['--accent-from' as string]: moodColor.from,
        ['--accent-to' as string]: moodColor.to,
        ['--accent-glow' as string]: moodColor.glow ?? 'rgba(99, 102, 241, 0.35)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in_oklab, var(--accent-glow) 70%, transparent), transparent 60%)',
        }}
      />

      <div className="container mx-auto px-4 pt-16 pb-16 max-w-4xl space-y-8">
        {song ? (
          <SongHero
            title={song.title}
            artist={song.artist}
            album={song.album}
            coverUrl={song.cover_url}
            previewUrl={song.preview_url}
          />
        ) : (
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--text-low)]">
              Shared analysis
            </p>
            <h1 className="font-display text-5xl text-[var(--text-hi)]">
              {result.mood}
            </h1>
          </header>
        )}

        <Card variant="glow" className="space-y-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
                  boxShadow: '0 0 12px var(--accent-glow)',
                }}
              />
              <CardTitle>Analysis</CardTitle>
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Mood', value: result.mood },
              { label: 'Vibe', value: result.vibe },
              { label: 'Energy', value: result.energy },
              { label: 'Sentiment', value: result.sentiment },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl px-4 py-3.5 border border-[var(--border-subtle)] bg-[var(--bg-elev2)] ring-inset-soft"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-1.5">
                  {s.label}
                </p>
                <p className="font-display text-xl text-[var(--text-hi)] leading-tight">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {result.themes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
                Themes
              </p>
              <div className="flex flex-wrap gap-2">
                {result.themes.map((theme, i) => (
                  <Badge key={i} variant="default">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.detailedAnalysis && (
            <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
                Reading
              </p>
              <p className="text-sm text-[var(--text-med)] leading-relaxed whitespace-pre-line">
                {result.detailedAnalysis}
              </p>
            </div>
          )}

          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-low)]">
              {result.wordCount > 0 && (
                <span>
                  <span className="font-mono text-[var(--text-med)]">
                    {result.wordCount}
                  </span>{' '}
                  words
                </span>
              )}
              <span className="uppercase tracking-[0.18em]">
                Confidence{' '}
                <span className="font-mono text-[var(--text-med)]">
                  {Math.round(result.confidence * 100)}%
                </span>
              </span>
            </div>
            <Meter value={result.confidence} ariaLabel="Analysis confidence" />
            {result.engines && (
              <div className="pt-1">
                <EngineProvenance engines={result.engines} />
              </div>
            )}
          </div>
        </Card>

        <Card variant="elev1">
          <MoodRadarV2
            energy={result.energy}
            sentiment={result.sentiment}
            mood={result.mood}
            vibe={result.vibe}
            themes={result.themes}
          />
        </Card>

        <ShareFooter
          slug={slug}
          spotifyUrl={spotifyUrl}
          geniusUrl={geniusUrl}
        />
      </div>
    </main>
  );
}
