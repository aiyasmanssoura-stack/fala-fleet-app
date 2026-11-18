-- 014_landside_hired_in.sql (18 Nov 2026)
-- Hired-in machines get a Landside Gate Pass box, and one for their driver (hired drivers are not on our People list,
-- so the driver's pass is kept on the machine as paper type 'Hired driver Landside Pass', applies_to vehicle).
-- AMIA Project Editor may ENTER a first date for these on hired-in machines; on our own vehicles it still can only change an existing pass.
insert into public.paper_types(name, applies_to, warn_days, sort, has_expiry)
select 'Hired driver Landside Pass', 'vehicle', 10, 16, true
where not exists (select 1 from public.paper_types where name = 'Hired driver Landside Pass');
-- app.can_edit_paper now accepts both names; public.renew_paper skips the "existing only" rule when vehicles.ownership = 'Hired in'.
-- (Full function bodies: see 012_amia_editor.sql, with that one extra condition.)
