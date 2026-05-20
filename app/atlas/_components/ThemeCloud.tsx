/**
 * Lightweight weighted theme cloud.
 *
 * Server-renderable — just sized spans. We intentionally avoid a tag-cloud
 * library because the math is trivial and the bundle savings matter on a
 * dashboard route that already pays for Recharts.
 *
 * The font size for each theme is a linear interpolation between
 * `min` and `max` rem values, weighted by `count / maxCount`.
 */

import type { ThemeSlice } from '@/lib/atlas/queries';

export interface ThemeCloudProps {
  themes: ThemeSlice[];
  /** Maximum entries to show; defaults to 24. */
  limit?: number;
  /** Smallest font size in rem. */
  minRem?: number;
  /** Largest font size in rem. */
  maxRem?: number;
}

export function ThemeCloud({
  themes,
  limit = 24,
  minRem = 0.875,
  maxRem = 1.875,
}: ThemeCloudProps) {
  if (themes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-low)]">
        No recurring themes yet.
      </p>
    );
  }

  const sliced = themes.slice(0, limit);
  const maxCount = sliced[0]?.count ?? 1;
  const minCount = sliced[sliced.length - 1]?.count ?? 1;
  const range = Math.max(1, maxCount - minCount);

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
      {sliced.map((slice) => {
        const weight = (slice.count - minCount) / range;
        const size = minRem + (maxRem - minRem) * weight;
        const opacity = 0.55 + 0.45 * weight;
        return (
          <span
            key={slice.theme}
            className="font-display leading-tight transition-colors hover:text-[var(--accent-from)]"
            style={{
              fontSize: `${size.toFixed(3)}rem`,
              color: `color-mix(in oklab, var(--text-hi) ${(opacity * 100).toFixed(0)}%, var(--text-low))`,
            }}
            title={`${slice.theme} — ${slice.count} ${
              slice.count === 1 ? 'analysis' : 'analyses'
            }`}
          >
            {slice.theme}
          </span>
        );
      })}
    </div>
  );
}
