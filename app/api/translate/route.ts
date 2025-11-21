import { NextRequest, NextResponse } from 'next/server';

// Language detection patterns
const LANGUAGE_PATTERNS = {
  spanish: /[\u00C0-\u00FF]/i,
  french: /[àâäéèêëïîôùûüÿœæç]/i,
  german: /[äöüßÄÖÜ]/i,
  italian: /[àèéìòù]/i,
  portuguese: /[ãõâêôáéíóú]/i,
  russian: /[\u0400-\u04FF]/,
  chinese: /[\u4E00-\u9FFF]/,
  japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
  korean: /[\uAC00-\uD7AF]/,
  arabic: /[\u0600-\u06FF]/,
  hebrew: /[\u0590-\u05FF]/,
};

function detectLanguage(text: string): string {
  // Check for non-ASCII characters first
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
    // Using Helsinki-NLP translation models via Hugging Face
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            src_lang: detectedLanguage.toLowerCase(),
            tgt_lang: 'eng_Latn',
          },
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
      console.error('Translation API error:', await response.text());
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
