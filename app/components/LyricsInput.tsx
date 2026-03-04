'use client';

import { useState } from 'react';

interface LyricsInputProps {
  lyrics: string;
  onLyricsChange: (value: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string;
}

export default function LyricsInput({
  lyrics,
  onLyricsChange,
  onAnalyze,
  loading,
  error,
}: LyricsInputProps) {
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onAnalyze();
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700">
        <label
          htmlFor="lyrics"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3"
        >
          Paste Song Lyrics
        </label>
        <textarea
          id="lyrics"
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste full or partial lyrics here...\n\nSupports multiple languages — non-English lyrics will be automatically translated for analysis.\n\nTip: More lyrics = more detailed insights!`}
          className="w-full h-80 px-4 py-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm transition-colors"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {wordCount} words • Press Cmd/Ctrl+Enter to analyze
          </span>
          {lyrics.trim() && (
            <button
              onClick={() => onLyricsChange('')}
              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={loading || !lyrics.trim()}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Analyzing…
          </span>
        ) : (
          'Analyze Lyrics'
        )}
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-fade-in">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
