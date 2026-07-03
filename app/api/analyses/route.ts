/**
 * POST /api/analyses — persist a client-side analysis (audio / combined /
 * lyrics) so it can be shared, listed, and aggregated into the Atlas.
 *
 * This closes a long-standing gap: `/api/analyses/share` expects an
 * `analysisId`, but nothing created analysis rows for client-side results.
 *
 * Body:
 *   {
 *     mode: 'lyrics' | 'audio' | 'combined',
 *     result: AnalysisResult-shaped object (jsonb, size-capped),
 *     song?: { title, artist, album?, year?, coverUrl?, previewUrl?, spotifyId?, ... },
 *     lyricsExcerpt?: string (≤500 chars, mirrors the DB constraint),
 *     language?: string, translated?: boolean
 *   }
 *
 * When `song` is provided it is upserted server-side (the client never
 * writes to `songs` directly) and the analysis links to it. The response
 * includes the DB `songId`, which the client then uses for fingerprint
 * ingest (`/api/fingerprints`) and sonic-vector persistence
 * (`/api/songs/[id]/features`).
 *
 * Always 200 with a `status` discriminator once past validation; a missing
 * store degrades to `store_unavailable`, never a 5xx.
 */

import { NextRequest, NextResponse } from 'next/server';

import { createAnalysis } from '@/lib/db/analyses';
import { upsertSong } from '@/lib/db/songs';
import { songToInsert } from '@/lib/db/song-store-adapter';
import { isFingerprintStoreConfigured } from '@/lib/fingerprint/match';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';
import type { Song } from '@/lib/sources/types';
import { getServerSupabase } from '@/lib/supabase/server';
import type { AnalysisMode, AnalysisResultJson } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

const MAX_RESULT_BYTES = 40_000;
const MAX_EXCERPT_CHARS = 500;
const MODES: AnalysisMode[] = ['lyrics', 'audio', 'combined'];

interface AnalysesRequestBody {
  mode?: unknown;
  result?: unknown;
  song?: unknown;
  lyricsExcerpt?: unknown;
  language?: unknown;
  translated?: unknown;
}

function parseSong(value: unknown): Song | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null;
  if (typeof raw.artist !== 'string' || !raw.artist.trim()) return null;

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length <= 2_000 ? v : undefined;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  return {
    title: raw.title.slice(0, 500),
    artist: raw.artist.slice(0, 500),
    album: str(raw.album),
    year: num(raw.year),
    coverUrl: str(raw.coverUrl),
    previewUrl: str(raw.previewUrl),
    spotifyId: str(raw.spotifyId),
    geniusId: num(raw.geniusId),
    mbid: str(raw.mbid),
  };
}

export async function POST(request: NextRequest) {
  const limit = await rateLimit('analyze', clientIpFrom(request));
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: AnalysesRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.mode !== 'string' || !MODES.includes(body.mode as AnalysisMode)) {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  }
  const mode = body.mode as AnalysisMode;

  const result = body.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return NextResponse.json({ error: 'invalid_result' }, { status: 400 });
  }
  if (typeof (result as { mood?: unknown }).mood !== 'string') {
    return NextResponse.json({ error: 'result_missing_mood' }, { status: 400 });
  }
  if (JSON.stringify(result).length > MAX_RESULT_BYTES) {
    return NextResponse.json({ error: 'result_too_large' }, { status: 400 });
  }

  if (!isFingerprintStoreConfigured()) {
    return NextResponse.json({ status: 'store_unavailable' });
  }

  try {
    // Attach the signed-in user when there is one; anonymous is fine.
    let userId: string | null = null;
    try {
      const supabase = await getServerSupabase();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      userId = null;
    }

    let songId: string | null = null;
    const song = parseSong(body.song);
    if (song) {
      try {
        const row = await upsertSong(songToInsert(song));
        songId = row.id;
      } catch (err) {
        console.warn('api/analyses: song upsert failed; persisting without link', err);
      }
    }

    const excerpt =
      typeof body.lyricsExcerpt === 'string'
        ? body.lyricsExcerpt.slice(0, MAX_EXCERPT_CHARS)
        : null;

    const row = await createAnalysis({
      mode,
      user_id: userId,
      song_id: songId,
      result: result as AnalysisResultJson,
      lyrics_excerpt: excerpt,
      language: typeof body.language === 'string' ? body.language.slice(0, 40) : null,
      translated: body.translated === true,
    });

    return NextResponse.json({ status: 'ok', id: row.id, songId });
  } catch (err) {
    console.error('api/analyses error:', err);
    return NextResponse.json({ status: 'store_error' });
  }
}
