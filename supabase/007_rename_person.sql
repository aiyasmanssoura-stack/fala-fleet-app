-- 17 Nov 2026: Admin can change a person's full name (applied as migration "rename_person").
create or replace function public.rename_person(p_person bigint, p_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare o people%rowtype; nn text; em text;
begin
  if not app.is_admin() then raise exception 'Only the administrator can change a name'; end if;
  nn := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
  if nn = '' then raise exception 'The name cannot be empty'; end if;
  select * into o from people where id = p_person for update;
  if not found then raise exception 'Person not found'; end if;
  if nn = o.passport_name then raise exception 'That is already his name'; end if;
  if exists (select 1 from people where id <> p_person and lower(passport_name) = lower(nn)) then
    raise exception 'Another person already has this name'; end if;
  update people set passport_name = nn, updated_at = now(), updated_by = auth.uid() where id = p_person;
  insert into name_spellings(spelling, person_id) values (o.passport_name, p_person) on conflict (spelling) do nothing;
  select email into em from app_users where id = auth.uid();
  insert into change_log(by_user, by_email, kind, summary, details) values (auth.uid(), em, 'person',
    format('%s: name changed to %s', o.passport_name, nn),
    jsonb_build_object('person_id', p_person, 'old', jsonb_build_object('name', o.passport_name), 'new', jsonb_build_object('name', nn)));
  return jsonb_build_object('ok', true, 'name', nn);
end $$;
revoke all on function public.rename_person(bigint, text) from public, anon;
grant execute on function public.rename_person(bigint, text) to authenticated;
