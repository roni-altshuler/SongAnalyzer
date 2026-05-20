import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Skeleton shape preset. `text` is a thin line, `rect` is a block, `circle` is square + rounded-full. */
  shape?: 'rect' | 'text' | 'circle';
}

/**
 * Animated shimmer skeleton.
 *
 * Uses a CSS linear-gradient sweep (defined in `globals.css` as `.animate-shimmer`)
 * rather than a flat opacity pulse — feels closer to a Spotify/Apple Music loading
 * state. Respects `prefers-reduced-motion`.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { shape = 'rect', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'animate-shimmer',
        shape === 'rect' && 'rounded-lg h-4 w-full',
        shape === 'text' && 'rounded-md h-3 w-3/4',
        shape === 'circle' && 'rounded-full aspect-square h-10 w-10',
        className,
      )}
      {...rest}
    />
  );
});
