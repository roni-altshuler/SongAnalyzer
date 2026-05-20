'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useMoodTheme } from '@/app/providers/mood-theme-provider';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/lib/cn';

export interface SongHeroProps {
  title: string;
  artist: string;
  album?: string | null;
  coverUrl?: string | null;
  previewUrl?: string | null;
  className?: string;
}

/**
 * Big editorial hero for a resolved song.
 *
 * Layers (z bottom→top):
 *   1. Blurred cover @ 1.4× + 60px blur backdrop
 *   2. Radial gradient mask in --accent-from/to
 *   3. Sharp 240px cover tile + serif title + caps subtitle + play button
 *
 * On mount, samples the cover with node-vibrant and pushes the dominant
 * palette into the mood-theme provider so the whole page picks up the
 * album-accurate accent. Falls back to whatever mood color the result already
 * has if vibrant fails.
 */
export default function SongHero({
  title,
  artist,
  album,
  coverUrl,
  previewUrl,
  className,
}: SongHeroProps) {
  const { setMoodColor } = useMoodTheme();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sample the cover for an album-accurate accent palette.
  useEffect(() => {
    if (!coverUrl) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('node-vibrant/browser');
        const Vibrant = mod.Vibrant;
        const palette = await Vibrant.from(coverUrl).getPalette();
        if (cancelled) return;

        const vibrant = palette.Vibrant?.hex;
        const darkMuted = palette.DarkMuted?.hex;
        const darkVibrant = palette.DarkVibrant?.hex;
        const muted = palette.Muted?.hex;

        const from = vibrant ?? muted;
        const to = darkMuted ?? darkVibrant ?? muted;

        if (from && to) {
          setMoodColor({ from, to });
        }
      } catch (err) {
        // Silent — the fallback mood color is already applied by AnalysisResults.
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.debug('[SongHero] vibrant palette failed', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coverUrl, setMoodColor]);

  // Clean up the audio element when previewUrl changes / unmount.
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.src = '';
        audioRef.current = null;
      }
    };
  }, [previewUrl]);

  const togglePreview = () => {
    if (!previewUrl) return;
    let el = audioRef.current;
    if (!el) {
      el = new Audio(previewUrl);
      el.preload = 'none';
      el.addEventListener('ended', () => setPlaying(false));
      audioRef.current = el;
    }
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  };

  return (
    <section
      aria-label={`${title} by ${artist}`}
      className={cn(
        'relative overflow-hidden rounded-3xl',
        'border border-[var(--border-subtle)] ring-inset-soft',
        'bg-[var(--bg-elev1)]',
        'min-h-[320px]',
        className,
      )}
    >
      {/* Layer 1 — blurred backdrop cover */}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-cover',
            'scale-[1.4] blur-[60px] opacity-60',
          )}
        />
      )}

      {/* Layer 2 — radial accent mask */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 30% 50%, color-mix(in_oklab, var(--accent-from) 45%, transparent), transparent 60%),' +
            'radial-gradient(ellipse 60% 50% at 90% 20%, color-mix(in_oklab, var(--accent-to) 35%, transparent), transparent 65%),' +
            'linear-gradient(180deg, color-mix(in_oklab, var(--bg-base) 10%, transparent), color-mix(in_oklab, var(--bg-base) 60%, transparent))',
        }}
      />

      {/* Layer 3 — content */}
      <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:gap-8 md:p-8">
        {/* Cover tile */}
        <div
          className={cn(
            'relative shrink-0 overflow-hidden rounded-2xl',
            'h-[180px] w-[180px] md:h-[240px] md:w-[240px]',
            'border border-[var(--border-strong)] ring-inset-soft',
            'shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_40px_var(--accent-glow)]',
          )}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={`${title} cover`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-[var(--bg-elev2)] text-[var(--text-low)]"
            >
              <span className="font-display text-6xl">♪</span>
            </div>
          )}
        </div>

        {/* Text + actions */}
        <div className="min-w-0 flex-1 space-y-3">
          <h1
            className={cn(
              'font-display leading-[0.95] tracking-tight text-[var(--text-hi)]',
              'text-4xl md:text-5xl lg:text-6xl',
              'text-balance',
            )}
          >
            {title}
          </h1>
          <p className="text-xs md:text-sm uppercase tracking-[0.24em] text-[var(--text-med)]">
            <span className="text-[var(--text-hi)]">{artist}</span>
            {album && (
              <>
                <span aria-hidden className="mx-2 opacity-50">
                  ·
                </span>
                <span>{album}</span>
              </>
            )}
          </p>

          {previewUrl && (
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={togglePreview}
                leftIcon={
                  playing ? (
                    <Pause size={14} aria-hidden />
                  ) : (
                    <Play size={14} aria-hidden />
                  )
                }
                aria-label={playing ? 'Pause preview' : 'Play preview'}
              >
                {playing ? 'Pause preview' : 'Play preview'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
