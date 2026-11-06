/** Local result previews only. Storage failure must never fail an analysis. */
import type { AnalysisResult, HistoryEntry } from './types';

const HISTORY_KEY = 'songanalyzer_history';
const MAX_HISTORY = 20;

export interface HistoryRead {
  entries: HistoryEntry[];
  status: 'ready' | 'unavailable' | 'invalid';
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const statuses = new Set(['ok', 'skipped', 'unavailable', 'timeout', 'error']);

/** Validate fields consumed by result renderers; retain the original object,
 * including valid legacy and additive provenance fields, without normalization. */
function validResult(value: unknown): value is AnalysisResult {
  if (!record(value) || !['mood', 'vibe', 'energy', 'sentiment', 'detailedAnalysis'].every(key => typeof value[key] === 'string') ||
      !Array.isArray(value.themes) || !value.themes.every(theme => typeof theme === 'string') ||
      !finite(value.confidence) || value.confidence < 0 || value.confidence > 1 ||
      !finite(value.wordCount) || !Number.isInteger(value.wordCount) || value.wordCount < 0) return false;
  if (value.originalLanguage !== undefined && typeof value.originalLanguage !== 'string') return false;
  if (value.translated !== undefined && typeof value.translated !== 'boolean') return false;
  if (value.moodColor !== undefined && (!record(value.moodColor) ||
      !['from', 'to', 'glow'].every(key => typeof (value.moodColor as Record<string, unknown>)[key] === 'string'))) return false;
  if (value.engines !== undefined) {
    if (!record(value.engines)) return false;
    const { transformer, keyword } = value.engines;
    if (!record(transformer) || !record(keyword) || typeof transformer.status !== 'string' ||
        !statuses.has(transformer.status) || typeof keyword.status !== 'string' || !statuses.has(keyword.status)) return false;
    if (transformer.model !== undefined && typeof transformer.model !== 'string') return false;
    if (transformer.reason !== undefined && typeof transformer.reason !== 'string') return false;
    if (transformer.scores !== undefined && (!Array.isArray(transformer.scores) || !transformer.scores.every(score =>
      record(score) && typeof score.label === 'string' && finite(score.score) && score.score >= 0 && score.score <= 1))) return false;
    if (keyword.scores !== undefined && (!record(keyword.scores) || !['positive', 'negative', 'neutral'].every(key =>
      finite((keyword.scores as Record<string, unknown>)[key]) && (keyword.scores as Record<string, number>)[key] >= 0))) return false;
  }
  return true;
}

function validEntry(value: unknown): value is HistoryEntry {
  return record(value) && typeof value.id === 'string' && value.id.length > 0 &&
    finite(value.timestamp) && value.timestamp >= 0 && value.timestamp <= 8.64e15 &&
    typeof value.lyricsPreview === 'string' && validResult(value.result);
}

/** Reading never repairs, removes or rewrites saved bytes. Safe entries remain
 * restorable, but mutations are blocked when any saved data needs attention. */
export function readHistory(): HistoryRead {
  if (typeof window === 'undefined') return { entries: [], status: 'unavailable' };
  let raw: string | null;
  try { raw = window.localStorage.getItem(HISTORY_KEY); }
  catch { return { entries: [], status: 'unavailable' }; }
  if (raw === null) return { entries: [], status: 'ready' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return { entries: [], status: 'invalid' }; }
  if (!Array.isArray(parsed)) return { entries: [], status: 'invalid' };
  const ids = new Set<string>();
  const entries = parsed.slice(0, MAX_HISTORY).filter((entry): entry is HistoryEntry => {
    if (!validEntry(entry) || ids.has(entry.id)) return false;
    ids.add(entry.id); return true;
  });
  return { entries, status: entries.length === parsed.length ? 'ready' : 'invalid' };
}

/** Compatibility helper for callers that only need safe result previews. */
export function getHistory(): HistoryEntry[] { return readHistory().entries; }

/** A null result means the new preview was not saved. Never overwrite corrupt
 * data, retry by evicting older entries, or increase the existing size limits. */
export function saveToHistory(lyricsPreview: string, result: AnalysisResult): HistoryEntry | null {
  const history = readHistory();
  if (history.status !== 'ready' || !validResult(result)) return null;
  try {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(), timestamp: Date.now(),
      lyricsPreview: lyricsPreview.slice(0, 120).trim() + (lyricsPreview.length > 120 ? '…' : ''), result,
    };
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...history.entries].slice(0, MAX_HISTORY)));
    return entry;
  } catch { return null; }
}

export function removeFromHistory(id: string): boolean {
  const history = readHistory();
  if (history.status !== 'ready') return false;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.entries.filter(entry => entry.id !== id)));
    return true;
  } catch { return false; }
}

/** Only an explicit Clear all action may remove unreadable history. */
export function clearHistory(): boolean {
  try { window.localStorage.removeItem(HISTORY_KEY); return true; }
  catch { return false; }
}
