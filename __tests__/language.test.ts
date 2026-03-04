import { describe, it, expect } from 'vitest';
import { detectLanguage, LANGUAGE_CODE_MAP, LANGUAGE_PATTERNS } from '@/lib/language';

describe('detectLanguage', () => {
  it('returns "English" for plain ASCII text', () => {
    expect(detectLanguage('Hello world, this is a test')).toBe('English');
  });

  it('detects Spanish characters', () => {
    expect(detectLanguage('Hola cómo estás')).toBe('Spanish');
  });

  it('detects Russian (Cyrillic)', () => {
    expect(detectLanguage('Привет мир')).toBe('Russian');
  });

  it('detects Chinese characters', () => {
    expect(detectLanguage('你好世界')).toBe('Chinese');
  });

  it('detects Japanese characters', () => {
    // Use pure Hiragana to avoid matching Chinese pattern first
    expect(detectLanguage('こんにちは')).toBe('Japanese');
  });

  it('detects Korean characters', () => {
    expect(detectLanguage('안녕하세요')).toBe('Korean');
  });

  it('detects Arabic characters', () => {
    expect(detectLanguage('مرحبا بالعالم')).toBe('Arabic');
  });

  it('detects Hebrew characters', () => {
    expect(detectLanguage('שלום עולם')).toBe('Hebrew');
  });

  it('returns "Unknown" for unrecognised non-ASCII', () => {
    // Thai script — not in our pattern list
    expect(detectLanguage('สวัสดี')).toBe('Unknown');
  });
});

describe('LANGUAGE_CODE_MAP', () => {
  it('maps all expected languages', () => {
    const expected = [
      'Spanish', 'French', 'German', 'Italian', 'Portuguese',
      'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic',
    ];
    for (const lang of expected) {
      expect(LANGUAGE_CODE_MAP[lang]).toBeDefined();
    }
  });
});

describe('LANGUAGE_PATTERNS', () => {
  it('exports patterns for at least 10 languages', () => {
    expect(Object.keys(LANGUAGE_PATTERNS).length).toBeGreaterThanOrEqual(10);
  });
});
