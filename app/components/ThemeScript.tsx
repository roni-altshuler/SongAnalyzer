'use client';

/** Synchronous before-paint theme initialization; inert on soft navigation. */
export default function ThemeScript() {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: `
        (function() {
          var saved = null;
          try { saved = localStorage.getItem('theme'); } catch (e) {}
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var useDark = saved === 'dark' || (saved !== 'light' && prefersDark);
          var root = document.documentElement;
          root.classList.toggle('dark', useDark);
          root.classList.toggle('light', !useDark);
        })();
      ` }}
    />
  );
}
