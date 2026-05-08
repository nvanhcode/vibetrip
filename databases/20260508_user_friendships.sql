-- Migration: User friendships (kết bạn) with RLS, mutual friends RPC, and notification support.
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

-- ─── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  -- pending → accepted | declined | blocked
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_friendships_status_check check (
    status in ('pending', 'accepted', 'declined', 'blocked')
  ),
  constraint user_friendships_no_self_check check (requester_id <> addressee_id)
);

-- Ensure at most one record per ordered pair (A→B or B→A)
create unique index if not exists user_friendships_pair_unique
  on public.user_friendships (
    least(requester_id::text, addressee_id::text),
    greatest(requester_id::text, addressee_id::text)
  );

create index if not exists idx_user_friendships_requester
  on public.user_friendships(requester_id, status);

create index if not exists idx_user_friendships_addressee
  on public.user_friendships(addressee_id, status);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

drop trigger if exists trg_user_friendships_updated_at on public.user_friendships;
create trigger trg_user_friendships_updated_at
before update on public.user_friendships
for each row
execute function public.set_current_timestamp_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.user_friendships enable row level security;

-- Any authenticated user can see friendships they are part of
drop policy if exists user_friendships_select_own on public.user_friendships;
create policy user_friendships_select_own
  on public.user_friendships
  for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Only the requester may insert (send a friend request)
drop policy if exists user_friendships_insert_own on public.user_friendships;
create policy user_friendships_insert_own
  on public.user_friendships
  for insert
  to authenticated
  with check (auth.uid() = requester_id);

-- Either party may update (accept / decline / block / cancel)
drop policy if exists user_friendships_update_own on public.user_friendships;
create policy user_friendships_update_own
  on public.user_friendships
  for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Either party may delete (unfriend / withdraw request)
drop policy if exists user_friendships_delete_own on public.user_friendships;
create policy user_friendships_delete_own
  on public.user_friendships
  for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

grant select, insert, update, delete on public.user_friendships to authenticated;

-- ─── RPC: get_user_profile ────────────────────────────────────────────────────
-- Returns minimal public profile info for a given user_id.
-- Falls back to stored author_name from their latest forum post when no
-- metadata is available.

create or replace function public.get_user_profile(target_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  post_count bigint,
  friend_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_display_name text;
  v_avatar_url   text;
begin
  -- Resolve display name from auth metadata (requires service role in practice;
  -- with anon key this will return null – the caller falls back to forum_posts)
  select
    coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Người dùng'
    ),
    coalesce(nullif(trim(coalesce(u.raw_user_meta_data ->> 'avatar_url', '')), ''), null)
  into v_display_name, v_avatar_url
  from auth.users u
  where u.id = target_user_id
  limit 1;

  -- If auth lookup returned nothing (anon key restriction), fall back to posts
  if v_display_name is null or v_display_name = 'Người dùng' then
    select
      coalesce(nullif(trim(fp.author_name), ''), 'Người dùng'),
      fp.author_avatar_url
    into v_display_name, v_avatar_url
    from public.forum_posts fp
    where fp.author_id = target_user_id
    order by fp.created_at desc
    limit 1;
  end if;

  return query
  select
    target_user_id as id,
    coalesce(v_display_name, 'Người dùng') as display_name,
    v_avatar_url as avatar_url,
    (select count(*) from public.forum_posts where author_id = target_user_id) as post_count,
    (
      select count(*)
      from public.user_friendships uf
      where (uf.requester_id = target_user_id or uf.addressee_id = target_user_id)
        and uf.status = 'accepted'
    ) as friend_count;
end;
$$;

grant execute on function public.get_user_profile(uuid) to authenticated;

-- ─── RPC: get_mutual_friends ──────────────────────────────────────────────────
-- Returns user IDs, display_name and avatar_url of mutual friends between the
-- calling user and another user.

create or replace function public.get_mutual_friends(target_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  return query
  with caller_friends as (
    select case
      when uf.requester_id = auth.uid() then uf.addressee_id
      else uf.requester_id
    end as friend_id
    from public.user_friendships uf
    where (uf.requester_id = auth.uid() or uf.addressee_id = auth.uid())
      and uf.status = 'accepted'
  ),
  target_friends as (
    select case
      when uf.requester_id = target_user_id then uf.addressee_id
      else uf.requester_id
    end as friend_id
    from public.user_friendships uf
    where (uf.requester_id = target_user_id or uf.addressee_id = target_user_id)
      and uf.status = 'accepted'
  ),
  mutual as (
    select cf.friend_id
    from caller_friends cf
    inner join target_friends tf on cf.friend_id = tf.friend_id
    where cf.friend_id <> auth.uid()
      and cf.friend_id <> target_user_id
  )
  select
    m.friend_id as user_id,
    coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Người dùng'
    ) as display_name,
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'avatar_url', '')), '') as avatar_url
  from mutual m
  left join auth.users u on u.id = m.friend_id
  limit 20;
end;
$$;

grant execute on function public.get_mutual_friends(uuid) to authenticated;

-- ─── Extend notification types to support friendship events ───────────────────

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check check (
    notification_type in (
      'event_record_reviewed',
      'forum_post_liked',
      'forum_post_commented',
      'forum_comment_replied',
      'friend_request_received',
      'friend_request_accepted'
    )
  );

-- ─── Trigger: notify on friend request ───────────────────────────────────────

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  -- Send notification when a new pending request is created
  if (tg_op = 'INSERT' and new.status = 'pending') then
    perform private.enqueue_user_notification(
      recipient_id       => new.addressee_id,
      actor_id           => new.requester_id,
      type_value         => 'friend_request_received',
      title_value        => 'Lời mời kết bạn mới',
      body_value         => private.resolve_actor_display_name(new.requester_id) || ' đã gửi cho bạn lời mời kết bạn.',
      link_value         => '/profile/' || new.requester_id::text,
      resource_type_value => 'user_friendship',
      resource_id_value  => new.id
    );
  end if;

  -- Send notification when request is accepted
  if (tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted') then
    perform private.enqueue_user_notification(
      recipient_id       => new.requester_id,
      actor_id           => new.addressee_id,
      type_value         => 'friend_request_accepted',
      title_value        => 'Lời mời kết bạn được chấp nhận',
      body_value         => private.resolve_actor_display_name(new.addressee_id) || ' đã chấp nhận lời mời kết bạn của bạn.',
      link_value         => '/profile/' || new.addressee_id::text,
      resource_type_value => 'user_friendship',
      resource_id_value  => new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_friend_request on public.user_friendships;
create trigger trg_notify_friend_request
after insert or update on public.user_friendships
for each row
execute function public.notify_friend_request();
