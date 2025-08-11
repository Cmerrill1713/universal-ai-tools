-- Minimal context_storage table (idempotent)
create table if not exists public.context_storage (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  content text not null,
  category text not null,
  source text,
  project_path text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_context_storage_user on public.context_storage(user_id);
create index if not exists idx_context_storage_category on public.context_storage(category);
create index if not exists idx_context_storage_created on public.context_storage(created_at desc);
create index if not exists idx_context_storage_meta on public.context_storage using gin (metadata);
