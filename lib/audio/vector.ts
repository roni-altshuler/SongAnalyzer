/**
 * Sonic fingerprint vector — the 48-dim embedding behind "feels like this"
 * similarity search (pgvector HNSW, cosine distance).
 *
 * Layout (48 dims):
 *   [ 0..12]  MFCC means / 50           (timbre)
 *   [13..25]  MFCC stds  / 50           (timbre variation)
 *   [26..37]  chroma means (0..1)       (harmony)
 *   [38]      tempo   (bpm-60)/140      (rhythm)
 *   [39..40]  rms mean ×4, rms std ×8   (loudness shape)
 *   [41..42]  centroid mean/5000, std/2500
 *   [43..44]  flux mean, flux std       (0..1 self-normalized)
 *   [45]      key strength (0..1)
 *   [46..47]  valence, arousal          (-1..1)
 *
 * The vector is L2-normalized at the end. `EXTRACTOR_VERSION` is persisted
 * next to it — the pgvector column dimension is locked at migration time, so
 * any change to this layout must bump the version and re-embed rather than
 * silently mixing incompatible vectors.
 */

import type { AudioFeaturesV2 } from './features';

export const EXTRACTOR_VERSION = 'v2.0';
export const SONIC_VECTOR_DIM = 48;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function buildSonicVector(f: AudioFeaturesV2): number[] {
  const dims: number[] = [];

  for (let i = 0; i < 13; i++) dims.push(clamp(safe(f.mfccMean[i] ?? 0) / 50, -1, 1));
  for (let i = 0; i < 13; i++) dims.push(clamp(safe(f.mfccStd[i] ?? 0) / 50, 0, 1));
  for (let i = 0; i < 12; i++) dims.push(clamp(safe(f.chromaMean[i] ?? 0), 0, 1));

  dims.push(clamp((safe(f.bpm) - 60) / 140, 0, 1));
  dims.push(clamp(safe(f.rmsMean) * 4, 0, 1));
  dims.push(clamp(safe(f.rmsStd) * 8, 0, 1));
  dims.push(clamp(safe(f.centroidMean) / 5000, 0, 1));
  dims.push(clamp(safe(f.centroidStd) / 2500, 0, 1));
  dims.push(clamp(safe(f.fluxMean), 0, 1));
  dims.push(clamp(safe(f.fluxStd), 0, 1));
  dims.push(clamp(safe(f.keyStrength), 0, 1));
  dims.push(clamp(safe(f.valence), -1, 1));
  dims.push(clamp(safe(f.arousal), -1, 1));

  // L2-normalize for cosine distance.
  const norm = Math.sqrt(dims.reduce((sum, v) => sum + v * v, 0));
  const vector = norm > 0 ? dims.map((v) => Number((v / norm).toFixed(6))) : dims;

  if (vector.length !== SONIC_VECTOR_DIM) {
    throw new Error(`sonic vector has ${vector.length} dims, expected ${SONIC_VECTOR_DIM}`);
  }
  return vector;
}

/** Server-side validation for client-posted vectors. */
export function isValidSonicVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === SONIC_VECTOR_DIM &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1)
  );
}
