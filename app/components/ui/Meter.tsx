'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Value between 0 and 1 (clamped). */
  value: number;
  /** Optional label rendered above the track. */
  label?: string;
  /** Optional trailing value text (e.g. "82%"). */
  valueLabel?: string;
  /** Track height. */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label when no visible label is provided. */
  ariaLabel?: string;
  /** Use a flat single-tone fill instead of the accent gradient. */
  tone?: 'accent' | 'success' | 'warn' | 'error' | 'neutral';
}

const HEIGHTS = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
} as const;

const TONES = {
  accent: 'bg-[linear-gradient(90deg,var(--accent-from),var(--accent-to))]',
  success: 'bg-[var(--state-success)]',
  warn: 'bg-[var(--state-warn)]',
  error: 'bg-[var(--state-error)]',
  neutral: 'bg-[var(--text-low)]',
} as const;

export const Meter = forwardRef<HTMLDivElement, MeterProps>(function Meter(
  {
    value,
    label,
    valueLabel,
    size = 'md',
    ariaLabel,
    tone = 'accent',
    className,
    ...rest
  },
  ref,
) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const pct = Math.round(clamped * 100);

  return (
    <div ref={ref} className={cn('w-full', className)} {...rest}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <span className="text-xs font-medium text-[var(--text-med)] uppercase tracking-wide">
              {label}
            </span>
          )}
          {valueLabel && (
            <span className="text-xs font-mono text-[var(--text-low)] tabular-nums">
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? label}
        className={cn(
          'relative w-full overflow-hidden rounded-full',
          'bg-[var(--bg-elev2)]',
          'border border-[var(--border-subtle)]',
          HEIGHTS[size],
        )}
      >
        <LazyMotion features={domAnimation}>
          <m.div
            className={cn('absolute inset-y-0 left-0 rounded-full', TONES[tone])}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </LazyMotion>
      </div>
    </div>
  );
});
