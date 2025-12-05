'use client';

import { useState, useEffect } from 'react';
import ThemeToggle from './components/ThemeToggle';

interface AnalysisResult {
  mood: string;
  vibe: string;
  energy: string;
  sentiment: string;
  themes: string[];
  detailedAnalysis: string;
  confidence: number;
  wordCount: number;
  originalLanguage?: string;
  translated?: boolean;
}

export default function Home() {
  const [lyrics, setLyrics] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset analysis when lyrics change after an analysis has been done
  useEffect(() => {
    if (analysis) {
      setAnalysis(null);
      setError('');
    }
  }, [lyrics]);

  const analyzeLyrics = async () => {
    if (!lyrics.trim()) {
      setError('Please enter some lyrics to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lyrics }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze lyrics');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      analyzeLyrics();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 pb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
            Song Lyric Analyzer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Discover the mood, vibe, and emotional essence of any song
          </p>
        </div>

        {/* Main Content */}
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700">
              <label htmlFor="lyrics" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                Paste Song Lyrics
              </label>
              <textarea
                id="lyrics"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste full or partial lyrics here...

Supports multiple languages - non-English lyrics will be automatically translated for analysis.

Tip: More lyrics = more detailed insights!"
                className="w-full h-80 px-4 py-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {lyrics.trim().split(/\s+/).filter(Boolean).length} words • Press Cmd/Ctrl+Enter to analyze
                </span>
              </div>
            </div>

            <button
              onClick={analyzeLyrics}
              disabled={loading || !lyrics.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Lyrics'
              )}
            </button>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {analysis ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Analysis Results</h2>
                  
                  {analysis.translated && (
                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        🌍 Detected {analysis.originalLanguage} - Translated for analysis
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Mood</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{analysis.mood}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Vibe</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{analysis.vibe}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Energy</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{analysis.energy}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Sentiment</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{analysis.sentiment}</p>
                    </div>
                  </div>

                  {analysis.themes && analysis.themes.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Themes</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.themes.map((theme, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Detailed Analysis</p>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                      {analysis.detailedAnalysis}
                    </p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{analysis.wordCount} words analyzed</span>
                      <span>Confidence: {Math.round(analysis.confidence * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-12 border border-gray-200 dark:border-slate-700 text-center">
                <div className="text-6xl mb-4">🎵</div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Ready to Analyze
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Paste some lyrics and click analyze to see the mood and vibe
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Supports multiple languages with automatic translation</p>
          <p className="mt-2">💡 Tip: Paste full song lyrics for more detailed and accurate analysis</p>
        </div>
      </div>
    </main>
  );
}
