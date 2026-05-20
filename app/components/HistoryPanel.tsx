'use client';

import { useEffect, useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { clearHistory, getHistory, removeFromHistory } from '@/lib/history';
import { cn } from '@/lib/cn';

interface HistoryPanelProps {
  onRestore: (entry: HistoryEntry) => void;
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
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em]',
          'text-[var(--text-low)] hover:text-[var(--text-med)]',
          'transition-colors',
        )}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn('transition-transform', open && 'rotate-90')}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        History · {entries.length}
      </button>

      {open && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'group flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
                'bg-[var(--bg-elev1)] border border-[var(--border-subtle)] ring-inset-soft',
                'transition-[border-color,transform] duration-200',
                '[transition-timing-function:var(--ease-out)]',
                'hover:-translate-y-0.5',
                'hover:border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))]',
              )}
            >
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="flex-1 text-left min-w-0 focus-visible:outline-none"
              >
                <p className="text-sm text-[var(--text-hi)] truncate">
                  <span className="font-medium">{entry.result.mood}</span>
                  <span className="text-[var(--text-low)] mx-2">·</span>
                  <span className="text-[var(--text-med)]">{entry.result.vibe}</span>
                </p>
                <p className="text-xs text-[var(--text-low)] truncate mt-0.5">
                  {entry.lyricsPreview}
                </p>
                <p className="text-[10px] font-mono text-[var(--text-low)] opacity-70 mt-1">
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(entry.id);
                  setEntries(getHistory());
                }}
                className={cn(
                  'p-1.5 rounded-md text-[var(--text-low)]',
                  'opacity-0 group-hover:opacity-100',
                  'hover:text-[var(--state-error)] hover:bg-[var(--bg-elev3)]',
                  'transition-[opacity,color,background] duration-150',
                  'focus-visible:opacity-100',
                )}
                title="Remove"
                aria-label="Remove from history"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              clearHistory();
              setEntries([]);
            }}
            className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-low)] hover:text-[var(--state-error)] transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
