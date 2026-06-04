-- Allow the app (publishable/anon key in server .env) to read and write par tables.
-- For production, prefer SUPABASE_SERVICE_ROLE_KEY on the server only.

alter table public.usage_weekly enable row level security;
alter table public.liquor_par enable row level security;

drop policy if exists usage_weekly_app_all on public.usage_weekly;
create policy usage_weekly_app_all on public.usage_weekly
  for all
  using (true)
  with check (true);

drop policy if exists liquor_par_app_all on public.liquor_par;
create policy liquor_par_app_all on public.liquor_par
  for all
  using (true)
  with check (true);
