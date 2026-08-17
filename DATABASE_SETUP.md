# Shared Scheduler Database Setup

The scheduler uses browser storage as a fallback, but cross-device sync needs the deployed `/api/scheduler` endpoint and a Supabase database.

## 1. Create the Supabase table

In Supabase, open SQL Editor and run:

```sql
-- Use the checked-in file if you prefer copying from the repo:
-- database/supabase.sql
create table if not exists public.scheduler_state (
    id text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
);

create or replace function public.set_scheduler_state_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists scheduler_state_updated_at on public.scheduler_state;

create trigger scheduler_state_updated_at
before update on public.scheduler_state
for each row
execute function public.set_scheduler_state_updated_at();

alter table public.scheduler_state enable row level security;

drop policy if exists "scheduler_state_server_only" on public.scheduler_state;

create policy "scheduler_state_server_only"
on public.scheduler_state
for all
using (false)
with check (false);
```

## 2. Add Vercel environment variables

In Vercel project settings, add:

```text
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SCHEDULER_STATE_ID=main
```

Use the Supabase `service_role` key only in Vercel environment variables. Do not put it in frontend files.

## 3. Redeploy

Redeploy the site after adding the environment variables. The scheduler should then show `Synced` in the top bar after login.
