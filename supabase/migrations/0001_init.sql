-- ============================================================================
-- SongAnalyzer v2 — initial schema, RLS, and auth.users -> profiles trigger.
--
-- How to run locally (requires Docker for the Supabase CLI):
--   1. From the repo root: `npx supabase start`  (boots local Postgres + Auth + Storage)
--   2. `npx supabase db reset`  (re-applies every migration in supabase/migrations/)
--      Or, to apply this single file on a running DB:
--      `npx supabase db push`  (against a linked project) or
--      `psql "$LOCAL_DB_URL" -f supabase/migrations/0001_init.sql`
--
-- Migration is idempotent: `create ... if not exists` everywhere it's supported.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "citext";          -- (reserved for future case-insensitive cols)

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing profile mirroring auth.users; populated via on_auth_user_created trigger.';

-- ---------------------------------------------------------------------------
-- songs (canonical track records; written by service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.songs (
  id                          uuid primary key default gen_random_uuid(),
  spotify_id                  text unique,
  genius_id                   integer unique,
  musicbrainz_recording_id    uuid,
  title                       text not null,
  artist                      text not null,
  album                       text,
  release_year                integer,
  cover_url                   text,
  preview_url                 text,
  acousticbrainz_features     jsonb,
  created_at                  timestamptz not null default now()
);

create unique index if not exists songs_title_artist_lower_idx
  on public.songs (lower(title), lower(artist));

create index if not exists songs_artist_lower_idx
  on public.songs (lower(artist));

comment on table public.songs is
  'Canonical track records keyed by external IDs (Spotify, Genius, MusicBrainz).';

-- ---------------------------------------------------------------------------
-- analyses
-- ---------------------------------------------------------------------------
create table if not exists public.analyses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  song_id             uuid references public.songs(id) on delete set null,
  mode                text not null check (mode in ('lyrics', 'audio', 'combined')),
  lyrics_excerpt      text check (lyrics_excerpt is null or length(lyrics_excerpt) <= 500),
  audio_storage_path  text,
  result              jsonb not null,
  language            text,
  translated          boolean not null default false,
  is_public           boolean not null default false,
  share_slug          text unique,
  system_seed         boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists analyses_user_id_idx
  on public.analyses (user_id);

create index if not exists analyses_song_id_idx
  on public.analyses (song_id);

create index if not exists analyses_is_public_idx
  on public.analyses (is_public) where is_public = true;

create index if not exists analyses_system_seed_idx
  on public.analyses (system_seed) where system_seed = true;

create index if not exists analyses_created_at_idx
  on public.analyses (created_at desc);

comment on table public.analyses is
  'Lyric/audio/combined analyses. Public when is_public=true; system_seed rows feed the Mood Atlas.';

-- ---------------------------------------------------------------------------
-- shares (1:1 with analyses; world-readable view counters + cached OG image)
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  analysis_id        uuid primary key references public.analyses(id) on delete cascade,
  view_count         integer not null default 0,
  og_image_path      text,
  last_rendered_at   timestamptz
);

comment on table public.shares is
  '1:1 share metadata for analyses. Writes via service role only.';

-- ---------------------------------------------------------------------------
-- Trigger: auto-create a profile when a new auth.users row appears
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper: does this profile have at least one public analysis?
-- Used to expose a minimal profile row when an analysis is shared publicly.
-- security definer so RLS on analyses doesn't recurse into us.
-- ---------------------------------------------------------------------------
create or replace function public.profile_has_public_analysis(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.analyses
    where user_id = profile_id and is_public = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.songs     enable row level security;
alter table public.analyses  enable row level security;
alter table public.shares    enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists "profiles: own row select" on public.profiles;
create policy "profiles: own row select"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles: public read when referenced by public analysis"
  on public.profiles;
create policy "profiles: public read when referenced by public analysis"
  on public.profiles
  for select
  using (public.profile_has_public_analysis(id));

drop policy if exists "profiles: own row update" on public.profiles;
create policy "profiles: own row update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles: own row insert" on public.profiles;
create policy "profiles: own row insert"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- songs ----------------------------------------------------------------------
-- World-readable; writes happen via service role (which bypasses RLS).
drop policy if exists "songs: world select" on public.songs;
create policy "songs: world select"
  on public.songs
  for select
  using (true);

-- analyses -------------------------------------------------------------------
drop policy if exists "analyses: select own or public or seed" on public.analyses;
create policy "analyses: select own or public or seed"
  on public.analyses
  for select
  using (
    auth.uid() = user_id
    or is_public = true
    or system_seed = true
  );

drop policy if exists "analyses: insert as self" on public.analyses;
create policy "analyses: insert as self"
  on public.analyses
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "analyses: update own" on public.analyses;
create policy "analyses: update own"
  on public.analyses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "analyses: delete own" on public.analyses;
create policy "analyses: delete own"
  on public.analyses
  for delete
  using (auth.uid() = user_id);

-- shares ---------------------------------------------------------------------
-- World-readable; writes via service role only (no insert/update/delete policy).
drop policy if exists "shares: world select" on public.shares;
create policy "shares: world select"
  on public.shares
  for select
  using (true);

-- ---------------------------------------------------------------------------
-- Grants — RLS is the gate, but explicit grants keep PostgREST happy.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select                          on public.songs    to anon, authenticated;
grant select                          on public.shares   to anon, authenticated;
grant select, insert, update, delete  on public.analyses to authenticated;
grant select                          on public.analyses to anon;
grant select, insert, update          on public.profiles to authenticated;
grant select                          on public.profiles to anon;
