/**
 * Server-component Supabase client.
 *
 * Use this inside server components, route handlers, and server actions to
 * read auth state and run RLS-gated queries on behalf of the signed-in user.
 *
 * Cookies come from `next/headers`. In server components only `getAll` is
 * available (cookies are read-only) — `setAll` is a no-op there. Route
 * handlers and server actions can write cookies, which is how we refresh the
 * session.
 */

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './database.types';

export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[supabase/server] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) {
        // In server components (RSC) cookie mutation is not allowed and will
        // throw. Swallow the error: middleware refreshes the session on every
        // request, so this is purely a best-effort optimization. We don't
        // forward the optional `headers` argument because Next's RSC cookie
        // store has no equivalent surface.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware handles refresh.
        }
      },
    },
  });
}
