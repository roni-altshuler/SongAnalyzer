/**
 * Remote recordings have no verified analysis grant in this application.
 * Provider IDs, URL hosts and a caller's `source: upload` are not permission.
 * Keep this fail-closed policy shared by metadata adapters and server writes.
 * Local files can be measured on-device; no audio-derived data is persisted.
 */
export const AUDIO_PERSISTENCE_DENIAL = {
  status: 'audio_persistence_disabled',
  reason: 'verified_recording_permission_required',
} as const;

export function metadataOnly<T extends { previewUrl?: string }>(song: T): T {
  const metadata = { ...song };
  delete metadata.previewUrl;
  return metadata;
}

/** A lyrics label must not smuggle audio feature payloads into generic JSON. */
const LYRICS_FIELDS = new Set([
  'mood', 'vibe', 'energy', 'sentiment', 'themes', 'detailedAnalysis', 'confidence',
  'wordCount', 'originalLanguage', 'translated', 'engines', 'moodColor',
]);

export function isLyricsResult(result: Record<string, unknown>): boolean {
  return Object.keys(result).every((key) => LYRICS_FIELDS.has(key));
}
