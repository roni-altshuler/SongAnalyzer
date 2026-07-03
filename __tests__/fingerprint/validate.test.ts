import { describe, expect, it } from 'vitest';

import { isUuid, parseFingerprintPayload } from '@/lib/fingerprint/validate';
import { HASH_LIMIT, MAX_OFFSET_MS } from '@/lib/fingerprint/types';

describe('parseFingerprintPayload', () => {
  it('accepts a valid payload', () => {
    const parsed = parseFingerprintPayload([{ h: 123, t: 456 }, { h: 0, t: 0 }], 10);
    expect(parsed).toEqual({ ok: true, hashes: [{ h: 123, t: 456 }, { h: 0, t: 0 }] });
  });

  it.each([
    ['not an array', 'nope', 'hashes_not_array'],
    ['empty array', [], 'hashes_empty'],
    ['hash out of 24-bit range', [{ h: HASH_LIMIT, t: 0 }], 'invalid_hash_at_0'],
    ['negative hash', [{ h: -1, t: 0 }], 'invalid_hash_at_0'],
    ['float hash', [{ h: 1.5, t: 0 }], 'invalid_hash_at_0'],
    ['offset beyond cap', [{ h: 1, t: MAX_OFFSET_MS + 1 }], 'invalid_hash_at_0'],
    ['missing fields', [{ h: 1 }], 'invalid_hash_at_0'],
    ['bad item mid-array', [{ h: 1, t: 1 }, null], 'invalid_hash_at_1'],
  ])('rejects %s', (_label, value, error) => {
    expect(parseFingerprintPayload(value, 10)).toEqual({ ok: false, error });
  });

  it('enforces the max hash budget', () => {
    const oversized = Array.from({ length: 11 }, (_, i) => ({ h: i, t: i }));
    expect(parseFingerprintPayload(oversized, 10)).toEqual({ ok: false, error: 'too_many_hashes' });
  });
});

describe('isUuid', () => {
  it('accepts canonical uuids and rejects everything else', () => {
    expect(isUuid('a3bb189e-8bf9-3888-9912-ace4e6543002')).toBe(true);
    expect(isUuid('A3BB189E-8BF9-3888-9912-ACE4E6543002')).toBe(true);
    expect(isUuid('4uLU6hMCjMI75M1A2tKUQC')).toBe(false); // Spotify track id
    expect(isUuid('')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
