import { describe, expect, it } from 'vitest';

import { moodToColor } from '@/lib/analysis/palette';
import {
  MOOD_COORDS,
  audioAffect,
  affectDistance,
  nearestMood,
} from '@/lib/audio/mood-map';

describe('MOOD_COORDS', () => {
  it('covers exactly the 13 palette moods with in-range coordinates', () => {
    const moods = Object.keys(MOOD_COORDS);
    expect(moods).toHaveLength(13);
    for (const mood of moods) {
      // Every coordinate mood must exist in the palette (Contemplative is the
      // palette fallback, so an unknown mood would silently lose its color).
      expect(moodToColor(mood)).toBeDefined();
      const { valence, arousal } = MOOD_COORDS[mood];
      expect(Math.abs(valence)).toBeLessThanOrEqual(1);
      expect(Math.abs(arousal)).toBeLessThanOrEqual(1);
    }
  });
});

describe('nearestMood', () => {
  it('maps each mood coordinate back to itself', () => {
    for (const [mood, coord] of Object.entries(MOOD_COORDS)) {
      expect(nearestMood(coord)).toBe(mood);
    }
  });
});

describe('audioAffect', () => {
  const base = {
    bpm: 120,
    rmsMean: 0.15,
    fluxMean: 0.4,
    centroidMean: 2200,
    scale: null as 'major' | 'minor' | null,
    keyStrength: 0,
  };

  it('fast, loud, major-key, bright audio reads positive and energetic', () => {
    const affect = audioAffect({
      ...base,
      bpm: 160,
      rmsMean: 0.28,
      fluxMean: 0.7,
      centroidMean: 3600,
      scale: 'major',
      keyStrength: 0.8,
    });
    expect(affect.valence).toBeGreaterThan(0.3);
    expect(affect.arousal).toBeGreaterThan(0.3);
  });

  it('slow, quiet, minor-key, dark audio reads negative and calm', () => {
    const affect = audioAffect({
      ...base,
      bpm: 70,
      rmsMean: 0.04,
      fluxMean: 0.15,
      centroidMean: 1100,
      scale: 'minor',
      keyStrength: 0.8,
    });
    expect(affect.valence).toBeLessThan(-0.2);
    expect(affect.arousal).toBeLessThan(-0.3);
  });

  it('stays clamped to the plane', () => {
    const affect = audioAffect({
      bpm: 400,
      rmsMean: 5,
      fluxMean: 5,
      centroidMean: 20_000,
      scale: 'major',
      keyStrength: 1,
    });
    expect(Math.abs(affect.valence)).toBeLessThanOrEqual(1);
    expect(Math.abs(affect.arousal)).toBeLessThanOrEqual(1);
  });
});

describe('affectDistance', () => {
  it('is zero for identical points and symmetric', () => {
    const a = { valence: 0.3, arousal: -0.4 };
    const b = { valence: -0.5, arousal: 0.2 };
    expect(affectDistance(a, a)).toBe(0);
    expect(affectDistance(a, b)).toBeCloseTo(affectDistance(b, a));
  });
});
