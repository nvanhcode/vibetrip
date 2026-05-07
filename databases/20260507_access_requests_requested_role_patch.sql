-- Incremental migration after 20260507_rbac_and_user_assignment.sql was already applied.
-- Purpose: add requested_role support and province_manager review permissions for ward_admin requests.

-- 1) Add requested_role column for access request intent (province_manager | ward_admin)
alter table public.access_requests
  add column if not exists requested_role public.app_role;

-- 2) Optional index for filtering by requested_role in management UIs
create index if not exists idx_access_requests_requested_role
  on public.access_requests(requested_role);

-- 3) Replace insert policy to validate requested_role for public/authenticated inserts
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

-- 4) Let province managers read ward_admin requests so they can process them in UI
drop policy if exists access_requests_province_manager_select_ward on public.access_requests;
create policy access_requests_province_manager_select_ward
  on public.access_requests
  for select
  to authenticated
  using (public.has_role('province_manager') and requested_role = 'ward_admin');

-- 5) Let province managers update ward_admin requests (approve/reject flow)
drop policy if exists access_requests_province_manager_update_ward on public.access_requests;
create policy access_requests_province_manager_update_ward
  on public.access_requests
  for update
  to authenticated
  using (public.has_role('province_manager') and requested_role = 'ward_admin')
  with check (public.has_role('province_manager') and requested_role = 'ward_admin');
