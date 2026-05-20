import 'server-only';

import type { SearchHit, Song } from './types';

/**
 * Genius API adapter — metadata only.
 *
 * IMPORTANT — Terms-of-service posture:
 *
 *   The Genius public API exposes a `path` and a `url` for each song, but it
 *   does NOT serve full lyrics; Genius requires you to scrape the rendered
 *   HTML page to obtain them, and their terms explicitly forbid redistribution
 *   of lyrics. We therefore intentionally restrict this adapter to:
 *
 *     - search results (title, artist, cover art, genius song id)
 *     - song-detail metadata (album, release date, producer/writer credits)
 *
 *   We NEVER fetch the HTML page nor scrape lyrics. The user-pasted text the
 *   analyser receives is stored only as a short `lyrics_excerpt` (<= 500
 *   chars) on the `analyses` row; for the full text we link out to Genius via
 *   the `url` field. This is the Stream D commitment documented in the v2
 *   plan ("Risks & Mitigations" section).
 *
 * Required env var:
 *   GENIUS_ACCESS_TOKEN  (free Client Access Token from
 *                         https://genius.com/api-clients)
 */

const API_ROOT = 'https://api.genius.com';

export class GeniusNotConfiguredError extends Error {
  constructor() {
    super('GENIUS_ACCESS_TOKEN must be set');
    this.name = 'GeniusNotConfiguredError';
  }
}

function getToken(): string {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) throw new GeniusNotConfiguredError();
  return token;
}

export function isGeniusConfigured(): boolean {
  return Boolean(process.env.GENIUS_ACCESS_TOKEN);
}

async function geniusGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_ROOT}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`Genius ${path} failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { response: T };
  return json.response;
}

interface GeniusSearchHit {
  type: string;
  result: {
    id: number;
    title: string;
    primary_artist: { name: string };
    song_art_image_url?: string;
    song_art_image_thumbnail_url?: string;
    /** Synthesized by Genius across various signals; 0..1ish. */
    _type?: string;
  };
}

interface GeniusSongDetail {
  song: {
    id: number;
    title: string;
    primary_artist: { name: string };
    album?: { name: string } | null;
    release_date_components?: { year?: number } | null;
    song_art_image_url?: string;
    url: string;
  };
}

/** Free-text Genius search. Returns metadata-only hits (no lyrics). */
export async function searchGenius(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const r = await geniusGet<{ hits: GeniusSearchHit[] }>('/search', { q: trimmed });

  return r.hits
    .filter((h) => h.type === 'song')
    .map((h, idx) => ({
      id: String(h.result.id),
      // Genius doesn't return a numeric score; preserve list order via decay.
      score: Math.max(0.1, 1 - idx * 0.1),
      song: {
        title: h.result.title,
        artist: h.result.primary_artist.name,
        coverUrl: h.result.song_art_image_url ?? h.result.song_art_image_thumbnail_url,
        geniusId: h.result.id,
      },
    }));
}

/**
 * Fetch metadata for a single Genius song. Returns a `Partial<Song>` —
 * Genius is a metadata-enrichment source, not the canonical record.
 *
 * Reminder: lyrics are NOT returned. Even if the API ever started exposing
 * them, this function would still ignore them; see the file-level comment.
 */
export async function getGeniusSong(id: number): Promise<Partial<Song>> {
  const r = await geniusGet<GeniusSongDetail>(`/songs/${id}`);
  const s = r.song;
  return {
    title: s.title,
    artist: s.primary_artist.name,
    album: s.album?.name ?? undefined,
    year: s.release_date_components?.year ?? undefined,
    coverUrl: s.song_art_image_url,
    geniusId: s.id,
  };
}
