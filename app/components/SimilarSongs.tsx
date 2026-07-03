'use client';

/**
 * "Feels like this" — nearest-neighbour rail backed by the sonic-vector
 * similarity RPC (`/api/songs/[id]/similar`).
 *
 * Renders nothing until the song has a persisted vector and at least one
 * neighbour exists (the endpoint is always-200 fail-soft). Clicking a card
 * hands the song to the shared analysis pipeline via `onPick`.
 */

import { useEffect, useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import { cn } from '@/lib/cn';
import type { SongMeta } from '@/app/hooks/useSongAnalysis';

interface SimilarHit {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  previewUrl?: string;
  distance: number;
}

interface SimilarSongsProps {
  songId: string | null;
  onPick?: (song: SongMeta) => void;
  className?: string;
}

export default function SimilarSongs({ songId, onPick, className }: SimilarSongsProps) {
  // Keyed by songId so stale results never render for a newer song — and no
  // synchronous state reset is needed when the id changes.
  const [result, setResult] = useState<{ songId: string; hits: SimilarHit[] } | null>(null);

  useEffect(() => {
    if (!songId) return;

    const controller = new AbortController();
    fetch(`/api/songs/${songId}/similar`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { songs: [] }))
      .then((data: { songs?: SimilarHit[] }) => setResult({ songId, hits: data.songs ?? [] }))
      .catch(() => undefined);

    return () => controller.abort();
  }, [songId]);

  const hits = result && result.songId === songId ? result.hits : [];
  if (hits.length === 0) return null;

  return (
    <Card variant="elev1" className={cn('space-y-3', className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
          Feels like this
        </p>
        <p className="text-[10px] text-[var(--text-low)]">by sonic fingerprint</p>
      </div>

      <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {hits.map((hit) => {
          const similarity = Math.round(Math.max(0, 1 - hit.distance) * 100);
          return (
            <li key={hit.id} className="shrink-0">
              <button
                type="button"
                onClick={() =>
                  onPick?.({
                    title: hit.title,
                    artist: hit.artist,
                    coverUrl: hit.coverUrl,
                    previewUrl: hit.previewUrl,
                  })
                }
                className={cn(
                  'group w-36 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] p-2.5 text-left',
                  'transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
                  'hover:border-[color-mix(in_oklab,var(--accent-from)_45%,var(--border-strong))]',
                  'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
                )}
              >
                {hit.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hit.coverUrl}
                    alt=""
                    className="mb-2 aspect-square w-full rounded-lg border border-[var(--border-subtle)] object-cover"
                  />
                ) : (
                  <div className="mb-2 aspect-square w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elev3)]" />
                )}
                <p className="truncate text-xs text-[var(--text-hi)]">{hit.title}</p>
                <p className="truncate text-[11px] text-[var(--text-med)]">{hit.artist}</p>
                <p className="mt-1 font-mono text-[10px] text-[var(--text-low)]">
                  {similarity}% similar
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
