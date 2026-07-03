import { NextRequest, NextResponse } from 'next/server';

import { clientIpFrom, rateLimit } from '@/lib/rate-limit';
import { isSpotifyConfigured, searchSpotify } from '@/lib/sources/spotify';

/**
 * GET /api/songs/search?q=<query>
 *
 * Typeahead-friendly endpoint backed by Spotify search (the primary signal —
 * it gives us cover art and 30s previews, which the other sources don't).
 *
 * Required env vars:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *
 * Behaviour:
 *   - Returns 400 if `q` is missing / empty.
 *   - Returns 503 `{ error: 'spotify_not_configured' }` when env vars are
 *     unset (clean degraded mode rather than a 500 crash).
 *   - Otherwise returns `{ hits: SearchHit[] }` with up to 10 results.
 *   - Sets `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
 *     so Vercel's edge cache absorbs the bulk of typeahead traffic.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  }

  const limit = await rateLimit('search', clientIpFrom(request));
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: 'spotify_not_configured' },
      { status: 503 },
    );
  }

  try {
    const hits = await searchSpotify(q);
    return NextResponse.json(
      { hits },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error('songs/search error:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 502 });
  }
}
