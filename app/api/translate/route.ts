import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage, LANGUAGE_CODE_MAP } from '@/lib/language';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';

// Simple translation using Hugging Face's free models (when HF_TOKEN is available)
// Otherwise, returns original text with detection info
async function translateText(text: string): Promise<{ translatedText: string; detectedLanguage: string; wasTranslated: boolean }> {
  const detectedLanguage = detectLanguage(text);
  
  // If already English or unknown, no translation needed
  if (detectedLanguage === 'English' || detectedLanguage === 'Unknown') {
    return {
      translatedText: text,
      detectedLanguage,
      wasTranslated: false,
    };
  }

  // Language code mapping for NLLB model
  const languageCodeMap: Record<string, string> = {
    'Spanish': 'spa_Latn',
    'French': 'fra_Latn',
    'German': 'deu_Latn',
    'Italian': 'ita_Latn',
    'Portuguese': 'por_Latn',
    'Russian': 'rus_Cyrl',
    'Chinese': 'zho_Hans',
    'Japanese': 'jpn_Jpan',
    'Korean': 'kor_Hang',
    'Arabic': 'arb_Arab',
    'Hebrew': 'heb_Hebr',
  };

  // For demo purposes without API key, we'll use a simple approach
  // In production, you'd use HuggingFace API with a token
  const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
  
  if (!HF_TOKEN) {
    // If no API key, return original text but mark that translation was attempted
    console.log(`Translation needed from ${detectedLanguage} but no API key available`);
    return {
      translatedText: text,
      detectedLanguage,
      wasTranslated: false,
    };
  }

  try {
    const langCode = LANGUAGE_CODE_MAP[detectedLanguage];
    
    if (!langCode) {
      return {
        translatedText: text,
        detectedLanguage,
        wasTranslated: false,
      };
    }
    
    // Using Helsinki-NLP translation model
    const modelName = `Helsinki-NLP/opus-mt-${langCode}-en`;
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
        },
        body: JSON.stringify({
          inputs: text,
        }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      const translatedText = result[0]?.translation_text || result[0]?.generated_text || text;
      return {
        translatedText,
        detectedLanguage,
        wasTranslated: true,
      };
    } else {
      const errorText = await response.text();
      console.error('Translation API error:', errorText);
      return {
        translatedText: text,
        detectedLanguage,
        wasTranslated: false,
      };
    }
  } catch (error) {
    console.error('Translation error:', error);
    return {
      translatedText: text,
      detectedLanguage,
      wasTranslated: false,
    };
  }
}

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

    const result = await translateText(text);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Translation endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    );
  }
}
