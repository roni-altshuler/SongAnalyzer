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
