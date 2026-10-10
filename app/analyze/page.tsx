'use client';

/**
 * /analyze — the analysis workbench (the old single-page app, restructured).
 *
 * - Track search keeps attributed metadata; remote audio analysis is disabled.
 * - `?mode=lyrics|audio` URL state so modes are linkable and survive reload.
 * - A permitted local File opens the shared worker and local listening windows.
 *   No audio-derived persistence or fingerprint ingestion occurs.
 * - When both a lyrics and an audio analysis exist, the CombinedView renders
 *   an evidence-labeled comparison of valence/arousal estimates below the grid.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import TrackExploration from '@/app/components/TrackExploration';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { toast } from '@/app/components/ui/Toast';

function AnalyzeWorkbench() {
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<AnalysisMode>(
    searchParams.get('mode') === 'audio' ? 'audio' : 'lyrics',
  );
  const focusModeRef = useRef(false);

  const setMode = useCallback((next: AnalysisMode) => {
    focusModeRef.current = true;
    setModeState(next);
    // Keep the mode linkable without triggering a navigation.
    window.history.replaceState(null, '', `/analyze?mode=${next}`);
  }, []);

  useEffect(() => {
    if (!focusModeRef.current) return;
    focusModeRef.current = false;
    document.getElementById(`analysis-mode-${mode}`)?.focus();
  }, [mode]);

  // ── Audio pipeline (shared hook) ──
  const audio = useSongAnalysis();
  const resetAudio = audio.reset;

  // ── Lyrics state ──
  const [lyrics, setLyrics] = useState('');
  const [lyricsAnalysis, setLyricsAnalysis] = useState<AnalysisResult | null>(null);
  const [lyricsAnalysisId, setLyricsAnalysisId] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const lyricsRunRef = useRef(0);

  useEffect(() => () => { lyricsRunRef.current++; }, []);

  const analyzeLyrics = useCallback(async () => {
    if (!lyrics.trim()) {
      setLyricsError('Please enter some lyrics to analyze');
      return;
    }

    const run = ++lyricsRunRef.current;
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
      if (lyricsRunRef.current !== run) return;
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
          if (lyricsRunRef.current === run && data?.status === 'ok' && data.id) {
            setLyricsAnalysisId(data.id);
          }
        })
        .catch(() => undefined);
    } catch (err) {
      if (lyricsRunRef.current !== run) return;
      setLyricsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (lyricsRunRef.current === run) setLyricsLoading(false);
    }
  }, [lyrics, audio.song]);

  const handleLyricsChange = useCallback(
    (value: string) => {
      setLyrics(value);
      lyricsRunRef.current++;
      setLyricsLoading(false);
      setLyricsAnalysis(null);
      setLyricsAnalysisId(null);
      setLyricsError('');
    },
    [],
  );

  const handleRestoreHistory = useCallback((entry: HistoryEntry) => {
    lyricsRunRef.current++;
    // Local history has neither full lyrics nor a server persistence id.
    // Keep its result visible without attaching another analysis's Share id.
    setLyrics('');
    setLyricsAnalysis(entry.result);
    setLyricsAnalysisId(null);
    setLyricsLoading(false);
    setLyricsError('');
    resetAudio();
  }, [resetAudio]);

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
      void audio.analyzeSong(hit.song);
    },
    [audio],
  );

  const handleSimilarPick = useCallback(
    (song: SongMeta) => {
      void audio.analyzeSong(song);
    },
    [audio],
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
            Explore track details, paste lyrics, or choose a local audio file you have
            permission to analyze. Audio insights describe the passage you choose.
          </p>
        </header>

        <div className="mb-6">
          <SongSearch onSelect={handleSongPicked} />
        </div>

        {audio.song && (
          <div className="mb-6">
            <TrackExploration
              song={audio.song} stage={audio.stage} loading={audio.loading}
              error={audio.error} hasAnalysis={Boolean(audio.analysis)}
              onClear={() => {
                audio.reset();
                document.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
              }}
              onLyrics={() => {
                setMode('lyrics');
                if (mode === 'lyrics') document.getElementById('lyrics')?.focus();
              }}
              onUpload={() => {
                setMode('audio');
                if (mode === 'audio') document.getElementById('audio-file')?.click();
              }}
            />
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
                  <EmptyState
                    onStart={() => {
                      const input = document.getElementById('lyrics');
                      input?.scrollIntoView({ block: 'center' });
                      input?.focus({ preventScroll: true });
                    }}
                    onSwitchMode={() => setMode('audio')}
                  />
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
                <EmptyState
                  mode="audio"
                  onStart={() => document.getElementById('audio-file')?.click()}
                  onSwitchMode={() => setMode('lyrics')}
                />
              )}
            </div>
          </div>
        )}

        {showCombined && lyricsAnalysis && audio.analysis && (
          <div className="mt-10">
            <CombinedView lyricsAnalysis={lyricsAnalysis} audioAnalysis={audio.analysis} audioFileName={audio.fileName} />
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
