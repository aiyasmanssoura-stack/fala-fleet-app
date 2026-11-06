-- 6 Nov 2026. The change_log table had no read permission for logged-in users, so the Admin Home page always got "permission denied".
-- Row rules still apply: only an Admin (app.is_admin()) can see any row. Contains no fleet data.
grant select on public.change_log to authenticated;
