'use client';

/**
 * Recharts BarChart rendering mood-count slices tinted with the canonical
 * mood palette via `moodToColor`. Client-only because Recharts ships with
 * ResizeObserver bindings.
 */

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { moodToColor } from '@/lib/analysis/palette';

export interface MoodDistributionDatum {
  mood: string;
  count: number;
}

export interface MoodDistributionChartProps {
  data: MoodDistributionDatum[];
  /** Override height. Defaults to 280. */
  height?: number;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return reduced;
}

export function MoodDistributionChart({
  data,
  height = 280,
}: MoodDistributionChartProps) {
  const reduced = useReducedMotion();

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-[var(--text-low)]">
        No mood data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 12, bottom: 8, left: -12 }}
        barCategoryGap={'18%'}
      >
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="mood"
          tick={{ fill: 'var(--text-med)', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          interval={0}
        />
        <YAxis
          tick={{ fill: 'var(--text-low)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: 'var(--bg-elev2)', opacity: 0.4 }}
          contentStyle={{
            background: 'var(--bg-elev2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            color: 'var(--text-hi)',
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--text-med)' }}
          formatter={(value: unknown) => [String(value), 'analyses']}
        />
        <Bar
          dataKey="count"
          radius={[6, 6, 2, 2]}
          isAnimationActive={!reduced}
          animationDuration={420}
        >
          {data.map((entry) => {
            const color = moodToColor(entry.mood);
            return <Cell key={entry.mood} fill={color.from} stroke={color.to} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
