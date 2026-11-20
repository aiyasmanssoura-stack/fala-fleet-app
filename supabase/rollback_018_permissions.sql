-- Rollback copy (20 Nov 2026): the state before 018.
create or replace function app.can_see_gps() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(app.my_role() in ('admin','editor','manager'), false)
$$;
create or replace view public.hire_terms_open as
  select id, vehicle_id, supplier_id, case when app.can_see_money() then monthly_rate end as monthly_rate,
         lpo_no, operator, operator_name, diesel_by, jack_hammer, start_date, end_date, note, updated_at, updated_by
  from public.hire_terms where app.is_member();
-- then: drop function public.set_permission(text,text,boolean); drop function app.can_see_fines(); drop function app.can_see_prices(); drop table public.role_permissions;
