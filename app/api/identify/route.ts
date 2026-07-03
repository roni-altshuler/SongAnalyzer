/**
 * POST /api/identify — match a client-computed fingerprint against the
 * constellation catalog.
 *
 * Body: `{ hashes: Array<{ h, t }> }` — 24-bit packed hashes + offsets (ms),
 * computed in the fingerprint Web Worker. The server never receives audio.
 *
 * Mirrors `/api/analyze`'s posture: ALWAYS 200, with a `status` discriminator
 * (`matched | no_match | rate_limited | invalid`) so the client has a single
 * code path. Store failures degrade to `no_match` with a `reason` — never 5xx.
 */

import { NextRequest, NextResponse } from 'next/server';

import { rowToSong } from '@/lib/db/song-store-adapter';
import { getSongById } from '@/lib/db/songs';
import { isFingerprintStoreConfigured, matchFingerprints } from '@/lib/fingerprint/match';
import { MAX_HASHES_PER_QUERY, type IdentifyResponseBody } from '@/lib/fingerprint/types';
import { parseFingerprintPayload } from '@/lib/fingerprint/validate';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';
import { isAuddConfigured } from '@/lib/sources/audd';

export const runtime = 'nodejs';

function respond(body: IdentifyResponseBody): NextResponse {
  return NextResponse.json(body);
}

export async function POST(request: NextRequest) {
  const limit = await rateLimit('identify', clientIpFrom(request));
  if (!limit.success) {
    return respond({ status: 'rate_limited', retryAfterMs: limit.retryAfterMs });
  }

  let body: { hashes?: unknown };
  try {
    body = await request.json();
  } catch {
    return respond({ status: 'invalid', error: 'body_not_json' });
  }

  const parsed = parseFingerprintPayload(body?.hashes, MAX_HASHES_PER_QUERY);
  if (!parsed.ok) {
    return respond({ status: 'invalid', error: parsed.error });
  }

  const fallbackAvailable = isAuddConfigured();

  if (!isFingerprintStoreConfigured()) {
    return respond({ status: 'no_match', reason: 'store_unavailable', fallbackAvailable });
  }

  try {
    const match = await matchFingerprints(parsed.hashes);
    if (!match) {
      return respond({ status: 'no_match', fallbackAvailable });
    }

    const row = await getSongById(match.songId);
    if (!row) {
      return respond({ status: 'no_match', reason: 'song_missing', fallbackAvailable });
    }

    return respond({
      status: 'matched',
      song: rowToSong(row),
      match: { votes: match.votes, confidence: match.confidence },
    });
  } catch (err) {
    console.error('identify error:', err);
    return respond({ status: 'no_match', reason: 'store_error', fallbackAvailable });
  }
}
