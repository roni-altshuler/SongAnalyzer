/**
 * Deterministic keyword-matching analysis engine.
 *
 * Preserves the v1 behavior of `app/api/analyze/route.ts` verbatim — same
 * keyword lists, regexes, energy heuristics, and confidence brackets — so the
 * existing test suite (`__tests__/analyze.test.ts`) continues to pass.
 *
 * This is the fallback engine: synchronous, no network, always succeeds.
 * When the transformer is unavailable (no HF token, 503, timeout) the API
 * route returns this result directly with `engines.transformer.status` set
 * accordingly.
 */

import type { KeywordResult } from './types';

const POSITIVE_WORDS = [
  'love', 'happy', 'joy', 'beautiful', 'amazing', 'wonderful', 'great', 'good',
  'hope', 'dream', 'smile', 'light', 'sunshine', 'heaven', 'peace', 'sweet',
  'bright', 'free', 'alive', 'blessed',
];

const NEGATIVE_WORDS = [
  'sad', 'pain', 'hurt', 'cry', 'lonely', 'dark', 'hate', 'death', 'fear',
  'lost', 'broken', 'tears', 'nightmare', 'hell', 'angry', 'rage', 'cold',
  'empty', 'dead', 'suffer',
];

const NEUTRAL_WORDS = [
  'think', 'know', 'wonder', 'remember', 'maybe', 'perhaps', 'question',
  'time', 'day', 'night',
];

const HIGH_ENERGY_WORDS = [
  'run', 'fast', 'loud', 'scream', 'shout', 'jump', 'dance', 'move', 'shake', 'rock',
];

const LOW_ENERGY_WORDS = [
  'slow', 'tired', 'sleep', 'rest', 'calm', 'quiet', 'still', 'soft', 'fade',
];

function countMatches(lowerText: string, words: readonly string[]): number {
  let count = 0;
  for (const word of words) {
    // Word-stem match: 'love' matches 'love', 'loves', 'loving', etc.
    const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function analyzeSentiment(text: string): { sentiment: string; scores: KeywordResult['scores'] } {
  const lowerText = text.toLowerCase();

  const positiveCount = countMatches(lowerText, POSITIVE_WORDS);
  const negativeCount = countMatches(lowerText, NEGATIVE_WORDS);
  const neutralCount = countMatches(lowerText, NEUTRAL_WORDS);

  let sentiment: string;
  if (positiveCount > negativeCount * 1.5) sentiment = 'Very Positive';
  else if (positiveCount > negativeCount) sentiment = 'Positive';
  else if (negativeCount > positiveCount * 1.5) sentiment = 'Very Negative';
  else if (negativeCount > positiveCount) sentiment = 'Negative';
  else sentiment = 'Neutral/Mixed';

  return {
    sentiment,
    scores: {
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
    },
  };
}

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

  if (sentiment.includes('Positive')) return 'Uplifting';
  if (sentiment.includes('Negative')) return 'Somber';
  return 'Contemplative';
}

function analyzeVibe(text: string, mood: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.match(/\b(bass|beat|drop|boom|pump|thump)\b/i)) return 'High-Energy';
  if (lowerText.match(/\b(slow|soft|whisper|gentle|tender|quiet)\b/i)) return 'Mellow';
  if (lowerText.match(/\b(wild|crazy|insane|fire|burn|explode)\b/i)) return 'Intense';
  if (lowerText.match(/\b(chill|relax|ease|smooth|groove|flow)\b/i)) return 'Laid-back';
  if (lowerText.match(/\b(power|strong|rise|climb|victory|triumph)\b/i)) return 'Empowering';
  if (lowerText.match(/\b(dream|float|drift|sky|clouds|stars)\b/i)) return 'Dreamy';

  if (mood.includes('Euphoric') || mood.includes('Hopeful')) return 'Upbeat';
  if (mood.includes('Melancholic') || mood.includes('Sorrowful')) return 'Moody';
  if (mood.includes('Aggressive')) return 'Edgy';
  if (mood.includes('Peaceful')) return 'Tranquil';

  return 'Balanced';
}

function analyzeEnergy(text: string, vibe: string): string {
  const lowerText = text.toLowerCase();
  const exclamationCount = (text.match(/!/g) || []).length;

  let energyScore = 50;

  for (const word of HIGH_ENERGY_WORDS) {
    if (lowerText.includes(word)) energyScore += 10;
  }
  for (const word of LOW_ENERGY_WORDS) {
    if (lowerText.includes(word)) energyScore -= 10;
  }

  energyScore += exclamationCount * 5;

  if (vibe.includes('High-Energy') || vibe.includes('Intense')) energyScore += 20;
  if (vibe.includes('Mellow') || vibe.includes('Tranquil')) energyScore -= 20;

  if (energyScore > 70) return 'Very High';
  if (energyScore > 50) return 'High';
  if (energyScore > 30) return 'Moderate';
  if (energyScore > 10) return 'Low';
  return 'Very Low';
}

const THEME_PATTERNS: Record<string, RegExp> = {
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

function extractThemes(text: string): string[] {
  const lowerText = text.toLowerCase();
  const themes: string[] = [];
  for (const [theme, pattern] of Object.entries(THEME_PATTERNS)) {
    if (pattern.test(lowerText)) themes.push(theme);
  }
  return themes.slice(0, 5);
}

function generateDetailedAnalysis(
  mood: string,
  vibe: string,
  energy: string,
  sentiment: string,
  themes: string[],
  wordCount: number,
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
    const themesList = themes.length > 1
      ? themes.slice(0, -1).join(', ') + ', and ' + themes[themes.length - 1]
      : themes[0];
    analysis += `\n\nThe lyrical content explores themes of ${themesList}, `;
    if (isFullSong) {
      analysis += 'weaving these elements throughout the composition to create a rich, multi-layered narrative. ';
    } else {
      analysis += 'suggesting a deeper narrative that likely unfolds throughout the full song. ';
    }
  }

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

function computeConfidence(wordCount: number): number {
  if (wordCount > 150) return 0.95;
  if (wordCount > 100) return 0.85;
  if (wordCount > 50) return 0.75;
  if (wordCount > 25) return 0.65;
  return 0.55;
}

/**
 * Pure keyword-based lyric analysis. Synchronous, deterministic, no network.
 *
 * Behavior is intentionally identical to the v1 `/api/analyze` implementation
 * so existing tests and history entries remain valid.
 */
export function analyzeKeyword(lyrics: string): KeywordResult {
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

  const { sentiment, scores } = analyzeSentiment(lyrics);
  const mood = analyzeMood(lyrics, sentiment);
  const vibe = analyzeVibe(lyrics, mood);
  const energy = analyzeEnergy(lyrics, vibe);
  const themes = extractThemes(lyrics);
  const detailedAnalysis = generateDetailedAnalysis(
    mood, vibe, energy, sentiment, themes, wordCount,
  );

  return {
    mood,
    vibe,
    energy,
    sentiment,
    themes,
    detailedAnalysis,
    confidence: computeConfidence(wordCount),
    wordCount,
    scores,
  };
}
