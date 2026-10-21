-- =====================================================================
-- DESK DUEL — 5-Player Multiplayer, Matchmaking & Spectator Support
-- =====================================================================

-- 1. Upgrade deskduel_rooms to support up to 5 players and new modes
alter table public.deskduel_rooms 
  alter column max_players set default 5;

alter table public.deskduel_rooms 
  add column if not exists mode text not null default 'squad' check (mode in ('duo', 'squad'));

alter table public.deskduel_rooms 
  add column if not exists is_matchmaking boolean not null default false;

alter table public.deskduel_rooms 
  add column if not exists spectators jsonb not null default '[]'::jsonb;

alter table public.deskduel_rooms 
  add column if not exists spectator_count integer not null default 0;

-- 2. Enforce: One person can only have ONE active room at a time.
-- When a host creates a new room, any older rooms created by this host are automatically deleted.
create or replace function public.deskduel_rooms_single_active_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.deskduel_rooms 
  where host_id = new.host_id 
    and code <> new.code;
  return new;
end;
$$;

drop trigger if exists trg_deskduel_single_room on public.deskduel_rooms;
create trigger trg_deskduel_single_room
  before insert on public.deskduel_rooms
  for each row execute function public.deskduel_rooms_single_active_room();

-- 3. Matchmaking Index for fast lookup of waiting lobbies
create index if not exists idx_deskduel_rooms_matchmaking 
  on public.deskduel_rooms (status, is_matchmaking, mode, player_count) 
  where status = 'lobby';

-- 4. Clean function for spectator join/leave
create or replace function public.register_spectator(
  p_code text,
  p_user_id text,
  p_name text,
  p_action text default 'join'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room record;
  v_spectators jsonb;
  v_item jsonb := jsonb_build_object('id', p_user_id, 'name', p_name, 'joined_at', now());
begin
  select * into v_room from public.deskduel_rooms where code = p_code for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'room_not_found');
  end if;

  v_spectators := coalesce(v_room.spectators, '[]'::jsonb);

  if p_action = 'join' then
    -- remove if existing to avoid duplicates
    select jsonb_agg(elem) into v_spectators
    from jsonb_array_elements(v_spectators) elem
    where elem->>'id' <> p_user_id;

    v_spectators := coalesce(v_spectators, '[]'::jsonb) || jsonb_build_array(v_item);
  else
    -- remove
    select jsonb_agg(elem) into v_spectators
    from jsonb_array_elements(v_spectators) elem
    where elem->>'id' <> p_user_id;
    v_spectators := coalesce(v_spectators, '[]'::jsonb);
  end if;

  update public.deskduel_rooms
  set spectators = v_spectators,
      spectator_count = jsonb_array_length(v_spectators),
      updated_at = now()
  where code = p_code;

  return jsonb_build_object(
    'success', true, 
    'spectator_count', jsonb_array_length(v_spectators),
    'spectators', v_spectators
  );
end;
$$;

grant execute on function public.register_spectator(text, text, text, text) to anon, authenticated;
