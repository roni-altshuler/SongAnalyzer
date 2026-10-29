import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ unavailable: false, row: null as Record<string, unknown> | null }));
const nativeFetch = globalThis.fetch;
const networkAttempts: string[] = [];
vi.mock('@/lib/db/analyses', () => ({ getAnalysisBySlug: async () => { if (state.unavailable) throw new Error('Offline unavailable store'); return state.row; } }));
vi.mock('@/lib/db/songs', () => ({ getSongById: vi.fn() }));
import image from '@/app/share/[slug]/opengraph-image';
import twitter from '@/app/share/[slug]/twitter-image';

beforeEach(() => {
  vi.stubGlobal('React', React);
  networkAttempts.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // The renderer initializes its bundled WASM through a data URL, not HTTP.
    if (url.startsWith('data:')) return nativeFetch(input, init);
    networkAttempts.push(url);
    throw new Error('Preview must render offline without cover art');
  }));
  state.unavailable = false; state.row = null;
});
afterEach(() => { vi.unstubAllGlobals(); });

it.each(['missing', 'private', 'unavailable', 'unsupported', 'failed', 'legacy', 'english_confirmed', 'translated'])('renders a conservative actual OG/Twitter PNG for %s', async kind => {
  if (kind === 'unavailable') state.unavailable = true;
  else if (kind !== 'missing') state.row = { id: 'reading', is_public: kind !== 'private', song_id: null, result: { mood: 'Unverified mood', languageProcessing: kind === 'legacy' ? undefined : { status: kind === 'failed' || kind === 'english_confirmed' || kind === 'translated' ? kind : 'unsupported', ...(kind === 'translated' ? { languageHint: 'Russian' } : {}) } } };
  for (const render of [image, twitter]) {
    const response = await render({ params: Promise.resolve({ slug: 'offline-original' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(new DataView(bytes.buffer).getUint32(16)).toBe(1200);
    expect(new DataView(bytes.buffer).getUint32(20)).toBe(630);
  }
  expect(networkAttempts).toEqual([]);
});
