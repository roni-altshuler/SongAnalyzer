/**
 * `analyzeAudioV2` — the client entry point for audio analysis.
 *
 * Decodes the file with the Web Audio API, runs the v2 MIR extraction in a
 * Web Worker (25s timeout), and composes a result that is an **additive
 * superset** of the v1 shape — every existing renderer keeps working.
 *
 * Fail-soft contract (mirrors the keyword-engine ethos): any failure in the
 * v2 path — worker error, timeout, too-short clip, decode quirk — falls back
 * to the untouched v1 engine in `lib/audio-analysis.ts`, tagged
 * `engineVersion: 'v1-fallback'`. The v1 engine is never modified.
 *
 * Client-side only (Web Audio + Worker APIs).
 */

import { analyzeAudioFile } from '@/lib/audio-analysis';
import type { AudioAnalysisResultV2 } from '@/lib/types';
import { downmixToMono } from './pcm';
import type { AudioFeaturesV2 } from './features';
import { nearestMood } from './mood-map';
import type { AudioFeaturesWorkerResponse } from '@/app/workers/audio-features.worker';

const WORKER_TIMEOUT_MS = 25_000;

export interface DecodedAudio {
  pcm: Float32Array;
  sampleRate: number;
  duration: number;
}

/**
 * Decode any browser-supported audio file to mono PCM. Exported so callers
 * (the analysis hook, IdentifyListener) can decode once and feed both the
 * feature worker and the fingerprint worker from the same buffer.
 */
export async function decodeFileToMono(file: File | Blob): Promise<DecodedAudio> {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
    return {
      pcm: downmixToMono(channels),
      sampleRate: buffer.sampleRate,
      duration: buffer.duration,
    };
  } finally {
    await ctx.close();
  }
}

function runFeatureWorker(pcm: Float32Array, sampleRate: number): Promise<AudioFeaturesV2> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../app/workers/audio-features.worker.ts', import.meta.url));

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('audio feature worker timed out'));
    }, WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<AudioFeaturesWorkerResponse>) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok) resolve(event.data.features);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || 'audio feature worker crashed'));
    };

    worker.postMessage({ pcm, sampleRate }, [pcm.buffer]);
  });
}

// ── v2 descriptor mapping ───────────────────────────────────

function mapVibeV2(f: AudioFeaturesV2): string {
  if (f.bpm > 140 && f.rmsMean > 0.12) return 'High-Energy';
  if (f.bpm > 120 && f.rmsMean > 0.1) return 'Upbeat';
  if (f.rmsMean > 0.16) return 'Intense';
  if (f.scale === 'minor' && f.arousal < -0.3) return 'Moody';
  if (f.rmsMean < 0.05) return 'Mellow';
  if (f.centroidMean < 1200) return 'Warm';
  if (f.centroidMean > 2600 && f.arousal < 0) return 'Dreamy';
  if (f.zcrMean > 0.5) return 'Edgy';
  if (f.arousal < -0.5) return 'Tranquil';
  return 'Laid-back';
}

function mapEnergyV2(f: AudioFeaturesV2): string {
  const score =
    Math.min(1, f.rmsMean * 4) * 40 +
    (f.bpm / 200) * 30 +
    f.zcrMean * 15 +
    f.dynamicRange * 15;
  if (score > 65) return 'Very High';
  if (score > 50) return 'High';
  if (score > 35) return 'Moderate';
  if (score > 20) return 'Low';
  return 'Very Low';
}

function mapSentimentV2(valence: number): string {
  if (valence >= 0.45) return 'Very Positive';
  if (valence >= 0.15) return 'Positive';
  if (valence > -0.15) return 'Neutral/Mixed';
  if (valence > -0.45) return 'Negative';
  return 'Very Negative';
}

function mapTempoLabel(bpm: number): string {
  if (bpm > 150) return 'Very Fast';
  if (bpm > 120) return 'Fast';
  if (bpm > 95) return 'Moderate';
  if (bpm > 70) return 'Slow';
  return 'Very Slow';
}

function characteristicsV2(f: AudioFeaturesV2): string[] {
  const chars: string[] = [];
  if (f.key && f.scale && f.keyStrength > 0.4) chars.push(`In ${f.key} ${f.scale}`);
  if (f.tempoStrength > 0.5) chars.push('Steady, danceable pulse');
  if (f.bpm > 120) chars.push('Uptempo');
  if (f.bpm > 0 && f.bpm < 85) chars.push('Downtempo');
  if (f.rmsMean > 0.14) chars.push('Loud & Powerful');
  if (f.rmsMean < 0.05) chars.push('Soft & Gentle');
  if (f.centroidMean > 3000) chars.push('Bright Tones');
  if (f.centroidMean < 1500) chars.push('Dark / Warm Tones');
  if (f.dynamicRange > 0.5) chars.push('Dynamic');
  if (f.dynamicRange < 0.15) chars.push('Compressed / Consistent');
  return chars.slice(0, 5);
}

function describeV2(f: AudioFeaturesV2, mood: string, vibe: string, energy: string): string {
  const keyPhrase = f.key && f.scale ? ` in ${f.key} ${f.scale}` : '';
  const beatPhrase =
    f.tempoStrength > 0.5
      ? `a steady ${f.bpm} BPM pulse`
      : f.bpm > 0
        ? `a loose ~${f.bpm} BPM feel`
        : 'no strong pulse';

  let text = `This ${Math.round(f.duration)}s clip${keyPhrase} carries a ${mood.toLowerCase()} mood with a ${vibe.toLowerCase()} vibe, driven by ${beatPhrase}. `;
  text += `Overall energy reads ${energy.toLowerCase()}. `;

  const valenceWord = f.valence > 0.15 ? 'bright' : f.valence < -0.15 ? 'dark' : 'ambivalent';
  const arousalWord = f.arousal > 0.15 ? 'charged' : f.arousal < -0.15 ? 'becalmed' : 'even-keeled';
  text += `On the emotion map it sits ${valenceWord} and ${arousalWord} (valence ${f.valence.toFixed(2)}, arousal ${f.arousal.toFixed(2)}).`;

  return text;
}

function composeV2Result(f: AudioFeaturesV2): AudioAnalysisResultV2 {
  const mood = nearestMood({ valence: f.valence, arousal: f.arousal });
  const vibe = mapVibeV2(f);
  const energy = mapEnergyV2(f);
  const sentiment = mapSentimentV2(f.valence);
  const tempo = mapTempoLabel(f.bpm);

  // Duration-based confidence (v1 scheme), nudged by how confidently the
  // rhythm and key resolved.
  let confidence = 0.5;
  if (f.duration > 120) confidence = 0.9;
  else if (f.duration > 60) confidence = 0.84;
  else if (f.duration > 25) confidence = 0.76;
  else if (f.duration > 10) confidence = 0.65;
  confidence = Math.min(0.97, confidence + 0.04 * f.keyStrength + 0.04 * f.tempoStrength);

  return {
    mood,
    vibe,
    energy,
    sentiment,
    tempo,
    bpm: f.bpm,
    characteristics: characteristicsV2(f),
    detailedAnalysis: describeV2(f, mood, vibe, energy),
    confidence: Number(confidence.toFixed(3)),
    duration: f.duration,
    features: {
      bpm: f.bpm,
      rmsEnergy: Math.min(1, Number((f.rmsMean * 4).toFixed(3))),
      spectralCentroid: f.centroidMean,
      dynamicRange: f.dynamicRange,
      zeroCrossingRate: f.zcrMean,
      duration: f.duration,
    },
    engineVersion: 'v2',
    v2: f,
  };
}

/**
 * Run the v2 engine on already-decoded PCM. Throws on any v2 failure —
 * callers that hold the original File should catch and fall back to v1
 * (or use `analyzeAudioV2`, which does exactly that).
 *
 * NOTE: the PCM buffer is transferred to the worker and unusable afterwards.
 * Pass a copy (`pcm.slice()`) if you still need it.
 */
export async function analyzePcmV2(
  pcm: Float32Array,
  sampleRate: number,
): Promise<AudioAnalysisResultV2> {
  const features = await runFeatureWorker(pcm, sampleRate);
  return composeV2Result(features);
}

/**
 * Analyse an audio file with the v2 engine, falling back to v1 on any
 * failure. Never throws for engine reasons — only if even the v1 fallback
 * can't decode the file (which the caller already handles today).
 */
export async function analyzeAudioV2(file: File): Promise<AudioAnalysisResultV2> {
  try {
    const { pcm, sampleRate } = await decodeFileToMono(file);
    return await analyzePcmV2(pcm, sampleRate);
  } catch (err) {
    console.warn('audio v2 engine failed; falling back to v1:', err);
    const v1 = await analyzeAudioFile(file);
    return { ...v1, engineVersion: 'v1-fallback' };
  }
}
