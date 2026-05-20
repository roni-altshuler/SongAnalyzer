/**
 * Clickable tile linking to `/atlas/genre/<slug>`.
 *
 * Server-renderable wrapper around a Card that swaps its accent palette to
 * the genre's dominant mood color via inline CSS variables — this gives
 * every tile its own personality at the cost of one extra inline style.
 */

import Link from 'next/link';
import type { GenreSlice } from '@/lib/atlas/queries';
import { slugify } from '@/lib/atlas/slug';

export interface GenreTileProps {
  slice: GenreSlice;
}

export function GenreTile({ slice }: GenreTileProps) {
  const href = `/atlas/genre/${slugify(slice.genre)}`;
  const { color } = slice;

  // We render a bare <a> + <div> instead of using <Card> directly so we can
  // scope the accent palette locally without leaking it into the page's
  // mood-theme provider.
  return (
    <Link
      href={href}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-from)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
      style={
        {
          ['--accent-from' as string]: color.from,
          ['--accent-to' as string]: color.to,
          ['--accent-glow' as string]: color.glow,
        } as React.CSSProperties
      }
    >
      <div
        className={[
          'rounded-2xl p-6',
          'bg-[var(--bg-elev1)]',
          'border border-[var(--border-subtle)]',
          'ring-inset-soft',
          'transition-[transform,border-color,box-shadow] duration-300',
          '[transition-timing-function:var(--ease-out)]',
          'group-hover:-translate-y-0.5',
          'group-hover:border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))]',
          'group-hover:shadow-[0_0_30px_var(--accent-glow)]',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-[var(--text-low)]">
              Genre
            </p>
            <h3 className="font-display text-2xl text-[var(--text-hi)]">
              {slice.genre}
            </h3>
          </div>
          <div
            aria-hidden
            className="h-12 w-12 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
              boxShadow: `0 0 20px ${color.glow}`,
            }}
          />
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
          <span className="text-sm text-[var(--text-med)]">
            <span className="font-mono text-[var(--text-hi)]">{slice.count}</span>{' '}
            {slice.count === 1 ? 'analysis' : 'analyses'}
          </span>
          <span className="text-xs uppercase tracking-wider text-[var(--text-low)]">
            mostly{' '}
            <span className="text-[var(--accent-from)]">{slice.dominantMood}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
