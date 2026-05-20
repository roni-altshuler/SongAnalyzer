'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 select-none rounded-lg px-3 py-1.5 text-xs leading-none',
          'bg-[var(--bg-elev3)] text-[var(--text-hi)]',
          'border border-[var(--border-strong)] ring-inset-soft',
          'shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]',
          'data-[state=delayed-open]:animate-fade-in',
          'data-[state=closed]:opacity-0',
          className,
        )}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
});

/**
 * Convenience wrapper — common case of `<Tooltip content="...">{trigger}</Tooltip>`.
 * For full control, compose `TooltipRoot` + `TooltipTrigger` + `TooltipContent` directly.
 */
export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  /** Default `true` — wraps in a provider so single-use works without an ancestor. */
  asProvider?: boolean;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  asProvider = true,
}: TooltipProps) {
  const tooltip = (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );

  return asProvider ? <TooltipProvider>{tooltip}</TooltipProvider> : tooltip;
}
