/**
 * POST /api/analyze — hybrid lyric analysis endpoint (v2).
 *
 * Engine blend (in order of precedence on each field):
 *
 *   1. Translation (best-effort, unchanged from v1). If the lyrics aren't
 *      English and `HUGGINGFACE_API_KEY` is set, route through the existing
 *      Helsinki-NLP model first; downstream engines run on the English text.
 *
 *   2. SHA-256 cache lookup. Lyrics are normalized (lowercase + collapsed
 *      whitespace) and hashed; if a cached result is present we short-circuit.
 *      With Supabase admin credentials the durable two-tier store from
 *      `lib/db/analysis-cache.ts` is wired in at module load; otherwise the
 *      in-memory LRU from `lib/analysis/cache.ts` stands alone.
 *
 *   3. Keyword engine (`lib/analysis/keyword.ts`). Synchronous, deterministic,
 *      always succeeds. This is the v1 logic preserved verbatim.
 *
 *   4. Transformer engine (`lib/analysis/transformer.ts`). Best-effort,
 *      server-only. Skipped entirely without `HUGGINGFACE_API_KEY`. Tries
 *      `j-hartmann/emotion-english-distilroberta-base` first, retries once on
 *      503 with `bhadresh-savani/distilbert-base-uncased-emotion`. Hard 8s
 *      `AbortSignal.timeout` covers both attempts combined.
 *
 *   5. Blend (`lib/analysis/blend.ts`). When the transformer succeeds, its
 *      top emotion wins `mood`/`sentiment`; keyword still drives
 *      `themes`/`vibe`/`energy`; confidence is a weighted average. When the
 *      transformer is null, the keyword result is returned with
 *      `engines.transformer.status` set to `skipped`/`unavailable`/`timeout`.
 *
 *   6. Mood color (`lib/analysis/palette.ts`). Maps the blended mood to a
 *      hex gradient + glow color for the mood-theme provider.
 *
 * The response extends the v1 contract additively — existing client code
 * keeps reading `mood`/`vibe`/`energy`/`sentiment`/`themes`/... at the top
 * level. New optional fields: `engines`, `moodColor`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage, LANGUAGE_CODE_MAP } from '@/lib/language';
import { AnalysisResult } from '@/lib/types';
import { analyzeKeyword } from '@/lib/analysis/keyword';
import { analyzeTransformer, TransformerError } from '@/lib/analysis/transformer';
import { blendResults } from '@/lib/analysis/blend';
import { moodToColor } from '@/lib/analysis/palette';
import {
  getCachedAnalysis,
  hashLyrics,
  setAnalysisCache,
  setCachedAnalysis,
} from '@/lib/analysis/cache';
import type { TransformerResult } from '@/lib/analysis/types';
import { createDurableAnalysisCache } from '@/lib/db/analysis-cache';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Wire the durable Supabase-backed cache when admin credentials exist.
// Falls back to the default in-memory LRU otherwise.
const durableCache = createDurableAnalysisCache();
if (durableCache) setAnalysisCache(durableCache);

/**
 * Translate non-English lyrics to English using HF Helsinki-NLP, if a token is
 * available. Falls back to the original text on any failure — this is purely
 * best-effort and never blocks downstream analysis.
 */
async function maybeTranslate(lyrics: string): Promise<{
  text: string;
  originalLanguage: string;
  translated: boolean;
}> {
  const originalLanguage = detectLanguage(lyrics);
  if (originalLanguage === 'English') {
    return { text: lyrics, originalLanguage, translated: false };
  }

  const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
  if (!HF_TOKEN) return { text: lyrics, originalLanguage, translated: false };

  const langCode = LANGUAGE_CODE_MAP[originalLanguage];
  if (!langCode) return { text: lyrics, originalLanguage, translated: false };

  try {
    const modelName = `Helsinki-NLP/opus-mt-${langCode}-en`;
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelName}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        body: JSON.stringify({ inputs: lyrics }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Translation API error:', errorText);
      return { text: lyrics, originalLanguage, translated: false };
    }
    const result = await response.json();
    const translatedText = result[0]?.translation_text || result[0]?.generated_text;
    if (translatedText) {
      return { text: translatedText, originalLanguage, translated: true };
    }
  } catch (err) {
    console.error('Translation error:', err);
  }
  return { text: lyrics, originalLanguage, translated: false };
}

/**
 * Run the hybrid analysis pipeline. Exported for tests / future internal use.
 */
export async function analyzeLyrics(lyrics: string): Promise<AnalysisResult> {
  const { text, originalLanguage, translated } = await maybeTranslate(lyrics);

  // Cache key uses the (possibly translated) English text — same lyrics in
  // different surface forms still hit the cache.
  const hash = hashLyrics(text);
  const cached = await getCachedAnalysis(hash);
  if (cached) {
    return {
      ...cached,
      originalLanguage: translated ? originalLanguage : cached.originalLanguage,
      translated: translated || cached.translated,
    };
  }

  const keyword = analyzeKeyword(text);

  let transformer: TransformerResult | null = null;
  let transformerStatus: 'ok' | 'skipped' | 'unavailable' | 'timeout' | 'error' = 'ok';
  let transformerReason: string | undefined;
  try {
    transformer = await analyzeTransformer(text);
  } catch (err) {
    if (err instanceof TransformerError) {
      transformerStatus = err.kind;
      transformerReason = err.reason;
    } else {
      transformerStatus = 'error';
      transformerReason = err instanceof Error ? err.message : String(err);
    }
  }

  const blended = blendResults({
    keyword,
    transformer,
    transformerStatus: transformer ? 'ok' : transformerStatus,
    transformerReason,
  });

  const result: AnalysisResult = {
    ...blended,
    originalLanguage: translated ? originalLanguage : undefined,
    translated,
    moodColor: moodToColor(blended.mood),
  };

  // Fire-and-forget cache write; failures must not break the response.
  void setCachedAnalysis(hash, result).catch((err) => {
    console.error('Analysis cache write failed:', err);
  });

  return result;
}

export async function POST(request: NextRequest) {
  const limit = await rateLimit('analyze', clientIpFrom(request));
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached — please wait a moment and try again.' },
      { status: 429 },
    );
  }

  try {
    const { lyrics } = await request.json();

    if (!lyrics || typeof lyrics !== 'string') {
      return NextResponse.json(
        { error: 'Lyrics are required' },
        { status: 400 },
      );
    }

    if (lyrics.trim().split(/\s+/).filter(Boolean).length < 5) {
      return NextResponse.json(
        { error: 'Please provide at least 5 words for analysis' },
        { status: 400 },
      );
    }

    const analysis = await analyzeLyrics(lyrics);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze lyrics' },
      { status: 500 },
    );
  }
}
