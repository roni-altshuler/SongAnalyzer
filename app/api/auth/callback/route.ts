/**
 * OAuth callback handler.
 *
 * The PKCE / OAuth flow lands here with a `?code=...` param. Exchange the
 * code for a session (which writes the auth cookies via `@supabase/ssr`),
 * then redirect to `?next=` (defaults to `/`).
 *
 * If `code` is missing or the exchange fails, redirect to the home page
 * with an error flag — the client UI can surface a toast.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Refuse open redirects: only allow same-origin relative paths.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
