'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';
import type { ComponentProps } from 'react';

export { toast };

/**
 * Theme-matched Sonner Toaster.
 *
 * Mount once at the application root. Forwards all Sonner props; the design-
 * system tokens are applied via `toastOptions.classNames` so toasts inherit
 * the music-streaming dark surfaces and accent ring.
 */
export function Toaster(props: ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      theme="dark"
      richColors={false}
      closeButton
      position="bottom-right"
      offset={16}
      {...props}
      toastOptions={{
        ...props.toastOptions,
        unstyled: false,
        classNames: {
          toast:
            'group !bg-[var(--bg-elev2)] !text-[var(--text-hi)] !border !border-[var(--border-strong)] ' +
            'shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md rounded-xl ' +
            'ring-inset-soft',
          title: 'font-medium text-sm text-[var(--text-hi)]',
          description: 'text-xs text-[var(--text-med)]',
          actionButton:
            '!bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] !text-white !rounded-lg',
          cancelButton:
            '!bg-[var(--bg-elev3)] !text-[var(--text-med)] !border !border-[var(--border-subtle)] !rounded-lg',
          closeButton:
            '!bg-[var(--bg-elev3)] !text-[var(--text-med)] !border-[var(--border-subtle)]',
          success: '!text-[var(--state-success)]',
          error: '!text-[var(--state-error)]',
          warning: '!text-[var(--state-warn)]',
          ...props.toastOptions?.classNames,
        },
      }}
    />
  );
}
