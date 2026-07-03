/**
 * Spectral-peak constellation fingerprinting (Wang 2003, the Shazam paper),
 * tuned for Spotify's 30-second previews and ~10-second mic snippets.
 *
 * Pipeline:
 *   1. Resample the mono signal to 11,025 Hz (block-average decimation).
 *   2. STFT: 1024-sample Hann frames, hop 512 (~46 ms per frame).
 *   3. Peak picking: per frame, take the maximum bin in each of 6 log-spaced
 *      bands and keep the ones at or above the mean of those band maxima —
 *      an adaptive floor that guarantees landmarks in bass AND treble
 *      regardless of the clip's loudness.
 *   4. Pairing: each anchor peak pairs with up to 5 later peaks inside a
 *      target zone (1–63 frames ahead). Hash = f1(9b) | f2(9b) | Δt(6b),
 *      packed into 24 bits so it fits a Postgres `integer`.
 *
 * The hashes are non-reversible — no audio can be reconstructed from them —
 * which is what makes storing them for catalog matching acceptable where
 * storing preview audio would not be.
 *
 * Pure TypeScript. Runs in the fingerprint Web Worker, the seed script, and
 * Vitest without modification.
 */

import { applyWindow, fftMagnitude, hannWindow } from '@/lib/audio/fft';
import { resampleTo } from '@/lib/audio/pcm';
import { FINGERPRINT_VERSION, MAX_HASHES_PER_INGEST, type FingerprintHash } from './types';

export { FINGERPRINT_VERSION };

export const FP_SAMPLE_RATE = 11_025;
export const FP_FFT_SIZE = 1_024;
export const FP_HOP = 512;

/** Log-spaced band edges over the 512 magnitude bins (0–5,512 Hz). */
const BAND_EDGES = [1, 10, 20, 40, 80, 160, 512];

/** Each anchor pairs with up to this many peaks in its target zone. */
const FAN_OUT = 5;
/** Target zone in frames ahead of the anchor. Δt must fit in 6 bits. */
const MIN_DT = 1;
const MAX_DT = 63;

/** Frames quieter than this RMS are silence — no peaks harvested. */
const SILENCE_RMS = 1e-4;

const MS_PER_FRAME = (FP_HOP / FP_SAMPLE_RATE) * 1000;

interface Peak {
  frame: number;
  bin: number;
}

/** Pack an anchor/target pair into the 24-bit hash. */
export function packHash(f1: number, f2: number, dt: number): number {
  return ((f1 & 0x1ff) << 15) | ((f2 & 0x1ff) << 6) | (dt & 0x3f);
}

/** Inverse of {@link packHash} — used by tests and debugging tools. */
export function unpackHash(h: number): { f1: number; f2: number; dt: number } {
  return { f1: (h >>> 15) & 0x1ff, f2: (h >>> 6) & 0x1ff, dt: h & 0x3f };
}

/** Harvest the constellation peaks of one magnitude frame. */
function framePeaks(mag: Float32Array, frame: number): Peak[] {
  const candidates: Array<Peak & { value: number }> = [];

  for (let band = 0; band < BAND_EDGES.length - 1; band++) {
    const start = BAND_EDGES[band];
    const end = BAND_EDGES[band + 1];
    let bestBin = -1;
    let bestVal = 0;
    for (let bin = start; bin < end; bin++) {
      if (mag[bin] > bestVal) {
        bestVal = mag[bin];
        bestBin = bin;
      }
    }
    if (bestBin >= 0 && bestVal > 0) {
      candidates.push({ frame, bin: bestBin, value: bestVal });
    }
  }

  if (candidates.length === 0) return [];

  // Adaptive floor: keep band maxima at or above the frame's mean band max.
  const mean = candidates.reduce((sum, c) => sum + c.value, 0) / candidates.length;
  return candidates.filter((c) => c.value >= mean).map(({ frame: f, bin }) => ({ frame: f, bin }));
}

/**
 * Fingerprint a mono PCM buffer.
 *
 * @param pcm        Mono samples in [-1, 1].
 * @param sampleRate Source sample rate; resampled to 11,025 Hz internally.
 * @param maxHashes  Ceiling on returned hashes (evenly thinned when above).
 */
export function fingerprint(
  pcm: Float32Array,
  sampleRate: number,
  maxHashes: number = MAX_HASHES_PER_INGEST,
): FingerprintHash[] {
  const signal = resampleTo(pcm, sampleRate, FP_SAMPLE_RATE);
  if (signal.length < FP_FFT_SIZE) return [];

  const window = hannWindow(FP_FFT_SIZE);
  const frameCount = Math.floor((signal.length - FP_FFT_SIZE) / FP_HOP) + 1;
  const mag = new Float32Array(FP_FFT_SIZE / 2);
  const frame = new Float32Array(FP_FFT_SIZE);

  // 1. Constellation map: the surviving peaks of every frame, in time order.
  const peaks: Peak[] = [];
  for (let i = 0; i < frameCount; i++) {
    const start = i * FP_HOP;
    frame.set(signal.subarray(start, start + FP_FFT_SIZE));

    // Cheap silence gate before paying for the FFT.
    let energy = 0;
    for (let j = 0; j < FP_FFT_SIZE; j++) energy += frame[j] * frame[j];
    if (Math.sqrt(energy / FP_FFT_SIZE) < SILENCE_RMS) continue;

    applyWindow(frame, window);
    fftMagnitude(frame, mag);
    peaks.push(...framePeaks(mag, i));
  }

  // 2. Pair anchors with targets in their zone.
  const hashes: FingerprintHash[] = [];
  for (let a = 0; a < peaks.length; a++) {
    const anchor = peaks[a];
    let paired = 0;
    for (let b = a + 1; b < peaks.length && paired < FAN_OUT; b++) {
      const target = peaks[b];
      const dt = target.frame - anchor.frame;
      if (dt < MIN_DT) continue;
      if (dt > MAX_DT) break; // peaks are frame-ordered — zone exhausted
      hashes.push({
        h: packHash(anchor.bin, target.bin, dt),
        t: Math.round(anchor.frame * MS_PER_FRAME),
      });
      paired++;
    }
  }

  // 3. Thin evenly when over budget so coverage stays spread across the clip.
  if (hashes.length > maxHashes) {
    const step = hashes.length / maxHashes;
    const thinned: FingerprintHash[] = new Array(maxHashes);
    for (let i = 0; i < maxHashes; i++) thinned[i] = hashes[Math.floor(i * step)];
    return thinned;
  }

  return hashes;
}
