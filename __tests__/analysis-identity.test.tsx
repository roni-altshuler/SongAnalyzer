// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyzePage from '@/app/analyze/page';

const mocks = vi.hoisted(() => ({ reset: vi.fn(), save: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/history', () => ({ saveToHistory: mocks.save }));
vi.mock('@/app/hooks/useSongAnalysis', () => ({
  useSongAnalysis: () => ({ song: null, analysis: null, reset: mocks.reset }),
}));
vi.mock('@/app/components/LyricsInput', () => ({
  default: (p: { lyrics: string; onLyricsChange: (v: string) => void; onAnalyze: () => void; error?: string }) => (
    <div><input aria-label="Lyrics" value={p.lyrics} onChange={(e) => p.onLyricsChange(e.target.value)} />
      <button onClick={p.onAnalyze}>Analyze</button><span>{p.error}</span></div>
  ),
}));
vi.mock('@/app/components/AnalysisResults', () => ({
  default: (p: { analysis: { mood: string }; analysisId?: string }) => (
    <div data-testid="result" data-share-id={p.analysisId ?? ''}>{p.analysis.mood}</div>
  ),
}));
vi.mock('@/app/components/HistoryPanel', () => ({
  default: (p: { onRestore: (entry: unknown) => void }) => (
    <button onClick={() => p.onRestore({ id: 'local-history-id', result: { mood: 'History B' } })}>Restore B</button>
  ),
}));
vi.mock('@/app/components/AnalysisSkeleton', () => ({ default: () => <span>Loading</span> }));
vi.mock('@/app/components/EmptyState', () => ({ default: () => null }));
vi.mock('@/app/components/SampleLyricPicker', () => ({ default: () => null }));
vi.mock('@/app/components/SongSearch', () => ({ default: () => null }));
vi.mock('@/app/components/ModeTabs', () => ({ default: () => null }));
vi.mock('@/app/components/AudioUpload', () => ({ default: () => null }));
vi.mock('@/app/components/AudioAnalysisResults', () => ({ default: () => null }));
vi.mock('@/app/components/CombinedView', () => ({ default: () => null }));
vi.mock('@/app/components/SimilarSongs', () => ({ default: () => null }));
vi.mock('@/app/components/WaveformPlayer', () => ({ default: () => null }));
vi.mock('@/app/components/ui/Toast', () => ({ toast: { success: vi.fn() } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const resultResponse = (mood: string) => new Response(JSON.stringify({ mood, themes: [] }));
const savedResponse = (id: string) => new Response(JSON.stringify({ status: 'ok', id }));
function analyze(lyrics: string) {
  fireEvent.change(screen.getByLabelText('Lyrics'), { target: { value: lyrics } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
}

describe('lyrics result and Share identity', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('React', React); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('restores history without keeping the previous result or pending persistence id', async () => {
    const saved = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(resultResponse('A')).mockReturnValueOnce(saved.promise));
    render(<AnalyzePage />);
    analyze('Lyrics A');
    await screen.findByText('A');
    fireEvent.click(screen.getByText('Restore B'));
    expect(screen.getByTestId('result').textContent).toBe('History B');
    expect((screen.getByLabelText('Lyrics') as HTMLInputElement).value).toBe('');
    expect(mocks.reset).toHaveBeenCalledOnce();
    await act(async () => { saved.resolve(savedResponse('server-A')); });
    expect(screen.getByTestId('result').getAttribute('data-share-id')).toBe('');
  });

  it('clears an already attached share id when restoring history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(resultResponse('A')).mockResolvedValueOnce(savedResponse('server-A')));
    render(<AnalyzePage />);
    analyze('Lyrics A');
    await waitFor(() => expect(screen.getByTestId('result').getAttribute('data-share-id')).toBe('server-A'));
    fireEvent.click(screen.getByText('Restore B'));
    expect(screen.getByTestId('result').getAttribute('data-share-id')).toBe('');
  });

  it('ignores an analysis response arriving after history restore', async () => {
    const analysis = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(analysis.promise);
    vi.stubGlobal('fetch', fetcher);
    render(<AnalyzePage />);
    analyze('Lyrics A');
    fireEvent.click(screen.getByText('Restore B'));
    await act(async () => { analysis.resolve(resultResponse('A')); });
    expect(screen.getByTestId('result').textContent).toBe('History B');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps the newer result id when older persistence finishes last', async () => {
    const savedA = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(resultResponse('A')).mockReturnValueOnce(savedA.promise)
      .mockResolvedValueOnce(resultResponse('B')).mockResolvedValueOnce(savedResponse('server-B')));
    render(<AnalyzePage />);
    analyze('Lyrics A');
    await screen.findByText('A');
    analyze('Lyrics B');
    await waitFor(() => expect(screen.getByTestId('result').getAttribute('data-share-id')).toBe('server-B'));
    await act(async () => { savedA.resolve(savedResponse('server-A')); });
    expect(screen.getByTestId('result').textContent).toBe('B');
    expect(screen.getByTestId('result').getAttribute('data-share-id')).toBe('server-B');
  });

  it('ignores a pending analysis when the lyrics are edited', async () => {
    const analysis = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(analysis.promise));
    render(<AnalyzePage />);
    analyze('Lyrics A');
    fireEvent.change(screen.getByLabelText('Lyrics'), { target: { value: 'Edited lyrics' } });
    await act(async () => { analysis.resolve(resultResponse('A')); });
    expect(screen.queryByTestId('result')).toBeNull();
    expect(screen.queryByText('Loading')).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
