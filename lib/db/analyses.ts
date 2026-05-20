/**
 * Analysis record helpers.
 *
 * `createAnalysis` uses the service-role client so anonymous API routes can
 * still persist results when desired. Read helpers use the user-scoped
 * server client so RLS does the right thing (own row OR public OR seed).
 */

import 'server-only';
import { nanoid } from 'nanoid';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import type {
  AnalysisInsert,
  AnalysisRow,
} from '@/lib/supabase/database.types';

/**
 * Persist a new analysis. Always uses the admin client — Stream C may invoke
 * this for unauthenticated users, in which case `user_id` is null and RLS
 * would otherwise reject the insert.
 */
export async function createAnalysis(
  input: Omit<AnalysisInsert, 'share_slug'> & { share_slug?: string | null },
): Promise<AnalysisRow> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from('analyses')
    .insert(input)
    .select('*')
    .single();

  if (error) {
    throw new Error(`[db/analyses.createAnalysis] ${error.message}`);
  }
  return data;
}

/**
 * Look up an analysis by its public share slug.
 *
 * Uses the user-scoped server client so RLS gates the row: visible when
 * `is_public = true`, `system_seed = true`, or the caller owns it.
 */
export async function getAnalysisBySlug(slug: string): Promise<AnalysisRow | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('share_slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`[db/analyses.getAnalysisBySlug] ${error.message}`);
  }
  return data;
}

/**
 * List analyses owned by the currently signed-in user. Returns `[]` when
 * no user is signed in.
 */
export async function listMyAnalyses(limit = 50): Promise<AnalysisRow[]> {
  const supabase = await getServerSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`[db/analyses.listMyAnalyses] ${error.message}`);
  }
  return data ?? [];
}

/**
 * Make an analysis public. Generates and persists a unique share slug if
 * one isn't already set, and ensures a matching `shares` row exists.
 *
 * Returns the share slug so callers can construct the share URL.
 */
export async function markPublic(analysisId: string): Promise<string> {
  const supabase = getAdminSupabase();

  // Fetch current state — we want to preserve an existing slug if any.
  const { data: existing, error: fetchError } = await supabase
    .from('analyses')
    .select('id, share_slug, is_public')
    .eq('id', analysisId)
    .single();

  if (fetchError) {
    throw new Error(`[db/analyses.markPublic:fetch] ${fetchError.message}`);
  }

  const slug = existing.share_slug ?? generateUniqueSlug();

  const { error: updateError } = await supabase
    .from('analyses')
    .update({ is_public: true, share_slug: slug })
    .eq('id', analysisId);

  if (updateError) {
    throw new Error(`[db/analyses.markPublic:update] ${updateError.message}`);
  }

  // Ensure a `shares` row exists. Upsert by analysis_id.
  const { error: shareError } = await supabase
    .from('shares')
    .upsert(
      { analysis_id: analysisId, view_count: 0 },
      { onConflict: 'analysis_id', ignoreDuplicates: true },
    );

  if (shareError) {
    throw new Error(`[db/analyses.markPublic:share] ${shareError.message}`);
  }

  return slug;
}

/**
 * URL-safe 12-char slug. Collision probability with 1M slugs is ~10^-7,
 * well below the threshold where we'd need to retry.
 */
function generateUniqueSlug(): string {
  return nanoid(12);
}
