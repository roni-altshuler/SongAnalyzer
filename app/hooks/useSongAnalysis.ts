'use client';

/**
 * useSongAnalysis — the one shared client pipeline for audio analysis.
 *
 * Extracted from the old `handleSongPicked` in `app/page.tsx` and upgraded:
 *
 *   decode once → v2 feature worker (v1 fallback) → render
 *        ↳ fingerprint worker → POST /api/fingerprints   (grows the Identify catalog)
 *        ↳ POST /api/analyses                            (persist → share/Atlas)
 *        ↳ POST /api/songs/[id]/features                 (sonic vector → Discover)
 *
 * All persistence is fire-and-forget and fail-soft: with no Supabase
 * configured every POST degrades server-side and the analysis experience is
 * unchanged. Used by /analyze (search pick + upload), /identify (after a
 * match), and /discover (explore loop).
 */

import { useCallback, useRef, useState } from 'react';

import { analyzePcmV2, decodeFileToMono } from '@/lib/audio/analyze';
import { buildSonicVector, EXTRACTOR_VERSION } from '@/lib/audio/vector';
import { analyzeAudioFile } from '@/lib/audio-analysis';
import { MAX_HASHES_PER_INGEST } from '@/lib/fingerprint/types';
import type { Song } from '@/lib/sources/types';
import type { AudioAnalysisResultV2 } from '@/lib/types';
import { computeFingerprint } from '@/app/workers/client';
import { toast } from '@/app/components/ui/Toast';

export type SongMeta = Pick<
  Song,
  'title' | 'artist' | 'album' | 'year' | 'coverUrl' | 'previewUrl' | 'spotifyId' | 'geniusId' | 'mbid'
>;

export interface UseSongAnalysis {
  song: SongMeta | null;
  analysis: AudioAnalysisResultV2 | null;
  loading: boolean;
  error: string;
  /** Source for the persistent WaveformPlayer (preview URL or local file). */
  audioSrc: string | File | null;
  fileName: string | null;
  /** DB ids once persistence succeeds (null when store unavailable). */
  songId: string | null;
  analysisId: string | null;
  /** Analyze a song via its 30s preview. Returns false when no preview exists. */
  analyzeSong: (song: SongMeta) => Promise<boolean>;
  /** Analyze a local file (optionally attributed to a song). */
  analyzeFile: (file: File, songMeta?: SongMeta) => Promise<void>;
  clearSong: () => void;
  reset: () => void;
}

async function persistAnalysis(
  result: AudioAnalysisResultV2,
  songMeta: SongMeta | undefined,
  hashes: Awaited<ReturnType<typeof computeFingerprint>> | null,
): Promise<{ analysisId: string | null; songId: string | null }> {
  try {
    const res = await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'audio', song: songMeta, result }),
    });
    if (!res.ok) return { analysisId: null, songId: null };
    const data = (await res.json()) as { status?: string; id?: string; songId?: string | null };
    if (data.status !== 'ok' || !data.id) return { analysisId: null, songId: null };

    const songId = data.songId ?? null;
    if (songId) {
      if (hashes?.length) {
        void fetch('/api/fingerprints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, hashes, source: songMeta?.previewUrl ? 'preview' : 'upload' }),
        }).catch(() => undefined);
      }
      if (result.engineVersion === 'v2' && result.v2) {
        void fetch(`/api/songs/${songId}/features`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vector: buildSonicVector(result.v2),
            version: EXTRACTOR_VERSION,
            features: result.v2,
          }),
        }).catch(() => undefined);
      }
    }

    return { analysisId: data.id, songId };
  } catch {
    return { analysisId: null, songId: null };
  }
}

export function useSongAnalysis(): UseSongAnalysis {
  const [song, setSong] = useState<SongMeta | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysisResultV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audioSrc, setAudioSrc] = useState<string | File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [songId, setSongId] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  /** Guards against a stale slow analysis overwriting a newer one. */
  const runRef = useRef(0);

  const runAnalysis = useCallback(
    async (file: File, songMeta: SongMeta | undefined, src: string | File) => {
      const run = ++runRef.current;
      setLoading(true);
      setError('');
      setAnalysis(null);
      setSongId(null);
      setAnalysisId(null);
      setFileName(file.name);

      try {
        let result: AudioAnalysisResultV2;
        let hashes: Awaited<ReturnType<typeof computeFingerprint>> | null = null;

        try {
          const { pcm, sampleRate } = await decodeFileToMono(file);
          // Fingerprint from a copy — analyzePcmV2 transfers `pcm` away.
          const fingerprintPcm = pcm.slice();
          result = await analyzePcmV2(pcm, sampleRate);
          hashes = await computeFingerprint(
            fingerprintPcm,
            sampleRate,
            MAX_HASHES_PER_INGEST,
          ).catch(() => null);
        } catch (v2Err) {
          console.warn('v2 pipeline failed; falling back to v1:', v2Err);
          const v1 = await analyzeAudioFile(file);
          result = { ...v1, engineVersion: 'v1-fallback' };
        }

        if (runRef.current !== run) return;
        setAnalysis(result);
        setAudioSrc(src);

        void persistAnalysis(result, songMeta, hashes).then((ids) => {
          if (runRef.current !== run) return;
          setAnalysisId(ids.analysisId);
          setSongId(ids.songId);
        });
      } catch (err) {
        if (runRef.current !== run) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Could not analyze the audio. Make sure it contains valid audio.',
        );
      } finally {
        if (runRef.current === run) setLoading(false);
      }
    },
    [],
  );

  const analyzeSong = useCallback(
    async (songMeta: SongMeta): Promise<boolean> => {
      setSong(songMeta);

      if (!songMeta.previewUrl) {
        toast.message(songMeta.title, {
          description: 'No 30s preview available — paste lyrics to analyze.',
        });
        return false;
      }

      const filename = `${songMeta.artist} — ${songMeta.title}.mp3`;
      try {
        const res = await fetch(songMeta.previewUrl);
        if (!res.ok) throw new Error(`Could not fetch preview (${res.status})`);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: blob.type || 'audio/mpeg' });
        await runAnalysis(file, songMeta, songMeta.previewUrl);
        toast.success(`Analyzed ${songMeta.title}`);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not analyze the Spotify preview.',
        );
        setLoading(false);
        return false;
      }
    },
    [runAnalysis],
  );

  const analyzeFile = useCallback(
    async (file: File, songMeta?: SongMeta) => {
      if (songMeta) setSong(songMeta);
      await runAnalysis(file, songMeta, file);
    },
    [runAnalysis],
  );

  const clearSong = useCallback(() => setSong(null), []);

  const reset = useCallback(() => {
    runRef.current++;
    setSong(null);
    setAnalysis(null);
    setLoading(false);
    setError('');
    setAudioSrc(null);
    setFileName(null);
    setSongId(null);
    setAnalysisId(null);
  }, []);

  return {
    song,
    analysis,
    loading,
    error,
    audioSrc,
    fileName,
    songId,
    analysisId,
    analyzeSong,
    analyzeFile,
    clearSong,
    reset,
  };
}
