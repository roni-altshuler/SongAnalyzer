/**
 * Fingerprint Web Worker — keeps the STFT + peak pairing off the main thread.
 *
 * Instantiate with the Turbopack-splittable pattern:
 *   new Worker(new URL('./fingerprint.worker.ts', import.meta.url))
 *
 * Message in:  { pcm: Float32Array, sampleRate: number, maxHashes?: number }
 *              (transfer the pcm buffer — it is not used again by the caller)
 * Message out: { ok: true, hashes: FingerprintHash[] } | { ok: false, error: string }
 */

import { fingerprint } from '@/lib/fingerprint/constellation';
import type { FingerprintHash } from '@/lib/fingerprint/types';

export interface FingerprintWorkerRequest {
  pcm: Float32Array;
  sampleRate: number;
  maxHashes?: number;
}

export type FingerprintWorkerResponse =
  | { ok: true; hashes: FingerprintHash[] }
  | { ok: false; error: string };

// `self` is typed as Window under the app's DOM lib — cast once to the
// worker surface we actually use.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<FingerprintWorkerRequest>) => void) | null;
  postMessage(message: FingerprintWorkerResponse): void;
};

ctx.onmessage = (event) => {
  try {
    const { pcm, sampleRate, maxHashes } = event.data;
    const hashes = fingerprint(pcm, sampleRate, maxHashes);
    ctx.postMessage({ ok: true, hashes });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
