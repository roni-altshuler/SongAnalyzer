import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetSpotifyTokenCache,
  searchSpotify,
  isSpotifyConfigured,
  SpotifyNotConfiguredError,
} from '@/lib/sources/spotify';

/**
 * Unit tests for the Spotify adapter focused on token caching.
 */

const tokenBody = (value: string, expiresIn = 3600) =>
  new Response(
    JSON.stringify({ access_token: value, expires_in: expiresIn }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

const searchBody = () =>
  new Response(
    JSON.stringify({
      tracks: {
        items: [
          {
            id: 'sp-1',
            name: 'Song',
            artists: [{ id: 'a', name: 'Artist' }],
            album: {
              id: 'al',
              name: 'Album',
              release_date: '2020-01-01',
              images: [],
            },
            preview_url: null,
            popularity: 60,
          },
        ],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

beforeEach(() => {
  __resetSpotifyTokenCache();
  process.env.SPOTIFY_CLIENT_ID = 'id';
  process.env.SPOTIFY_CLIENT_SECRET = 'secret';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
});

describe('spotify token caching', () => {
  it('reuses the cached token across consecutive calls', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url,
        );
        if (url.hostname === 'accounts.spotify.com') return tokenBody('tok-1');
        if (url.hostname === 'api.spotify.com') return searchBody();
        throw new Error('unexpected fetch');
      });

    await searchSpotify('hello');
    await searchSpotify('world');

    const tokenCalls = fetchSpy.mock.calls.filter(([input]) => {
      const u = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url,
      );
      return u.hostname === 'accounts.spotify.com';
    });
    expect(tokenCalls).toHaveLength(1);
  });

  it('refreshes the token after the TTL has expired', async () => {
    let issued = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url,
      );
      if (url.hostname === 'accounts.spotify.com') {
        issued += 1;
        // Issue a token that expires almost immediately so the refresh-skew
        // window (60s) trips on the very next call.
        return tokenBody(`tok-${issued}`, 1);
      }
      if (url.hostname === 'api.spotify.com') return searchBody();
      throw new Error('unexpected fetch');
    });

    await searchSpotify('a');
    await searchSpotify('b');

    expect(issued).toBe(2);
  });

  it('throws SpotifyNotConfiguredError when env vars are missing', async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    expect(isSpotifyConfigured()).toBe(false);

    await expect(searchSpotify('anything')).rejects.toBeInstanceOf(
      SpotifyNotConfiguredError,
    );
  });

  it('reports configured when both env vars present', () => {
    expect(isSpotifyConfigured()).toBe(true);
  });
});
