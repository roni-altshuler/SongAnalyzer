import { NextRequest, NextResponse } from 'next/server';
import { prepareLyrics } from '@/lib/analysis/translation';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const limit = await rateLimit('translate', clientIpFrom(request));
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const result = await prepareLyrics(text);
    return NextResponse.json({ translatedText: result.text, detectedLanguage: result.languageProcessing.languageHint ?? 'Unverified', wasTranslated: result.translated, languageProcessing: result.languageProcessing });
  } catch (error) {
    console.error('Translation endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    );
  }
}
