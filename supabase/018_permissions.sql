-- 018_permissions.sql (20 Nov 2026)
-- Permission switches per level, set on the Users page (Admin only).
-- Levels with switches: viewer (Guest) and amia_editor. Admin, Manager and Editor always see everything (locked on:
-- an Editor saves hired machine details, and a hidden price would be saved back as empty).
-- Switches: see_fines (fines and accidents), see_prices (hired prices), see_gps (GPS positions).

create table if not exists public.role_permissions (
  role        text primary key check (role in ('editor','manager','viewer','amia_editor')),
  see_fines   boolean not null default false,
  see_prices  boolean not null default false,
  see_gps     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
insert into public.role_permissions(role, see_fines, see_prices, see_gps) values
  ('editor', true, true, true), ('manager', true, true, true), ('viewer', false, false, false), ('amia_editor', false, false, false)
on conflict (role) do nothing;
alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated using (app.is_member());
grant select on public.role_permissions to authenticated;   -- writes only through set_permission

create or replace function app.can_see_fines() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(app.my_role() in ('admin','manager','editor') or (select p.see_fines from public.role_permissions p where p.role = app.my_role()), false)
$$;
create or replace function app.can_see_prices() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(app.my_role() in ('admin','manager','editor') or (select p.see_prices from public.role_permissions p where p.role = app.my_role()), false)
$$;
create or replace function app.can_see_gps() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(app.my_role() in ('admin','manager','editor') or (select p.see_gps from public.role_permissions p where p.role = app.my_role()), false)
$$;

create or replace view public.hire_terms_open as
  select id, vehicle_id, supplier_id,
         case when app.can_see_prices() then monthly_rate end as monthly_rate,
         lpo_no, operator, operator_name, diesel_by, jack_hammer, start_date, end_date, note, updated_at, updated_by
  from public.hire_terms where app.is_member();

create or replace function public.set_permission(p_role text, p_key text, p_value boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare em text; old boolean;
begin
 if not app.is_admin() then raise exception 'Only the administrator can change permissions'; end if;
 if p_role not in ('viewer','amia_editor') then raise exception 'That level always sees everything and cannot be changed'; end if;
 if p_key not in ('see_fines','see_prices','see_gps') then raise exception 'Unknown permission'; end if;
 if p_value is null then raise exception 'Choose on or off'; end if;
 execute format('select %I from public.role_permissions where role=$1', p_key) into old using p_role;
 execute format('update public.role_permissions set %I=$1, updated_at=now(), updated_by=auth.uid() where role=$2', p_key) using p_value, p_role;
 select email into em from app_users where id=auth.uid();
 insert into change_log(by_user,by_email,kind,summary,details)
 values(auth.uid(),em,'permission',format('Permission %s for %s switched %s',p_key,p_role,case when p_value then 'on' else 'off' end),
   jsonb_build_object('role',p_role,'key',p_key,'old',old,'new',p_value));
 return jsonb_build_object('ok',true);
end $function$;
grant execute on function public.set_permission(text,text,boolean) to authenticated;
