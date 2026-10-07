import { describe, expect, it } from 'vitest';
import { formatAudioTime, listeningWindows, windowAt, windowGridTicks, windowLevel } from '@/lib/audio/listening-windows';

const decoded = (...channels: number[][]) => ({ sampleRate: 2, length: channels[0].length,
  numberOfChannels: channels.length, getChannelData: (index: number) => Float32Array.from(channels[index]) });

describe('local listening windows', () => {
  it('covers a clip continuously, retains short clips and bounds long-clip controls', () => {
    for (const duration of [0.2, 4, 31, 600]) {
      const windows = listeningWindows(duration);
      expect(windows.length).toBeGreaterThan(0); expect(windows.length).toBeLessThanOrEqual(12);
      expect(windows[0].start).toBe(0); expect(windows.at(-1)?.end).toBe(duration);
      windows.forEach((window, index) => { expect(window.end).toBeGreaterThan(window.start); if (index) expect(window.start).toBe(windows[index - 1].end); });
    }
    expect(listeningWindows(4)).toHaveLength(2);
    for (const invalid of [0, -1, NaN, Infinity]) expect(listeningWindows(invalid)).toEqual([]);
  });

  it('synchronizes selections at boundaries and formats times without 60-second rollover errors', () => {
    const windows = listeningWindows(4);
    expect(windowAt(windows, 1.99)).toBe(0); expect(windowAt(windows, 2)).toBe(1); expect(windowAt(windows, 4)).toBe(1);
    expect(formatAudioTime(59.96)).toBe('1:00.0'); expect(formatAudioTime(NaN)).toBe('0:00.0');
  });

  it('measures original PCM across channels, without normalizing quieter windows', () => {
    const buffer = decoded([0.5, -0.5, 0.1, -0.1], [0, 0, 0, 0]);
    const loud = windowLevel(buffer, { start: 0, end: 1 });
    const quiet = windowLevel(buffer, { start: 1, end: 2 });
    if (loud.status !== 'ready' || quiet.status !== 'ready') throw new Error('missing measurements');
    expect(loud.rmsDb).toBeCloseTo(20 * Math.log10(Math.sqrt(0.125)), 5);
    expect(loud.peakDb).toBeCloseTo(20 * Math.log10(0.5), 5);
    expect(quiet.rmsDb! - loud.rmsDb!).toBeCloseTo(20 * Math.log10(0.2), 5);
    expect(loud.samples).toBe(4);
  });

  it('distinguishes real silence from missing, invalid and over-budget measurements', () => {
    expect(windowLevel(decoded([0, 0]), { start: 0, end: 1 })).toMatchObject({ status: 'ready', rmsDb: null, peakDb: null });
    expect(windowLevel(null, { start: 0, end: 1 })).toEqual({ status: 'unavailable' });
    expect(windowLevel(decoded([NaN, 0]), { start: 0, end: 1 })).toEqual({ status: 'unavailable' });
    expect(windowLevel(decoded([1]), { start: 1, end: 2 })).toEqual({ status: 'unavailable' });
    const long = { sampleRate: 22050, length: 22050 * 60, numberOfChannels: 2, getChannelData: () => { throw new Error('must not scan over budget'); } };
    expect(windowLevel(long, { start: 0, end: 60 })).toEqual({ status: 'too-long' });
  });

  it('counts only supplied unique grid instants, with no boundary double-count or fallback fabrication', () => {
    const grid = [0, 0.5, 1, 1, 2, NaN, -1];
    expect(windowGridTicks(grid, { start: 0, end: 1 }, 2)).toBe(2);
    expect(windowGridTicks(grid, { start: 1, end: 2 }, 2)).toBe(2);
    expect(windowGridTicks([], { start: 0, end: 1 }, 2)).toBe(0);
    expect(windowGridTicks(undefined, { start: 0, end: 1 }, 2)).toBeNull();
  });
});
