import 'server-only';

import type { SearchHit, Song } from './types';

/**
 * Spotify Web API adapter — **Client Credentials flow only**.
 *
 * We deliberately do NOT use user-OAuth scopes here. Client Credentials gives
 * us metadata, search, album art, and 30-second `preview_url`s — all the
 * read-only surface we need for the analyser. Per Stream D's brief, we also
 * stay away from the Audio Features endpoint (deprecated for new apps as of
 * Nov 2024); we get audio descriptors from AcousticBrainz or the client-side
 * preview analyser instead.
 *
 * Required env vars:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 */

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_ROOT = 'https://api.spotify.com/v1';

/** Token TTL safety margin — refresh 60s before actual expiry. */
const REFRESH_SKEW_MS = 60_000;
/**
 * Spotify tokens nominally expire at 60 minutes. We cache for ~50 to leave
 * headroom for clock drift and slow networks.
 */
const TOKEN_TTL_MS = 50 * 60_000;

interface CachedToken {
  value: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

export class SpotifyNotConfiguredError extends Error {
  constructor() {
    super('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
    this.name = 'SpotifyNotConfiguredError';
  }
}

/** Test hook — lets the unit tests reset the in-memory cache between cases. */
export function __resetSpotifyTokenCache(): void {
  cachedToken = null;
}

function getCredentials(): { id: string; secret: string } {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new SpotifyNotConfiguredError();
  }
  return { id, secret };
}

/**
 * Fetch (or reuse a cached) Client Credentials bearer token. Token caching
 * lives in module memory; in a serverless context each warm instance keeps
 * its own copy, which is acceptable — Spotify allows many concurrent tokens.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_SKEW_MS) {
    return cachedToken.value;
  }

  const { id, secret } = getCredentials();
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`Spotify token request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error('Spotify token response missing access_token');
  }

  // Prefer Spotify's own expires_in (seconds) when present, but cap to our
  // self-imposed TTL so we never trust a value past the documented 60min.
  const remoteTtlMs = (json.expires_in ?? 3600) * 1000;
  const ttlMs = Math.min(remoteTtlMs, TOKEN_TTL_MS);

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + ttlMs,
  };

  return cachedToken.value;
}

/** Internal: authenticated GET against the Web API. */
async function spotifyGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${API_ROOT}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`Spotify ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyArtist {
  id: string;
  name: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  release_date?: string;
  images?: SpotifyImage[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  preview_url: string | null;
  popularity?: number;
  duration_ms?: number;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

/** Pick the highest-resolution image we get (Spotify sorts largest-first, but be defensive). */
function pickCover(images?: SpotifyImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  return [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
}

function yearFromReleaseDate(date?: string): number | undefined {
  if (!date) return undefined;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : undefined;
}

function toSearchHit(t: SpotifyTrack): SearchHit {
  return {
    id: t.id,
    // Spotify exposes 0..100 popularity; collapse to 0..1 for cross-source ranking.
    score: (t.popularity ?? 50) / 100,
    song: {
      title: t.name,
      artist: t.artists.map((a) => a.name).join(', '),
      album: t.album.name,
      year: yearFromReleaseDate(t.album.release_date),
      coverUrl: pickCover(t.album.images),
      previewUrl: t.preview_url ?? undefined,
      spotifyId: t.id,
    },
  };
}

/**
 * Free-text track search. Returns up to 10 hits ranked by Spotify popularity.
 *
 * This is the primary signal for `/api/songs/search` typeahead and the
 * starting point for `resolveSong()`.
 */
export async function searchSpotify(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const json = await spotifyGet<SpotifySearchResponse>('/search', {
    q: trimmed,
    type: 'track',
    limit: '10',
  });

  return json.tracks.items.map(toSearchHit);
}

/** Fetch one track by Spotify ID and project it onto our canonical `Song`. */
export async function getSpotifyTrack(id: string): Promise<Song> {
  const t = await spotifyGet<SpotifyTrack>(`/tracks/${encodeURIComponent(id)}`);
  return {
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album.name,
    year: yearFromReleaseDate(t.album.release_date),
    coverUrl: pickCover(t.album.images),
    previewUrl: t.preview_url ?? undefined,
    spotifyId: t.id,
  };
}

/** Whether the env vars are present — useful for the 503 short-circuit in routes. */
export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}
