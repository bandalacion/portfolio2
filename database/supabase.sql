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
