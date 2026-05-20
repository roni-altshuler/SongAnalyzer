import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'mood' | 'outline' | 'success' | 'warn' | 'error';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-elev2)] text-[var(--text-med)] border border-[var(--border-subtle)]',
  // Mood: tinted with the current accent gradient
  mood:
    'border ' +
    'text-[var(--accent-from)] ' +
    'bg-[color-mix(in_oklab,var(--accent-from)_12%,transparent)] ' +
    'border-[color-mix(in_oklab,var(--accent-from)_30%,transparent)]',
  outline: 'bg-transparent text-[var(--text-med)] border border-[var(--border-strong)]',
  success:
    'bg-[color-mix(in_oklab,var(--state-success)_14%,transparent)] ' +
    'text-[var(--state-success)] border border-[color-mix(in_oklab,var(--state-success)_30%,transparent)]',
  warn:
    'bg-[color-mix(in_oklab,var(--state-warn)_14%,transparent)] ' +
    'text-[var(--state-warn)] border border-[color-mix(in_oklab,var(--state-warn)_30%,transparent)]',
  error:
    'bg-[color-mix(in_oklab,var(--state-error)_14%,transparent)] ' +
    'text-[var(--state-error)] border border-[color-mix(in_oklab,var(--state-error)_30%,transparent)]',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'default', className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full',
        'px-2.5 py-0.5 text-xs font-medium',
        'tracking-wide',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});
