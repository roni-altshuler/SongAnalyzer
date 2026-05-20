import 'server-only';

import { getAcousticBrainzFeatures } from './acousticbrainz';
import { searchGenius } from './genius';
import { searchMusicBrainz } from './musicbrainz';
import { searchSpotify } from './spotify';
import type { Song, SongStore } from './types';

/**
 * Orchestrate Spotify + MusicBrainz + AcousticBrainz + Genius into a single
 * canonical `Song` record.
 *
 * Pipeline:
 *   1. Spotify search (primary signal — gives us title/artist/album/cover/
 *      preview, plus a stable `spotifyId`). If Spotify yields nothing we
 *      throw — without that primary signal we can't trust the rest.
 *   2. In parallel, with the top Spotify hit's "Title Artist" string:
 *        - MusicBrainz recording search -> AcousticBrainz features
 *        - Genius search to attach a `geniusId` (for link-outs only)
 *   3. Merge into a `Song`, with Spotify fields taking precedence on any
 *      collision (Spotify is the most consistently structured source).
 *
 * Individual source failures are logged but never abort the resolve — partial
 * results are the norm. The `SongStore` is injected (interface-typed) so
 * Stream A's `lib/db/songs.ts` can plug in later without us depending on it
 * during parallel development.
 */
export async function resolveSong(
  query: string,
  store?: SongStore,
): Promise<Song> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('resolveSong: query is empty');

  // 1. Spotify is mandatory — it gives us identity + preview.
  const spotifyHits = await searchSpotify(trimmed);
  const top = spotifyHits[0];
  if (!top) throw new Error('resolveSong: no Spotify results');

  const base: Song = {
    title: top.song.title,
    artist: top.song.artist,
    album: top.song.album,
    year: top.song.year,
    coverUrl: top.song.coverUrl,
    previewUrl: top.song.previewUrl,
    spotifyId: top.song.spotifyId ?? top.id,
  };

  // Short-circuit: if we've already resolved this Spotify ID before, return
  // the cached record. Skipped when no store is wired in (parallel-dev mode).
  if (store && base.spotifyId) {
    try {
      const cached = await store.findByExternalIds({ spotifyId: base.spotifyId });
      if (cached) return cached;
    } catch (err) {
      console.warn('resolveSong: store.findByExternalIds failed', err);
    }
  }

  // 2. Enrich in parallel. Each branch is wrapped in its own try/catch so a
  //    failure (timeout, 503, rate-limit) only drops that source's fields,
  //    not the whole resolution.
  const enrichQuery = `${base.title} ${base.artist}`;

  const [mbidAndFeatures, geniusId] = await Promise.all([
    (async (): Promise<{ mbid?: string; acousticFeatures?: Song['acousticFeatures'] }> => {
      try {
        const hits = await searchMusicBrainz(enrichQuery);
        const best = hits[0];
        if (!best) return {};
        const features = await getAcousticBrainzFeatures(best.recordingId).catch((err) => {
          console.warn('resolveSong: AcousticBrainz lookup failed', err);
          return null;
        });
        return {
          mbid: best.recordingId,
          acousticFeatures: features ?? undefined,
        };
      } catch (err) {
        console.warn('resolveSong: MusicBrainz lookup failed', err);
        return {};
      }
    })(),
    (async (): Promise<number | undefined> => {
      try {
        const hits = await searchGenius(enrichQuery);
        return hits[0]?.song.geniusId;
      } catch (err) {
        console.warn('resolveSong: Genius lookup failed', err);
        return undefined;
      }
    })(),
  ]);

  // 3. Merge. Spotify wins on overlapping fields; enrichment fills gaps.
  const merged: Song = {
    ...base,
    mbid: mbidAndFeatures.mbid,
    acousticFeatures: mbidAndFeatures.acousticFeatures,
    geniusId,
  };

  if (store) {
    try {
      return await store.upsert(merged);
    } catch (err) {
      console.warn('resolveSong: store.upsert failed; returning unpersisted record', err);
    }
  }

  return merged;
}
