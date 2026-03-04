'use client';

/**
 * Empty-state placeholder shown when no analysis has been run yet.
 */
export default function EmptyState() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-12 border border-gray-200 dark:border-slate-700 text-center">
      <div className="text-6xl mb-4">🎵</div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Ready to Analyze
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        Paste some lyrics and click analyze to see the mood and vibe
      </p>
    </div>
  );
}
