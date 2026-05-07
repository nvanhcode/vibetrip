-- Migration: RBAC + assignment flow for admin / province manager / ward admin
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'province_manager', 'ward_admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'access_request_status') then
    create type public.access_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'wards'
      and constraint_name = 'wards_province_code_fkey'
  ) then
    alter table public.wards
      add constraint wards_province_code_fkey
      foreign key (province_code) references public.provinces(code) on delete restrict;
  end if;
end $$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.province_managers (
  user_id uuid not null references auth.users(id) on delete cascade,
  province_code text not null references public.provinces(code) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, province_code)
);

create table if not exists public.ward_admins (
  user_id uuid not null references auth.users(id) on delete cascade,
  ward_code text not null references public.wards(code) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, ward_code)
);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text not null,
  requested_role public.app_role,
  status public.access_request_status not null default 'pending',
  notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.access_requests
  add column if not exists requested_role public.app_role;

create index if not exists idx_wards_province_code on public.wards(province_code);
create index if not exists idx_user_roles_role on public.user_roles(role);
create index if not exists idx_province_managers_province_code on public.province_managers(province_code);
create index if not exists idx_ward_admins_ward_code on public.ward_admins(ward_code);
create index if not exists idx_access_requests_status on public.access_requests(status);
create index if not exists idx_access_requests_requested_role on public.access_requests(requested_role);
create unique index if not exists idx_access_requests_pending_email_unique
  on public.access_requests(lower(email))
  where status = 'pending';

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.has_role(target_role public.app_role)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = target_role
  );
$$;

create or replace function public.can_manage_ward(target_ward_code text)
returns boolean
language sql
stable
as $$
  select public.has_role('admin')
  or exists (
    select 1
    from public.province_managers pm
    join public.wards w on w.province_code = pm.province_code
    where pm.user_id = auth.uid()
      and w.code = target_ward_code
  );
$$;

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_access_requests_updated_at on public.access_requests;
create trigger trg_access_requests_updated_at
before update on public.access_requests
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_roles enable row level security;
alter table public.province_managers enable row level security;
alter table public.ward_admins enable row level security;
alter table public.access_requests enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));

drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all
  on public.user_roles
  for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists user_roles_province_manager_assign_ward_admin on public.user_roles;
create policy user_roles_province_manager_assign_ward_admin
  on public.user_roles
  for insert
  to authenticated
  with check (public.has_role('province_manager') and role = 'ward_admin');

drop policy if exists user_roles_province_manager_update_ward_admin on public.user_roles;
create policy user_roles_province_manager_update_ward_admin
  on public.user_roles
  for update
  to authenticated
  using (public.has_role('province_manager') and role = 'ward_admin')
  with check (public.has_role('province_manager') and role = 'ward_admin');

drop policy if exists province_managers_select_own on public.province_managers;
create policy province_managers_select_own
  on public.province_managers
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));

drop policy if exists province_managers_admin_all on public.province_managers;
create policy province_managers_admin_all
  on public.province_managers
  for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists ward_admins_select_own on public.ward_admins;
create policy ward_admins_select_own
  on public.ward_admins
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_role('admin') or public.can_manage_ward(ward_code));

drop policy if exists ward_admins_admin_all on public.ward_admins;
create policy ward_admins_admin_all
  on public.ward_admins
  for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists ward_admins_province_manager_assign on public.ward_admins;
create policy ward_admins_province_manager_assign
  on public.ward_admins
  for all
  to authenticated
  using (public.has_role('province_manager') and public.can_manage_ward(ward_code))
  with check (public.has_role('province_manager') and public.can_manage_ward(ward_code));

drop policy if exists access_requests_insert_public on public.access_requests;
create policy access_requests_insert_public
  on public.access_requests
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and (
      requested_role is null
      or requested_role in ('province_manager', 'ward_admin')
    )
  );

drop policy if exists access_requests_select_own_or_admin on public.access_requests;
create policy access_requests_select_own_or_admin
  on public.access_requests
  for select
  to authenticated
  using (
    public.has_role('admin')
    or user_id = auth.uid()
    or lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

drop policy if exists access_requests_province_manager_select_ward on public.access_requests;
create policy access_requests_province_manager_select_ward
  on public.access_requests
  for select
  to authenticated
  using (public.has_role('province_manager') and requested_role = 'ward_admin');

drop policy if exists access_requests_admin_update on public.access_requests;
create policy access_requests_admin_update
  on public.access_requests
  for update
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists access_requests_province_manager_update_ward on public.access_requests;
create policy access_requests_province_manager_update_ward
  on public.access_requests
  for update
  to authenticated
  using (public.has_role('province_manager') and requested_role = 'ward_admin')
  with check (public.has_role('province_manager') and requested_role = 'ward_admin');

drop policy if exists access_requests_admin_delete on public.access_requests;
create policy access_requests_admin_delete
  on public.access_requests
  for delete
  to authenticated
  using (public.has_role('admin'));

grant usage on schema public to anon, authenticated;
grant select on public.provinces, public.wards to anon, authenticated;
grant select, insert, update, delete on public.user_roles, public.province_managers, public.ward_admins, public.access_requests to authenticated;
grant insert on public.access_requests to anon;
