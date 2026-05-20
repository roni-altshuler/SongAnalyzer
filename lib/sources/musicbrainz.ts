import 'server-only';

/**
 * MusicBrainz adapter.
 *
 * MusicBrainz enforces a hard rate limit of **one request per IP per second**
 * (https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting). Going over
 * triggers a 503 and, repeated, an IP ban. We therefore funnel all outbound
 * MB requests through a single in-process FIFO queue that paces them at
 * 1 req/sec. A burst of `resolveSong()` calls (e.g. seed-data ingest) will
 * queue cleanly instead of hammering the service.
 *
 * MusicBrainz also REQUIRES a descriptive `User-Agent` per their etiquette
 * page; anonymous traffic gets blocked. We set one that names the app,
 * version, and contact URL.
 *
 * No API key is needed.
 */

const API_ROOT = 'https://musicbrainz.org/ws/2';

const USER_AGENT =
  'SongAnalyzer/2.0 (https://github.com/roni-altshuler/SongAnalyzer)';

/** Minimum gap between successive MB requests, ms. */
const MIN_INTERVAL_MS = 1000;

/** Timestamp (epoch ms) of the *next* allowed request. */
let nextSlot = 0;

/**
 * Pace the next call so that at least `MIN_INTERVAL_MS` has elapsed since
 * the previous one. Implemented as a serial reservation system: each caller
 * grabs the next free slot, then awaits a sleep to honour it.
 */
async function awaitSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  const wait = slot - now;
  if (wait > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
}

/** Test hook — resets the rate-limit cursor between unit tests. */
export function __resetMusicBrainzRateLimit(): void {
  nextSlot = 0;
}

interface MBRecordingSearchResponse {
  recordings: Array<{
    id: string;
    score: number;
    title?: string;
    'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>;
  }>;
}

export interface MusicBrainzHit {
  recordingId: string;
  /** MB returns 0..100; we keep their scale. */
  score: number;
  title?: string;
  artist?: string;
}

/**
 * Free-text recording search. Coverage isn't exhaustive — many modern pop
 * tracks aren't in MB — so callers should treat a 0-hit result as routine,
 * not as an error.
 */
export async function searchMusicBrainz(query: string): Promise<MusicBrainzHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  await awaitSlot();

  const url = new URL(`${API_ROOT}/recording`);
  url.searchParams.set('query', trimmed);
  url.searchParams.set('limit', '5');
  url.searchParams.set('fmt', 'json');

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`MusicBrainz search failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as MBRecordingSearchResponse;
  const recordings = json.recordings ?? [];

  return recordings.map((r) => {
    const credit = r['artist-credit']?.[0];
    const artist = credit?.artist?.name ?? credit?.name;
    return {
      recordingId: r.id,
      score: r.score,
      title: r.title,
      artist,
    };
  });
}
