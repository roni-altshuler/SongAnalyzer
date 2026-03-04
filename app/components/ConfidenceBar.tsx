'use client';

/**
 * Confidence progress bar with animated fill and percentage label.
 */
export default function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? 'from-green-400 to-green-600'
      : pct >= 60
        ? 'from-yellow-400 to-yellow-600'
        : 'from-red-400 to-red-600';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 tabular-nums w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}
