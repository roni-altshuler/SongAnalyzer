import 'server-only';
import { assessLanguage, LANGUAGE_CODE_MAP, type LanguageProcessing } from '@/lib/language';

export interface PreparedLyrics {
  text: string;
  translated: boolean;
  originalLanguage?: string;
  languageProcessing: LanguageProcessing;
}

/** Keep translation outcomes identical in both public endpoints. */
export async function prepareLyrics(text: string, englishConfirmed = false): Promise<PreparedLyrics> {
  const assessment: LanguageProcessing = englishConfirmed ? { status: 'english_confirmed' } : assessLanguage(text);
  const unchanged = (languageProcessing: LanguageProcessing): PreparedLyrics => ({ text, translated: false, languageProcessing });
  if (englishConfirmed || assessment.status === 'unsupported' || !assessment.languageHint) return unchanged(assessment);
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) return unchanged({ ...assessment, status: 'not_configured' });
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-${LANGUAGE_CODE_MAP[assessment.languageHint]}-en`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ inputs: text }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unchanged({ ...assessment, status: 'failed' });
    const payload: unknown = await response.json();
    const first = Array.isArray(payload) ? payload[0] as Record<string, unknown> | undefined : undefined;
    const output = first?.translation_text ?? first?.generated_text;
    if (typeof output !== 'string' || !output.trim() || output.trim() === text.trim()) return unchanged({ ...assessment, status: 'failed' });
    return { text: output, translated: true, originalLanguage: assessment.languageHint, languageProcessing: { ...assessment, status: 'translated' } };
  } catch {
    return unchanged({ ...assessment, status: 'failed' });
  }
}
