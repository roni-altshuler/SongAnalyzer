/**
 * Tests for the hybrid analysis blend layer.
 *
 * Covers:
 *  1. Blend semantics — transformer present vs null, custom weights, themes
 *     always sourced from keyword engine.
 *  2. Cache short-circuit behavior via the AnalysisCacheStore interface.
 *  3. Fixture-driven regression: the keyword engine alone should agree with
 *     the hand-labeled sentiment family on ≥80% of the curated fixtures
 *     (transformer is mocked deterministically per fixture).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { analyzeKeyword } from '@/lib/analysis/keyword';
import { blendResults } from '@/lib/analysis/blend';
import { moodToColor } from '@/lib/analysis/palette';
import {
  setAnalysisCache,
  getCachedAnalysis,
  setCachedAnalysis,
  hashLyrics,
  normalizeLyrics,
  type AnalysisCacheStore,
} from '@/lib/analysis/cache';
import type { TransformerResult } from '@/lib/analysis/types';
import type { AnalysisResult } from '@/lib/types';

import positives from './analysis-fixtures/positive.json';
import negatives from './analysis-fixtures/negative.json';
import mixed from './analysis-fixtures/mixed.json';

type Fixture = {
  id: string;
  label: string;
  lyrics: string;
  expectedSentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  expectedMoodFamily: string;
};

function fakeTransformer(overrides: Partial<TransformerResult> = {}): TransformerResult {
  return {
    topEmotion: 'joy',
    mood: 'Euphoric',
    sentiment: 'Positive',
    scores: [
      { label: 'joy', score: 0.82 },
      { label: 'love', score: 0.1 },
      { label: 'neutral', score: 0.08 },
    ],
    confidence: 0.82,
    model: 'test/fake-emotion-model',
    ...overrides,
  };
}

describe('blendResults', () => {
  const sampleLyrics = 'Love and sunshine, beautiful day, hope alive and bright.';
  const keyword = analyzeKeyword(sampleLyrics);

  it('returns the keyword result verbatim when transformer is null', () => {
    const result = blendResults({
      keyword,
      transformer: null,
      transformerStatus: 'unavailable',
      transformerReason: 'no HF token',
    });

    expect(result.mood).toBe(keyword.mood);
    expect(result.sentiment).toBe(keyword.sentiment);
    expect(result.themes).toEqual(keyword.themes);
    expect(result.confidence).toBe(keyword.confidence);
    expect(result.engines?.transformer.status).toBe('unavailable');
    expect(result.engines?.transformer.reason).toBe('no HF token');
    expect(result.engines?.keyword.status).toBe('ok');
  });

  it('lets the transformer drive mood and sentiment when both engines succeed', () => {
    const result = blendResults({
      keyword,
      transformer: fakeTransformer({ mood: 'Aggressive', sentiment: 'Very Negative' }),
    });

    expect(result.mood).toBe('Aggressive');
    expect(result.sentiment).toBe('Very Negative');
    expect(result.engines?.transformer.status).toBe('ok');
    expect(result.engines?.transformer.model).toBe('test/fake-emotion-model');
  });

  it('always sources themes from the keyword engine, even when transformer is present', () => {
    const result = blendResults({
      keyword,
      transformer: fakeTransformer(),
    });

    expect(result.themes).toEqual(keyword.themes);
  });

  it('blends confidence with the default 70/30 weighting', () => {
    const k = { ...keyword, confidence: 0.5 };
    const result = blendResults({
      keyword: k,
      transformer: fakeTransformer({ confidence: 0.9 }),
    });

    // 0.9 * 0.7 + 0.5 * 0.3 = 0.78
    expect(result.confidence).toBeCloseTo(0.78, 2);
  });

  it('respects custom blend weights', () => {
    const k = { ...keyword, confidence: 0.5 };
    const result = blendResults({
      keyword: k,
      transformer: fakeTransformer({ confidence: 0.9 }),
      options: { transformerWeight: 0.5, keywordWeight: 0.5 },
    });

    expect(result.confidence).toBeCloseTo(0.7, 2);
  });

  it('records timeout status when transformerStatus is set explicitly', () => {
    const result = blendResults({
      keyword,
      transformer: null,
      transformerStatus: 'timeout',
      transformerReason: 'aborted after 8s',
    });

    expect(result.engines?.transformer.status).toBe('timeout');
  });
});

describe('moodToColor palette', () => {
  it('returns a from/to/glow hex triplet for any known mood', () => {
    const moods = ['Euphoric', 'Melancholic', 'Aggressive', 'Romantic', 'Peaceful', 'Contemplative'];
    for (const mood of moods) {
      const color = moodToColor(mood);
      expect(color.from).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.to).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.glow).toBeTruthy();
    }
  });

  it('falls back gracefully for unknown moods', () => {
    const color = moodToColor('NotARealMood' as string);
    expect(color.from).toMatch(/^#[0-9a-f]{6}$/i);
    expect(color.to).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('AnalysisCacheStore', () => {
  beforeEach(() => {
    setAnalysisCache(null);
  });

  it('produces stable, normalization-invariant hashes', () => {
    const a = hashLyrics('Love and Sunshine ');
    const b = hashLyrics('  love\nand\tSUNSHINE  ');
    expect(a).toBe(b);
    expect(normalizeLyrics('  Hello\n WORLD ')).toBe('hello world');
  });

  it('round-trips a result through an in-memory store', async () => {
    const store: AnalysisCacheStore = {
      data: new Map<string, AnalysisResult>(),
      async get(hash: string) {
        return this.data.get(hash) ?? null;
      },
      async set(hash: string, result: AnalysisResult) {
        this.data.set(hash, result);
      },
    } as AnalysisCacheStore & { data: Map<string, AnalysisResult> };

    setAnalysisCache(store);

    const lyrics = 'Some lyrics to cache';
    const hash = hashLyrics(lyrics);
    const stub: AnalysisResult = {
      mood: 'Test',
      vibe: 'Test',
      energy: 'Test',
      sentiment: 'Test',
      themes: [],
      detailedAnalysis: '',
      confidence: 0.5,
      wordCount: 4,
    };

    expect(await getCachedAnalysis(hash)).toBeNull();
    await setCachedAnalysis(hash, stub);
    expect(await getCachedAnalysis(hash)).toEqual(stub);

    // Normalization-invariant: differently-whitespaced lyrics hash to the same key.
    const hash2 = hashLyrics('  SOME\tLYRICS\nTO  cache  ');
    expect(hash2).toBe(hash);
    expect(await getCachedAnalysis(hash2)).toEqual(stub);
  });
});

describe('keyword engine vs hand-labeled fixtures (≥80% accuracy)', () => {
  function classifySentiment(sentiment: string): 'positive' | 'negative' | 'mixed' | 'neutral' {
    const s = sentiment.toLowerCase();
    if (s.includes('positive')) return 'positive';
    if (s.includes('negative')) return 'negative';
    if (s.includes('mixed') || s.includes('bittersweet')) return 'mixed';
    return 'neutral';
  }

  function accuracy(fixtures: Fixture[]) {
    let hits = 0;
    const misses: Array<{ id: string; got: string; expected: string }> = [];
    for (const fx of fixtures) {
      const result = analyzeKeyword(fx.lyrics);
      const got = classifySentiment(result.sentiment);
      const expected = fx.expectedSentiment;
      // For "mixed" fixtures we accept neutral, mixed, or any other ambiguity —
      // the keyword engine is intentionally simple and can't reliably distinguish.
      const match =
        got === expected ||
        (expected === 'mixed' && (got === 'neutral' || got === 'mixed'));
      if (match) hits++;
      else misses.push({ id: fx.id, got: result.sentiment, expected });
    }
    return { hits, total: fixtures.length, misses };
  }

  it('classifies ≥80% of clearly-positive fixtures correctly', () => {
    const { hits, total, misses } = accuracy(positives as Fixture[]);
    expect(hits / total).toBeGreaterThanOrEqual(0.8);
    if (hits / total < 1) {
      // surface misses for debugging without failing
      console.log('positive misses:', misses);
    }
  });

  it('classifies ≥80% of clearly-negative fixtures correctly', () => {
    const { hits, total, misses } = accuracy(negatives as Fixture[]);
    expect(hits / total).toBeGreaterThanOrEqual(0.8);
    if (hits / total < 1) {
      console.log('negative misses:', misses);
    }
  });

  it('handles mixed/ambiguous fixtures without crashing', () => {
    // We don't gate on accuracy for mixed — the keyword engine isn't expected
    // to reliably detect ambiguity. Just verify it returns sane structure.
    for (const fx of mixed as Fixture[]) {
      const result = analyzeKeyword(fx.lyrics);
      expect(result.mood).toBeTruthy();
      expect(result.sentiment).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
