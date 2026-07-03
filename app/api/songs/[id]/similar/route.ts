/**
 * GET /api/songs/[id]/similar — "feels like this" nearest neighbours by
 * sonic vector (pgvector cosine distance via the `match_similar_songs` RPC).
 *
 * `[id]` is the **database song uuid** (see the features route note).
 *
 * Always 200: `{ songs: [...], reason? }`. A song without a vector, an
 * unconfigured store, or an RPC failure all return an empty list with a
 * reason — the rail simply doesn't render.
 */

import { NextRequest, NextResponse } from 'next/server';

import { isFingerprintStoreConfigured } from '@/lib/fingerprint/match';
import { isUuid } from '@/lib/fingerprint/validate';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export interface SimilarSongHit {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  previewUrl?: string;
  /** Cosine distance — lower is more similar. */
  distance: number;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ songs: [], reason: 'invalid_song_id' });
  }

  if (!isFingerprintStoreConfigured()) {
    return NextResponse.json({ songs: [], reason: 'store_unavailable' });
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '8');
  const matchLimit = Number.isFinite(limitParam)
    ? Math.min(24, Math.max(1, Math.round(limitParam)))
    : 8;

  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.rpc('match_similar_songs', {
      source_song: id,
      match_limit: matchLimit,
    });
    if (error) throw new Error(error.message);

    const songs: SimilarSongHit[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      coverUrl: row.cover_url ?? undefined,
      previewUrl: row.preview_url ?? undefined,
      distance: Number(row.distance.toFixed(4)),
    }));

    return NextResponse.json(
      { songs },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (err) {
    console.error('songs/[id]/similar error:', err);
    return NextResponse.json({ songs: [], reason: 'store_error' });
  }
}
