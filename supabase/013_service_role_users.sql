-- 013_service_role_users.sql (18 Nov 2026)
-- The manage-users edge function runs with the service role and was refused: "permission denied for table app_users".
-- It needs only these:
grant select, insert, update on public.app_users to service_role;
grant insert on public.change_log to service_role;
