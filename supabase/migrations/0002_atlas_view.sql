-- ============================================================================
-- SongAnalyzer v2 — Mood Atlas materialized view.
--
-- Aggregates `analyses` joined to `songs` into a per-(artist, genre, mood,
-- period) summary used by the public Mood Atlas dashboard at /atlas.
--
-- The view is intentionally a materialized view rather than a regular view
-- because the atlas page is public and uncached on first hit — we want
-- aggregate queries to return in <10ms even with hundreds of thousands of
-- analyses. The trade-off is staleness: the view must be refreshed
-- explicitly after new public/system_seed analyses land.
--
-- Refresh manually after seeding (or after any large batch insert) via the
-- Supabase SQL editor:
--
--   select public.refresh_atlas_aggregates();
--
-- To enable scheduled refresh in production with pg_cron (NOT enabled here —
-- requires the `pg_cron` extension which is opt-in per Supabase project):
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'refresh-atlas-aggregates',
--     '17 3 * * *',                            -- nightly 03:17 UTC
--     $$ select public.refresh_atlas_aggregates(); $$
--   );
--
-- Migration is idempotent — drops and recreates the view + function so the
-- column list stays in sync with this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Genre extraction helper
--
-- `songs` has no genre column in 0001_init.sql; genres live inside the
-- analyses' `result` jsonb under `result.genre`, or — for system_seed rows
-- written by Stream F — under `result.engines.keyword.genre`. The seeded
-- analyses store genre under `result.genre` directly; we coalesce both
-- paths so a future audio-engine genre classification can populate either.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- atlas_aggregates — materialized view
-- ---------------------------------------------------------------------------
drop materialized view if exists public.atlas_aggregates cascade;

create materialized view public.atlas_aggregates as
select
  s.artist                                                              as artist,
  coalesce(
    nullif(a.result ->> 'genre', ''),
    nullif(a.result -> 'engines' -> 'keyword' ->> 'genre', ''),
    'Unknown'
  )                                                                     as genre,
  coalesce(nullif(a.result ->> 'mood', ''), 'Unknown')                  as mood,
  count(*)::int                                                         as sample_count,
  avg(
    coalesce((a.result ->> 'confidence')::numeric, 0)
  )::numeric(6, 4)                                                      as avg_confidence,
  avg(
    coalesce((a.result ->> 'wordCount')::numeric, 0)
  )::numeric(8, 2)                                                      as avg_word_count,
  coalesce(s.release_year, extract(year from a.created_at)::int)        as period
from public.analyses a
join public.songs s on s.id = a.song_id
where (a.is_public = true or a.system_seed = true)
  and s.artist is not null
group by
  s.artist,
  coalesce(
    nullif(a.result ->> 'genre', ''),
    nullif(a.result -> 'engines' -> 'keyword' ->> 'genre', ''),
    'Unknown'
  ),
  coalesce(nullif(a.result ->> 'mood', ''), 'Unknown'),
  coalesce(s.release_year, extract(year from a.created_at)::int);

comment on materialized view public.atlas_aggregates is
  'Mood Atlas roll-up: per-(artist, genre, mood, year) sample counts and averages over public/system_seed analyses. Refresh via refresh_atlas_aggregates().';

-- ---------------------------------------------------------------------------
-- Indexes — the atlas reads by (artist, period) for artist timelines and
-- (genre, mood) for the genre tiles / mood distribution rollups.
-- ---------------------------------------------------------------------------
create index if not exists atlas_aggregates_artist_period_idx
  on public.atlas_aggregates (artist, period);

create index if not exists atlas_aggregates_genre_mood_idx
  on public.atlas_aggregates (genre, mood);

create index if not exists atlas_aggregates_mood_idx
  on public.atlas_aggregates (mood);

-- ---------------------------------------------------------------------------
-- refresh_atlas_aggregates() — security-definer so anon callers can refresh
-- through a server-only RPC if we ever want to expose it.
--
-- CONCURRENTLY is intentionally NOT used because the view has no unique
-- index — for the seeded volume (<10k rows) the lock-blocking refresh is
-- fast enough and avoids the complexity of declaring + maintaining a
-- unique aggregation key.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_atlas_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.atlas_aggregates;
end;
$$;

comment on function public.refresh_atlas_aggregates() is
  'Refreshes the atlas_aggregates materialized view. Call after seeding or after public analyses are inserted in bulk.';

-- ---------------------------------------------------------------------------
-- Grants — make the view world-readable for the public /atlas dashboard.
-- (Materialized views are not subject to RLS in Postgres; access is purely
-- via GRANT.)
-- ---------------------------------------------------------------------------
grant select on public.atlas_aggregates to anon, authenticated;
grant execute on function public.refresh_atlas_aggregates() to authenticated, service_role;
