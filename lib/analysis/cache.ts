/**
 * Analysis result cache, keyed by SHA-256 of normalized lyrics.
 *
 * Stream A is building the durable `lib/db/analyses.ts` store in parallel.
 * To avoid tight coupling during parallel dev, this module exposes an
 * `AnalysisCacheStore` interface and ships an in-memory noop store. The API
 * route reads a module-level singleton (`getAnalysisCache`); when Stream A's
 * store is ready, the route can be wired to call `setAnalysisCache(...)` at
 * boot.
 *
 * Normalization: lowercase + collapse all runs of whitespace to a single
 * space + trim. That way `"I love you"` and `"  i  LOVE\nyou\n"` hash to the
 * same key.
 *
 * Safe to import from server contexts. The hash function uses `node:crypto`.
 */

import { createHash } from 'node:crypto';
import type { AnalysisResult } from '@/lib/types';

/**
 * Minimal contract for a durable cache. Stream A's Supabase-backed analyses
 * store will implement this when ready.
 */
export interface AnalysisCacheStore {
  get(hash: string): Promise<AnalysisResult | null>;
  set(hash: string, result: AnalysisResult): Promise<void>;
}

/**
 * Default in-memory implementation. Lives for the lifetime of the Node
 * process (per Vercel function instance). LRU-trimmed to keep memory bounded.
 */
class InMemoryCache implements AnalysisCacheStore {
  private readonly store = new Map<string, AnalysisResult>();
  private readonly maxEntries: number;

  constructor(maxEntries = 256) {
    this.maxEntries = maxEntries;
  }

  async get(hash: string): Promise<AnalysisResult | null> {
    const hit = this.store.get(hash);
    if (!hit) return null;
    // Promote to MRU.
    this.store.delete(hash);
    this.store.set(hash, hit);
    return hit;
  }

  async set(hash: string, result: AnalysisResult): Promise<void> {
    if (this.store.has(hash)) this.store.delete(hash);
    this.store.set(hash, result);
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}

const NOOP_STORE: AnalysisCacheStore = {
  async get() { return null; },
  async set() { /* noop */ },
};

let activeStore: AnalysisCacheStore = new InMemoryCache();

/**
 * Replace the active cache store. The API route calls this once at module
 * load (currently with the in-memory store; Stream A's Supabase store will
 * plug in here).
 */
export function setAnalysisCache(store: AnalysisCacheStore | null): void {
  activeStore = store ?? NOOP_STORE;
}

/**
 * Access the currently-configured store. Always returns a usable store
 * (noop if explicitly cleared) so callers don't need to null-check.
 */
export function getAnalysisCache(): AnalysisCacheStore {
  return activeStore;
}

/**
 * Normalize lyrics for stable hashing: case-fold + collapse whitespace.
 *
 * Two inputs that differ only in capitalization or whitespace must hash to
 * the same key — that's what makes the cache useful for re-analyses.
 */
export function normalizeLyrics(lyrics: string): string {
  return lyrics.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Compute the SHA-256 hex digest of the normalized lyrics.
 */
export function hashLyrics(lyrics: string): string {
  return createHash('sha256').update(normalizeLyrics(lyrics)).digest('hex');
}

/**
 * Convenience wrappers. The API route can use the lower-level
 * `getAnalysisCache()` directly when it needs a transaction-like flow.
 */
export async function getCachedAnalysis(
  hash: string,
  store: AnalysisCacheStore = getAnalysisCache(),
): Promise<AnalysisResult | null> {
  return store.get(hash);
}

export async function setCachedAnalysis(
  hash: string,
  result: AnalysisResult,
  store: AnalysisCacheStore = getAnalysisCache(),
): Promise<void> {
  return store.set(hash, result);
}
