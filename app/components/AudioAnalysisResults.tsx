'use client';

import { useEffect } from 'react';
import type { AudioAnalysisResult } from '@/lib/types';
import { moodToColor } from '@/lib/analysis/palette';
import { useMoodTheme } from '@/app/providers/mood-theme-provider';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Meter } from './ui/Meter';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';

interface AudioAnalysisResultsProps {
  analysis: AudioAnalysisResult;
  onExport: () => void;
}

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

function FeatureBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-low)] w-28 text-right shrink-0">
        {label}
      </span>
      <div className="flex-1">
        <Meter value={Math.min(value / max, 1)} aria-label={label} />
      </div>
      <span className="text-[11px] font-mono text-[var(--text-med)] tabular-nums w-14 text-right">
        {typeof value === 'number' && value < 10 ? value.toFixed(2) : Math.round(value)}
      </span>
    </div>
  );
}

export default function AudioAnalysisResults({ analysis, onExport }: AudioAnalysisResultsProps) {
  const { setMoodColor, resetMoodColor } = useMoodTheme();
  const f = analysis.features;

  useEffect(() => {
    setMoodColor(moodToColor(analysis.mood));
    return () => resetMoodColor();
  }, [analysis.mood, setMoodColor, resetMoodColor]);

  const mins = Math.floor(analysis.duration / 60);
  const secs = String(Math.round(analysis.duration % 60)).padStart(2, '0');

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="glow" className="space-y-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
                boxShadow: '0 0 12px var(--accent-glow)',
              }}
            />
            <CardTitle>Audio analysis</CardTitle>
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

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Mood" value={analysis.mood} accent />
          <Stat label="Vibe" value={analysis.vibe} />
          <Stat label="Energy" value={analysis.energy} />
          <Stat label="Sentiment" value={analysis.sentiment} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-1.5">
              Tempo
            </p>
            <p className="font-display text-2xl text-[var(--text-hi)] leading-none">
              {analysis.bpm}
              <span className="text-sm font-mono text-[var(--text-low)] ml-1">BPM</span>
            </p>
            <p className="text-[11px] text-[var(--text-med)] mt-1.5">{analysis.tempo}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-1.5">
              Duration
            </p>
            <p className="font-display text-2xl text-[var(--text-hi)] leading-none font-mono">
              {mins}:{secs}
            </p>
            <p className="text-[11px] text-[var(--text-med)] mt-1.5">
              {Math.round(analysis.duration)}s analyzed
            </p>
          </div>
        </div>

        {analysis.characteristics.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
              Characteristics
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.characteristics.map((c, i) => (
                <Badge key={i} variant="default">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)]">
            Audio features
          </p>
          <FeatureBar label="Energy" value={f.rmsEnergy} max={1} />
          <FeatureBar label="Brightness" value={f.spectralCentroid} max={5000} />
          <FeatureBar label="Dynamic range" value={f.dynamicRange} max={1} />
          <FeatureBar label="Percussiveness" value={f.zeroCrossingRate} max={1} />
        </div>

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
              <span className="font-mono text-[var(--text-med)]">{Math.round(analysis.duration)}s</span>{' '}
              of audio
            </span>
            <span className="uppercase tracking-[0.18em]">
              Confidence{' '}
              <span className="font-mono text-[var(--text-med)]">
                {Math.round(analysis.confidence * 100)}%
              </span>
            </span>
          </div>
          <Meter value={analysis.confidence} aria-label="Confidence" />
        </div>
      </Card>
    </div>
  );
}
