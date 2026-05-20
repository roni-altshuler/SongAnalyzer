/**
 * Hugging Face transformer engine for emotion classification.
 *
 * Primary model:  j-hartmann/emotion-english-distilroberta-base
 *                  (labels: joy, sadness, anger, fear, love, surprise, neutral)
 * Fallback model: bhadresh-savani/distilbert-base-uncased-emotion
 *                  (labels: joy, sadness, anger, fear, love, surprise)
 *
 * Strategy:
 *   1. Try primary with `AbortSignal.timeout(8000)`.
 *   2. On 503 / network / model-loading error, retry once with fallback.
 *   3. On any unrecoverable failure (no token, both models down, timeout), the
 *      caller catches and downgrades to the keyword-only path. We surface
 *      structured errors via `TransformerError`.
 *
 * SERVER-ONLY. The HF token must never reach the client. This file uses
 * `process.env.HUGGINGFACE_API_KEY` directly — only import from API routes /
 * server modules. Client code should only `import type` from
 * `./types`.
 */

import type { EmotionScore, TransformerEmotion, TransformerResult } from './types';

const PRIMARY_MODEL = 'j-hartmann/emotion-english-distilroberta-base';
const FALLBACK_MODEL = 'bhadresh-savani/distilbert-base-uncased-emotion';
const TIMEOUT_MS = 8000;

/**
 * Map raw HF emotion labels to the app's mood vocabulary.
 *
 * The mapping is intentionally lossy — e.g., the model's `joy` can mean
 * anything from contentment to euphoria, but for a lyric-analysis surface
 * 'Euphoric' is the most evocative label. The transformer's confidence score
 * is preserved separately so the UI can dial intensity from there.
 */
const EMOTION_TO_MOOD: Record<TransformerEmotion, string> = {
  joy: 'Euphoric',
  sadness: 'Melancholic',
  anger: 'Aggressive',
  fear: 'Anxious',
  love: 'Romantic',
  surprise: 'Uplifting',
  disgust: 'Bittersweet',
  neutral: 'Contemplative',
};

/**
 * Coarse-grained sentiment derived from the dominant emotion.
 */
const EMOTION_TO_SENTIMENT: Record<TransformerEmotion, string> = {
  joy: 'Very Positive',
  love: 'Very Positive',
  surprise: 'Positive',
  neutral: 'Neutral/Mixed',
  fear: 'Negative',
  sadness: 'Very Negative',
  anger: 'Very Negative',
  disgust: 'Negative',
};

/**
 * Discriminated error for transformer failures. The API route uses the
 * `kind` field to populate `engines.transformer.status`.
 */
export class TransformerError extends Error {
  readonly kind: 'timeout' | 'unavailable' | 'skipped' | 'error';
  readonly reason: string;
  constructor(kind: TransformerError['kind'], reason: string) {
    super(`[transformer:${kind}] ${reason}`);
    this.kind = kind;
    this.reason = reason;
  }
}

/**
 * Raw HF inference API response shape for text-classification. The endpoint
 * returns `[[{label, score}, ...]]` when `return_all_scores: true`, and
 * `[{label, score}]` otherwise. We pass the option below and handle both.
 */
type RawScore = { label: string; score: number };

function normalizeRaw(payload: unknown): RawScore[] {
  if (!Array.isArray(payload)) return [];
  // Some HF responses are double-wrapped: [[{...}]].
  if (payload.length === 0) return [];
  if (Array.isArray(payload[0])) return payload[0] as RawScore[];
  return payload as RawScore[];
}

function toEmotionScores(raw: RawScore[]): EmotionScore[] {
  const known: TransformerEmotion[] = [
    'joy', 'sadness', 'anger', 'fear', 'love', 'surprise', 'disgust', 'neutral',
  ];
  const out: EmotionScore[] = [];
  for (const item of raw) {
    const label = item.label.toLowerCase() as TransformerEmotion;
    if (known.includes(label) && typeof item.score === 'number') {
      out.push({ label, score: item.score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Call a single HF model with timeout. Throws `TransformerError` on failure.
 */
async function callModel(
  model: string,
  text: string,
  token: string,
  signal: AbortSignal,
): Promise<EmotionScore[]> {
  let response: Response;
  try {
    response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: false },
          parameters: { return_all_scores: true },
        }),
        signal,
      },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TransformerError('timeout', `model ${model} aborted after ${TIMEOUT_MS}ms`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new TransformerError('unavailable', `network error: ${msg}`);
  }

  if (response.status === 503) {
    // Model is loading — HF returns 503 with `estimated_time`.
    throw new TransformerError('unavailable', `${model} loading (503)`);
  }
  if (response.status === 429) {
    throw new TransformerError('unavailable', `${model} rate-limited (429)`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new TransformerError('error', `${model} HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = await response.json().catch(() => null);
  const scores = toEmotionScores(normalizeRaw(payload));
  if (scores.length === 0) {
    throw new TransformerError('error', `${model} returned no recognized labels`);
  }
  return scores;
}

/**
 * Run the transformer engine on a string of lyrics.
 *
 * Returns a `TransformerResult` on success; throws `TransformerError` on any
 * failure (caller is expected to swallow and fall back to keyword). The error's
 * `kind` field tells the route which `engines.transformer.status` to record.
 *
 * If `HUGGINGFACE_API_KEY` is unset, throws `TransformerError('skipped')`
 * immediately — no network call.
 */
export async function analyzeTransformer(lyrics: string): Promise<TransformerResult> {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    throw new TransformerError('skipped', 'HUGGINGFACE_API_KEY not set');
  }

  // One signal covers BOTH attempts so total wall time can't exceed TIMEOUT_MS.
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  let scores: EmotionScore[];
  let modelUsed: string;
  try {
    scores = await callModel(PRIMARY_MODEL, lyrics, token, signal);
    modelUsed = PRIMARY_MODEL;
  } catch (primaryErr) {
    if (!(primaryErr instanceof TransformerError)) throw primaryErr;
    // Only retry for transient failures, not for `skipped` (impossible here).
    if (primaryErr.kind === 'timeout') throw primaryErr;
    try {
      scores = await callModel(FALLBACK_MODEL, lyrics, token, signal);
      modelUsed = FALLBACK_MODEL;
    } catch (fallbackErr) {
      if (fallbackErr instanceof TransformerError) {
        // Surface the more informative error. Prefer fallback's status,
        // but if it's a timeout, that's the strongest signal.
        throw new TransformerError(
          fallbackErr.kind,
          `primary: ${primaryErr.reason} | fallback: ${fallbackErr.reason}`,
        );
      }
      throw fallbackErr;
    }
  }

  const top = scores[0];
  const mood = EMOTION_TO_MOOD[top.label] ?? 'Contemplative';
  const sentiment = EMOTION_TO_SENTIMENT[top.label] ?? 'Neutral/Mixed';

  return {
    topEmotion: top.label,
    mood,
    sentiment,
    scores,
    confidence: top.score,
    model: modelUsed,
  };
}

/**
 * Convenience: same as `analyzeTransformer` but never throws. Returns `null`
 * with an `errorInfo` companion if you want to centralize provenance in the
 * caller. Kept as a thin wrapper so unit tests can exercise either form.
 */
export async function analyzeTransformerSafe(
  lyrics: string,
): Promise<{ result: TransformerResult; error: null } | { result: null; error: TransformerError }> {
  try {
    return { result: await analyzeTransformer(lyrics), error: null };
  } catch (err) {
    if (err instanceof TransformerError) return { result: null, error: err };
    return {
      result: null,
      error: new TransformerError('error', err instanceof Error ? err.message : String(err)),
    };
  }
}
