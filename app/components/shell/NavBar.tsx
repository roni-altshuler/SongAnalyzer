'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/app/components/ThemeToggle';
import { Spectrum } from '@/app/components/ui/Spectrum';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/identify', label: 'Identify' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/discover', label: 'Discover' },
  { href: '/atlas', label: 'Atlas' },
] as const;

/**
 * The app shell's persistent top navigation — glass bar over the mood
 * backdrop. Active section is derived from the pathname; the mood-accent
 * vars tint the active link and the logo mark like every other primitive.
 */
export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-[var(--border-subtle)]',
        'backdrop-blur-xl',
        'bg-[color-mix(in_oklab,var(--bg-base)_82%,transparent)]',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-4 rounded-sm"
          onClick={() => setOpen(false)}
        >
          <span className="h-6 w-8" aria-hidden>
            <Spectrum bars={6} seed={3} className="h-full w-full opacity-90" />
          </span>
          <span className="font-display text-lg tracking-tight text-[var(--text-hi)]">
            Song<span className="text-accent-gradient">Analyzer</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'relative rounded-lg px-3.5 py-2 text-sm tracking-wide transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
                isActive(link.href)
                  ? 'text-[var(--text-hi)]'
                  : 'text-[var(--text-med)] hover:text-[var(--text-hi)]',
              )}
            >
              {link.label}
              {isActive(link.href) && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-[13px] h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, var(--accent-from), var(--accent-to), transparent)',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }}
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-xl md:hidden',
              'border border-[var(--border-subtle)] bg-[var(--bg-elev1)] ring-inset-soft',
              'text-[var(--text-med)] hover:text-[var(--text-hi)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
            )}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <line x1="4" x2="20" y1="7" y2="7" />
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="17" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav
          aria-label="Primary mobile"
          className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'block rounded-lg px-3 py-2.5 text-sm',
                    isActive(link.href)
                      ? 'bg-[var(--bg-elev1)] text-[var(--text-hi)]'
                      : 'text-[var(--text-med)] hover:bg-[var(--bg-elev1)] hover:text-[var(--text-hi)]',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
