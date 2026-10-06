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
  | { kind: 'requesting' }
  | { kind: 'consent' }
  | { kind: 'listening'; startedAt: number }
  | { kind: 'matching'; provider?: 'audd' }
  | { kind: 'matched'; song: Song; confidence?: number }
  | { kind: 'no_match'; reason?: string; fallbackAvailable: boolean; triedFallback: boolean }
  | { kind: 'error'; message: string };

interface IdentifyListenerProps {
  /** Fired when a song is identified (own catalog or AudD fallback). */
  onMatched: (song: Song) => void;
  /** Clear the previous track before a new recognition attempt. */
  onNewAttempt?: () => void;
  className?: string;
}

export default function IdentifyListener({ onMatched, onNewAttempt, className }: IdentifyListenerProps) {
  // The server-rendered file input can otherwise accept a clip before its
  // change handler is attached, losing the user's selection during hydration.
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const snippetRef = useRef<Blob | null>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const consentHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const previousPhaseRef = useRef<Phase['kind']>('idle');

  useEffect(() => {
    if (phase.kind === 'consent') consentHeadingRef.current?.focus();
    if (phase.kind === 'idle' && previousPhaseRef.current !== 'idle') startButtonRef.current?.focus();
    previousPhaseRef.current = phase.kind;
  }, [phase.kind]);

  const cleanupCapture = useCallback(() => {
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (mountedRef.current) setAnalyser(null);
  }, []);

  const invalidate = useCallback(() => {
    operationRef.current++;
    busyRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    snippetRef.current = null;
    cleanupCapture();
  }, [cleanupCapture]);

  useEffect(() => {
    mountedRef.current = true;
    setReady(true);
    return () => { mountedRef.current = false; invalidate(); };
  }, [invalidate]);

  const current = useCallback((operation: number) =>
    mountedRef.current && operationRef.current === operation && !abortRef.current?.signal.aborted, []);

  const begin = useCallback(() => {
    // The synchronous lock covers repeated clicks before React renders the
    // requesting state, including the browser permission prompt.
    if (!mountedRef.current || busyRef.current) return null;
    invalidate();
    busyRef.current = true;
    abortRef.current = new AbortController();
    onNewAttempt?.();
    return operationRef.current;
  }, [invalidate, onNewAttempt]);

  useEffect(() => {
    if (phase.kind !== 'listening') return;
    const interval = setInterval(() => {
      setElapsed(Math.min(RECORD_MS, Date.now() - phase.startedAt));
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  const identifyBlob = useCallback(async (blob: Blob, operation: number) => {
    if (!current(operation)) return;
    setPhase({ kind: 'matching' });
    snippetRef.current = blob;
    try {
      const { pcm, sampleRate } = await decodeFileToMono(blob);
      if (!current(operation)) return;
      const hashes = await computeFingerprint(pcm, sampleRate, MAX_HASHES_PER_QUERY);
      if (!current(operation)) return;
      if (hashes.length === 0) {
        setPhase({ kind: 'error', message: 'Could not hear enough — try again closer to the speaker.' });
        return;
      }
      const res = await fetch('/api/identify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes }), signal: abortRef.current?.signal,
      });
      if (!current(operation)) return;
      const body = (await res.json()) as IdentifyResponseBody;
      if (!current(operation)) return;
      switch (body.status) {
        case 'matched':
          snippetRef.current = null;
          setPhase({ kind: 'matched', song: body.song, confidence: body.match.confidence });
          onMatched(body.song);
          break;
        case 'no_match':
          setPhase({ kind: 'no_match', reason: body.reason, fallbackAvailable: body.fallbackAvailable, triedFallback: false });
          break;
        case 'rate_limited':
          setPhase({ kind: 'error', message: 'Too many attempts — give it a minute and try again.' });
          break;
        default:
          setPhase({ kind: 'error', message: 'That snippet could not be processed.' });
      }
    } catch (err) {
      if (!current(operation)) return;
      console.warn('identify failed:', err);
      setPhase({ kind: 'error', message: 'Could not process the recording — try a short clip instead.' });
    } finally {
      if (current(operation)) busyRef.current = false;
    }
  }, [current, onMatched]);

  const startListening = useCallback(async () => {
    const operation = begin();
    if (operation === null) return;
    setPhase({ kind: 'requesting' });
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      busyRef.current = false;
      setPhase({ kind: 'error', message: 'Microphone capture is not supported here — upload a clip instead.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current(operation)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      await ctx.resume().catch(() => undefined);
      if (!current(operation)) {
        stream.getTracks().forEach((track) => track.stop());
        void ctx.close().catch(() => undefined);
        return;
      }
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
        if (current(operation) && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (!current(operation)) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        cleanupCapture();
        void identifyBlob(blob, operation);
      };
      recorder.start();
      setElapsed(0);
      setPhase({ kind: 'listening', startedAt: Date.now() });
      captureTimerRef.current = setTimeout(() => {
        if (current(operation) && recorder.state === 'recording') recorder.stop();
      }, RECORD_MS);
    } catch (err) {
      if (!current(operation)) return;
      console.warn('mic capture failed:', err);
      cleanupCapture();
      busyRef.current = false;
      setPhase({ kind: 'error', message: 'Microphone unavailable or permission denied — upload a clip instead.' });
    }
  }, [begin, cleanupCapture, current, identifyBlob]);

  const stopEarly = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  }, []);

  /** Only the named, disclosed confirmation action relays audio to AudD. */
  const tryFallback = useCallback(async () => {
    if (!mountedRef.current || busyRef.current || phase.kind !== 'consent') return;
    const snippet = snippetRef.current;
    if (!snippet) return;
    const operation = operationRef.current;
    busyRef.current = true;
    setPhase({ kind: 'matching', provider: 'audd' });
    try {
      const form = new FormData();
      form.set('audio', snippet, 'snippet');
      form.set('consent', 'audd-recognition');
      const res = await fetch('/api/identify/fallback', {
        method: 'POST', body: form, signal: abortRef.current?.signal,
      });
      if (!current(operation)) return;
      const body = (await res.json()) as IdentifyFallbackResponseBody;
      if (!current(operation)) return;
      if (body.status === 'matched') {
        snippetRef.current = null;
        setPhase({ kind: 'matched', song: body.song });
        onMatched(body.song);
        toast.success(`Matched ${body.song.title}`);
      } else if (body.status === 'rate_limited') {
        setPhase({ kind: 'error', message: 'Fallback limit reached — give it a minute.' });
      } else {
        setPhase({ kind: 'no_match', fallbackAvailable: false, triedFallback: true });
      }
    } catch (err) {
      if (!current(operation)) return;
      console.warn('fallback failed:', err);
      setPhase({ kind: 'no_match', fallbackAvailable: false, triedFallback: true });
    } finally {
      if (current(operation)) busyRef.current = false;
    }
  }, [current, onMatched, phase.kind]);

  const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const operation = begin();
    if (operation !== null) void identifyBlob(file, operation);
  }, [begin, identifyBlob]);

  const reset = useCallback(() => {
    if (!mountedRef.current) return;
    invalidate();
    onNewAttempt?.();
    setPhase({ kind: 'idle' });
  }, [invalidate, onNewAttempt]);

  const secondsLeft = Math.ceil((RECORD_MS - elapsed) / 1000);

  return (
    <Card variant="glow" role="region" aria-label="Identify recording" aria-busy={!ready} className={cn('identify-listener space-y-6 text-center', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        disabled={!ready}
        onChange={handleUpload}
        aria-label="Upload an audio clip to identify"
      />

      {phase.kind === 'idle' && (
        <div className="space-y-5 py-6">
          <button
            ref={startButtonRef}
            type="button"
            disabled={!ready}
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
            <p className="font-display text-2xl text-[var(--text-hi)]" role="status">{ready ? 'Tap to listen' : 'Preparing recognition…'}</p>
            <p className="mx-auto max-w-sm text-sm text-[var(--text-med)]">
              Use audio you have permission to process. Choose a short, clear passage. Catalog matching recognizes indexed recordings
              when the catalog is available.
            </p>
          </div>
          <button
            type="button"
            disabled={!ready}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-11 text-xs text-[var(--text-med)] underline-offset-4 transition-colors hover:text-[var(--text-hi)] hover:underline"
          >
            …or choose a short clip
          </button>
        </div>
      )}

      {phase.kind === 'requesting' && (
        <div className="space-y-4 py-8" role="status">
          <p className="font-display text-xl text-[var(--text-hi)]">Waiting for microphone permission…</p>
          <p className="text-sm text-[var(--text-med)]">Recording starts only if you allow microphone access.</p>
          <Button variant="secondary" className="min-h-11" onClick={reset}>Cancel</Button>
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
          <Button variant="ghost" className="min-h-11" onClick={reset}>Cancel recording</Button>
        </div>
      )}

      {phase.kind === 'matching' && (
        <div className="space-y-4 py-10">
          <div className="mx-auto h-12 w-40 opacity-70">
            <LiveSpectrum analyser={null} bars={20} className="h-full w-full" />
          </div>
          <p className="font-display text-xl text-[var(--text-hi)]">{phase.provider === 'audd' ? 'Asking AudD to identify the clip…' : 'Matching the constellation…'}</p>
          <p className="text-xs text-[var(--text-low)]">
            {phase.provider === 'audd' ? 'Your clip is being sent to AudD for recognition.' : 'Comparing spectral peaks against the catalog.'}
          </p>
          <Button variant="secondary" className="min-h-11" onClick={reset}>Cancel matching</Button>
        </div>
      )}

      {phase.kind === 'matched' && (
        <div className="space-y-3 py-4">
          <div role="status" className="space-y-2">
            <p className="font-display text-xl text-[var(--text-hi)]">Recording identified</p>
            <p className="text-sm text-[var(--text-med)]">Explore the track details and listening links below.</p>
            {typeof phase.confidence === 'number' && (
              <p className="font-mono text-[11px] text-[var(--text-med)]">
                {Math.round(phase.confidence * 100)}% catalog match signal
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={reset}>Identify another</Button>
        </div>
      )}

      {phase.kind === 'no_match' && (
        <div className="space-y-4 py-6" role="status">
          <p className="font-display text-xl text-[var(--text-hi)]">
            {phase.reason === 'store_unavailable' ? 'Recognition catalog unavailable.'
              : phase.reason === 'store_error' ? 'Catalog lookup didn’t finish.'
              : phase.reason === 'song_missing' ? 'Track details unavailable.'
              : phase.triedFallback ? 'Still no match.' : 'No catalog match.'}
          </p>
          <p className="mx-auto max-w-sm text-sm text-[var(--text-med)]">
            {phase.reason
              ? 'The catalog could not complete this lookup. This does not tell us whether your track is indexed. You can still analyze a local clip or search by name.'
              : phase.triedFallback
              ? 'The world catalog couldn’t place it either — try a cleaner snippet or search by name.'
              : 'No indexed recording matched this passage. Try a clearer clip or search by name.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {phase.fallbackAvailable && (
              <Button variant="primary" size="sm" className="min-h-11" onClick={() => setPhase({ kind: 'consent' })}>
                Try AudD recognition
              </Button>
            )}
            <Button variant="secondary" size="sm" className="min-h-11" onClick={startListening}>
              Listen again
            </Button>
            <Button asChild variant="secondary" className="min-h-11">
              <Link href="/analyze?mode=audio">Analyze a local clip</Link>
            </Button>
            <Link
              href="/analyze"
              className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-[var(--text-med)] transition-colors hover:text-[var(--text-hi)]"
            >
              Search by name →
            </Link>
          </div>
        </div>
      )}

      {phase.kind === 'consent' && (
        <div className="space-y-4 py-6 text-left" role="region" aria-label="AudD audio sharing consent">
          <h2 ref={consentHeadingRef} tabIndex={-1} className="font-display text-xl text-[var(--text-hi)]">Send this clip to AudD?</h2>
          <p className="text-sm leading-relaxed text-[var(--text-med)]">
            AudD is an external music recognition provider. Your recorded or uploaded clip
            will leave your device and be sent through SongAnalyzer to AudD to identify the recording.
            SongAnalyzer does not save the raw audio. AudD processes it under its own privacy policy.
          </p>
          <a href="https://audd.io/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-[var(--text-hi)] underline underline-offset-4">
            AudD privacy policy (opens in a new tab)
          </a>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="min-h-11" onClick={tryFallback}>Send clip to AudD</Button>
            <Button variant="secondary" className="min-h-11" onClick={reset}>Keep audio on device</Button>
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="space-y-4 py-6">
          <p className="font-display text-xl text-[var(--text-hi)]">Hmm, that didn’t work.</p>
          <p className="mx-auto max-w-sm text-sm text-[var(--state-error)]">{phase.message}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" className="min-h-11" onClick={startListening}>
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
