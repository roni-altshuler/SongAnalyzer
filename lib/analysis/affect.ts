/**
 * Lyrics-side affect mapping + the real agreement score.
 *
 * The old CombinedView "agreement" was Levenshtein distance between mood
 * *words* — "Euphoric" vs "Uplifting" scored ~27% despite being adjacent
 * feelings. This module replaces it: both engines' outputs are projected
 * onto the shared valence/arousal plane (`MOOD_COORDS` from
 * `lib/audio/mood-map.ts`) and agreement is a distance in that space.
 *
 * For lyrics we prefer the transformer's full emotion distribution (each
 * label has a natural circumplex position) and fall back to the blended
 * mood's coordinate when the transformer was skipped.
 *
 * Client-safe, pure TypeScript.
 */

import {
  MOOD_COORDS,
  affectDistance,
  type AffectPoint,
} from '@/lib/audio/mood-map';
import type { AnalysisResult } from '@/lib/types';

/** Circumplex coordinates for the transformer's emotion labels. */
export const EMOTION_COORDS: Record<string, AffectPoint> = {
  joy: { valence: 0.85, arousal: 0.55 },
  love: { valence: 0.7, arousal: 0 },
  surprise: { valence: 0.2, arousal: 0.65 },
  neutral: { valence: 0, arousal: -0.2 },
  sadness: { valence: -0.7, arousal: -0.45 },
  fear: { valence: -0.55, arousal: 0.6 },
  anger: { valence: -0.65, arousal: 0.8 },
  disgust: { valence: -0.6, arousal: 0.25 },
};

const clamp = (value: number): number => Math.min(1, Math.max(-1, value));

/**
 * Project a lyrics analysis onto the circumplex plane.
 *
 * Uses the score-weighted centroid of the transformer's emotion distribution
 * when available; otherwise the blended mood's canonical coordinate.
 */
export function lyricsAffect(result: AnalysisResult): AffectPoint {
  const scores = result.engines?.transformer?.scores;
  if (scores?.length) {
    let valence = 0;
    let arousal = 0;
    let total = 0;
    for (const { label, score } of scores) {
      const coord = EMOTION_COORDS[label.toLowerCase()];
      if (!coord || !(score > 0)) continue;
      valence += coord.valence * score;
      arousal += coord.arousal * score;
      total += score;
    }
    if (total > 0) {
      return {
        valence: Number(clamp(valence / total).toFixed(3)),
        arousal: Number(clamp(arousal / total).toFixed(3)),
      };
    }
  }

  return MOOD_COORDS[result.mood] ?? { valence: 0, arousal: 0 };
}

/** Maximum possible distance on the [-1,1]² plane. */
const MAX_AFFECT_DISTANCE = 2 * Math.SQRT2;

/** 1 = identical feeling, 0 = opposite corners of the plane. */
export function affectAgreement(a: AffectPoint, b: AffectPoint): number {
  return Number((1 - affectDistance(a, b) / MAX_AFFECT_DISTANCE).toFixed(3));
}

export interface AgreementBreakdown {
  agreement: number;
  /** lyrics minus audio, per axis. */
  valenceDelta: number;
  arousalDelta: number;
  /** Human-readable read on the tension, e.g. "the words are sadder than the sound". */
  summary: string;
}

export function agreementBreakdown(
  lyrics: AffectPoint,
  audio: AffectPoint,
): AgreementBreakdown {
  const agreement = affectAgreement(lyrics, audio);
  const valenceDelta = Number((lyrics.valence - audio.valence).toFixed(3));
  const arousalDelta = Number((lyrics.arousal - audio.arousal).toFixed(3));

  let summary: string;
  if (agreement >= 0.85) {
    summary = 'Words and sound tell the same emotional story.';
  } else if (Math.abs(valenceDelta) >= Math.abs(arousalDelta)) {
    summary =
      valenceDelta < 0
        ? 'The words are sadder than the sound.'
        : 'The words are brighter than the sound.';
  } else {
    summary =
      arousalDelta < 0
        ? 'The words sit calmer than the music drives.'
        : 'The words push harder than the music carries.';
  }

  return { agreement, valenceDelta, arousalDelta, summary };
}
