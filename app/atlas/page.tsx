/**
 * /atlas — public Mood Atlas overview dashboard.
 *
 * Server component. Aggregates across every visible (`is_public OR
 * system_seed`) analysis. Cached for 1 hour — the data is materialized-
 * view-backed so changes only land when an admin re-runs
 * `refresh_atlas_aggregates()`, and an hour of staleness is well within
 * the dashboard's expected freshness.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { getAtlasOverview } from '@/lib/atlas/queries';
import { AtlasHero } from './_components/AtlasHero';
import { GenreTile } from './_components/GenreTile';
import { MoodDistributionChart } from './_components/MoodDistributionChart';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'The Mood Atlas — SongAnalyzer',
  description:
    'A cross-catalog view of how songs feel — mood distributions by genre, top artists, and recurring themes.',
};

/**
 * Fail-soft (CLAUDE.md contract): a broken/misconfigured Supabase connection
 * renders the empty-state Atlas, never a 500.
 */
async function tryGetOverview() {
  try {
    return await getAtlasOverview();
  } catch (err) {
    console.error('[atlas] getAtlasOverview failed:', err);
    return {
      totalAnalyses: 0,
      totalArtists: 0,
      moodDistribution: [],
      genreDistribution: [],
      topArtists: [],
    };
  }
}

export default async function AtlasPage() {
  const overview = await tryGetOverview();

  const empty = overview.totalAnalyses === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <AtlasHero
        totalAnalyses={overview.totalAnalyses}
        totalArtists={overview.totalArtists}
        totalMoods={overview.moodDistribution.length}
      />

      {empty ? (
        <EmptyAtlas />
      ) : (
        <div className="mt-10 space-y-10">
          {/* Global mood distribution */}
          <section aria-labelledby="atlas-moods-heading">
            <Card variant="elev1">
              <CardHeader>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                    Across the catalog
                  </p>
                  <CardTitle id="atlas-moods-heading">Mood distribution</CardTitle>
                </div>
                <Badge variant="outline">
                  {overview.totalAnalyses.toLocaleString()} analyses
                </Badge>
              </CardHeader>
              <CardContent>
                <MoodDistributionChart
                  data={overview.moodDistribution.map((slice) => ({
                    mood: slice.mood,
                    count: slice.count,
                  }))}
                />
              </CardContent>
            </Card>
          </section>

          {/* Genre tiles */}
          <section aria-labelledby="atlas-genres-heading">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                  Browse by genre
                </p>
                <h2
                  id="atlas-genres-heading"
                  className="font-display text-3xl text-[var(--text-hi)]"
                >
                  Genres
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.genreDistribution.map((slice) => (
                <GenreTile key={slice.genre} slice={slice} />
              ))}
            </div>
          </section>

          {/* Top artists */}
          <section aria-labelledby="atlas-artists-heading">
            <Card variant="elev1">
              <CardHeader>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
                    Most-analyzed
                  </p>
                  <CardTitle id="atlas-artists-heading">Top artists</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="divide-y divide-[var(--border-subtle)]">
                  {overview.topArtists.map((artist, index) => (
                    <li
                      key={artist.artist}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="font-mono text-sm text-[var(--text-low)] w-6 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${artist.color.from}, ${artist.color.to})`,
                        }}
                      />
                      <Link
                        href={`/atlas/artist/${artist.artistSlug}`}
                        className="flex-1 font-medium text-[var(--text-hi)] hover:text-[var(--accent-from)] transition-colors"
                      >
                        {artist.artist}
                      </Link>
                      <span className="text-xs uppercase tracking-wider text-[var(--text-low)]">
                        {artist.dominantMood}
                      </span>
                      <span className="font-mono text-sm text-[var(--text-med)] tabular-nums">
                        {artist.count}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}

function EmptyAtlas() {
  return (
    <Card variant="elev1" className="mt-10">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
            Cold start
          </p>
          <CardTitle>No analyses yet</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[var(--text-med)] leading-relaxed">
          The Mood Atlas is empty. If you&rsquo;re running locally,
          regenerate and apply the seed:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 text-xs leading-relaxed text-[var(--text-med)]">
{`npx tsx lib/seeds/build-seed-sql.ts > supabase/seed.sql
npx supabase db reset
# then, in the SQL editor:
select public.refresh_atlas_aggregates();`}
        </pre>
        <p className="mt-4 text-sm text-[var(--text-low)]">
          Once analyses are public, this dashboard rolls them up by mood,
          genre, artist, and year.
        </p>
      </CardContent>
    </Card>
  );
}
