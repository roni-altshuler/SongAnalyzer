import { parseLanguageProcessing, type LanguageProcessing } from '@/lib/language';

export const LANGUAGE_LIMITATION = 'Language checks are unverified. Confidence reflects engine heuristics and text length, not reliable comprehension or language accuracy.';

export function languageContext(value?: LanguageProcessing): { title: string; detail: string } {
  const state = parseLanguageProcessing(value);
  const hint = state?.languageHint ? ` Character-pattern hint: ${state.languageHint}; this is not validated identification.` : '';
  switch (state?.status) {
    case 'english_confirmed': return { title: 'English text selected', detail: 'The person who submitted this reading selected English. This is not automatic language verification.' };
    case 'translated': return { title: 'Machine translation used', detail: `Text was translated before English-focused analysis. Translation quality is unverified.${hint}` };
    case 'not_configured': return { title: 'Translation unavailable', detail: `The translation service is not configured. Original text was analyzed with English-focused keywords; the reading may be misleading.${hint}` };
    case 'unsupported': return { title: 'Translation unsupported', detail: `No supported translation route was identified. Original text was analyzed with English-focused keywords; the reading may be misleading.${hint}` };
    case 'failed': return { title: 'Translation failed', detail: `No usable translation was returned. Original text was analyzed with English-focused keywords; the reading may be misleading.${hint}` };
    default: return { title: 'Language unverified', detail: 'English cannot be established from these character checks. ASCII Spanish/French, overlapping accents and mixed scripts can be ambiguous. Use English text or a translation you trust; select English only when appropriate. Older readings may lack language-processing records.' };
  }
}

export function languageSupportsComparison(value?: LanguageProcessing): boolean {
  const status = parseLanguageProcessing(value)?.status;
  return status === 'english_confirmed' || status === 'translated';
}
