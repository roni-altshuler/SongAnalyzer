'use client';

import { useEffect, useState } from 'react';
import type { AudioAnalysisResult, AudioAnalysisResultV2 } from '@/lib/types';
import { moodToColor } from '@/lib/analysis/palette';
import { useMoodTheme } from '@/app/providers/mood-theme-provider';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Meter } from './ui/Meter';
import { Button } from './ui/Button';
import { toast } from './ui/Toast';
import { cn } from '@/lib/cn';

interface AudioAnalysisResultsProps {
  analysis: AudioAnalysisResult | AudioAnalysisResultV2;
  onExport: () => void;
  /** Optional — when set, enables the Share button (POSTs to /api/analyses/share). */
  analysisId?: string;
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

function BigTile({
  label,
  main,
  suffix,
  sub,
}: {
  label: string;
  main: string;
  suffix?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-1.5">
        {label}
      </p>
      <p className="font-display text-2xl text-[var(--text-hi)] leading-none">
        {main}
        {suffix && <span className="text-sm font-mono text-[var(--text-low)] ml-1">{suffix}</span>}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-med)] mt-1.5">{sub}</p>}
    </div>
  );
}

export default function AudioAnalysisResults({
  analysis,
  onExport,
  analysisId,
}: AudioAnalysisResultsProps) {
  const { setMoodColor, resetMoodColor } = useMoodTheme();
  const [sharing, setSharing] = useState(false);
  const f = analysis.features;

  const v2 = 'v2' in analysis ? analysis.v2 : undefined;
  const engineVersion = 'engineVersion' in analysis ? analysis.engineVersion : undefined;

  useEffect(() => {
    setMoodColor(moodToColor(analysis.mood));
    return () => resetMoodColor();
  }, [analysis.mood, setMoodColor, resetMoodColor]);

  const handleShare = async () => {
    if (!analysisId || sharing) return;
    setSharing(true);
    try {
      const res = await fetch('/api/analyses/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Share failed (${res.status})`);
      }
      const { shareUrl } = (await res.json()) as { shareUrl: string };
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create share link');
    } finally {
      setSharing(false);
    }
  };

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
          <div className="flex items-center gap-2">
            {analysisId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                loading={sharing}
                title="Copy a public share link"
                aria-label="Copy a public share link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                  <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                </svg>
                <span className="ml-1.5">Share</span>
              </Button>
            )}
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
          </div>
        </CardHeader>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Mood" value={analysis.mood} accent />
          <Stat label="Vibe" value={analysis.vibe} />
          <Stat label="Energy" value={analysis.energy} />
          <Stat label="Sentiment" value={analysis.sentiment} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BigTile label="Tempo" main={String(analysis.bpm)} suffix="BPM" sub={analysis.tempo} />
          <BigTile label="Duration" main={`${mins}:${secs}`} sub={`${Math.round(analysis.duration)}s analyzed`} />
          {v2?.key && v2.scale && (
            <BigTile
              label="Key"
              main={`${v2.key} ${v2.scale}`}
              sub={`${Math.round(v2.keyStrength * 100)}% key confidence`}
            />
          )}
          {v2 && (
            <BigTile
              label="Emotion map"
              main={`${v2.valence >= 0 ? '+' : ''}${v2.valence.toFixed(2)}`}
              suffix={`v · ${v2.arousal >= 0 ? '+' : ''}${v2.arousal.toFixed(2)}a`}
              sub="valence · arousal"
            />
          )}
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
              {engineVersion && (
                <span className="ml-2 uppercase tracking-[0.14em]">
                  · engine{' '}
                  <span className="font-mono text-[var(--text-med)]">
                    {engineVersion === 'v2' ? 'v2 (MIR)' : 'v1 (fallback)'}
                  </span>
                </span>
              )}
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
