-- 016b_hide_money_lock.sql - STEP C (run only after the new page is live and tested; needs 018 first)
-- Closes the back door: fines readable only by levels switched on for fines; hired prices only by levels switched on for prices.
drop policy if exists fines_read on public.fines;
create policy fines_read on public.fines for select to authenticated using (app.can_see_fines());
drop policy if exists hire_terms_read on public.hire_terms;
create policy hire_terms_read on public.hire_terms for select to authenticated using (app.can_see_prices());
-- (the view hire_terms_open serves everybody else.)
-- To undo: recreate both policies with using (app.is_member()).
