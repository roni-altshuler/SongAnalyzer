/**
 * Audio intelligence v2 — real MIR feature extraction.
 *
 * Meyda (MIT, ~40KB — loaded only in the worker chunk) supplies the per-frame
 * primitives that are genuinely hard to hand-roll (MFCC, chroma); spectral
 * centroid and flux are computed from Meyda's amplitude spectrum directly in
 * Hz so there is no unit ambiguity. Tempo (lib/audio/tempo.ts) and key
 * (lib/audio/key.ts) run on top of the frame series.
 *
 * Runs inside `app/workers/audio-features.worker.ts`. The v1 engine in
 * `lib/audio-analysis.ts` is untouched and remains the fail-soft fallback —
 * see `lib/audio/analyze.ts`.
 */

import Meyda from 'meyda';

import { resampleTo } from './pcm';
import { audioAffect } from './mood-map';
import { detectKey } from './key';
import { estimateTempo } from './tempo';

export const ANALYSIS_SAMPLE_RATE = 22_050;
export const FRAME_SIZE = 2_048;
export const HOP_SIZE = 512;
/** fluxSeries is downsampled to at most this many points for visualization. */
export const FLUX_SERIES_POINTS = 200;

export interface AudioFeaturesV2 {
  duration: number;
  // Rhythm
  bpm: number;
  beatGrid: number[];
  tempoStrength: number;
  // Harmony
  key: string | null;
  scale: 'major' | 'minor' | null;
  keyStrength: number;
  chromaMean: number[]; // 12 bins, max-normalized 0..1
  // Timbre
  mfccMean: number[]; // 13
  mfccStd: number[]; // 13
  centroidMean: number; // Hz
  centroidStd: number; // Hz
  // Loudness / texture
  rmsMean: number;
  rmsStd: number;
  dynamicRange: number; // 0..1, v1-comparable
  zcrMean: number; // 0..1, v1-comparable
  fluxMean: number; // 0..1 (self-normalized series)
  fluxStd: number;
  fluxSeries: number[]; // ≤ FLUX_SERIES_POINTS values in 0..1
  // Affect
  valence: number;
  arousal: number;
}

const mean = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const std = (values: number[], m = mean(values)): number =>
  values.length
    ? Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length)
    : 0;

/** Spectral centroid in Hz from an amplitude spectrum. */
function centroidHz(spectrum: Float32Array, sampleRate: number, frameSize: number): number {
  let weighted = 0;
  let total = 0;
  for (let k = 0; k < spectrum.length; k++) {
    weighted += ((k * sampleRate) / frameSize) * spectrum[k];
    total += spectrum[k];
  }
  return total > 0 ? weighted / total : 0;
}

/** Half-wave rectified spectral flux between consecutive spectra. */
function fluxBetween(prev: Float32Array | null, current: Float32Array): number {
  if (!prev) return 0;
  let sum = 0;
  for (let k = 0; k < current.length; k++) {
    const diff = current[k] - prev[k];
    if (diff > 0) sum += diff * diff;
  }
  return Math.sqrt(sum) / current.length;
}

/** Block-mean downsample a series to at most `points` values. */
function downsample(series: number[], points: number): number[] {
  if (series.length <= points) return series;
  const out: number[] = new Array(points);
  const step = series.length / points;
  for (let i = 0; i < points; i++) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    out[i] = mean(series.slice(start, end));
  }
  return out;
}

/**
 * Extract the full v2 feature set from a mono PCM buffer.
 * Throws on clips too short to frame — callers fall back to the v1 engine.
 */
export function extractFeaturesV2(
  pcm: Float32Array,
  sampleRate: number,
): AudioFeaturesV2 {
  const signal = resampleTo(pcm, sampleRate, ANALYSIS_SAMPLE_RATE);
  const frameCount = Math.floor((signal.length - FRAME_SIZE) / HOP_SIZE) + 1;
  if (frameCount < 8) {
    throw new Error('clip too short for v2 feature extraction');
  }

  Meyda.sampleRate = ANALYSIS_SAMPLE_RATE;
  Meyda.bufferSize = FRAME_SIZE;

  const rmsSeries: number[] = [];
  const zcrSeries: number[] = [];
  const centroidSeries: number[] = [];
  const fluxRaw: number[] = [];
  const mfccFrames: number[][] = [];
  const chromaSum = new Array<number>(12).fill(0);

  const frame = new Float32Array(FRAME_SIZE);
  let prevSpectrum: Float32Array | null = null;

  for (let i = 0; i < frameCount; i++) {
    frame.set(signal.subarray(i * HOP_SIZE, i * HOP_SIZE + FRAME_SIZE));

    const features = Meyda.extract(
      ['rms', 'zcr', 'mfcc', 'chroma', 'amplitudeSpectrum'],
      frame,
    ) as {
      rms?: number;
      zcr?: number;
      mfcc?: number[];
      chroma?: number[];
      amplitudeSpectrum?: Float32Array;
    } | null;

    if (!features?.amplitudeSpectrum) continue;

    rmsSeries.push(features.rms ?? 0);
    zcrSeries.push((features.zcr ?? 0) / FRAME_SIZE);
    centroidSeries.push(centroidHz(features.amplitudeSpectrum, ANALYSIS_SAMPLE_RATE, FRAME_SIZE));
    fluxRaw.push(fluxBetween(prevSpectrum, features.amplitudeSpectrum));
    prevSpectrum = features.amplitudeSpectrum.slice();

    if (features.mfcc?.length) mfccFrames.push(features.mfcc.slice(0, 13));
    if (features.chroma?.length === 12) {
      for (let c = 0; c < 12; c++) chromaSum[c] += features.chroma[c];
    }
  }

  if (rmsSeries.length < 8) {
    throw new Error('v2 feature extraction produced too few frames');
  }

  // Self-normalize flux to 0..1 (its absolute scale depends on level).
  const fluxMax = Math.max(...fluxRaw, 1e-9);
  const fluxNorm = fluxRaw.map((v) => v / fluxMax);

  const chromaMax = Math.max(...chromaSum, 1e-9);
  const chromaMean = chromaSum.map((v) => Number((v / chromaMax).toFixed(4)));

  const mfccMean: number[] = new Array(13).fill(0);
  const mfccStd: number[] = new Array(13).fill(0);
  if (mfccFrames.length > 0) {
    for (let c = 0; c < 13; c++) {
      const series = mfccFrames.map((f) => f[c] ?? 0);
      mfccMean[c] = mean(series);
      mfccStd[c] = std(series, mfccMean[c]);
    }
  }

  const hopSeconds = HOP_SIZE / ANALYSIS_SAMPLE_RATE;
  const tempo = estimateTempo(fluxRaw, hopSeconds);
  const keyEstimate = detectKey(chromaMean);

  const rmsMean = mean(rmsSeries);
  const rmsStd = std(rmsSeries, rmsMean);
  const centroidMean = mean(centroidSeries);
  const fluxMean = mean(fluxNorm);

  const affect = audioAffect({
    bpm: tempo?.bpm ?? 100,
    rmsMean,
    fluxMean,
    centroidMean,
    scale: keyEstimate?.scale ?? null,
    keyStrength: keyEstimate?.strength ?? 0,
  });

  return {
    duration: pcm.length / sampleRate,
    bpm: tempo?.bpm ?? 0,
    beatGrid: tempo?.beatGrid ?? [],
    tempoStrength: tempo?.strength ?? 0,
    key: keyEstimate?.key ?? null,
    scale: keyEstimate?.scale ?? null,
    keyStrength: Number((keyEstimate?.strength ?? 0).toFixed(3)),
    chromaMean,
    mfccMean: mfccMean.map((v) => Number(v.toFixed(4))),
    mfccStd: mfccStd.map((v) => Number(v.toFixed(4))),
    centroidMean: Number(centroidMean.toFixed(1)),
    centroidStd: Number(std(centroidSeries, centroidMean).toFixed(1)),
    rmsMean: Number(rmsMean.toFixed(4)),
    rmsStd: Number(rmsStd.toFixed(4)),
    dynamicRange: Math.min(1, Number((rmsStd * 8).toFixed(3))),
    zcrMean: Math.min(1, Number((mean(zcrSeries) * 10).toFixed(3))),
    fluxMean: Number(fluxMean.toFixed(4)),
    fluxStd: Number(std(fluxNorm, fluxMean).toFixed(4)),
    fluxSeries: downsample(fluxNorm, FLUX_SERIES_POINTS).map((v) => Number(v.toFixed(4))),
    valence: affect.valence,
    arousal: affect.arousal,
  };
}
