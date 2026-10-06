// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSongAnalysis, type SongMeta } from '@/app/hooks/useSongAnalysis';
import type { AudioAnalysisResultV2 } from '@/lib/types';

const mocks = vi.hoisted(() => ({ decode: vi.fn(), analyze: vi.fn(), fallback: vi.fn(), fingerprint: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/audio/analyze', () => ({ decodeFileToMono: mocks.decode, analyzePcmV2: mocks.analyze }));
vi.mock('@/lib/audio-analysis', () => ({ analyzeAudioFile: mocks.fallback }));
vi.mock('@/app/workers/client', () => ({ computeFingerprint: mocks.fingerprint }));
vi.mock('@/app/components/ui/Toast', () => ({ toast: { success: mocks.success } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const song = (title: string, previewUrl?: string): SongMeta => ({ title, artist: 'Synthetic artist', previewUrl });
const clip = () => new File(['synthetic'], 'local.wav', { type: 'audio/wav' });
const saved = (id: string) => new Response(JSON.stringify({ status: 'ok', id }));
const preview = () => new Response(new Blob(['synthetic'], { type: 'audio/wav' }));
const analysis = { mood: 'Peaceful', engineVersion: 'v1-fallback' } as AudioAnalysisResultV2;

describe('selected track and audio insight identity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('React', React);
    mocks.decode.mockResolvedValue({ pcm: new Float32Array([1, 2, 3]), sampleRate: 44100 });
    mocks.analyze.mockResolvedValue(analysis);
    mocks.fingerprint.mockResolvedValue([]);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('announces downloading immediately and ignores reversed preview completions', async () => {
    const old = deferred<Response>();
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => url === '/old.wav' ? old.promise : Promise.resolve(url === '/new.wav' ? preview() : saved('new-id')));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(useSongAnalysis);
    let oldRun!: Promise<boolean>;
    act(() => { oldRun = result.current.analyzeSong(song('Old track', '/old.wav')); });
    expect(result.current.loading).toBe(true);
    expect(result.current.stage).toBe('fetching');
    await act(async () => { expect(await result.current.analyzeSong(song('New track', '/new.wav'))).toBe(true); });
    await act(async () => { old.resolve(preview()); expect(await oldRun).toBe(false); });
    expect(result.current.song?.title).toBe('New track');
    expect(result.current.audioSrc).toBe('/new.wav');
    expect(result.current.analysisId).toBe('new-id');
    expect(result.current.loading).toBe(false);
    expect(mocks.decode).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Analyzed New track');
    expect((fetcher.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('invalidates a preview during blob conversion when reset', async () => {
    const blob = deferred<Blob>();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => blob.promise }));
    const { result } = renderHook(useSongAnalysis);
    let run!: Promise<boolean>;
    await act(async () => { run = result.current.analyzeSong(song('Old track', '/old.wav')); });
    act(() => { result.current.reset(); });
    await act(async () => { blob.resolve(new Blob(['synthetic'])); expect(await run).toBe(false); });
    expect(result.current.song).toBeNull();
    expect(result.current.analysis).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mocks.decode).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('clears previous insights, player and Share id for a track without a preview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(saved('old-id')));
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { await result.current.analyzeFile(clip(), song('Old track')); });
    await waitFor(() => expect(result.current.analysisId).toBe('old-id'));
    await act(async () => { expect(await result.current.analyzeSong(song('Unavailable track'))).toBe(false); });
    expect(result.current.song?.title).toBe('Unavailable track');
    expect(result.current.analysis).toBeNull();
    expect(result.current.analysisId).toBeNull();
    expect(result.current.songId).toBeNull();
    expect(result.current.audioSrc).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.stage).toBe('idle');
  });

  it('does not attribute an unrelated local upload to the selected track', async () => {
    const fetcher = vi.fn().mockResolvedValue(saved('upload-id'));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { await result.current.analyzeSong(song('Selected track')); });
    await act(async () => { await result.current.analyzeFile(clip()); });
    expect(result.current.song).toBeNull();
    expect(result.current.fileName).toBe('local.wav');
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.song).toBeUndefined();
  });

  it('does not attach a late persistence id to a newer selected track', async () => {
    const persistence = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(persistence.promise));
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { await result.current.analyzeFile(clip(), song('Old track')); });
    await act(async () => { await result.current.analyzeSong(song('New track')); });
    await act(async () => { persistence.resolve(saved('old-id')); });
    expect(result.current.song?.title).toBe('New track');
    expect(result.current.analysisId).toBeNull();
    expect(result.current.analysis).toBeNull();
  });

  it('reports preview download failure and permits a successful retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(preview()).mockResolvedValueOnce(saved('retry-id')));
    const { result } = renderHook(useSongAnalysis);
    const selected = song('Retry track', '/retry.wav');
    await act(async () => { expect(await result.current.analyzeSong(selected)).toBe(false); });
    expect(result.current.error).toContain('Could not load');
    expect(result.current.loading).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.analyzeSong(selected)).toBe(true); });
    expect(result.current.error).toBe('');
    expect(result.current.analysis).toBe(analysis);
  });

  it('does not announce successful analysis when both audio engines fail', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.decode.mockRejectedValue(new Error('decode failed'));
    mocks.fallback.mockRejectedValue(new Error('invalid audio'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(preview()));
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { expect(await result.current.analyzeSong(song('Broken clip', '/broken.wav'))).toBe(false); });
    expect(result.current.error).toBe('invalid audio');
    expect(result.current.analysis).toBeNull();
    expect(result.current.stage).toBe('idle');
    expect(mocks.success).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('stops a late audio worker result from persisting after another selection', async () => {
    const worker = deferred<AudioAnalysisResultV2>();
    mocks.analyze.mockReturnValue(worker.promise);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(useSongAnalysis);
    let run!: Promise<void>;
    await act(async () => { run = result.current.analyzeFile(clip()); });
    expect(result.current.stage).toBe('analyzing');
    await act(async () => { await result.current.analyzeSong(song('New track')); });
    await act(async () => { worker.resolve(analysis); await run; });
    expect(result.current.analysis).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.fingerprint).not.toHaveBeenCalled();
  });

  it('aborts download on unmount without later analysis or success toast', async () => {
    const download = deferred<Response>();
    const fetcher = vi.fn().mockReturnValue(download.promise);
    vi.stubGlobal('fetch', fetcher);
    const { result, unmount } = renderHook(useSongAnalysis);
    let run!: Promise<boolean>;
    act(() => { run = result.current.analyzeSong(song('Unmounted track', '/clip.wav')); });
    unmount();
    expect((fetcher.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    await act(async () => { download.resolve(preview()); expect(await run).toBe(false); });
    expect(mocks.decode).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
