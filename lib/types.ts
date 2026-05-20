/**
 * Shared types for the Song Lyric Analyzer application.
 */

/**
 * Lifecycle status of an analysis engine for a given request.
 *
 * Mirrors `EngineStatus` in `lib/analysis/types.ts`; re-declared here so
 * client components can describe the API response shape without importing
 * server-only modules.
 */
export type EngineStatus = 'ok' | 'skipped' | 'unavailable' | 'timeout' | 'error';

/**
 * Per-engine provenance metadata attached to every analysis response.
 * The UI uses this to render transparency badges (which engine drove the
 * mood) and to gracefully degrade when the transformer is unavailable.
 */
export interface EngineProvenance {
  transformer: {
    status: EngineStatus;
    model?: string;
    scores?: Array<{ label: string; score: number }>;
    reason?: string;
  };
  keyword: {
    status: EngineStatus;
    scores?: { positive: number; negative: number; neutral: number };
  };
}

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
  /** Per-engine provenance (Stream C, v2 hybrid engine). */
  engines?: EngineProvenance;
  /** Mood-derived gradient palette for theming (Stream C, v2). */
  moodColor?: { from: string; to: string; glow: string };
}

export interface AudioAnalysisResult {
  mood: string;
  vibe: string;
  energy: string;
  sentiment: string;
  tempo: string;
  bpm: number;
  characteristics: string[];
  detailedAnalysis: string;
  confidence: number;
  duration: number;
  features: {
    bpm: number;
    rmsEnergy: number;
    spectralCentroid: number;
    dynamicRange: number;
    zeroCrossingRate: number;
    duration: number;
  };
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
