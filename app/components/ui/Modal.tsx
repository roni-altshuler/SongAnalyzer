'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;
export const ModalPortal = DialogPrimitive.Portal;

export const ModalOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function ModalOverlay({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50',
        'bg-black/70 backdrop-blur-md',
        'data-[state=open]:animate-fade-in',
        'data-[state=closed]:opacity-0 data-[state=closed]:transition-opacity data-[state=closed]:duration-200',
        className,
      )}
      {...rest}
    />
  );
});

export const ModalContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Show a top-right close button (default `true`). */
    showClose?: boolean;
  }
>(function ModalContent({ className, children, showClose = true, ...rest }, ref) {
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-focus-no-outline
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[min(92vw,520px)] max-h-[85vh] overflow-auto',
          'rounded-2xl p-6',
          'bg-[var(--bg-elev1)] border border-[var(--border-strong)]',
          'ring-inset-soft',
          'shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_40px_var(--accent-glow)]',
          'data-[state=open]:animate-slide-up',
          'focus:outline-none',
          className,
        )}
        {...rest}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className={cn(
              'absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg',
              'text-[var(--text-med)] hover:text-[var(--text-hi)]',
              'hover:bg-[var(--bg-elev2)] transition-colors',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
            )}
          >
            <X size={16} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  );
});

export function ModalHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4 pr-8 space-y-1', className)}>{children}</div>;
}

export const ModalTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function ModalTitle({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('font-display text-2xl leading-tight text-[var(--text-hi)]', className)}
      {...rest}
    />
  );
});

export const ModalDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function ModalDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-[var(--text-med)] leading-relaxed', className)}
      {...rest}
    />
  );
});

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-2', className)}>{children}</div>
  );
}
