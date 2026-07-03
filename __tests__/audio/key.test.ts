import { describe, expect, it } from 'vitest';

import { detectKey } from '@/lib/audio/key';

/** Build a 12-bin chroma with energy on the given pitch classes (C = 0). */
function chromaOf(pitchClasses: number[], floor = 0.05): number[] {
  const chroma = new Array<number>(12).fill(floor);
  for (const pc of pitchClasses) chroma[pc] = 1;
  return chroma;
}

describe('detectKey', () => {
  it('detects C major from a C-E-G triad', () => {
    const estimate = detectKey(chromaOf([0, 4, 7]));
    expect(estimate).not.toBeNull();
    expect(estimate!.key).toBe('C');
    expect(estimate!.scale).toBe('major');
    expect(estimate!.strength).toBeGreaterThan(0.5);
  });

  it('detects A minor from an A-C-E triad', () => {
    const estimate = detectKey(chromaOf([9, 0, 4]));
    expect(estimate).not.toBeNull();
    expect(estimate!.key).toBe('A');
    expect(estimate!.scale).toBe('minor');
  });

  it('transposes: G major from G-B-D', () => {
    const estimate = detectKey(chromaOf([7, 11, 2]));
    expect(estimate).not.toBeNull();
    expect(estimate!.key).toBe('G');
    expect(estimate!.scale).toBe('major');
  });

  it('rejects degenerate chroma', () => {
    expect(detectKey(new Array(12).fill(0.5))).toBeNull(); // flat
    expect(detectKey([1, 0, 0])).toBeNull(); // wrong length
  });
});
