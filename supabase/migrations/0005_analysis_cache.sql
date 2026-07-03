-- 0005_analysis_cache.sql
--
-- Durable analysis cache, closing the TODO in lib/analysis/cache.ts.
--
-- Keyed by the SHA-256 of normalized lyrics (lowercase + collapsed
-- whitespace — computed by hashLyrics()). The in-memory LRU stays in front
-- of this table per function instance; this makes cache hits survive cold
-- starts and be shared across instances.
--
-- Access model: SERVICE ROLE ONLY — RLS enabled, no policies. Reads and
-- writes go through lib/db/analysis-cache.ts via the admin client.

create table if not exists public.analysis_cache (
  lyrics_hash text primary key,
  result      jsonb not null,
  hit_count   integer not null default 0,
  created_at  timestamptz not null default now(),
  last_hit_at timestamptz
);

alter table public.analysis_cache enable row level security;
-- Intentionally no policies: only the service role reads or writes.
