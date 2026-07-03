import { describe, expect, it } from 'vitest';

import { estimateTempo } from '@/lib/audio/tempo';

/**
 * Synthetic onset-envelope tests. `estimateTempo` consumes an onset
 * envelope (one value per hop), so a click train is just periodic impulses.
 */

const HOP_SECONDS = 0.025; // 40 envelope frames per second

function clickTrain(periodFrames: number, totalFrames: number, jitter = 0): number[] {
  const env = new Array<number>(totalFrames).fill(0.01);
  for (let i = 0; i < totalFrames; i += periodFrames) {
    const idx = Math.min(totalFrames - 1, Math.round(i + jitter * Math.sin(i)));
    env[idx] = 1;
  }
  return env;
}

describe('estimateTempo', () => {
  it('nails a 120 BPM click train (period 0.5s)', () => {
    // 120 BPM at 0.025s/hop → 20 frames per beat; 30s of envelope.
    const estimate = estimateTempo(clickTrain(20, 1200), HOP_SECONDS);
    expect(estimate).not.toBeNull();
    expect(estimate!.bpm).toBeGreaterThanOrEqual(118);
    expect(estimate!.bpm).toBeLessThanOrEqual(122);
    expect(estimate!.strength).toBeGreaterThan(0.3);
  });

  it('lays a beat grid with the right spacing and phase', () => {
    const estimate = estimateTempo(clickTrain(20, 1200), HOP_SECONDS)!;
    expect(estimate.beatGrid.length).toBeGreaterThan(40);
    const gaps = estimate.beatGrid.slice(1).map((t, i) => t - estimate.beatGrid[i]);
    for (const gap of gaps.slice(0, 10)) {
      expect(gap).toBeCloseTo(0.5, 1);
    }
    // Clicks sit at frame 0, 20, 40… → phase should snap to (near) zero.
    expect(estimate.beatGrid[0]).toBeLessThan(0.5);
  });

  it('recovers a slow 60 BPM pulse without octave-doubling a silent offbeat', () => {
    const estimate = estimateTempo(clickTrain(40, 1600), HOP_SECONDS);
    expect(estimate).not.toBeNull();
    expect(estimate!.bpm).toBeGreaterThanOrEqual(58);
    expect(estimate!.bpm).toBeLessThanOrEqual(62);
  });

  it('returns null for silence and too-short envelopes', () => {
    expect(estimateTempo(new Array(1200).fill(0), HOP_SECONDS)).toBeNull();
    expect(estimateTempo([1, 0, 0, 1], HOP_SECONDS)).toBeNull();
  });
});
