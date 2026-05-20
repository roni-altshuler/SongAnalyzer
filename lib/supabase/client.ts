/**
 * Browser-side Supabase client.
 *
 * Use this inside client components ('use client') for auth state and
 * RLS-gated reads. Never import the service-role client from the browser.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

let cachedClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Returns a memoized browser Supabase client. Memoization keeps the cookie
 * subscription stable across re-renders.
 */
export function getBrowserSupabase() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[supabase/client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Check your .env.local against .env.example.',
    );
  }

  cachedClient = createBrowserClient<Database>(url, anonKey);
  return cachedClient;
}
