-- Communication features: conversations, messages, calls

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'project', 'team')),
  title text,
  project_id uuid references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  message_type text not null default 'text' check (message_type in ('text', 'file', 'emoji')),
  file_url text,
  mentions uuid[] default '{}',
  delivery_status text not null default 'sent' check (delivery_status in ('sent', 'delivered', 'seen')),
  created_at timestamptz not null default now()
);

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz,
  delivered_at timestamptz,
  primary key (message_id, user_id)
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'ongoing', 'ended', 'missed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.call_participants (
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);

create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at desc);
create index if not exists idx_conversation_members_user on public.conversation_members(user_id);
create index if not exists idx_calls_conversation_started on public.calls(conversation_id, started_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

-- Members can read conversations they belong to.
drop policy if exists conversations_select_members on public.conversations;
create policy conversations_select_members on public.conversations
for select using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
  )
);

-- PM/ADMIN can create group conversations.
drop policy if exists conversations_insert_pm_admin on public.conversations;
create policy conversations_insert_pm_admin on public.conversations
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN', 'PROJECT_MANAGER')
  )
);

drop policy if exists conversation_members_select_self on public.conversation_members;
create policy conversation_members_select_self on public.conversation_members
for select using (user_id = auth.uid());

drop policy if exists conversation_members_insert_creator on public.conversation_members;
create policy conversation_members_insert_creator on public.conversation_members
for insert with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id and c.created_by = auth.uid()
  )
);

drop policy if exists conversation_members_update_self on public.conversation_members;
create policy conversation_members_update_self on public.conversation_members
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists messages_select_members on public.messages;
create policy messages_select_members on public.messages
for select using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  )
);

drop policy if exists messages_insert_non_viewer on public.messages;
create policy messages_insert_non_viewer on public.messages
for insert with check (
  sender_id = auth.uid() and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'VIEWER'
  ) and
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  )
);

drop policy if exists message_receipts_select_self on public.message_receipts;
create policy message_receipts_select_self on public.message_receipts
for select using (user_id = auth.uid());

drop policy if exists message_receipts_insert_self on public.message_receipts;
create policy message_receipts_insert_self on public.message_receipts
for insert with check (user_id = auth.uid());

drop policy if exists message_receipts_update_self on public.message_receipts;
create policy message_receipts_update_self on public.message_receipts
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists calls_select_members on public.calls;
create policy calls_select_members on public.calls
for select using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = calls.conversation_id and cm.user_id = auth.uid()
  )
);

drop policy if exists calls_insert_pm_admin on public.calls;
create policy calls_insert_pm_admin on public.calls
for insert with check (
  initiated_by = auth.uid() and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN', 'PROJECT_MANAGER')
  )
);

drop policy if exists calls_update_members on public.calls;
create policy calls_update_members on public.calls
for update using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = calls.conversation_id and cm.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = calls.conversation_id and cm.user_id = auth.uid()
  )
);

drop policy if exists call_participants_select_members on public.call_participants;
create policy call_participants_select_members on public.call_participants
for select using (
  exists (
    select 1
    from public.calls c
    join public.conversation_members cm on cm.conversation_id = c.conversation_id
    where c.id = call_participants.call_id and cm.user_id = auth.uid()
  )
);

drop policy if exists call_participants_insert_self on public.call_participants;
create policy call_participants_insert_self on public.call_participants
for insert with check (user_id = auth.uid());

drop policy if exists call_participants_update_self on public.call_participants;
create policy call_participants_update_self on public.call_participants
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
