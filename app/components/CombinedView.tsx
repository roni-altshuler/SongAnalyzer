'use client';

import type { AnalysisResult, AudioAnalysisResult, AudioAnalysisResultV2 } from '@/lib/types';
import { agreementBreakdown } from '@/lib/analysis/affect';
import { audioComparisonProjection, lyricsComparisonProjection, describeEstimateDifference, type ComparisonProjection } from '@/lib/analysis/comparison';
import type { AffectPoint } from '@/lib/audio/mood-map';
import { Card, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Meter } from '@/app/components/ui/Meter';
import { cn } from '@/lib/cn';

interface CombinedViewProps {
  lyricsAnalysis: AnalysisResult;
  audioAnalysis: AudioAnalysisResult | AudioAnalysisResultV2;
  /** Session-only filename; does not establish a relationship to the text. */
  audioFileName?: string | null;
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

const coordinate = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;

const BASIS_LABELS: Record<ComparisonProjection['basis'], string> = {
  'emotion-scores': 'Emotion scores mapped',
  'mood-label': 'Mood label mapped',
  signal: 'Signal estimate',
  unavailable: 'Coordinates unavailable',
};

function projectionDescription(projection: ComparisonProjection, input: 'lyrics' | 'audio'): string {
  if (projection.basis === 'emotion-scores') return 'Available text-model emotion scores are mapped and weighted by their reported scores.';
  if (projection.basis === 'signal') return 'Audio coordinates are estimated from signal features across the analyzed recording. Choosing a listening window does not recalculate this point.';
  if (projection.basis === 'mood-label') return `The ${input} mood label is placed at a preset position. These coordinates are a label mapping.`;
  return `This ${input} reading has no supported coordinates for the comparison.`;
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
      aria-label={`Estimated emotion map: lyrics circle at valence ${coordinate(lyrics.valence)}, arousal ${coordinate(lyrics.arousal)}; audio diamond at valence ${coordinate(audio.valence)}, arousal ${coordinate(audio.arousal)}`}
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

      {/* Distinct shapes and contrasting outlines keep color supplementary. */}
      <circle cx={px(lyrics.valence)} cy={py(lyrics.arousal)} r={5} fill="var(--accent-from)" stroke="var(--text-hi)" strokeWidth={1.25} />
      <text
        x={px(lyrics.valence) - 9}
        y={py(lyrics.arousal) + 3}
        textAnchor="end"
        fontSize="9"
        fontWeight="bold"
        fill="var(--text-hi)"
      >
        L
      </text>
      <polygon points={`${px(audio.valence)},${py(audio.arousal) - 6} ${px(audio.valence) + 6},${py(audio.arousal)} ${px(audio.valence)},${py(audio.arousal) + 6} ${px(audio.valence) - 6},${py(audio.arousal)}`} fill="var(--accent-to)" stroke="var(--text-hi)" strokeWidth={1.25} />
      <text
        x={px(audio.valence) + 9}
        y={py(audio.arousal) + 3}
        textAnchor="start"
        fontSize="9"
        fontWeight="bold"
        fill="var(--text-hi)"
      >
        A
      </text>
    </svg>
  );
}

function SubCard({
  title,
  badge,
  source,
  context,
  rows,
}: {
  title: string;
  badge: string;
  source: string;
  context: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <Card variant="elev2" className="min-w-0 space-y-3 p-4" role="group" aria-label={`${title} comparison input`}>
      <CardHeader className="mb-2 flex-wrap">
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
      <div className="space-y-1">
        <p className="text-sm text-[var(--text-hi)] [overflow-wrap:anywhere]">{source}</p>
        <p className="text-xs text-[var(--text-med)]">{context}</p>
      </div>
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
 * Compare estimates from independently supplied lyrics and local audio.
 *
 * Only supported coordinates enter the shared valence/arousal plane. The
 * distance describes estimates, with input basis and limits beside the score.
 */
export default function CombinedView({
  lyricsAnalysis,
  audioAnalysis,
  audioFileName,
  className,
}: CombinedViewProps) {
  const lyrics = lyricsComparisonProjection(lyricsAnalysis);
  const audio = audioComparisonProjection(audioAnalysis);
  const breakdown = lyrics.point && audio.point ? agreementBreakdown(lyrics.point, audio.point) : null;
  const wordCount = Number.isInteger(lyricsAnalysis.wordCount) && lyricsAnalysis.wordCount > 0
    ? `${lyricsAnalysis.wordCount} analyzed ${lyricsAnalysis.wordCount === 1 ? 'word' : 'words'}` : 'Word count unavailable';
  const duration = Number.isFinite(audioAnalysis.duration) && audioAnalysis.duration >= 0
    ? `${audioAnalysis.duration.toFixed(1)}s analyzed` : 'Duration unavailable';
  const audioEngine = 'engineVersion' in audioAnalysis
    ? audioAnalysis.engineVersion === 'v2' ? 'Signal analysis (v2)' : 'DSP fallback' : 'Engine provenance unavailable';

  return (
    <Card variant="glow" className={cn('space-y-5', className)} role="region" aria-label="Lyrics and audio comparison">
      <CardHeader>
        <CardTitle>Combined view</CardTitle>
        <Badge variant="outline">Two readings</Badge>
      </CardHeader>

      <p className="text-sm text-[var(--text-med)] leading-relaxed">
        Compare the feeling estimated from your text with the character estimated from your recording.
        {' '}These inputs are chosen separately; SongAnalyzer does not verify they belong to the same song.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-4 md:grid-cols-2">
          <SubCard
            title="Lyrics"
            badge={BASIS_LABELS[lyrics.basis]}
            source={wordCount}
            context={lyricsAnalysis.translated ? 'Translated text reading' : 'Supplied text reading'}
            rows={[
              { label: 'Mood', value: lyricsAnalysis.mood },
              { label: 'Vibe', value: lyricsAnalysis.vibe },
              { label: 'Energy', value: lyricsAnalysis.energy },
              { label: 'Sentiment', value: lyricsAnalysis.sentiment },
            ]}
          />

          <SubCard
            title="Audio"
            badge={BASIS_LABELS[audio.basis]}
            source={audioFileName || 'Local recording'}
            context={`${duration} · ${audioEngine}`}
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
            Estimated emotion map
          </p>
          {lyrics.point && audio.point ? <AffectPlane lyrics={lyrics.point} audio={audio.point} /> : (
            <p className="px-2 text-center text-xs text-[var(--text-med)] leading-relaxed">The map needs supported coordinates from both readings.</p>
          )}
          <div className="flex items-center gap-4 text-[10px] text-[var(--text-low)]">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full border border-[var(--text-hi)]" style={{ background: 'var(--accent-from)' }} />
              Lyrics
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rotate-45 border border-[var(--text-hi)]" style={{ background: 'var(--accent-to)' }} />
              Audio
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
        {breakdown ? <>
          <div className="flex items-baseline justify-between gap-3 text-xs text-[var(--text-low)] uppercase tracking-[0.18em]">
            <span>Estimated proximity</span>
            <span className="font-mono text-[var(--text-med)]">{Math.round(breakdown.agreement * 100)}%</span>
          </div>
          <Meter value={breakdown.agreement} ariaLabel="Estimated proximity of lyrics and audio" />
          <p className="text-sm text-[var(--text-hi)]">{describeEstimateDifference(breakdown)}</p>
        </> : <p role="status" className="text-sm text-[var(--text-hi)]">Comparison unavailable: supported coordinates are missing from {!lyrics.point && !audio.point ? 'both readings' : !lyrics.point ? 'the lyrics reading' : 'the audio reading'}.</p>}
        <p className="text-xs text-[var(--text-med)] leading-relaxed">
          Proximity describes distance between two estimates. It does not measure model accuracy, song identity or the songwriter’s intended meaning.
        </p>
      </div>

      <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] px-4 py-3">
        <summary className="cursor-pointer rounded-sm text-sm text-[var(--text-hi)] focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-4">See comparison evidence</summary>
        <div className="mt-4 space-y-4 text-xs text-[var(--text-med)] leading-relaxed">
          <dl className="grid gap-3 md:grid-cols-2">
            <div><dt className="font-semibold text-[var(--text-hi)]">Lyrics · {BASIS_LABELS[lyrics.basis]}</dt><dd className="mt-1">{projectionDescription(lyrics, 'lyrics')}</dd></div>
            <div><dt className="font-semibold text-[var(--text-hi)]">Audio · {BASIS_LABELS[audio.basis]}</dt><dd className="mt-1">{projectionDescription(audio, 'audio')}</dd></div>
          </dl>
          <table className="w-full table-fixed text-left">
            <caption className="mb-2 text-left text-[var(--text-hi)] font-semibold">Comparison coordinates</caption>
            <thead><tr className="border-b border-[var(--border-strong)]"><th scope="col" className="pb-2 font-medium">Axis</th><th scope="col" className="pb-2 font-medium">Lyrics</th><th scope="col" className="pb-2 font-medium">Audio</th></tr></thead>
            <tbody>
              <tr><th scope="row" className="pt-2 font-normal">Valence</th><td className="pt-2 font-mono">{lyrics.point ? coordinate(lyrics.point.valence) : 'Unavailable'}</td><td className="pt-2 font-mono">{audio.point ? coordinate(audio.point.valence) : 'Unavailable'}</td></tr>
              <tr><th scope="row" className="pt-2 font-normal">Arousal</th><td className="pt-2 font-mono">{lyrics.point ? coordinate(lyrics.point.arousal) : 'Unavailable'}</td><td className="pt-2 font-mono">{audio.point ? coordinate(audio.point.arousal) : 'Unavailable'}</td></tr>
            </tbody>
          </table>
          <p>Coordinates run from −1 to +1. Valence places the estimate from negative to positive; arousal places it from calm to energetic. Values above are rounded to two decimals.</p>
          <p>Proximity is 100% when the positions coincide and 0% at opposite corners of this map. A mapped mood label uses a preset position, so two matching labels can coincide without independent measurement.</p>
        </div>
      </details>
    </Card>
  );
}
