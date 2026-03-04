import { describe, it, expect } from 'vitest';
import { _test } from '@/lib/audio-analysis';

const { mapMood, mapVibe, mapEnergy, mapSentiment, mapTempo, extractCharacteristics } = _test;

// ─── mapMood ────────────────────────────────────────────────

describe('mapMood', () => {
  it('returns Euphoric for loud high-BPM tracks', () => {
    expect(
      mapMood({ bpm: 140, rmsEnergy: 0.7, spectralCentroid: 3000, dynamicRange: 0.3, zeroCrossingRate: 0.3, duration: 60 }),
    ).toBe('Euphoric');
  });

  it('returns Melancholic for quiet slow tracks', () => {
    expect(
      mapMood({ bpm: 75, rmsEnergy: 0.15, spectralCentroid: 1800, dynamicRange: 0.2, zeroCrossingRate: 0.1, duration: 60 }),
    ).toBe('Melancholic');
  });

  it('returns Peaceful for quiet bright tracks above the melancholic BPM threshold', () => {
    expect(
      mapMood({ bpm: 95, rmsEnergy: 0.25, spectralCentroid: 3200, dynamicRange: 0.2, zeroCrossingRate: 0.1, duration: 60 }),
    ).toBe('Peaceful');
  });

  it('returns Aggressive for loud dark tracks', () => {
    expect(
      mapMood({ bpm: 100, rmsEnergy: 0.55, spectralCentroid: 1200, dynamicRange: 0.3, zeroCrossingRate: 0.3, duration: 60 }),
    ).toBe('Aggressive');
  });
});

// ─── mapVibe ────────────────────────────────────────────────

describe('mapVibe', () => {
  it('returns High-Energy for very fast tracks', () => {
    expect(
      mapVibe({ bpm: 150, rmsEnergy: 0.5, spectralCentroid: 2500, dynamicRange: 0.3, zeroCrossingRate: 0.3, duration: 60 }, 'Euphoric'),
    ).toBe('High-Energy');
  });

  it('returns Mellow for very quiet tracks', () => {
    expect(
      mapVibe({ bpm: 80, rmsEnergy: 0.1, spectralCentroid: 2000, dynamicRange: 0.1, zeroCrossingRate: 0.1, duration: 60 }, 'Melancholic'),
    ).toBe('Mellow');
  });
});

// ─── mapEnergy ──────────────────────────────────────────────

describe('mapEnergy', () => {
  it('returns a valid energy string', () => {
    const valid = ['Very High', 'High', 'Moderate', 'Low', 'Very Low'];
    const result = mapEnergy({ bpm: 120, rmsEnergy: 0.5, spectralCentroid: 2500, dynamicRange: 0.3, zeroCrossingRate: 0.3, duration: 60 });
    expect(valid).toContain(result);
  });

  it('returns Very High for extreme features', () => {
    expect(
      mapEnergy({ bpm: 180, rmsEnergy: 0.9, spectralCentroid: 4000, dynamicRange: 0.8, zeroCrossingRate: 0.7, duration: 60 }),
    ).toBe('Very High');
  });

  it('returns Low or Very Low for minimal features', () => {
    const result = mapEnergy({ bpm: 60, rmsEnergy: 0.05, spectralCentroid: 800, dynamicRange: 0.05, zeroCrossingRate: 0.02, duration: 60 });
    expect(['Low', 'Very Low']).toContain(result);
  });
});

// ─── mapSentiment ───────────────────────────────────────────

describe('mapSentiment', () => {
  it('returns a valid sentiment string', () => {
    const valid = ['Positive', 'Neutral/Mixed', 'Negative'];
    const result = mapSentiment({ bpm: 100, rmsEnergy: 0.4, spectralCentroid: 2000, dynamicRange: 0.3, zeroCrossingRate: 0.2, duration: 60 });
    expect(valid).toContain(result);
  });
});

// ─── mapTempo ───────────────────────────────────────────────

describe('mapTempo', () => {
  it('maps BPM ranges correctly', () => {
    expect(mapTempo(160)).toBe('Very Fast');
    expect(mapTempo(130)).toBe('Fast');
    expect(mapTempo(100)).toBe('Moderate');
    expect(mapTempo(80)).toBe('Slow');
    expect(mapTempo(60)).toBe('Very Slow');
  });
});

// ─── extractCharacteristics ─────────────────────────────────

describe('extractCharacteristics', () => {
  it('returns at most 5 characteristics', () => {
    const chars = extractCharacteristics({
      bpm: 130, rmsEnergy: 0.6, spectralCentroid: 3500,
      dynamicRange: 0.6, zeroCrossingRate: 0.5, duration: 120,
    });
    expect(chars.length).toBeLessThanOrEqual(5);
    expect(chars.length).toBeGreaterThan(0);
  });

  it('includes Uptempo for high BPM', () => {
    const chars = extractCharacteristics({
      bpm: 130, rmsEnergy: 0.3, spectralCentroid: 2000,
      dynamicRange: 0.3, zeroCrossingRate: 0.2, duration: 60,
    });
    expect(chars).toContain('Uptempo');
  });

  it('includes Downtempo for low BPM', () => {
    const chars = extractCharacteristics({
      bpm: 70, rmsEnergy: 0.3, spectralCentroid: 2000,
      dynamicRange: 0.3, zeroCrossingRate: 0.2, duration: 60,
    });
    expect(chars).toContain('Downtempo');
  });
});
