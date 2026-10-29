import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Keep this route-level regression suite entirely offline and its cache isolated.
vi.mock('@/lib/db/analysis-cache', () => ({ createDurableAnalysisCache: () => null }));
vi.mock('@/lib/analysis/transformer', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/analysis/transformer')>();
  return {
    ...original,
    analyzeTransformer: vi.fn(async () => {
      throw new original.TransformerError('skipped', 'Offline provenance test');
    }),
  };
});

import { POST } from '@/app/api/analyze/route';
import { getAnalysisCache, analysisCacheKey, setAnalysisCache } from '@/lib/analysis/cache';
import { analyzeKeyword } from '@/lib/analysis/keyword';
import { blendResults } from '@/lib/analysis/blend';
import { analyzeTransformer } from '@/lib/analysis/transformer';
import { __resetRateLimitForTests } from '@/lib/rate-limit';
import type { AnalysisResult } from '@/lib/types';

const english = 'Love and sunshine fill my heart today';
const spanish = 'El niño canta un sueño con amor';
const russian = 'Любовь и солнце наполняют мое сердце сегодня';
const previousCache = getAnalysisCache();
let entries: Map<string, AnalysisResult>;
let writes: Mock<(hash: string, result: AnalysisResult) => Promise<void>>;
let translation: Mock<(url: string | URL | Request) => Promise<Response>>;

async function request(lyrics: string): Promise<AnalysisResult> {
  const response = await POST(new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lyrics, englishConfirmed: !/[^\x00-\x7f]/.test(lyrics) }),
  }));
  expect(response.status).toBe(200);
  return response.json();
}

function analysisOnly(result: AnalysisResult) {
  const { originalLanguage: _language, translated: _translated, languageProcessing: _processing, ...analysis } = result;
  return analysis;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitForTests();
  entries = new Map();
  writes = vi.fn(async (hash: string, result: AnalysisResult) => { entries.set(hash, result); });
  setAnalysisCache({ async get(hash) { return entries.get(hash) ?? null; }, set: writes });
  vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-test-token');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  translation = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toMatch(/^https:\/\/api-inference\.huggingface\.co\/models\/Helsinki-NLP\/opus-mt-(es|ru)-en$/);
    return new Response(JSON.stringify([{ translation_text: english }]), { status: 200 });
  });
  vi.stubGlobal('fetch', translation);
});

afterEach(() => {
  setAnalysisCache(previousCache);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('current-request translation provenance on cached analysis', () => {
  it.each([
    ['translated then English', spanish, english],
    ['English then translated', english, spanish],
  ])('preserves engine reuse for %s', async (_order, first, second) => {
    const a = await request(first);
    const b = await request(second);
    const translated = first === spanish ? a : b;
    const untranslated = first === english ? a : b;
    expect(translated).toMatchObject({ translated: true, originalLanguage: 'Spanish' });
    expect(untranslated.translated).toBe(false);
    expect(untranslated.originalLanguage).toBeUndefined();
    expect(analysisOnly(a)).toEqual(analysisOnly(b));
    expect(analyzeTransformer).toHaveBeenCalledOnce();
    expect(translation).toHaveBeenCalledOnce();
    expect(writes).toHaveBeenCalledOnce();
    expect(entries.size).toBe(1);
  });

  it.each([[spanish, russian, 'Spanish', 'Russian'], [russian, spanish, 'Russian', 'Spanish']])(
    'uses each source language when %s and %s translate to the same text',
    async (first, second, firstLanguage, secondLanguage) => {
      const a = await request(first);
      const b = await request(second);
      expect(a).toMatchObject({ translated: true, originalLanguage: firstLanguage });
      expect(b).toMatchObject({ translated: true, originalLanguage: secondLanguage });
      expect(analysisOnly(a)).toEqual(analysisOnly(b));
      // Returning the second provenance must not mutate the stored first result.
      expect(entries.get(analysisCacheKey(english, 'english-model'))?.originalLanguage).toBe(firstLanguage);
      expect(analyzeTransformer).toHaveBeenCalledOnce();
      expect(translation).toHaveBeenCalledTimes(2);
      expect(writes).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ['translated first', spanish, '  LOVE\n and  SUNSHINE fill my HEART today  '],
    ['normalized English first', '  LOVE\n and  SUNSHINE fill my HEART today  ', spanish],
  ])('keeps case and whitespace normalization with %s', async (_order, first, second) => {
    const a = await request(first);
    const b = await request(second);
    const untranslated = first === spanish ? b : a;
    expect(untranslated.translated).toBe(false);
    expect(untranslated.originalLanguage).toBeUndefined();
    expect(analysisOnly(a)).toEqual(analysisOnly(b));
    expect(analyzeTransformer).toHaveBeenCalledOnce();
    expect(entries.size).toBe(1);
  });

  it.each([
    { originalLanguage: 'Spanish', translated: true },
    { originalLanguage: 'Spanish', translated: false },
    { originalLanguage: 'Spanish' },
    { translated: true },
    {},
  ])('ignores legacy cached provenance %j for English input', async metadata => {
    const legacy = { ...blendResults({ keyword: analyzeKeyword(english), transformer: null, transformerStatus: 'skipped' }), ...metadata };
    entries.set(analysisCacheKey(english, 'english-model'), legacy);
    const result = await request(english);
    expect(result.translated).toBe(false);
    expect(result.originalLanguage).toBeUndefined();
    expect(analysisOnly(result)).toEqual(analysisOnly(legacy));
    expect(entries.get(analysisCacheKey(english, 'english-model'))).toBe(legacy);
    expect(analyzeTransformer).not.toHaveBeenCalled();
    expect(translation).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it('uses current translated provenance over legacy metadata', async () => {
    entries.set(analysisCacheKey(english, 'english-model'), { ...analyzeKeyword(english), originalLanguage: 'Russian', translated: false });
    expect(await request(spanish)).toMatchObject({ originalLanguage: 'Spanish', translated: true });
    expect(analyzeTransformer).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['missing token', 'failed translation'])('does not inherit a translation after %s', async scenario => {
    const legacy = { ...analyzeKeyword(spanish), originalLanguage: 'Russian', translated: true };
    entries.set(analysisCacheKey(spanish, 'provisional'), legacy);
    if (scenario === 'missing token') vi.stubEnv('HUGGINGFACE_API_KEY', '');
    else {
      translation.mockResolvedValue(new Response('Controlled translation failure', { status: 503 }));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    }
    const result = await request(spanish);
    expect(result.translated).toBe(false);
    expect(result.originalLanguage).toBeUndefined();
    expect(analysisOnly(result)).toEqual(analysisOnly(legacy));
    expect(analyzeTransformer).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });
});
