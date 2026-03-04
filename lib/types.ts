/**
 * Shared types for the Song Lyric Analyzer application.
 */

export interface AnalysisResult {
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

export interface HistoryEntry {
  id: string;
  timestamp: number;
  lyricsPreview: string;
  result: AnalysisResult;
}

export interface SampleLyric {
  title: string;
  artist: string;
  genre: string;
  lyrics: string;
}
