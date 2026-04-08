-- Add receiver_id support for direct-message pair querying
alter table if exists public.messages
  add column if not exists receiver_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_messages_sender_receiver_created
  on public.messages(sender_id, receiver_id, created_at desc);

-- Backfill receiver_id for existing direct conversations
update public.messages m
set receiver_id = cm.user_id
from public.conversations c
join public.conversation_members cm on cm.conversation_id = c.id
where m.conversation_id = c.id
  and c.type = 'direct'
  and cm.user_id <> m.sender_id
  and m.receiver_id is null;
