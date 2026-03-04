'use client';

import { useState, useEffect } from 'react';
import { HistoryEntry } from '@/lib/types';
import { getHistory, removeFromHistory, clearHistory } from '@/lib/history';

interface HistoryPanelProps {
  /** Called when the user clicks a history entry to restore it. */
  onRestore: (entry: HistoryEntry) => void;
  /** Bumped externally to trigger a re-read from localStorage. */
  refreshKey: number;
}

export default function HistoryPanel({ onRestore, refreshKey }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
  }, [refreshKey]);

  if (entries.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Analysis History ({entries.length})
      </button>

      {open && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
            >
              <button
                onClick={() => onRestore(entry)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {entry.result.mood} · {entry.result.vibe}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {entry.lyricsPreview}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(entry.id);
                  setEntries(getHistory());
                }}
                className="ml-3 p-1 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={() => {
              clearHistory();
              setEntries([]);
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors mt-2"
          >
            Clear all history
          </button>
        </div>
      )}
    </div>
  );
}
