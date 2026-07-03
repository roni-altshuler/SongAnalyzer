/**
 * Server-side fingerprint ingest.
 *
 * Hashes are computed client-side (or by the seed script), so this module is
 * the trust boundary: it validates shape/ranges, verifies the song exists,
 * and enforces first-write-wins — a song that is already substantially
 * indexed cannot be re-fingerprinted by an anonymous client, which blunts
 * catalog-poisoning attempts. Route-level rate limiting adds the second
 * layer. A server-side spot-verification job is the documented follow-up.
 */

import 'server-only';

import { getAdminSupabase } from '@/lib/supabase/admin';
import type { SongFingerprintInsert } from '@/lib/supabase/database.types';
import type { FingerprintHash, FingerprintSource } from './types';

/**
 * A song with at least this many stored hashes is considered indexed and
 * locked. Well below a real 30s preview's yield (~1,500+), so partial ingests
 * can complete, but re-writes of a healthy index are refused.
 */
export const REINGEST_THRESHOLD = 500;

/** Supabase insert batches — keeps each request comfortably sized. */
const INSERT_CHUNK = 1_000;

export type IngestResult =
  | { status: 'accepted'; inserted: number }
  | { status: 'already_indexed' }
  | { status: 'unknown_song' };

export async function ingestFingerprints(
  songId: string,
  hashes: FingerprintHash[],
  source: FingerprintSource,
): Promise<IngestResult> {
  const supabase = getAdminSupabase();

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .maybeSingle();
  if (songError) throw new Error(`[fingerprint/ingest:song] ${songError.message}`);
  if (!song) return { status: 'unknown_song' };

  const { count, error: countError } = await supabase
    .from('song_fingerprints')
    .select('*', { count: 'exact', head: true })
    .eq('song_id', songId);
  if (countError) throw new Error(`[fingerprint/ingest:count] ${countError.message}`);
  if ((count ?? 0) >= REINGEST_THRESHOLD) return { status: 'already_indexed' };

  // Dedupe within the payload — (song_id, hash, offset_ms) is the PK.
  const seen = new Set<string>();
  const rows: SongFingerprintInsert[] = [];
  for (const { h, t } of hashes) {
    const key = `${h}:${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ song_id: songId, hash: h, offset_ms: t, source });
  }

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase
      .from('song_fingerprints')
      .upsert(chunk, { onConflict: 'song_id,hash,offset_ms', ignoreDuplicates: true });
    if (error) throw new Error(`[fingerprint/ingest:insert] ${error.message}`);
  }

  return { status: 'accepted', inserted: rows.length };
}
