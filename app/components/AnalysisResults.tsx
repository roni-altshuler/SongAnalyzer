'use client';

import { useEffect } from 'react';
import type { AnalysisResult } from '@/lib/types';
import { moodToColor } from '@/lib/analysis/palette';
import { useMoodTheme } from '@/app/providers/mood-theme-provider';
import { Card, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Meter } from '@/app/components/ui/Meter';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/lib/cn';
import MoodRadar from './MoodRadar';

interface AnalysisResultsProps {
  analysis: AnalysisResult;
  onExport: () => void;
}

/**
 * A single labeled stat in the top-of-card 2×2 grid. Pure layout — color
 * comes from the cascading accent vars driven by the mood-theme provider.
 */
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl px-4 py-3.5 border border-[var(--border-subtle)]',
        'bg-[var(--bg-elev2)] ring-inset-soft',
        accent && 'border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))]',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-1.5">
        {label}
      </p>
      <p className="font-display text-xl text-[var(--text-hi)] leading-tight">{value}</p>
    </div>
  );
}

/**
 * Inline provenance row showing which engines produced the result. Surfaces
 * the v2 hybrid pipeline transparently — "transformer ✓ joy 0.82, keyword ✓".
 */
function EngineProvenance({ engines }: { engines: NonNullable<AnalysisResult['engines']> }) {
  const t = engines.transformer;
  const k = engines.keyword;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {t.status === 'ok' ? (
        <Badge variant="mood" title={t.model ?? 'transformer'}>
          <span className="opacity-80">transformer</span>
          {t.scores?.[0] && (
            <span className="ml-1.5 font-mono opacity-95">
              {t.scores[0].label} · {t.scores[0].score.toFixed(2)}
            </span>
          )}
        </Badge>
      ) : (
        <Badge variant="outline" title={t.reason ?? t.status}>
          <span className="opacity-70">transformer · {t.status}</span>
        </Badge>
      )}
      <Badge variant="outline">
        <span className="opacity-80">
          keyword
          {k.scores && (
            <span className="ml-1.5 font-mono opacity-80">
              +{k.scores.positive} / −{k.scores.negative}
            </span>
          )}
        </span>
      </Badge>
    </div>
  );
}

export default function AnalysisResults({ analysis, onExport }: AnalysisResultsProps) {
  const { setMoodColor, resetMoodColor } = useMoodTheme();

  // Cascade the mood accent through the design system whenever a result lands.
  useEffect(() => {
    const color = analysis.moodColor ?? moodToColor(analysis.mood);
    setMoodColor(color);
    return () => {
      resetMoodColor();
    };
  }, [analysis.mood, analysis.moodColor, setMoodColor, resetMoodColor]);

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="glow" className="space-y-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
                boxShadow: '0 0 12px var(--accent-glow)',
              }}
            />
            <CardTitle>Analysis</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            title="Copy results to clipboard"
            aria-label="Copy results to clipboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span className="ml-1.5">Copy</span>
          </Button>
        </CardHeader>

        {analysis.translated && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elev2)] px-3 py-2.5 text-xs text-[var(--text-med)]">
            Detected {analysis.originalLanguage ?? 'non-English'} — translated for analysis.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Mood" value={analysis.mood} accent />
          <Stat label="Vibe" value={analysis.vibe} />
          <Stat label="Energy" value={analysis.energy} />
          <Stat label="Sentiment" value={analysis.sentiment} />
        </div>

        {analysis.themes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
              Themes
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.themes.map((theme, i) => (
                <Badge key={i} variant="default">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
            Reading
          </p>
          <p className="text-sm text-[var(--text-med)] leading-relaxed whitespace-pre-line">
            {analysis.detailedAnalysis}
          </p>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-low)]">
            <span>
              <span className="font-mono text-[var(--text-med)]">{analysis.wordCount}</span> words
            </span>
            <span className="uppercase tracking-[0.18em]">
              Confidence{' '}
              <span className="font-mono text-[var(--text-med)]">
                {Math.round(analysis.confidence * 100)}%
              </span>
            </span>
          </div>
          <Meter value={analysis.confidence} aria-label="Analysis confidence" />
          {analysis.engines && (
            <div className="pt-1">
              <EngineProvenance engines={analysis.engines} />
            </div>
          )}
        </div>
      </Card>

      <Card variant="elev1">
        <MoodRadar
          energy={analysis.energy}
          sentiment={analysis.sentiment}
          mood={analysis.mood}
          vibe={analysis.vibe}
          themes={analysis.themes}
        />
      </Card>
    </div>
  );
}
