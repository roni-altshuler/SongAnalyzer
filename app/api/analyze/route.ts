import { NextRequest, NextResponse } from 'next/server';

interface AnalysisResult {
  mood: string;
  vibe: string;
  energy: string;
  sentiment: string;
  themes: string[];
  detailedAnalysis: string;
  confidence: number;
  wordCount: number;
  originalLanguage?: string;
  translated?: boolean;
}

// Language detection patterns (same as translate API)
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

// Sentiment analysis based on keyword patterns
function analyzeSentiment(text: string): string {
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['love', 'happy', 'joy', 'beautiful', 'amazing', 'wonderful', 'great', 'good', 'hope', 'dream', 'smile', 'light', 'sunshine', 'heaven', 'peace', 'sweet', 'bright', 'free', 'alive', 'blessed'];
  const negativeWords = ['sad', 'pain', 'hurt', 'cry', 'lonely', 'dark', 'hate', 'death', 'fear', 'lost', 'broken', 'tears', 'nightmare', 'hell', 'angry', 'rage', 'cold', 'empty', 'dead', 'suffer'];
  const neutralWords = ['think', 'know', 'wonder', 'remember', 'maybe', 'perhaps', 'question', 'time', 'day', 'night'];

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) positiveCount += matches.length;
  });

  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) negativeCount += matches.length;
  });

  neutralWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) neutralCount += matches.length;
  });

  if (positiveCount > negativeCount * 1.5) return 'Very Positive';
  if (positiveCount > negativeCount) return 'Positive';
  if (negativeCount > positiveCount * 1.5) return 'Very Negative';
  if (negativeCount > positiveCount) return 'Negative';
  return 'Neutral/Mixed';
}

// Mood analysis based on themes and patterns
function analyzeMood(text: string, sentiment: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.match(/\b(miss|longing|distance|far away|apart|remember)\b/i)) {
    return sentiment.includes('Negative') ? 'Melancholic' : 'Nostalgic';
  }
  if (lowerText.match(/\b(angry|rage|fury|fight|battle|war)\b/i)) {
    return 'Aggressive';
  }
  if (lowerText.match(/\b(love|heart|romance|kiss|together|forever)\b/i)) {
    return sentiment.includes('Positive') ? 'Romantic' : 'Bittersweet';
  }
  if (lowerText.match(/\b(dance|party|celebrate|tonight|fun|groove)\b/i)) {
    return 'Euphoric';
  }
  if (lowerText.match(/\b(sad|cry|tears|pain|hurt|lonely|broken)\b/i)) {
    return 'Sorrowful';
  }
  if (lowerText.match(/\b(calm|peace|quiet|still|gentle|soft)\b/i)) {
    return 'Peaceful';
  }
  if (lowerText.match(/\b(hope|believe|faith|dream|rise|soar)\b/i)) {
    return 'Hopeful';
  }
  if (lowerText.match(/\b(fear|scared|dark|nightmare|shadow|danger)\b/i)) {
    return 'Anxious';
  }
  
  return sentiment.includes('Positive') ? 'Uplifting' : sentiment.includes('Negative') ? 'Somber' : 'Contemplative';
}

// Vibe analysis
function analyzeVibe(text: string, mood: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.match(/\b(bass|beat|drop|boom|pump|thump)\b/i)) {
    return 'High-Energy';
  }
  if (lowerText.match(/\b(slow|soft|whisper|gentle|tender|quiet)\b/i)) {
    return 'Mellow';
  }
  if (lowerText.match(/\b(wild|crazy|insane|fire|burn|explode)\b/i)) {
    return 'Intense';
  }
  if (lowerText.match(/\b(chill|relax|ease|smooth|groove|flow)\b/i)) {
    return 'Laid-back';
  }
  if (lowerText.match(/\b(power|strong|rise|climb|victory|triumph)\b/i)) {
    return 'Empowering';
  }
  if (lowerText.match(/\b(dream|float|drift|sky|clouds|stars)\b/i)) {
    return 'Dreamy';
  }
  
  if (mood.includes('Euphoric') || mood.includes('Hopeful')) return 'Upbeat';
  if (mood.includes('Melancholic') || mood.includes('Sorrowful')) return 'Moody';
  if (mood.includes('Aggressive')) return 'Edgy';
  if (mood.includes('Peaceful')) return 'Tranquil';
  
  return 'Balanced';
}

// Energy level analysis
function analyzeEnergy(text: string, vibe: string): string {
  const lowerText = text.toLowerCase();
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  
  const highEnergyWords = ['run', 'fast', 'loud', 'scream', 'shout', 'jump', 'dance', 'move', 'shake', 'rock'];
  const lowEnergyWords = ['slow', 'tired', 'sleep', 'rest', 'calm', 'quiet', 'still', 'soft', 'fade'];
  
  let energyScore = 50; // Start neutral
  
  highEnergyWords.forEach(word => {
    if (lowerText.includes(word)) energyScore += 10;
  });
  
  lowEnergyWords.forEach(word => {
    if (lowerText.includes(word)) energyScore -= 10;
  });
  
  energyScore += exclamationCount * 5;
  
  if (vibe.includes('High-Energy') || vibe.includes('Intense')) energyScore += 20;
  if (vibe.includes('Mellow') || vibe.includes('Tranquil')) energyScore -= 20;
  
  if (energyScore > 70) return 'Very High';
  if (energyScore > 50) return 'High';
  if (energyScore > 30) return 'Moderate';
  if (energyScore > 10) return 'Low';
  return 'Very Low';
}

// Extract themes
function extractThemes(text: string): string[] {
  const lowerText = text.toLowerCase();
  const themes: string[] = [];
  
  const themePatterns = {
    'Love & Romance': /\b(love|heart|romance|kiss|passion|desire|together|forever|soul|mate)\b/i,
    'Heartbreak': /\b(broken|hurt|pain|tears|cry|goodbye|miss|lost|alone|apart)\b/i,
    'Freedom': /\b(free|freedom|escape|fly|wings|break|chains|liberate|release)\b/i,
    'Celebration': /\b(party|celebrate|dance|tonight|fun|joy|happy|time|life)\b/i,
    'Struggle': /\b(fight|battle|struggle|hard|difficult|try|survive|overcome)\b/i,
    'Hope': /\b(hope|believe|faith|dream|future|better|change|light|tomorrow)\b/i,
    'Nostalgia': /\b(remember|past|memory|yesterday|used to|once|ago|time)\b/i,
    'Nature': /\b(sky|stars|moon|sun|rain|wind|sea|ocean|mountain|river)\b/i,
    'Identity': /\b(who|am|myself|identity|find|search|question|self|me)\b/i,
    'Time': /\b(time|moment|forever|never|always|today|tomorrow|yesterday)\b/i,
  };
  
  for (const [theme, pattern] of Object.entries(themePatterns)) {
    if (pattern.test(lowerText)) {
      themes.push(theme);
    }
  }
  
  return themes.slice(0, 5); // Return top 5 themes
}

// Generate detailed analysis
function generateDetailedAnalysis(
  lyrics: string,
  mood: string,
  vibe: string,
  energy: string,
  sentiment: string,
  themes: string[],
  wordCount: number
): string {
  const isFullSong = wordCount > 150;
  const isPartial = wordCount < 50;
  
  let analysis = '';
  
  if (isFullSong) {
    analysis += `This song presents a comprehensive emotional journey with a ${mood.toLowerCase()} mood and ${vibe.toLowerCase()} vibe. `;
  } else if (isPartial) {
    analysis += `Based on this excerpt, the song appears to have a ${mood.toLowerCase()} mood with a ${vibe.toLowerCase()} vibe. `;
  } else {
    analysis += `The lyrics reveal a ${mood.toLowerCase()} mood paired with a ${vibe.toLowerCase()} vibe. `;
  }
  
  analysis += `The overall sentiment leans ${sentiment.toLowerCase()}, creating an emotional atmosphere that resonates with ${energy.toLowerCase()} energy. `;
  
  if (themes.length > 0) {
    analysis += `\n\nThe lyrical content explores themes of ${themes.slice(0, -1).join(', ')}${themes.length > 1 ? ', and ' + themes[themes.length - 1] : themes[0]}, `;
    
    if (isFullSong) {
      analysis += 'weaving these elements throughout the composition to create a rich, multi-layered narrative. ';
    } else {
      analysis += 'suggesting a deeper narrative that likely unfolds throughout the full song. ';
    }
  }
  
  // Add context-specific insights
  if (mood.includes('Melancholic') || mood.includes('Sorrowful')) {
    analysis += '\n\nThe melancholic undertones suggest introspection and emotional vulnerability, inviting listeners into a deeply personal experience.';
  } else if (mood.includes('Euphoric') || mood.includes('Hopeful')) {
    analysis += '\n\nThe uplifting nature of the lyrics creates an inspiring and motivational atmosphere, encouraging listeners to embrace positivity.';
  } else if (mood.includes('Aggressive')) {
    analysis += '\n\nThe intensity and power in these lyrics convey strong emotions and determination, reflecting themes of struggle or assertion.';
  } else if (mood.includes('Peaceful') || mood.includes('Contemplative')) {
    analysis += '\n\nThe contemplative quality invites reflection and mindfulness, creating space for listeners to connect with their inner thoughts.';
  }
  
  if (isPartial) {
    analysis += '\n\n💡 Note: This analysis is based on a partial excerpt. Providing the complete lyrics would enable a more comprehensive and nuanced understanding of the song\'s full emotional arc and thematic development.';
  } else if (isFullSong) {
    analysis += '\n\n✨ The full lyrical content provided allows for a deep and thorough analysis, capturing the complete emotional journey and artistic vision of the song.';
  }
  
  return analysis;
}

// Main analysis function
async function analyzeLyrics(lyrics: string): Promise<AnalysisResult> {
  // Detect language and translate if needed
  const originalLanguage = detectLanguage(lyrics);
  let textToAnalyze = lyrics;
  let wasTranslated = false;
  
  if (originalLanguage !== 'English') {
    // Attempt translation
    try {
      const translateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lyrics }),
      });
      
      if (translateResponse.ok) {
        const translateResult = await translateResponse.json();
        if (translateResult.wasTranslated) {
          textToAnalyze = translateResult.translatedText;
          wasTranslated = true;
        }
      }
    } catch (error) {
      console.error('Translation failed, analyzing original text:', error);
    }
  }
  
  // Calculate word count
  const wordCount = textToAnalyze.trim().split(/\s+/).filter(Boolean).length;
  
  // Perform analysis
  const sentiment = analyzeSentiment(textToAnalyze);
  const mood = analyzeMood(textToAnalyze, sentiment);
  const vibe = analyzeVibe(textToAnalyze, mood);
  const energy = analyzeEnergy(textToAnalyze, vibe);
  const themes = extractThemes(textToAnalyze);
  const detailedAnalysis = generateDetailedAnalysis(
    textToAnalyze,
    mood,
    vibe,
    energy,
    sentiment,
    themes,
    wordCount
  );
  
  // Calculate confidence based on text length and complexity
  let confidence = 0.5;
  if (wordCount > 150) confidence = 0.95;
  else if (wordCount > 100) confidence = 0.85;
  else if (wordCount > 50) confidence = 0.75;
  else if (wordCount > 25) confidence = 0.65;
  else confidence = 0.55;
  
  return {
    mood,
    vibe,
    energy,
    sentiment,
    themes,
    detailedAnalysis,
    confidence,
    wordCount,
    originalLanguage: wasTranslated ? originalLanguage : undefined,
    translated: wasTranslated,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { lyrics } = await request.json();

    if (!lyrics || typeof lyrics !== 'string') {
      return NextResponse.json(
        { error: 'Lyrics are required' },
        { status: 400 }
      );
    }

    if (lyrics.trim().split(/\s+/).length < 5) {
      return NextResponse.json(
        { error: 'Please provide at least 5 words for analysis' },
        { status: 400 }
      );
    }

    const analysis = await analyzeLyrics(lyrics);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze lyrics' },
      { status: 500 }
    );
  }
}
