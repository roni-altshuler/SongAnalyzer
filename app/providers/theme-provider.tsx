'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function savedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') return savedTheme() ?? systemTheme();
    return 'dark';
  });
  const choice = useRef<Theme | null>(null);

  useEffect(() => {
    choice.current = savedTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (choice.current !== null) return;
      const next = media.matches ? 'dark' : 'light';
      applyThemeClass(next);
      setTheme(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== 'theme') return;
      try { if (event.storageArea !== window.localStorage) return; } catch { return; }
      choice.current = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
      const next = choice.current ?? systemTheme();
      applyThemeClass(next);
      setTheme(next);
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    // Reconcile both saved and system preferences after hydration/recovery.
    // The OS may change between the head script and listener registration.
    const current = choice.current ?? (media.matches ? 'dark' : 'light');
    applyThemeClass(current);
    onSystemChange();
    return () => {
      media.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    choice.current = next;
    // A blocked store keeps the choice usable for this visit.
    try { window.localStorage.setItem('theme', next); } catch {}
    applyThemeClass(next);
    setTheme(next);
  };

  // Always provide the context, but handle SSR gracefully
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
