-- TEST ONLY: the historical account-assignment migration requires production
-- account record, which does not exist after a --no-seed fresh replay.
-- These synthetic prerequisites exist only in the disposable local test stack.
insert into public.clients (id, name, email, project, status)
values ('00000000-0000-4000-8000-000000000547', 'Support test prerequisite', '547@agama.com.mx', 'wf-studio', 'active');
