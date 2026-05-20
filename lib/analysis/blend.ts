/**
 * Blend keyword + transformer engine outputs into a single `AnalysisResult`.
 *
 * Rules (per v2 plan):
 *   - When the transformer succeeds:
 *       * `mood` ← transformer's mapped emotion
 *       * `sentiment` ← transformer's coarse sentiment
 *       * `themes` ← keyword's extracted themes (transformer doesn't do these)
 *       * `vibe` / `energy` ← keyword (mood-derived heuristics)
 *       * `confidence` ← weighted average (default 0.7 transformer / 0.3 keyword)
 *       * `detailedAnalysis` ← keyword's prose, regenerated with the merged mood
 *   - When the transformer is null / unavailable:
 *       * Return the keyword result verbatim. `engines.transformer.status`
 *         tells the UI to render a "transformer unavailable" badge.
 *
 * `engines` provenance is always populated so the UI can show which engine
 * drove which field. `moodColor` is wired in by the API route via `palette.ts`.
 */

import type { AnalysisResult, EngineProvenance } from '@/lib/types';
import type {
  BlendOptions,
  EngineStatus,
  KeywordResult,
  TransformerResult,
} from './types';

const DEFAULT_TRANSFORMER_WEIGHT = 0.7;
const DEFAULT_KEYWORD_WEIGHT = 0.3;

/**
 * Lightweight, mood-aware retread of the keyword detailed-analysis prose so
 * the blended result's text references the transformer's mood (e.g., readers
 * see "euphoric" rather than the keyword module's possibly-conflicting label).
 *
 * Kept inline rather than re-importing the keyword module's private helper
 * because the keyword result already contains a generated string we can splice.
 */
function rewriteForBlendedMood(
  keywordProse: string,
  oldMood: string,
  newMood: string,
): string {
  if (!oldMood || oldMood === newMood) return keywordProse;
  const re = new RegExp(`\\b${oldMood}\\b`, 'gi');
  return keywordProse.replace(re, newMood);
}

export interface BlendInput {
  keyword: KeywordResult;
  transformer: TransformerResult | null;
  /** Status to record for the transformer engine when `transformer` is null. */
  transformerStatus?: EngineStatus;
  /** Human-readable reason matching `transformerStatus`. */
  transformerReason?: string;
  options?: BlendOptions;
}

/**
 * Merge engine outputs into the canonical `AnalysisResult` shape.
 *
 * `AnalysisResult` here is the type from `@/lib/types`, which Stream C
 * extends additively with optional `engines` and `moodColor` fields.
 */
export function blendResults(input: BlendInput): AnalysisResult {
  const { keyword, transformer, transformerStatus, transformerReason, options } = input;

  const engines: EngineProvenance = {
    keyword: {
      status: 'ok',
      scores: keyword.scores,
    },
    transformer: transformer
      ? {
          status: 'ok',
          model: transformer.model,
          scores: transformer.scores,
        }
      : {
          status: transformerStatus ?? 'unavailable',
          reason: transformerReason,
        },
  };

  // Transformer absent: return keyword result with provenance attached.
  if (!transformer) {
    return {
      mood: keyword.mood,
      vibe: keyword.vibe,
      energy: keyword.energy,
      sentiment: keyword.sentiment,
      themes: keyword.themes,
      detailedAnalysis: keyword.detailedAnalysis,
      confidence: keyword.confidence,
      wordCount: keyword.wordCount,
      engines,
    };
  }

  // Both engines succeeded — blend.
  const tw = options?.transformerWeight ?? DEFAULT_TRANSFORMER_WEIGHT;
  const kw = options?.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  const denom = tw + kw || 1;
  const blendedConfidence = (transformer.confidence * tw + keyword.confidence * kw) / denom;

  const mood = transformer.mood;
  const sentiment = transformer.sentiment;
  const detailedAnalysis = rewriteForBlendedMood(
    keyword.detailedAnalysis,
    keyword.mood.toLowerCase(),
    mood.toLowerCase(),
  );

  return {
    mood,
    vibe: keyword.vibe,
    energy: keyword.energy,
    sentiment,
    themes: keyword.themes,
    detailedAnalysis,
    confidence: Number(blendedConfidence.toFixed(3)),
    wordCount: keyword.wordCount,
    engines,
  };
}
