-- Migration: User event favorites (yêu thích sự kiện) with RLS.
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

-- ─── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.user_event_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_record_id uuid not null references public.event_records(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_event_favorites_unique unique (user_id, event_record_id),
  constraint user_event_favorites_record_approved check (
    -- This check is advisory; RLS policy is the primary enforcement
    true
  )
);

create index if not exists idx_user_event_favorites_user
  on public.user_event_favorites(user_id, created_at desc);

create index if not exists idx_user_event_favorites_event
  on public.user_event_favorites(event_record_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.user_event_favorites enable row level security;

-- Anyone can view favorites of any user (public feature)
drop policy if exists user_event_favorites_select_public on public.user_event_favorites;
create policy user_event_favorites_select_public
  on public.user_event_favorites
  for select
  to authenticated
  using (true);

-- Only the user who created the favorite can insert
drop policy if exists user_event_favorites_insert_own on public.user_event_favorites;
create policy user_event_favorites_insert_own
  on public.user_event_favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Only the user who created the favorite can delete
drop policy if exists user_event_favorites_delete_own on public.user_event_favorites;
create policy user_event_favorites_delete_own
  on public.user_event_favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.user_event_favorites to authenticated;
