-- 019: a trailer change can happen on the same day (old coupling's last day = start day; default = same day).
-- Add-only: same function name and signature, so the screen keeps working. Undo = rollback_019_same_day_trailer.sql
CREATE OR REPLACE FUNCTION public.change_trailer(p_truck bigint, p_trailer bigint, p_start date, p_end date, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t vehicles%rowtype; nt vehicles%rowtype; o vehicles%rowtype; em text; endd date; oldnums text := ''; fromtruck text; other vehicles%rowtype; note2 text;
begin
  if not app.can_edit() then raise exception 'You are not allowed to change trailers'; end if;
  select * into t from vehicles where id = p_truck for update;
  if not found then raise exception 'Truck not found'; end if;
  if t.class in ('Trailer','Special Trailer') then raise exception 'A trailer cannot pull a trailer'; end if;
  if p_start is null then raise exception 'Choose the start date'; end if;
  endd := coalesce(p_end, p_start);   -- same day is allowed (and is the default)
  if endd > p_start then raise exception 'The old trailer last day cannot be after the start date'; end if;
  note2 := nullif(trim(coalesce(p_note,'')),'');
  if p_trailer is not null then
    select * into nt from vehicles where id = p_trailer for update;
    if not found then raise exception 'Trailer not found'; end if;
    if nt.class not in ('Trailer','Special Trailer') then raise exception 'Choose a trailer'; end if;
    if nt.pulled_by_id = p_truck then raise exception 'That trailer is already behind this truck'; end if;
  elsif not exists (select 1 from vehicles where pulled_by_id = p_truck) then
    raise exception 'This truck has no trailer to remove';
  end if;
  -- end the trailer(s) behind this truck now
  for o in select * from vehicles where pulled_by_id = p_truck for update loop
    if o.pulled_since is not null and endd < o.pulled_since then raise exception 'The old trailer last day is before it was coupled'; end if;
    insert into coupling_history(trailer_id, truck_id, from_date, to_date, note, created_by) values (o.id, p_truck, o.pulled_since, endd, note2, auth.uid());
    update vehicles set pulled_by_id = null, pulled_since = null where id = o.id;
    oldnums := oldnums || case when oldnums = '' then '' else ', ' end || o.number;
  end loop;
  if p_trailer is not null then
    if nt.pulled_by_id is not null then
      select * into other from vehicles where id = nt.pulled_by_id;
      fromtruck := other.number;
      if nt.pulled_since is not null and p_start < nt.pulled_since then raise exception 'That trailer was coupled to % later than this start date', fromtruck; end if;
      insert into coupling_history(trailer_id, truck_id, from_date, to_date, note, created_by) values (nt.id, nt.pulled_by_id, nt.pulled_since, p_start, 'Moved to ' || t.number, auth.uid());
    end if;
    update vehicles set pulled_by_id = p_truck, pulled_since = p_start where id = p_trailer;
  end if;
  select email into em from app_users where id = auth.uid();
  insert into change_log(by_user, by_email, kind, vehicle_id, summary, details) values (auth.uid(), em, 'trailer', p_truck,
    format('%s: trailer changed from %s to %s (starts %s)', t.number, coalesce(nullif(oldnums,''),'none'), coalesce(nt.number,'none'), p_start),
    jsonb_build_object('old_trailers', oldnums, 'new_trailer_id', p_trailer, 'old_last_day', endd, 'start', p_start, 'moved_from_truck', fromtruck, 'note', note2));
  return jsonb_build_object('ok', true, 'old', nullif(oldnums,''), 'new', nt.number, 'moved_from', fromtruck);
end $function$;
