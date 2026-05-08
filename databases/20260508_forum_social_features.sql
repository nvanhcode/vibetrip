-- Migration: Forum social features (posts, likes, comments/replies) with RLS and storage bucket.
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null,
  author_avatar_url text,
  content text not null default '',
  image_urls text[] not null default '{}'::text[],
  checkin_place_id text,
  checkin_place_name text,
  checkin_place_address text,
  checkin_latitude double precision,
  checkin_longitude double precision,
  event_record_id uuid references public.event_records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_posts_content_or_media_check check (
    nullif(btrim(content), '') is not null
    or coalesce(array_length(image_urls, 1), 0) > 0
  ),
  constraint forum_posts_checkin_pair_check check (
    (checkin_latitude is null and checkin_longitude is null)
    or (checkin_latitude is not null and checkin_longitude is not null)
  ),
  constraint forum_posts_checkin_name_with_coords_check check (
    (checkin_latitude is null and checkin_longitude is null)
    or nullif(btrim(coalesce(checkin_place_name, '')), '') is not null
  )
);

create table if not exists public.forum_post_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.forum_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  parent_comment_id uuid references public.forum_post_comments(id) on delete set null,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null,
  author_avatar_url text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_post_comments_content_check check (nullif(btrim(content), '') is not null)
);

create index if not exists idx_forum_posts_created_at
  on public.forum_posts(created_at desc);
create index if not exists idx_forum_post_likes_created_at
  on public.forum_post_likes(created_at desc);
create index if not exists idx_forum_post_comments_post_created
  on public.forum_post_comments(post_id, created_at asc);
create index if not exists idx_forum_post_comments_parent
  on public.forum_post_comments(parent_comment_id);

create or replace function public.forum_comment_parent_guard()
returns trigger
language plpgsql
as $$
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.forum_post_comments parent
    where parent.id = new.parent_comment_id
      and parent.post_id = new.post_id
  ) then
    raise exception 'parent_comment_id must belong to the same post';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_forum_posts_updated_at on public.forum_posts;
create trigger trg_forum_posts_updated_at
before update on public.forum_posts
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_forum_post_comments_updated_at on public.forum_post_comments;
create trigger trg_forum_post_comments_updated_at
before update on public.forum_post_comments
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_forum_comment_parent_guard on public.forum_post_comments;
create trigger trg_forum_comment_parent_guard
before insert or update on public.forum_post_comments
for each row
execute function public.forum_comment_parent_guard();

alter table public.forum_posts enable row level security;
alter table public.forum_post_likes enable row level security;
alter table public.forum_post_comments enable row level security;

drop policy if exists forum_posts_select_authenticated on public.forum_posts;
create policy forum_posts_select_authenticated
  on public.forum_posts
  for select
  to authenticated
  using (true);

drop policy if exists forum_posts_insert_own on public.forum_posts;
create policy forum_posts_insert_own
  on public.forum_posts
  for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists forum_posts_update_own on public.forum_posts;
create policy forum_posts_update_own
  on public.forum_posts
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists forum_posts_delete_own on public.forum_posts;
create policy forum_posts_delete_own
  on public.forum_posts
  for delete
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists forum_post_likes_select_authenticated on public.forum_post_likes;
create policy forum_post_likes_select_authenticated
  on public.forum_post_likes
  for select
  to authenticated
  using (true);

drop policy if exists forum_post_likes_insert_own on public.forum_post_likes;
create policy forum_post_likes_insert_own
  on public.forum_post_likes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists forum_post_likes_delete_own on public.forum_post_likes;
create policy forum_post_likes_delete_own
  on public.forum_post_likes
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists forum_post_comments_select_authenticated on public.forum_post_comments;
create policy forum_post_comments_select_authenticated
  on public.forum_post_comments
  for select
  to authenticated
  using (true);

drop policy if exists forum_post_comments_insert_own on public.forum_post_comments;
create policy forum_post_comments_insert_own
  on public.forum_post_comments
  for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists forum_post_comments_update_own on public.forum_post_comments;
create policy forum_post_comments_update_own
  on public.forum_post_comments
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists forum_post_comments_delete_own on public.forum_post_comments;
create policy forum_post_comments_delete_own
  on public.forum_post_comments
  for delete
  to authenticated
  using (auth.uid() = author_id);

grant select, insert, update, delete on public.forum_posts to authenticated;
grant select, insert, update, delete on public.forum_post_likes to authenticated;
grant select, insert, update, delete on public.forum_post_comments to authenticated;

insert into storage.buckets (id, name, public)
values ('forum-posts', 'forum-posts', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists forum_posts_bucket_select_authenticated on storage.objects;
create policy forum_posts_bucket_select_authenticated
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'forum-posts');

drop policy if exists forum_posts_bucket_insert_authenticated on storage.objects;
create policy forum_posts_bucket_insert_authenticated
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'forum-posts');

drop policy if exists forum_posts_bucket_update_authenticated on storage.objects;
create policy forum_posts_bucket_update_authenticated
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'forum-posts')
  with check (bucket_id = 'forum-posts');

drop policy if exists forum_posts_bucket_delete_authenticated on storage.objects;
create policy forum_posts_bucket_delete_authenticated
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'forum-posts');
