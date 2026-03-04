'use client';

import { AudioAnalysisResult } from '@/lib/types';
import ConfidenceBar from './ConfidenceBar';

interface AudioAnalysisResultsProps {
  analysis: AudioAnalysisResult;
  onExport: () => void;
}

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
    <div className={`${gradient} rounded-xl p-4 border animate-fade-in`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">
        {label}
      </p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function FeatureBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-28 text-right shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-14 tabular-nums">
        {typeof value === 'number' && value < 10 ? value.toFixed(2) : Math.round(value)}
      </span>
    </div>
  );
}

export default function AudioAnalysisResults({ analysis, onExport }: AudioAnalysisResultsProps) {
  const f = analysis.features;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Main card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Audio Analysis
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

        {/* Tempo badge */}
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-800/30 border border-pink-200 dark:border-pink-800 rounded-xl px-5 py-3 text-center">
            <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wide mb-0.5">
              Tempo
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {analysis.bpm} <span className="text-sm font-normal">BPM</span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{analysis.tempo}</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30 border border-cyan-200 dark:border-cyan-800 rounded-xl px-5 py-3 text-center">
            <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide mb-0.5">
              Duration
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {Math.floor(analysis.duration / 60)}:{String(Math.round(analysis.duration % 60)).padStart(2, '0')}
            </p>
          </div>
        </div>

        {/* Characteristics */}
        {analysis.characteristics.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Characteristics
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.characteristics.map((c, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Audio feature bars */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Audio Features
          </p>
          <FeatureBar label="RMS Energy" value={f.rmsEnergy} max={1} />
          <FeatureBar label="Brightness" value={f.spectralCentroid} max={5000} />
          <FeatureBar label="Dynamic Range" value={f.dynamicRange} max={1} />
          <FeatureBar label="Percussiveness" value={f.zeroCrossingRate} max={1} />
        </div>

        {/* Detailed analysis */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Detailed Analysis
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {analysis.detailedAnalysis}
          </p>
        </div>

        {/* Confidence */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{Math.round(analysis.duration)}s of audio analyzed</span>
            <span>Confidence</span>
          </div>
          <ConfidenceBar confidence={analysis.confidence} />
        </div>
      </div>
    </div>
  );
}
