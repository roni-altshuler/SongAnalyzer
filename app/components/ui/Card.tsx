'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'flat' | 'elev1' | 'elev2' | 'glow';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Add an interactive hover state (lift + accent border). */
  interactive?: boolean;
}

const VARIANTS: Record<CardVariant, string> = {
  flat: [
    'bg-transparent',
    'border border-[var(--border-subtle)]',
  ].join(' '),
  elev1: [
    'bg-[var(--bg-elev1)]',
    'border border-[var(--border-subtle)]',
    'ring-inset-soft',
  ].join(' '),
  elev2: [
    'bg-[var(--bg-elev2)]',
    'border border-[var(--border-strong)]',
    'ring-inset-soft',
    'shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]',
  ].join(' '),
  glow: [
    'bg-[var(--bg-elev1)]',
    'border border-[var(--border-subtle)]',
    'ring-inset-soft',
    'glow-accent',
  ].join(' '),
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'elev1', interactive, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl p-6',
        'transition-[transform,border-color,box-shadow] duration-300',
        '[transition-timing-function:var(--ease-out)]',
        VARIANTS[variant],
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))] hover:shadow-[0_0_30px_var(--accent-glow)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between gap-3 mb-4', className)}
        {...rest}
      />
    );
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...rest }, ref) {
    return (
      <h3
        ref={ref}
        className={cn(
          'font-display text-2xl leading-tight text-[var(--text-hi)]',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...rest }, ref) {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-[var(--text-med)] leading-relaxed', className)}
        {...rest}
      />
    );
  },
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('space-y-3', className)} {...rest} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'mt-4 pt-4 flex items-center justify-between border-t border-[var(--border-subtle)]',
          className,
        )}
        {...rest}
      />
    );
  },
);
