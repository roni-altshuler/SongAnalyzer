/**
 * Payload validation shared by `/api/identify` and `/api/fingerprints`.
 *
 * Client-safe (no server imports) so unit tests and the worker-side callers
 * can exercise exactly the checks the routes enforce.
 */

import { HASH_LIMIT, MAX_OFFSET_MS, type FingerprintHash } from './types';

export type ParsedHashes =
  | { ok: true; hashes: FingerprintHash[] }
  | { ok: false; error: string };

/**
 * Validate an untrusted `hashes` value: a non-empty array of
 * `{ h: 24-bit int, t: 0..MAX_OFFSET_MS int }`, capped at `maxHashes`.
 */
export function parseFingerprintPayload(value: unknown, maxHashes: number): ParsedHashes {
  if (!Array.isArray(value)) return { ok: false, error: 'hashes_not_array' };
  if (value.length === 0) return { ok: false, error: 'hashes_empty' };
  if (value.length > maxHashes) return { ok: false, error: 'too_many_hashes' };

  const hashes: FingerprintHash[] = new Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const item = value[i] as { h?: unknown; t?: unknown } | null;
    const h = item?.h;
    const t = item?.t;
    if (
      typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h >= HASH_LIMIT ||
      typeof t !== 'number' || !Number.isInteger(t) || t < 0 || t > MAX_OFFSET_MS
    ) {
      return { ok: false, error: `invalid_hash_at_${i}` };
    }
    hashes[i] = { h, t };
  }
  return { ok: true, hashes };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
