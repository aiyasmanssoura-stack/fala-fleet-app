-- 020: nightly FULL backup kept inside the database (add-only).
-- Every table in public (all rows, all history, change log, users, requests) + the sign-in list, as one snapshot.
-- Kept: the last 30 nights + the first night of each month (forever, they are small).
-- Off-site copy (private GitHub repo) is a separate step. Undo: select cron.unschedule('fleet-nightly-backup'); drop table public.backup_snapshots; drop function app.take_backup(text); drop function public.backup_now();
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.backup_snapshots(
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  kind text not null default 'nightly',
  taken_by uuid,
  counts jsonb not null,
  data jsonb not null);
alter table public.backup_snapshots enable row level security;
drop policy if exists backup_admin_read on public.backup_snapshots;
create policy backup_admin_read on public.backup_snapshots for select to authenticated using (app.is_admin());

create or replace function app.take_backup(p_kind text default 'nightly') returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare t record; d jsonb := '{}'::jsonb; c jsonb := '{}'::jsonb; j jsonb; n int; nid bigint;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename <> 'backup_snapshots' order by tablename loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*) from public.%I x', t.tablename) into j, n;
    d := d || jsonb_build_object(t.tablename, j); c := c || jsonb_build_object(t.tablename, n);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'created_at',created_at,'last_sign_in_at',last_sign_in_at)), '[]'::jsonb), count(*) into j, n from auth.users;
  d := d || jsonb_build_object('_auth_users', j); c := c || jsonb_build_object('_auth_users', n);
  insert into public.backup_snapshots(kind, taken_by, counts, data) values (p_kind, auth.uid(), c, d) returning id into nid;
  -- keep the last 30 nightly + first of each month
  delete from public.backup_snapshots where kind='nightly' and taken_at < now() - interval '30 days'
    and id not in (select distinct on (date_trunc('month', taken_at)) id from public.backup_snapshots order by date_trunc('month', taken_at), taken_at);
  return nid;
end $$;
revoke all on function app.take_backup(text) from public, anon, authenticated;

create or replace function public.backup_now() returns bigint language plpgsql security definer set search_path to 'public' as $$
begin
  if not app.is_admin() then raise exception 'Only the administrator can take a backup'; end if;
  return app.take_backup('manual');
end $$;
revoke all on function public.backup_now() from public, anon;
grant execute on function public.backup_now() to authenticated;

select cron.unschedule('fleet-nightly-backup') where exists (select 1 from cron.job where jobname='fleet-nightly-backup');
select cron.schedule('fleet-nightly-backup', '0 22 * * *', $$select app.take_backup('nightly')$$);   -- 22:00 UTC = 02:00 Dubai
