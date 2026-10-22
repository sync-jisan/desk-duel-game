-- =====================================================================
-- PEN FIGHT — in-app account deletion (Google Play account-deletion policy)
--
-- public.delete_my_account() lets a signed-in player permanently delete
-- their own account. It only ever acts on auth.uid() (the caller).
--
--   * deskduel_profiles row (name, avatar, coins, pens, stats,
--     leaderboard entry)                                  -> deleted
--   * deskduel_rooms the player hosts                     -> deleted
--   * deskduel_matches history                            -> kept, anonymised
--       reported_by = null, winner_id = null / winner_name = 'Deleted player',
--       the player's entry in players[] loses its id and is renamed
--   * auth.users row                                      -> deleted
--       (cascades to auth.identities / sessions / refresh tokens, which
--        removes the Google sign-in link and the stored email)
--
-- Safe to run more than once.
-- =====================================================================

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
  v_matches integer := 0;
  v_profiles integer := 0;
  v_rooms integer := 0;
  v_users integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated: sign in again to delete your account'
      using errcode = '42501';
  end if;
  v_id := v_uid::text;

  -- 1. Match history: keep the records for the other players, remove the link to this player.
  update public.deskduel_matches m
     set reported_by = case when m.reported_by = v_uid then null else m.reported_by end,
         winner_id   = case when m.winner_id = v_id then null else m.winner_id end,
         winner_name = case when m.winner_id = v_id then 'Deleted player' else m.winner_name end,
         players     = case
                         when jsonb_typeof(m.players) = 'array'
                          and m.players @> jsonb_build_array(jsonb_build_object('id', v_id))
                         then (
                           select coalesce(
                                    jsonb_agg(
                                      case when e->>'id' = v_id
                                           then (e - 'id') || jsonb_build_object('name', 'Deleted player')
                                           else e end
                                      order by o),
                                    '[]'::jsonb)
                             from jsonb_array_elements(m.players) with ordinality as t(e, o)
                         )
                         else m.players
                       end
   where m.reported_by = v_uid
      or m.winner_id = v_id
      or (jsonb_typeof(m.players) = 'array'
          and m.players @> jsonb_build_array(jsonb_build_object('id', v_id)));
  get diagnostics v_matches = row_count;

  -- 2. Profile (coins, pens, stats, leaderboard entry).
  delete from public.deskduel_profiles where id = v_id;
  get diagnostics v_profiles = row_count;

  -- 3. Rooms this player hosts.
  delete from public.deskduel_rooms where host_id = v_id;
  get diagnostics v_rooms = row_count;

  -- 4. The auth user (cascades identities, sessions, refresh tokens).
  delete from auth.users where id = v_uid;
  get diagnostics v_users = row_count;

  return jsonb_build_object(
    'success', true,
    'profile_deleted', v_profiles > 0,
    'rooms_deleted', v_rooms,
    'matches_anonymised', v_matches,
    'auth_user_deleted', v_users > 0
  );
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling player''s Pen Fight account (profile, hosted rooms, auth user) and anonymises their match history.';

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
