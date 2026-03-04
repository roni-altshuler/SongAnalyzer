'use client';

export type AnalysisMode = 'lyrics' | 'audio';

interface ModeTabsProps {
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}

export default function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      <div className="inline-flex rounded-xl bg-gray-200 dark:bg-slate-700 p-1">
        <button
          onClick={() => onChange('lyrics')}
          className={`
            px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200
            ${
              mode === 'lyrics'
                ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }
          `}
        >
          📝 Lyrics
        </button>
        <button
          onClick={() => onChange('audio')}
          className={`
            px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200
            ${
              mode === 'audio'
                ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }
          `}
        >
          🎧 Audio
        </button>
      </div>
    </div>
  );
}
