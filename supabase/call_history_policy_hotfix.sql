-- Call history visibility hotfix
-- Run this in Supabase SQL editor for existing environments.

-- Conversations select should include ADMIN visibility.
drop policy if exists conversations_select_members on public.conversations;
create policy conversations_select_members on public.conversations
for select using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  )
  or exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

-- Conversation members roster should include ADMIN visibility.
drop policy if exists conversation_members_select_members on public.conversation_members;
create policy conversation_members_select_members on public.conversation_members
for select using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  )
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_members.conversation_id
      and (
        c.created_by = auth.uid()
        or exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        )
      )
  )
);

-- Calls select: allow ADMIN, conversation members, call participants, and initiators.
drop policy if exists calls_select_members on public.calls;
create policy calls_select_members on public.calls
for select using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  )
  or exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = calls.conversation_id
      and cm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.call_participants cp
    where cp.call_id = calls.id
      and cp.user_id = auth.uid()
  )
  or calls.initiated_by = auth.uid()
  or calls.initiator_id = auth.uid()
);

-- Call participants select: allow self and ADMIN.
drop policy if exists call_participants_select_members on public.call_participants;
create policy call_participants_select_members on public.call_participants
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  )
  or exists (
    select 1
    from public.calls c
    join public.conversation_members cm on cm.conversation_id = c.conversation_id
    where c.id = call_participants.call_id
      and cm.user_id = auth.uid()
  )
);
