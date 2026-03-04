/**
 * Client-side history management using localStorage.
 */

import { AnalysisResult, HistoryEntry } from './types';

const HISTORY_KEY = 'songanalyzer_history';
const MAX_HISTORY = 20;

/**
 * Retrieve all analysis history entries from localStorage.
 */
export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new analysis result to history.
 */
export function saveToHistory(lyricsPreview: string, result: AnalysisResult): HistoryEntry {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    lyricsPreview: lyricsPreview.slice(0, 120).trim() + (lyricsPreview.length > 120 ? '…' : ''),
    result,
  };

  const history = getHistory();
  history.unshift(entry);

  // Keep only the most recent entries
  const trimmed = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));

  return entry;
}

/**
 * Remove a specific history entry by ID.
 */
export function removeFromHistory(id: string): void {
  const history = getHistory().filter((e) => e.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/**
 * Clear all analysis history.
 */
export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
