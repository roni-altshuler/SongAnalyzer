'use client';

/**
 * v2 redesign of MoodRadar — same data contract as v1 (lib/components/MoodRadar.tsx),
 * but rendered with the music-streaming dark design system:
 *
 *   - <defs> radialGradient polygon fill driven by --accent-from/--accent-to
 *   - <feGaussianBlur> glow filter on the data polygon
 *   - Framer motion.polygon animating in from a collapsed centroid
 *   - Honors `prefers-reduced-motion`
 *
 * v1 lives untouched in MoodRadar.tsx so callers can opt in to v2.
 */

import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface MoodRadarV2Props {
  energy: string;
  sentiment: string;
  mood: string;
  vibe: string;
  themes: string[];
  className?: string;
}

function energyScore(energy: string): number {
  const map: Record<string, number> = {
    'Very High': 1,
    High: 0.8,
    Moderate: 0.55,
    Low: 0.3,
    'Very Low': 0.1,
  };
  return map[energy] ?? 0.5;
}

function sentimentScore(sentiment: string): number {
  const map: Record<string, number> = {
    'Very Positive': 1,
    Positive: 0.75,
    'Neutral/Mixed': 0.5,
    Negative: 0.25,
    'Very Negative': 0.05,
  };
  return map[sentiment] ?? 0.5;
}

function intensityScore(vibe: string): number {
  const intense = ['High-Energy', 'Intense', 'Edgy', 'Empowering'];
  const calm = ['Mellow', 'Laid-back', 'Tranquil', 'Dreamy'];
  if (intense.includes(vibe)) return 0.85;
  if (calm.includes(vibe)) return 0.2;
  return 0.5;
}

function complexityScore(themes: string[]): number {
  return Math.min(themes.length / 5, 1);
}

function emotionalityScore(mood: string): number {
  const highEmo = ['Euphoric', 'Sorrowful', 'Aggressive', 'Romantic', 'Melancholic'];
  const lowEmo = ['Contemplative', 'Peaceful', 'Uplifting'];
  if (highEmo.includes(mood)) return 0.9;
  if (lowEmo.includes(mood)) return 0.35;
  return 0.55;
}

const LABELS = ['Energy', 'Positivity', 'Intensity', 'Complexity', 'Emotion'] as const;
const AXIS_COUNT = LABELS.length;

function polarToXY(angle: number, radius: number, cx: number, cy: number) {
  const a = angle - Math.PI / 2;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

export default function MoodRadarV2({
  energy,
  sentiment,
  mood,
  vibe,
  themes,
  className,
}: MoodRadarV2Props) {
  const gradientId = useId();
  const blurId = useId();
  const prefersReducedMotion = useReducedMotion();

  const cx = 100;
  const cy = 100;
  const maxR = 75;
  const step = (2 * Math.PI) / AXIS_COUNT;

  const scores = [
    energyScore(energy),
    sentimentScore(sentiment),
    intensityScore(vibe),
    complexityScore(themes),
    emotionalityScore(mood),
  ];

  const finalPoints = scores
    .map((s, i) => {
      const { x, y } = polarToXY(i * step, s * maxR, cx, cy);
      return `${x},${y}`;
    })
    .join(' ');

  const collapsedPoints = scores.map(() => `${cx},${cy}`).join(' ');

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className={cn('w-full', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-4">
        Mood dimensions
      </p>
      <svg viewBox="0 0 200 200" className="w-full max-w-[280px] mx-auto block">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="var(--accent-from)" stopOpacity="0.55" />
            <stop offset="65%" stopColor="var(--accent-to)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent-to)" stopOpacity="0.1" />
          </radialGradient>
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={Array.from({ length: AXIS_COUNT })
              .map((_, i) => {
                const { x, y } = polarToXY(i * step, r * maxR, cx, cy);
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines */}
        {LABELS.map((_, i) => {
          const { x, y } = polarToXY(i * step, maxR, cx, cy);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Animated data polygon */}
        <LazyMotion features={domAnimation}>
          <m.polygon
            initial={
              prefersReducedMotion
                ? { points: finalPoints }
                : { points: collapsedPoints, opacity: 0 }
            }
            animate={{ points: finalPoints, opacity: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.9,
              ease: [0.16, 1, 0.3, 1],
            }}
            fill={`url(#${gradientId})`}
            stroke="var(--accent-from)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            filter={`url(#${blurId})`}
          />
        </LazyMotion>

        {/* Data dots */}
        {scores.map((s, i) => {
          const { x, y } = polarToXY(i * step, s * maxR, cx, cy);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2.5"
              fill="var(--accent-from)"
              stroke="var(--bg-elev1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Labels */}
        {LABELS.map((label, i) => {
          const { x, y } = polarToXY(i * step, maxR + 16, cx, cy);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--text-low)]"
              style={{ font: '600 7px var(--font-sans, sans-serif)', letterSpacing: '0.06em' }}
            >
              {label.toUpperCase()}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
