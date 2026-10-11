// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSelectionProvider, useTrackSelection, type SelectedTrack } from '@/app/providers/track-selection-provider';
import { useSongAnalysis, type UseSongAnalysis } from '@/app/hooks/useSongAnalysis';
import type { AudioAnalysisResultV2 } from '@/lib/types';

const mocks = vi.hoisted(() => ({ decode: vi.fn(), analyze: vi.fn(), fallback: vi.fn() }));
vi.mock('@/lib/audio/analyze', () => ({ decodeFileToMono: mocks.decode, analyzePcmV2: mocks.analyze }));
vi.mock('@/lib/audio-analysis', () => ({ analyzeAudioFile: mocks.fallback }));

const selected: SelectedTrack = {
  title: 'Original navigation demo', artist: 'Demo ensemble', spotifyId: 'demo-track', metadataSource: 'spotify',
  artistCredits: [{ provider: 'spotify', id: 'demo-ensemble', name: 'Demo ensemble', entityType: 'Unknown' }],
};
let workbench: UseSongAnalysis;
function Workbench() {
  const audio = useSongAnalysis();
  useEffect(() => { workbench = audio; }, [audio]);
  return null;
}
function visit(route: string) { return <TrackSelectionProvider><Workbench key={route} /></TrackSelectionProvider>; }

describe('visit-only selected track across routed workbenches', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('React', React); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('retains source metadata across page remounts, then clears it across pages', async () => {
    const view = render(visit('discover'));
    await act(async () => { await workbench.analyzeSong(selected); });
    view.rerender(visit('artist'));
    expect(workbench.song).toMatchObject(selected);
    expect(workbench.analysis).toBeNull(); expect(workbench.audioSrc).toBeNull(); expect(workbench.fileName).toBeNull();
    act(() => workbench.clearSong());
    view.rerender(visit('analyze'));
    expect(workbench.song).toBeNull();
  });

  it('does not share a selection with a separate application root or a reload', async () => {
    const first = render(visit('first'));
    await act(async () => { await workbench.analyzeSong(selected); });
    const second = render(visit('second'));
    expect(workbench.song).toBeNull();
    second.unmount(); first.unmount();
    render(visit('reload'));
    expect(workbench.song).toBeNull();
  });

  it('retains only named metadata and sanitized credits, never recording URLs or extra payloads', () => {
    const { result } = renderHook(useTrackSelection, { wrapper: TrackSelectionProvider });
    const malformed = {
      ...selected, previewUrl: 'https://p.scdn.co/prohibited.mp3', lyrics: 'not-retained', audioSrc: new File([], 'private.wav'),
      analysis: {}, artistCredits: [{ ...selected.artistCredits![0], lyrics: 'not-retained' }, { provider: 'album', name: 'invalid credit' }],
    } as unknown as SelectedTrack;
    act(() => result.current.setSong(malformed));
    expect(result.current.song).toMatchObject(selected);
    expect(result.current.song?.artistCredits).toHaveLength(1);
    expect(result.current.song?.artistCredits?.[0]).not.toHaveProperty('lyrics');
    expect(result.current.song).not.toHaveProperty('previewUrl');
    expect(result.current.song).not.toHaveProperty('lyrics'); expect(result.current.song).not.toHaveProperty('audioSrc');
    expect(result.current.song).not.toHaveProperty('analysis');
    expect(result.current.song?.artistCredits).not.toBe(malformed.artistCredits);
  });

  it('ignores retained callbacks from an old route after selecting a replacement', async () => {
    const view = render(visit('discover'));
    const old = workbench;
    await act(async () => { await old.analyzeSong(selected); });
    view.rerender(visit('analyze'));
    const replacement = { ...selected, title: 'Another original demo', spotifyId: 'replacement' };
    await act(async () => { await workbench.analyzeSong(replacement); await old.analyzeSong(selected); old.reset(); });
    expect(workbench.song?.spotifyId).toBe('replacement');
    expect(mocks.decode).not.toHaveBeenCalled();
  });

  it('clears unrelated metadata for a local file and leaves its result on the current page', async () => {
    // An opaque pipeline sentinel verifies ownership without asserting audio measurements.
    const sentinel = {} as AudioAnalysisResultV2;
    mocks.decode.mockResolvedValue({ pcm: new Float32Array(), sampleRate: 22050 }); mocks.analyze.mockResolvedValue(sentinel);
    const view = render(visit('analyze'));
    await act(async () => { await workbench.analyzeSong(selected); await workbench.analyzeFile(new File([], 'local.wav')); });
    expect(workbench.song).toBeNull(); expect(workbench.analysis).toBe(sentinel); expect(workbench.audioSrc).toBeInstanceOf(File);
    view.rerender(visit('discover'));
    expect(workbench.song).toBeNull(); expect(workbench.analysis).toBeNull(); expect(workbench.audioSrc).toBeNull(); expect(workbench.fileName).toBeNull();
  });
});
