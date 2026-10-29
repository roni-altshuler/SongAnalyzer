import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assessLanguage, parseLanguageProcessing } from '@/lib/language';
import { prepareLyrics } from '@/lib/analysis/translation';
import { languageContext, languageSupportsComparison } from '@/lib/analysis/language-context';
import { isLyricsResult } from '@/lib/audio/policy';
import { hashLyrics, setAnalysisCache } from '@/lib/analysis/cache';
import { lyricsComparisonProjection } from '@/lib/analysis/comparison';
import { analyzeKeyword } from '@/lib/analysis/keyword';
import type { AnalysisResult } from '@/lib/types';

const spies = vi.hoisted(() => ({ create: vi.fn(async () => ({ id: 'saved-reading' })) }));
vi.mock('@/lib/db/analysis-cache', () => ({ createDurableAnalysisCache: () => null }));
vi.mock('@/lib/db/analyses', () => ({ createAnalysis: spies.create }));
vi.mock('@/lib/db/songs', () => ({ upsertSong: vi.fn() }));
vi.mock('@/lib/fingerprint/match', () => ({ isFingerprintStoreConfigured: () => true }));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock('@/lib/analysis/transformer', async original => {
  const m = await original<typeof import('@/lib/analysis/transformer')>();
  return { ...m, analyzeTransformer: vi.fn(async () => { throw new m.TransformerError('skipped', 'Offline regression'); }) };
});
import { analyzeLyrics } from '@/app/api/analyze/route';
import { POST as translate } from '@/app/api/translate/route';
import { POST as persist } from '@/app/api/analyses/route';
import { analyzeTransformer } from '@/lib/analysis/transformer';
import { __resetRateLimitForTests } from '@/lib/rate-limit';

const russian = 'Любовь и солнце наполняют мое сердце сегодня';
const english = 'Love and sunshine fill my heart today';
const req = (body: unknown) => new NextRequest('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks(); setAnalysisCache(null); __resetRateLimitForTests();
  vi.stubEnv('HUGGINGFACE_API_KEY', ''); vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected provider call'); }));
});
afterEach(() => { setAnalysisCache(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('conservative character hints', () => {
  it.each([
    'Hola mi amor por siempre', 'Je chante avec toi ce soir',
    'Je rêve près du café', 'Grüße für schöne Tage', 'Meu coração canta para você',
    'English café with joy and love', 'I’m singing with you tonight',
    'Cafe\u0301 with hope and love', '你好世界', '漢字', '日本語かな',
    'Любовь love שלום', 'Любовь love', 'שלום love',
    'Любовь ไทย', 'Любовь και', 'かな हिन्दी', 'مرحبا ไทย',
  ])('does not identify or route ambiguous text: %s', async text => {
    expect(assessLanguage(text)).toEqual({ status: 'unverified' });
    expect((await prepareLyrics(text)).languageProcessing).toEqual({ status: 'unverified' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['× ÷ × ÷ ×', '!!! ??? ... — ?', '12345', 'สวัสดีเพลง'])('withholds unsupported or letterless input: %s', text => {
    expect(assessLanguage(text)).toEqual({ status: 'unsupported' });
  });
  it('distinguishes Hebrew without inventing a model mapping', async () => {
    vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-token');
    expect((await prepareLyrics('שלום עולם אני שר היום')).languageProcessing).toEqual({ status: 'unsupported', languageHint: 'Hebrew' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('treats Cyrillic as an unverified hint and reports absent configuration', async () => {
    expect(assessLanguage(russian)).toEqual({ status: 'unverified', languageHint: 'Russian' });
    expect((await prepareLyrics(russian)).languageProcessing).toEqual({ status: 'not_configured', languageHint: 'Russian' });
    expect(languageContext({ status: 'not_configured', languageHint: 'Russian' }).detail).toContain('not validated identification');
  });
  it.each(['Любовь ไทย', 'Любовь και', 'かな हिन्दी', 'مرحبا ไทย'])('never auto-translates a recognized plus unsupported script: %s', async text => {
    vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-token');
    expect((await prepareLyrics(text)).languageProcessing).toEqual({ status: 'unverified' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['«Любовь», — солнце! 123', 'Russian'],
    ['「かな」…！ 123', 'Japanese'],
    ['«مرحبا»، — عالم! 123', 'Arabic'],
  ])('does not mistake punctuation or digits for a second script: %s', (text, languageHint) => {
    expect(assessLanguage(text)).toEqual({ status: 'unverified', languageHint });
  });
});

describe('both translation endpoints report actual outcomes', () => {
  it.each(['[]', '{}', '[{}]', '[null]', '[{"translation_text":""}]', '[{"translation_text":"  "}]', '[{"translation_text":42}]', '[{"error":"loading"}]', 'not-json'])('rejects unusable payload %s', async payload => {
    vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-token');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(payload, { status: 200 })));
    const result = await prepareLyrics(russian);
    expect(result).toMatchObject({ text: russian, translated: false, languageProcessing: { status: 'failed' } });
    const response = await translate(req({ text: russian }));
    expect(await response.json()).toMatchObject({ translatedText: russian, wasTranslated: false, languageProcessing: { status: 'failed' } });
  });
  it.each(['http', 'network', 'unchanged'])('reports provider %s failure without claiming translation', async kind => {
    vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-token');
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (kind === 'network') throw new Error('Controlled offline network failure');
      return new Response(kind === 'unchanged' ? JSON.stringify([{ translation_text: russian }]) : 'error', { status: kind === 'http' ? 503 : 200 });
    }));
    expect((await prepareLyrics(russian)).languageProcessing.status).toBe('failed');
  });
  it.each(['translation_text', 'generated_text'])('reports a real nonempty %s result', async key => {
    vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-token');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ [key]: english }]))));
    expect(await prepareLyrics(russian)).toMatchObject({ text: english, translated: true, originalLanguage: 'Russian', languageProcessing: { status: 'translated', languageHint: 'Russian' } });
    expect(await (await translate(req({ text: russian }))).json()).toMatchObject({ wasTranslated: true, languageProcessing: { status: 'translated', languageHint: 'Russian' } });
  });
});

describe('current request state, cache and persistence', () => {
  it('overlays stale language metadata from an old cache without rerunning engines', async () => {
    const legacy: AnalysisResult = { ...analyzeKeyword(english), translated: true, originalLanguage: 'Russian', languageProcessing: { status: 'failed', languageHint: 'Russian' } };
    setAnalysisCache({ async get(hash) { return hash === hashLyrics(english) ? legacy : null; }, set: vi.fn() });
    const result = await analyzeLyrics(english);
    expect(result).toMatchObject({ translated: false, languageProcessing: { status: 'unverified' } });
    expect(result.originalLanguage).toBeUndefined();
    expect(legacy.languageProcessing?.status).toBe('failed');
    expect(analyzeTransformer).not.toHaveBeenCalled();
  });
  it('skips the English model for unverified input, even when a token exists', async () => {
    vi.stubEnv('HUGGINGFACE_API_KEY', 'offline-token');
    const result = await analyzeLyrics('Je chante avec toi ce soir');
    expect(result.engines?.transformer.status).toBe('skipped');
    expect(analyzeTransformer).not.toHaveBeenCalled();
  });
  it('records English as a submitter choice rather than detected language', async () => {
    expect((await analyzeLyrics(english, true)).languageProcessing).toEqual({ status: 'english_confirmed' });
    expect(analyzeTransformer).toHaveBeenCalledOnce();
  });
  it.each(['unverified', 'unsupported', 'not_configured', 'failed'] as const)('withholds derived comparison for %s even with high default confidence', status => {
    const result = { ...analyzeKeyword('word '.repeat(200)), confidence: 0.95, languageProcessing: { status } };
    expect(lyricsComparisonProjection(result)).toEqual({ point: null, basis: 'unavailable' });
    expect(languageSupportsComparison({ status })).toBe(false);
  });
  it('withholds comparison when older readings have no language records', () => {
    expect(lyricsComparisonProjection(analyzeKeyword(english)).point).toBeNull();
  });
  it('persists valid language metadata through the actual lyrics policy and route', async () => {
    const result = await analyzeLyrics(english);
    expect(isLyricsResult({ ...result })).toBe(true);
    expect((await persist(req({ mode: 'lyrics', result }))).status).toBe(200);
    expect(spies.create).toHaveBeenCalledWith(expect.objectContaining({ result }));
  });
  it.each([{ status: 'validated' }, { status: 'unverified', audio: { bpm: 120 } }, { status: 'translated', languageHint: {} }])('rejects invalid/nested language payload %j', async languageProcessing => {
    const result = { mood: 'Happy', languageProcessing };
    expect(parseLanguageProcessing(languageProcessing)).toBeUndefined(); expect(isLyricsResult(result)).toBe(false);
    expect((await persist(req({ mode: 'lyrics', result }))).status).toBe(403); expect(spies.create).not.toHaveBeenCalled();
  });
  it('keeps the audio boundary closed with valid language metadata', async () => {
    expect((await persist(req({ mode: 'audio', result: { mood: 'Happy', languageProcessing: { status: 'english_confirmed' } } }))).status).toBe(403);
    expect(isLyricsResult({ mood: 'Happy', bpm: 120, languageProcessing: { status: 'english_confirmed' } })).toBe(false);
  });
});
