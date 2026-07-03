/**
 * POST /api/fingerprints — opportunistic catalog indexing.
 *
 * Whenever the client decodes a Spotify preview for analysis it fingerprints
 * the same PCM in the worker and fire-and-forgets the hashes here, growing
 * the Identify catalog for free. The seed script uses the same ingest module
 * directly (with `source: 'seed'`).
 *
 * Body: `{ songId: uuid, hashes: Array<{ h, t }>, source?: 'preview' | 'upload' }`
 * Responses: 200 `{ status, accepted }` for all reachable-store outcomes,
 * 400 only for malformed payloads. `'seed'` is reserved for the script and
 * rejected here.
 */

import { NextRequest, NextResponse } from 'next/server';

import { ingestFingerprints } from '@/lib/fingerprint/ingest';
import { isFingerprintStoreConfigured } from '@/lib/fingerprint/match';
import { MAX_HASHES_PER_INGEST } from '@/lib/fingerprint/types';
import { isUuid, parseFingerprintPayload } from '@/lib/fingerprint/validate';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const limit = await rateLimit('fingerprints', clientIpFrom(request));
  if (!limit.success) {
    return NextResponse.json(
      { status: 'rate_limited', accepted: 0, retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  let body: { songId?: unknown; hashes?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_not_json' }, { status: 400 });
  }

  if (!isUuid(body?.songId)) {
    return NextResponse.json({ error: 'invalid_song_id' }, { status: 400 });
  }

  const source = body.source ?? 'preview';
  if (source !== 'preview' && source !== 'upload') {
    return NextResponse.json({ error: 'invalid_source' }, { status: 400 });
  }

  const parsed = parseFingerprintPayload(body.hashes, MAX_HASHES_PER_INGEST);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!isFingerprintStoreConfigured()) {
    return NextResponse.json({ status: 'store_unavailable', accepted: 0 });
  }

  try {
    const result = await ingestFingerprints(body.songId, parsed.hashes, source);
    return NextResponse.json({
      status: result.status,
      accepted: result.status === 'accepted' ? result.inserted : 0,
    });
  } catch (err) {
    console.error('fingerprints ingest error:', err);
    return NextResponse.json({ status: 'store_error', accepted: 0 });
  }
}
