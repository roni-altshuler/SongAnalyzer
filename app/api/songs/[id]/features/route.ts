/**
 * POST /api/songs/[id]/features — persist a song's v2 audio features and
 * sonic vector for similarity search.
 *
 * NOTE: unlike the parent `GET /api/songs/[id]` (which takes a Spotify track
 * ID), `[id]` here is the **database song uuid** — the one returned by
 * `POST /api/analyses` or `/api/identify`. A Spotify ID fails the uuid check
 * with a clear 400.
 *
 * Body: `{ vector: number[48], version: string, features?: object }`
 * First write wins per extractor version: an existing vector with the same
 * version is never overwritten by an anonymous client (poisoning posture,
 * mirroring fingerprint ingest).
 */

import { NextRequest, NextResponse } from 'next/server';

import { EXTRACTOR_VERSION, isValidSonicVector } from '@/lib/audio/vector';
import { isFingerprintStoreConfigured } from '@/lib/fingerprint/match';
import { isUuid } from '@/lib/fingerprint/validate';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';
import { getAdminSupabase } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

const MAX_FEATURES_BYTES = 50_000;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const limit = await rateLimit('fingerprints', clientIpFrom(request));
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_song_id' }, { status: 400 });
  }

  let body: { vector?: unknown; version?: unknown; features?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!isValidSonicVector(body.vector)) {
    return NextResponse.json({ error: 'invalid_vector' }, { status: 400 });
  }
  if (body.version !== EXTRACTOR_VERSION) {
    return NextResponse.json({ error: 'unknown_extractor_version' }, { status: 400 });
  }

  let features: Json | null = null;
  if (body.features !== undefined) {
    if (
      !body.features ||
      typeof body.features !== 'object' ||
      Array.isArray(body.features) ||
      JSON.stringify(body.features).length > MAX_FEATURES_BYTES
    ) {
      return NextResponse.json({ error: 'invalid_features' }, { status: 400 });
    }
    features = body.features as Json;
  }

  if (!isFingerprintStoreConfigured()) {
    return NextResponse.json({ status: 'store_unavailable' });
  }

  try {
    const supabase = getAdminSupabase();

    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select('id, sonic_vector_version')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!song) return NextResponse.json({ status: 'unknown_song' });

    if (song.sonic_vector_version === EXTRACTOR_VERSION) {
      return NextResponse.json({ status: 'already_set' });
    }

    const { error: updateError } = await supabase
      .from('songs')
      .update({
        sonic_vector: body.vector,
        sonic_vector_version: EXTRACTOR_VERSION,
        ...(features !== null ? { audio_features_v2: features } : {}),
      })
      .eq('id', id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('songs/[id]/features error:', err);
    return NextResponse.json({ status: 'store_error' });
  }
}
