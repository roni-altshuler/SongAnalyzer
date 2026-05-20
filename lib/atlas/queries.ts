/**
 * Server-only query helpers for the Mood Atlas.
 *
 * All reads go through the service-role client because the underlying data
 * (analyses where `is_public OR system_seed`) is world-readable anyway —
 * using admin avoids a cookie round-trip on every page render and sidesteps
 * the materialized-view-vs-RLS interaction (mat views aren't governed by
 * RLS in Postgres).
 *
 * Each helper degrades gracefully: if the migrations haven't been applied
 * locally (so the view / join target is missing) the helpers return an
 * empty-shape object instead of throwing, and the pages render their
 * empty-state Card.
 */

import 'server-only';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { moodToColor, type MoodColor } from '@/lib/analysis/palette';
import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface MoodSlice {
  mood: string;
  count: number;
  color: MoodColor;
}

export interface GenreSlice {
  genre: string;
  count: number;
  /** The dominant mood for the genre — drives the tile's tint. */
  dominantMood: string;
  color: MoodColor;
}

export interface ArtistSlice {
  artist: string;
  artistSlug: string;
  count: number;
  /** Dominant mood across this artist's analyses. */
  dominantMood: string;
  color: MoodColor;
}

export interface ThemeSlice {
  theme: string;
  count: number;
}

export interface AtlasOverview {
  totalAnalyses: number;
  totalArtists: number;
  moodDistribution: MoodSlice[];
  genreDistribution: GenreSlice[];
  topArtists: ArtistSlice[];
}

export interface AtlasAnalysisRow {
  analysisId: string;
  shareSlug: string | null;
  title: string;
  artist: string;
  album: string | null;
  releaseYear: number | null;
  mood: string;
  confidence: number;
  themes: string[];
  createdAt: string;
}

export interface MoodTimelinePoint {
  /** Year. */
  period: number;
  /** Per-mood counts for that year. */
  moods: Record<string, number>;
}

export interface ArtistAtlas {
  artist: string;
  analyses: AtlasAnalysisRow[];
  moodDistribution: MoodSlice[];
  moodOverTime: MoodTimelinePoint[];
  avgConfidence: number;
}

export interface GenreAtlas {
  genre: string;
  analyses: AtlasAnalysisRow[];
  moodDistribution: MoodSlice[];
  topArtists: ArtistSlice[];
  themeFrequency: ThemeSlice[];
}

// ---------------------------------------------------------------------------
// Internal shape — every row read from `analyses_with_song` we care about.
// Kept loose because Stream C may extend `result` over time.
// ---------------------------------------------------------------------------

interface AnalysisWithSongRow {
  analysis_id: string;
  share_slug: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  release_year: number | null;
  result: Record<string, Json | undefined> | null;
  created_at: string;
  is_public: boolean;
  system_seed: boolean;
}

const VISIBLE_ROW_FILTER = 'is_public.eq.true,system_seed.eq.true';

function readString(value: Json | undefined): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function readNumber(value: Json | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStringArray(value: Json | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function mapRow(row: AnalysisWithSongRow): AtlasAnalysisRow | null {
  if (!row.title || !row.artist) return null;
  const result = row.result ?? {};
  return {
    analysisId: row.analysis_id,
    shareSlug: row.share_slug,
    title: row.title,
    artist: row.artist,
    album: row.album,
    releaseYear: row.release_year ?? null,
    mood: readString(result.mood) ?? 'Unknown',
    confidence: readNumber(result.confidence) ?? 0,
    themes: readStringArray(result.themes),
    createdAt: row.created_at,
  };
}

function moodSlicesFrom(rows: AtlasAnalysisRow[]): MoodSlice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.mood, (counts.get(row.mood) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([mood, count]) => ({ mood, count, color: moodToColor(mood) }))
    .sort((a, b) => b.count - a.count);
}

function dominantMoodFrom(rows: AtlasAnalysisRow[]): string {
  const slices = moodSlicesFrom(rows);
  return slices[0]?.mood ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Genre — read from `result.genre` if present (seeded path), fall back to
// `result.engines.keyword.genre`.
// ---------------------------------------------------------------------------

function readGenre(result: Record<string, Json | undefined> | null): string {
  if (!result) return 'Unknown';
  const direct = readString(result.genre);
  if (direct) return direct;
  const engines = result.engines;
  if (engines && typeof engines === 'object' && !Array.isArray(engines)) {
    const keyword = (engines as Record<string, Json>).keyword;
    if (keyword && typeof keyword === 'object' && !Array.isArray(keyword)) {
      const fromKeyword = readString((keyword as Record<string, Json>).genre);
      if (fromKeyword) return fromKeyword;
    }
  }
  return 'Unknown';
}

// ---------------------------------------------------------------------------
// Slugifier (kept in lockstep with lib/atlas/slug.ts).
// ---------------------------------------------------------------------------

function slugifyArtist(artist: string): string {
  return artist
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Resilient row fetcher — handles "view doesn't exist yet" cleanly.
// ---------------------------------------------------------------------------

async function fetchVisibleRows(filter?: {
  artist?: string;
  genre?: string;
}): Promise<{ rows: AnalysisWithSongRow[]; viewMissing: boolean }> {
  // `getAdminSupabase()` throws when env vars are missing — fail soft so
  // `/atlas` renders the empty-state Card on a fresh local checkout
  // without a configured Supabase instance.
  let supabase: ReturnType<typeof getAdminSupabase> | null = null;
  try {
    supabase = getAdminSupabase();
  } catch {
    return { rows: [], viewMissing: true };
  }
  if (!supabase) return { rows: [], viewMissing: true };
  // `analyses_with_song` is a Postgres view created in
  // 0003_atlas_view_helpers.sql — we keep `lib/supabase/database.types.ts`
  // (owned by Stream A) untouched, so cast through `unknown` to access the
  // view without baking the name into the typed client. The runtime call
  // is identical to a typed `.from(...).select(...).or(...).eq(...)`.
  interface LooseBuilder {
    select: (cols: string) => LooseBuilder;
    or: (filter: string) => LooseBuilder;
    eq: (col: string, value: string) => LooseBuilder;
  }
  interface LooseClient {
    from: (table: string) => LooseBuilder;
  }
  const loose = supabase as unknown as LooseClient;
  let builder = loose
    .from('analyses_with_song')
    .select(
      'analysis_id, share_slug, title, artist, album, release_year, result, created_at, is_public, system_seed',
    )
    .or(VISIBLE_ROW_FILTER);

  if (filter?.artist) {
    builder = builder.eq('artist', filter.artist);
  }

  // The Supabase builder is thenable (its `.then` is the trigger). Casting
  // to a Promise of our row shape keeps `await` happy without leaking the
  // generated PostgrestFilterBuilder type into this file.
  const awaitable = builder as unknown as Promise<{
    data: AnalysisWithSongRow[] | null;
    error: { message: string } | null;
  }>;
  const { data, error } = await awaitable;
  if (error) {
    const message = (error.message ?? '').toLowerCase();
    const missing =
      message.includes('does not exist') ||
      message.includes('analyses_with_song') ||
      message.includes('relation') ||
      message.includes('schema cache');
    return { rows: [], viewMissing: missing };
  }
  let rows = (data ?? []) as AnalysisWithSongRow[];
  if (filter?.genre) {
    rows = rows.filter((row) => readGenre(row.result) === filter.genre);
  }
  return { rows, viewMissing: false };
}

// ---------------------------------------------------------------------------
// getAtlasOverview
// ---------------------------------------------------------------------------

export async function getAtlasOverview(): Promise<AtlasOverview> {
  const { rows } = await fetchVisibleRows();

  // Keep raw row + mapped row paired so we can read the genre from the raw
  // result jsonb without an extra lookup. Rows that fail to map (missing
  // title/artist) drop out of both arrays simultaneously.
  const pairs: Array<{ raw: AnalysisWithSongRow; mapped: AtlasAnalysisRow }> = [];
  for (const raw of rows) {
    const mapped = mapRow(raw);
    if (mapped) pairs.push({ raw, mapped });
  }
  const mapped = pairs.map((p) => p.mapped);

  // Mood distribution (global).
  const moodDistribution = moodSlicesFrom(mapped);

  // Genre distribution.
  const genreGroups = new Map<string, AtlasAnalysisRow[]>();
  for (const pair of pairs) {
    const genre = readGenre(pair.raw.result);
    const bucket = genreGroups.get(genre) ?? [];
    bucket.push(pair.mapped);
    genreGroups.set(genre, bucket);
  }
  const genreDistribution: GenreSlice[] = Array.from(genreGroups.entries())
    .map(([genre, group]) => {
      const dominantMood = dominantMoodFrom(group);
      return {
        genre,
        count: group.length,
        dominantMood,
        color: moodToColor(dominantMood),
      };
    })
    .sort((a, b) => b.count - a.count);

  // Top artists.
  const artistGroups = new Map<string, AtlasAnalysisRow[]>();
  for (const row of mapped) {
    const bucket = artistGroups.get(row.artist) ?? [];
    bucket.push(row);
    artistGroups.set(row.artist, bucket);
  }
  const topArtists: ArtistSlice[] = Array.from(artistGroups.entries())
    .map(([artist, group]) => {
      const dominantMood = dominantMoodFrom(group);
      return {
        artist,
        artistSlug: slugifyArtist(artist),
        count: group.length,
        dominantMood,
        color: moodToColor(dominantMood),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totalAnalyses: mapped.length,
    totalArtists: artistGroups.size,
    moodDistribution,
    genreDistribution,
    topArtists,
  };
}

// ---------------------------------------------------------------------------
// getArtistAtlas
// ---------------------------------------------------------------------------

export async function getArtistAtlas(
  artistName: string,
): Promise<ArtistAtlas | null> {
  const { rows } = await fetchVisibleRows({ artist: artistName });
  const mapped = rows
    .map(mapRow)
    .filter((row): row is AtlasAnalysisRow => row !== null);

  if (mapped.length === 0) return null;

  const moodDistribution = moodSlicesFrom(mapped);

  // Mood over time — bucket by release_year (fall back to year of created_at).
  const byYear = new Map<number, Map<string, number>>();
  for (const row of mapped) {
    const year =
      row.releaseYear ?? new Date(row.createdAt).getUTCFullYear();
    const yearBucket = byYear.get(year) ?? new Map<string, number>();
    yearBucket.set(row.mood, (yearBucket.get(row.mood) ?? 0) + 1);
    byYear.set(year, yearBucket);
  }
  const moodOverTime: MoodTimelinePoint[] = Array.from(byYear.entries())
    .map(([period, moods]) => ({
      period,
      moods: Object.fromEntries(moods),
    }))
    .sort((a, b) => a.period - b.period);

  const avgConfidence =
    mapped.reduce((sum, row) => sum + row.confidence, 0) / mapped.length;

  // Sort analyses newest first for the listing.
  const analyses = [...mapped].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    artist: artistName,
    analyses,
    moodDistribution,
    moodOverTime,
    avgConfidence,
  };
}

// ---------------------------------------------------------------------------
// getGenreAtlas
// ---------------------------------------------------------------------------

export async function getGenreAtlas(
  genreName: string,
): Promise<GenreAtlas | null> {
  const { rows } = await fetchVisibleRows({ genre: genreName });
  const mapped = rows
    .map(mapRow)
    .filter((row): row is AtlasAnalysisRow => row !== null);

  if (mapped.length === 0) return null;

  const moodDistribution = moodSlicesFrom(mapped);

  const artistGroups = new Map<string, AtlasAnalysisRow[]>();
  for (const row of mapped) {
    const bucket = artistGroups.get(row.artist) ?? [];
    bucket.push(row);
    artistGroups.set(row.artist, bucket);
  }
  const topArtists: ArtistSlice[] = Array.from(artistGroups.entries())
    .map(([artist, group]) => {
      const dominantMood = dominantMoodFrom(group);
      return {
        artist,
        artistSlug: slugifyArtist(artist),
        count: group.length,
        dominantMood,
        color: moodToColor(dominantMood),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Theme frequency across the genre.
  const themeCounts = new Map<string, number>();
  for (const row of mapped) {
    for (const theme of row.themes) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
  }
  const themeFrequency: ThemeSlice[] = Array.from(themeCounts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);

  const analyses = [...mapped].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    genre: genreName,
    analyses,
    moodDistribution,
    topArtists,
    themeFrequency,
  };
}
