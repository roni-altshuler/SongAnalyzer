import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { markPublic } from '@/lib/db/analyses';

/**
 * POST /api/analyses/share
 *
 * Body: `{ analysisId: string }`
 *
 * Marks the given analysis as public, generates (or reuses) a share slug, and
 * returns the absolute share URL.
 *
 * Authorization:
 *   - Anonymous (`user_id IS NULL`) analyses can be shared by anyone — they
 *     have no owner. This matches the data layer's existing posture (the
 *     legacy `/api/analyze` route persists anonymous results via the admin
 *     client).
 *   - Owned analyses can only be shared by their owner.
 */
export async function POST(request: NextRequest) {
  let body: { analysisId?: string };
  try {
    body = (await request.json()) as { analysisId?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const analysisId = body.analysisId?.trim();
  if (!analysisId) {
    return NextResponse.json({ error: 'missing_analysis_id' }, { status: 400 });
  }

  // Fetch the row via admin so we always see it, then enforce ownership in
  // application code (RLS would hide it from a non-owner before we could
  // decide between 401 and 404).
  const admin = getAdminSupabase();
  const { data: row, error: fetchError } = await admin
    .from('analyses')
    .select('id, user_id')
    .eq('id', analysisId)
    .maybeSingle();

  if (fetchError) {
    console.error('[api/analyses/share] fetch failed:', fetchError);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (row.user_id) {
    const supabase = await getServerSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (userData.user.id !== row.user_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  try {
    const slug = await markPublic(analysisId);
    const proto = request.nextUrl.protocol.replace(':', '');
    const host = request.headers.get('host') ?? request.nextUrl.host;
    const origin = `${proto}://${host}`;
    const shareUrl = `${origin}/share/${slug}`;
    return NextResponse.json({ slug, shareUrl });
  } catch (err) {
    console.error('[api/analyses/share] markPublic failed:', err);
    return NextResponse.json({ error: 'share_failed' }, { status: 500 });
  }
}
