/**
 * Server-side fingerprint matching against the `song_fingerprints` catalog.
 *
 * The heavy lifting happens in the `match_fingerprints` Postgres RPC
 * (supabase/migrations/0004_fingerprints.sql): it joins the query hashes
 * against the catalog and votes on (song, offset-delta bucket) alignment.
 * This module applies the acceptance thresholds on the returned candidates.
 */

import 'server-only';

import { getAdminSupabase } from '@/lib/supabase/admin';
import {
  MIN_MATCH_VOTES,
  RUNNER_UP_RATIO,
  type FingerprintHash,
  type FingerprintMatch,
} from './types';

/**
 * Whether the fingerprint store can be reached at all — mirrors the
 * `isSpotifyConfigured()` short-circuit pattern.
 */
export function isFingerprintStoreConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Match a query fingerprint against the catalog.
 *
 * Accepts only when the best (song, alignment) bucket clears
 * `MIN_MATCH_VOTES` AND out-votes the best bucket of any *other* song by
 * `RUNNER_UP_RATIO` — a true match is a sharp spike, not a broad smear.
 */
export async function matchFingerprints(
  hashes: FingerprintHash[],
): Promise<FingerprintMatch | null> {
  if (hashes.length === 0) return null;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc('match_fingerprints', {
    q_hashes: hashes.map((x) => x.h),
    q_offsets: hashes.map((x) => x.t),
  });

  if (error) {
    throw new Error(`[fingerprint/match] ${error.message}`);
  }

  const rows = data ?? [];
  const best = rows[0];
  if (!best || best.votes < MIN_MATCH_VOTES) return null;

  const runnerUp = rows.find((r) => r.song_id !== best.song_id);
  if (runnerUp && best.votes < runnerUp.votes * RUNNER_UP_RATIO) return null;

  // ~5% of query hashes aligning on one offset is a decisive match.
  const confidence = Math.min(1, best.votes / Math.max(1, hashes.length * 0.05));

  return {
    songId: best.song_id,
    votes: best.votes,
    confidence: Number(confidence.toFixed(3)),
  };
}
