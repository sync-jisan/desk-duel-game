-- =====================================================================
-- DESK DUEL — security + realtime hardening
--
-- Fixes found in the audit of supabase-schema.sql:
--   1. Anyone could insert/update ANY profile (coins, trophies, names).
--   2. Player emails were readable by anyone with the public key.
--   3. claim_daily_login_bonus(p_user_id) let anyone claim for anyone.
--   4. Anyone could update/delete any room and insert fake matches.
--   5. Profiles + matches were in the realtime publication, so every
--      profile change (incl. email) was streamed to any subscriber.
--   6. The leaderboard view had an inner "limit 100 order by trophies",
--      so the Coins / Wins / Online tabs ranked the wrong players.
--   7. Stale lobbies were never cleaned up.
--
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES — public read (no email), owner-only writes
-- ---------------------------------------------------------------------
drop policy if exists "Public profiles insert access" on public.deskduel_profiles;
drop policy if exists "Public profiles update access" on public.deskduel_profiles;
drop policy if exists "Players insert own profile" on public.deskduel_profiles;
drop policy if exists "Players update own profile" on public.deskduel_profiles;

create policy "Players insert own profile" on public.deskduel_profiles
  for insert to authenticated
  with check (id = (select auth.uid())::text);

create policy "Players update own profile" on public.deskduel_profiles
  for update to authenticated
  using (id = (select auth.uid())::text)
  with check (id = (select auth.uid())::text);

-- Column-level read access: everything except email.
revoke all on public.deskduel_profiles from anon, authenticated;
grant select (
  id, name, avatar_url, avatar_color, equipped_pen, coins, xp, level, trophies,
  login_streak, last_daily_bonus, stats, owned_pens, owned_desks, career,
  achievements, last_online, created_at, updated_at
) on public.deskduel_profiles to anon, authenticated;
grant insert, update on public.deskduel_profiles to authenticated;

-- Sanity guard: clients can't edit the daily-bonus clock or push
-- impossible values. The bonus RPC (security definer) bypasses this.
create or replace function public.deskduel_profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.last_daily_bonus := null;
    else
      new.last_daily_bonus := old.last_daily_bonus;
      new.created_at := old.created_at;
    end if;
  end if;
  new.name := left(coalesce(nullif(btrim(new.name), ''), 'Player'), 14);
  new.coins := greatest(0, least(coalesce(new.coins, 0), 100000000));
  new.trophies := greatest(0, coalesce(new.trophies, 100));
  new.level := greatest(1, least(coalesce(new.level, 1), 999));
  new.xp := greatest(0, coalesce(new.xp, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists deskduel_profiles_guard on public.deskduel_profiles;
create trigger deskduel_profiles_guard
  before insert or update on public.deskduel_profiles
  for each row execute function public.deskduel_profiles_guard();

-- ---------------------------------------------------------------------
-- 2. DAILY BONUS — only for the signed-in caller
-- ---------------------------------------------------------------------
drop function if exists public.claim_daily_login_bonus(text);

create function public.claim_daily_login_bonus(p_user_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid text := (select auth.uid())::text;
  v_profile record;
  v_now timestamptz := now();
  v_streak int := 1;
  v_bonus int;
  v_hours numeric;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if p_user_id is not null and p_user_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select * into v_profile from public.deskduel_profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'profile_not_found');
  end if;

  if v_profile.last_daily_bonus is not null then
    v_hours := extract(epoch from (v_now - v_profile.last_daily_bonus)) / 3600.0;
    if v_hours < 20.0 then
      return jsonb_build_object(
        'success', false,
        'already_claimed', true,
        'next_available_in_hours', round((20.0 - v_hours)::numeric, 1),
        'current_streak', coalesce(v_profile.login_streak, 1)
      );
    elsif v_hours <= 48.0 then
      v_streak := (coalesce(v_profile.login_streak, 1) % 7) + 1;
    end if;
  end if;

  v_bonus := (array[150, 200, 250, 300, 350, 400, 500])[v_streak];

  update public.deskduel_profiles
     set coins = coins + v_bonus,
         last_daily_bonus = v_now,
         login_streak = v_streak
   where id = v_uid;

  return jsonb_build_object(
    'success', true,
    'awarded_coins', v_bonus,
    'new_streak', v_streak,
    'total_coins', v_profile.coins + v_bonus
  );
end;
$$;

revoke execute on function public.claim_daily_login_bonus(text) from public, anon;
grant execute on function public.claim_daily_login_bonus(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. ROOMS — public browse, only the host can change their room
-- ---------------------------------------------------------------------
drop policy if exists "Public rooms insert access" on public.deskduel_rooms;
drop policy if exists "Public rooms update access" on public.deskduel_rooms;
drop policy if exists "Public rooms delete access" on public.deskduel_rooms;
drop policy if exists "Hosts create rooms" on public.deskduel_rooms;
drop policy if exists "Hosts update own rooms" on public.deskduel_rooms;
drop policy if exists "Hosts delete own rooms" on public.deskduel_rooms;

create policy "Hosts create rooms" on public.deskduel_rooms
  for insert to authenticated
  with check (host_id = (select auth.uid())::text);

create policy "Hosts update own rooms" on public.deskduel_rooms
  for update to authenticated
  using (host_id = (select auth.uid())::text)
  with check (host_id = (select auth.uid())::text);

create policy "Hosts delete own rooms" on public.deskduel_rooms
  for delete to authenticated
  using (host_id = (select auth.uid())::text);

revoke all on public.deskduel_rooms from anon, authenticated;
grant select on public.deskduel_rooms to anon, authenticated;
grant insert, update, delete on public.deskduel_rooms to authenticated;

create index if not exists idx_deskduel_rooms_lobby
  on public.deskduel_rooms (updated_at desc) where status = 'lobby';
create index if not exists idx_deskduel_rooms_host on public.deskduel_rooms (host_id);

-- ---------------------------------------------------------------------
-- 4. MATCHES — signed-in hosts log results, stamped with who reported
-- ---------------------------------------------------------------------
alter table public.deskduel_matches
  add column if not exists reported_by uuid default auth.uid();

drop policy if exists "Public matches insert access" on public.deskduel_matches;
drop policy if exists "Players log own matches" on public.deskduel_matches;
create policy "Players log own matches" on public.deskduel_matches
  for insert to authenticated
  with check (reported_by = (select auth.uid()));

revoke all on public.deskduel_matches from anon, authenticated;
grant select on public.deskduel_matches to anon, authenticated;
grant insert on public.deskduel_matches to authenticated;

create index if not exists idx_deskduel_matches_reported_by on public.deskduel_matches (reported_by);

-- ---------------------------------------------------------------------
-- 5. REALTIME — only rooms are streamed (lobby browser)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deskduel_profiles') then
    alter publication supabase_realtime drop table public.deskduel_profiles;
  end if;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deskduel_matches') then
    alter publication supabase_realtime drop table public.deskduel_matches;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deskduel_rooms') then
    alter publication supabase_realtime add table public.deskduel_rooms;
  end if;
end $$;

alter table public.deskduel_profiles replica identity default;
alter table public.deskduel_rooms replica identity default;

-- ---------------------------------------------------------------------
-- 6. LEADERBOARD — no inner limit, so every tab ranks correctly
-- ---------------------------------------------------------------------
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
where coalesce((stats->>'matches')::int, 0) > 0 or coins > 200 or level > 1 or coalesce(trophies, 100) > 100;

grant select on public.deskduel_leaderboard to anon, authenticated;

create index if not exists idx_deskduel_profiles_online_wins
  on public.deskduel_profiles (((stats->>'onlineWins')::int) desc);
create index if not exists idx_deskduel_profiles_coins on public.deskduel_profiles (coins desc);

-- ---------------------------------------------------------------------
-- 7. STALE ROOM CLEANUP — every 5 minutes when pg_cron is available
-- ---------------------------------------------------------------------
create or replace function public.cleanup_stale_deskduel_rooms()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.deskduel_rooms
   where (status = 'lobby' and updated_at < now() - interval '10 minutes')
      or (status = 'playing' and updated_at < now() - interval '2 hours')
      or (status = 'finished' and updated_at < now() - interval '10 minutes');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.cleanup_stale_deskduel_rooms() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'deskduel-cleanup-rooms') then
    perform cron.unschedule('deskduel-cleanup-rooms');
  end if;
  perform cron.schedule('deskduel-cleanup-rooms', '*/5 * * * *', 'select public.cleanup_stale_deskduel_rooms()');
exception when others then
  raise notice 'pg_cron not available (%). Enable it in the dashboard to auto-clean rooms.', sqlerrm;
end $$;
