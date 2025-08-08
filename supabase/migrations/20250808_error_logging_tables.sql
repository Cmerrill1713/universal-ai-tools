-- Error logging tables
create table if not exists public.error_events (
  id uuid primary key,
  path text not null,
  method text not null,
  message text not null,
  stack text null,
  status_code integer not null default 500,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists error_events_created_at_idx on public.error_events (created_at desc);
create index if not exists error_events_path_idx on public.error_events (path);

create table if not exists public.error_corrections (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null references public.error_events(id) on delete cascade,
  fix_summary text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists error_corrections_corr_idx on public.error_corrections (correlation_id, created_at desc);

-- Enable RLS with permissive read in development; tighten in production
alter table public.error_events enable row level security;
alter table public.error_corrections enable row level security;

-- In development, allow read to anon; in production, you should restrict
create policy if not exists error_events_read_all on public.error_events for select using (true);
create policy if not exists error_corrections_read_all on public.error_corrections for select using (true);

-- Insert helper function for listing recent errors (optional)
create or replace function public.list_recent_errors(limit_count integer default 50)
returns setof public.error_events
language sql
as $$
  select * from public.error_events order by created_at desc limit limit_count;
$$;
