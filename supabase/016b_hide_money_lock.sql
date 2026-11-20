-- 016b_hide_money_lock.sql - STEP C (run only after the new page is live and tested)
-- Closes the back door: fines and the base hire_terms table become readable by Admin, Editor and Manager only.
drop policy if exists fines_read on public.fines;
create policy fines_read on public.fines for select to authenticated using (app.can_see_money());
drop policy if exists hire_terms_read on public.hire_terms;
create policy hire_terms_read on public.hire_terms for select to authenticated using (app.can_see_money());
-- To undo: recreate both policies with using (app.is_member()).
