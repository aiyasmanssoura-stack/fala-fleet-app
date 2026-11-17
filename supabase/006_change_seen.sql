-- 17 Nov 2026. Changes made in the app become notifications on Admin Home: "seen" marks a change as read, and it then lives in the History on the vehicle / driver card.
-- Additive only: two new columns on change_log and one function. Nothing is removed.
alter table public.change_log add column if not exists seen_at timestamptz, add column if not exists seen_by uuid;
-- every change made before today counts as already seen (Home starts empty; they are in the card history)
update public.change_log set seen_at = now() where seen_at is null;

create or replace function public.mark_change_seen(p_id bigint default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if not app.is_admin() then raise exception 'Only the administrator can mark changes as seen'; end if;
  update change_log set seen_at = now(), seen_by = auth.uid() where seen_at is null and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_change_seen(bigint) from public, anon;
grant execute on function public.mark_change_seen(bigint) to authenticated;
