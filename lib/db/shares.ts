/**
 * Share record helpers.
 *
 * Shares are world-readable but written by the service role only. View-count
 * increments happen on the share page server component.
 */

import 'server-only';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import type { ShareRow } from '@/lib/supabase/database.types';

/**
 * Read a single share row. Uses the server client so we still get the
 * (world-readable) row for anonymous viewers without consuming the admin
 * client unnecessarily.
 */
export async function getShare(analysisId: string): Promise<ShareRow | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .eq('analysis_id', analysisId)
    .maybeSingle();

  if (error) {
    throw new Error(`[db/shares.getShare] ${error.message}`);
  }
  return data;
}

/**
 * Atomically bump the view counter for an analysis's share.
 *
 * Postgres doesn't expose an atomic `+1` over PostgREST in a single call
 * without an RPC, so we read-then-write. This is fine for our scale
 * (a small race results in an undercount, never a phantom view).
 *
 * Returns the new count, or null when no share row exists.
 */
export async function incrementViewCount(
  analysisId: string,
): Promise<number | null> {
  const supabase = getAdminSupabase();

  const { data: current, error: readError } = await supabase
    .from('shares')
    .select('view_count')
    .eq('analysis_id', analysisId)
    .maybeSingle();

  if (readError) {
    throw new Error(`[db/shares.incrementViewCount:read] ${readError.message}`);
  }
  if (!current) return null;

  const nextCount = (current.view_count ?? 0) + 1;

  const { error: writeError } = await supabase
    .from('shares')
    .update({ view_count: nextCount })
    .eq('analysis_id', analysisId);

  if (writeError) {
    throw new Error(`[db/shares.incrementViewCount:write] ${writeError.message}`);
  }
  return nextCount;
}
