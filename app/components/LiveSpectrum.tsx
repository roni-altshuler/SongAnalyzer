'use client';

import { useEffect, useRef, useState } from 'react';
import { Spectrum } from '@/app/components/ui/Spectrum';

interface LiveSpectrumProps {
  /** The Web Audio analyser to visualize; null renders a resting spectrum. */
  analyser: AnalyserNode | null;
  bars?: number;
  className?: string;
}

/**
 * Audio-reactive spectrum — feeds real `AnalyserNode` frequency data into
 * the Spectrum primitive's controlled `levels` mode via requestAnimationFrame.
 *
 * The decorative Spectrum stays SMIL-animated everywhere else; this is the
 * variant for surfaces where actual audio is flowing (Identify's mic
 * listening state).
 */
export default function LiveSpectrum({ analyser, bars = 32, className }: LiveSpectrumProps) {
  // Live levels are only rendered while an analyser is attached; without one
  // the resting baseline renders directly (no state reset needed).
  const [liveLevels, setLiveLevels] = useState<number[] | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    // Skip the top third of bins — mic content is mostly < 8 kHz and the
    // empty top bins would flatten the display.
    const usable = Math.floor(bins.length * 0.66);
    const binsPerBar = Math.max(1, Math.floor(usable / bars));

    const tick = () => {
      analyser.getByteFrequencyData(bins);
      const next: number[] = new Array(bars);
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * binsPerBar;
        for (let j = start; j < start + binsPerBar; j++) sum += bins[j] ?? 0;
        next[i] = Math.max(0.04, sum / (binsPerBar * 255));
      }
      setLiveLevels(next);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [analyser, bars]);

  const levels =
    analyser && liveLevels?.length === bars ? liveLevels : new Array<number>(bars).fill(0.04);

  return <Spectrum bars={bars} levels={levels} className={className} />;
}
