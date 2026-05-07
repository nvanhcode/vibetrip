-- Migration: add support for multiple schedule slots per event record.
-- Apply this file manually in Supabase SQL editor.

create table if not exists public.event_record_schedules (
  id uuid primary key default gen_random_uuid(),
  event_record_id uuid not null references public.event_records(id) on delete cascade,
  slot_order integer not null,
  organized_at timestamptz not null,
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  constraint event_record_schedules_time_order_check check (opens_at < closes_at),
  constraint event_record_schedules_unique_order unique (event_record_id, slot_order)
);

create index if not exists idx_event_record_schedules_record
  on public.event_record_schedules(event_record_id, slot_order);

insert into public.event_record_schedules (event_record_id, slot_order, organized_at, opens_at, closes_at)
select er.id, 0, er.organized_at, er.opens_at, er.closes_at
from public.event_records er
where er.organized_at is not null
  and er.opens_at is not null
  and er.closes_at is not null
  and not exists (
    select 1
    from public.event_record_schedules ers
    where ers.event_record_id = er.id
  );

alter table public.event_record_schedules enable row level security;

drop policy if exists event_record_schedules_select_visible on public.event_record_schedules;
create policy event_record_schedules_select_visible
  on public.event_record_schedules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_records er
      where er.id = event_record_id
        and (
          (er.reviewed_at is not null and er.is_approved = true)
          or er.created_by = auth.uid()
          or public.can_review_event_record(er.province_code, er.ward_code)
        )
    )
  );

drop policy if exists event_record_schedules_insert_owner on public.event_record_schedules;
create policy event_record_schedules_insert_owner
  on public.event_record_schedules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.event_records er
      where er.id = event_record_id
        and er.created_by = auth.uid()
    )
  );

drop policy if exists event_record_schedules_delete_admin on public.event_record_schedules;
create policy event_record_schedules_delete_admin
  on public.event_record_schedules
  for delete
  to authenticated
  using (public.has_role('admin'));

grant select, insert on public.event_record_schedules to authenticated;
