'use client';

import { SAMPLE_LYRICS } from '@/lib/samples';

interface SampleLyricPickerProps {
  onSelect: (lyrics: string) => void;
}

const GENRE_ICONS: Record<string, string> = {
  pop: '🎤',
  ballad: '🎹',
  rock: '🎸',
  chill: '☕',
};

/**
 * Horizontal card carousel letting the user quickly load sample lyrics.
 */
export default function SampleLyricPicker({ onSelect }: SampleLyricPickerProps) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
        Quick Start — Try a Sample
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {SAMPLE_LYRICS.map((sample) => (
          <button
            key={sample.title}
            onClick={() => onSelect(sample.lyrics)}
            className="flex-shrink-0 text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 w-44"
          >
            <span className="text-xl">{GENRE_ICONS[sample.genre] ?? '🎵'}</span>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 mt-1 truncate">
              {sample.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {sample.artist}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
