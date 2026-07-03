/**
 * /atlas/artist/[slug] — per-artist Mood Atlas.
 *
 * Server component. 404 if the slug doesn't resolve to any visible
 * analyses. Shows: mood-over-time area chart of the artist's
 * discography, mood distribution radar (radial bar), and a clickable
 * list of their analyzed songs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { getArtistAtlas } from '@/lib/atlas/queries';
import { deslugifyArtist } from '@/lib/atlas/slug';
import { AtlasHero } from '../../_components/AtlasHero';
import { MoodDistributionChart } from '../../_components/MoodDistributionChart';
import { MoodTimelineChart } from '../../_components/MoodTimelineChart';

export const revalidate = 3600;

interface PageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const artist = await deslugifyArtist(slug);
  if (!artist) return { title: 'Artist not found — Mood Atlas' };
  return {
    title: `${artist} — Mood Atlas`,
    description: `Mood distribution and discography timeline for ${artist}, computed from public song analyses.`,
  };
}

export default async function ArtistAtlasPage({ params }: PageParams) {
  const { slug } = await params;
  const artistName = await deslugifyArtist(slug);
  if (!artistName) notFound();

  // Fail-soft: treat a broken Supabase connection like an unknown artist
  // (404) rather than a 500 — same tryGet pattern as the share page.
  const atlas = await getArtistAtlas(artistName).catch((err) => {
    console.error('[atlas/artist] getArtistAtlas failed:', err);
    return null;
  });
  if (!atlas) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <div className="mb-6">
        <Link
          href="/atlas"
          className="text-xs uppercase tracking-widest text-[var(--text-low)] hover:text-[var(--accent-from)] transition-colors"
        >
          ← Back to atlas
        </Link>
      </div>

      <AtlasHero
        eyebrow="Artist profile"
        totalAnalyses={atlas.analyses.length}
        totalArtists={1}
        totalMoods={atlas.moodDistribution.length}
        subtitle={`${atlas.analyses.length} ${
          atlas.analyses.length === 1 ? 'analysis' : 'analyses'
        } catalogued for ${atlas.artist}. Average confidence ${(
          atlas.avgConfidence * 100
        ).toFixed(0)}%.`}
      />

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Mood timeline — wide */}
        <section className="lg:col-span-2">
          <Card variant="elev1">
            <CardHeader>
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                  Discography
                </p>
                <CardTitle>Mood over time</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <MoodTimelineChart data={atlas.moodOverTime} />
            </CardContent>
          </Card>
        </section>

        {/* Mood distribution — narrow */}
        <section>
          <Card variant="elev1">
            <CardHeader>
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                  Averaged
                </p>
                <CardTitle>Mood mix</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <MoodDistributionChart
                height={260}
                data={atlas.moodDistribution.map((slice) => ({
                  mood: slice.mood,
                  count: slice.count,
                }))}
              />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Song list */}
      <section className="mt-10" aria-labelledby="artist-songs-heading">
        <Card variant="elev1">
          <CardHeader>
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                Catalogued songs
              </p>
              <CardTitle id="artist-songs-heading">All analyses</CardTitle>
            </div>
            <Badge variant="outline">{atlas.analyses.length}</Badge>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-[var(--border-subtle)]">
              {atlas.analyses.map((row) => {
                const href = row.shareSlug ? `/share/${row.shareSlug}` : null;
                const titleNode = (
                  <span className="font-medium text-[var(--text-hi)]">
                    {row.title}
                  </span>
                );
                return (
                  <li
                    key={row.analysisId}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      {href ? (
                        <Link
                          href={href}
                          className="hover:text-[var(--accent-from)] transition-colors"
                        >
                          {titleNode}
                        </Link>
                      ) : (
                        titleNode
                      )}
                      {row.album && (
                        <span className="ml-3 text-sm text-[var(--text-low)]">
                          {row.album}
                        </span>
                      )}
                    </div>
                    {row.releaseYear && (
                      <span className="font-mono text-xs text-[var(--text-low)]">
                        {row.releaseYear}
                      </span>
                    )}
                    <Badge variant="mood">{row.mood}</Badge>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
