import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { getSpotifyTrack, isSpotifyConfigured } from '@/lib/sources/spotify';
import { getAcousticBrainzFeatures } from '@/lib/sources/acousticbrainz';
import { searchGenius } from '@/lib/sources/genius';
import { searchMusicBrainz } from '@/lib/sources/musicbrainz';
import type { Song } from '@/lib/sources/types';

/**
 * GET /api/songs/[id]
 *
 * `id` is a **Spotify track ID** — we treat Spotify as the canonical
 * identity space here because it's the only source guaranteed to give us
 * preview audio + cover art together.
 *
 * Required env vars:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   (GENIUS_ACCESS_TOKEN is optional — gracefully skipped if missing)
 *
 * Behaviour:
 *   - 503 `{ error: 'spotify_not_configured' }` when Spotify env vars are
 *     missing — same shape as `/search` so the client treats both uniformly.
 *   - 502 on upstream failure of the mandatory Spotify lookup.
 *   - 200 with the fully resolved `Song` otherwise. Enrichment failures
 *     (MB/AB/Genius) are silently logged; partial results are normal.
 *   - Result is wrapped in `unstable_cache` keyed by the Spotify ID with a
 *     24h TTL, and also served with `s-maxage=3600 / stale-while-revalidate=
 *     86400` so the CDN does the heavy lifting on repeat reads.
 */

/**
 * Build the resolved Song from a known Spotify ID. We do this *without* the
 * full `resolveSong()` because we already have the canonical id — no need
 * to re-run the Spotify search step.
 */
async function buildSong(id: string): Promise<Song> {
  const base = await getSpotifyTrack(id);

  const enrichQuery = `${base.title} ${base.artist}`;

  const [mbidAndFeatures, geniusId] = await Promise.all([
    (async (): Promise<{ mbid?: string; acousticFeatures?: Song['acousticFeatures'] }> => {
      try {
        const hits = await searchMusicBrainz(enrichQuery);
        const best = hits[0];
        if (!best) return {};
        const features = await getAcousticBrainzFeatures(best.recordingId).catch(() => null);
        return { mbid: best.recordingId, acousticFeatures: features ?? undefined };
      } catch (err) {
        console.warn('songs/[id]: MusicBrainz enrich failed', err);
        return {};
      }
    })(),
    (async (): Promise<number | undefined> => {
      try {
        const hits = await searchGenius(enrichQuery);
        return hits[0]?.song.geniusId;
      } catch (err) {
        console.warn('songs/[id]: Genius enrich failed', err);
        return undefined;
      }
    })(),
  ]);

  return {
    ...base,
    mbid: mbidAndFeatures.mbid,
    acousticFeatures: mbidAndFeatures.acousticFeatures,
    geniusId,
  };
}

/**
 * Per-id wrapper around `unstable_cache`. The cache key includes the id so
 * each Spotify track gets its own 24h slot.
 */
function getCachedSong(id: string): Promise<Song> {
  return unstable_cache(
    async () => buildSong(id),
    ['songs-by-id', id],
    { revalidate: 86400, tags: [`song:${id}`] },
  )();
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: 'spotify_not_configured' },
      { status: 503 },
    );
  }

  try {
    const song = await getCachedSong(id);
    return NextResponse.json(song, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('songs/[id] error:', err);
    return NextResponse.json({ error: 'resolve_failed' }, { status: 502 });
  }
}
