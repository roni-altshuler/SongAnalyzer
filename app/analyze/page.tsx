'use client';

/**
 * /analyze — the analysis workbench (the old single-page app, restructured).
 *
 * - Search-first: picking a Spotify hit auto-analyzes its 30s preview via
 *   the shared `useSongAnalysis` pipeline (v2 engine + fingerprint ingest +
 *   persistence).
 * - `?mode=lyrics|audio` URL state so modes are linkable and survive reload.
 * - Audio results keep a persistent WaveformPlayer (with the v2 beat grid)
 *   and a "feels like this" similarity rail.
 * - When both a lyrics and an audio analysis exist, the CombinedView renders
 *   the real valence/arousal agreement below the grid.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type { AnalysisResult, HistoryEntry } from '@/lib/types';
import { saveToHistory } from '@/lib/history';
import type { SearchHit } from '@/lib/sources/types';
import { useSongAnalysis, type SongMeta } from '@/app/hooks/useSongAnalysis';

import LyricsInput from '@/app/components/LyricsInput';
import AnalysisResults from '@/app/components/AnalysisResults';
import AnalysisSkeleton from '@/app/components/AnalysisSkeleton';
import EmptyState from '@/app/components/EmptyState';
import SampleLyricPicker from '@/app/components/SampleLyricPicker';
import SongSearch from '@/app/components/SongSearch';
import HistoryPanel from '@/app/components/HistoryPanel';
import ModeTabs, { AnalysisMode } from '@/app/components/ModeTabs';
import AudioUpload from '@/app/components/AudioUpload';
import AudioAnalysisResultsView from '@/app/components/AudioAnalysisResults';
import CombinedView from '@/app/components/CombinedView';
import SimilarSongs from '@/app/components/SimilarSongs';
import WaveformPlayer from '@/app/components/WaveformPlayer';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { toast } from '@/app/components/ui/Toast';

function AnalyzeWorkbench() {
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<AnalysisMode>(
    searchParams.get('mode') === 'audio' ? 'audio' : 'lyrics',
  );

  const setMode = useCallback((next: AnalysisMode) => {
    setModeState(next);
    // Keep the mode linkable without triggering a navigation.
    window.history.replaceState(null, '', `/analyze?mode=${next}`);
  }, []);

  // ── Audio pipeline (shared hook) ──
  const audio = useSongAnalysis();

  // ── Lyrics state ──
  const [lyrics, setLyrics] = useState('');
  const [lyricsAnalysis, setLyricsAnalysis] = useState<AnalysisResult | null>(null);
  const [lyricsAnalysisId, setLyricsAnalysisId] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  const analyzeLyrics = useCallback(async () => {
    if (!lyrics.trim()) {
      setLyricsError('Please enter some lyrics to analyze');
      return;
    }

    setLyricsLoading(true);
    setLyricsError('');
    setLyricsAnalysis(null);
    setLyricsAnalysisId(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? 'Failed to analyze lyrics');
      }

      const result: AnalysisResult = await response.json();
      setLyricsAnalysis(result);
      saveToHistory(lyrics, result);
      setHistoryKey((k) => k + 1);

      // Persist so the Share button has an id — fail-soft, fire-and-forget.
      void fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'lyrics',
          result,
          song: audio.song ?? undefined,
          lyricsExcerpt: lyrics.slice(0, 500),
          language: result.originalLanguage,
          translated: result.translated,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { status?: string; id?: string } | null) => {
          if (data?.status === 'ok' && data.id) setLyricsAnalysisId(data.id);
        })
        .catch(() => undefined);
    } catch (err) {
      setLyricsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLyricsLoading(false);
    }
  }, [lyrics, audio.song]);

  const handleLyricsChange = useCallback(
    (value: string) => {
      setLyrics(value);
      if (lyricsAnalysis) {
        setLyricsAnalysis(null);
        setLyricsAnalysisId(null);
        setLyricsError('');
      }
    },
    [lyricsAnalysis],
  );

  const handleRestoreHistory = useCallback((entry: HistoryEntry) => {
    setLyricsAnalysis(entry.result);
    setLyricsError('');
  }, []);

  const handleLyricsExport = useCallback(() => {
    if (!lyricsAnalysis) return;
    const text = [
      `Song Lyric Analysis`,
      `───────────────────`,
      `Mood:      ${lyricsAnalysis.mood}`,
      `Vibe:      ${lyricsAnalysis.vibe}`,
      `Energy:    ${lyricsAnalysis.energy}`,
      `Sentiment: ${lyricsAnalysis.sentiment}`,
      `Themes:    ${lyricsAnalysis.themes.join(', ')}`,
      `Confidence: ${Math.round(lyricsAnalysis.confidence * 100)}%`,
      ``,
      lyricsAnalysis.detailedAnalysis,
      ``,
      `— Generated by SongAnalyzer`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    });
  }, [lyricsAnalysis]);

  const handleAudioExport = useCallback(() => {
    const analysis = audio.analysis;
    if (!analysis) return;
    const text = [
      `Audio Analysis`,
      `──────────────`,
      `Mood:      ${analysis.mood}`,
      `Vibe:      ${analysis.vibe}`,
      `Energy:    ${analysis.energy}`,
      `Sentiment: ${analysis.sentiment}`,
      `Tempo:     ${analysis.bpm} BPM (${analysis.tempo})`,
      ...(analysis.v2?.key ? [`Key:       ${analysis.v2.key} ${analysis.v2.scale}`] : []),
      `Duration:  ${Math.round(analysis.duration)}s`,
      `Chars:     ${analysis.characteristics.join(', ')}`,
      `Confidence: ${Math.round(analysis.confidence * 100)}%`,
      ``,
      analysis.detailedAnalysis,
      ``,
      `— Generated by SongAnalyzer`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    });
  }, [audio.analysis]);

  const handleSongPicked = useCallback(
    (hit: SearchHit) => {
      if (hit.song.previewUrl) setMode('audio');
      void audio.analyzeSong(hit.song);
    },
    [audio, setMode],
  );

  const handleSimilarPick = useCallback(
    (song: SongMeta) => {
      setMode('audio');
      void audio.analyzeSong(song);
    },
    [audio, setMode],
  );

  // Keep the identify handoff working: /analyze?mode=audio renders the audio
  // surface even before anything is analyzed.
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'audio' || urlMode === 'lyrics') setModeState(urlMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCombined = Boolean(lyricsAnalysis && audio.analysis);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-hi)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in_oklab, var(--accent-glow) 45%, transparent), transparent 60%)',
        }}
      />

      <div className="container mx-auto max-w-6xl px-4 pb-16 pt-10">
        <header className="mb-8 space-y-2 text-center">
          <h1 className="font-display text-4xl tracking-tight md:text-5xl">
            <span className="text-accent-gradient italic">Analyze</span>{' '}
            <span className="text-[var(--text-med)]">a song.</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm text-[var(--text-med)] md:text-base">
            Search a track, paste lyrics, or drop an audio file — the dual engines read the
            emotion and tint the page with the song&rsquo;s color.
          </p>
        </header>

        <div className="mb-6">
          <SongSearch onSelect={handleSongPicked} />
        </div>

        {audio.song && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] px-4 py-3 ring-inset-soft">
            {audio.song.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={audio.song.coverUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-md border border-[var(--border-subtle)] object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-low)]">
                Now analyzing
              </p>
              <p className="truncate text-sm text-[var(--text-hi)]">
                <span className="font-display">{audio.song.title}</span>
                <span className="text-[var(--text-med)]"> · {audio.song.artist}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={audio.clearSong}
              className="text-xs text-[var(--text-low)] transition-colors hover:text-[var(--state-error)]"
            >
              Clear
            </button>
          </div>
        )}

        <ModeTabs mode={mode} onChange={setMode} />

        {mode === 'lyrics' && (
          <>
            <SampleLyricPicker onSelect={(s) => handleLyricsChange(s)} />

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <div className="space-y-6">
                <LyricsInput
                  lyrics={lyrics}
                  onLyricsChange={handleLyricsChange}
                  onAnalyze={analyzeLyrics}
                  loading={lyricsLoading}
                  error={lyricsError}
                />
                <HistoryPanel onRestore={handleRestoreHistory} refreshKey={historyKey} />
              </div>

              <div>
                {lyricsLoading ? (
                  <AnalysisSkeleton />
                ) : lyricsAnalysis ? (
                  <AnalysisResults
                    analysis={lyricsAnalysis}
                    onExport={handleLyricsExport}
                    analysisId={lyricsAnalysisId ?? undefined}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          </>
        )}

        {mode === 'audio' && (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <div>
              <AudioUpload
                onFileSelected={(file) => void audio.analyzeFile(file)}
                loading={audio.loading}
                error={audio.error}
                fileName={audio.fileName}
              />
            </div>

            <div className="space-y-4">
              {audio.loading ? (
                <AnalysisSkeleton />
              ) : audio.analysis ? (
                <>
                  {audio.audioSrc && (
                    <WaveformPlayer
                      src={audio.audioSrc}
                      beatGrid={audio.analysis.v2?.beatGrid}
                      duration={audio.analysis.duration}
                    />
                  )}
                  <AudioAnalysisResultsView
                    analysis={audio.analysis}
                    onExport={handleAudioExport}
                    analysisId={audio.analysisId ?? undefined}
                  />
                  <SimilarSongs songId={audio.songId} onPick={handleSimilarPick} />
                  {!lyricsAnalysis && (
                    <Card variant="flat" className="flex items-center justify-between gap-3 py-3">
                      <p className="text-xs text-[var(--text-med)]">
                        Add the lyrics to unlock the combined words-vs-sound view.
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => setMode('lyrics')}>
                        Add lyrics
                      </Button>
                    </Card>
                  )}
                </>
              ) : (
                <Card variant="elev1" className="py-14 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elev3)]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-med)]" aria-hidden="true">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <h3 className="mb-2 font-display text-xl text-[var(--text-hi)]">
                    Ready to listen
                  </h3>
                  <p className="mx-auto max-w-sm text-sm text-[var(--text-med)]">
                    Upload an audio file — or pick a song above — to detect mood from the music
                    itself: beat grid, key, energy, and tone.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {showCombined && lyricsAnalysis && audio.analysis && (
          <div className="mt-10">
            <CombinedView lyricsAnalysis={lyricsAnalysis} audioAnalysis={audio.analysis} />
          </div>
        )}
      </div>
    </main>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzeWorkbench />
    </Suspense>
  );
}
