'use client';

import { Slot } from '@radix-ui/react-slot';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as the child element via Radix Slot (e.g. wrap an `<a>` from next/link). */
  asChild?: boolean;
  /** Optional leading icon. */
  leftIcon?: ReactNode;
  /** Optional trailing icon. */
  rightIcon?: ReactNode;
  /** Show a spinner and disable the button. */
  loading?: boolean;
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
};

const BASE =
  'relative inline-flex items-center justify-center font-medium select-none ' +
  'transition-[background,box-shadow,border-color,color] duration-200 ' +
  '[transition-timing-function:var(--ease-out)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: [
    'text-white border border-transparent',
    'bg-[linear-gradient(135deg,var(--accent-from)_0%,var(--accent-to)_100%)]',
    'shadow-[0_8px_24px_-8px_var(--accent-glow)]',
    'hover:shadow-[0_12px_32px_-8px_var(--accent-glow)]',
    // Subtle shine sweep on hover via ::after
    'after:absolute after:inset-0 after:rounded-[inherit] after:bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.18)_50%,transparent_70%)]',
    'after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-100',
    'after:pointer-events-none',
  ].join(' '),
  secondary: [
    'text-[var(--text-hi)] border border-[var(--border-strong)]',
    'bg-[var(--bg-elev2)] hover:bg-[var(--bg-elev3)]',
    'hover:border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))]',
  ].join(' '),
  ghost: [
    'text-[var(--text-med)] border border-transparent',
    'bg-transparent hover:bg-[var(--bg-elev2)] hover:text-[var(--text-hi)]',
  ].join(' '),
  icon: [
    'text-[var(--text-med)] border border-[var(--border-subtle)]',
    'bg-[var(--bg-elev1)] hover:bg-[var(--bg-elev2)] hover:text-[var(--text-hi)]',
    'hover:border-[var(--border-strong)]',
  ].join(' '),
};

function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  return (
    <svg
      className="animate-spin"
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    asChild,
    leftIcon,
    rightIcon,
    loading,
    disabled,
    className,
    children,
    type,
    ...rest
  },
  ref,
) {
  const isIconOnly = variant === 'icon';
  const sizeClasses = isIconOnly ? ICON_SIZES[size] : SIZES[size];

  const inner = (
    <>
      {loading ? <Spinner size={size} /> : leftIcon}
      {!isIconOnly && children}
      {isIconOnly && !loading && children}
      {rightIcon}
    </>
  );

  const merged = cn(BASE, sizeClasses, VARIANTS[variant], 'overflow-hidden', className);

  // When using `asChild`, we can't wrap the consumer's element with motion.button.
  // Slot's ref is typed as HTMLElement; cast safely so consumers passing in an
  // <a>, <Link>, or any HTMLElement-extending child still typecheck.
  if (asChild) {
    return (
      <Slot
        ref={ref as unknown as Ref<HTMLElement>}
        className={merged}
        {...rest}
      >
        {children as ReactElement}
      </Slot>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.button
        ref={ref}
        type={type ?? 'button'}
        className={merged}
        disabled={disabled || loading}
        whileTap={disabled || loading ? undefined : { scale: 0.97 }}
        whileHover={disabled || loading ? undefined : { scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        {...(rest as Record<string, unknown>)}
      >
        {inner}
      </m.button>
    </LazyMotion>
  );
});
