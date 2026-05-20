'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Search } from 'lucide-react';
import type { SearchHit } from '@/lib/sources/types';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { cn } from '@/lib/cn';

interface SongSearchProps {
  /** Fired when the user picks a hit from the dropdown. */
  onSelect: (hit: SearchHit) => void;
  /** Optional placeholder override. */
  placeholder?: string;
  className?: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; hits: SearchHit[] }
  | { kind: 'empty' }
  | { kind: 'not-configured' }
  | { kind: 'error'; message: string };

/**
 * Typeahead song search backed by `/api/songs/search` (Spotify).
 *
 * - 300ms debounce on input.
 * - Keyboard nav (ArrowUp/ArrowDown/Enter/Escape) on the dropdown.
 * - Inline, one-time notice when Spotify isn't configured (no toast spam).
 */
export default function SongSearch({
  onSelect,
  placeholder = 'Search for a song or artist…',
  className,
}: SongSearchProps) {
  const inputId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hits = status.kind === 'ok' ? status.hits : [];

  // Debounced fetch.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      // Cancel any in-flight search and reset.
      abortRef.current?.abort();
      setStatus({ kind: 'idle' });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus({ kind: 'loading' });

      try {
        const res = await fetch(
          `/api/songs/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );

        if (res.status === 503) {
          // Gracefully degrade — Spotify not configured.
          setStatus({ kind: 'not-configured' });
          setOpen(true);
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Search failed (${res.status})`);
        }

        const data = (await res.json()) as { hits: SearchHit[] };
        const next = Array.isArray(data.hits) ? data.hits : [];
        setStatus(next.length === 0 ? { kind: 'empty' } : { kind: 'ok', hits: next });
        setOpen(true);
        setActive(0);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Search failed',
        });
        setOpen(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click-outside to close.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSelect = useCallback(
    (hit: SearchHit) => {
      onSelect(hit);
      const label = `${hit.song.title} — ${hit.song.artist}`;
      setQuery(label);
      setOpen(false);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
        if (hits.length > 0) setOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (hits.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % hits.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + hits.length) % hits.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = hits[active];
        if (pick) handleSelect(pick);
      }
    },
    [open, hits, active, handleSelect],
  );

  const showDropdown =
    open &&
    (status.kind === 'loading' ||
      status.kind === 'ok' ||
      status.kind === 'empty' ||
      status.kind === 'not-configured' ||
      status.kind === 'error');

  const activeId = useMemo(
    () => (status.kind === 'ok' && hits[active] ? `${listboxId}-opt-${active}` : undefined),
    [status, hits, active, listboxId],
  );

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <label htmlFor={inputId} className="sr-only">
        Search for a song
      </label>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-4',
          'bg-[var(--bg-elev1)] border border-[var(--border-subtle)] ring-inset-soft',
          'focus-within:border-[color-mix(in_oklab,var(--accent-from)_60%,var(--border-strong))]',
          'focus-within:ring-2 focus-within:ring-[var(--accent-glow)]',
          'transition-[border-color,box-shadow] duration-200',
        )}
      >
        <Search size={16} className="text-[var(--text-low)]" aria-hidden />
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (hits.length > 0 || status.kind === 'not-configured') setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 h-11 bg-transparent text-sm text-[var(--text-hi)]',
            'placeholder:text-[var(--text-low)] focus:outline-none',
          )}
        />
        {status.kind === 'loading' && (
          <div
            className="h-3.5 w-3.5 rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent-from)] animate-spin motion-reduce:animate-none"
            aria-label="Searching"
          />
        )}
      </div>

      {showDropdown && (
        <Card
          variant="elev2"
          className={cn(
            'absolute left-0 right-0 top-[calc(100%+6px)] z-30',
            'p-0 overflow-hidden',
            'shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]',
            'animate-fade-in motion-reduce:animate-none',
          )}
        >
          {status.kind === 'not-configured' && (
            <div className="px-4 py-3 text-xs text-[var(--text-med)]">
              <Badge variant="warn" className="mr-2 align-middle">
                Configure Spotify
              </Badge>
              <span>
                Set <code className="font-mono">SPOTIFY_CLIENT_ID</code> and{' '}
                <code className="font-mono">SPOTIFY_CLIENT_SECRET</code> to enable
                song lookup.
              </span>
            </div>
          )}

          {status.kind === 'empty' && (
            <div className="px-4 py-3 text-xs text-[var(--text-med)]">
              No matches for &ldquo;{query}&rdquo;.
            </div>
          )}

          {status.kind === 'error' && (
            <div className="px-4 py-3 text-xs text-[var(--state-error)]">
              {status.message}
            </div>
          )}

          {status.kind === 'ok' && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Song results"
              className="max-h-80 overflow-y-auto py-1"
            >
              {hits.map((hit, i) => {
                const isActive = i === active;
                return (
                  <li
                    id={`${listboxId}-opt-${i}`}
                    key={hit.id}
                    role="option"
                    aria-selected={isActive}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => handleSelect(hit)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left',
                        'text-[var(--text-med)] hover:text-[var(--text-hi)]',
                        'transition-colors duration-150',
                        isActive
                          ? 'bg-[var(--bg-elev3)] text-[var(--text-hi)]'
                          : 'hover:bg-[var(--bg-elev3)]',
                        'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-[-2px]',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {hit.song.coverUrl ? (
                        <img
                          src={hit.song.coverUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-md object-cover border border-[var(--border-subtle)] flex-shrink-0"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="h-8 w-8 rounded-md bg-[var(--bg-elev3)] border border-[var(--border-subtle)] flex-shrink-0"
                        />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-[var(--text-hi)]">
                          {hit.song.title}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-low)]">
                          {hit.song.artist}
                          {hit.song.year ? ` · ${hit.song.year}` : ''}
                        </span>
                      </span>
                      {hit.song.previewUrl && (
                        <Badge variant="mood" className="flex-shrink-0">
                          preview
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
