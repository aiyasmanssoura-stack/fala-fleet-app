-- 012_amia_editor.sql  (18 Nov 2026)
-- Fourth user level: AMIA Project Editor (role key 'amia_editor').
-- Same as a Viewer (reads everything, changes nothing) except it may renew an EXISTING
-- Landside Gate Pass, for a vehicle and for a person. It cannot add a new one, and cannot touch any other paper.
-- Direct writes to public.papers stay can_edit() only, so this level can only act through the two renew functions.

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role = any (array['admin','editor','viewer','amia_editor']));

create or replace function app.can_edit_paper(p_type bigint)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    app.my_role() in ('admin','editor')
    or (app.my_role() = 'amia_editor'
        and exists (select 1 from public.paper_types where id = p_type and name = 'Landside Gate Pass')),
    false)
$$;

create or replace function public.renew_paper(p_vehicle bigint, p_type bigint, p_expiry date, p_ref text, p_note text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v vehicles%rowtype; old papers%rowtype; tn text; em text; newid bigint; ref text;
begin
 if not app.can_edit_paper(p_type) then raise exception 'You are not allowed to renew papers'; end if;
 select * into v from vehicles where id=p_vehicle for update;
 if not found then raise exception 'Vehicle not found'; end if;
 select name into tn from paper_types where id=p_type;
 if tn is null then raise exception 'Paper not found'; end if;
 if p_expiry is null then raise exception 'Choose the new expiry date'; end if;
 select * into old from papers where vehicle_id=p_vehicle and paper_type_id=p_type and is_current for update;
 if not found and not app.can_edit() then raise exception 'You can only change an existing Landside Gate Pass'; end if;
 ref := nullif(trim(coalesce(p_ref,'')),'');
 if found then update papers set is_current=false, updated_at=now(), updated_by=auth.uid() where id=old.id; end if;
 insert into papers(paper_type_id,vehicle_id,state,expiry,ref_no,note,is_current,updated_at,updated_by)
 values(p_type,p_vehicle,'Date',p_expiry,coalesce(ref,old.ref_no),nullif(trim(coalesce(p_note,'')),''),true,now(),auth.uid()) returning id into newid;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'paper',p_vehicle,format('%s: %s renewed, old expiry %s, new expiry %s',v.number,tn,coalesce(old.expiry::text,'none'),p_expiry),
  jsonb_build_object('type',p_type,'old_paper_id',old.id,'old_state',old.state,'old_expiry',old.expiry,'new_paper_id',newid,'new_expiry',p_expiry,'ref',ref,'note',p_note));
 return jsonb_build_object('ok',true,'name',tn,'expiry',p_expiry,'ref',coalesce(ref,old.ref_no));
end $function$;

create or replace function public.renew_person_paper(p_person bigint, p_type bigint, p_expiry date, p_ref text, p_note text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare pe people%rowtype; old papers%rowtype; tn text; em text; newid bigint; ref text; applies text;
begin
 if not app.can_edit_paper(p_type) then raise exception 'You are not allowed to renew papers'; end if;
 select * into pe from people where id=p_person for update;
 if not found then raise exception 'Person not found'; end if;
 select name, applies_to into tn, applies from paper_types where id=p_type;
 if tn is null then raise exception 'Paper not found'; end if;
 if applies <> 'person' then raise exception 'That paper is not a person paper'; end if;
 if p_expiry is null then raise exception 'Choose the new expiry date'; end if;
 select * into old from papers where person_id=p_person and paper_type_id=p_type and is_current for update;
 if not found and not app.can_edit() then raise exception 'You can only change an existing Landside Gate Pass'; end if;
 ref := nullif(trim(coalesce(p_ref,'')),'');
 if found then update papers set is_current=false, updated_at=now(), updated_by=auth.uid() where id=old.id; end if;
 insert into papers(paper_type_id,person_id,state,expiry,ref_no,note,is_current,updated_at,updated_by)
 values(p_type,p_person,'Date',p_expiry,coalesce(ref,old.ref_no),nullif(trim(coalesce(p_note,'')),''),true,now(),auth.uid()) returning id into newid;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,summary,details)
 values(auth.uid(),em,'paper',format('%s: %s renewed, old expiry %s, new expiry %s',pe.passport_name,tn,coalesce(old.expiry::text,'none'),p_expiry),
  jsonb_build_object('person_id',p_person,'type',p_type,'old_paper_id',old.id,'old_state',old.state,'old_expiry',old.expiry,'new_paper_id',newid,'new_expiry',p_expiry,'ref',ref,'note',p_note));
 return jsonb_build_object('ok',true,'name',tn,'expiry',p_expiry,'ref',coalesce(ref,old.ref_no));
end $function$;
