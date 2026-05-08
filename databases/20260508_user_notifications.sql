-- Migration: User notifications for review decisions and forum interactions with realtime support.

create extension if not exists pgcrypto;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_display_name text,
  notification_type text not null,
  title text not null,
  body text not null,
  link_path text not null,
  related_resource_type text not null,
  related_resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_type_check check (
    notification_type in (
      'event_record_reviewed',
      'forum_post_liked',
      'forum_post_commented',
      'forum_comment_replied'
    )
  ),
  constraint user_notifications_read_state_check check (
    (is_read = false and read_at is null)
    or is_read = true
  )
);

create index if not exists idx_user_notifications_recipient_created
  on public.user_notifications(recipient_user_id, created_at desc);

create index if not exists idx_user_notifications_unread
  on public.user_notifications(recipient_user_id, is_read)
  where is_read = false;

create schema if not exists private;

create or replace function private.resolve_actor_display_name(actor_id uuid)
returns text
language sql
stable
security definer
set search_path = auth
as $$
  select coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Người dùng'
  )
  from auth.users u
  where u.id = actor_id
  limit 1;
$$;

create or replace function private.enqueue_user_notification(
  recipient_id uuid,
  actor_id uuid,
  type_value text,
  title_value text,
  body_value text,
  link_value text,
  resource_type_value text,
  resource_id_value uuid,
  metadata_value jsonb default '{}'::jsonb,
  actor_name_value text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  resolved_actor_name text;
begin
  if recipient_id is null then
    return;
  end if;

  if actor_id is not null and recipient_id = actor_id then
    return;
  end if;

  resolved_actor_name := coalesce(
    nullif(trim(coalesce(actor_name_value, '')), ''),
    private.resolve_actor_display_name(actor_id)
  );

  insert into public.user_notifications (
    recipient_user_id,
    actor_user_id,
    actor_display_name,
    notification_type,
    title,
    body,
    link_path,
    related_resource_type,
    related_resource_id,
    metadata
  )
  values (
    recipient_id,
    actor_id,
    resolved_actor_name,
    type_value,
    title_value,
    body_value,
    link_value,
    resource_type_value,
    resource_id_value,
    coalesce(metadata_value, '{}'::jsonb)
  );
end;
$$;

create or replace function private.notify_forum_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  post_author_id uuid;
  actor_name text;
begin
  select p.author_id
  into post_author_id
  from public.forum_posts p
  where p.id = new.post_id;

  actor_name := private.resolve_actor_display_name(new.user_id);

  perform private.enqueue_user_notification(
    post_author_id,
    new.user_id,
    'forum_post_liked',
    'Bài viết có lượt thích mới',
    coalesce(actor_name, 'Ai đó') || ' đã thích bài viết của bạn.',
    '/forum?post=' || new.post_id || '#post-' || new.post_id,
    'forum_post',
    new.post_id,
    jsonb_build_object('post_id', new.post_id),
    actor_name
  );

  return new;
end;
$$;

create or replace function private.notify_forum_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  post_author_id uuid;
  parent_author_id uuid;
  actor_name text;
begin
  select p.author_id
  into post_author_id
  from public.forum_posts p
  where p.id = new.post_id;

  actor_name := private.resolve_actor_display_name(new.author_id);

  perform private.enqueue_user_notification(
    post_author_id,
    new.author_id,
    'forum_post_commented',
    'Bài viết có bình luận mới',
    coalesce(actor_name, 'Ai đó') || ' đã bình luận bài viết của bạn.',
    '/forum?post=' || new.post_id || '#comment-' || new.id,
    'forum_post_comment',
    new.id,
    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id),
    actor_name
  );

  if new.parent_comment_id is not null then
    select c.author_id
    into parent_author_id
    from public.forum_post_comments c
    where c.id = new.parent_comment_id;

    if parent_author_id is not null and parent_author_id <> post_author_id then
      perform private.enqueue_user_notification(
        parent_author_id,
        new.author_id,
        'forum_comment_replied',
        'Bình luận có phản hồi mới',
        coalesce(actor_name, 'Ai đó') || ' đã trả lời bình luận của bạn.',
        '/forum?post=' || new.post_id || '#comment-' || new.id,
        'forum_post_comment',
        new.id,
        jsonb_build_object(
          'post_id', new.post_id,
          'comment_id', new.id,
          'parent_comment_id', new.parent_comment_id
        ),
        actor_name
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.notify_event_record_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.reviewed_at is null and new.reviewed_at is not null then
    perform private.enqueue_user_notification(
      new.created_by,
      new.reviewed_by,
      'event_record_reviewed',
      case when new.is_approved then 'Bản ghi đã được duyệt' else 'Bản ghi bị từ chối' end,
      case
        when new.is_approved then
          'Bản ghi "' || new.event_name || '" đã được duyệt.'
        when coalesce(trim(new.rejection_reason), '') <> '' then
          'Bản ghi "' || new.event_name || '" bị từ chối: ' || new.rejection_reason
        else
          'Bản ghi "' || new.event_name || '" đã bị từ chối.'
      end,
      '/events/' || new.id,
      'event_record',
      new.id,
      jsonb_build_object('event_record_id', new.id, 'is_approved', new.is_approved)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_forum_post_like on public.forum_post_likes;
create trigger trg_notify_forum_post_like
after insert on public.forum_post_likes
for each row
execute function private.notify_forum_post_like();

drop trigger if exists trg_notify_forum_post_comment on public.forum_post_comments;
create trigger trg_notify_forum_post_comment
after insert on public.forum_post_comments
for each row
execute function private.notify_forum_post_comment();

drop trigger if exists trg_notify_event_record_reviewed on public.event_records;
create trigger trg_notify_event_record_reviewed
after update on public.event_records
for each row
execute function private.notify_event_record_reviewed();

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own
  on public.user_notifications
  for select
  to authenticated
  using (auth.uid() = recipient_user_id);

drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own
  on public.user_notifications
  for update
  to authenticated
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

drop policy if exists user_notifications_delete_own on public.user_notifications;
create policy user_notifications_delete_own
  on public.user_notifications
  for delete
  to authenticated
  using (auth.uid() = recipient_user_id);

grant select, update, delete on public.user_notifications to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_notifications'
    ) then
    execute 'alter publication supabase_realtime add table public.user_notifications';
  end if;
end
$$;
