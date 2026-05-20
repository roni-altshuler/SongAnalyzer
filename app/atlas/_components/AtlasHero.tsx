/**
 * Top-of-page hero banner for the Mood Atlas.
 *
 * Server-renderable. Uses the page-default accent variables so it picks
 * up the brand gradient — the per-genre / per-artist subpages can lift
 * the accent locally if they want a different feel.
 */

export interface AtlasHeroProps {
  totalAnalyses: number;
  totalArtists: number;
  totalMoods: number;
  /** Optional subtitle override; default reads as the canonical description. */
  subtitle?: string;
  /** Optional eyebrow text shown above the headline. */
  eyebrow?: string;
}

export function AtlasHero({
  totalAnalyses,
  totalArtists,
  totalMoods,
  subtitle,
  eyebrow,
}: AtlasHeroProps) {
  const formattedSubtitle =
    subtitle ??
    'A cross-catalog view of how songs feel — mood distributions by genre, artist timelines, and the themes that recur across the dataset.';

  return (
    <header className="relative isolate overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] px-8 py-14 sm:px-12 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60% 80% at 25% 30%, color-mix(in oklab, var(--accent-from) 28%, transparent) 0%, transparent 70%),' +
            'radial-gradient(45% 55% at 80% 70%, color-mix(in oklab, var(--accent-to) 22%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--text-low)]">
          {eyebrow ?? 'Music Research Dashboard'}
        </p>
        <h1 className="font-display mt-3 text-balance text-5xl leading-[0.95] text-[var(--text-hi)] sm:text-6xl">
          The Mood{' '}
          <span className="text-accent-gradient">Atlas</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-med)]">
          {formattedSubtitle}
        </p>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm text-[var(--text-med)]">
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--text-low)]">
              Analyses
            </dt>
            <dd className="font-mono text-2xl text-[var(--text-hi)]">
              {totalAnalyses.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--text-low)]">
              Artists
            </dt>
            <dd className="font-mono text-2xl text-[var(--text-hi)]">
              {totalArtists.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--text-low)]">
              Moods catalogued
            </dt>
            <dd className="font-mono text-2xl text-[var(--text-hi)]">
              {totalMoods.toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
