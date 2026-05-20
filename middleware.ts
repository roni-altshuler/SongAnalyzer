/**
 * Next.js middleware — refreshes the Supabase session cookie on protected
 * route patterns.
 *
 * Matcher covers `/account/*`, `/api/auth/*`, and `/atlas/*` — these are the
 * surfaces where stale auth would silently break the UX. The home page and
 * `/share/[slug]` work fine as anonymous users.
 *
 * Static assets and the Next.js framework files are excluded by the matcher
 * regex so we don't pay the cost on every image / font / chunk fetch.
 */

import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/account/:path*',
    '/api/auth/:path*',
    '/atlas/:path*',
  ],
};
