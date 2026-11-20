-- 017_edit_numbers.sql (20 Nov 2026)
-- Edit any number or tag: the reference no. of a paper (vehicle or person: registration, insurance, FNRC WB tag, Fujairah permit, gate passes, licence...)
-- and the two diesel sensor numbers on a vehicle.
-- Admin: changes it at once. Editor: sends a request that the Admin approves or rejects (same table and screen as plate / engine no. / Registered to).
-- Old and new values are always written to change_log.

alter table public.machine_change_requests alter column vehicle_id drop not null;
alter table public.machine_change_requests add column if not exists person_id bigint references public.people(id) on delete cascade;
alter table public.machine_change_requests add column if not exists paper_type_id bigint references public.paper_types(id);
alter table public.machine_change_requests add column if not exists label text;
alter table public.machine_change_requests drop constraint if exists machine_change_requests_field_check;
alter table public.machine_change_requests add constraint machine_change_requests_field_check
  check (field = any (array['number','engine_no','owner','paper_ref','sensor_1','sensor_2']));
alter table public.machine_change_requests drop constraint if exists mcr_target_check;
alter table public.machine_change_requests add constraint mcr_target_check check (vehicle_id is not null or person_id is not null);

create or replace function public.change_number(p_field text, p_vehicle bigint, p_person bigint, p_type bigint, p_new text, p_reason text, p_label text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v vehicles%rowtype; pe people%rowtype; pr papers%rowtype; em text; old text; who text; lbl text;
  nv text := nullif(trim(coalesce(p_new,'')),''); rs text := nullif(trim(coalesce(p_reason,'')),''); adm boolean := app.is_admin();
begin
 if not app.can_edit() then raise exception 'You are not allowed to change numbers'; end if;
 if p_field not in ('paper_ref','sensor_1','sensor_2') then raise exception 'That number cannot be changed here'; end if;
 select email into em from app_users where id=auth.uid();
 if p_vehicle is not null then
   select * into v from vehicles where id=p_vehicle for update;
   if not found then raise exception 'Vehicle not found'; end if;
   who := v.number;
 end if;
 if p_person is not null then
   select * into pe from people where id=p_person for update;
   if not found then raise exception 'Person not found'; end if;
   who := pe.passport_name;
 end if;
 if p_field = 'paper_ref' then
   if (p_vehicle is null) = (p_person is null) then raise exception 'Choose one vehicle or one person'; end if;
   select name into lbl from paper_types where id=p_type;
   if lbl is null then raise exception 'Paper not found'; end if;
   select * into pr from papers where paper_type_id=p_type and is_current
      and ((p_vehicle is not null and vehicle_id=p_vehicle) or (p_person is not null and person_id=p_person)) for update;
   if not found then raise exception 'This paper has no record yet. Enter its date first (Renew).'; end if;
   old := pr.ref_no;
 else
   if p_vehicle is null then raise exception 'Choose a vehicle'; end if;
   old := case p_field when 'sensor_1' then v.sensor_1 else v.sensor_2 end;
   lbl := case p_field when 'sensor_1' then 'Diesel sensor no. 1' else 'Diesel sensor no. 2' end;
 end if;
 lbl := coalesce(nullif(trim(coalesce(p_label,'')),''), lbl);
 if nullif(trim(coalesce(old,'')),'') is not distinct from nv then raise exception 'Nothing changed'; end if;
 if adm then
   if p_field = 'paper_ref' then update papers set ref_no=nv, updated_at=now(), updated_by=auth.uid() where id=pr.id;
   elsif p_field = 'sensor_1' then update vehicles set sensor_1=nv, updated_at=now(), updated_by=auth.uid() where id=v.id;
   else update vehicles set sensor_2=nv, updated_at=now(), updated_by=auth.uid() where id=v.id; end if;
   insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
   values(auth.uid(),em,'number',p_vehicle,format('%s: %s changed (%s to %s)',who,lbl,coalesce(old,'empty'),coalesce(nv,'empty')),
     jsonb_build_object('field',p_field,'label',lbl,'old',old,'new',nv,'reason',rs,'person_id',p_person,'paper_type_id',p_type));
   return jsonb_build_object('ok',true,'admin',true);
 end if;
 if exists (select 1 from machine_change_requests where status='pending' and field=p_field and paper_type_id is not distinct from p_type
            and vehicle_id is not distinct from p_vehicle and person_id is not distinct from p_person) then
   raise exception 'A change of this number is already waiting for approval'; end if;
 insert into machine_change_requests(vehicle_id,person_id,paper_type_id,label,field,old_value,new_value,reason,requested_by,requested_email)
 values(p_vehicle,p_person,p_type,lbl,p_field,old,nv,rs,auth.uid(),em);
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'number',p_vehicle,format('%s: %s change sent for approval (%s to %s)',who,lbl,coalesce(old,'empty'),coalesce(nv,'empty')),
   jsonb_build_object('field',p_field,'label',lbl,'old',old,'new',nv,'reason',rs,'person_id',p_person,'paper_type_id',p_type,'sent_for_approval',true));
 return jsonb_build_object('ok',true,'admin',false,'requested',1);
end $function$;

create or replace function public.decide_machine_request(p_id bigint, p_approve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare r machine_change_requests%rowtype; v vehicles%rowtype; em text; dg text; who text; lbl text; n int;
begin
 if not app.is_admin() then raise exception 'Only the administrator can approve or reject'; end if;
 select * into r from machine_change_requests where id=p_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status <> 'pending' then raise exception 'This request was already decided'; end if;
 if r.vehicle_id is not null then select * into v from vehicles where id=r.vehicle_id for update; who := v.number;
 else select passport_name into who from people where id=r.person_id; end if;
 select email into em from app_users where id=auth.uid();
 if p_approve then
   if r.field='number' then
     dg := regexp_replace(coalesce(r.new_value,''),'\D','','g');
     if dg <> '' and exists (select 1 from vehicles x where x.id <> v.id and regexp_replace(coalesce(x.number,''),'\D','','g') = dg) then raise exception 'Another vehicle already has that number'; end if;
     update vehicles set number=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   elsif r.field='engine_no' then update vehicles set engine_no=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   elsif r.field='owner' then update vehicles set owner=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   elsif r.field='sensor_1' then update vehicles set sensor_1=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   elsif r.field='sensor_2' then update vehicles set sensor_2=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   elsif r.field='paper_ref' then
     update papers set ref_no=r.new_value, updated_at=now(), updated_by=auth.uid()
      where paper_type_id=r.paper_type_id and is_current
        and ((r.vehicle_id is not null and vehicle_id=r.vehicle_id) or (r.person_id is not null and person_id=r.person_id));
     get diagnostics n = row_count;
     if n = 0 then raise exception 'That paper has changed since the request was made'; end if;
   end if;
 end if;
 update machine_change_requests set status=case when p_approve then 'approved' else 'rejected' end, decided_by=auth.uid(), decided_email=em, decided_at=now(), decision_note=nullif(trim(coalesce(p_note,'')),'') where id=r.id;
 lbl := coalesce(r.label, r.field);
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'machine_request',r.vehicle_id,format('%s: change of %s %s (%s to %s)',who,lbl,case when p_approve then 'approved' else 'rejected' end,coalesce(r.old_value,'empty'),coalesce(r.new_value,'empty')),
  jsonb_build_object('request',r.id,'field',r.field,'old',r.old_value,'new',r.new_value,'asked_by',r.requested_email,'reason',r.reason,'note',p_note));
 return jsonb_build_object('ok',true,'approved',p_approve);
end $function$;

grant execute on function public.change_number(text,bigint,bigint,bigint,text,text,text) to authenticated;
