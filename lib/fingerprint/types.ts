/**
 * Client-safe types + constants for the constellation fingerprint engine.
 *
 * No server imports here — this module is shared by the Web Worker, the API
 * routes, the seed script, and the UI (mirroring how `lib/sources/types.ts`
 * keeps the resolver types importable everywhere).
 */

import type { Song } from '@/lib/sources/types';

/** Bump when the constellation parameters change — stored hashes are only
 * comparable within one version. */
export const FINGERPRINT_VERSION = 1;

/**
 * One landmark: a 24-bit packed hash (`f1(9b) | f2(9b) | Δt(6b)`) plus the
 * anchor peak's absolute offset from the start of the clip in milliseconds.
 */
export interface FingerprintHash {
  h: number;
  t: number;
}

/** Hard ceilings enforced by both the client and `/api/*` validation. */
export const MAX_HASHES_PER_QUERY = 3_000; // a 10s mic snippet yields ~500-1000
export const MAX_HASHES_PER_INGEST = 6_000; // a 30s preview yields ~1500-3000
export const MAX_OFFSET_MS = 15 * 60_000; // refuse absurd clip lengths
export const HASH_LIMIT = 1 << 24; // hashes are 24-bit packed integers

/** Accept a match only with this many offset-aligned votes… */
export const MIN_MATCH_VOTES = 20;
/** …and only when the best song out-votes the runner-up by this factor. */
export const RUNNER_UP_RATIO = 3;

export type FingerprintSource = 'preview' | 'upload' | 'seed';

export interface MatchCandidate {
  songId: string;
  votes: number;
  /** Alignment bucket (100ms) between query offsets and stored offsets. */
  deltaBucket: number;
}

export interface FingerprintMatch {
  songId: string;
  votes: number;
  /** 0..1 — votes normalised against the query hash count. */
  confidence: number;
}

/**
 * `/api/identify` body. Mirrors `/api/analyze`'s always-200 posture: the
 * client switches on `status`, never on HTTP codes.
 */
export type IdentifyResponseBody =
  | { status: 'matched'; song: Song; match: { votes: number; confidence: number } }
  | { status: 'no_match'; reason?: string; fallbackAvailable: boolean }
  | { status: 'rate_limited'; retryAfterMs?: number }
  | { status: 'invalid'; error: string };

/** `/api/identify/fallback` body (AudD relay). */
export type IdentifyFallbackResponseBody =
  | { status: 'matched'; song: Song }
  | { status: 'no_match' }
  | { status: 'not_configured' }
  | { status: 'rate_limited'; retryAfterMs?: number }
  | { status: 'invalid'; error: string };
