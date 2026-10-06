import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as saveAnalysis } from '@/app/api/analyses/route';
import { POST as saveHashes } from '@/app/api/fingerprints/route';
import { POST as saveFeatures } from '@/app/api/songs/[id]/features/route';
import { ingestFingerprints } from '@/lib/fingerprint/ingest';
import { GET as similar } from '@/app/api/songs/[id]/similar/route';

const mocks = vi.hoisted(() => ({
  save: vi.fn(), upsert: vi.fn(), admin: vi.fn(), server: vi.fn(), rate: vi.fn(), configured: vi.fn(),
}));
vi.mock('@/lib/db/analyses', () => ({ createAnalysis: mocks.save }));
vi.mock('@/lib/db/songs', () => ({ upsertSong: mocks.upsert }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminSupabase: mocks.admin }));
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: mocks.server }));
vi.mock('@/lib/fingerprint/match', () => ({ isFingerprintStoreConfigured: mocks.configured }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rate, clientIpFrom: () => 'test' }));
const uuid = '00000000-0000-4000-8000-000000000001';
const request = (body: unknown) => new NextRequest('http://localhost/api/analyses', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn());
  mocks.configured.mockReturnValue(true);
  mocks.rate.mockResolvedValue({ success: true });
});
afterEach(() => vi.unstubAllGlobals());

function expectNoWork() {
  expect(fetch).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.server).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
}

describe('server recording permission boundary', () => {
  it.each(['audio', 'combined'])('rejects direct %s saves even if upload permission is asserted', async (mode) => {
    const response = await saveAnalysis(request({ mode, result: { mood: 'Happy' },
      song: { title: 'Spotify track', artist: 'Artist', previewUrl: 'https://p.scdn.co/clip.mp3', spotifyId: 'track' },
      source: 'upload', permission: 'granted',
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ status: 'audio_persistence_disabled' });
    expectNoWork();
  });

  it('rejects audio feature payloads relabeled as lyrics', async () => {
    const response = await saveAnalysis(request({ mode: 'lyrics', result: { mood: 'Happy', bpm: 120, features: {} } }));
    expect(response.status).toBe(403); expectNoWork();
  });

  it('blocks direct feature and fingerprint action invocation before accessing any store', async () => {
    expect((await saveHashes()).status).toBe(403);
    expect((await saveFeatures()).status).toBe(403);
    for (const source of ['preview', 'upload', 'seed'] as const) {
      expect(await ingestFingerprints(uuid, [{ h: 42, t: 100 }], source)).toEqual({ status: 'audio_persistence_disabled' });
    }
    expectNoWork();
  });

  it('keeps legitimate lyrics persistence available', async () => {
    mocks.configured.mockReturnValue(false);
    const response = await saveAnalysis(request({ mode: 'lyrics', result: { mood: 'Happy', wordCount: 12, themes: [] } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'store_unavailable' });
    expect(mocks.rate).toHaveBeenCalledOnce();
  });

  it('does not return legacy preview URLs from similar results and retains item links without inventing a source', async () => {
    const identityQuery = { in: vi.fn().mockResolvedValue({ data: [{ id: uuid, spotify_id: 'known-track', genius_id: 123 }], error: null }) };
    const select = vi.fn().mockReturnValue(identityQuery);
    mocks.admin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [{ id: uuid, title: 'Track', artist: 'Artist', cover_url: null, preview_url: 'https://p.scdn.co/clip.mp3', distance: 0.2 }], error: null }),
      from: vi.fn().mockReturnValue({ select }),
    });
    const response = await similar(new NextRequest(`http://localhost/api/songs/${uuid}/similar`), { params: Promise.resolve({ id: uuid }) });
    const body = await response.json();
    expect(body.songs[0]).toMatchObject({ spotifyId: 'known-track', geniusId: 123, metadataSource: 'catalog' });
    expect(body.songs[0]).not.toHaveProperty('previewUrl');
    expect(fetch).not.toHaveBeenCalled();
  });
});
