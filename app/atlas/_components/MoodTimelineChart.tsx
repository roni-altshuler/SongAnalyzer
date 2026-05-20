'use client';

/**
 * Stacked Recharts AreaChart of an artist's mood distribution over time.
 * X axis = release year. One Area per mood encountered in the data.
 *
 * Each area's fill is the canonical mood palette gradient from
 * `moodToColor`, so timelines stay visually consistent with mood badges
 * across the rest of the app.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { moodToColor } from '@/lib/analysis/palette';

export interface MoodTimelinePoint {
  period: number;
  moods: Record<string, number>;
}

export interface MoodTimelineChartProps {
  data: MoodTimelinePoint[];
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

export function MoodTimelineChart({
  data,
  height = 320,
}: MoodTimelineChartProps) {
  const reduced = useReducedMotion();

  // Discover every mood that appears anywhere in the timeline, ordered by
  // total frequency so the busiest areas render at the bottom of the stack
  // (where overplotting is most legible).
  const { moods, flat } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of data) {
      for (const [mood, count] of Object.entries(point.moods)) {
        totals.set(mood, (totals.get(mood) ?? 0) + count);
      }
    }
    const sortedMoods = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([mood]) => mood);

    // Flatten to Recharts' expected shape: { period, <mood-A>: n, <mood-B>: n }.
    const flatData = data.map((point) => {
      const row: Record<string, number> = { period: point.period };
      for (const mood of sortedMoods) {
        row[mood] = point.moods[mood] ?? 0;
      }
      return row;
    });

    return { moods: sortedMoods, flat: flatData };
  }, [data]);

  if (data.length === 0 || moods.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-[var(--text-low)]">
        Not enough discography data to plot a timeline.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={flat} margin={{ top: 12, right: 24, bottom: 8, left: -12 }}>
        <defs>
          {moods.map((mood) => {
            const color = moodToColor(mood);
            const gradientId = `atlas-mood-${mood.replace(/[^a-zA-Z0-9]/g, '')}`;
            return (
              <linearGradient
                key={gradientId}
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color.from} stopOpacity={0.85} />
                <stop offset="100%" stopColor={color.to} stopOpacity={0.25} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="period"
          type="number"
          domain={['dataMin', 'dataMax']}
          tick={{ fill: 'var(--text-med)', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          allowDecimals={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-low)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-elev2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            color: 'var(--text-hi)',
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--text-med)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--text-med)' }}
          iconType="circle"
        />
        {moods.map((mood) => {
          const gradientId = `atlas-mood-${mood.replace(/[^a-zA-Z0-9]/g, '')}`;
          const color = moodToColor(mood);
          return (
            <Area
              key={mood}
              type="monotone"
              dataKey={mood}
              stackId="1"
              stroke={color.from}
              fill={`url(#${gradientId})`}
              strokeWidth={1.5}
              isAnimationActive={!reduced}
              animationDuration={500}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
