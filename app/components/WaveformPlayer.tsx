'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Headphones } from 'lucide-react';
import type WaveSurferType from 'wavesurfer.js';
import type RegionsType from 'wavesurfer.js/dist/plugins/regions.js';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatAudioTime, listeningWindows, windowAt, windowGridTicks, windowLevel, WAVEFORM_SAMPLE_RATE } from '@/lib/audio/listening-windows';

export interface WaveformPlayerProps {
  /** Only a user-selected local File; remote audio has no analysis grant. */
  src: File;
  height?: number;
  /** Existing worker estimates, never computed by WaveSurfer. */
  beatGrid?: number[];
  /** Legacy analysis duration; playback timing uses the decoded File instead. */
  duration?: number;
  className?: string;
}

interface PlayerState {
  src: File;
  status: 'loading' | 'ready' | 'error';
  playing: boolean;
  pending: boolean;
  time: number;
  duration: number;
  decoded: AudioBuffer | null;
  selected: number;
  playbackError: boolean;
}
const initial = (src: File): PlayerState => ({ src, status: 'loading', playing: false, pending: false,
  time: 0, duration: 0, decoded: null, selected: 0, playbackError: false });
const levelText = (value: number | null) => value === null ? 'Silent (−∞)' : `${value.toFixed(1)} dBFS`;

/** WaveSurfer supplies visualization/playback. Signal measurements use local PCM. */
export default function WaveformPlayer({ src, height = 80, beatGrid, className }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferType | null>(null);
  const regionsRef = useRef<RegionsType | null>(null);
  const pendingRef = useRef(false);
  const [session, setSession] = useState(() => initial(src));
  const [retry, setRetry] = useState(0);
  // A replacement file can never render the previous file's controls/details.
  const player = session.src === src ? session : initial(src);
  const windows = useMemo(() => listeningWindows(player.duration), [player.duration]);
  const selected = windows[player.selected];
  const level = useMemo(() => selected ? windowLevel(player.decoded, selected) : null, [player.decoded, selected]);
  const gridTicks = useMemo(() => selected ? windowGridTicks(beatGrid, selected, player.duration) : null, [beatGrid, selected, player.duration]);

  useEffect(() => {
    let disposed = false;
    let owned: WaveSurferType | null = null;
    let colorsObserver: MutationObserver | null = null;
    pendingRef.current = false;
    const update = (change: Partial<PlayerState>) => {
      if (!disposed) setSession(previous => previous.src === src ? { ...previous, ...change } : previous);
    };
    void (async () => {
      await Promise.resolve();
      if (disposed) return;
      setSession(initial(src));
      try {
        const [wave, regionsModule, timelineModule] = await Promise.all([
          import('wavesurfer.js'), import('wavesurfer.js/dist/plugins/regions.js'), import('wavesurfer.js/dist/plugins/timeline.js'),
        ]);
        if (disposed || !containerRef.current) return;
        const styles = getComputedStyle(containerRef.current);
        const color = (token: string) => styles.getPropertyValue(token).trim() || 'currentColor';
        const regions = regionsModule.default.create();
        const ws = wave.default.create({
          container: containerRef.current, height, waveColor: color('--text-med'), progressColor: color('--accent-from'),
          cursorColor: color('--text-hi'), barWidth: 2, barGap: 1, barRadius: 2, normalize: true,
          backend: 'MediaElement', sampleRate: WAVEFORM_SAMPLE_RATE,
          plugins: [regions, timelineModule.default.create({ height: 22, style: { color: color('--text-med'), fontSize: '11px', fontFamily: 'var(--font-mono)' } })],
        });
        owned = ws; wsRef.current = ws; regionsRef.current = regions;
        // Canvas colors need a redraw when theme or the clip-wide mood changes.
        colorsObserver = new MutationObserver(() => {
          if (!disposed) ws.setOptions({ waveColor: color('--text-med'), progressColor: color('--accent-from'), cursorColor: color('--text-hi') });
        });
        colorsObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
        ws.on('ready', actualDuration => {
          if (!Number.isFinite(actualDuration) || actualDuration <= 0) { update({ status: 'error' }); return; }
          update({ status: 'ready', duration: actualDuration, decoded: ws.getDecodedData() });
        });
        ws.on('play', () => update({ playing: true }));
        ws.on('pause', () => update({ playing: false }));
        ws.on('finish', () => update({ playing: false }));
        ws.on('timeupdate', time => update({ time }));
        ws.on('interaction', time => {
          ws.pause();
          update({ selected: windowAt(listeningWindows(ws.getDuration()), time), playbackError: false });
        });
        ws.on('error', () => update({ status: 'error', playing: false, pending: false }));
        await ws.loadBlob(src);
      } catch {
        // A destroyed loading player aborts its decode; no late navigation error.
        if (!disposed) update({ status: 'error', playing: false, pending: false });
      }
    })();
    return () => {
      disposed = true;
      colorsObserver?.disconnect();
      if (owned) { owned.pause(); owned.destroy(); }
      if (wsRef.current === owned) { wsRef.current = null; regionsRef.current = null; }
    };
  }, [src, height, retry]);

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !selected || player.status !== 'ready') return;
    regions.clearRegions();
    regions.addRegion({ id: 'listening-window', ...selected, drag: false, resize: false,
      color: 'color-mix(in srgb, var(--accent-from) 12%, transparent)' });
  }, [selected, player.status]);

  const update = (change: Partial<PlayerState>) => setSession(previous => previous.src === src ? { ...previous, ...change } : previous);
  const choose = (index: number) => {
    const ws = wsRef.current;
    if (!ws || pendingRef.current || !windows[index]) return;
    ws.pause(); ws.setTime(windows[index].start);
    update({ selected: index, playbackError: false });
  };
  const seek = (time: number) => {
    const ws = wsRef.current;
    if (!ws || pendingRef.current) return;
    ws.pause(); ws.setTime(time);
    update({ selected: windowAt(windows, time), playbackError: false });
  };
  const toggle = async () => {
    const ws = wsRef.current;
    if (!ws || !selected || pendingRef.current) return;
    if (ws.isPlaying()) { ws.pause(); return; }
    pendingRef.current = true;
    update({ pending: true, playbackError: false });
    try {
      const time = ws.getCurrentTime();
      await ws.play(time >= selected.start && time < selected.end ? time : selected.start, selected.end);
    } catch {
      if (wsRef.current === ws) update({ playbackError: true, playing: false });
    } finally {
      if (wsRef.current === ws) { pendingRef.current = false; update({ pending: false }); }
    }
  };
  const ready = player.status === 'ready';
  return (
    <Card role="region" aria-label="Local listening timeline" aria-busy={player.status === 'loading'} className={cn('local-timeline min-w-0 space-y-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-med)]">Listen more closely</p><h2 className="font-display text-3xl">Listening windows</h2><p className="mt-2 break-words text-xs text-[var(--text-med)]">{src.name} · local file · this session</p></div>
        <Headphones size={22} aria-hidden="true" className="shrink-0 text-[var(--text-med)]" />
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-med)]">Select a window to inspect its signal and listen to that passage. These timed windows do not identify musical sections.</p>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] p-3">
        {player.status === 'loading' && <div role="status" className="space-y-3"><p className="text-sm text-[var(--text-med)]">Preparing local waveform…</p><Skeleton className="h-12 w-full" /></div>}
        {/* The pointer waveform has native keyboard range/button equivalents below. */}
        <div ref={containerRef} aria-hidden="true" className={cn('min-w-0', !ready && 'hidden', player.pending && 'pointer-events-none')} />
        {player.status === 'error' && <div role="alert" className="space-y-3"><p className="text-sm text-[var(--text-med)]">The local waveform could not load. Your analysis is still available below.</p><Button variant="secondary" className="min-h-11" onClick={() => setRetry(value => value + 1)}>Retry waveform</Button></div>}
      </div>
      {ready && selected && <>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" className="min-h-11" onClick={() => void toggle()} disabled={player.pending} aria-label={player.playing ? 'Pause' : 'Play'} leftIcon={player.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}>{player.playing ? 'Pause' : 'Play'}</Button>
          <Button variant="ghost" className="min-h-11" onClick={() => choose(player.selected)} disabled={player.pending} leftIcon={<RotateCcw size={15} aria-hidden="true" />}>Restart window</Button>
          <p className="ml-auto font-mono text-xs tabular-nums text-[var(--text-med)]"><span data-testid="playback-time">{formatAudioTime(player.time)}</span> / {formatAudioTime(player.duration)}</p>
        </div>
        <label className="block space-y-2 text-xs text-[var(--text-med)]">Playback position
          <input type="range" min={0} max={player.duration} step={0.05} value={Math.min(player.time, player.duration)} disabled={player.pending}
            aria-valuetext={formatAudioTime(player.time)} onChange={event => seek(Number(event.target.value))}
            className="block h-11 w-full cursor-pointer accent-[var(--accent-from)] focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2" />
        </label>
        <div role="group" aria-label="Listening windows" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {windows.map((window, index) => <Button key={index} variant={index === player.selected ? 'secondary' : 'ghost'} disabled={player.pending}
            aria-pressed={index === player.selected} aria-label={`Select window ${index + 1}, ${formatAudioTime(window.start)}–${formatAudioTime(window.end)}`}
            onClick={() => choose(index)} className={cn('h-auto min-h-14 flex-col items-start gap-1 px-3 py-2 text-left', index === player.selected && 'border-[var(--accent-from)]')}>
            <span className="text-xs">Window {index + 1}</span><span className="font-mono text-[11px] text-[var(--text-med)]">{formatAudioTime(window.start)}–{formatAudioTime(window.end)}</span>
          </Button>)}
        </div>
        <section aria-label="Selected window detail" className="space-y-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elev2)] p-4">
          <div><p role="status" className="mb-1 text-xs text-[var(--text-med)]">Selected window {player.selected + 1} · {formatAudioTime(selected.start)}–{formatAudioTime(selected.end)}</p><h3 className="font-display text-2xl">The signal in this passage</h3></div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-[var(--text-med)]">RMS signal level</dt><dd className="mt-1 font-mono">{level?.status === 'ready' ? levelText(level.rmsDb) : 'Unavailable'}</dd></div>
            <div><dt className="text-xs text-[var(--text-med)]">Peak signal level</dt><dd className="mt-1 font-mono">{level?.status === 'ready' ? levelText(level.peakDb) : 'Unavailable'}</dd></div>
            <div><dt className="text-xs text-[var(--text-med)]">Estimated grid ticks</dt><dd className="mt-1 font-mono">{gridTicks ?? 'Unavailable'}</dd></div>
            <div><dt className="text-xs text-[var(--text-med)]">Window length</dt><dd className="mt-1 font-mono">{(selected.end - selected.start).toFixed(1)} s</dd></div>
          </dl>
          <p className="text-xs leading-relaxed text-[var(--text-med)]">Signal levels come from local waveform PCM at 22.05 kHz; they are not perceived loudness. Grid ticks come from the clip-wide worker estimate, not detected drum hits. Mood, key and tempo below describe the whole clip.</p>
          {level?.status === 'too-long' && <p className="text-xs text-[var(--text-med)]">Signal measurements are unavailable for this long window. A shorter clip gives a more detailed view.</p>}
          {gridTicks === null && <p className="text-xs text-[var(--text-med)]">This reading has no timed beat grid. Window playback and signal measurements remain available.</p>}
        </section>
        {player.playbackError && <p role="alert" className="text-sm text-[var(--state-error)]">Playback could not start. Try Play again, or choose another file.</p>}
        <p className="text-xs text-[var(--text-med)]">Play stops at the window’s end. Choosing another window pauses playback. Nothing is uploaded, indexed or saved.</p>
      </>}
    </Card>
  );
}
