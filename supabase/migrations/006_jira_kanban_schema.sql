/**
 * MIGRATION 006: Jira-Style Kanban System
 * Adds activity logging, task events, and multi-assignee support
 */

-- ════════════════════════════════════════════════════════════════════
-- 1. Activity Logs Table (who did what, when)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  action text not null, -- 'created', 'updated', 'moved', 'assigned', 'commented'
  entity_type text not null, -- 'task', 'comment', 'assignment'
  entity_id uuid not null,
  old_value jsonb, -- for updates: {status: 'pending', priority: 'medium'}
  new_value jsonb, -- {status: 'in_progress', priority: 'high'}
  metadata jsonb, -- any extra data (timestamps, references)
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 2. Task Assignments (support multiple assignees per task)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique(task_id, assigned_to) -- prevent duplicate assignments
);

-- ════════════════════════════════════════════════════════════════════
-- 3. Extend notifications with task_id reference
-- ════════════════════════════════════════════════════════════════════
alter table public.notifications
  add column if not exists task_id uuid references public.tasks (id) on delete cascade,
  add column if not exists action_type text; -- 'assigned', 'mentioned', 'deadline', 'status_changed'

-- ════════════════════════════════════════════════════════════════════
-- 4. Indexes for Performance
-- ════════════════════════════════════════════════════════════════════
create index if not exists idx_activity_logs_user_id on public.activity_logs (user_id);
create index if not exists idx_activity_logs_task_id on public.activity_logs (task_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_task_assignments_task_id on public.task_assignments (task_id);
create index if not exists idx_task_assignments_assigned_to on public.task_assignments (assigned_to);
create index if not exists idx_notifications_task_id on public.notifications (task_id);
create index if not exists idx_notifications_user_id_created on public.notifications (user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 5. Helper Functions
-- ════════════════════════════════════════════════════════════════════

-- Log activity action
create or replace function public.log_activity(
  p_user_id uuid,
  p_task_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.activity_logs (
    user_id, task_id, action, entity_type, entity_id,
    old_value, new_value, metadata
  ) values (
    p_user_id, p_task_id, p_action, p_entity_type, p_entity_id,
    p_old_value, p_new_value, p_metadata
  )
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

-- Trigger to auto-log task status changes
create or replace function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_activity(
      auth.uid(),
      new.id,
      'moved',
      'task',
      new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      jsonb_build_object('timestamp', now()::text)
    );
  end if;
  
  return new;
end;
$$;

drop trigger if exists on_task_status_change on public.tasks;
create trigger on_task_status_change
  after update on public.tasks
  for each row execute function public.log_task_status_change();

-- ════════════════════════════════════════════════════════════════════
-- 6. RLS Policies
-- ════════════════════════════════════════════════════════════════════

alter table public.activity_logs enable row level security;
alter table public.task_assignments enable row level security;

-- Activity logs: viewable by project members and admins
create policy "activity_logs_view"
  on public.activity_logs for select
  using (
    exists (
      select 1 from public.project_members pm
      join public.tasks t on t.project_id = pm.project_id
      where pm.user_id = auth.uid()
        and t.id = activity_logs.task_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
  );

-- Task assignments: viewable by task assignees and project members
create policy "task_assignments_view"
  on public.task_assignments for select
  using (
    assigned_to = auth.uid()
    or exists (
      select 1 from public.project_members pm
      join public.tasks t on t.project_id = pm.project_id
      where pm.user_id = auth.uid()
        and t.id = task_assignments.task_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
  );

-- Task assignments: create/update/delete requires project manager or admin
create policy "task_assignments_manage"
  on public.task_assignments for insert
  with check (
    exists (
      select 1 from public.project_members pm
      join public.tasks t on t.project_id = pm.project_id
      join public.profiles p on p.id = auth.uid()
      where pm.user_id = auth.uid()
        and t.id = task_assignments.task_id
        and p.role in ('ADMIN', 'PROJECT_MANAGER')
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 7. Seed Test Data (Optional)
-- ════════════════════════════════════════════════════════════════════
-- Uncomment to populate with sample activity logs
-- insert into public.activity_logs (
--   user_id, task_id, action, entity_type, entity_id,
--   old_value, new_value
-- ) select
--   user_id, id, 'created', 'task', id,
--   null,
--   jsonb_build_object('title', title, 'status', status)
-- from public.tasks
-- where created_at > now() - interval '30 days'
-- on conflict do nothing;
