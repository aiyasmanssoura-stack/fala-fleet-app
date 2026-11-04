-- Editing from the app (5 Nov 2026). Applied through the Supabase connector.
-- Contains no fleet data. change_driver / change_site / renew_paper: Admin or Editor.
-- add_site, edit_history, remove_history, edit_paper_history, remove_paper_history: Admin only.
-- Every one writes a row to change_log (readable by Admin only).

create table if not exists public.change_log(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_user uuid, by_email text, kind text not null, vehicle_id bigint,
  summary text not null, details jsonb);
alter table public.change_log enable row level security;
create policy change_log_read on public.change_log for select using (app.is_admin());

create or replace function public.change_driver(p_vehicle bigint, p_new bigint, p_start date, p_end date, p_note text) returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v vehicles%rowtype; oldname text; newname text; em text;
begin
 if not app.can_edit() then raise exception 'You are not allowed to change drivers'; end if;
 select * into v from vehicles where id=p_vehicle for update;
 if not found then raise exception 'Vehicle not found'; end if;
 if p_new is null then raise exception 'Choose the new driver'; end if;
 if p_new = v.driver_id then raise exception 'That driver is already on this vehicle'; end if;
 if p_start is null then raise exception 'Choose the start date'; end if;
 if p_end is not null and p_end >= p_start then raise exception 'The old driver last day must be before the start date'; end if;
 if v.driver_since is not null and p_end is not null and p_end < v.driver_since then raise exception 'The old driver last day is before he started'; end if;
 select passport_name into oldname from people where id=v.driver_id;
 select passport_name into newname from people where id=p_new;
 if newname is null then raise exception 'Driver not found'; end if;
 if v.driver_id is not null then
   insert into board_history(vehicle_id,driver_id,from_date,to_date,note)
   values(v.id,v.driver_id,v.driver_since,p_end,nullif(trim(coalesce(p_note,'')),''));
 end if;
 update vehicles set driver_id=p_new, driver_since=p_start where id=v.id;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'driver',v.id,format('%s: driver changed from %s to %s (starts %s)',v.number,coalesce(oldname,'nobody'),newname,p_start),
  jsonb_build_object('old_driver_id',v.driver_id,'old_since',v.driver_since,'old_last_day',p_end,'new_driver_id',p_new,'start',p_start,'note',p_note));
 return jsonb_build_object('ok',true,'old',oldname,'new',newname);
end $f$;

create or replace function public.change_site(p_vehicle bigint, p_new bigint, p_start date, p_end date, p_note text) returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v vehicles%rowtype; oldname text; newname text; em text;
begin
 if not app.can_edit() then raise exception 'You are not allowed to change sites'; end if;
 select * into v from vehicles where id=p_vehicle for update;
 if not found then raise exception 'Vehicle not found'; end if;
 if p_new is null then raise exception 'Choose the new site'; end if;
 if p_new = v.site_id then raise exception 'It is already at that site'; end if;
 if p_start is null then raise exception 'Choose the arrival date'; end if;
 if p_end is not null and p_end >= p_start then raise exception 'The day it left the old site must be before the arrival date'; end if;
 if v.site_since is not null and p_end is not null and p_end < v.site_since then raise exception 'The day it left is before it arrived at the old site'; end if;
 select name into oldname from sites where id=v.site_id;
 select name into newname from sites where id=p_new;
 if newname is null then raise exception 'Site not found'; end if;
 if v.site_id is not null then
   insert into board_history(vehicle_id,site_id,from_date,to_date,note) values(v.id,v.site_id,v.site_since,p_end,nullif(trim(coalesce(p_note,'')),''));
 end if;
 update vehicles set site_id=p_new, site_since=p_start where id=v.id;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'site',v.id,format('%s: site changed from %s to %s (from %s)',v.number,coalesce(oldname,'nowhere'),newname,p_start),
  jsonb_build_object('old_site_id',v.site_id,'old_since',v.site_since,'old_last_day',p_end,'new_site_id',p_new,'start',p_start,'note',p_note));
 return jsonb_build_object('ok',true,'old',oldname,'new',newname,'new_id',p_new);
end $f$;

create or replace function public.add_site(p_name text) returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare n text := trim(coalesce(p_name,'')); r sites%rowtype; em text;
begin
 if not app.is_admin() then raise exception 'Only an Admin can add a site'; end if;
 if n = '' then raise exception 'Type the site name'; end if;
 if exists(select 1 from sites where lower(name)=lower(n)) then raise exception 'That site already exists'; end if;
 insert into sites(name) values(n) returning * into r;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,summary,details) values(auth.uid(),em,'site added','Site added: '||n,jsonb_build_object('site_id',r.id));
 return jsonb_build_object('ok',true,'id',r.id,'name',r.name);
end $f$;

create or replace function public.renew_paper(p_vehicle bigint, p_type bigint, p_expiry date, p_ref text, p_note text) returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v vehicles%rowtype; old papers%rowtype; tn text; em text; newid bigint; ref text;
begin
 if not app.can_edit() then raise exception 'You are not allowed to renew papers'; end if;
 select * into v from vehicles where id=p_vehicle for update;
 if not found then raise exception 'Vehicle not found'; end if;
 select name into tn from paper_types where id=p_type;
 if tn is null then raise exception 'Paper not found'; end if;
 if p_expiry is null then raise exception 'Choose the new expiry date'; end if;
 select * into old from papers where vehicle_id=p_vehicle and paper_type_id=p_type and is_current for update;
 ref := nullif(trim(coalesce(p_ref,'')),'');
 if found then update papers set is_current=false, updated_at=now(), updated_by=auth.uid() where id=old.id; end if;
 insert into papers(paper_type_id,vehicle_id,state,expiry,ref_no,note,is_current,updated_at,updated_by)
 values(p_type,p_vehicle,'Date',p_expiry,coalesce(ref,old.ref_no),nullif(trim(coalesce(p_note,'')),''),true,now(),auth.uid()) returning id into newid;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'paper',p_vehicle,format('%s: %s renewed, old expiry %s, new expiry %s',v.number,tn,coalesce(old.expiry::text,'none'),p_expiry),
  jsonb_build_object('type',p_type,'old_paper_id',old.id,'old_state',old.state,'old_expiry',old.expiry,'new_paper_id',newid,'new_expiry',p_expiry,'ref',ref,'note',p_note));
 return jsonb_build_object('ok',true,'name',tn,'expiry',p_expiry,'ref',coalesce(ref,old.ref_no));
end $f$;

-- edit_history, remove_history, edit_paper_history, remove_paper_history (Admin only):
-- see the live database (pg_get_functiondef) - same pattern, each logs the old line to change_log.

revoke all on function public.change_driver(bigint,bigint,date,date,text), public.change_site(bigint,bigint,date,date,text), public.add_site(text), public.renew_paper(bigint,bigint,date,text,text) from public, anon;
grant execute on function public.change_driver(bigint,bigint,date,date,text), public.change_site(bigint,bigint,date,date,text), public.add_site(text), public.renew_paper(bigint,bigint,date,text,text) to authenticated;
