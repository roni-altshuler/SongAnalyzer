/**
 * /atlas/genre/[name] — per-genre Mood Atlas.
 *
 * Server component. 404 if the slug doesn't resolve to a canonical
 * atlas genre. Shows: mood distribution, top artists in the genre, and a
 * weighted theme cloud.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { getGenreAtlas } from '@/lib/atlas/queries';
import { deslugifyGenre } from '@/lib/atlas/slug';
import { AtlasHero } from '../../_components/AtlasHero';
import { MoodDistributionChart } from '../../_components/MoodDistributionChart';
import { ThemeCloud } from '../../_components/ThemeCloud';

export const revalidate = 3600;

interface PageParams {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { name } = await params;
  const genre = deslugifyGenre(name);
  if (!genre) return { title: 'Genre not found — Mood Atlas' };
  return {
    title: `${genre} — Mood Atlas`,
    description: `Mood distribution, top artists, and themes for the ${genre} genre.`,
  };
}

export default async function GenreAtlasPage({ params }: PageParams) {
  const { name } = await params;
  const canonicalGenre = deslugifyGenre(name);
  if (!canonicalGenre) notFound();

  // Fail-soft: a broken Supabase connection renders the empty state, not a 500.
  const atlas = await getGenreAtlas(canonicalGenre).catch((err) => {
    console.error('[atlas/genre] getGenreAtlas failed:', err);
    return null;
  });

  // Genre may resolve canonically but still have zero rows in this DB.
  // Render an empty-state Card rather than a 404 so the page is still
  // helpful (canonical genre + setup hint).
  const empty = !atlas || atlas.analyses.length === 0;

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
        eyebrow="Genre profile"
        totalAnalyses={atlas?.analyses.length ?? 0}
        totalArtists={atlas?.topArtists.length ?? 0}
        totalMoods={atlas?.moodDistribution.length ?? 0}
        subtitle={`Mood breakdown, top artists, and recurring themes across the ${canonicalGenre} genre.`}
      />

      {empty || !atlas ? (
        <Card variant="elev1" className="mt-10">
          <CardHeader>
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                Empty genre
              </p>
              <CardTitle>No {canonicalGenre} analyses yet</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[var(--text-med)]">
              When public analyses tagged{' '}
              <Badge variant="mood">{canonicalGenre}</Badge> land, the
              breakdown will populate automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <Card variant="elev1">
              <CardHeader>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                    Distribution
                  </p>
                  <CardTitle>Moods in {canonicalGenre}</CardTitle>
                </div>
                <Badge variant="outline">
                  {atlas.analyses.length} analyses
                </Badge>
              </CardHeader>
              <CardContent>
                <MoodDistributionChart
                  data={atlas.moodDistribution.map((slice) => ({
                    mood: slice.mood,
                    count: slice.count,
                  }))}
                />
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="elev1">
              <CardHeader>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                    Top artists
                  </p>
                  <CardTitle>In {canonicalGenre}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="divide-y divide-[var(--border-subtle)]">
                  {atlas.topArtists.map((artist, index) => (
                    <li
                      key={artist.artist}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="font-mono text-xs text-[var(--text-low)] w-5 tabular-nums">
                        {index + 1}
                      </span>
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${artist.color.from}, ${artist.color.to})`,
                        }}
                      />
                      <Link
                        href={`/atlas/artist/${artist.artistSlug}`}
                        className="flex-1 text-sm font-medium text-[var(--text-hi)] hover:text-[var(--accent-from)] transition-colors"
                      >
                        {artist.artist}
                      </Link>
                      <span className="font-mono text-xs text-[var(--text-med)] tabular-nums">
                        {artist.count}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </section>

          <section className="lg:col-span-3">
            <Card variant="elev1">
              <CardHeader>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                    Recurring
                  </p>
                  <CardTitle>Themes</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ThemeCloud themes={atlas.themeFrequency} />
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}
