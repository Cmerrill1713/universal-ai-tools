-- Verified Facts table for factuality guard
create table if not exists verified_facts (
  id uuid primary key default gen_random_uuid(),
  question text not null unique,
  answer text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_verified_facts_question on verified_facts using gin (to_tsvector('english', question));

create trigger set_verified_facts_updated_at
before update on verified_facts
for each row execute procedure trigger_set_timestamp();
