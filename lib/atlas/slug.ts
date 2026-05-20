/**
 * Bidirectional slug helpers for the Mood Atlas.
 *
 * URLs in `/atlas/artist/[slug]` and `/atlas/genre/[name]` use a
 * lowercase-hyphenated form derived from the display string. `slugify` is
 * pure; `deslugify` requires a database lookup because the slug is lossy
 * (it drops case + punctuation, so multiple display names can collide).
 *
 * Resolution rules:
 *   - Artist: match `where lower(replace(artist, ' ', '-')) = $slug`.
 *   - Genre:  match case-insensitively against the canonical genre vocab.
 */

import 'server-only';
import { getAdminSupabase } from '@/lib/supabase/admin';

/**
 * Convert a display string to a URL slug.
 *
 *   slugify("Neon Echo")        -> "neon-echo"
 *   slugify("Hip-Hop")           -> "hip-hop"
 *   slugify("M.I.A. & The Crew") -> "m-i-a-the-crew"
 *
 * Rules:
 *   1. Lowercase
 *   2. Replace any run of non-alphanumeric characters with a single hyphen
 *   3. Trim leading / trailing hyphens
 */
export function slugify(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve an artist slug back to the canonical display name stored in
 * `songs.artist`. Returns null when no artist matches.
 *
 * We query `songs` directly rather than `atlas_aggregates` so the resolver
 * works even when the materialized view hasn't been refreshed yet.
 */
export async function deslugifyArtist(slug: string): Promise<string | null> {
  if (!slug) return null;

  // `getAdminSupabase()` throws when env vars are missing — fail soft so a
  // local dev hitting /atlas/artist/x without Supabase configured gets a
  // clean 404 instead of a 500.
  let supabase: ReturnType<typeof getAdminSupabase> | null = null;
  try {
    supabase = getAdminSupabase();
  } catch {
    return null;
  }
  if (!supabase) return null;

  // Pull a small candidate set (any songs whose slugified artist starts
  // with the same letter); finish the match in JS so we share the exact
  // `slugify` semantics with the URL builder.
  const first = slug.charAt(0);
  const { data, error } = await supabase
    .from('songs')
    .select('artist')
    .ilike('artist', `${first}%`)
    .limit(500);

  if (error || !data) return null;

  const seen = new Set<string>();
  for (const row of data) {
    if (!row.artist || seen.has(row.artist)) continue;
    seen.add(row.artist);
    if (slugify(row.artist) === slug) return row.artist;
  }
  return null;
}

/** Canonical atlas genres — must stay in sync with `lib/seeds/atlas-seed-lyrics.ts`. */
export const ATLAS_GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Folk', 'Electronic'] as const;
export type AtlasGenre = (typeof ATLAS_GENRES)[number];

/**
 * Resolve a genre slug back to its canonical display name. Returns null
 * when no canonical genre matches — the page should 404 in that case.
 */
export function deslugifyGenre(slug: string): AtlasGenre | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  for (const g of ATLAS_GENRES) {
    if (slugify(g) === normalized) return g;
  }
  return null;
}
