'use client';

/**
 * Client-side runners for the audio Web Workers, colocated with the worker
 * entry files so the `new Worker(new URL(...))` pattern stays in one place
 * (Turbopack code-splits each worker into its own chunk).
 */

import type { FingerprintHash } from '@/lib/fingerprint/types';
import type { FingerprintWorkerResponse } from './fingerprint.worker';

const FINGERPRINT_TIMEOUT_MS = 15_000;

/**
 * Compute constellation hashes off the main thread.
 *
 * The PCM buffer is transferred (not copied) — pass `pcm.slice()` when the
 * caller still needs the samples afterwards.
 */
export function computeFingerprint(
  pcm: Float32Array,
  sampleRate: number,
  maxHashes?: number,
): Promise<FingerprintHash[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fingerprint.worker.ts', import.meta.url));

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('fingerprint worker timed out'));
    }, FINGERPRINT_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<FingerprintWorkerResponse>) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok) resolve(event.data.hashes);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || 'fingerprint worker crashed'));
    };

    worker.postMessage({ pcm, sampleRate, maxHashes }, [pcm.buffer as ArrayBuffer]);
  });
}
