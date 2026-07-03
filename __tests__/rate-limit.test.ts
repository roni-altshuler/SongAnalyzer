import { beforeEach, describe, expect, it } from 'vitest';

import { __resetRateLimitForTests, clientIpFrom, rateLimit } from '@/lib/rate-limit';

/**
 * Exercises the in-memory sliding-window fallback (no Upstash env in tests).
 */

beforeEach(() => {
  __resetRateLimitForTests();
});

describe('rateLimit (memory fallback)', () => {
  it('admits requests up to the bucket limit, then rejects with retryAfterMs', async () => {
    // identify bucket: 10/min.
    for (let i = 0; i < 10; i++) {
      expect((await rateLimit('identify', 'ip-a')).success).toBe(true);
    }
    const rejected = await rateLimit('identify', 'ip-a');
    expect(rejected.success).toBe(false);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
    expect(rejected.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('tracks keys independently', async () => {
    for (let i = 0; i < 10; i++) await rateLimit('identify', 'ip-a');
    expect((await rateLimit('identify', 'ip-a')).success).toBe(false);
    expect((await rateLimit('identify', 'ip-b')).success).toBe(true);
  });

  it('tracks buckets independently for the same key', async () => {
    for (let i = 0; i < 3; i++) await rateLimit('identify-fallback', 'ip-a');
    expect((await rateLimit('identify-fallback', 'ip-a')).success).toBe(false);
    expect((await rateLimit('identify', 'ip-a')).success).toBe(true);
  });
});

describe('clientIpFrom', () => {
  it('takes the first x-forwarded-for hop', () => {
    const request = new Request('http://x', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });
    expect(clientIpFrom(request)).toBe('203.0.113.9');
  });

  it('falls back to "unknown" without the header', () => {
    expect(clientIpFrom(new Request('http://x'))).toBe('unknown');
  });
});
