'use client';

import { AnalysisResult } from '@/lib/types';
import ConfidenceBar from './ConfidenceBar';
import MoodRadar from './MoodRadar';

interface AnalysisResultsProps {
  analysis: AnalysisResult;
  onExport: () => void;
}

/**
 * Stat card used in the 2×2 grid at the top of results.
 */
function StatCard({
  label,
  value,
  gradient,
}: {
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <div
      className={`${gradient} rounded-xl p-4 border animate-fade-in`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">
        {label}
      </p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

export default function AnalysisResults({ analysis, onExport }: AnalysisResultsProps) {
  return (
    <div className="space-y-4 animate-slide-up">
      {/* Main card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Analysis Results
          </h2>
          <button
            onClick={onExport}
            title="Copy results to clipboard"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
          </button>
        </div>

        {/* Translation notice */}
        {analysis.translated && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              🌍 Detected {analysis.originalLanguage} — Translated for analysis
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Mood"
            value={analysis.mood}
            gradient="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-800"
          />
          <StatCard
            label="Vibe"
            value={analysis.vibe}
            gradient="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200 dark:border-purple-800"
          />
          <StatCard
            label="Energy"
            value={analysis.energy}
            gradient="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200 dark:border-green-800"
          />
          <StatCard
            label="Sentiment"
            value={analysis.sentiment}
            gradient="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border-orange-200 dark:border-orange-800"
          />
        </div>

        {/* Key Themes */}
        {analysis.themes.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Key Themes
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.themes.map((theme, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Detailed analysis */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Detailed Analysis
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {analysis.detailedAnalysis}
          </p>
        </div>

        {/* Footer stats */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{analysis.wordCount} words analyzed</span>
            <span>Confidence</span>
          </div>
          <ConfidenceBar confidence={analysis.confidence} />
        </div>
      </div>

      {/* Mood radar chart */}
      <MoodRadar
        energy={analysis.energy}
        sentiment={analysis.sentiment}
        mood={analysis.mood}
        vibe={analysis.vibe}
        themes={analysis.themes}
      />
    </div>
  );
}
