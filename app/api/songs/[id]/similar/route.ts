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
  spotifyId?: string;
  geniusId?: number;
  metadataSource: 'catalog';
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

    // The RPC omits provider identity. Read item IDs separately for accurate
    // listening links; legacy rows still do not establish recording rights.
    const ids = (data ?? []).map((row) => row.id);
    const { data: identities, error: identityError } = ids.length
      ? await supabase.from('songs').select('id, spotify_id, genius_id').in('id', ids)
      : { data: [], error: null };
    if (identityError) throw new Error(identityError.message);
    const byId = new Map((identities ?? []).map((row) => [row.id, row]));

    const songs: SimilarSongHit[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      coverUrl: row.cover_url ?? undefined,
      metadataSource: 'catalog',
      spotifyId: byId.get(row.id)?.spotify_id ?? undefined,
      geniusId: byId.get(row.id)?.genius_id ?? undefined,
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
