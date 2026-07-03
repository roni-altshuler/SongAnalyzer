/**
 * Audio-features Web Worker — runs the v2 MIR extraction (Meyda + tempo/key)
 * off the main thread.
 *
 * Instantiate with the Turbopack-splittable pattern:
 *   new Worker(new URL('./audio-features.worker.ts', import.meta.url))
 *
 * Message in:  { pcm: Float32Array, sampleRate: number } (transfer the buffer)
 * Message out: { ok: true, features: AudioFeaturesV2 } | { ok: false, error: string }
 */

import { extractFeaturesV2, type AudioFeaturesV2 } from '@/lib/audio/features';

export interface AudioFeaturesWorkerRequest {
  pcm: Float32Array;
  sampleRate: number;
}

export type AudioFeaturesWorkerResponse =
  | { ok: true; features: AudioFeaturesV2 }
  | { ok: false; error: string };

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<AudioFeaturesWorkerRequest>) => void) | null;
  postMessage(message: AudioFeaturesWorkerResponse): void;
};

ctx.onmessage = (event) => {
  try {
    const { pcm, sampleRate } = event.data;
    const features = extractFeaturesV2(pcm, sampleRate);
    ctx.postMessage({ ok: true, features });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
