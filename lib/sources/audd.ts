import 'server-only';

/**
 * AudD music recognition adapter — the *fallback* path for `/api/identify`.
 *
 * The primary identification path is our own constellation catalog
 * (lib/fingerprint/*), which is free and covers every song the app has
 * analysed. AudD covers the world catalog for over-the-air snippets we
 * haven't indexed — at a per-request cost, which is why:
 *   - it is env-gated on `AUDD_API_TOKEN` (skipped cleanly when unset),
 *   - the relay route sits behind the strictest rate-limit bucket, and
 *   - the client only calls it after explicit user consent on a miss.
 *
 * Only the snippet the user just recorded is relayed; AudD's response is
 * used solely to run `resolveSong()` — we never store the audio.
 */

const AUDD_ENDPOINT = 'https://api.audd.io/';

export class AuddNotConfiguredError extends Error {
  constructor() {
    super('AUDD_API_TOKEN must be set');
    this.name = 'AuddNotConfiguredError';
  }
}

export function isAuddConfigured(): boolean {
  return Boolean(process.env.AUDD_API_TOKEN);
}

export interface AuddRecognition {
  title: string;
  artist: string;
  album?: string;
}

/**
 * Recognize a short audio snippet. Returns null when AudD finds no match.
 * Throws `AuddNotConfiguredError` without a token and `Error` on transport
 * or API failures — callers translate those into fail-soft responses.
 */
export async function recognizeAudd(audio: Blob): Promise<AuddRecognition | null> {
  const token = process.env.AUDD_API_TOKEN;
  if (!token) throw new AuddNotConfiguredError();

  const form = new FormData();
  form.set('api_token', token);
  form.set('file', audio, 'snippet');

  const res = await fetch(AUDD_ENDPOINT, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`AudD request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    status?: string;
    error?: { error_message?: string };
    result?: { title?: string; artist?: string; album?: string } | null;
  };

  if (json.status !== 'success') {
    throw new Error(`AudD returned error: ${json.error?.error_message ?? 'unknown'}`);
  }

  if (!json.result?.title || !json.result?.artist) return null;

  return {
    title: json.result.title,
    artist: json.result.artist,
    album: json.result.album || undefined,
  };
}
