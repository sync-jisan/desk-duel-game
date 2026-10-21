-- =====================================================================
-- DESK DUEL — Friends System, Realtime Presence & Friend Gifts
-- =====================================================================

-- 1. Friend Code column on profiles
alter table public.deskduel_profiles add column if not exists friend_code text;
update public.deskduel_profiles 
  set friend_code = upper(substring(replace(id, '-', '') from 1 for 6)) 
  where friend_code is null;

grant select (friend_code) on public.deskduel_profiles to anon, authenticated;

-- 2. Friendships table
create table if not exists public.deskduel_friendships (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.deskduel_profiles(id) on delete cascade,
  friend_id text not null references public.deskduel_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deskduel_no_self_friend check (user_id <> friend_id)
);

create unique index if not exists deskduel_friendships_pair_idx 
  on public.deskduel_friendships (least(user_id, friend_id), greatest(user_id, friend_id));

create index if not exists deskduel_friendships_user_id_idx on public.deskduel_friendships(user_id);
create index if not exists deskduel_friendships_friend_id_idx on public.deskduel_friendships(friend_id);
create index if not exists deskduel_friendships_status_idx on public.deskduel_friendships(status);

alter table public.deskduel_friendships enable row level security;

drop policy if exists "Users view own friendships" on public.deskduel_friendships;
drop policy if exists "Users send friend request" on public.deskduel_friendships;
drop policy if exists "Users update friendship" on public.deskduel_friendships;
drop policy if exists "Users delete friendship" on public.deskduel_friendships;

create policy "Users view own friendships" on public.deskduel_friendships
  for select to authenticated
  using ((select auth.uid())::text in (user_id, friend_id));

create policy "Users send friend request" on public.deskduel_friendships
  for insert to authenticated
  with check ((select auth.uid())::text = user_id and status = 'pending');

create policy "Users update friendship" on public.deskduel_friendships
  for update to authenticated
  using ((select auth.uid())::text in (user_id, friend_id))
  with check ((select auth.uid())::text in (user_id, friend_id));

create policy "Users delete friendship" on public.deskduel_friendships
  for delete to authenticated
  using ((select auth.uid())::text in (user_id, friend_id));

grant select, insert, update, delete on public.deskduel_friendships to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'deskduel_friendships'
  ) then
    alter publication supabase_realtime add table public.deskduel_friendships;
  end if;
end $$;

-- 3. Friend Gifts table (Daily 50 coins gift between friends)
create table if not exists public.deskduel_friend_gifts (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references public.deskduel_profiles(id) on delete cascade,
  to_id text not null references public.deskduel_profiles(id) on delete cascade,
  amount int not null default 50,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint deskduel_no_self_gift check (from_id <> to_id)
);

create index if not exists deskduel_friend_gifts_to_id_idx on public.deskduel_friend_gifts(to_id, claimed);
create index if not exists deskduel_friend_gifts_from_id_idx on public.deskduel_friend_gifts(from_id);

alter table public.deskduel_friend_gifts enable row level security;

drop policy if exists "Users view own gifts" on public.deskduel_friend_gifts;
create policy "Users view own gifts" on public.deskduel_friend_gifts
  for select to authenticated
  using ((select auth.uid())::text in (from_id, to_id));

drop policy if exists "Users send gifts" on public.deskduel_friend_gifts;
create policy "Users send gifts" on public.deskduel_friend_gifts
  for insert to authenticated
  with check ((select auth.uid())::text = from_id);

drop policy if exists "Recipients claim gifts" on public.deskduel_friend_gifts;
create policy "Recipients claim gifts" on public.deskduel_friend_gifts
  for update to authenticated
  using ((select auth.uid())::text = to_id)
  with check ((select auth.uid())::text = to_id);

grant select, insert, update on public.deskduel_friend_gifts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'deskduel_friend_gifts'
  ) then
    alter publication supabase_realtime add table public.deskduel_friend_gifts;
  end if;
end $$;

-- 4. RPC for safely claiming a friend gift and crediting coins
create or replace function public.claim_friend_gift(p_gift_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid text := (select auth.uid())::text;
  v_gift record;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select * into v_gift from public.deskduel_friend_gifts
    where id = p_gift_id and to_id = v_uid and not claimed;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found_or_claimed');
  end if;

  update public.deskduel_friend_gifts
    set claimed = true
    where id = p_gift_id;

  update public.deskduel_profiles
    set coins = coalesce(coins, 0) + v_gift.amount,
        updated_at = now()
    where id = v_uid;

  return jsonb_build_object('success', true, 'amount', v_gift.amount);
end;
$$;

revoke all on function public.claim_friend_gift(uuid) from public, anon;
grant execute on function public.claim_friend_gift(uuid) to authenticated;
