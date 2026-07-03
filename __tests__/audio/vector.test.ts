import { describe, expect, it } from 'vitest';

import type { AudioFeaturesV2 } from '@/lib/audio/features';
import {
  SONIC_VECTOR_DIM,
  buildSonicVector,
  isValidSonicVector,
} from '@/lib/audio/vector';

function fakeFeatures(overrides: Partial<AudioFeaturesV2> = {}): AudioFeaturesV2 {
  return {
    duration: 30,
    bpm: 124,
    beatGrid: [0, 0.48, 0.97],
    tempoStrength: 0.6,
    key: 'D',
    scale: 'minor',
    keyStrength: 0.55,
    chromaMean: [0.2, 0.1, 1, 0.15, 0.3, 0.6, 0.1, 0.2, 0.4, 0.7, 0.1, 0.2],
    mfccMean: Array.from({ length: 13 }, (_, i) => (i - 6) * 3),
    mfccStd: Array.from({ length: 13 }, (_, i) => i * 0.8),
    centroidMean: 2400,
    centroidStd: 600,
    rmsMean: 0.14,
    rmsStd: 0.05,
    dynamicRange: 0.4,
    zcrMean: 0.2,
    fluxMean: 0.35,
    fluxStd: 0.2,
    fluxSeries: [0.2, 0.4, 0.3],
    valence: -0.2,
    arousal: 0.4,
    ...overrides,
  };
}

describe('buildSonicVector', () => {
  it('produces a 48-dim L2-normalized vector', () => {
    const vector = buildSonicVector(fakeFeatures());
    expect(vector).toHaveLength(SONIC_VECTOR_DIM);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 3);
    expect(isValidSonicVector(vector)).toBe(true);
  });

  it('is deterministic and sensitive to musical differences', () => {
    const a = buildSonicVector(fakeFeatures());
    expect(a).toEqual(buildSonicVector(fakeFeatures()));

    const b = buildSonicVector(
      fakeFeatures({ bpm: 70, scale: 'major', valence: 0.8, centroidMean: 900 }),
    );
    expect(a).not.toEqual(b);
  });

  it('sanitizes non-finite inputs instead of emitting NaN', () => {
    const vector = buildSonicVector(
      fakeFeatures({ centroidMean: Number.NaN, rmsStd: Infinity }),
    );
    expect(vector.every((v) => Number.isFinite(v))).toBe(true);
    expect(isValidSonicVector(vector)).toBe(true);
  });
});

describe('isValidSonicVector', () => {
  it('rejects wrong lengths, non-finite values, and out-of-range entries', () => {
    expect(isValidSonicVector(new Array(47).fill(0))).toBe(false);
    expect(isValidSonicVector([...new Array(47).fill(0), Number.NaN])).toBe(false);
    expect(isValidSonicVector([...new Array(47).fill(0), 2])).toBe(false);
    expect(isValidSonicVector('nope')).toBe(false);
    expect(isValidSonicVector(new Array(SONIC_VECTOR_DIM).fill(0.1))).toBe(true);
  });
});
