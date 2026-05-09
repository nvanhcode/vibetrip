-- Migration: AI map chat conversations and messages.
-- Apply this file manually in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.map_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_ai_conversations_title_non_empty_check check (nullif(btrim(title), '') is not null)
);

create table if not exists public.map_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.map_ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint map_ai_messages_role_check check (role in ('user', 'assistant')),
  constraint map_ai_messages_content_non_empty_check check (nullif(btrim(content), '') is not null),
  constraint map_ai_messages_attachments_is_array_check check (jsonb_typeof(attachments) = 'array')
);

create index if not exists idx_map_ai_conversations_user_updated
  on public.map_ai_conversations(user_id, updated_at desc);

create index if not exists idx_map_ai_messages_conversation_created
  on public.map_ai_messages(conversation_id, created_at asc);

create or replace function public.touch_map_ai_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.map_ai_conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists trg_map_ai_messages_touch_conversation on public.map_ai_messages;
create trigger trg_map_ai_messages_touch_conversation
after insert on public.map_ai_messages
for each row
execute function public.touch_map_ai_conversation_updated_at();

drop trigger if exists trg_map_ai_conversations_updated_at on public.map_ai_conversations;
create trigger trg_map_ai_conversations_updated_at
before update on public.map_ai_conversations
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.map_ai_conversations enable row level security;
alter table public.map_ai_messages enable row level security;

drop policy if exists map_ai_conversations_select_own on public.map_ai_conversations;
create policy map_ai_conversations_select_own
  on public.map_ai_conversations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists map_ai_conversations_insert_own on public.map_ai_conversations;
create policy map_ai_conversations_insert_own
  on public.map_ai_conversations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists map_ai_conversations_update_own on public.map_ai_conversations;
create policy map_ai_conversations_update_own
  on public.map_ai_conversations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists map_ai_conversations_delete_own on public.map_ai_conversations;
create policy map_ai_conversations_delete_own
  on public.map_ai_conversations
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists map_ai_messages_select_own on public.map_ai_messages;
create policy map_ai_messages_select_own
  on public.map_ai_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.map_ai_conversations c
      where c.id = map_ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists map_ai_messages_insert_own on public.map_ai_messages;
create policy map_ai_messages_insert_own
  on public.map_ai_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.map_ai_conversations c
      where c.id = map_ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists map_ai_messages_update_own on public.map_ai_messages;
create policy map_ai_messages_update_own
  on public.map_ai_messages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.map_ai_conversations c
      where c.id = map_ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.map_ai_conversations c
      where c.id = map_ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists map_ai_messages_delete_own on public.map_ai_messages;
create policy map_ai_messages_delete_own
  on public.map_ai_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.map_ai_conversations c
      where c.id = map_ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.map_ai_conversations to authenticated;
grant select, insert, update, delete on public.map_ai_messages to authenticated;
