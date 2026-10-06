/** Tab-local metadata only. No lyrics, audio, measurements or credentials. */
import type { Song } from '@/lib/sources/types';
import { artistIdentity, artistKey, readArtistCredits, type ArtistCredit, type ArtistIdentity } from './identity';

export const ARTIST_CONTEXT_KEY = 'song-analyzer.artist-context.v1';
const MAX_PROFILES = 40;
const MAX_TRACKS = 20;
const MAX_BYTES = 256_000;

export interface ArtistTrackContext {
  key: string;
  title: string;
  artist: string;
  artistCredits: ArtistCredit[];
  album?: string;
  year?: number;
  metadataSource?: Song['metadataSource'];
  spotifyId?: string;
  geniusId?: number;
  mbid?: string;
  origin: '/analyze' | '/identify' | '/discover';
}

export interface ArtistContext {
  artist: ArtistCredit;
  tracks: ArtistTrackContext[];
}

export type ArtistContextState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'ready'; context: ArtistContext; temporary: boolean };

// A failed sessionStorage write still allows a useful profile during SPA
// navigation. Reload cannot promise this context; the UI says so explicitly.
const memory = new Map<string, { context: ArtistContext; temporary: boolean }>();

function trackContext(value: unknown): ArtistTrackContext | null {
  if (!value || typeof value !== 'object') return null;
  const song = value as Record<string, unknown>;
  if (typeof song.title !== 'string' || !song.title.trim() || song.title.length > 500
    || typeof song.artist !== 'string' || song.artist.length > 500) return null;
  const spotify = artistIdentity('spotify', song.spotifyId);
  const genius = artistIdentity('genius', song.geniusId);
  const mb = artistIdentity('musicbrainz', song.mbid);
  const identity = spotify ?? genius ?? mb;
  // Do not invent a track identity from its name either.
  if (!identity) return null;
  const metadataSource = song.metadataSource;
  return {
    key: `${identity.provider}:track:${identity.id}`,
    title: song.title, artist: song.artist, artistCredits: readArtistCredits(song.artistCredits),
    album: typeof song.album === 'string' && song.album.length <= 500 ? song.album : undefined,
    year: typeof song.year === 'number' && Number.isInteger(song.year) ? song.year : undefined,
    metadataSource: metadataSource === 'spotify' || metadataSource === 'genius' || metadataSource === 'audd' || metadataSource === 'catalog' ? metadataSource : undefined,
    spotifyId: spotify?.id, geniusId: genius ? Number(genius.id) : undefined, mbid: mb?.id,
    origin: song.origin === '/analyze' || song.origin === '/identify' ? song.origin : '/discover',
  };
}

function belongsTo(track: ArtistTrackContext, identity: ArtistIdentity): boolean {
  return track.artistCredits.some((credit) => credit.id && artistKey({ provider: credit.provider, id: credit.id }) === artistKey(identity));
}

function readContexts(): ArtistContext[] {
  const text = sessionStorage.getItem(ARTIST_CONTEXT_KEY);
  if (!text) return [];
  if (text.length > MAX_BYTES) throw new Error('Artist context is too large');
  const raw = JSON.parse(text) as { version?: unknown; profiles?: unknown };
  if (raw?.version !== 1 || !Array.isArray(raw.profiles)) throw new Error('Unsupported artist context');
  return raw.profiles.slice(0, MAX_PROFILES).flatMap((value: unknown) => {
    if (!value || typeof value !== 'object') return [];
    const profile = value as { artist?: unknown; tracks?: unknown };
    const artist = readArtistCredits([profile.artist])[0];
    const identity = artist && artistIdentity(artist.provider, artist.id);
    if (!artist || !identity || !Array.isArray(profile.tracks)) return [];
    const tracks = profile.tracks.slice(0, MAX_TRACKS).flatMap((value: unknown) => {
      const track = trackContext(value);
      return track && belongsTo(track, identity) ? [track] : [];
    });
    return [{ artist, tracks }];
  });
}

/** Only explicitly credited provider IDs connect a track to a profile. */
export function rememberArtistContext(song: Pick<Song, 'title' | 'artist' | 'artistCredits' | 'album' | 'year' | 'metadataSource' | 'spotifyId' | 'geniusId' | 'mbid'>, origin: string, preferred?: Pick<ArtistCredit, 'provider' | 'id'>): void {
  let profiles: ArtistContext[];
  try { profiles = readContexts(); } catch { profiles = [...memory.values()].map((item) => item.context); }
  // A quota/permission failure must not replace fresh visit metadata with an
  // older persisted snapshot on the next artist click.
  const recent = [...memory.values()].map((item) => item.context);
  const recentKeys = new Set(recent.map((item) => artistKey({ provider: item.artist.provider, id: item.artist.id! })));
  profiles = [...recent, ...profiles.filter((item) => !recentKeys.has(artistKey({ provider: item.artist.provider, id: item.artist.id! })))].slice(0, MAX_PROFILES);
  const credits = readArtistCredits(song.artistCredits);
  // Retain the clicked artist even when a large collaboration exceeds the
  // bounded recent-profile cache. Track credit order remains unchanged.
  const selected = preferred && artistIdentity(preferred.provider, preferred.id);
  const ordered = selected ? [...credits.filter((credit) => credit.id && artistKey({ provider: credit.provider, id: credit.id }) !== artistKey(selected)),
    ...credits.filter((credit) => credit.id && artistKey({ provider: credit.provider, id: credit.id }) === artistKey(selected))] : credits;
  const track = trackContext({ ...song, origin });
  for (const artist of ordered) {
    const identity = artistIdentity(artist.provider, artist.id);
    if (!identity) continue;
    const key = artistKey(identity);
    const existing = profiles.find((item) => item.artist.id && artistKey({ provider: item.artist.provider, id: item.artist.id }) === key);
    const context: ArtistContext = {
      artist,
      tracks: track ? [track, ...(existing?.tracks ?? []).filter((item) => item.key !== track.key)].slice(0, MAX_TRACKS) : existing?.tracks ?? [],
    };
    profiles = [context, ...profiles.filter((item) => item !== existing)].slice(0, MAX_PROFILES);
  }
  let temporary = false;
  try {
    const payload = JSON.stringify({ version: 1, profiles });
    if (payload.length > MAX_BYTES) throw new Error('Artist context is too large');
    sessionStorage.setItem(ARTIST_CONTEXT_KEY, payload);
  } catch { temporary = true; }
  memory.clear();
  for (const context of profiles) {
    if (context.artist.id) memory.set(artistKey({ provider: context.artist.provider, id: context.artist.id }), { context, temporary });
  }
}

export function loadArtistContext(identity: ArtistIdentity): ArtistContextState {
  const key = artistKey(identity);
  const recent = memory.get(key);
  if (recent) return { status: 'ready', ...recent };
  try {
    const context = readContexts().find((item) => item.artist.id && artistKey({ provider: item.artist.provider, id: item.artist.id }) === key);
    if (context) return { status: 'ready', context, temporary: false };
    return { status: 'empty' };
  } catch {
    return { status: 'error' };
  }
}
