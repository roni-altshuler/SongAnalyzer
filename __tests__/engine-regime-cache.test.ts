import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAnalysisCache, hashLyrics, setAnalysisCache } from '@/lib/analysis/cache';
import { analyzeKeyword } from '@/lib/analysis/keyword';
import { blendResults } from '@/lib/analysis/blend';
import type { AnalysisResult } from '@/lib/types';
vi.mock('@/lib/db/analysis-cache', () => ({ createDurableAnalysisCache: () => null }));
vi.mock('@/lib/analysis/transformer', async original => {
  const m = await original<typeof import('@/lib/analysis/transformer')>();
  return { ...m, analyzeTransformer: vi.fn(async () => {
    if (!process.env.HUGGINGFACE_API_KEY) throw new m.TransformerError('skipped', 'No token in offline fixture');
    return { topEmotion: 'joy', mood: 'Euphoric', sentiment: 'Positive', scores: [{ label: 'joy', score: 1 }], confidence: 1, model: 'offline-regime-fixture' };
  }) };
});
import { analyzeLyrics } from '@/app/api/analyze/route';
import { analyzeTransformer } from '@/lib/analysis/transformer';

const text = 'Plain words across the page today';
const originalCache = getAnalysisCache();
let cache: Map<string, AnalysisResult>;
const gets: string[] = [];

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-fixture');
  cache = new Map(); gets.length = 0;
  setAnalysisCache({ async get(key) { gets.push(key); return cache.get(key) ?? null; }, async set(key, result) { cache.set(key, result); } });
});
afterEach(() => { setAnalysisCache(originalCache); vi.unstubAllEnvs(); });

it.each([true, false])('separates English-model and provisional caches, English first: %s', async englishFirst => {
  const first = await analyzeLyrics(text, englishFirst);
  const second = await analyzeLyrics('  PLAIN  words across\nthe page TODAY ', !englishFirst);
  const english = englishFirst ? first : second;
  const provisional = englishFirst ? second : first;
  expect(english.mood).toBe('Euphoric');
  expect(english.engines?.transformer).toMatchObject({ status: 'ok', model: 'offline-regime-fixture', scores: [{ label: 'joy', score: 1 }] });
  expect(provisional.mood).toBe('Contemplative');
  expect(provisional.engines?.transformer.status).toBe('skipped');
  expect(provisional.engines?.transformer.scores).toBeUndefined();
  expect(provisional.engines?.transformer.model).toBeUndefined();
  expect(analyzeTransformer).toHaveBeenCalledOnce();
  expect(gets[0]).not.toBe(gets[1]);
  expect(cache.size).toBe(2);
  expect(await analyzeLyrics(text, true)).toEqual(english);
  expect(await analyzeLyrics(text, false)).toEqual(provisional);
  expect(analyzeTransformer).toHaveBeenCalledOnce();
  expect(gets[2]).toBe(gets[englishFirst ? 0 : 1]);
  expect(gets[3]).toBe(gets[englishFirst ? 1 : 0]);
});

it.each([true, false])('does not use an unversioned transformer cache for English choice %s', async confirmed => {
  const legacy: AnalysisResult = { ...blendResults({ keyword: analyzeKeyword(text), transformer: null, transformerStatus: 'skipped' }), mood: 'Legacy transformer mood', engines: { keyword: { status: 'ok' }, transformer: { status: 'ok', model: 'old-model', scores: [{ label: 'anger', score: 1 }] } } };
  cache.set(hashLyrics(text), legacy);
  const result = await analyzeLyrics(text, confirmed);
  expect(result.mood).toBe(confirmed ? 'Euphoric' : 'Contemplative');
  expect(result.engines?.transformer.model).toBe(confirmed ? 'offline-regime-fixture' : undefined);
  expect(gets[0]).not.toBe(hashLyrics(text));
  expect(cache.get(hashLyrics(text))).toBe(legacy);
  expect(analyzeTransformer).toHaveBeenCalledTimes(confirmed ? 1 : 0);
});

it('does not let an unversioned keyword cache suppress an eligible model', async () => {
  cache.set(hashLyrics(text), blendResults({ keyword: analyzeKeyword(text), transformer: null, transformerStatus: 'skipped' }));
  expect((await analyzeLyrics(text, true)).engines?.transformer.status).toBe('ok');
  expect(analyzeTransformer).toHaveBeenCalledOnce();
});

it('does not let a missing-token cache suppress a subsequently configured model', async () => {
  vi.stubEnv('HUGGINGFACE_API_KEY', '');
  expect((await analyzeLyrics(text, true)).engines?.transformer.status).toBe('skipped');
  vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-fixture');
  expect((await analyzeLyrics(text, true)).engines?.transformer.status).toBe('ok');
  expect(gets[0]).not.toBe(gets[1]);
  expect(analyzeTransformer).toHaveBeenCalledTimes(2);
});
