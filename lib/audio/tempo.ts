/**
 * Tempo estimation + beat grid from an onset envelope.
 *
 * Autocorrelation of the spectral-flux onset envelope with octave-error
 * correction (the classic failure mode: half/double tempo), then a phase
 * search that lays a beat grid over the clip. Replaces the v1 engine's
 * amplitude-difference single-pass estimate.
 *
 * Pure TypeScript — unit-tested with synthetic click trains.
 */

export interface TempoEstimate {
  bpm: number;
  /** Beat instants in seconds from the start of the clip. */
  beatGrid: number[];
  /** 0..1 — normalized autocorrelation of the winning lag. */
  strength: number;
}

const MIN_BPM = 60;
const MAX_BPM = 200;
/** Ambiguous octaves resolve toward this musically-common range. */
const PREFERRED_MIN = 70;
const PREFERRED_MAX = 180;
const OCTAVE_TOLERANCE = 0.75;

/** Sharpen an onset envelope: subtract a moving mean, half-wave rectify. */
function sharpen(envelope: ArrayLike<number>, meanWindow: number): Float32Array {
  const n = envelope.length;
  const out = new Float32Array(n);
  let windowSum = 0;
  const half = Math.floor(meanWindow / 2);

  for (let i = 0; i < Math.min(n, meanWindow); i++) windowSum += envelope[i];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n, i + half + 1);
    // Recompute incrementally would be nicer; n is small (~1300 for 30s).
    let sum = 0;
    for (let j = start; j < end; j++) sum += envelope[j];
    out[i] = Math.max(0, envelope[i] - sum / (end - start));
  }
  return out;
}

/** Normalized autocorrelation at one lag. */
function autocorrAt(env: Float32Array, lag: number, energy: number): number {
  let sum = 0;
  const n = env.length - lag;
  if (n <= 0 || energy <= 0) return 0;
  for (let i = 0; i < n; i++) sum += env[i] * env[i + lag];
  return sum / energy;
}

/**
 * Estimate tempo from an onset envelope (one value per analysis hop).
 * Returns null when the clip is too short or has no rhythmic structure.
 */
export function estimateTempo(
  envelope: ArrayLike<number>,
  hopSeconds: number,
): TempoEstimate | null {
  const minLag = Math.max(1, Math.round(60 / (MAX_BPM * hopSeconds)));
  const maxLag = Math.round(60 / (MIN_BPM * hopSeconds));
  if (envelope.length < maxLag * 2) return null;

  const meanWindow = Math.max(3, Math.round(0.5 / hopSeconds));
  const env = sharpen(envelope, meanWindow);

  let energy = 0;
  for (let i = 0; i < env.length; i++) energy += env[i] * env[i];
  if (energy <= 1e-12) return null;

  // Base sweep over the whole BPM range.
  let bestLag = 0;
  let bestScore = 0;
  const scores = new Map<number, number>();
  for (let lag = minLag; lag <= maxLag; lag++) {
    const score = autocorrAt(env, lag, energy);
    scores.set(lag, score);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag === 0 || bestScore <= 0) return null;

  // Octave correction: consider half and double period; prefer the
  // musically-common range when its score is within tolerance of the best.
  const scoreFor = (lag: number): number =>
    scores.get(lag) ?? (lag >= 1 && lag <= env.length - 1 ? autocorrAt(env, lag, energy) : 0);

  const candidates = [bestLag, bestLag * 2, Math.round(bestLag / 2)]
    .filter((lag) => lag >= 1)
    .map((lag) => ({ lag, bpm: 60 / (lag * hopSeconds), score: scoreFor(lag) }))
    .filter((c) => c.bpm >= MIN_BPM / 2 && c.bpm <= MAX_BPM * 2);

  let chosen = { lag: bestLag, bpm: 60 / (bestLag * hopSeconds), score: bestScore };
  for (const candidate of candidates) {
    const preferred = candidate.bpm >= PREFERRED_MIN && candidate.bpm <= PREFERRED_MAX;
    const chosenPreferred = chosen.bpm >= PREFERRED_MIN && chosen.bpm <= PREFERRED_MAX;
    if (preferred && !chosenPreferred && candidate.score >= bestScore * OCTAVE_TOLERANCE) {
      chosen = candidate;
    }
  }

  // Phase search: slide the beat comb across one period, keep the phase
  // that collects the most onset energy.
  const period = chosen.lag;
  let bestPhase = 0;
  let bestPhaseScore = -Infinity;
  for (let phase = 0; phase < period; phase++) {
    let sum = 0;
    for (let i = phase; i < env.length; i += period) sum += env[i];
    if (sum > bestPhaseScore) {
      bestPhaseScore = sum;
      bestPhase = phase;
    }
  }

  const beatGrid: number[] = [];
  for (let i = bestPhase; i < env.length; i += period) {
    beatGrid.push(Number((i * hopSeconds).toFixed(3)));
  }

  return {
    bpm: Math.round(chosen.bpm),
    beatGrid,
    strength: Math.min(1, Math.max(0, chosen.score)),
  };
}
