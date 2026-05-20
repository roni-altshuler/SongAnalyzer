import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveSong } from '@/lib/sources/resolve';
import {
  __resetSpotifyTokenCache,
} from '@/lib/sources/spotify';
import {
  __resetMusicBrainzRateLimit,
} from '@/lib/sources/musicbrainz';
import type { Song, SongStore } from '@/lib/sources/types';

/**
 * Unit tests for `resolveSong`. We stub `globalThis.fetch` with a router so
 * each test fully controls the HTTP boundary — NO real network calls.
 */

interface FetchHandlers {
  spotifyToken?: () => Response | Promise<Response>;
  spotifySearch?: (url: URL) => Response | Promise<Response>;
  musicbrainzSearch?: (url: URL) => Response | Promise<Response>;
  acousticbrainz?: (url: URL) => Response | Promise<Response>;
  geniusSearch?: (url: URL) => Response | Promise<Response>;
}

function installFetchRouter(handlers: FetchHandlers) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url,
    );

    if (url.hostname === 'accounts.spotify.com' && url.pathname === '/api/token') {
      if (!handlers.spotifyToken) throw new Error('unexpected spotify token request');
      return handlers.spotifyToken();
    }
    if (url.hostname === 'api.spotify.com' && url.pathname.endsWith('/search')) {
      if (!handlers.spotifySearch) throw new Error('unexpected spotify search');
      return handlers.spotifySearch(url);
    }
    if (url.hostname === 'musicbrainz.org') {
      if (!handlers.musicbrainzSearch) throw new Error('unexpected MB request');
      return handlers.musicbrainzSearch(url);
    }
    if (url.hostname === 'acousticbrainz.org') {
      if (!handlers.acousticbrainz) throw new Error('unexpected AB request');
      return handlers.acousticbrainz(url);
    }
    if (url.hostname === 'api.genius.com') {
      if (!handlers.geniusSearch) throw new Error('unexpected genius request');
      return handlers.geniusSearch(url);
    }
    throw new Error(`unexpected fetch: ${url.toString()}`);
  });
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const tokenOk = () =>
  jsonResponse({ access_token: 'test-token', expires_in: 3600 });

const spotifySearchOk = () =>
  jsonResponse({
    tracks: {
      items: [
        {
          id: 'sp-bad-guy',
          name: 'Bad Guy',
          artists: [{ id: 'a1', name: 'Billie Eilish' }],
          album: {
            id: 'al1',
            name: 'WHEN WE ALL FALL ASLEEP',
            release_date: '2019-03-29',
            images: [{ url: 'https://img/cover.jpg', height: 640, width: 640 }],
          },
          preview_url: 'https://p.scdn.co/preview.mp3',
          popularity: 90,
        },
      ],
    },
  });

const mbSearchOk = () =>
  jsonResponse({
    recordings: [
      {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        score: 100,
        title: 'Bad Guy',
        'artist-credit': [{ name: 'Billie Eilish', artist: { name: 'Billie Eilish' } }],
      },
    ],
  });

const abOk = () =>
  jsonResponse({
    rhythm: { bpm: 135 },
    tonal: { key_key: 'G', key_scale: 'minor' as const },
    lowlevel: { average_loudness: 0.8 },
    highlevel: {
      danceability: { all: { danceable: 0.72 } },
      mood_happy: { all: { happy: 0.31 } },
    },
  });

const geniusSearchOk = () =>
  jsonResponse({
    response: {
      hits: [
        {
          type: 'song',
          result: {
            id: 4448495,
            title: 'bad guy',
            primary_artist: { name: 'Billie Eilish' },
            song_art_image_url: 'https://img/genius.jpg',
          },
        },
      ],
    },
  });

beforeEach(() => {
  __resetSpotifyTokenCache();
  __resetMusicBrainzRateLimit();
  process.env.SPOTIFY_CLIENT_ID = 'test-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-secret';
  process.env.GENIUS_ACCESS_TOKEN = 'test-genius';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.GENIUS_ACCESS_TOKEN;
});

describe('resolveSong', () => {
  it('merges Spotify + MusicBrainz + AcousticBrainz + Genius on the happy path', async () => {
    installFetchRouter({
      spotifyToken: tokenOk,
      spotifySearch: spotifySearchOk,
      musicbrainzSearch: mbSearchOk,
      acousticbrainz: abOk,
      geniusSearch: geniusSearchOk,
    });

    const song = await resolveSong('bad guy billie eilish');

    expect(song.title).toBe('Bad Guy');
    expect(song.artist).toBe('Billie Eilish');
    expect(song.album).toBe('WHEN WE ALL FALL ASLEEP');
    expect(song.year).toBe(2019);
    expect(song.coverUrl).toBe('https://img/cover.jpg');
    expect(song.previewUrl).toBe('https://p.scdn.co/preview.mp3');
    expect(song.spotifyId).toBe('sp-bad-guy');
    expect(song.mbid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(song.geniusId).toBe(4448495);
    expect(song.acousticFeatures?.bpm).toBe(135);
    expect(song.acousticFeatures?.key).toBe('G');
    expect(song.acousticFeatures?.scale).toBe('minor');
    expect(song.acousticFeatures?.danceability).toBeCloseTo(0.72);
    expect(song.acousticFeatures?.valence).toBeCloseTo(0.31);
  });

  it('still returns a partial Song when MusicBrainz fails', async () => {
    installFetchRouter({
      spotifyToken: tokenOk,
      spotifySearch: spotifySearchOk,
      musicbrainzSearch: () =>
        new Response('upstream boom', { status: 503 }),
      // AB still wired but should never be hit because MB failed.
      acousticbrainz: () =>
        new Response('should not be called', { status: 500 }),
      geniusSearch: geniusSearchOk,
    });

    const song = await resolveSong('bad guy billie eilish');

    expect(song.spotifyId).toBe('sp-bad-guy');
    expect(song.title).toBe('Bad Guy');
    expect(song.mbid).toBeUndefined();
    expect(song.acousticFeatures).toBeUndefined();
    // Genius still resolves.
    expect(song.geniusId).toBe(4448495);
  });

  it('throws when Spotify search fails (no primary signal)', async () => {
    installFetchRouter({
      spotifyToken: tokenOk,
      spotifySearch: () =>
        new Response('bad request', { status: 400 }),
    });

    await expect(resolveSong('???')).rejects.toThrow(/Spotify .* failed/);
  });

  it('throws when Spotify returns zero hits', async () => {
    installFetchRouter({
      spotifyToken: tokenOk,
      spotifySearch: () => jsonResponse({ tracks: { items: [] } }),
    });

    await expect(resolveSong('a query with no matches')).rejects.toThrow(
      /no Spotify results/,
    );
  });

  it('uses the injected SongStore to short-circuit cached lookups', async () => {
    const cached: Song = {
      id: 'db-1',
      title: 'Bad Guy',
      artist: 'Billie Eilish',
      spotifyId: 'sp-bad-guy',
    };
    const findByExternalIds = vi.fn<SongStore['findByExternalIds']>(async () => cached);
    const upsert = vi.fn<SongStore['upsert']>(async (s) => s);

    installFetchRouter({
      spotifyToken: tokenOk,
      spotifySearch: spotifySearchOk,
      // MB/AB/Genius handlers omitted — they must NOT be called.
    });

    const result = await resolveSong('bad guy', {
      findByExternalIds,
      upsert,
    });

    expect(findByExternalIds).toHaveBeenCalledWith({ spotifyId: 'sp-bad-guy' });
    expect(upsert).not.toHaveBeenCalled();
    expect(result.id).toBe('db-1');
  });
});
