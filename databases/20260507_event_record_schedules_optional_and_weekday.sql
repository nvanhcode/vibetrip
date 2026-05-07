-- Migration: allow empty schedule, and support schedule by specific date or weekday.
-- Apply this file manually in Supabase SQL editor.

alter table public.event_record_schedules
  alter column organized_at drop not null;

alter table public.event_record_schedules
  add column if not exists weekday smallint;

alter table public.event_record_schedules
  drop constraint if exists event_record_schedules_mode_check;

alter table public.event_record_schedules
  add constraint event_record_schedules_mode_check check (
    (organized_at is not null and weekday is null)
    or (organized_at is null and weekday between 1 and 7)
  );

alter table public.event_records
  drop constraint if exists event_records_schedule_presence_check;