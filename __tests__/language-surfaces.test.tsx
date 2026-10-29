// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LanguageNotice from '@/app/components/LanguageNotice';
import LyricsInput from '@/app/components/LyricsInput';
import { formatLyricsExport } from '@/lib/analysis/export';
import { getHistory, saveToHistory } from '@/lib/history';
import { analyzeKeyword } from '@/lib/analysis/keyword';
import type { LanguageProcessing } from '@/lib/language';

const row = vi.hoisted(() => ({ result: {} as Record<string, unknown> }));
vi.mock('@/lib/db/analyses', () => ({ getAnalysisBySlug: async () => ({ id: 'reading', is_public: true, song_id: null, result: row.result }) }));
vi.mock('@/lib/db/songs', () => ({ getSongById: vi.fn() }));
vi.mock('@/lib/db/shares', () => ({ incrementViewCount: vi.fn() }));
import SharePage, { generateMetadata } from '@/app/share/[slug]/page';
import { extractOgPayload } from '@/app/share/[slug]/og-data';
import type { AnalysisRow } from '@/lib/supabase/database.types';

const states: LanguageProcessing[] = [
  { status: 'english_confirmed' }, { status: 'unverified' },
  { status: 'translated', languageHint: 'Russian' }, { status: 'not_configured', languageHint: 'Russian' },
  { status: 'unsupported', languageHint: 'Hebrew' }, { status: 'failed', languageHint: 'Russian' },
];
beforeEach(() => { vi.stubGlobal('React', React); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(states)('retains %j in local history and copied text', processing => {
  const result = { ...analyzeKeyword('Love and sunshine fill my heart today'), languageProcessing: processing };
  saveToHistory('Synthetic original passage', result);
  expect(getHistory()[0].result.languageProcessing).toEqual(processing);
  const text = formatLyricsExport(result);
  expect(text).toContain('Language checks are unverified');
  expect(text).toContain('not reliable comprehension');
  render(<LanguageNotice processing={processing} />);
  const notice = screen.getByRole('region', { name: 'Language context' });
  expect(text).toContain(notice.querySelector('h3')!.textContent);
});

it.each(states)('retains %j through actual shared-result normalization and rendering', async processing => {
  row.result = { ...analyzeKeyword('Love and sunshine fill my heart today'), languageProcessing: processing };
  const markup = renderToStaticMarkup(await SharePage({ params: Promise.resolve({ slug: 'retained-language' }) }));
  expect(markup).toContain('Language context');
  expect(markup).toContain('not reliable comprehension');
  if (processing.status === 'failed') expect(markup).toContain('Translation failed');
  if (processing.status === 'unsupported') expect(markup).toContain('Translation unsupported');
  if (processing.status === 'translated') expect(markup).toContain('Machine translation used');
});

it('labels old and malformed shared records unverified without inventing provenance', async () => {
  for (const languageProcessing of [undefined, { status: 'validated' }, { status: 'translated', languageHint: { audio: true } }]) {
    row.result = { ...analyzeKeyword('Love and sunshine fill my heart today'), languageProcessing };
    const markup = renderToStaticMarkup(await SharePage({ params: Promise.resolve({ slug: 'legacy' }) }));
    expect(markup).toContain('Language unverified');
  }
});

it.each([undefined, { status: 'unverified' }, { status: 'unsupported', languageHint: 'Hebrew' }, { status: 'failed' }, { status: 'not_configured' }])('withholds unresolved social mood claims for %j', async languageProcessing => {
  row.result = { ...analyzeKeyword('Love and sunshine fill my heart today'), mood: 'Definitive leaked mood', languageProcessing };
  const payload = extractOgPayload({ result: row.result as unknown as AnalysisRow['result'] }, null);
  expect(payload.showEstimates).toBe(false);
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'language-preview' }) });
  const text = JSON.stringify(metadata);
  expect(text).not.toContain('Definitive leaked mood');
  expect(text).toContain('Mood preview withheld');
  expect(text).toContain('Provisional reading');
});

it.each([{ status: 'english_confirmed' }, { status: 'translated', languageHint: 'Russian' }])('qualifies eligible social readings as estimates for %j', async languageProcessing => {
  row.result = { ...analyzeKeyword('Love and sunshine fill my heart today'), languageProcessing };
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'estimate-preview' }) });
  expect(JSON.stringify(metadata)).toContain('Estimated Romantic');
  expect(JSON.stringify(metadata)).toContain('comprehension are unverified');
});

it('makes English selection explicit, labeled and keyboard accessible', () => {
  const onChoice = vi.fn();
  render(<LyricsInput lyrics="Synthetic original text" onLyricsChange={vi.fn()} onAnalyze={vi.fn()} loading={false} error="" englishConfirmed={false} onEnglishConfirmedChange={onChoice} />);
  const checkbox = screen.getByRole('checkbox', { name: 'I’m providing English text' });
  expect(checkbox.getAttribute('aria-describedby')).toBe('lyrics-language-help');
  fireEvent.click(checkbox); expect(onChoice).toHaveBeenCalledWith(true);
});
