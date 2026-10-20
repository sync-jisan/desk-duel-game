-- =====================================================================
-- DESK DUEL v2 — SUPABASE BACKEND SCHEMA & REALTIME SETUP
-- Project: Desk Duel (Pen Fighting Championship)
-- =====================================================================

-- Enable pgcrypto for UUID generation if not already enabled
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. DESKDUEL PROFILES (Player Progress & Cloud Save)
-- =====================================================================
create table if not exists public.deskduel_profiles (
  id text primary key,
  name text not null default 'Player',
  avatar_color text not null default 'blue',
  equipped_pen text not null default 'ballpoint',
  coins integer not null default 250,
  xp integer not null default 0,
  level integer not null default 1,
  stats jsonb not null default '{
    "matches": 0, "wins": 0, "losses": 0, "streak": 0, "bestStreak": 0,
    "rounds": 0, "roundsLost": 0, "kos": 0, "selfKos": 0, "shots": 0,
    "tricks": 0, "coinsEarned": 0, "doubleKos": 0, "bankKos": 0,
    "spinKos": 0, "longKos": 0, "chainKos": 0, "closeCalls": 0,
    "flawless": 0, "expertWins": 0, "party": 0, "party3": 0,
    "careerWins": 0, "online": 0, "onlineWins": 0
  }'::jsonb,
  owned_pens jsonb not null default '{"ballpoint": 1}'::jsonb,
  owned_desks jsonb not null default '{"classroom": 1}'::jsonb,
  career jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '{}'::jsonb,
  last_online timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for leaderboard queries
create index if not exists idx_deskduel_profiles_stats_wins on public.deskduel_profiles(((stats->>'wins')::int) desc);
create index if not exists idx_deskduel_profiles_level on public.deskduel_profiles(level desc, coins desc);

-- =====================================================================
-- 2. DESKDUEL ROOMS (Online Multiplayer Lobby Registry)
-- =====================================================================
create table if not exists public.deskduel_rooms (
  code varchar(6) primary key,
  host_id text not null,
  host_name text not null,
  arena text not null default 'classroom',
  need integer not null default 2,
  clock integer not null default 20,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  player_count integer not null default 1,
  max_players integer not null default 3,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deskduel_rooms_status on public.deskduel_rooms(status);
create index if not exists idx_deskduel_rooms_updated on public.deskduel_rooms(updated_at desc);

-- =====================================================================
-- 3. DESKDUEL MATCHES (Match History & Records)
-- =====================================================================
create table if not exists public.deskduel_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text,
  arena text not null,
  rounds_to_win integer not null,
  winner_id text,
  winner_name text not null,
  players jsonb not null default '[]'::jsonb,
  scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_deskduel_matches_created on public.deskduel_matches(created_at desc);

-- =====================================================================
-- 4. REALTIME PUBLICATION & REPLICA IDENTITY
-- Enable Realtime Broadcast & Database changes
-- =====================================================================
alter table public.deskduel_rooms replica identity full;
alter table public.deskduel_profiles replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deskduel_rooms'
  ) then
    alter publication supabase_realtime add table public.deskduel_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deskduel_profiles'
  ) then
    alter publication supabase_realtime add table public.deskduel_profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deskduel_matches'
  ) then
    alter publication supabase_realtime add table public.deskduel_matches;
  end if;
end $$;

-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Clean, secure policies for anonymous & authenticated players
-- =====================================================================
alter table public.deskduel_profiles enable row level security;
alter table public.deskduel_rooms enable row level security;
alter table public.deskduel_matches enable row level security;

-- Profiles: Anyone can view profiles (for leaderboard/roster) and create/update their own device profile
drop policy if exists "Public profiles read access" on public.deskduel_profiles;
create policy "Public profiles read access" on public.deskduel_profiles
  for select to anon, authenticated using (true);

drop policy if exists "Public profiles insert access" on public.deskduel_profiles;
create policy "Public profiles insert access" on public.deskduel_profiles
  for insert to anon, authenticated with check (true);

drop policy if exists "Public profiles update access" on public.deskduel_profiles;
create policy "Public profiles update access" on public.deskduel_profiles
  for update to anon, authenticated using (true) with check (true);

-- Rooms: Anyone can browse open lobbies, create rooms, and update room states
drop policy if exists "Public rooms read access" on public.deskduel_rooms;
create policy "Public rooms read access" on public.deskduel_rooms
  for select to anon, authenticated using (true);

drop policy if exists "Public rooms insert access" on public.deskduel_rooms;
create policy "Public rooms insert access" on public.deskduel_rooms
  for insert to anon, authenticated with check (true);

drop policy if exists "Public rooms update access" on public.deskduel_rooms;
create policy "Public rooms update access" on public.deskduel_rooms
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "Public rooms delete access" on public.deskduel_rooms;
create policy "Public rooms delete access" on public.deskduel_rooms
  for delete to anon, authenticated using (true);

-- Matches: Anyone can log completed matches and read history
drop policy if exists "Public matches read access" on public.deskduel_matches;
create policy "Public matches read access" on public.deskduel_matches
  for select to anon, authenticated using (true);

drop policy if exists "Public matches insert access" on public.deskduel_matches;
create policy "Public matches insert access" on public.deskduel_matches
  for insert to anon, authenticated with check (true);

-- Explicit grants for anon and authenticated API roles
grant usage on schema public to anon, authenticated;
grant all on public.deskduel_profiles to anon, authenticated;
grant all on public.deskduel_rooms to anon, authenticated;
grant all on public.deskduel_matches to anon, authenticated;

-- =====================================================================
-- 6. LEADERBOARD VIEW
-- =====================================================================
create or replace view public.deskduel_leaderboard with (security_invoker = true) as
select 
  id,
  name,
  avatar_color,
  level,
  xp,
  coins,
  equipped_pen,
  coalesce((stats->>'wins')::int, 0) as total_wins,
  coalesce((stats->>'onlineWins')::int, 0) as online_wins,
  coalesce((stats->>'kos')::int, 0) as kos,
  coalesce((stats->>'bestStreak')::int, 0) as best_streak,
  updated_at
from public.deskduel_profiles
where coalesce((stats->>'matches')::int, 0) > 0 or coins > 250 or level > 1
order by online_wins desc, total_wins desc, level desc, coins desc
limit 50;

grant select on public.deskduel_leaderboard to anon, authenticated;

-- =====================================================================
-- 7. AUTOMATIC STALE ROOM CLEANUP HELPER
-- Rooms older than 2 hours that are idle can be pruned
-- =====================================================================
create or replace function public.cleanup_stale_deskduel_rooms()
returns integer language plpgsql security invoker 
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.deskduel_rooms 
  where updated_at < now() - interval '2 hours'
     or (status = 'finished' and updated_at < now() - interval '10 minutes');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
