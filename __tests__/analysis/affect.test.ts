import { describe, expect, it } from 'vitest';

import {
  EMOTION_COORDS,
  affectAgreement,
  agreementBreakdown,
  lyricsAffect,
} from '@/lib/analysis/affect';
import { MOOD_COORDS } from '@/lib/audio/mood-map';
import type { AnalysisResult } from '@/lib/types';

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    mood: 'Melancholic',
    vibe: 'Moody',
    energy: 'Low',
    sentiment: 'Negative',
    themes: [],
    detailedAnalysis: '',
    confidence: 0.8,
    wordCount: 60,
    ...overrides,
  };
}

describe('lyricsAffect', () => {
  it('uses the transformer emotion distribution when present', () => {
    const affect = lyricsAffect(
      result({
        engines: {
          transformer: {
            status: 'ok',
            scores: [{ label: 'joy', score: 1 }],
          },
          keyword: { status: 'ok' },
        },
      }),
    );
    expect(affect.valence).toBeCloseTo(EMOTION_COORDS.joy.valence, 2);
    expect(affect.arousal).toBeCloseTo(EMOTION_COORDS.joy.arousal, 2);
  });

  it('weights mixed distributions toward the dominant emotion', () => {
    const affect = lyricsAffect(
      result({
        engines: {
          transformer: {
            status: 'ok',
            scores: [
              { label: 'sadness', score: 0.8 },
              { label: 'joy', score: 0.2 },
            ],
          },
          keyword: { status: 'ok' },
        },
      }),
    );
    expect(affect.valence).toBeLessThan(0);
    expect(affect.arousal).toBeLessThan(0.2);
  });

  it('falls back to the blended mood coordinate without transformer scores', () => {
    expect(lyricsAffect(result({ mood: 'Euphoric' }))).toEqual(MOOD_COORDS.Euphoric);
  });

  it('returns the origin for an unknown mood', () => {
    expect(lyricsAffect(result({ mood: 'Zorblatt' }))).toEqual({ valence: 0, arousal: 0 });
  });
});

describe('affectAgreement', () => {
  it('is 1 for identical feelings and 0 at opposite corners', () => {
    const point = { valence: 0.4, arousal: -0.2 };
    expect(affectAgreement(point, point)).toBe(1);
    expect(
      affectAgreement({ valence: -1, arousal: -1 }, { valence: 1, arousal: 1 }),
    ).toBe(0);
  });

  it('is symmetric', () => {
    const a = { valence: 0.7, arousal: 0.5 };
    const b = { valence: -0.3, arousal: -0.6 };
    expect(affectAgreement(a, b)).toBeCloseTo(affectAgreement(b, a));
  });

  it('scores adjacent moods far higher than the old edit-distance did', () => {
    // "Euphoric" vs "Uplifting" scored ~27% under Levenshtein.
    const score = affectAgreement(MOOD_COORDS.Euphoric, MOOD_COORDS.Uplifting);
    expect(score).toBeGreaterThan(0.85);
  });
});

describe('agreementBreakdown', () => {
  it('reads "sadder words" when lyrics valence sits below audio valence', () => {
    const breakdown = agreementBreakdown(
      { valence: -0.7, arousal: 0.1 },
      { valence: 0.5, arousal: 0.2 },
    );
    expect(breakdown.summary).toMatch(/sadder/i);
    expect(breakdown.valenceDelta).toBeLessThan(0);
  });

  it('reads agreement when the points coincide', () => {
    const breakdown = agreementBreakdown(
      { valence: 0.5, arousal: 0.5 },
      { valence: 0.5, arousal: 0.4 },
    );
    expect(breakdown.agreement).toBeGreaterThan(0.9);
    expect(breakdown.summary).toMatch(/same emotional story/i);
  });
});
