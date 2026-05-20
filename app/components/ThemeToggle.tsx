'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '../providers/theme-provider';
import { cn } from '@/lib/cn';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const base = cn(
    'inline-flex items-center justify-center h-10 w-10 rounded-xl',
    'bg-[var(--bg-elev1)] border border-[var(--border-subtle)] ring-inset-soft',
    'text-[var(--text-med)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-elev2)]',
    'hover:border-[var(--border-strong)]',
    'transition-[background,border-color,color] duration-200',
    '[transition-timing-function:var(--ease-out)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
  );

  if (!mounted) {
    return <div className={cn(base, 'pointer-events-none opacity-50')} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={base}
      aria-label="Toggle color theme"
      title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
    >
      {theme === 'light' ? (
        // Moon — currently light, click for dark
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — currently dark, click for light
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
