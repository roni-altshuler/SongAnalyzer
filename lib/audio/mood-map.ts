/**
 * Valence/arousal (circumplex) mood mapping for the v2 audio engine.
 *
 * `MOOD_COORDS` places every mood in `lib/analysis/palette.ts` on the
 * circumplex plane. It is the shared vocabulary between the audio engine
 * (features → affect → nearest mood) and the lyrics side
 * (`lib/analysis/affect.ts` maps engine output onto the same plane), which
 * is what makes the CombinedView agreement score a *distance in a meaningful
 * space* instead of string edit distance.
 *
 * Pure TypeScript, client-safe.
 */

export interface AffectPoint {
  /** -1 (negative) .. +1 (positive) */
  valence: number;
  /** -1 (calm) .. +1 (energetic) */
  arousal: number;
}

/** Circumplex coordinates for the 13 palette moods. */
export const MOOD_COORDS: Record<string, AffectPoint> = {
  Euphoric: { valence: 0.9, arousal: 0.8 },
  Uplifting: { valence: 0.7, arousal: 0.5 },
  Hopeful: { valence: 0.6, arousal: 0.15 },
  Romantic: { valence: 0.55, arousal: -0.15 },
  Peaceful: { valence: 0.4, arousal: -0.7 },
  Nostalgic: { valence: 0.1, arousal: -0.35 },
  Contemplative: { valence: 0, arousal: -0.55 },
  Bittersweet: { valence: -0.25, arousal: -0.1 },
  Melancholic: { valence: -0.6, arousal: -0.45 },
  Somber: { valence: -0.5, arousal: -0.7 },
  Sorrowful: { valence: -0.8, arousal: -0.35 },
  Anxious: { valence: -0.5, arousal: 0.6 },
  Aggressive: { valence: -0.65, arousal: 0.85 },
};

const clamp = (value: number, min = -1, max = 1): number =>
  Math.min(max, Math.max(min, value));

export interface AffectInputs {
  bpm: number;
  /** Raw mean RMS of the clip (typically 0.05–0.3). */
  rmsMean: number;
  /** Mean of the self-normalized flux series (0..1). */
  fluxMean: number;
  /** Mean spectral centroid in Hz. */
  centroidMean: number;
  scale: 'major' | 'minor' | null;
  /** 0..1 key-detection confidence. */
  keyStrength: number;
}

/**
 * Map v2 audio features onto the circumplex plane.
 *
 * Arousal: tempo + loudness + spectral change. Valence: musical mode
 * (weighted by how confidently the key was detected) + brightness, with a
 * small arousal coupling (energetic music skews slightly positive).
 */
export function audioAffect(f: AffectInputs): AffectPoint {
  const tempoN = clamp((f.bpm - 110) / 60);
  const loudN = clamp(f.rmsMean * 6 - 1);
  const fluxN = clamp(f.fluxMean * 2 - 1);
  const arousal = clamp(0.5 * tempoN + 0.35 * loudN + 0.15 * fluxN);

  const modeN = f.scale === 'major' ? f.keyStrength : f.scale === 'minor' ? -f.keyStrength : 0;
  const brightN = clamp((f.centroidMean - 2200) / 1800);
  const valence = clamp(0.45 * modeN + 0.35 * brightN + 0.2 * arousal);

  return {
    valence: Number(valence.toFixed(3)),
    arousal: Number(arousal.toFixed(3)),
  };
}

export function affectDistance(a: AffectPoint, b: AffectPoint): number {
  return Math.hypot(a.valence - b.valence, a.arousal - b.arousal);
}

/** Nearest palette mood to a circumplex point. */
export function nearestMood(point: AffectPoint): string {
  let best = 'Contemplative';
  let bestDist = Infinity;
  for (const [mood, coord] of Object.entries(MOOD_COORDS)) {
    const dist = affectDistance(point, coord);
    if (dist < bestDist) {
      bestDist = dist;
      best = mood;
    }
  }
  return best;
}
