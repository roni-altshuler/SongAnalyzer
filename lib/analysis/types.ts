/**
 * Internal types for the hybrid analysis engine (keyword + transformer).
 *
 * These types describe per-engine outputs and blend options. The public
 * `AnalysisResult` (consumed by client components, history, and the API
 * response shape) lives in `@/lib/types`; this module produces values that
 * are merged into that shape by `blend.ts`.
 *
 * IMPORTANT: this module is safe to import from both server and client code
 * (it has no Node-only imports). Engine implementations live in sibling files
 * (`./keyword`, `./transformer`, `./blend`) which may have server-only deps;
 * import those only from server contexts (API routes).
 */

/**
 * Result of the deterministic keyword engine.
 *
 * Mirrors the legacy `/api/analyze` response: mood/vibe/energy/sentiment plus
 * extracted themes and a length-driven confidence score. Always succeeds,
 * synchronous, no network calls.
 */
export interface KeywordResult {
  mood: string;
  vibe: string;
  energy: string;
  sentiment: string;
  themes: string[];
  detailedAnalysis: string;
  confidence: number;
  wordCount: number;
  /** Raw per-bucket counts for downstream blending / debugging. */
  scores: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

/**
 * Lifecycle status of an engine for a given analysis request.
 *
 * - `ok`: produced a result
 * - `skipped`: deliberately not run (e.g., HF token absent)
 * - `unavailable`: tried but failed (rate-limit, 503, network)
 * - `timeout`: aborted by the 8s `AbortSignal.timeout`
 * - `error`: any other unexpected failure
 */
export type EngineStatus = 'ok' | 'skipped' | 'unavailable' | 'timeout' | 'error';

/**
 * Raw emotion label vocabulary emitted by the primary HF model
 * (`j-hartmann/emotion-english-distilroberta-base`) and the fallback
 * (`bhadresh-savani/distilbert-base-uncased-emotion`). Both models share the
 * same Ekman-style label set, plus `neutral` from the primary.
 */
export type TransformerEmotion =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'love'
  | 'surprise'
  | 'disgust'
  | 'neutral';

/**
 * Per-label score from a single transformer pass, normalized to [0, 1].
 */
export interface EmotionScore {
  label: TransformerEmotion;
  score: number;
}

/**
 * Result of the transformer engine. Distinct from the in-app mood vocabulary —
 * the blend step maps the top emotion to a mood label (see `palette.ts`/blend).
 */
export interface TransformerResult {
  /** Highest-scoring emotion label from the model. */
  topEmotion: TransformerEmotion;
  /** Mapped mood label in the app's vocabulary (e.g., 'Euphoric'). */
  mood: string;
  /** App-vocab sentiment derived from the emotion ('Positive', 'Negative', ...). */
  sentiment: string;
  /** Full per-label scores, sorted descending. */
  scores: EmotionScore[];
  /** Confidence = top score, in [0, 1]. */
  confidence: number;
  /** Identifier of the model that produced the result. */
  model: string;
}

/**
 * Provenance metadata describing how each engine fared. Surfaced in the API
 * response so the UI can show transparency badges and degrade gracefully.
 */
export interface EngineProvenance {
  transformer: {
    status: EngineStatus;
    model?: string;
    /** Top-N scores for display when available. */
    scores?: EmotionScore[];
    /** Human-readable reason when status !== 'ok'. */
    reason?: string;
  };
  keyword: {
    status: EngineStatus;
    /** Raw bucket counts that drove the legacy sentiment classifier. */
    scores?: KeywordResult['scores'];
  };
}

/**
 * Optional knobs for blending. Defaults are chosen to match the v2 spec:
 * transformer's top emotion wins for mood when present; keyword still drives
 * themes; confidence is a weighted average favoring the transformer.
 */
export interface BlendOptions {
  /** Weight applied to transformer confidence in [0, 1]. Default 0.7. */
  transformerWeight?: number;
  /** Weight applied to keyword confidence in [0, 1]. Default 0.3. */
  keywordWeight?: number;
}
