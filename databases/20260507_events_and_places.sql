-- Migration: Events/Places records with category, organizer and approval workflow.
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.event_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_records (
  id uuid primary key default gen_random_uuid(),
  record_kind text not null,
  goong_place_id text not null,
  province_code text not null references public.provinces(code) on delete restrict,
  ward_code text not null references public.wards(code) on delete restrict,
  event_name text not null,
  event_type text not null,
  event_description text not null,
  allow_registration boolean not null default false,
  organized_at timestamptz,
  opens_at time,
  closes_at time,
  excluded_weekdays text[] not null default '{}',
  schedule_description text,
  contact_phone text,
  contact_email text,
  contact_name text,
  is_approved boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_records_kind_check check (record_kind in ('event', 'place')),
  constraint event_records_time_pair_check check (
    (opens_at is null and closes_at is null)
    or (opens_at is not null and closes_at is not null)
  ),
  constraint event_records_schedule_presence_check check (
    organized_at is not null
    or (opens_at is not null and closes_at is not null)
    or nullif(btrim(coalesce(schedule_description, '')), '') is not null
  ),
  constraint event_records_review_state_check check (
    (
      reviewed_at is null
      and reviewed_by is null
      and rejection_reason is null
      and is_approved = false
    )
    or (
      reviewed_at is not null
      and reviewed_by is not null
      and (
        (is_approved = true and rejection_reason is null)
        or is_approved = false
      )
    )
  )
);

create table if not exists public.event_record_categories (
  event_record_id uuid not null references public.event_records(id) on delete cascade,
  category_id uuid not null references public.event_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_record_id, category_id)
);

create table if not exists public.event_record_organizers (
  event_record_id uuid not null references public.event_records(id) on delete cascade,
  organizer_id uuid not null references public.event_organizers(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_record_id, organizer_id)
);

create unique index if not exists idx_event_categories_name_unique
  on public.event_categories (lower(name));
create unique index if not exists idx_event_organizers_name_unique
  on public.event_organizers (lower(name));
create index if not exists idx_event_records_created_at
  on public.event_records(created_at desc);
create index if not exists idx_event_records_pending_review
  on public.event_records(reviewed_at)
  where reviewed_at is null;
create index if not exists idx_event_records_geo_scope
  on public.event_records(province_code, ward_code);
create index if not exists idx_event_records_goong_place_id
  on public.event_records(goong_place_id);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.can_review_event_record(target_province_code text, target_ward_code text)
returns boolean
language sql
stable
as $$
  select public.has_role('admin')
  or exists (
    select 1
    from public.province_managers pm
    where pm.user_id = auth.uid()
      and pm.province_code = target_province_code
  )
  or exists (
    select 1
    from public.ward_admins wa
    where wa.user_id = auth.uid()
      and wa.ward_code = target_ward_code
  );
$$;

drop trigger if exists trg_event_categories_updated_at on public.event_categories;
create trigger trg_event_categories_updated_at
before update on public.event_categories
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_event_organizers_updated_at on public.event_organizers;
create trigger trg_event_organizers_updated_at
before update on public.event_organizers
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_event_records_updated_at on public.event_records;
create trigger trg_event_records_updated_at
before update on public.event_records
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.event_categories enable row level security;
alter table public.event_organizers enable row level security;
alter table public.event_records enable row level security;
alter table public.event_record_categories enable row level security;
alter table public.event_record_organizers enable row level security;

drop policy if exists event_categories_select_authenticated on public.event_categories;
create policy event_categories_select_authenticated
  on public.event_categories
  for select
  to authenticated
  using (true);

drop policy if exists event_categories_insert_authenticated on public.event_categories;
create policy event_categories_insert_authenticated
  on public.event_categories
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists event_categories_update_owner_or_admin on public.event_categories;
create policy event_categories_update_owner_or_admin
  on public.event_categories
  for update
  to authenticated
  using (created_by = auth.uid() or public.has_role('admin'))
  with check (created_by = auth.uid() or public.has_role('admin'));

drop policy if exists event_organizers_select_authenticated on public.event_organizers;
create policy event_organizers_select_authenticated
  on public.event_organizers
  for select
  to authenticated
  using (true);

drop policy if exists event_organizers_insert_authenticated on public.event_organizers;
create policy event_organizers_insert_authenticated
  on public.event_organizers
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists event_organizers_update_owner_or_admin on public.event_organizers;
create policy event_organizers_update_owner_or_admin
  on public.event_organizers
  for update
  to authenticated
  using (created_by = auth.uid() or public.has_role('admin'))
  with check (created_by = auth.uid() or public.has_role('admin'));

drop policy if exists event_records_select_visible on public.event_records;
create policy event_records_select_visible
  on public.event_records
  for select
  to authenticated
  using (
    (reviewed_at is not null and is_approved = true)
    or created_by = auth.uid()
    or public.can_review_event_record(province_code, ward_code)
  );

drop policy if exists event_records_insert_authenticated on public.event_records;
create policy event_records_insert_authenticated
  on public.event_records
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
    and is_approved = false
  );

drop policy if exists event_records_update_creator_or_reviewer on public.event_records;
create policy event_records_update_creator_or_reviewer
  on public.event_records
  for update
  to authenticated
  using (
    public.can_review_event_record(province_code, ward_code)
  )
  with check (
    public.can_review_event_record(province_code, ward_code)
  );

drop policy if exists event_records_delete_admin on public.event_records;
create policy event_records_delete_admin
  on public.event_records
  for delete
  to authenticated
  using (public.has_role('admin'));

drop policy if exists event_record_categories_select_authenticated on public.event_record_categories;
create policy event_record_categories_select_authenticated
  on public.event_record_categories
  for select
  to authenticated
  using (true);

drop policy if exists event_record_categories_insert_from_owner on public.event_record_categories;
create policy event_record_categories_insert_from_owner
  on public.event_record_categories
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

drop policy if exists event_record_organizers_select_authenticated on public.event_record_organizers;
create policy event_record_organizers_select_authenticated
  on public.event_record_organizers
  for select
  to authenticated
  using (true);

drop policy if exists event_record_organizers_insert_from_owner on public.event_record_organizers;
create policy event_record_organizers_insert_from_owner
  on public.event_record_organizers
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

grant select, insert, update on public.event_categories to authenticated;
grant select, insert, update on public.event_organizers to authenticated;
grant select, insert, update, delete on public.event_records to authenticated;
grant select, insert on public.event_record_categories to authenticated;
grant select, insert on public.event_record_organizers to authenticated;
