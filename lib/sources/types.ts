/**
 * Shared types for the external-data-sources module.
 *
 * These types intentionally live next to the source adapters (Spotify, Genius,
 * MusicBrainz, AcousticBrainz) and are independent of the wider app-level
 * `AnalysisResult` types in `lib/types.ts` (owned by Stream C). Keeping a
 * separate module avoids cross-stream churn during parallel development and
 * lets Stream A's `lib/db/songs.ts` import from here without pulling in
 * analyzer types.
 */

/**
 * Open audio features harvested from AcousticBrainz (or, in the future,
 * computed from the Spotify 30-second preview by the client-side analyser).
 *
 * Every field is optional because AcousticBrainz returns a sparsely populated
 * document — and post-2022 recordings often have no data at all.
 */
export interface AcousticFeatures {
  bpm?: number;
  key?: string;
  scale?: 'major' | 'minor';
  /** 0..1 — derived from AB's `highlevel.danceability` probability. */
  danceability?: number;
  /** 0..1 — derived from AB's `highlevel.mood_happy` probability. */
  valence?: number;
  /** 0..1 — derived from AB's `lowlevel.average_loudness`. */
  energy?: number;
  /** Loudness in dB if available. */
  loudness?: number;
}

/**
 * The canonical song record passed between the source adapters, the resolver,
 * the `songs` DB table, and the API routes. Optional fields reflect the
 * "best effort" nature of external metadata: a single source rarely fills
 * every column.
 */
export interface Song {
  /** Internal DB id once persisted; absent before the first upsert. */
  id?: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  /** Album-art URL (we prefer the largest Spotify image). */
  coverUrl?: string;
  /** Spotify's 30-second MP3 preview URL — may be null for some markets. */
  previewUrl?: string;
  spotifyId?: string;
  geniusId?: number;
  /** MusicBrainz recording ID (UUID). */
  mbid?: string;
  acousticFeatures?: AcousticFeatures;
}

/**
 * A single search-result row. Used by `/api/songs/search` typeahead and
 * by `resolveSong()` to pick the best Spotify candidate.
 */
export interface SearchHit {
  id: string;
  /** Source-provided relevance score, or a synthesized 0..1 confidence. */
  score: number;
  /** Subset of `Song` fields known at search time. */
  song: Pick<Song, 'title' | 'artist' | 'album' | 'year' | 'coverUrl' | 'previewUrl' | 'spotifyId' | 'geniusId' | 'mbid'>;
}

/**
 * Persistence contract consumed by `resolveSong()`. The real implementation
 * lives in Stream A's `lib/db/songs.ts`; defining the interface here keeps
 * the resolver decoupled and unit-testable.
 */
export interface SongStore {
  findByExternalIds(ids: {
    spotifyId?: string;
    geniusId?: number;
    mbid?: string;
  }): Promise<Song | null>;
  upsert(song: Song): Promise<Song>;
}
