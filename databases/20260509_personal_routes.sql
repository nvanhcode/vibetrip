-- Migration: Personal travel routes with privacy scopes and route stops.
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.user_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_display_name text not null default 'Người dùng',
  title text not null,
  start_date date not null,
  visibility text not null default 'private',
  origin_label text not null,
  origin_latitude double precision not null,
  origin_longitude double precision not null,
  summary text,
  stop_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_routes_visibility_check check (
    visibility in ('public', 'friends', 'private')
  ),
  constraint user_routes_stop_count_non_negative_check check (stop_count >= 0),
  constraint user_routes_title_non_empty_check check (nullif(btrim(title), '') is not null),
  constraint user_routes_origin_label_non_empty_check check (
    nullif(btrim(origin_label), '') is not null
  )
);

create table if not exists public.user_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.user_routes(id) on delete cascade,
  position integer not null,
  stop_kind text not null,
  label text not null,
  latitude double precision not null,
  longitude double precision not null,
  event_record_id uuid references public.event_records(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_route_stops_position_non_negative_check check (position >= 0),
  constraint user_route_stops_kind_check check (stop_kind in ('origin', 'record')),
  constraint user_route_stops_label_non_empty_check check (nullif(btrim(label), '') is not null),
  constraint user_route_stops_route_position_unique unique (route_id, position)
);

create index if not exists idx_user_routes_owner_created
  on public.user_routes(owner_id, created_at desc);

create index if not exists idx_user_routes_visibility_start
  on public.user_routes(visibility, start_date asc, created_at desc);

create index if not exists idx_user_route_stops_route_position
  on public.user_route_stops(route_id, position asc);

create or replace function public.is_user_friend(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_friendships uf
    where uf.status = 'accepted'
      and (
        (uf.requester_id = auth.uid() and uf.addressee_id = target_user_id)
        or (uf.requester_id = target_user_id and uf.addressee_id = auth.uid())
      )
  );
$$;

grant execute on function public.is_user_friend(uuid) to authenticated;

drop trigger if exists trg_user_routes_updated_at on public.user_routes;
create trigger trg_user_routes_updated_at
before update on public.user_routes
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_routes enable row level security;
alter table public.user_route_stops enable row level security;

drop policy if exists user_routes_select_scoped on public.user_routes;
create policy user_routes_select_scoped
  on public.user_routes
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    or visibility = 'public'
    or (visibility = 'friends' and public.is_user_friend(owner_id))
  );

drop policy if exists user_routes_insert_own on public.user_routes;
create policy user_routes_insert_own
  on public.user_routes
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists user_routes_update_own on public.user_routes;
create policy user_routes_update_own
  on public.user_routes
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists user_routes_delete_own on public.user_routes;
create policy user_routes_delete_own
  on public.user_routes
  for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists user_route_stops_select_scoped on public.user_route_stops;
create policy user_route_stops_select_scoped
  on public.user_route_stops
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_routes ur
      where ur.id = user_route_stops.route_id
        and (
          auth.uid() = ur.owner_id
          or ur.visibility = 'public'
          or (ur.visibility = 'friends' and public.is_user_friend(ur.owner_id))
        )
    )
  );

drop policy if exists user_route_stops_insert_own on public.user_route_stops;
create policy user_route_stops_insert_own
  on public.user_route_stops
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_routes ur
      where ur.id = user_route_stops.route_id
        and ur.owner_id = auth.uid()
    )
  );

drop policy if exists user_route_stops_update_own on public.user_route_stops;
create policy user_route_stops_update_own
  on public.user_route_stops
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_routes ur
      where ur.id = user_route_stops.route_id
        and ur.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.user_routes ur
      where ur.id = user_route_stops.route_id
        and ur.owner_id = auth.uid()
    )
  );

drop policy if exists user_route_stops_delete_own on public.user_route_stops;
create policy user_route_stops_delete_own
  on public.user_route_stops
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_routes ur
      where ur.id = user_route_stops.route_id
        and ur.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.user_routes to authenticated;
grant select, insert, update, delete on public.user_route_stops to authenticated;
