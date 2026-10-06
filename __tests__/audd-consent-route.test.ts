import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/identify/fallback/route';

const mocks = vi.hoisted(() => ({ recognize: vi.fn(), configured: vi.fn(), rate: vi.fn(), resolve: vi.fn() }));
vi.mock('@/lib/sources/audd', () => ({ recognizeAudd: mocks.recognize, isAuddConfigured: mocks.configured }));
vi.mock('@/lib/sources/spotify', () => ({ isSpotifyConfigured: () => true }));
vi.mock('@/lib/sources/resolve', () => ({ resolveSong: mocks.resolve }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rate, clientIpFrom: () => 'test' }));
const request = (consent?: string, signal?: AbortSignal) => {
  const form = new FormData(); form.set('audio', new File(['original'], 'fixture.wav', { type: 'audio/wav' }));
  if (consent) form.set('consent', consent);
  return new NextRequest('http://localhost/api/identify/fallback', { method: 'POST', body: form, signal });
};
beforeEach(() => {
  vi.resetAllMocks(); mocks.configured.mockReturnValue(true); mocks.rate.mockResolvedValue({ success: true });
});

describe('AudD relay consent boundary', () => {
  it.each([undefined, 'yes', 'spotify'])('rejects absent or incorrect consent %s without provider upload or metadata resolution', async (consent) => {
    const response = await POST(request(consent));
    expect(await response.json()).toEqual({ status: 'invalid', error: 'audd_consent_required' });
    expect(mocks.recognize).not.toHaveBeenCalled(); expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('does not relay a cancelled request', async () => {
    const controller = new AbortController(); const req = request('audd-recognition', controller.signal); controller.abort();
    expect(await (await POST(req)).json()).toMatchObject({ status: 'invalid' });
    expect(mocks.recognize).not.toHaveBeenCalled(); expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('passes cancellation to the provider and avoids catalog writes during metadata enrichment', async () => {
    mocks.recognize.mockResolvedValue({ title: 'Track', artist: 'Artist' });
    mocks.resolve.mockResolvedValue({ title: 'Track', artist: 'Artist', metadataSource: 'spotify' });
    const req = request('audd-recognition');
    expect(await (await POST(req)).json()).toMatchObject({ status: 'matched' });
    expect(mocks.recognize.mock.calls[0][1]).toBe(req.signal);
    expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith('Track Artist');
  });
});
