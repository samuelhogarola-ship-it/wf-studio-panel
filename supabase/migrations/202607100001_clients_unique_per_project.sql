drop index if exists public.clients_email_lower_unique_idx;

create unique index if not exists clients_project_email_lower_unique_idx
on public.clients (project, lower(email));
