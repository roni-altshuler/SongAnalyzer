/**
 * Service-role Supabase client (BYPASSES RLS).
 *
 * SERVER-ONLY. Never import this from a client component or any module that
 * could be bundled into the browser. The service role key grants full
 * database access — leaking it is equivalent to leaking your database
 * password.
 *
 * Runtime guard: this module throws on import if it detects it's running in
 * the browser, and (in production) if the service-role key is missing.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Guard 1: refuse to load in the browser. `window` is the most reliable signal.
if (typeof window !== 'undefined') {
  throw new Error(
    '[supabase/admin] FATAL: service-role client was imported into a browser bundle. ' +
      'Move the import to a server-only module (route handler, server action, or RSC).',
  );
}

let cachedAdmin: SupabaseClient<Database> | null = null;

/**
 * Returns a memoized service-role Supabase client.
 *
 * In production, throws if `SUPABASE_SERVICE_ROLE_KEY` is missing.
 * In development, logs a warning and still throws (calling code can't
 * function without the key, so failing fast is better than a confusing
 * 401 chain).
 */
export function getAdminSupabase(): SupabaseClient<Database> {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isProd = process.env.NODE_ENV === 'production';

  if (!url) {
    throw new Error('[supabase/admin] Missing NEXT_PUBLIC_SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    const message =
      '[supabase/admin] Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail.';
    if (isProd) {
      throw new Error(message);
    }
    // Dev: warn loudly so the developer notices, then still throw so callers
    // don't silently fall back to anon behavior.
    // eslint-disable-next-line no-console
    console.warn(message);
    throw new Error(message);
  }

  cachedAdmin = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdmin;
}
