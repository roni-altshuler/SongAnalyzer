/**
 * Mood Atlas seed SQL builder.
 *
 * Reads `atlas-seed-lyrics.ts`, runs each entry through `analyzeKeyword`
 * (deterministic — no HF needed), and emits idempotent SQL `INSERT`s for
 * the `songs` and `analyses` tables to stdout. The result is meant to be
 * piped into `supabase/seed.sql`:
 *
 *   npx tsx lib/seeds/build-seed-sql.ts > supabase/seed.sql
 *
 * If `tsx` isn't installed yet:
 *
 *   npm install -D tsx
 *
 * Every analysis row gets a deterministic UUID (derived from
 * `artist|title|year`) and a nanoid-style 12-char `share_slug`. Determinism
 * means re-running the script produces identical SQL — the file diff is
 * empty unless the seed corpus or the keyword engine changes.
 *
 * All seeded analyses are flagged `system_seed = true` and `is_public =
 * true`, with `user_id = null`, so they show up on /atlas and individual
 * /share/<slug> pages without owning a profile.
 */

import { createHash } from 'node:crypto';
import { analyzeKeyword } from '../analysis/keyword';
import { moodToColor } from '../analysis/palette';
import { ATLAS_SEED_LYRICS, type AtlasSeedEntry } from './atlas-seed-lyrics';

// ---------------------------------------------------------------------------
// Deterministic IDs — same seed produces same SQL across runs.
// ---------------------------------------------------------------------------

/** v5-style deterministic UUID from a stable key. */
function deterministicUuid(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex');
  // Format as a v4-shape UUID; the "version" nibble is informational only —
  // Postgres accepts any 36-char hex-with-dashes string in a uuid column.
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    '8' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

/** 12-char URL-safe slug derived from the same key — matches nanoid(12) shape. */
function deterministicSlug(key: string): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const hash = createHash('sha256').update('slug:' + key).digest();
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[hash[i] % alphabet.length];
  }
  return out;
}

// ---------------------------------------------------------------------------
// SQL escaping
// ---------------------------------------------------------------------------

function sqlString(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function sqlJson(value: unknown): string {
  // Wrap the JSON literal in a cast so Postgres accepts it as jsonb directly.
  return sqlString(JSON.stringify(value)) + '::jsonb';
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

interface SeedSong {
  id: string;
  title: string;
  artist: string;
  release_year: number;
}

interface SeedAnalysis {
  id: string;
  song_id: string;
  mood: string;
  share_slug: string;
  result: Record<string, unknown>;
  lyrics_excerpt: string;
}

function buildRows(entries: AtlasSeedEntry[]): {
  songs: SeedSong[];
  analyses: SeedAnalysis[];
} {
  const songs: SeedSong[] = [];
  const analyses: SeedAnalysis[] = [];

  for (const entry of entries) {
    const songKey = `${entry.artist}|${entry.title}|${entry.year}`;
    const songId = deterministicUuid('song:' + songKey);
    const analysisId = deterministicUuid('analysis:' + songKey);
    const shareSlug = deterministicSlug(songKey);

    const kw = analyzeKeyword(entry.lyrics);
    const moodColor = moodToColor(kw.mood);

    songs.push({
      id: songId,
      title: entry.title,
      artist: entry.artist,
      release_year: entry.year,
    });

    // Genre is persisted on the analysis result so the atlas view can roll
    // it up without needing a schema change to the `songs` table.
    analyses.push({
      id: analysisId,
      song_id: songId,
      mood: kw.mood,
      share_slug: shareSlug,
      lyrics_excerpt: entry.lyrics.slice(0, 500),
      result: {
        mood: kw.mood,
        vibe: kw.vibe,
        energy: kw.energy,
        sentiment: kw.sentiment,
        themes: kw.themes,
        detailedAnalysis: kw.detailedAnalysis,
        confidence: kw.confidence,
        wordCount: kw.wordCount,
        genre: entry.genre,
        moodColor,
        engines: {
          transformer: { status: 'skipped', reason: 'seed' },
          keyword: { status: 'ok', scores: kw.scores },
        },
      },
    });
  }

  return { songs, analyses };
}

// ---------------------------------------------------------------------------
// SQL emission
// ---------------------------------------------------------------------------

function emitSongsSql(songs: SeedSong[]): string {
  if (songs.length === 0) return '';
  const values = songs
    .map(
      (s) =>
        `  (${[
          sqlString(s.id),
          sqlString(s.title),
          sqlString(s.artist),
          String(s.release_year),
        ].join(', ')})`,
    )
    .join(',\n');

  return [
    '-- Songs (system seeds — synthetic artists, original lyrics).',
    'insert into public.songs (id, title, artist, release_year) values',
    values,
    'on conflict (id) do nothing;',
    '',
  ].join('\n');
}

function emitAnalysesSql(analyses: SeedAnalysis[]): string {
  if (analyses.length === 0) return '';
  const values = analyses
    .map(
      (a) =>
        `  (${[
          sqlString(a.id),
          sqlString(a.song_id),
          sqlString('lyrics'),
          sqlString(a.lyrics_excerpt),
          sqlJson(a.result),
          sqlString('en'),
          'false', // translated
          'true', // is_public
          sqlString(a.share_slug),
          'true', // system_seed
        ].join(', ')})`,
    )
    .join(',\n');

  return [
    '-- Analyses (one keyword-engine analysis per seed song).',
    'insert into public.analyses (',
    '  id, song_id, mode, lyrics_excerpt, result, language,',
    '  translated, is_public, share_slug, system_seed',
    ') values',
    values,
    'on conflict (id) do nothing;',
    '',
  ].join('\n');
}

function emitShareRowsSql(analyses: SeedAnalysis[]): string {
  if (analyses.length === 0) return '';
  const values = analyses
    .map((a) => `  (${sqlString(a.id)}, 0)`)
    .join(',\n');
  return [
    '-- Share rows (one per public analysis so /share/<slug> can resolve them).',
    'insert into public.shares (analysis_id, view_count) values',
    values,
    'on conflict (analysis_id) do nothing;',
    '',
  ].join('\n');
}

function emitRefreshSql(): string {
  return [
    '-- Materialized view refresh — required for the atlas dashboard to see',
    '-- these rows. If 0002_atlas_view.sql has not been applied yet (e.g.,',
    '-- on a fresh local DB), this select is wrapped in a DO block so the',
    '-- seed file does not fail loading.',
    'do $$',
    'begin',
    '  if exists (',
    '    select 1 from pg_proc where proname = \'refresh_atlas_aggregates\'',
    '  ) then',
    '    perform public.refresh_atlas_aggregates();',
    '  end if;',
    'end $$;',
    '',
  ].join('\n');
}

function buildHeader(count: number): string {
  const generated = new Date().toISOString();
  return [
    '-- ============================================================================',
    '-- SongAnalyzer Mood Atlas seed.',
    '--',
    '-- AUTOGENERATED by `lib/seeds/build-seed-sql.ts`. Do not edit by hand;',
    '-- regenerate with:',
    '--   npx tsx lib/seeds/build-seed-sql.ts > supabase/seed.sql',
    '--',
    `-- Generated:   ${generated}`,
    `-- Seed count:  ${count} (synthetic artists, original lyrics)`,
    '--',
    '-- All rows are deterministic: re-running the script produces identical SQL',
    '-- unless `atlas-seed-lyrics.ts` or the keyword engine changes.',
    '-- ============================================================================',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const { songs, analyses } = buildRows(ATLAS_SEED_LYRICS);
  const sql =
    buildHeader(ATLAS_SEED_LYRICS.length) +
    emitSongsSql(songs) +
    emitAnalysesSql(analyses) +
    emitShareRowsSql(analyses) +
    emitRefreshSql();

  // eslint-disable-next-line no-console
  process.stdout.write(sql);
}

main();
