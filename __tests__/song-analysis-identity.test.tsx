// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
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
const clip = () => new File(['synthetic'], 'local.wav', { type: 'audio/wav' });
const analysis = { mood: 'Peaceful', engineVersion: 'v1-fallback' } as AudioAnalysisResultV2;
const spotify: SongMeta = { title: 'Selected', artist: 'Artist', previewUrl: 'https://p.scdn.co/preview.mp3', spotifyId: 'track', metadataSource: 'spotify' };

describe('audio permission and selected-track identity', () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubGlobal('React', React); vi.stubGlobal('fetch', vi.fn());
    mocks.decode.mockResolvedValue({ pcm: new Float32Array([1, 2, 3]), sampleRate: 44100 });
    mocks.analyze.mockResolvedValue(analysis);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each([
    spotify,
    { title: 'Similar pick lost provider IDs', artist: 'Artist', previewUrl: spotify.previewUrl },
    { title: 'Unknown provider', artist: 'Artist', previewUrl: 'https://unreviewed.example/audio.wav' },
    { title: 'Spoofed permission', artist: 'Artist', previewUrl: '/fixtures/approved.wav', source: 'upload', permission: 'granted' },
  ])('blocks remote preview $title, including repeated direct invocation', async (selected) => {
    const { result } = renderHook(useSongAnalysis);
    await act(async () => {
      expect(await result.current.analyzeSong(selected)).toBe(false);
      expect(await result.current.analyzeSong(selected)).toBe(false);
    });
    expect(result.current.song?.title).toBe(selected.title);
    expect(result.current.song?.previewUrl).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.analysis).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.decode).not.toHaveBeenCalled();
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(mocks.fallback).not.toHaveBeenCalled();
    expect(mocks.fingerprint).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('measures a local fixture without catalog fingerprints, network, persistence or unrelated attribution', async () => {
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { await result.current.analyzeSong(spotify); await result.current.analyzeFile(clip()); });
    expect(result.current.song).toBeNull();
    expect(result.current.analysis).toBe(analysis);
    expect(result.current.fileName).toBe('local.wav');
    expect(result.current.audioSrc).toBeInstanceOf(File);
    expect(result.current.analysisId).toBeNull();
    expect(result.current.songId).toBeNull();
    expect(mocks.analyze).toHaveBeenCalledOnce();
    expect(mocks.fingerprint).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears prior local insights and player when selecting a metadata-only track', async () => {
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { await result.current.analyzeFile(clip()); });
    await act(async () => { await result.current.analyzeSong(spotify); });
    expect(result.current.song?.spotifyId).toBe('track');
    expect(result.current.analysis).toBeNull();
    expect(result.current.audioSrc).toBeNull();
    expect(result.current.fileName).toBeNull();
  });

  it('ignores a local worker completion after reset or a newer track selection', async () => {
    const worker = deferred<AudioAnalysisResultV2>(); mocks.analyze.mockReturnValue(worker.promise);
    const { result } = renderHook(useSongAnalysis);
    let run!: Promise<void>;
    await act(async () => { run = result.current.analyzeFile(clip()); });
    expect(result.current.stage).toBe('analyzing');
    act(() => result.current.reset());
    await act(async () => { await result.current.analyzeSong(spotify); worker.resolve(analysis); await run; });
    expect(result.current.analysis).toBeNull();
    expect(result.current.song?.title).toBe('Selected');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not start either action from a retained callback after unmount', async () => {
    const { result, unmount } = renderHook(useSongAnalysis);
    const { analyzeFile, analyzeSong } = result.current;
    unmount();
    await act(async () => { await analyzeFile(clip()); expect(await analyzeSong(spotify)).toBe(false); });
    expect(mocks.decode).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not start fallback or attach a worker result after unmount', async () => {
    const worker = deferred<AudioAnalysisResultV2>(); mocks.analyze.mockReturnValue(worker.promise);
    const { result, unmount } = renderHook(useSongAnalysis);
    let run!: Promise<void>;
    await act(async () => { run = result.current.analyzeFile(clip()); });
    unmount();
    await act(async () => { worker.resolve(analysis); await run; });
    expect(mocks.fallback).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exposes local decode failure without inventing a result', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.decode.mockRejectedValue(new Error('decode failed'));
    mocks.fallback.mockRejectedValue(new Error('invalid audio'));
    const { result } = renderHook(useSongAnalysis);
    await act(async () => { await result.current.analyzeFile(clip()); });
    expect(result.current.error).toBe('invalid audio');
    expect(result.current.analysis).toBeNull();
    expect(result.current.stage).toBe('idle');
    expect(fetch).not.toHaveBeenCalled();
  });
});
