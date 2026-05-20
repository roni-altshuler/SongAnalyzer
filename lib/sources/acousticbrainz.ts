import 'server-only';

import type { AcousticFeatures } from './types';

/**
 * AcousticBrainz adapter.
 *
 * AcousticBrainz exposes open audio descriptors (BPM, key, danceability,
 * mood probabilities) keyed by MusicBrainz recording ID. The project
 * **stopped accepting new submissions in early 2022**, so coverage on
 * post-2022 tracks is effectively zero. Returning `null` for a missing
 * recording is the expected path; callers should fall back to the client-
 * side analyser on the Spotify 30-second preview instead of treating it as
 * an error. See the v2 plan, "External data sources" section.
 *
 * No API key is needed.
 */

const ENDPOINT_LOWLEVEL = 'https://acousticbrainz.org/api/v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ABLowLevelResponse {
  rhythm?: { bpm?: number };
  tonal?: { key_key?: string; key_scale?: 'major' | 'minor' };
  lowlevel?: { average_loudness?: number };
  highlevel?: {
    danceability?: { all?: { danceable?: number } };
    mood_happy?: { all?: { happy?: number } };
  };
}

/**
 * Fetch low-level + high-level descriptors for a MusicBrainz recording.
 *
 * Returns `null` for any of:
 *   - malformed `recordingId` (defensive)
 *   - 404 from AcousticBrainz (no submission on file)
 *   - network/timeout errors (caller's resilience layer handles the fallback)
 */
export async function getAcousticBrainzFeatures(
  recordingId: string,
): Promise<AcousticFeatures | null> {
  if (!UUID_RE.test(recordingId)) return null;

  const url = `${ENDPOINT_LOWLEVEL}/${recordingId}/low-level`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }

  if (res.status === 404) return null;
  if (!res.ok) return null;

  let json: ABLowLevelResponse;
  try {
    json = (await res.json()) as ABLowLevelResponse;
  } catch {
    return null;
  }

  const features: AcousticFeatures = {};
  if (typeof json.rhythm?.bpm === 'number') features.bpm = json.rhythm.bpm;
  if (json.tonal?.key_key) features.key = json.tonal.key_key;
  if (json.tonal?.key_scale === 'major' || json.tonal?.key_scale === 'minor') {
    features.scale = json.tonal.key_scale;
  }
  const danceable = json.highlevel?.danceability?.all?.danceable;
  if (typeof danceable === 'number') features.danceability = danceable;
  const happy = json.highlevel?.mood_happy?.all?.happy;
  if (typeof happy === 'number') features.valence = happy;
  if (typeof json.lowlevel?.average_loudness === 'number') {
    features.loudness = json.lowlevel.average_loudness;
    // average_loudness from AB is already in 0..1 range; expose it as energy too.
    features.energy = Math.max(0, Math.min(1, json.lowlevel.average_loudness));
  }

  return Object.keys(features).length > 0 ? features : null;
}
