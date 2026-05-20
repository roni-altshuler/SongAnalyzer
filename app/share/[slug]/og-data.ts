/**
 * Pure data-extraction helpers for the share page and its OG/Twitter image
 * routes.
 *
 * Kept dependency-free (no `next/og`, no React) so it can be unit-tested in a
 * Vitest node environment without dragging the OG runtime.
 */

import type { AnalysisRow, SongRow } from '@/lib/supabase/database.types';

export interface OgPayload {
  /** Big serif title; falls back to "Song Analysis" when no song is resolved. */
  title: string;
  /** Artist line; empty string when no song is resolved. */
  artist: string;
  /** Album name when known. */
  album: string;
  /** Album-art URL when known. */
  coverUrl: string | null;
  mood: string;
  vibe: string;
  energy: string;
  sentiment: string;
  themes: string[];
  /** `{ from, to }` gradient — `result.moodColor` if set; null otherwise. */
  moodColor: { from: string; to: string } | null;
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function pickStringOrEmpty(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : '';
}

function pickThemes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 4);
}

function pickMoodColor(
  value: unknown,
): { from: string; to: string } | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as { from?: unknown; to?: unknown };
  if (typeof obj.from === 'string' && typeof obj.to === 'string') {
    return { from: obj.from, to: obj.to };
  }
  return null;
}

/**
 * Project a `(analyses, songs)` row pair into the minimal payload needed by
 * the OG image and the share page. Safe for any consumer (server or pure
 * unit-test).
 */
export function extractOgPayload(
  analysis: Pick<AnalysisRow, 'result'>,
  song: Pick<SongRow, 'title' | 'artist' | 'album' | 'cover_url'> | null,
): OgPayload {
  const result = (analysis.result ?? {}) as Record<string, unknown>;

  return {
    title: song?.title ?? 'Song Analysis',
    artist: song?.artist ?? '',
    album: song?.album ?? '',
    coverUrl: song?.cover_url ?? null,
    mood: pickString(result.mood, 'Contemplative'),
    vibe: pickString(result.vibe, 'Reflective'),
    energy: pickStringOrEmpty(result.energy),
    sentiment: pickString(result.sentiment, 'Neutral/Mixed'),
    themes: pickThemes(result.themes),
    moodColor: pickMoodColor(result.moodColor),
  };
}
