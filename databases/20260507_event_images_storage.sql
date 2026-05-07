-- Migration: Store event image URLs and configure Supabase Storage bucket for event images.
-- Apply this file manually in Supabase SQL editor.

alter table public.event_records
  add column if not exists image_urls text[] not null default '{}'::text[];

create index if not exists idx_event_records_image_urls_gin
  on public.event_records
  using gin (image_urls);

insert into storage.buckets (id, name, public)
values ('events', 'events', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists events_bucket_select_authenticated on storage.objects;
create policy events_bucket_select_authenticated
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'events');

drop policy if exists events_bucket_insert_authenticated on storage.objects;
create policy events_bucket_insert_authenticated
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'events');

drop policy if exists events_bucket_update_authenticated on storage.objects;
create policy events_bucket_update_authenticated
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'events')
  with check (bucket_id = 'events');

drop policy if exists events_bucket_delete_authenticated on storage.objects;
create policy events_bucket_delete_authenticated
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'events');
