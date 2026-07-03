'use client';

import { useMemo, type SVGAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SpectrumProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  /** Number of bars to render. */
  bars?: number;
  /** Animate bar heights (looping). */
  animated?: boolean;
  /** Deterministic seed so SSR ↔ client render matches. */
  seed?: number;
  /** Height of the spectrum container in px (only affects intrinsic ratio). */
  height?: number;
  /** Width of the spectrum container in px (only affects intrinsic ratio). */
  width?: number;
  /** Bar rounded-cap radius. */
  cornerRadius?: number;
  /**
   * Controlled mode: per-bar levels in 0..1 (e.g. live AnalyserNode data via
   * `LiveSpectrum`). When set, SMIL animation is bypassed and bar heights
   * track the array directly. Extra bars beyond `levels.length` render at a
   * resting height.
   */
  levels?: number[];
}

/**
 * Equalizer SVG.
 *
 * Two modes:
 *  - Decorative (default): deterministic pseudo-random bars per `seed`,
 *    optionally looping via `<animate>` SMIL (no JS, no Framer).
 *  - Controlled: pass `levels` (0..1 per bar) to drive heights from real
 *    audio — see `app/components/LiveSpectrum.tsx`.
 *
 * Always uses the current mood accent gradient.
 */
export function Spectrum({
  bars = 48,
  animated = true,
  seed = 7,
  height = 80,
  width = 320,
  cornerRadius = 2,
  levels,
  className,
  ...rest
}: SpectrumProps) {
  const gradientId = useMemo(() => `spectrum-grad-${seed}`, [seed]);

  // Deterministic pseudo-random bar heights.
  const bardata = useMemo(() => {
    const arr: { h: number; phase: number }[] = [];
    let s = seed * 9301 + 49297;
    for (let i = 0; i < bars; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r1 = s / 233280;
      s = (s * 9301 + 49297) % 233280;
      const r2 = s / 233280;
      // Bias toward a centered "wave" so it reads as a spectrum, not noise.
      const center = Math.sin((i / bars) * Math.PI);
      const h = 0.22 + center * 0.55 + r1 * 0.22;
      arr.push({ h: Math.min(0.98, h), phase: r2 });
    }
    return arr;
  }, [bars, seed]);

  const gap = 2;
  const barWidth = (width - gap * (bars - 1)) / bars;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      role="presentation"
      className={cn('block select-none', className)}
      {...rest}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-from)" />
          <stop offset="100%" stopColor="var(--accent-to)" />
        </linearGradient>
      </defs>

      {bardata.map((b, i) => {
        const x = i * (barWidth + gap);

        // Controlled mode: heights track the provided levels directly.
        if (levels) {
          const level = Math.min(1, Math.max(0, levels[i] ?? 0.04));
          const h = Math.max(2, level * height);
          return (
            <rect
              key={i}
              x={x}
              y={height - h}
              width={barWidth}
              height={h}
              rx={cornerRadius}
              fill={`url(#${gradientId})`}
            />
          );
        }

        const baseH = b.h * height;
        const y = height - baseH;

        if (!animated) {
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={baseH}
              rx={cornerRadius}
              fill={`url(#${gradientId})`}
            />
          );
        }

        // Loop between 60%, 100%, 75% of the base height, offset per-bar.
        const h1 = baseH * 0.6;
        const h2 = baseH;
        const h3 = baseH * 0.75;
        const dur = 1.6 + b.phase * 1.4; // 1.6s – 3.0s
        const begin = `${-(b.phase * dur).toFixed(2)}s`;

        return (
          <rect
            key={i}
            x={x}
            width={barWidth}
            rx={cornerRadius}
            fill={`url(#${gradientId})`}
          >
            <animate
              attributeName="height"
              values={`${h1};${h2};${h3};${h1}`}
              dur={`${dur}s`}
              begin={begin}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.16 1 0.3 1; 0.16 1 0.3 1; 0.16 1 0.3 1"
            />
            <animate
              attributeName="y"
              values={`${height - h1};${height - h2};${height - h3};${height - h1}`}
              dur={`${dur}s`}
              begin={begin}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.16 1 0.3 1; 0.16 1 0.3 1; 0.16 1 0.3 1"
            />
          </rect>
        );
      })}
    </svg>
  );
}
