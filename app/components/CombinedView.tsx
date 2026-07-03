'use client';

import type { AnalysisResult, AudioAnalysisResult, AudioAnalysisResultV2 } from '@/lib/types';
import { agreementBreakdown, lyricsAffect } from '@/lib/analysis/affect';
import { MOOD_COORDS, type AffectPoint } from '@/lib/audio/mood-map';
import { Card, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Meter } from '@/app/components/ui/Meter';
import { cn } from '@/lib/cn';

interface CombinedViewProps {
  lyricsAnalysis: AnalysisResult;
  audioAnalysis: AudioAnalysisResult | AudioAnalysisResultV2;
  className?: string;
}

/**
 * Levenshtein distance — kept only for backwards compatibility with existing
 * tests/imports.
 *
 * @deprecated The rendered agreement is now a distance in valence/arousal
 * space (`lib/analysis/affect.ts`), not string edit distance. "Euphoric" vs
 * "Uplifting" used to score ~27% here despite being adjacent feelings.
 */
export function moodAgreement(a: string, b: string): number {
  const ax = a.trim().toLowerCase();
  const bx = b.trim().toLowerCase();
  if (!ax && !bx) return 1;
  const maxLen = Math.max(ax.length, bx.length, 1);
  return Math.max(0, 1 - levenshtein(ax, bx) / maxLen);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const n = b.length;
  const prev: number[] = new Array(n + 1);
  const curr: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Project an audio analysis onto the circumplex plane. */
function audioAffectPoint(analysis: AudioAnalysisResult | AudioAnalysisResultV2): AffectPoint {
  if ('v2' in analysis && analysis.v2) {
    return { valence: analysis.v2.valence, arousal: analysis.v2.arousal };
  }
  return MOOD_COORDS[analysis.mood] ?? { valence: 0, arousal: 0 };
}

/** Tiny SVG circumplex plot: two dots + connecting line, accent-tinted. */
function AffectPlane({ lyrics, audio }: { lyrics: AffectPoint; audio: AffectPoint }) {
  const size = 180;
  const pad = 14;
  const px = (v: number) => pad + ((v + 1) / 2) * (size - pad * 2);
  const py = (a: number) => size - pad - ((a + 1) / 2) * (size - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto block h-44 w-44"
      role="img"
      aria-label={`Emotion map: lyrics at valence ${lyrics.valence}, arousal ${lyrics.arousal}; audio at valence ${audio.valence}, arousal ${audio.arousal}`}
    >
      {/* Quadrant grid */}
      <rect
        x={pad}
        y={pad}
        width={size - pad * 2}
        height={size - pad * 2}
        rx={10}
        fill="var(--bg-elev2)"
        stroke="var(--border-subtle)"
      />
      <line x1={size / 2} y1={pad} x2={size / 2} y2={size - pad} stroke="var(--border-subtle)" />
      <line x1={pad} y1={size / 2} x2={size - pad} y2={size / 2} stroke="var(--border-subtle)" />

      {/* Axis labels */}
      <text x={size - pad} y={size / 2 - 5} textAnchor="end" fontSize="7" fill="var(--text-low)">
        positive →
      </text>
      <text x={pad + 2} y={size / 2 - 5} fontSize="7" fill="var(--text-low)">
        ← negative
      </text>
      <text x={size / 2 + 4} y={pad + 9} fontSize="7" fill="var(--text-low)">
        energetic
      </text>
      <text x={size / 2 + 4} y={size - pad - 4} fontSize="7" fill="var(--text-low)">
        calm
      </text>

      {/* Connection */}
      <line
        x1={px(lyrics.valence)}
        y1={py(lyrics.arousal)}
        x2={px(audio.valence)}
        y2={py(audio.arousal)}
        stroke="var(--accent-glow)"
        strokeDasharray="3 3"
      />

      {/* Dots */}
      <circle cx={px(lyrics.valence)} cy={py(lyrics.arousal)} r={6} fill="var(--accent-from)" />
      <text
        x={px(lyrics.valence)}
        y={py(lyrics.arousal) + 2.5}
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill="var(--bg-base)"
      >
        L
      </text>
      <circle cx={px(audio.valence)} cy={py(audio.arousal)} r={6} fill="var(--accent-to)" />
      <text
        x={px(audio.valence)}
        y={py(audio.arousal) + 2.5}
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill="var(--bg-base)"
      >
        A
      </text>
    </svg>
  );
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
 * Side-by-side lyrics vs. audio comparison for a single song.
 *
 * The agreement score projects both engines onto the shared valence/arousal
 * plane and measures the distance — surfacing the classic "happy melody,
 * sad lyrics" tension as geometry instead of string similarity.
 */
export default function CombinedView({
  lyricsAnalysis,
  audioAnalysis,
  className,
}: CombinedViewProps) {
  const lyricsPoint = lyricsAffect(lyricsAnalysis);
  const audioPoint = audioAffectPoint(audioAnalysis);
  const breakdown = agreementBreakdown(lyricsPoint, audioPoint);
  const pct = Math.round(breakdown.agreement * 100);

  return (
    <Card variant="glow" className={cn('space-y-5', className)}>
      <CardHeader>
        <CardTitle>Combined view</CardTitle>
        <Badge variant="mood">Lyrics × Audio</Badge>
      </CardHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
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

        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
            Emotion map
          </p>
          <AffectPlane lyrics={lyricsPoint} audio={audioPoint} />
          <div className="flex items-center gap-4 text-[10px] text-[var(--text-low)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent-from)' }} />
              Lyrics
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent-to)' }} />
              Audio
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
        <div className="flex items-baseline justify-between text-xs text-[var(--text-low)] uppercase tracking-[0.18em]">
          <span>Agreement</span>
          <span className="font-mono text-[var(--text-med)]">{pct}%</span>
        </div>
        <Meter value={breakdown.agreement} ariaLabel="Lyrics vs audio agreement" />
        <p className="text-xs text-[var(--text-low)]">{breakdown.summary}</p>
      </div>
    </Card>
  );
}
