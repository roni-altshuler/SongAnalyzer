/**
 * Durable analysis cache — the Supabase-backed `AnalysisCacheStore` that the
 * in-memory LRU in `lib/analysis/cache.ts` was designed to plug into.
 *
 * Two tiers: a small in-memory map fronts the `analysis_cache` table, so a
 * warm instance answers repeats without a round-trip while cold starts and
 * sibling instances still share hits through Postgres.
 *
 * Every Supabase failure degrades to a cache miss — the cache must never be
 * the reason `/api/analyze` fails.
 */

import 'server-only';

import type { AnalysisCacheStore } from '@/lib/analysis/cache';
import { getAdminSupabase } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';
import type { AnalysisResult } from '@/lib/types';

const MEMORY_MAX_ENTRIES = 256;

class DurableAnalysisCache implements AnalysisCacheStore {
  private readonly memory = new Map<string, AnalysisResult>();

  private remember(hash: string, result: AnalysisResult): void {
    if (this.memory.has(hash)) this.memory.delete(hash);
    this.memory.set(hash, result);
    while (this.memory.size > MEMORY_MAX_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      if (oldest === undefined) break;
      this.memory.delete(oldest);
    }
  }

  async get(hash: string): Promise<AnalysisResult | null> {
    const warm = this.memory.get(hash);
    if (warm) {
      this.remember(hash, warm); // promote to MRU
      return warm;
    }

    try {
      const supabase = getAdminSupabase();
      const { data, error } = await supabase
        .from('analysis_cache')
        .select('result, hit_count')
        .eq('lyrics_hash', hash)
        .maybeSingle();

      if (error || !data) return null;

      const result = data.result as unknown as AnalysisResult;
      this.remember(hash, result);

      // Best-effort telemetry; a lost race on the counter is fine.
      void supabase
        .from('analysis_cache')
        .update({ hit_count: data.hit_count + 1, last_hit_at: new Date().toISOString() })
        .eq('lyrics_hash', hash)
        .then(({ error: updateError }) => {
          if (updateError) console.warn('analysis-cache: hit bump failed', updateError.message);
        });

      return result;
    } catch (err) {
      console.warn('analysis-cache: read failed, treating as miss', err);
      return null;
    }
  }

  async set(hash: string, result: AnalysisResult): Promise<void> {
    this.remember(hash, result);
    try {
      const supabase = getAdminSupabase();
      const { error } = await supabase
        .from('analysis_cache')
        .upsert(
          { lyrics_hash: hash, result: result as unknown as Json },
          { onConflict: 'lyrics_hash', ignoreDuplicates: true },
        );
      if (error) console.warn('analysis-cache: write failed', error.message);
    } catch (err) {
      console.warn('analysis-cache: write failed', err);
    }
  }
}

/**
 * Build the durable store when Supabase admin credentials exist; otherwise
 * return null and let the caller keep the default in-memory LRU.
 */
export function createDurableAnalysisCache(): AnalysisCacheStore | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return new DurableAnalysisCache();
}
