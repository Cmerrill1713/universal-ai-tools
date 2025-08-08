-- Enable RLS and basic policies for verified_facts
alter table verified_facts enable row level security;

drop policy if exists verified_facts_read on verified_facts;
create policy verified_facts_read on verified_facts
for select to anon using (true);

-- Allow writes only to service role
drop policy if exists verified_facts_write on verified_facts;
create policy verified_facts_write on verified_facts
for all to service_role using (true) with check (true);
