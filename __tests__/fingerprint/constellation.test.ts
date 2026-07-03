import { describe, expect, it } from 'vitest';

import { fingerprint, packHash, unpackHash, FP_SAMPLE_RATE } from '@/lib/fingerprint/constellation';
import { MIN_MATCH_VOTES, RUNNER_UP_RATIO, type FingerprintHash } from '@/lib/fingerprint/types';

/**
 * Synthetic-signal tests for the constellation engine.
 *
 * A pseudo-song is a sum of sinusoids whose frequencies jump every 0.5s
 * (deterministic PRNG). Matching is emulated in JS with the same
 * offset-delta voting the `match_fingerprints` RPC performs, so the
 * acceptance thresholds are exercised end-to-end without Postgres.
 */

function makeRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function synth(durationSec: number, seed: number, sampleRate = FP_SAMPLE_RATE): Float32Array {
  const rand = makeRand(seed);
  const n = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(n);
  const segment = Math.floor(0.5 * sampleRate);
  let freqs = [220, 440, 880];
  for (let i = 0; i < n; i++) {
    if (i % segment === 0) {
      freqs = [100 + rand() * 700, 900 + rand() * 1400, 2400 + rand() * 2000];
    }
    const t = i / sampleRate;
    out[i] =
      0.3 * Math.sin(2 * Math.PI * freqs[0] * t) +
      0.25 * Math.sin(2 * Math.PI * freqs[1] * t) +
      0.2 * Math.sin(2 * Math.PI * freqs[2] * t);
  }
  return out;
}

function addNoise(signal: Float32Array, amplitude: number, seed: number): Float32Array {
  const rand = makeRand(seed);
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    out[i] = signal[i] + (rand() * 2 - 1) * amplitude;
  }
  return out;
}

/** Emulate the RPC: vote on (offset-delta bucket) alignment, return the spike. */
function alignedVotes(catalog: FingerprintHash[], query: FingerprintHash[]): number {
  const byHash = new Map<number, number[]>();
  for (const { h, t } of catalog) {
    const list = byHash.get(h);
    if (list) list.push(t);
    else byHash.set(h, [t]);
  }
  const buckets = new Map<number, number>();
  for (const { h, t } of query) {
    for (const catalogT of byHash.get(h) ?? []) {
      const bucket = Math.round((catalogT - t) / 100);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }
  return buckets.size ? Math.max(...buckets.values()) : 0;
}

describe('packHash / unpackHash', () => {
  it('round-trips all fields within their bit budgets', () => {
    for (const [f1, f2, dt] of [
      [0, 0, 1],
      [511, 511, 63],
      [37, 289, 12],
    ] as const) {
      expect(unpackHash(packHash(f1, f2, dt))).toEqual({ f1, f2, dt });
    }
  });

  it('stays within 24 bits', () => {
    expect(packHash(511, 511, 63)).toBeLessThan(1 << 24);
  });
});

describe('fingerprint', () => {
  it('returns no hashes for silence or too-short input', () => {
    expect(fingerprint(new Float32Array(64), FP_SAMPLE_RATE)).toEqual([]);
    expect(fingerprint(new Float32Array(FP_SAMPLE_RATE), FP_SAMPLE_RATE)).toEqual([]);
  });

  it('yields a healthy hash count for a 30s preview-like signal', () => {
    const hashes = fingerprint(synth(30, 42), FP_SAMPLE_RATE);
    expect(hashes.length).toBeGreaterThan(500);
    for (const { h, t } of hashes.slice(0, 50)) {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1 << 24);
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for the same signal', () => {
    const signal = synth(8, 7);
    expect(fingerprint(signal, FP_SAMPLE_RATE)).toEqual(fingerprint(signal, FP_SAMPLE_RATE));
  });

  it('thins evenly when over the hash budget', () => {
    const hashes = fingerprint(synth(30, 42), FP_SAMPLE_RATE, 100);
    expect(hashes.length).toBe(100);
    // Coverage should span the clip, not just its head.
    expect(hashes[hashes.length - 1].t).toBeGreaterThan(20_000);
  });

  it('a noisy snippet self-matches above threshold; a disjoint song does not', () => {
    const song = synth(20, 42);
    const catalog = fingerprint(song, FP_SAMPLE_RATE);

    // 6s snippet from 8s in, with noise on top (mic-style degradation).
    const snippet = addNoise(
      song.slice(8 * FP_SAMPLE_RATE, 14 * FP_SAMPLE_RATE),
      0.05,
      99,
    );
    const queryHashes = fingerprint(snippet, FP_SAMPLE_RATE);
    const matchVotes = alignedVotes(catalog, queryHashes);

    const otherSong = synth(20, 1337);
    const otherQuery = fingerprint(
      otherSong.slice(8 * FP_SAMPLE_RATE, 14 * FP_SAMPLE_RATE),
      FP_SAMPLE_RATE,
    );
    const mismatchVotes = alignedVotes(catalog, otherQuery);

    expect(matchVotes).toBeGreaterThanOrEqual(MIN_MATCH_VOTES);
    expect(matchVotes).toBeGreaterThanOrEqual(mismatchVotes * RUNNER_UP_RATIO);
  });
});
