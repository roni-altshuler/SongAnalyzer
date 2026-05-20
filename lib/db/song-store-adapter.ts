/**
 * Adapter bridging the snake_case `SongRow` shape (Stream A / Supabase) with
 * the camelCase `Song` shape (Stream D / external sources / `resolveSong`).
 *
 * `lib/sources/resolve.ts` is decoupled from Supabase via the `SongStore`
 * interface in `lib/sources/types.ts`. This file is the production wiring:
 * it implements that interface against `lib/db/songs.ts`. API routes that
 * want resolver-backed persistence should pass `createSongStore()` to
 * `resolveSong()`.
 */

import 'server-only';
import type { Song, SongStore, AcousticFeatures } from '@/lib/sources/types';
import type { SongInsert, SongRow, Json } from '@/lib/supabase/database.types';
import { findSongByExternalIds, upsertSong } from './songs';

function isJsonObject(value: Json | null | undefined): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Convert a Supabase `SongRow` into the canonical `Song` shape used by the
 * sources/resolver layer. Nulls become undefineds; snake_case becomes
 * camelCase; the jsonb `acousticbrainz_features` is narrowed to
 * `AcousticFeatures` if present.
 */
export function rowToSong(row: SongRow): Song {
  const features: AcousticFeatures | undefined = isJsonObject(row.acousticbrainz_features)
    ? (row.acousticbrainz_features as unknown as AcousticFeatures)
    : undefined;

  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album ?? undefined,
    year: row.release_year ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    spotifyId: row.spotify_id ?? undefined,
    geniusId: row.genius_id ?? undefined,
    mbid: row.musicbrainz_recording_id ?? undefined,
    acousticFeatures: features,
  };
}

/**
 * Convert a `Song` (camelCase, undefineds) into a `SongInsert` (snake_case,
 * nulls). Required fields (`title`, `artist`) are passed through verbatim;
 * everything else collapses undefined → null so Supabase's column defaults
 * apply correctly.
 */
export function songToInsert(song: Song): SongInsert {
  return {
    spotify_id: song.spotifyId ?? null,
    genius_id: song.geniusId ?? null,
    musicbrainz_recording_id: song.mbid ?? null,
    title: song.title,
    artist: song.artist,
    album: song.album ?? null,
    release_year: song.year ?? null,
    cover_url: song.coverUrl ?? null,
    preview_url: song.previewUrl ?? null,
    acousticbrainz_features: (song.acousticFeatures ?? null) as Json | null,
  };
}

/**
 * Production implementation of the resolver's `SongStore` contract.
 *
 * Usage from an API route:
 *   const song = await resolveSong(query, { store: createSongStore() });
 */
export function createSongStore(): SongStore {
  return {
    async findByExternalIds(ids) {
      const row = await findSongByExternalIds({
        spotifyId: ids.spotifyId,
        geniusId: ids.geniusId,
        musicbrainzRecordingId: ids.mbid,
      });
      return row ? rowToSong(row) : null;
    },
    async upsert(song) {
      const row = await upsertSong(songToInsert(song));
      return rowToSong(row);
    },
  };
}
