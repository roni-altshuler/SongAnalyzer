/**
 * Server ingestion fails closed until recording permission can be verified.
 * A client source label and a seed script caller cannot supply that grant.
 * Existing catalog records remain readable and unchanged.
 */
import 'server-only';
import type { FingerprintHash, FingerprintSource } from './types';

export const REINGEST_THRESHOLD = 500;
export type IngestResult = { status: 'audio_persistence_disabled' };

export async function ingestFingerprints(
  _songId: string, _hashes: FingerprintHash[], _source: FingerprintSource,
): Promise<IngestResult> {
  return { status: 'audio_persistence_disabled' };
}
