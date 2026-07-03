/**
 * RLS contract tests for the Supabase data layer.
 *
 * These tests are gated on `SUPABASE_LOCAL=1` because they require a running
 * local Supabase stack (`npx supabase start`). In CI without Docker they are
 * skipped, so `npm test` stays green.
 *
 * Required env (loaded from .env.local or the shell):
 *   SUPABASE_LOCAL=1
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * What we verify:
 *   1. User A can read their own private analysis.
 *   2. User B CANNOT read user A's private analysis.
 *   3. Both users CAN read a public analysis from either side.
 *   4. User B CANNOT update user A's analysis (rowcount = 0, no error).
 *   5. Service-role insert of an anonymous analysis (user_id = null) succeeds.
 *   6. World can read `songs` and `shares`.
 *   7. The auth.users -> profiles trigger created a profile row for each user.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const SUPABASE_LOCAL = process.env.SUPABASE_LOCAL === '1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * `describe.skipIf` evaluates at collection time, so the suite is silently
 * skipped when SUPABASE_LOCAL is not set. No imports below this point run.
 */
describe.skipIf(!SUPABASE_LOCAL)('RLS contracts (local Supabase only)', () => {
  let admin: SupabaseClient<Database>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;

  let userAId = '';
  let userBId = '';
  let songId = '';
  let privateAnalysisId = '';
  let publicAnalysisId = '';
  let publicShareSlug = '';

  const userAEmail = `rls-a-${Date.now()}@example.test`;
  const userBEmail = `rls-b-${Date.now()}@example.test`;
  const password = 'rls-test-password-123!';

  beforeAll(async () => {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_LOCAL=1 but NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE_KEY are not set.',
      );
    }

    admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create two users via admin API (auto-confirmed).
    const aResp = await admin.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (aResp.error || !aResp.data.user) {
      throw aResp.error ?? new Error('Failed to create user A');
    }
    userAId = aResp.data.user.id;

    const bResp = await admin.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (bResp.error || !bResp.data.user) {
      throw bResp.error ?? new Error('Failed to create user B');
    }
    userBId = bResp.data.user.id;

    // Sign-in clients so RLS sees them as authenticated.
    userAClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    userBClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const aSignIn = await userAClient.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (aSignIn.error) throw aSignIn.error;

    const bSignIn = await userBClient.auth.signInWithPassword({
      email: userBEmail,
      password,
    });
    if (bSignIn.error) throw bSignIn.error;

    // Seed a song (service role bypasses RLS).
    const song = await admin
      .from('songs')
      .insert({
        title: `RLS Test Song ${Date.now()}`,
        artist: 'RLS Test Artist',
      })
      .select('id')
      .single();
    if (song.error) throw song.error;
    songId = song.data.id;

    // User A creates a private analysis (service role to bypass RLS for setup).
    const priv = await admin
      .from('analyses')
      .insert({
        user_id: userAId,
        song_id: songId,
        mode: 'lyrics',
        lyrics_excerpt: 'private excerpt',
        result: { mood: 'reflective' },
        is_public: false,
      })
      .select('id')
      .single();
    if (priv.error) throw priv.error;
    privateAnalysisId = priv.data.id;

    // User A creates a public analysis.
    publicShareSlug = `rls-share-${Date.now()}`;
    const pub = await admin
      .from('analyses')
      .insert({
        user_id: userAId,
        song_id: songId,
        mode: 'lyrics',
        lyrics_excerpt: 'public excerpt',
        result: { mood: 'joyful' },
        is_public: true,
        share_slug: publicShareSlug,
      })
      .select('id')
      .single();
    if (pub.error) throw pub.error;
    publicAnalysisId = pub.data.id;

    await admin
      .from('shares')
      .insert({ analysis_id: publicAnalysisId, view_count: 0 });
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    // Cascades clean up analyses and shares via FK on auth.users -> profiles.
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
    if (songId) await admin.from('songs').delete().eq('id', songId);
  });

  it('creates a profile row via the on_auth_user_created trigger', async () => {
    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .in('id', [userAId, userBId]);

    expect(error).toBeNull();
    expect(data?.length).toBe(2);
  });

  it('user A can read their own private analysis', async () => {
    const { data, error } = await userAClient
      .from('analyses')
      .select('id, lyrics_excerpt')
      .eq('id', privateAnalysisId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(privateAnalysisId);
  });

  it("user B CANNOT read user A's private analysis", async () => {
    const { data, error } = await userBClient
      .from('analyses')
      .select('id')
      .eq('id', privateAnalysisId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('both users can read a public analysis', async () => {
    const a = await userAClient
      .from('analyses')
      .select('id')
      .eq('id', publicAnalysisId)
      .maybeSingle();
    const b = await userBClient
      .from('analyses')
      .select('id')
      .eq('id', publicAnalysisId)
      .maybeSingle();

    expect(a.data?.id).toBe(publicAnalysisId);
    expect(b.data?.id).toBe(publicAnalysisId);
  });

  it("user B CANNOT update user A's analysis", async () => {
    const { data, error } = await userBClient
      .from('analyses')
      .update({ lyrics_excerpt: 'hijacked' })
      .eq('id', publicAnalysisId)
      .select('id');

    // RLS update produces no error but zero affected rows.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Confirm content is unchanged.
    const reread = await admin
      .from('analyses')
      .select('lyrics_excerpt')
      .eq('id', publicAnalysisId)
      .single();
    expect(reread.data?.lyrics_excerpt).toBe('public excerpt');
  });

  it('service role can insert an anonymous analysis (user_id = null)', async () => {
    const { data, error } = await admin
      .from('analyses')
      .insert({
        user_id: null,
        song_id: songId,
        mode: 'lyrics',
        lyrics_excerpt: 'anon insert',
        result: { mood: 'neutral' },
        is_public: false,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();

    if (data?.id) await admin.from('analyses').delete().eq('id', data.id);
  });

  it('songs and shares are world-readable to anonymous clients', async () => {
    const songs = await anonClient
      .from('songs')
      .select('id')
      .eq('id', songId)
      .maybeSingle();
    expect(songs.error).toBeNull();
    expect(songs.data?.id).toBe(songId);

    const shares = await anonClient
      .from('shares')
      .select('analysis_id')
      .eq('analysis_id', publicAnalysisId)
      .maybeSingle();
    expect(shares.error).toBeNull();
    expect(shares.data?.analysis_id).toBe(publicAnalysisId);
  });

  it('anonymous clients CANNOT insert into analyses', async () => {
    const { data, error } = await anonClient
      .from('analyses')
      .insert({
        user_id: null,
        song_id: songId,
        mode: 'lyrics',
        result: { mood: 'sneaky' },
        is_public: false,
      })
      .select('id');

    // RLS should reject the insert outright.
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // ── Identify catalog (0004) + analysis cache (0005): service-role only ──

  it('song_fingerprints is invisible and unwritable to anonymous clients', async () => {
    // Seed one row via the service role so there is something to hide.
    const seed = await admin
      .from('song_fingerprints')
      .upsert(
        { song_id: songId, hash: 12345, offset_ms: 100, source: 'seed' },
        { onConflict: 'song_id,hash,offset_ms', ignoreDuplicates: true },
      );
    expect(seed.error).toBeNull();

    // RLS with no policies: reads come back empty (not an error), writes fail.
    const read = await anonClient.from('song_fingerprints').select('hash').eq('song_id', songId);
    expect(read.data ?? []).toHaveLength(0);

    const write = await anonClient
      .from('song_fingerprints')
      .insert({ song_id: songId, hash: 999, offset_ms: 5, source: 'preview' })
      .select('hash');
    expect(write.error).not.toBeNull();
    expect(write.data ?? []).toHaveLength(0);

    await admin.from('song_fingerprints').delete().eq('song_id', songId);
  });

  it('the match_fingerprints RPC is revoked from anonymous clients', async () => {
    const anonCall = await anonClient.rpc('match_fingerprints', {
      q_hashes: [12345],
      q_offsets: [0],
    });
    expect(anonCall.error).not.toBeNull();

    // The service role can still execute it.
    const adminCall = await admin.rpc('match_fingerprints', {
      q_hashes: [12345],
      q_offsets: [0],
    });
    expect(adminCall.error).toBeNull();
  });

  it('analysis_cache is invisible and unwritable to anonymous clients', async () => {
    const hash = 'rls-test-hash';
    const seed = await admin
      .from('analysis_cache')
      .upsert({ lyrics_hash: hash, result: { mood: 'Peaceful' } });
    expect(seed.error).toBeNull();

    const read = await anonClient.from('analysis_cache').select('lyrics_hash').eq('lyrics_hash', hash);
    expect(read.data ?? []).toHaveLength(0);

    const write = await anonClient
      .from('analysis_cache')
      .insert({ lyrics_hash: 'sneaky', result: { mood: 'x' } })
      .select('lyrics_hash');
    expect(write.error).not.toBeNull();
    expect(write.data ?? []).toHaveLength(0);

    await admin.from('analysis_cache').delete().eq('lyrics_hash', hash);
  });
});
