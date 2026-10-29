/**
 * Language detection utilities shared across the application.
 */

export const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  spanish: /[\u00C0-\u00FF]/i,
  french: /[àâäéèêëïîôùûüÿœæç]/i,
  german: /[äöüßÄÖÜ]/i,
  italian: /[àèéìòù]/i,
  portuguese: /[ãõâêôáéíóú]/i,
  russian: /[\u0400-\u04FF]/,
  japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
  korean: /[\uAC00-\uD7AF]/,
  chinese: /[\u4E00-\u9FFF]/,
  arabic: /[\u0600-\u06FF]/,
  hebrew: /[\u0590-\u05FF]/,
};

export const LANGUAGE_CODE_MAP: Record<string, string> = {
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Russian: 'ru',
  Chinese: 'zh',
  Japanese: 'ja',
  Korean: 'ko',
  Arabic: 'ar',
};

/**
 * Detect the language of the given text based on Unicode character patterns.
 */
export function detectLanguage(text: string): string {
  if (!/[^\u0000-\u007F]/.test(text)) {
    return 'English';
  }

  for (const [language, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) {
      return language.charAt(0).toUpperCase() + language.slice(1);
    }
  }

  return 'Unknown';
}

export const LANGUAGE_PROCESSING_STATES = [
  'english_confirmed', 'unverified', 'translated', 'not_configured', 'unsupported', 'failed',
] as const;

/** Hints describe character patterns, never validated language identification. */
export interface LanguageProcessing {
  status: typeof LANGUAGE_PROCESSING_STATES[number];
  languageHint?: string;
}

export function parseLanguageProcessing(value: unknown): LanguageProcessing | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some(key => key !== 'status' && key !== 'languageHint')) return undefined;
  if (!LANGUAGE_PROCESSING_STATES.some(status => status === r.status)) return undefined;
  if (r.languageHint !== undefined && (typeof r.languageHint !== 'string'
    || !Object.keys(LANGUAGE_PATTERNS).some(name => name === (r.languageHint as string).toLowerCase()))) return undefined;
  if (r.status === 'translated' && (typeof r.languageHint !== 'string' || !LANGUAGE_CODE_MAP[r.languageHint])) return undefined;
  return { status: r.status as LanguageProcessing['status'], ...(typeof r.languageHint === 'string' ? { languageHint: r.languageHint } : {}) };
}

/** Conservative routing over the existing patterns; no new languages or accuracy claims. */
export function assessLanguage(text: string): LanguageProcessing {
  const letters = text.normalize('NFC').match(/\p{L}/gu)?.join('') ?? '';
  if (!letters) return { status: 'unsupported' };
  const matches = Object.entries(LANGUAGE_PATTERNS).filter(([, pattern]) => pattern.test(letters));
  if (/\p{Script=Latin}/u.test(letters) && /[^\u0000-\u024f]/.test(letters)) return { status: 'unverified' };
  // ASCII cannot distinguish English from Spanish/French. Han cannot
  // distinguish Chinese from Japanese. Overlapping/mixed patterns are unsafe.
  if (matches.length > 1 || matches.some(([name]) => name === 'chinese')) return { status: 'unverified' };
  if (!matches.length) return { status: /[^\u0000-\u024f]/.test(letters) ? 'unsupported' : 'unverified' };
  const [name, pattern] = matches[0];
  const latinHint = ['spanish', 'french', 'german', 'italian', 'portuguese'].includes(name);
  // An unrecognized second script must not disappear just because only one
  // of our existing patterns matched. Punctuation was already removed above.
  if ([...letters].some(letter => !pattern.test(letter) && !(latinHint && /[A-Za-z]/.test(letter)))) return { status: 'unverified' };
  const languageHint = name.charAt(0).toUpperCase() + name.slice(1);
  return { status: LANGUAGE_CODE_MAP[languageHint] ? 'unverified' : 'unsupported', languageHint };
}
