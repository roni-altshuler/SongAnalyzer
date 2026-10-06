/**
 * POST /api/identify/fallback — AudD relay for snippets our own catalog
 * couldn't match.
 *
 * Multipart body with an `audio` file (the ≤12s recorded snippet, ~150KB of
 * opus). Only invoked after explicit user consent in the no-match state —
 * every call costs money, hence the strictest rate-limit bucket.
 *
 * On an AudD hit we resolve track metadata without catalog writes. Returned
 * metadata does not authorize remote audio fetching, analysis or indexing.
 *
 * Always 200 with a `status` discriminator, matching `/api/identify`.
 */

import { NextRequest, NextResponse } from 'next/server';

import type { IdentifyFallbackResponseBody } from '@/lib/fingerprint/types';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';
import { isAuddConfigured, recognizeAudd } from '@/lib/sources/audd';
import { resolveSong } from '@/lib/sources/resolve';
import { isSpotifyConfigured } from '@/lib/sources/spotify';

export const runtime = 'nodejs';

/** Generous cap for a ~12s opus snippet; blocks abuse of the relay. */
const MAX_SNIPPET_BYTES = 2 * 1024 * 1024;

function respond(body: IdentifyFallbackResponseBody): NextResponse {
  return NextResponse.json(body);
}

export async function POST(request: NextRequest) {
  const limit = await rateLimit('identify-fallback', clientIpFrom(request));
  if (!limit.success) {
    return respond({ status: 'rate_limited', retryAfterMs: limit.retryAfterMs });
  }

  if (!isAuddConfigured()) {
    return respond({ status: 'not_configured' });
  }

  let audio: File;
  try {
    const form = await request.formData();
    if (form.get('consent') !== 'audd-recognition') {
      return respond({ status: 'invalid', error: 'audd_consent_required' });
    }
    const value = form.get('audio');
    if (!(value instanceof File) || value.size === 0) {
      return respond({ status: 'invalid', error: 'missing_audio' });
    }
    if (value.size > MAX_SNIPPET_BYTES) {
      return respond({ status: 'invalid', error: 'audio_too_large' });
    }
    audio = value;
  } catch {
    return respond({ status: 'invalid', error: 'body_not_multipart' });
  }

  try {
    if (request.signal.aborted) return respond({ status: 'invalid', error: 'request_cancelled' });
    const recognition = await recognizeAudd(audio, request.signal);
    if (request.signal.aborted) return respond({ status: 'invalid', error: 'request_cancelled' });
    if (!recognition) {
      return respond({ status: 'no_match' });
    }

    // Enrich metadata without catalog writes when Spotify is up;
    // otherwise return the bare recognition so the user still gets an answer.
    if (isSpotifyConfigured()) {
      try {
        const song = await resolveSong(
          `${recognition.title} ${recognition.artist}`,
        );
        if (request.signal.aborted) return respond({ status: 'invalid', error: 'request_cancelled' });
        return respond({ status: 'matched', song });
      } catch (err) {
        console.warn('identify/fallback: resolveSong failed; returning bare recognition', err);
      }
    }

    return respond({
      status: 'matched',
      song: {
        title: recognition.title,
        artist: recognition.artist,
        album: recognition.album,
        metadataSource: 'audd',
      },
    });
  } catch (err) {
    console.error('identify/fallback error:', err);
    return respond({ status: 'no_match' });
  }
}
