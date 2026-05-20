'use client';

import { SAMPLE_LYRICS } from '@/lib/samples';
import { cn } from '@/lib/cn';

interface SampleLyricPickerProps {
  onSelect: (lyrics: string) => void;
}

const GENRE_GLYPH: Record<string, string> = {
  pop: '◐',
  ballad: '♪',
  rock: '⚡',
  chill: '∿',
};

export default function SampleLyricPicker({ onSelect }: SampleLyricPickerProps) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-3">
        Quick start · try a sample
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {SAMPLE_LYRICS.map((sample) => (
          <button
            key={sample.title}
            type="button"
            onClick={() => onSelect(sample.lyrics)}
            className={cn(
              'group flex-shrink-0 w-48 text-left px-4 py-3.5 rounded-xl',
              'bg-[var(--bg-elev1)] border border-[var(--border-subtle)] ring-inset-soft',
              'transition-[transform,border-color,box-shadow] duration-200',
              '[transition-timing-function:var(--ease-out)]',
              'hover:-translate-y-0.5',
              'hover:border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))]',
              'hover:shadow-[0_8px_24px_-12px_var(--accent-glow)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
            )}
          >
            <span
              aria-hidden
              className="inline-block text-lg leading-none text-[var(--text-med)] group-hover:text-[var(--accent-from)] transition-colors"
            >
              {GENRE_GLYPH[sample.genre] ?? '♫'}
            </span>
            <p className="font-display text-base text-[var(--text-hi)] mt-1.5 truncate">
              {sample.title}
            </p>
            <p className="text-xs text-[var(--text-low)] truncate mt-0.5">{sample.artist}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
