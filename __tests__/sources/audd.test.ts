import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AuddNotConfiguredError,
  isAuddConfigured,
  recognizeAudd,
} from '@/lib/sources/audd';

/** Fetch-stub pattern from spotify.test.ts. */
const auddResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const snippet = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('isAuddConfigured', () => {
  it('reflects the AUDD_API_TOKEN env var', () => {
    vi.stubEnv('AUDD_API_TOKEN', '');
    expect(isAuddConfigured()).toBe(false);
    vi.stubEnv('AUDD_API_TOKEN', 'tok');
    expect(isAuddConfigured()).toBe(true);
  });
});

describe('recognizeAudd', () => {
  it('throws AuddNotConfiguredError without a token', async () => {
    vi.stubEnv('AUDD_API_TOKEN', '');
    await expect(recognizeAudd(snippet)).rejects.toBeInstanceOf(AuddNotConfiguredError);
  });

  it('parses a successful recognition', async () => {
    vi.stubEnv('AUDD_API_TOKEN', 'tok');
    const fetchMock = vi.fn(async () =>
      auddResponse({
        status: 'success',
        result: { title: 'Song', artist: 'Artist', album: 'Album' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(recognizeAudd(snippet)).resolves.toEqual({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.audd.io/');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('returns null when AudD finds no match', async () => {
    vi.stubEnv('AUDD_API_TOKEN', 'tok');
    vi.stubGlobal('fetch', vi.fn(async () => auddResponse({ status: 'success', result: null })));
    await expect(recognizeAudd(snippet)).resolves.toBeNull();
  });

  it('throws on an AudD error status', async () => {
    vi.stubEnv('AUDD_API_TOKEN', 'tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        auddResponse({ status: 'error', error: { error_message: 'api_token invalid' } }),
      ),
    );
    await expect(recognizeAudd(snippet)).rejects.toThrow(/api_token invalid/);
  });

  it('throws on transport failure', async () => {
    vi.stubEnv('AUDD_API_TOKEN', 'tok');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(recognizeAudd(snippet)).rejects.toThrow(/500/);
  });
});
