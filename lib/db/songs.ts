/**
 * Song record helpers.
 *
 * All writes go through the service-role admin client (Stream D's source
 * adapters call into here from server-only code). Reads are world-allowed
 * by RLS, so we use the admin client for consistency and to avoid the
 * cookie round-trip when Stream D is fetching for an unauthenticated user.
 */

import 'server-only';
import { getAdminSupabase } from '@/lib/supabase/admin';
import type { SongInsert, SongRow } from '@/lib/supabase/database.types';

export interface SongExternalIds {
  spotifyId?: string | null;
  geniusId?: number | null;
  musicbrainzRecordingId?: string | null;
  titleArtist?: { title: string; artist: string } | null;
}

/**
 * Fetch a single song by its primary key.
 */
export async function getSongById(id: string): Promise<SongRow | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`[db/songs.getSongById] ${error.message}`);
  }
  return data;
}

/**
 * Resolve a song by any combination of external IDs or (title, artist).
 * Checked in priority order: spotify_id → genius_id → musicbrainz → name.
 * Returns the first match.
 */
export async function findSongByExternalIds(
  ids: SongExternalIds,
): Promise<SongRow | null> {
  const supabase = getAdminSupabase();

  if (ids.spotifyId) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('spotify_id', ids.spotifyId)
      .maybeSingle();
    if (error) throw new Error(`[db/songs.findSongByExternalIds:spotify] ${error.message}`);
    if (data) return data;
  }

  if (typeof ids.geniusId === 'number') {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('genius_id', ids.geniusId)
      .maybeSingle();
    if (error) throw new Error(`[db/songs.findSongByExternalIds:genius] ${error.message}`);
    if (data) return data;
  }

  if (ids.musicbrainzRecordingId) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('musicbrainz_recording_id', ids.musicbrainzRecordingId)
      .maybeSingle();
    if (error) throw new Error(`[db/songs.findSongByExternalIds:mbid] ${error.message}`);
    if (data) return data;
  }

  if (ids.titleArtist) {
    const { title, artist } = ids.titleArtist;
    // Unique index is on (lower(title), lower(artist)). We can't use .eq with
    // an expression — match against the raw values normalized in JS.
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .ilike('title', title)
      .ilike('artist', artist)
      .maybeSingle();
    if (error) throw new Error(`[db/songs.findSongByExternalIds:titleArtist] ${error.message}`);
    if (data) return data;
  }

  return null;
}

/**
 * Insert a new song or update by matching external ID / (title, artist).
 *
 * Strategy: try to find an existing row first, then UPSERT. Sibling external
 * IDs found in `input` are merged onto the existing row so a record that
 * started as Spotify-only can gain a Genius ID later.
 */
export async function upsertSong(input: SongInsert): Promise<SongRow> {
  const supabase = getAdminSupabase();

  const existing = await findSongByExternalIds({
    spotifyId: input.spotify_id ?? null,
    geniusId: input.genius_id ?? null,
    musicbrainzRecordingId: input.musicbrainz_recording_id ?? null,
    titleArtist: { title: input.title, artist: input.artist },
  });

  if (existing) {
    // Merge: only overwrite fields that are non-null in `input`.
    const patch: Partial<SongInsert> = {};
    const keys: Array<keyof SongInsert> = [
      'spotify_id',
      'genius_id',
      'musicbrainz_recording_id',
      'title',
      'artist',
      'album',
      'release_year',
      'cover_url',
      'preview_url',
      'acousticbrainz_features',
    ];
    for (const key of keys) {
      const next = input[key];
      if (next !== undefined && next !== null) {
        (patch as Record<string, unknown>)[key] = next;
      }
    }

    if (Object.keys(patch).length === 0) return existing;

    const { data, error } = await supabase
      .from('songs')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`[db/songs.upsertSong:update] ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('songs')
    .insert(input)
    .select('*')
    .single();

  if (error) throw new Error(`[db/songs.upsertSong:insert] ${error.message}`);
  return data;
}
