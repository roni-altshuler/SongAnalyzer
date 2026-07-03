'use client';

/**
 * IdentifyListener — the mic-driven song identification state machine.
 *
 *   idle → requesting mic → listening (10s, live spectrum + countdown)
 *        → matching (fingerprint worker + /api/identify)
 *        → matched | no-match (AudD consent / retry / upload / search escape)
 *
 * All DSP is client-side: the recorded snippet is decoded and fingerprinted
 * in a Web Worker; only integer hashes reach the server. The raw audio is
 * only ever uploaded — with explicit consent — to the AudD fallback when our
 * own catalog misses.
 *
 * No mic (or denied permission) degrades to the "upload a clip" path, which
 * feeds the exact same pipeline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { decodeFileToMono } from '@/lib/audio/analyze';
import {
  MAX_HASHES_PER_QUERY,
  type IdentifyFallbackResponseBody,
  type IdentifyResponseBody,
} from '@/lib/fingerprint/types';
import type { Song } from '@/lib/sources/types';
import { computeFingerprint } from '@/app/workers/client';
import LiveSpectrum from '@/app/components/LiveSpectrum';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Meter } from '@/app/components/ui/Meter';
import { toast } from '@/app/components/ui/Toast';
import { cn } from '@/lib/cn';

const RECORD_MS = 10_000;

type Phase =
  | { kind: 'idle' }
  | { kind: 'listening'; startedAt: number }
  | { kind: 'matching' }
  | { kind: 'matched'; song: Song; confidence?: number }
  | { kind: 'no_match'; fallbackAvailable: boolean; triedFallback: boolean }
  | { kind: 'error'; message: string };

interface IdentifyListenerProps {
  /** Fired when a song is identified (own catalog or AudD fallback). */
  onMatched: (song: Song) => void;
  className?: string;
}

export default function IdentifyListener({ onMatched, className }: IdentifyListenerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const snippetRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cleanupCapture = useCallback(() => {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setAnalyser(null);
  }, []);

  useEffect(() => cleanupCapture, [cleanupCapture]);

  // Countdown ticker while listening.
  useEffect(() => {
    if (phase.kind !== 'listening') return;
    const interval = setInterval(() => {
      setElapsed(Math.min(RECORD_MS, Date.now() - phase.startedAt));
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  /** Fingerprint a snippet (recorded or uploaded) and query the catalog. */
  const identifyBlob = useCallback(
    async (blob: Blob) => {
      setPhase({ kind: 'matching' });
      snippetRef.current = blob;

      try {
        const { pcm, sampleRate } = await decodeFileToMono(blob);
        const hashes = await computeFingerprint(pcm, sampleRate, MAX_HASHES_PER_QUERY);
        if (hashes.length === 0) {
          setPhase({ kind: 'error', message: 'Could not hear enough — try again closer to the speaker.' });
          return;
        }

        const res = await fetch('/api/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashes }),
        });
        const body = (await res.json()) as IdentifyResponseBody;

        switch (body.status) {
          case 'matched':
            setPhase({ kind: 'matched', song: body.song, confidence: body.match.confidence });
            onMatched(body.song);
            break;
          case 'no_match':
            setPhase({ kind: 'no_match', fallbackAvailable: body.fallbackAvailable, triedFallback: false });
            break;
          case 'rate_limited':
            setPhase({ kind: 'error', message: 'Too many attempts — give it a minute and try again.' });
            break;
          default:
            setPhase({ kind: 'error', message: 'That snippet could not be processed.' });
        }
      } catch (err) {
        console.warn('identify failed:', err);
        setPhase({
          kind: 'error',
          message: 'Could not decode the recording — try uploading a short clip instead.',
        });
      }
    },
    [onMatched],
  );

  const startListening = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase({ kind: 'error', message: 'Microphone capture is not supported here — upload a clip instead.' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Live levels for the spectrum.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      await ctx.resume().catch(() => undefined);
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.7;
      source.connect(node);
      setAnalyser(node);

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(
        (t) => t === '' || MediaRecorder.isTypeSupported(t),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        cleanupCapture();
        void identifyBlob(blob);
      };

      recorder.start();
      setElapsed(0);
      setPhase({ kind: 'listening', startedAt: Date.now() });
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, RECORD_MS);
    } catch (err) {
      console.warn('mic capture failed:', err);
      cleanupCapture();
      setPhase({
        kind: 'error',
        message: 'Microphone unavailable or permission denied — upload a clip instead.',
      });
    }
  }, [cleanupCapture, identifyBlob]);

  const stopEarly = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.stop();
  }, []);

  /** AudD world-catalog fallback — explicit consent, costs a request. */
  const tryFallback = useCallback(async () => {
    const snippet = snippetRef.current;
    if (!snippet) return;
    setPhase({ kind: 'matching' });

    try {
      const form = new FormData();
      form.set('audio', snippet, 'snippet');
      const res = await fetch('/api/identify/fallback', { method: 'POST', body: form });
      const body = (await res.json()) as IdentifyFallbackResponseBody;

      if (body.status === 'matched') {
        setPhase({ kind: 'matched', song: body.song });
        onMatched(body.song);
        toast.success(`Matched ${body.song.title}`);
      } else if (body.status === 'rate_limited') {
        setPhase({ kind: 'error', message: 'Fallback limit reached — give it a minute.' });
      } else {
        setPhase({ kind: 'no_match', fallbackAvailable: false, triedFallback: true });
      }
    } catch (err) {
      console.warn('fallback failed:', err);
      setPhase({ kind: 'no_match', fallbackAvailable: false, triedFallback: true });
    }
  }, [onMatched]);

  const handleUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void identifyBlob(file);
    },
    [identifyBlob],
  );

  const reset = useCallback(() => {
    snippetRef.current = null;
    setPhase({ kind: 'idle' });
  }, []);

  const secondsLeft = Math.ceil((RECORD_MS - elapsed) / 1000);

  return (
    <Card variant="glow" className={cn('space-y-6 text-center', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleUpload}
        aria-label="Upload an audio clip to identify"
      />

      {phase.kind === 'idle' && (
        <div className="space-y-5 py-6">
          <button
            type="button"
            onClick={startListening}
            aria-label="Start listening"
            className={cn(
              'group mx-auto flex h-28 w-28 items-center justify-center rounded-full',
              'border border-[var(--border-strong)]',
              'transition-transform duration-200 hover:scale-105',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-4',
            )}
            style={{
              background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
              boxShadow: '0 12px 48px -12px var(--accent-glow)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
          <div className="space-y-1.5">
            <p className="font-display text-2xl text-[var(--text-hi)]">Tap to listen</p>
            <p className="mx-auto max-w-sm text-sm text-[var(--text-med)]">
              Ten seconds of the beat is enough. Works best for songs already analyzed in
              SongAnalyzer — with a world-catalog fallback when configured.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-[var(--text-low)] underline-offset-4 transition-colors hover:text-[var(--text-hi)] hover:underline"
          >
            …or upload a short clip
          </button>
        </div>
      )}

      {phase.kind === 'listening' && (
        <div className="space-y-5 py-4">
          <div className="mx-auto h-20 w-64">
            <LiveSpectrum analyser={analyser} bars={32} className="h-full w-full" />
          </div>
          <p className="font-display text-2xl text-[var(--text-hi)]" aria-live="polite">
            Listening… {secondsLeft}
          </p>
          <div className="mx-auto max-w-xs">
            <Meter value={elapsed / RECORD_MS} ariaLabel="Recording progress" />
          </div>
          <Button variant="secondary" size="sm" onClick={stopEarly}>
            Match now
          </Button>
        </div>
      )}

      {phase.kind === 'matching' && (
        <div className="space-y-4 py-10">
          <div className="mx-auto h-12 w-40 opacity-70">
            <LiveSpectrum analyser={null} bars={20} className="h-full w-full" />
          </div>
          <p className="font-display text-xl text-[var(--text-hi)]">Matching the constellation…</p>
          <p className="text-xs text-[var(--text-low)]">
            Comparing spectral peaks against the catalog.
          </p>
        </div>
      )}

      {phase.kind === 'matched' && (
        <div className="space-y-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-low)]">
            Identified
          </p>
          <div className="flex items-center justify-center gap-4">
            {phase.song.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={phase.song.coverUrl}
                alt=""
                className="h-20 w-20 rounded-xl border border-[var(--border-subtle)] object-cover"
              />
            )}
            <div className="text-left">
              <p className="font-display text-2xl leading-tight text-[var(--text-hi)]">
                {phase.song.title}
              </p>
              <p className="text-sm text-[var(--text-med)]">{phase.song.artist}</p>
              {typeof phase.confidence === 'number' && (
                <p className="mt-1 font-mono text-[11px] text-[var(--text-low)]">
                  {Math.round(phase.confidence * 100)}% match confidence
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Identify another
          </Button>
        </div>
      )}

      {phase.kind === 'no_match' && (
        <div className="space-y-4 py-6">
          <p className="font-display text-xl text-[var(--text-hi)]">
            {phase.triedFallback ? 'Still no match.' : 'Not in the catalog yet.'}
          </p>
          <p className="mx-auto max-w-sm text-sm text-[var(--text-med)]">
            {phase.triedFallback
              ? 'The world catalog couldn’t place it either — try a cleaner snippet or search by name.'
              : 'Every song analyzed in SongAnalyzer joins the catalog — analyze it once and it becomes identifiable.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {phase.fallbackAvailable && (
              <Button variant="primary" size="sm" onClick={tryFallback}>
                Try world catalog
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={startListening}>
              Listen again
            </Button>
            <Link
              href="/analyze"
              className="rounded-lg px-3 py-2 text-sm text-[var(--text-med)] transition-colors hover:text-[var(--text-hi)]"
            >
              Search by name →
            </Link>
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="space-y-4 py-6">
          <p className="font-display text-xl text-[var(--text-hi)]">Hmm, that didn’t work.</p>
          <p className="mx-auto max-w-sm text-sm text-[var(--state-error)]">{phase.message}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={startListening}>
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              Upload a clip
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
