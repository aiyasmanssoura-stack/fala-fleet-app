-- Rollback copy (20 Nov 2026): decide_machine_request exactly as it was before 017.
-- To undo 017: run this file, then:  drop function public.change_number(text,bigint,bigint,bigint,text,text,text);
--   delete from machine_change_requests where field in ('paper_ref','sensor_1','sensor_2');
--   then restore the old field check: check (field = any (array['number','engine_no','owner'])) and, if wanted, vehicle_id not null.
CREATE OR REPLACE FUNCTION public.decide_machine_request(p_id bigint, p_approve boolean, p_note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare r machine_change_requests%rowtype; v vehicles%rowtype; em text; dg text;
begin
 if not app.is_admin() then raise exception 'Only the administrator can approve or reject'; end if;
 select * into r from machine_change_requests where id=p_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status <> 'pending' then raise exception 'This request was already decided'; end if;
 select * into v from vehicles where id=r.vehicle_id for update;
 select email into em from app_users where id=auth.uid();
 if p_approve then
   if r.field='number' then
     dg := regexp_replace(coalesce(r.new_value,''),'\D','','g');
     if dg <> '' and exists (select 1 from vehicles x where x.id <> v.id and regexp_replace(coalesce(x.number,''),'\D','','g') = dg) then raise exception 'Another vehicle already has that number'; end if;
     update vehicles set number=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   elsif r.field='engine_no' then update vehicles set engine_no=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id;
   else update vehicles set owner=r.new_value, updated_at=now(), updated_by=auth.uid() where id=v.id; end if;
 end if;
 update machine_change_requests set status=case when p_approve then 'approved' else 'rejected' end, decided_by=auth.uid(), decided_email=em, decided_at=now(), decision_note=nullif(trim(coalesce(p_note,'')),'') where id=r.id;
 insert into change_log(by_user,by_email,kind,vehicle_id,summary,details)
 values(auth.uid(),em,'machine_request',v.id,format('%s: change of %s %s (%s to %s)',v.number,r.field,case when p_approve then 'approved' else 'rejected' end,coalesce(r.old_value,'empty'),coalesce(r.new_value,'empty')),
  jsonb_build_object('request',r.id,'field',r.field,'old',r.old_value,'new',r.new_value,'asked_by',r.requested_email,'reason',r.reason,'note',p_note));
 return jsonb_build_object('ok',true,'approved',p_approve);
end $function$;
