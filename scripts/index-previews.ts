/**
 * Bulk-index the fingerprint catalog from existing Spotify previews.
 *
 *   npm run seed:fingerprints
 *
 * Iterates `songs` rows that have a `preview_url`, decodes each 30s MP3 with
 * mpg123-decoder (WASM — devDependency, never bundled into the app), runs the
 * exact same `fingerprint()` the client worker uses, and ingests with
 * `source: 'seed'`.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — read from
 * the environment or `.env.local`. Songs already at the re-ingest threshold
 * are skipped, so the script is idempotent and safe to re-run.
 *
 * Runs under `tsx --conditions=react-server` so the `server-only` marker in
 * the ingest module resolves to its empty react-server build (the same
 * reason vitest.config.mts aliases it).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Minimal .env.local loader (no dotenv dependency) ────────
function loadEnvLocal(): void {
  for (const file of ['.env.local', '.env']) {
    let raw: string;
    try {
      raw = readFileSync(resolve(process.cwd(), file), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvLocal();

async function main(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'seed:fingerprints requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(set them in the environment or .env.local).',
    );
    process.exit(1);
  }

  // Deferred imports: env must be loaded before the admin client initializes.
  const [{ getAdminSupabase }, { fingerprint }, { ingestFingerprints, REINGEST_THRESHOLD }, { downmixToMono }, { MPEGDecoder }] =
    await Promise.all([
      import('@/lib/supabase/admin'),
      import('@/lib/fingerprint/constellation'),
      import('@/lib/fingerprint/ingest'),
      import('@/lib/audio/pcm'),
      import('mpg123-decoder'),
    ]);

  const supabase = getAdminSupabase();
  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title, artist, preview_url')
    .not('preview_url', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to list songs:', error.message);
    process.exit(1);
  }

  if (!songs || songs.length === 0) {
    console.log('No songs with preview URLs found — nothing to index.');
    return;
  }

  console.log(`Indexing ${songs.length} preview(s)…`);
  const decoder = new MPEGDecoder();
  await decoder.ready;

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const label = `${song.artist} — ${song.title}`;
    try {
      const { count } = await supabase
        .from('song_fingerprints')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', song.id);
      if ((count ?? 0) >= REINGEST_THRESHOLD) {
        skipped++;
        continue;
      }

      const res = await fetch(song.preview_url as string, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`preview fetch failed: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const decoded = decoder.decode(bytes);
      decoder.reset();
      const mono = downmixToMono([...decoded.channelData]);
      const hashes = fingerprint(mono, decoded.sampleRate);
      if (hashes.length === 0) throw new Error('no hashes extracted');

      const result = await ingestFingerprints(song.id, hashes, 'seed');
      if (result.status === 'accepted') {
        indexed++;
        console.log(`  ✓ ${label} (${result.inserted} hashes)`);
      } else {
        skipped++;
        console.log(`  – ${label} (${result.status})`);
      }
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`);
    }
  }

  decoder.free();
  console.log(`Done. indexed=${indexed} skipped=${skipped} failed=${failed}`);
}

void main();
