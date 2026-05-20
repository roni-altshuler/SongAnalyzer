'use client';

import { Meter } from './ui/Meter';

/**
 * Confidence bar — thin wrapper around the design-system Meter primitive,
 * kept as a separate component for backward compatibility with v1 callers
 * (AudioAnalysisResults still uses this).
 */
export default function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Meter value={confidence} aria-label="Confidence" />
      </div>
      <span className="text-xs font-mono text-[var(--text-med)] tabular-nums w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}
