-- =====================================================================
-- DESK DUEL v2 — SUPABASE BACKEND SCHEMA & REALTIME SETUP
-- Project: Desk Duel (Pen Fighting Championship)
-- IMPORTANT: after this file, run supabase/migrations/20261021120000_secure_rls_and_realtime.sql
-- (it replaces the open "anyone can write" policies below with owner-only ones).
-- =====================================================================

-- Enable pgcrypto for UUID generation if not already enabled
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. DESKDUEL PROFILES (Player Progress & Cloud Save)
-- =====================================================================
create table if not exists public.deskduel_profiles (
  id text primary key,
  name text not null default 'Player',
  email text,
  avatar_url text,
  avatar_color text not null default 'blue',
  equipped_pen text not null default 'ballpoint',
  coins integer not null default 500,
  xp integer not null default 0,
  level integer not null default 1,
  trophies integer not null default 100,
  login_streak integer not null default 1,
  last_daily_bonus timestamptz,
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
create index if not exists idx_deskduel_profiles_trophies on public.deskduel_profiles(trophies desc);

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
  updated_at,
  coalesce(avatar_url, '') as avatar_url,
  coalesce(trophies, 100) as trophies,
  coalesce(login_streak, 1) as login_streak
from public.deskduel_profiles
where coalesce((stats->>'matches')::int, 0) > 0 or coins > 200 or level > 1 or coalesce(trophies, 100) > 100
order by coalesce(trophies, 100) desc, coalesce((stats->>'onlineWins')::int, 0) desc, coalesce((stats->>'wins')::int, 0) desc, level desc, coins desc
limit 100;

grant select on public.deskduel_leaderboard to anon, authenticated;

-- =====================================================================
-- 7. DAILY LOGIN BONUS RPC FUNCTION
-- Awards coins based on daily login streak (150 -> 500 coins)
-- =====================================================================
create or replace function public.claim_daily_login_bonus(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_now timestamptz := now();
  v_streak int := 1;
  v_bonus_coins int := 150;
  v_can_claim boolean := false;
  v_hours_since numeric;
begin
  select * into v_profile from public.deskduel_profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Profile not found');
  end if;

  if v_profile.last_daily_bonus is null then
    v_can_claim := true;
    v_streak := 1;
  else
    v_hours_since := extract(epoch from (v_now - v_profile.last_daily_bonus)) / 3600.0;
    if v_hours_since < 20.0 then
      return jsonb_build_object(
        'success', false, 
        'already_claimed', true,
        'next_available_in_hours', round((20.0 - v_hours_since)::numeric, 1),
        'current_streak', coalesce(v_profile.login_streak, 1)
      );
    elsif v_hours_since > 48.0 then
      v_streak := 1;
      v_can_claim := true;
    else
      v_streak := (coalesce(v_profile.login_streak, 1) % 7) + 1;
      v_can_claim := true;
    end if;
  end if;

  v_bonus_coins := case v_streak
    when 1 then 150
    when 2 then 200
    when 3 then 250
    when 4 then 300
    when 5 then 350
    when 6 then 400
    when 7 then 500
    else 150
  end;

  update public.deskduel_profiles
  set 
    coins = coins + v_bonus_coins,
    last_daily_bonus = v_now,
    login_streak = v_streak,
    updated_at = v_now
  where id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'awarded_coins', v_bonus_coins,
    'new_streak', v_streak,
    'total_coins', v_profile.coins + v_bonus_coins
  );
end;
$$;

grant execute on function public.claim_daily_login_bonus(text) to anon, authenticated;

-- =====================================================================
-- 8. AUTOMATIC STALE ROOM CLEANUP HELPER
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
