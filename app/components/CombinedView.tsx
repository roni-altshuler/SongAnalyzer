'use client';

import type { AnalysisResult, AudioAnalysisResult } from '@/lib/types';
import { Card, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Meter } from '@/app/components/ui/Meter';
import { cn } from '@/lib/cn';

interface CombinedViewProps {
  lyricsAnalysis: AnalysisResult;
  audioAnalysis: AudioAnalysisResult;
  className?: string;
}

/**
 * Levenshtein distance — small, no-dep, sufficient for short mood strings.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  // Roll a single previous row; space O(min(m, n)).
  const prev: number[] = new Array(n + 1);
  const curr: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost, // substitute
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * 0..1 agreement score between two short labels (e.g. mood strings).
 * 1 = identical; 0 = maximally divergent. We compare lowercased trimmed
 * strings and normalize by the longer length.
 */
export function moodAgreement(a: string, b: string): number {
  const ax = a.trim().toLowerCase();
  const bx = b.trim().toLowerCase();
  if (!ax && !bx) return 1;
  const maxLen = Math.max(ax.length, bx.length, 1);
  const dist = levenshtein(ax, bx);
  return Math.max(0, 1 - dist / maxLen);
}

function SubCard({
  title,
  badge,
  rows,
}: {
  title: string;
  badge: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <Card variant="elev2" className="space-y-3">
      <CardHeader className="mb-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))]"
            style={{ boxShadow: '0 0 10px var(--accent-glow)' }}
          />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <Badge variant="outline">{badge}</Badge>
      </CardHeader>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elev1)] px-3 py-2"
          >
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-low)] mb-1">
              {row.label}
            </dt>
            <dd className="font-display text-base text-[var(--text-hi)]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Side-by-side lyrics vs. audio comparison for a single song, with an
 * Agreement Meter between the two sub-cards.
 */
export default function CombinedView({
  lyricsAnalysis,
  audioAnalysis,
  className,
}: CombinedViewProps) {
  const agreement = moodAgreement(lyricsAnalysis.mood, audioAnalysis.mood);
  const pct = Math.round(agreement * 100);

  return (
    <Card variant="glow" className={cn('space-y-5', className)}>
      <CardHeader>
        <CardTitle>Combined view</CardTitle>
        <Badge variant="mood">Lyrics × Audio</Badge>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-1">
        <SubCard
          title="Lyrics"
          badge="text engine"
          rows={[
            { label: 'Mood', value: lyricsAnalysis.mood },
            { label: 'Vibe', value: lyricsAnalysis.vibe },
            { label: 'Energy', value: lyricsAnalysis.energy },
            { label: 'Sentiment', value: lyricsAnalysis.sentiment },
          ]}
        />

        <SubCard
          title="Audio"
          badge="signal engine"
          rows={[
            { label: 'Mood', value: audioAnalysis.mood },
            { label: 'Vibe', value: audioAnalysis.vibe },
            { label: 'Energy', value: audioAnalysis.energy },
            { label: 'Sentiment', value: audioAnalysis.sentiment },
          ]}
        />
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
        <div className="flex items-baseline justify-between text-xs text-[var(--text-low)] uppercase tracking-[0.18em]">
          <span>Agreement</span>
          <span className="font-mono text-[var(--text-med)]">{pct}%</span>
        </div>
        <Meter value={agreement} ariaLabel="Lyrics vs audio agreement" />
        <p className="text-xs text-[var(--text-low)]">
          {agreement >= 0.9
            ? 'Lyrics and audio agree closely — the song reads the same way it sounds.'
            : agreement >= 0.5
              ? 'Partial agreement — lyrics and audio describe a related but distinct mood.'
              : 'Diverging signals — the words and the sound point to different moods.'}
        </p>
      </div>
    </Card>
  );
}
