'use client';

/** Local audio insights stay on-device. Track selection is metadata-only. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzePcmV2, decodeFileToMono } from '@/lib/audio/analyze';
import { analyzeAudioFile } from '@/lib/audio-analysis';
import { metadataOnly } from '@/lib/audio/policy';
import type { Song } from '@/lib/sources/types';
import type { AudioAnalysisResultV2 } from '@/lib/types';

export type SongMeta = Pick<Song,
  'title' | 'artist' | 'artistCredits' | 'album' | 'year' | 'coverUrl' | 'previewUrl' | 'metadataSource' | 'spotifyId' | 'geniusId' | 'mbid'
>;

export interface UseSongAnalysis {
  song: SongMeta | null;
  analysis: AudioAnalysisResultV2 | null;
  loading: boolean;
  stage: 'idle' | 'analyzing';
  error: string;
  audioSrc: File | null;
  fileName: string | null;
  /** Audio persistence is disabled until server-verifiable rights exist. */
  songId: null;
  analysisId: null;
  /** Select metadata without fetching, measuring, fingerprinting or saving audio. */
  analyzeSong: (song: SongMeta) => Promise<boolean>;
  /** Analyze a user-chosen local file as a separate reading. */
  analyzeFile: (file: File) => Promise<void>;
  clearSong: () => void;
  reset: () => void;
}

export function useSongAnalysis(): UseSongAnalysis {
  const [song, setSong] = useState<SongMeta | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysisResultV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audioSrc, setAudioSrc] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);

  const invalidateRun = useCallback(() => { runRef.current++; }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; invalidateRun(); };
  }, [invalidateRun]);

  const isCurrent = useCallback((run: number) => mountedRef.current && runRef.current === run, []);

  const beginRun = useCallback((selected?: SongMeta): number | null => {
    // A retained callback cannot restart work after its owner unmounts.
    if (!mountedRef.current) return null;
    const run = ++runRef.current;
    setSong(selected ? metadataOnly(selected) : null);
    setAnalysis(null);
    setAudioSrc(null);
    setFileName(null);
    setError('');
    setLoading(false);
    return run;
  }, []);

  const analyzeSong = useCallback(async (selected: SongMeta): Promise<boolean> => {
    beginRun(selected);
    // Deny every remote source, even without provider IDs or with a spoofed
    // permission flag. Local fixture URLs are not a production exception.
    return false;
  }, [beginRun]);

  const analyzeFile = useCallback(async (file: File) => {
    const run = beginRun();
    if (run === null || !(file instanceof File)) return;
    setLoading(true);
    setFileName(file.name);
    try {
      let result: AudioAnalysisResultV2;
      try {
        const { pcm, sampleRate } = await decodeFileToMono(file);
        if (!isCurrent(run)) return;
        result = await analyzePcmV2(pcm, sampleRate);
      } catch (v2Error) {
        if (!isCurrent(run)) return;
        console.warn('v2 audio engine unavailable; using fallback:', v2Error);
        result = { ...(await analyzeAudioFile(file)), engineVersion: 'v1-fallback' };
      }
      if (!isCurrent(run)) return;
      setAnalysis(result);
      setAudioSrc(file);
      // No fingerprint or API writes: the server cannot authenticate the
      // provenance of client-derived audio results, even for a local upload.
    } catch (err) {
      if (isCurrent(run)) setError(err instanceof Error ? err.message : 'Could not analyze the audio file.');
    } finally {
      if (isCurrent(run)) setLoading(false);
    }
  }, [beginRun, isCurrent]);

  const reset = useCallback(() => { beginRun(); }, [beginRun]);
  return {
    song, analysis, loading, stage: loading ? 'analyzing' : 'idle', error,
    audioSrc, fileName, songId: null, analysisId: null, analyzeSong, analyzeFile,
    clearSong: reset, reset,
  };
}
