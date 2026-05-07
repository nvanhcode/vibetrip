-- Incremental migration: province-scoped ward admin access requests.
-- Purpose:
-- 1) Add province_code on access_requests so ward_admin requests are routed by province.
-- 2) Enforce province-bound checks for new inserts.
-- 3) Restrict province_manager read/update policies to managed provinces only.

alter table public.access_requests
  add column if not exists province_code text references public.provinces(code) on delete set null;

create index if not exists idx_access_requests_province_code
  on public.access_requests(province_code);

create index if not exists idx_access_requests_pending_role_province
  on public.access_requests(status, requested_role, province_code);

alter table public.access_requests
  drop constraint if exists access_requests_ward_admin_requires_province;

alter table public.access_requests
  add constraint access_requests_ward_admin_requires_province
  check (
    requested_role is distinct from 'ward_admin'::public.app_role
    or province_code is not null
  ) not valid;

-- Require province_code for ward_admin on new incoming requests.
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
    and (
      requested_role is distinct from 'ward_admin'::public.app_role
      or province_code is not null
    )
  );

-- Province managers can only see ward_admin requests for provinces they manage.
drop policy if exists access_requests_province_manager_select_ward on public.access_requests;
create policy access_requests_province_manager_select_ward
  on public.access_requests
  for select
  to authenticated
  using (
    public.has_role('province_manager')
    and requested_role = 'ward_admin'
    and province_code is not null
    and exists (
      select 1
      from public.province_managers pm
      where pm.user_id = auth.uid()
        and pm.province_code = access_requests.province_code
    )
  );

-- Province managers can only approve/reject ward_admin requests in managed provinces.
drop policy if exists access_requests_province_manager_update_ward on public.access_requests;
create policy access_requests_province_manager_update_ward
  on public.access_requests
  for update
  to authenticated
  using (
    public.has_role('province_manager')
    and requested_role = 'ward_admin'
    and province_code is not null
    and exists (
      select 1
      from public.province_managers pm
      where pm.user_id = auth.uid()
        and pm.province_code = access_requests.province_code
    )
  )
  with check (
    public.has_role('province_manager')
    and requested_role = 'ward_admin'
    and province_code is not null
    and exists (
      select 1
      from public.province_managers pm
      where pm.user_id = auth.uid()
        and pm.province_code = access_requests.province_code
    )
  );
