/**
 * Request/response cookie-refresh helper for Next.js middleware.
 *
 * Called from `middleware.ts` (at the repo root) on protected route patterns.
 * Calling `supabase.auth.getUser()` here is what keeps the session token
 * fresh — `@supabase/ssr` reads + writes cookies on the response.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './database.types';

export async function updateSession(request: NextRequest) {
  // Start with a passthrough response — we'll mutate its cookies as needed.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // No Supabase configured — let the request through unchanged.
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) {
        // Mirror new cookies into both the incoming request (so subsequent
        // logic in this middleware sees them) and the outgoing response.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Touch the session so Supabase issues a refreshed access token cookie
  // when the old one is near expiry. We intentionally don't gate the
  // response on the result — anonymous users are allowed through here;
  // page-level redirects are the right place for auth gates.
  await supabase.auth.getUser();

  return response;
}
