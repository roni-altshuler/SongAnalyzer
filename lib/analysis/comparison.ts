/** Presentation evidence for two independently supplied readings. Client-safe. */
import { EMOTION_COORDS, lyricsAffect, type AgreementBreakdown } from './affect';
import { MOOD_COORDS, type AffectPoint } from '@/lib/audio/mood-map';
import type { AnalysisResult, AudioAnalysisResult, AudioAnalysisResultV2 } from '@/lib/types';

export interface ComparisonProjection {
  point: AffectPoint | null;
  basis: 'emotion-scores' | 'mood-label' | 'signal' | 'unavailable';
}

function validPoint(point: AffectPoint | undefined): point is AffectPoint {
  return Boolean(point && Number.isFinite(point.valence) && Number.isFinite(point.arousal)
    && Math.abs(point.valence) <= 1 && Math.abs(point.arousal) <= 1);
}

function mappedMood(mood: string): ComparisonProjection {
  const point = MOOD_COORDS[mood];
  return validPoint(point) ? { point, basis: 'mood-label' } : { point: null, basis: 'unavailable' };
}

export function lyricsComparisonProjection(result: AnalysisResult): ComparisonProjection {
  const engines = result.engines;
  const transformer = engines?.transformer;
  if (engines && transformer?.status === 'ok' && Array.isArray(transformer.scores)) {
    const scores = transformer.scores.filter(entry => entry && typeof entry.label === 'string'
      && validPoint(EMOTION_COORDS[entry.label.toLowerCase()])
      && Number.isFinite(entry.score) && entry.score > 0 && entry.score <= 1);
    if (scores.length) {
      // Reuse the existing weighted projection for valid reported scores.
      const point = lyricsAffect({ ...result, engines: { ...engines, transformer: { ...transformer, scores } } });
      if (validPoint(point)) return { point, basis: 'emotion-scores' };
    }
  }
  return mappedMood(result.mood);
}

export function audioComparisonProjection(result: AudioAnalysisResult | AudioAnalysisResultV2): ComparisonProjection {
  if ('engineVersion' in result && result.engineVersion === 'v1-fallback') return mappedMood(result.mood);
  if ('v2' in result && result.v2) {
    const { valence, arousal } = result.v2;
    const point = { valence, arousal };
    return validPoint(point) ? { point, basis: 'signal' } : { point: null, basis: 'unavailable' };
  }
  // A declared MIR result with missing coordinates cannot supply a comparison.
  if ('engineVersion' in result && result.engineVersion === 'v2') return { point: null, basis: 'unavailable' };
  return mappedMood(result.mood);
}

/** Describe positions of estimates without asserting a song's meaning. */
export function describeEstimateDifference(breakdown: AgreementBreakdown): string {
  if (breakdown.agreement >= 0.85) return 'The two estimates sit close together on this map.';
  if (Math.abs(breakdown.valenceDelta) >= Math.abs(breakdown.arousalDelta)) {
    return breakdown.valenceDelta < 0
      ? 'The audio estimate sits on the more positive side of the map.'
      : 'The lyrics estimate sits on the more positive side of the map.';
  }
  return breakdown.arousalDelta < 0
    ? 'The audio estimate sits on the more energetic side of the map.'
    : 'The lyrics estimate sits on the more energetic side of the map.';
}
