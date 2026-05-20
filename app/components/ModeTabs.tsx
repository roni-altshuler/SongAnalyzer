'use client';

import { cn } from '@/lib/cn';

export type AnalysisMode = 'lyrics' | 'audio';

interface ModeTabsProps {
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}

const OPTIONS: Array<{ value: AnalysisMode; label: string; icon: string }> = [
  { value: 'lyrics', label: 'Lyrics', icon: '✏' },
  { value: 'audio', label: 'Audio', icon: '◎' },
];

export default function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="flex items-center justify-center mb-10">
      <div
        role="tablist"
        aria-label="Analysis mode"
        className={cn(
          'inline-flex p-1 rounded-2xl',
          'bg-[var(--bg-elev1)] border border-[var(--border-subtle)]',
          'ring-inset-soft',
        )}
      >
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                'relative px-6 py-2.5 rounded-xl text-sm font-medium tracking-wide',
                'transition-[background,color,box-shadow] duration-200',
                '[transition-timing-function:var(--ease-out)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
                selected
                  ? 'bg-[var(--bg-elev3)] text-[var(--text-hi)] shadow-[0_0_24px_-12px_var(--accent-glow)]'
                  : 'text-[var(--text-low)] hover:text-[var(--text-med)]',
              )}
            >
              <span className="mr-1.5 opacity-70">{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
