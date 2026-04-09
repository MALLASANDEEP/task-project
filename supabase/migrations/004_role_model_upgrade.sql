-- Upgrade role model from (TEAM_MEMBER, VIEWER) to (TEAM_LEADER, TEAM_MEMBER)
-- Mapping:
--   TEAM_MEMBER -> TEAM_LEADER
--   VIEWER      -> TEAM_MEMBER
-- cSpell:ignore enumtypid typnamespace nspname typname enumlabel

DO $$
DECLARE
  has_team_member boolean;
  has_viewer boolean;
  has_team_leader boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'TEAM_MEMBER'
  ) INTO has_team_member;

  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'VIEWER'
  ) INTO has_viewer;

  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'TEAM_LEADER'
  ) INTO has_team_leader;

  -- First rename old TEAM_MEMBER to TEAM_LEADER.
  IF has_team_member AND has_viewer AND NOT has_team_leader THEN
    ALTER TYPE public.user_role RENAME VALUE 'TEAM_MEMBER' TO 'TEAM_LEADER';
  END IF;

  -- Then rename old VIEWER to TEAM_MEMBER.
  IF has_viewer THEN
    ALTER TYPE public.user_role RENAME VALUE 'VIEWER' TO 'TEAM_MEMBER';
  END IF;
END
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, status, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(
      case upper(coalesce(new.raw_user_meta_data ->> 'role', ''))
        when 'ADMIN' then 'ADMIN'::public.user_role
        when 'PROJECT_MANAGER' then 'PROJECT_MANAGER'::public.user_role
        when 'TEAM_LEADER' then 'TEAM_LEADER'::public.user_role
        when 'TEAM_MEMBER' then 'TEAM_MEMBER'::public.user_role
        when 'VIEWER' then 'TEAM_MEMBER'::public.user_role
        else null
      end,
      'TEAM_MEMBER'::public.user_role
    ),
    'active'::public.user_status,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        avatar_url = excluded.avatar_url;

  return new;
end;
$$;

-- Allow direct messaging for all authenticated roles and keep group creation scoped.
drop policy if exists conversations_insert_policy on public.conversations;
create policy conversations_insert_policy on public.conversations
for insert with check (
  (
    type = 'direct'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
    )
  )
  or (
    type in ('project', 'team')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('ADMIN', 'PROJECT_MANAGER')
    )
  )
);

drop policy if exists messages_insert_non_viewer on public.messages;
drop policy if exists messages_insert_non_team_member on public.messages;
create policy messages_insert_non_team_member on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid())
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);
