/**
 * Musical key detection — Krumhansl-Schmuckler profile correlation.
 *
 * The mean chroma vector of the clip is correlated (Pearson) against all 24
 * rotations of the major/minor key profiles; the best correlation wins.
 * Pure TypeScript — unit-tested with synthetic triads.
 */

export interface KeyEstimate {
  key: string;
  scale: 'major' | 'minor';
  /** 0..1 — the winning Pearson correlation, clamped. */
  strength: number;
}

export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Krumhansl & Kessler (1982) probe-tone profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

/**
 * Detect the key of a 12-bin mean chroma vector (bin 0 = C).
 * Returns null for degenerate input (flat/empty chroma) or when no rotation
 * correlates positively.
 */
export function detectKey(chroma: number[]): KeyEstimate | null {
  if (chroma.length !== 12) return null;
  if (chroma.every((v) => v === chroma[0])) return null;

  let bestR = -Infinity;
  let best: KeyEstimate | null = null;

  for (let tonic = 0; tonic < 12; tonic++) {
    // Rotate the profiles so their tonic aligns with pitch class `tonic`.
    const major: number[] = new Array(12);
    const minor: number[] = new Array(12);
    for (let i = 0; i < 12; i++) {
      major[i] = MAJOR_PROFILE[(i - tonic + 12) % 12];
      minor[i] = MINOR_PROFILE[(i - tonic + 12) % 12];
    }

    for (const [scale, profile] of [['major', major], ['minor', minor]] as const) {
      const r = pearson(chroma, profile);
      if (r > bestR) {
        bestR = r;
        best = { key: PITCH_CLASSES[tonic], scale, strength: Math.min(1, Math.max(0, r)) };
      }
    }
  }

  return bestR > 0 ? best : null;
}
