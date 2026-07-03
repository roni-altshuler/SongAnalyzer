/**
 * Shared FFT + windowing helpers for the audio engine.
 *
 * A single iterative radix-2 Cooley-Tukey implementation feeds both the
 * fingerprint engine (`lib/fingerprint/constellation.ts`) and the v2 feature
 * extractor (`lib/audio/features.ts`). It replaces the O(n²) DFT that the v1
 * analyser (`lib/audio-analysis.ts`) uses for its single spectral-centroid
 * frame — that file is intentionally left untouched as the fail-soft
 * fallback engine.
 *
 * Pure TypeScript, no DOM or Node APIs — importable from Web Workers, the
 * seed script (tsx), and Vitest alike.
 */

interface FftTables {
  cos: Float32Array;
  sin: Float32Array;
  rev: Uint32Array;
}

const tableCache = new Map<number, FftTables>();
const windowCache = new Map<number, Float32Array>();

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function getTables(n: number): FftTables {
  const cached = tableCache.get(n);
  if (cached) return cached;

  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / n);
    sin[i] = Math.sin((-2 * Math.PI * i) / n);
  }

  // Bit-reversal permutation table.
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) {
      r = (r << 1) | ((i >>> b) & 1);
    }
    rev[i] = r;
  }

  const tables = { cos, sin, rev };
  tableCache.set(n, tables);
  return tables;
}

/**
 * Periodic Hann window of the given size (cached per size).
 * Returned array is shared — treat as read-only.
 */
export function hannWindow(size: number): Float32Array {
  const cached = windowCache.get(size);
  if (cached) return cached;
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
  }
  windowCache.set(size, w);
  return w;
}

/** Multiply a frame by a window in place. Lengths must match. */
export function applyWindow(frame: Float32Array, window: Float32Array): void {
  for (let i = 0; i < frame.length; i++) frame[i] *= window[i];
}

/**
 * Magnitude spectrum of a real-valued frame.
 *
 * `frame.length` must be a power of two. Returns the first `length / 2`
 * magnitude bins (DC through just below Nyquist). Pass `out` to reuse a
 * buffer across frames in tight loops.
 */
export function fftMagnitude(frame: Float32Array, out?: Float32Array): Float32Array {
  const n = frame.length;
  if (!isPowerOfTwo(n)) {
    throw new Error(`fftMagnitude: frame length ${n} is not a power of two`);
  }

  const { cos, sin, rev } = getTables(n);

  // Bit-reversed copy into working arrays (imaginary part starts at zero).
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[rev[i]] = frame[i];

  // Iterative butterflies.
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0, twiddle = 0; k < half; k++, twiddle += step) {
        const evenIdx = start + k;
        const oddIdx = evenIdx + half;
        const tRe = re[oddIdx] * cos[twiddle] - im[oddIdx] * sin[twiddle];
        const tIm = re[oddIdx] * sin[twiddle] + im[oddIdx] * cos[twiddle];
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] += tRe;
        im[evenIdx] += tIm;
      }
    }
  }

  const half = n >> 1;
  const mag = out && out.length === half ? out : new Float32Array(half);
  for (let k = 0; k < half; k++) {
    mag[k] = Math.hypot(re[k], im[k]);
  }
  return mag;
}
