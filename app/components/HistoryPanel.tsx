'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { clearHistory, readHistory, removeFromHistory, type HistoryRead } from '@/lib/history';
import { cn } from '@/lib/cn';

interface HistoryPanelProps {
  onRestore: (entry: HistoryEntry) => void;
  refreshKey: number;
  saveFailed?: boolean;
}

export default function HistoryPanel({ onRestore, refreshKey, saveFailed = false }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryRead>({ entries: [], status: 'ready' });
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { entries, status } = history;

  useEffect(() => {
    setHistory(readHistory());
    setFeedback('');
    setActionError('');
  }, [refreshKey]);

  return (
    <div className="mt-2 space-y-2" role="region" aria-label="Local history">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
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
        History{status === 'unavailable' ? ' · unavailable' : ` · ${entries.length}`}
      </button>

      <div role="status" className="space-y-2 text-xs leading-relaxed text-[var(--text-med)]">
        {saveFailed && <p>Your analysis is ready, but this result was not saved to local history. You can still copy it.</p>}
        {status === 'unavailable' && <p>Local history is unavailable in this browser. Analysis still works.</p>}
        {status === 'invalid' && <p>Some saved history needs attention. Available results can still be restored. Saved data is unchanged; saving and removal are paused until you explicitly clear this history.</p>}
        {feedback && <p>{feedback}</p>}
      </div>
      {actionError && <p role="alert" className="text-xs leading-relaxed text-[var(--state-error)]">{actionError}</p>}
      {status === 'unavailable' && (
        <button type="button" className="text-xs underline underline-offset-4 text-[var(--text-med)]" onClick={() => {
          const next = readHistory();
          setHistory(next); setActionError('');
          if (next.status !== 'unavailable') trigger.current?.focus();
        }}>Retry local history</button>
      )}

      {open && (
        <div id={panelId} className="mt-3 space-y-2 animate-fade-in">
          {entries.length === 0 && status === 'ready' && <p className="text-xs text-[var(--text-low)]">No saved analyses in this browser yet.</p>}
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
                className="flex-1 text-left min-w-0 rounded focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2"
              >
                <p className="text-sm text-[var(--text-hi)] truncate">
                  <span className="font-medium">{entry.result.mood}</span>
                  <span className="text-[var(--text-low)] mx-2">·</span>
                  <span className="text-[var(--text-med)]">{entry.result.vibe}</span>
                </p>
                <p className="text-xs text-[var(--text-low)] truncate mt-0.5">
                  {entry.lyricsPreview}
                </p>
                <p className="text-[10px] font-mono text-[var(--text-low)] mt-1">
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
              </button>
              <button
                type="button"
                disabled={status !== 'ready'}
                onClick={(e) => {
                  e.stopPropagation();
                  setFeedback('');
                  if (!removeFromHistory(entry.id)) {
                    setActionError('Could not remove that saved result. Try again.');
                    return;
                  }
                  setActionError(''); setHistory(readHistory());
                  setFeedback('Result removed from local history.'); trigger.current?.focus();
                }}
                className={cn(
                  'p-1.5 rounded-md text-[var(--text-low)]',
                  'opacity-0 group-hover:opacity-100',
                  'hover:text-[var(--state-error)] hover:bg-[var(--bg-elev3)]',
                  'transition-[opacity,color,background] duration-150',
                  'focus-visible:opacity-100',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
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

          {(entries.length > 0 || status === 'invalid') && <button
            type="button"
            onClick={() => {
              setFeedback('');
              if (!clearHistory()) { setActionError('Could not clear local history. Try again.'); return; }
              setActionError(''); setHistory(readHistory()); setOpen(false);
              setFeedback('Local history cleared.'); trigger.current?.focus();
            }}
            className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-low)] hover:text-[var(--state-error)] transition-colors"
          >
            Clear all
          </button>}
        </div>
      )}
    </div>
  );
}
