'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface MoodColor {
  /** Gradient start (CSS color). */
  from: string;
  /** Gradient end (CSS color). */
  to: string;
  /** Optional translucent halo colour. If omitted we derive a 35% alpha tint of `from`. */
  glow?: string;
}

interface MoodThemeContextValue {
  color: MoodColor;
  /** Set the current mood accent. Writes `--accent-from`, `--accent-to`, `--accent-glow` to `<html>`. */
  setMoodColor: (next: MoodColor) => void;
  /** Reset to the default electric blue → violet fallback. */
  resetMoodColor: () => void;
}

/** Default fallback gradient (electric blue → violet). */
const DEFAULT_COLOR: MoodColor = {
  from: '#3B82F6',
  to: '#8B5CF6',
  glow: 'rgba(99, 102, 241, 0.35)',
};

const MoodThemeContext = createContext<MoodThemeContextValue | undefined>(undefined);

/**
 * Convert a hex (or `rgb()` / `rgba()` / named) colour into an rgba string
 * with the requested alpha. Falls back to `rgba(99, 102, 241, alpha)` if
 * we can't parse the input.
 */
function withAlpha(input: string, alpha: number): string {
  const hex = input.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const v =
      h.length === 3
        ? h.split('').map((c) => c + c).join('')
        : h.length === 6
          ? h
          : null;
    if (v) {
      const r = parseInt(v.slice(0, 2), 16);
      const g = parseInt(v.slice(2, 4), 16);
      const b = parseInt(v.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgbMatch = hex.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }
  return `rgba(99, 102, 241, ${alpha})`;
}

function applyToDocument(color: MoodColor) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const glow = color.glow ?? withAlpha(color.from, 0.35);
  root.style.setProperty('--accent-from', color.from);
  root.style.setProperty('--accent-to', color.to);
  root.style.setProperty('--accent-glow', glow);
}

export function MoodThemeProvider({
  children,
  initialColor,
}: {
  children: ReactNode;
  initialColor?: MoodColor;
}) {
  const [color, setColor] = useState<MoodColor>(initialColor ?? DEFAULT_COLOR);

  const setMoodColor = useCallback((next: MoodColor) => {
    setColor(next);
    applyToDocument(next);
  }, []);

  const resetMoodColor = useCallback(() => {
    setColor(DEFAULT_COLOR);
    applyToDocument(DEFAULT_COLOR);
  }, []);

  const value = useMemo<MoodThemeContextValue>(
    () => ({ color, setMoodColor, resetMoodColor }),
    [color, setMoodColor, resetMoodColor],
  );

  return <MoodThemeContext.Provider value={value}>{children}</MoodThemeContext.Provider>;
}

export function useMoodTheme(): MoodThemeContextValue {
  const ctx = useContext(MoodThemeContext);
  if (!ctx) {
    throw new Error('useMoodTheme must be used inside <MoodThemeProvider>');
  }
  return ctx;
}

export { DEFAULT_COLOR as DEFAULT_MOOD_COLOR };
