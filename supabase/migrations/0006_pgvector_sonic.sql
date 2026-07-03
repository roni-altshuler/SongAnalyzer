-- 0006_pgvector_sonic.sql
--
-- Sonic fingerprint vectors for "feels like this" similarity search.
--
-- `songs.sonic_vector` is the 48-dim embedding built by lib/audio/vector.ts
-- from the v2 audio features (MFCC/chroma stats, tempo, loudness shape,
-- valence/arousal), L2-normalized for cosine distance. The pgvector column
-- dimension is locked here — `sonic_vector_version` records which extractor
-- produced each vector so a future layout change re-embeds instead of mixing
-- incompatible vectors.
--
-- HNSW over IVFFlat: no training step and better recall at this catalog size.

create extension if not exists vector;

alter table public.songs
  add column if not exists sonic_vector vector(48),
  add column if not exists sonic_vector_version text,
  add column if not exists audio_features_v2 jsonb;

create index if not exists songs_sonic_vector_idx
  on public.songs using hnsw (sonic_vector vector_cosine_ops);

-- Nearest neighbours of a song, by cosine distance. Songs are world-readable
-- (see 0001), so this function is grantable to everyone; writes to the vector
-- column still go only through the service role like every other songs write.
create or replace function public.match_similar_songs(
  source_song uuid,
  match_limit integer default 8
)
returns table (
  id uuid,
  title text,
  artist text,
  cover_url text,
  preview_url text,
  distance real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.title,
    s.artist,
    s.cover_url,
    s.preview_url,
    (s.sonic_vector <=> src.sonic_vector)::real as distance
  from public.songs s,
       (select sonic_vector from public.songs where id = source_song) src
  where s.id <> source_song
    and s.sonic_vector is not null
    and src.sonic_vector is not null
  order by s.sonic_vector <=> src.sonic_vector
  limit least(greatest(match_limit, 1), 24);
$$;

grant execute on function public.match_similar_songs(uuid, integer) to anon, authenticated, service_role;
