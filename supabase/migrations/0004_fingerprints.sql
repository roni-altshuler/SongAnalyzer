-- 0004_fingerprints.sql
--
-- Constellation fingerprint index backing the Identify feature.
--
-- `song_fingerprints` stores 24-bit packed spectral-peak-pair hashes
-- (f1 | f2 | Δt — see lib/fingerprint/constellation.ts) plus the anchor
-- offset in milliseconds. Hashes are non-reversible: no audio can be
-- reconstructed from them. A 30s preview yields ~1,500–3,000 rows.
--
-- Access model: SERVICE ROLE ONLY. RLS is enabled with no policies, and the
-- matching RPC is revoked from anon/authenticated — matching and ingest go
-- through the admin client in lib/fingerprint/{match,ingest}.ts, which do
-- their own validation and rate limiting.

create table if not exists public.song_fingerprints (
  song_id   uuid    not null references public.songs(id) on delete cascade,
  hash      integer not null,
  offset_ms integer not null,
  source    text    not null default 'preview'
            check (source in ('preview', 'upload', 'seed')),
  primary key (song_id, hash, offset_ms)
);

-- The matching join is `where f.hash = q.h` — this index is the whole game.
create index if not exists song_fingerprints_hash_idx
  on public.song_fingerprints (hash);

alter table public.song_fingerprints enable row level security;
-- Intentionally no policies: only the service role reads or writes.

-- Match a query fingerprint against the catalog.
--
-- Votes are grouped by (song, offset-delta bucket): a true match produces a
-- sharp spike where many hashes agree on the same time alignment. The caller
-- (lib/fingerprint/match.ts) applies the acceptance thresholds.
create or replace function public.match_fingerprints(
  q_hashes  integer[],
  q_offsets integer[]
)
returns table (song_id uuid, votes integer, delta_bucket integer)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    -- Equal-length arrays zip row-wise (Postgres 10+ SRF alignment).
    select unnest(q_hashes) as h, unnest(q_offsets) as t
  )
  select
    f.song_id,
    count(*)::integer as votes,
    ((f.offset_ms - q.t) / 100)::integer as delta_bucket
  from public.song_fingerprints f
  join q on f.hash = q.h
  group by f.song_id, ((f.offset_ms - q.t) / 100)
  order by votes desc
  limit 8;
$$;

revoke all on function public.match_fingerprints(integer[], integer[]) from public;
revoke all on function public.match_fingerprints(integer[], integer[]) from anon, authenticated;
grant execute on function public.match_fingerprints(integer[], integer[]) to service_role;
