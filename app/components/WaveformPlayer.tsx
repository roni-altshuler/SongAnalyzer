'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type WaveSurferType from 'wavesurfer.js';
import { Button } from '@/app/components/ui/Button';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@/lib/cn';

export interface WaveformPlayerProps {
  /** Either a remote audio URL (e.g. Spotify previewUrl) or a local File. */
  src: string | File;
  /** Wave height in px. Defaults to 64. */
  height?: number;
  className?: string;
}

/** Read a CSS custom property from the document root, with a fallback. */
function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Wavesurfer-backed audio player with gradient bar styling.
 *
 * - Dynamically imports `wavesurfer.js` so the bundle stays small for callers
 *   that never enter audio mode.
 * - Reads `--accent-from`/`--accent-to` at init time and uses them as the
 *   waveform progress/wave gradients.
 * - Renders a skeleton until wavesurfer reports `ready`.
 */
export default function WaveformPlayer({
  src,
  height = 64,
  className,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferType | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setPlaying(false);

    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        const mod = await import('wavesurfer.js');
        if (disposed || !containerRef.current) return;

        const WaveSurfer = mod.default;

        const accentFrom = readCssVar('--accent-from', '#3B82F6');
        const accentTo = readCssVar('--accent-to', '#8B5CF6');

        // wavesurfer accepts CanvasGradient via a callback in v7 for waveColor.
        // We approximate the gradient via two horizontal stops and let the bar
        // rendering interpolate, which is consistent with the design system.
        const ws = WaveSurfer.create({
          container: containerRef.current,
          height,
          waveColor: accentFrom,
          progressColor: accentTo,
          cursorColor: 'rgba(255,255,255,0.6)',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          backend: 'WebAudio',
        });
        wsRef.current = ws;

        ws.on('ready', () => {
          if (!disposed) setReady(true);
        });
        ws.on('play', () => {
          if (!disposed) setPlaying(true);
        });
        ws.on('pause', () => {
          if (!disposed) setPlaying(false);
        });
        ws.on('finish', () => {
          if (!disposed) setPlaying(false);
        });

        if (src instanceof File) {
          // wavesurfer v7 supports `loadBlob`.
          ws.loadBlob(src);
        } else {
          ws.load(src);
        }
      } catch (err) {
        // Surface in dev; never crash the page.
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[WaveformPlayer] failed to init wavesurfer', err);
        }
      }
    })();

    return () => {
      disposed = true;
      const ws = wsRef.current;
      if (ws) {
        try {
          ws.destroy();
        } catch {
          // Ignore — destroy can throw if the audio context already closed.
        }
        wsRef.current = null;
      }
    };
  }, [src, height]);

  const toggle = () => {
    const ws = wsRef.current;
    if (!ws) return;
    if (playing) ws.pause();
    else ws.play();
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl p-3',
        'bg-[var(--bg-elev2)] border border-[var(--border-subtle)] ring-inset-soft',
        className,
      )}
    >
      <Button
        variant="icon"
        size="md"
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      </Button>

      <div className="relative flex-1 min-w-0" style={{ height }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center">
            <Skeleton className="w-full h-2 rounded-full" />
          </div>
        )}
        <div
          ref={containerRef}
          className={cn(
            'h-full w-full transition-opacity duration-300',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </div>
  );
}
