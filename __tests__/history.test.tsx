// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHistory, getHistory, readHistory, removeFromHistory, saveToHistory } from '@/lib/history';
import HistoryPanel from '@/app/components/HistoryPanel';
import { analyzeKeyword } from '@/lib/analysis/keyword';

const key = 'songanalyzer_history';
const result = analyzeKeyword('Synthetic sunshine and hope, dancing with joy.');
const entry = { id: 'synthetic-old', timestamp: 1700000000000, lyricsPreview: 'Synthetic old preview', result };
const seed = (value: unknown) => localStorage.setItem(key, JSON.stringify(value));
beforeEach(() => { localStorage.clear(); vi.stubGlobal('React', React); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('safe local history', () => {
  it.each(['null', '{}', 'true', '12', '"synthetic"', '', '{broken synthetic bytes'])('retains invalid saved bytes %s without overwriting them', raw => {
    localStorage.setItem(key, raw);
    expect(readHistory()).toEqual({ entries: [], status: 'invalid' });
    expect(getHistory()).toEqual([]);
    expect(saveToHistory('New synthetic lyrics', result)).toBeNull();
    expect(removeFromHistory('synthetic-old')).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it.each([
    null, {}, { ...entry, timestamp: -1 }, { ...entry, timestamp: 9e15 },
    { ...entry, result: { ...result, themes: [null] } },
    { ...entry, result: { ...result, confidence: '0.5' } },
    { ...entry, result: { ...result, mood: {} } },
    { ...entry, result: { ...result, engines: { transformer: {}, keyword: {} } } },
    { ...entry, result: { ...result, engines: { transformer: { status: { toString: null } }, keyword: { status: 'ok' } } } },
    { ...entry, result: { ...result, engines: { transformer: { status: 'ok', scores: [{ label: 'joy', score: '0.5' }] }, keyword: { status: 'ok' } } } },
    { ...entry, result: { ...result, moodColor: { from: {}, to: 'pink', glow: 'pink' } } },
  ])('keeps safe entries restorable alongside malformed data %#', invalid => {
    seed([entry, invalid]); const raw = localStorage.getItem(key);
    expect(readHistory()).toEqual({ entries: [entry], status: 'invalid' });
    expect(saveToHistory('New synthetic lyrics', result)).toBeNull();
    expect(removeFromHistory(entry.id)).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it('does not rewrite duplicate or oversized history during reads or saves', () => {
    for (const data of [[entry, entry], Array.from({ length: 21 }, (_, i) => ({ ...entry, id: `synthetic-${i}` }))]) {
      seed(data); const raw = localStorage.getItem(key);
      expect(readHistory().status).toBe('invalid');
      expect(getHistory().length).toBeLessThanOrEqual(20);
      expect(saveToHistory('New synthetic lyrics', result)).toBeNull();
      expect(localStorage.getItem(key)).toBe(raw);
    }
  });
  it('round-trips legacy results and additive language/engine provenance without dropping fields', () => {
    const withProvenance = { ...entry, id: 'synthetic-provenance', result: { ...result,
      originalLanguage: 'Spanish', translated: true,
      languageProcessing: { version: 1, status: 'translated', source: 'script_hint', detectedLanguage: 'Spanish' },
      engines: { transformer: { status: 'ok', model: 'synthetic-model', scores: [{ label: 'joy', score: 0.8 }] }, keyword: { status: 'ok', scores: { positive: 2, negative: 0, neutral: 1 } } },
      moodColor: { from: '#abc', to: '#123456', glow: 'pink' },
    } };
    seed([entry, withProvenance]);
    expect(readHistory().status).toBe('ready');
    expect(saveToHistory('Synthetic new text', result)).not.toBeNull();
    expect(getHistory().slice(1)).toEqual([entry, withProvenance]);
    expect(removeFromHistory(entry.id)).toBe(true);
    expect(getHistory()).toContainEqual(withProvenance);
  });
  it('retains the existing 20-entry and 120-character preview limits', () => {
    seed(Array.from({ length: 20 }, (_, i) => ({ ...entry, id: `synthetic-${i}` })));
    const saved = saveToHistory('x'.repeat(200), result);
    expect(saved?.lyricsPreview).toBe('x'.repeat(120) + '…');
    expect(Object.keys(saved!)).toEqual(['id', 'timestamp', 'lyricsPreview', 'result']);
    expect(getHistory()).toHaveLength(20);
    expect(getHistory().at(-1)?.id).toBe('synthetic-18');
  });
  it('does not evict or retry after quota failure and reports failed removals/clears', () => {
    seed([entry]); const raw = localStorage.getItem(key);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Synthetic quota', 'QuotaExceededError'); });
    expect(saveToHistory('Synthetic lyrics', result)).toBeNull();
    expect(set).toHaveBeenCalledOnce();
    expect(removeFromHistory(entry.id)).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Synthetic blocked', 'SecurityError'); });
    expect(clearHistory()).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it('handles a blocked storage getter and a server render without throwing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Synthetic blocked', 'SecurityError'); });
    expect(readHistory()).toEqual({ entries: [], status: 'unavailable' });
    expect(saveToHistory('Synthetic lyrics', result)).toBeNull();
    expect(removeFromHistory(entry.id)).toBe(false); expect(clearHistory()).toBe(false);
    vi.restoreAllMocks(); vi.stubGlobal('window', undefined);
    expect(getHistory()).toEqual([]); expect(saveToHistory('Synthetic lyrics', result)).toBeNull();
    expect(clearHistory()).toBe(false);
  });
  it('rejects an invalid new result without modifying existing data', () => {
    seed([entry]); const raw = localStorage.getItem(key);
    expect(saveToHistory('Synthetic lyrics', { ...result, confidence: NaN })).toBeNull();
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it('only clears the history key after an explicit successful clear', () => {
    localStorage.setItem(key, '{broken synthetic bytes'); localStorage.setItem('theme', 'dark');
    expect(clearHistory()).toBe(true); expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});

describe('history availability and action feedback', () => {
  it('renders empty and malformed states without a crash or automatic cleanup', () => {
    localStorage.setItem(key, 'null'); render(<HistoryPanel onRestore={() => {}} refreshKey={0} />);
    expect(screen.getByRole('status').textContent).toContain('Saved data is unchanged');
    expect(localStorage.getItem(key)).toBe('null');
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(localStorage.getItem(key)).toBeNull();
    expect(screen.getByRole('button', { name: 'History · 0' })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole('button', { name: 'History · 0' }));
    expect(screen.getByText('No saved analyses in this browser yet.')).toBeTruthy();
  });
  it('keeps entries visible and announces failed remove and clear actions', () => {
    seed([entry]); render(<HistoryPanel onRestore={() => {}} refreshKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Synthetic quota'); });
    fireEvent.click(screen.getByRole('button', { name: 'Remove from history' }));
    expect(screen.getByRole('alert').textContent).toContain('Could not remove');
    expect(screen.getByText('Synthetic old preview')).toBeTruthy();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Synthetic blocked'); });
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('alert').textContent).toContain('Could not clear');
    expect(screen.getByText('Synthetic old preview')).toBeTruthy();
  });
  it('lets the user retry an unavailable read without treating it as an empty history', () => {
    seed([entry]); const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Synthetic blocked'); });
    render(<HistoryPanel onRestore={() => {}} refreshKey={0} saveFailed />);
    expect(screen.getByRole('status').textContent).toContain('Your analysis is ready');
    expect(screen.getByRole('status').textContent).toContain('Local history is unavailable');
    get.mockRestore();
    const retry = screen.getByRole('button', { name: 'Retry local history' }); retry.focus();
    fireEvent.click(retry);
    expect(screen.getByRole('button', { name: 'History · 1' })).toBe(document.activeElement);
  });
  it('restores only safe entries and disables removal while malformed bytes remain', () => {
    seed([entry, null]); const restore = vi.fn(); render(<HistoryPanel onRestore={restore} refreshKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    fireEvent.click(screen.getByRole('button', { name: /Synthetic old preview/ }));
    expect(restore).toHaveBeenCalledWith(entry);
    expect((screen.getByRole('button', { name: 'Remove from history' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
