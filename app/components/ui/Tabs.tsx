'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl p-1',
        'bg-[var(--bg-elev1)] border border-[var(--border-subtle)]',
        'ring-inset-soft',
        className,
      )}
      {...rest}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-focus-no-outline
      className={cn(
        'relative inline-flex items-center justify-center gap-1.5',
        'h-9 px-4 rounded-lg text-sm font-medium',
        'text-[var(--text-med)]',
        'transition-[color,background] duration-200 [transition-timing-function:var(--ease-out)]',
        'hover:text-[var(--text-hi)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent-from)] focus-visible:ring-offset-0',
        // Active state — accent gradient text + subtle background
        'data-[state=active]:bg-[var(--bg-elev2)]',
        'data-[state=active]:text-[var(--text-hi)]',
        'data-[state=active]:shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_8%,transparent),0_2px_8px_-2px_var(--accent-glow)]',
        'disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
      {...rest}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-focus-no-outline
      className={cn(
        'mt-4 outline-none',
        'data-[state=active]:animate-fade-in',
        className,
      )}
      {...rest}
    />
  );
});
