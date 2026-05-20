/**
 * Tests for the share-page OG payload extractor.
 *
 * We deliberately avoid asserting against `ImageResponse` rendering — that
 * needs the edge runtime + Satori + a working font fetch, none of which is
 * available in a vitest node env. The OG route is a thin shell over
 * `extractOgPayload`, so testing the shape contract is enough.
 */

import { describe, it, expect } from 'vitest';
import { extractOgPayload } from '@/app/share/[slug]/og-data';
import type { AnalysisRow, SongRow } from '@/lib/supabase/database.types';

function makeAnalysis(result: Record<string, unknown>): Pick<AnalysisRow, 'result'> {
  // The DB allows a loose jsonb shape; we cast through unknown so the test
  // doesn't have to satisfy every AnalysisResultJson field.
  return { result: result as unknown as AnalysisRow['result'] };
}

function makeSong(
  partial: Partial<Pick<SongRow, 'title' | 'artist' | 'album' | 'cover_url'>>,
): Pick<SongRow, 'title' | 'artist' | 'album' | 'cover_url'> {
  return {
    title: partial.title ?? 'Bad Guy',
    artist: partial.artist ?? 'Billie Eilish',
    album: partial.album ?? null,
    cover_url: partial.cover_url ?? null,
  };
}

describe('extractOgPayload', () => {
  it('merges song row and analysis result into a flat OG payload', () => {
    const payload = extractOgPayload(
      makeAnalysis({
        mood: 'Euphoric',
        vibe: 'High-Energy',
        energy: 'High',
        sentiment: 'Very Positive',
        themes: ['love', 'celebration', 'freedom'],
      }),
      makeSong({
        title: 'Hey Ya!',
        artist: 'OutKast',
        album: 'Speakerboxxx/The Love Below',
        cover_url: 'https://example.com/cover.jpg',
      }),
    );

    expect(payload.title).toBe('Hey Ya!');
    expect(payload.artist).toBe('OutKast');
    expect(payload.album).toBe('Speakerboxxx/The Love Below');
    expect(payload.coverUrl).toBe('https://example.com/cover.jpg');
    expect(payload.mood).toBe('Euphoric');
    expect(payload.vibe).toBe('High-Energy');
    expect(payload.energy).toBe('High');
    expect(payload.sentiment).toBe('Very Positive');
    expect(payload.themes).toEqual(['love', 'celebration', 'freedom']);
  });

  it('falls back gracefully when no song is resolved', () => {
    const payload = extractOgPayload(
      makeAnalysis({ mood: 'Melancholic', vibe: 'Mellow' }),
      null,
    );

    expect(payload.title).toBe('Song Analysis');
    expect(payload.artist).toBe('');
    expect(payload.album).toBe('');
    expect(payload.coverUrl).toBeNull();
    expect(payload.mood).toBe('Melancholic');
    expect(payload.vibe).toBe('Mellow');
  });

  it('defaults missing analysis fields to neutral values', () => {
    const payload = extractOgPayload(makeAnalysis({}), null);

    expect(payload.mood).toBe('Contemplative');
    expect(payload.vibe).toBe('Reflective');
    expect(payload.sentiment).toBe('Neutral/Mixed');
    expect(payload.energy).toBe('');
    expect(payload.themes).toEqual([]);
    expect(payload.moodColor).toBeNull();
  });

  it('preserves a valid moodColor pair', () => {
    const payload = extractOgPayload(
      makeAnalysis({
        mood: 'Aggressive',
        moodColor: { from: '#EF4444', to: '#7F1D1D' },
      }),
      null,
    );

    expect(payload.moodColor).toEqual({ from: '#EF4444', to: '#7F1D1D' });
  });

  it('rejects a malformed moodColor', () => {
    const payload = extractOgPayload(
      makeAnalysis({
        mood: 'Aggressive',
        moodColor: { from: '#EF4444' }, // missing `to`
      }),
      null,
    );

    expect(payload.moodColor).toBeNull();
  });

  it('caps themes to a sensible OG-friendly maximum', () => {
    const payload = extractOgPayload(
      makeAnalysis({
        mood: 'Romantic',
        themes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      }),
      null,
    );

    expect(payload.themes.length).toBeLessThanOrEqual(4);
    expect(payload.themes[0]).toBe('a');
  });

  it('drops non-string theme entries', () => {
    const payload = extractOgPayload(
      makeAnalysis({
        mood: 'Romantic',
        themes: ['love', null, 42, 'longing'],
      }),
      null,
    );

    expect(payload.themes).toEqual(['love', 'longing']);
  });
});
