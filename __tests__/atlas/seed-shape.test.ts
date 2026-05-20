/**
 * Structural validation of the Mood Atlas seed corpus.
 *
 * Failing entries here will cascade into a broken seed.sql or an unbalanced
 * atlas, so the contract is enforced at test time.
 */

import { describe, expect, it } from 'vitest';
import {
  ATLAS_GENRES,
  ATLAS_SEED_LYRICS,
} from '@/lib/seeds/atlas-seed-lyrics';

describe('atlas seed corpus', () => {
  it('has between 50 and 80 entries', () => {
    expect(ATLAS_SEED_LYRICS.length).toBeGreaterThanOrEqual(50);
    expect(ATLAS_SEED_LYRICS.length).toBeLessThanOrEqual(80);
  });

  it('uses only the allowlisted genres', () => {
    const allowed = new Set(ATLAS_GENRES);
    for (const entry of ATLAS_SEED_LYRICS) {
      expect(allowed.has(entry.genre as (typeof ATLAS_GENRES)[number])).toBe(
        true,
      );
    }
  });

  it('uses synthetic artists (no famous-name overlap)', () => {
    // Defense-in-depth: spot-check that the corpus doesn't accidentally
    // include a well-known artist name. Not exhaustive, but catches an
    // obvious copy/paste regression.
    const banned = [
      'beatles',
      'taylor swift',
      'beyonc',
      'eminem',
      'drake',
      'billie eilish',
      'kanye',
      'rihanna',
      'adele',
      'bowie',
    ];
    for (const entry of ATLAS_SEED_LYRICS) {
      const lower = entry.artist.toLowerCase();
      for (const name of banned) {
        expect(lower).not.toContain(name);
      }
    }
  });

  it('has at least ~15 distinct artists for cross-artist variety', () => {
    const artists = new Set(ATLAS_SEED_LYRICS.map((entry) => entry.artist));
    expect(artists.size).toBeGreaterThanOrEqual(10);
  });

  it('has at least 5 different release years for timeline spread', () => {
    const years = new Set(ATLAS_SEED_LYRICS.map((entry) => entry.year));
    expect(years.size).toBeGreaterThanOrEqual(5);
  });

  it('uses plausible release years (2000-2030)', () => {
    for (const entry of ATLAS_SEED_LYRICS) {
      expect(entry.year).toBeGreaterThanOrEqual(2000);
      expect(entry.year).toBeLessThanOrEqual(2030);
    }
  });

  it('has lyrics of at least 10 words for every entry', () => {
    for (const entry of ATLAS_SEED_LYRICS) {
      const wordCount = entry.lyrics.trim().split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(10);
    }
  });

  it('has a non-empty title and artist for every entry', () => {
    for (const entry of ATLAS_SEED_LYRICS) {
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.artist.trim().length).toBeGreaterThan(0);
    }
  });

  it('has unique (artist, title, year) tuples', () => {
    const seen = new Set<string>();
    for (const entry of ATLAS_SEED_LYRICS) {
      const key = `${entry.artist}|${entry.title}|${entry.year}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('covers every allowlisted genre at least once', () => {
    const seenGenres = new Set(ATLAS_SEED_LYRICS.map((entry) => entry.genre));
    for (const genre of ATLAS_GENRES) {
      expect(seenGenres.has(genre)).toBe(true);
    }
  });
});
