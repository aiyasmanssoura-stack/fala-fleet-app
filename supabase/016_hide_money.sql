-- 016_hide_money.sql (20 Nov 2026) - STEP A (additive only; nothing existing is changed)
-- Guest (viewer) and AMIA Project Editor must not see fines, accidents or hired prices. Admin, Editor and Manager see everything.
create or replace function app.can_see_money()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(app.my_role() in ('admin','editor','manager'), false)
$$;
-- Hired terms for everyone, with the monthly rate blanked for roles that may not see prices (same pattern as gps_odometer).
create or replace view public.hire_terms_open as
  select id, vehicle_id, supplier_id,
         case when app.can_see_money() then monthly_rate end as monthly_rate,
         lpo_no, operator, operator_name, diesel_by, jack_hammer, start_date, end_date, note, updated_at, updated_by
  from public.hire_terms where app.is_member();
grant select on public.hire_terms_open to authenticated;
