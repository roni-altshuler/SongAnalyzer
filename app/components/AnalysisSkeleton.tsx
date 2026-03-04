'use client';

/**
 * Skeleton loader displayed while waiting for analysis results.
 */
export default function AnalysisSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700 space-y-6 animate-pulse">
      {/* Title */}
      <div className="h-7 w-48 bg-gray-200 dark:bg-slate-700 rounded" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 bg-gray-100 dark:bg-slate-700/50 space-y-2"
          >
            <div className="h-3 w-14 bg-gray-300 dark:bg-slate-600 rounded" />
            <div className="h-5 w-24 bg-gray-300 dark:bg-slate-600 rounded" />
          </div>
        ))}
      </div>

      {/* Themes */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-20 bg-gray-200 dark:bg-slate-700 rounded-full"
          />
        ))}
      </div>

      {/* Text block */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-5/6 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-4/6 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
  );
}
