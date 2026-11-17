-- 17 Nov 2026: trailer coupling history (applied as migration "trailer_coupling_history").
-- vehicles.pulled_by_id = the truck pulling this trailer NOW; pulled_since = since when (empty = not recorded).
-- coupling_history = past couplings. change_trailer() = Admin/Editor only: ends the old coupling with its dates,
-- starts the new one, moves the trailer off another truck if needed, writes change_log (kind 'trailer').
alter table public.vehicles add column if not exists pulled_since date;
create table if not exists public.coupling_history (
  id bigint generated always as identity primary key,
  trailer_id bigint not null references public.vehicles(id),
  truck_id bigint not null references public.vehicles(id),
  from_date date, to_date date, note text,
  created_at timestamptz not null default now(), created_by uuid);
alter table public.coupling_history enable row level security;
create policy coupling_history_read on public.coupling_history for select to authenticated using (app.is_member());
revoke all on public.coupling_history from anon, public;
grant select on public.coupling_history to authenticated;
-- function change_trailer(p_truck, p_trailer, p_start, p_end, p_note): see the migration in the database (supabase > Database > Functions).
