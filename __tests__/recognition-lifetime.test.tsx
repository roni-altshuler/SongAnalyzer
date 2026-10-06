// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IdentifyListener from '@/app/components/IdentifyListener';

const mocks = vi.hoisted(() => ({ decode: vi.fn(), hashes: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/audio/analyze', () => ({ decodeFileToMono: mocks.decode }));
vi.mock('@/app/workers/client', () => ({ computeFingerprint: mocks.hashes }));
vi.mock('@/app/components/ui/Toast', () => ({ toast: { success: mocks.success } }));
vi.mock('@/app/components/LiveSpectrum', () => ({ default: () => null }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const matched = () => new Response(JSON.stringify({ status: 'matched', song: { title: 'Matched', artist: 'Artist' }, match: { confidence: 0.8, votes: 30 } }));
const noMatch = () => new Response(JSON.stringify({ status: 'no_match', fallbackAvailable: true }));
function upload() {
  fireEvent.change(screen.getByLabelText('Upload an audio clip to identify'), {
    target: { files: [new File(['original fixture'], 'fixture.wav', { type: 'audio/wav' })] },
  });
}

class Recorder {
  static isTypeSupported() { return true; }
  static instances: Recorder[] = [];
  state = 'inactive'; mimeType = 'audio/webm';
  onstop: (() => void) | null = null;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  constructor() { Recorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.onstop?.(); }
}

beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('React', React); Recorder.instances = [];
  mocks.decode.mockResolvedValue({ pcm: new Float32Array([1, 2]), sampleRate: 44100 });
  mocks.hashes.mockResolvedValue([{ h: 42, t: 100 }]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(noMatch()));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('recognition operation lifetime', () => {
  it('stops a delayed decode before fingerprinting or requesting after unmount', async () => {
    const decode = deferred<{ pcm: Float32Array; sampleRate: number }>(); mocks.decode.mockReturnValue(decode.promise);
    const onMatched = vi.fn(); const { unmount } = render(<IdentifyListener onMatched={onMatched} />);
    upload(); unmount();
    await act(async () => { decode.resolve({ pcm: new Float32Array([1]), sampleRate: 44100 }); });
    expect(mocks.hashes).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(onMatched).not.toHaveBeenCalled();
  });

  it('aborts a pending lookup and suppresses a matched callback after navigation', async () => {
    const lookup = deferred<Response>(); const fetcher = vi.fn().mockReturnValue(lookup.promise); vi.stubGlobal('fetch', fetcher);
    const onMatched = vi.fn(); const { unmount } = render(<IdentifyListener onMatched={onMatched} />);
    upload(); await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    unmount(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { lookup.resolve(matched()); });
    expect(onMatched).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });

  it('ignores cancelled lookups even when a newer attempt has already matched', async () => {
    const lookup = deferred<Response>(); const fetcher = vi.fn().mockReturnValueOnce(lookup.promise).mockResolvedValueOnce(matched()); vi.stubGlobal('fetch', fetcher);
    const onMatched = vi.fn(); render(<IdentifyListener onMatched={onMatched} />);
    upload(); await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel matching' })); upload();
    await waitFor(() => expect(onMatched).toHaveBeenCalledOnce());
    await act(async () => { lookup.resolve(matched()); });
    expect(onMatched).toHaveBeenCalledOnce();
  });

  it('locks repeated Start while permission waits and stops a late stream after cancellation', async () => {
    const permission = deferred<MediaStream>(); const getUserMedia = vi.fn().mockReturnValue(permission.promise); const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } }); vi.stubGlobal('MediaRecorder', Recorder);
    render(<IdentifyListener onMatched={vi.fn()} />);
    const start = screen.getByRole('button', { name: 'Start listening' });
    act(() => { fireEvent.click(start); fireEvent.click(start); });
    expect(getUserMedia).toHaveBeenCalledOnce(); expect(screen.getByRole('status').textContent).toContain('Waiting for microphone permission');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => { permission.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
    expect(stop).toHaveBeenCalledOnce(); expect(Recorder.instances).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
  });

  it('stops capture tracks, recorder and deadline on unmount; detached stop cannot identify', async () => {
    vi.useFakeTimers(); const stop = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.stubGlobal('AudioContext', class {
      resume = vi.fn().mockResolvedValue(undefined); close = close;
      createMediaStreamSource() { return { connect: vi.fn() }; }
      createAnalyser() { return {}; }
    });
    const onMatched = vi.fn(); const { unmount } = render(<IdentifyListener onMatched={onMatched} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start listening' })); });
    const recorder = Recorder.instances[0]; expect(recorder.state).toBe('recording'); const lateStop = recorder.onstop;
    unmount(); expect(recorder.state).toBe('inactive'); expect(recorder.onstop).toBeNull(); expect(stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    await act(async () => { lateStop?.(); vi.advanceTimersByTime(20_000); });
    expect(mocks.decode).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(onMatched).not.toHaveBeenCalled();
  });
});

describe('AudD disclosure and consent', () => {
  it('does not upload on a miss or disclosure; only named confirmation sends the clip and consent marker', async () => {
    // Each fetch owns a fresh response body, just as it does in the browser.
    const fetcher = vi.fn().mockImplementation(async () => noMatch()); vi.stubGlobal('fetch', fetcher);
    render(<IdentifyListener onMatched={vi.fn()} />); upload();
    fireEvent.click(await screen.findByRole('button', { name: 'Try AudD recognition' }));
    expect(screen.getByRole('region', { name: 'AudD audio sharing consent' }).textContent).toContain('will leave your device');
    expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Send clip to AudD' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const [url, init] = fetcher.mock.calls[1]; expect(url).toBe('/api/identify/fallback');
    expect(init.body.get('consent')).toBe('audd-recognition'); expect(init.body.get('audio')).toBeInstanceOf(Blob);
    expect(await screen.findByText('Still no match.')).toBeDefined();
  });

  it('keeps the clip local when consent is declined', async () => {
    const onMatched = vi.fn(); render(<IdentifyListener onMatched={onMatched} />); upload();
    fireEvent.click(await screen.findByRole('button', { name: 'Try AudD recognition' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep audio on device' }));
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeDefined();
    expect(fetch).toHaveBeenCalledOnce(); expect(onMatched).not.toHaveBeenCalled();
  });

  it('suppresses a late fallback match and toast after unmount', async () => {
    const fallback = deferred<Response>(); const fetcher = vi.fn().mockResolvedValueOnce(noMatch()).mockReturnValueOnce(fallback.promise); vi.stubGlobal('fetch', fetcher);
    const onMatched = vi.fn(); const { unmount } = render(<IdentifyListener onMatched={onMatched} />); upload();
    fireEvent.click(await screen.findByRole('button', { name: 'Try AudD recognition' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send clip to AudD' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2)); unmount();
    expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
    await act(async () => { fallback.resolve(matched()); });
    expect(onMatched).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });
});
