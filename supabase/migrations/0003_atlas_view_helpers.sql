-- ============================================================================
-- SongAnalyzer v2 — Atlas helper view.
--
-- `analyses_with_song` is a thin left-join of analyses to songs so the
-- atlas server queries can pull `artist`, `title`, `release_year`,
-- `cover_url`, etc. alongside `result`, `share_slug`, `mood`, and
-- `created_at` in a single round-trip.
--
-- Why a view (not a join in queries.ts):
--   - keeps the SQL surface area for /atlas in version control alongside
--     the schema, so a future query change doesn't drift from indexes
--   - the view is `security_invoker = true` so it inherits the RLS
--     decisions of the underlying `analyses` and `songs` tables — anon
--     users see the same rows they could see by joining manually
-- ============================================================================

drop view if exists public.analyses_with_song cascade;

create view public.analyses_with_song
with (security_invoker = true) as
select
  a.id              as analysis_id,
  a.user_id         as user_id,
  a.song_id         as song_id,
  a.mode            as mode,
  a.result          as result,
  a.lyrics_excerpt  as lyrics_excerpt,
  a.language        as language,
  a.translated      as translated,
  a.is_public       as is_public,
  a.share_slug      as share_slug,
  a.system_seed     as system_seed,
  a.created_at      as created_at,
  s.title           as title,
  s.artist          as artist,
  s.album           as album,
  s.release_year    as release_year,
  s.cover_url       as cover_url,
  s.preview_url     as preview_url
from public.analyses a
left join public.songs s on s.id = a.song_id;

comment on view public.analyses_with_song is
  'Convenience join of analyses + songs for dashboard queries. Inherits RLS via security_invoker, so anon clients see only public/system_seed rows.';

grant select on public.analyses_with_song to anon, authenticated;
