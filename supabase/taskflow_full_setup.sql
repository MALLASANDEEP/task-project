-- TaskFlow Supabase full setup
-- Paste this whole file into the Supabase SQL editor to create the schema, RLS,
-- demo auth users, and demo app data.

create extension if not exists pgcrypto;

-- =====================================================
-- Types
-- =====================================================
do $$
begin
  create type public.user_role as enum ('ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.user_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_status as enum ('pending', 'in_progress', 'completed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.priority_level as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.deployment_status as enum ('pending', 'approved', 'rejected', 'deployed', 'failed', 'reverted');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.deployment_environment as enum ('staging', 'test', 'preview', 'production');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.deployment_action as enum ('created', 'approved', 'rejected', 'deployed', 'reverted');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.project_status as enum ('draft', 'in_progress', 'submitted', 'completed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.submission_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- Core tables
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'TEAM_MEMBER',
  status public.user_status not null default 'active',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  deadline timestamptz not null,
  priority public.priority_level not null default 'medium',
  project_status public.project_status not null default 'in_progress',
  completion_date timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.team_projects (
  team_id uuid not null references public.teams (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, project_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  status public.task_status not null default 'pending',
  priority public.priority_level not null default 'medium',
  due_date timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  type text not null,
  created_at timestamptz not null default now()
);

-- =====================================================
-- Deployment tables
-- =====================================================
create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id) on delete set null,
  environment public.deployment_environment not null,
  status public.deployment_status not null default 'pending',
  description text not null,
  notes_rejection text,
  deployment_link text,
  change_notes text,
  pre_deployment_checklist text,
  post_deployment_instructions text,
  expected_downtime text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  deployed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deployment_items (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  included_at timestamptz not null default now()
);

create table if not exists public.deployment_logs (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  action public.deployment_action not null,
  user_id uuid not null references public.profiles (id) on delete restrict,
  message text not null,
  timestamp timestamptz not null default now()
);

-- =====================================================
-- Project Submissions
-- =====================================================
create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id) on delete set null,
  status public.submission_status not null default 'pending',
  submission_notes text not null,
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_members_user_id on public.project_members (user_id);
create index if not exists idx_team_members_user_id on public.team_members (user_id);
create index if not exists idx_team_projects_project_id on public.team_projects (project_id);
create index if not exists idx_tasks_project_id on public.tasks (project_id);
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);
create index if not exists idx_comments_task_id on public.comments (task_id);
create index if not exists idx_deployments_project_id on public.deployments (project_id);
create index if not exists idx_deployments_requested_by on public.deployments (requested_by);
create index if not exists idx_deployments_status on public.deployments (status);
create index if not exists idx_deployment_items_deployment_id on public.deployment_items (deployment_id);
create index if not exists idx_deployment_logs_deployment_id on public.deployment_logs (deployment_id);
create index if not exists idx_project_submissions_project_id on public.project_submissions (project_id);
create index if not exists idx_project_submissions_status on public.project_submissions (status);
create index if not exists idx_project_submissions_submitted_by on public.project_submissions (submitted_by);

-- =====================================================
-- Helpers and triggers
-- =====================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  );
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_profile_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.role is distinct from old.role or
    new.status is distinct from old.status
  ) then
    raise exception 'Only admins can change a user role or status';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_privileges on public.profiles;
create trigger enforce_profile_privileges
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_changes();

-- =====================================================
-- Row level security
-- =====================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_projects enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.deployments enable row level security;
alter table public.deployment_items enable row level security;
alter table public.deployment_logs enable row level security;
alter table public.project_submissions enable row level security;
alter table public.deployments enable row level security;
alter table public.deployment_items enable row level security;
alter table public.deployment_logs enable row level security;

-- Profiles

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_self_or_admin" on public.profiles;
create policy "profiles_insert_self_or_admin"
  on public.profiles
  for insert
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles
  for delete
  using (public.is_admin());

-- Projects

drop policy if exists "projects_select_admin_creator_or_member" on public.projects;
create policy "projects_select_admin_creator_or_member"
  on public.projects
  for select
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.project_members
      where project_members.project_id = projects.id
        and project_members.user_id = auth.uid()
    )
  );

drop policy if exists "projects_insert_admin_or_creator" on public.projects;
create policy "projects_insert_admin_or_creator"
  on public.projects
  for insert
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "projects_update_admin_or_creator" on public.projects;
create policy "projects_update_admin_or_creator"
  on public.projects
  for update
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "projects_delete_admin_or_creator" on public.projects;
create policy "projects_delete_admin_or_creator"
  on public.projects
  for delete
  using (public.is_admin() or created_by = auth.uid());

-- Project members

drop policy if exists "project_members_manage_admin_or_creator" on public.project_members;
create policy "project_members_manage_admin_or_creator"
  on public.project_members
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.created_by = auth.uid()
    )
  );

-- Teams

drop policy if exists "teams_select_admin_creator_or_member" on public.teams;
create policy "teams_select_admin_creator_or_member"
  on public.teams
  for select
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.team_members
      where team_members.team_id = teams.id
        and team_members.user_id = auth.uid()
    )
  );

drop policy if exists "teams_manage_admin_or_creator" on public.teams;
create policy "teams_manage_admin_or_creator"
  on public.teams
  for all
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

-- Team members

drop policy if exists "team_members_manage_admin_or_creator" on public.team_members;
create policy "team_members_manage_admin_or_creator"
  on public.team_members
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams
      where teams.id = team_members.team_id
        and teams.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.teams
      where teams.id = team_members.team_id
        and teams.created_by = auth.uid()
    )
  );

-- Team projects

drop policy if exists "team_projects_manage_admin_or_creator" on public.team_projects;
create policy "team_projects_manage_admin_or_creator"
  on public.team_projects
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams
      where teams.id = team_projects.team_id
        and teams.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.teams
      where teams.id = team_projects.team_id
        and teams.created_by = auth.uid()
    )
  );

-- Tasks

drop policy if exists "tasks_select_admin_assignee_or_project_member" on public.tasks;
create policy "tasks_select_admin_assignee_or_project_member"
  on public.tasks
  for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.project_members
      where project_members.project_id = tasks.project_id
        and project_members.user_id = auth.uid()
    )
  );

drop policy if exists "tasks_insert_admin_or_creator" on public.tasks;
create policy "tasks_insert_admin_or_creator"
  on public.tasks
  for insert
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "tasks_update_admin_or_assignee" on public.tasks;
create policy "tasks_update_admin_or_assignee"
  on public.tasks
  for update
  using (public.is_admin() or assigned_to = auth.uid() or created_by = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "tasks_delete_admin_only" on public.tasks;
create policy "tasks_delete_admin_only"
  on public.tasks
  for delete
  using (public.is_admin());

-- Comments

drop policy if exists "comments_select_task_visible" on public.comments;
create policy "comments_select_task_visible"
  on public.comments
  for select
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1
      from public.tasks
      where tasks.id = comments.task_id
        and (
          tasks.assigned_to = auth.uid()
          or tasks.created_by = auth.uid()
          or exists (
            select 1
            from public.project_members
            where project_members.project_id = tasks.project_id
              and project_members.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "comments_insert_task_visible" on public.comments;
create policy "comments_insert_task_visible"
  on public.comments
  for insert
  with check (
    public.is_admin()
    or user_id = auth.uid()
  );

drop policy if exists "comments_delete_admin_or_owner" on public.comments;
create policy "comments_delete_admin_or_owner"
  on public.comments
  for delete
  using (public.is_admin() or user_id = auth.uid());

-- Notifications

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_delete_admin_or_owner" on public.notifications;
create policy "notifications_delete_admin_or_owner"
  on public.notifications
  for delete
  using (user_id = auth.uid() or public.is_admin());

-- Deployments

drop policy if exists "deployments_select_all_authenticated" on public.deployments;
create policy "deployments_select_all_authenticated"
  on public.deployments
  for select
  using (auth.uid() is not null);

drop policy if exists "deployments_insert_authenticated" on public.deployments;
create policy "deployments_insert_authenticated"
  on public.deployments
  for insert
  with check (auth.uid() is not null and requested_by = auth.uid());

drop policy if exists "deployments_update_admin_pm_only" on public.deployments;
create policy "deployments_update_admin_pm_only"
  on public.deployments
  for update
  using (
    public.is_admin() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'PROJECT_MANAGER'
    )
  )
  with check (
    public.is_admin() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'PROJECT_MANAGER'
    )
  );

drop policy if exists "deployments_delete_admin_only" on public.deployments;
create policy "deployments_delete_admin_only"
  on public.deployments
  for delete
  using (public.is_admin());

-- Deployment Items

drop policy if exists "deployment_items_select_all_authenticated" on public.deployment_items;
create policy "deployment_items_select_all_authenticated"
  on public.deployment_items
  for select
  using (auth.uid() is not null);

drop policy if exists "deployment_items_insert_authenticated" on public.deployment_items;
create policy "deployment_items_insert_authenticated"
  on public.deployment_items
  for insert
  with check (auth.uid() is not null);

drop policy if exists "deployment_items_delete_admin_only" on public.deployment_items;
create policy "deployment_items_delete_admin_only"
  on public.deployment_items
  for delete
  using (public.is_admin());

-- Deployment Logs

drop policy if exists "deployment_logs_select_all_authenticated" on public.deployment_logs;
create policy "deployment_logs_select_all_authenticated"
  on public.deployment_logs
  for select
  using (auth.uid() is not null);

drop policy if exists "deployment_logs_insert_authenticated" on public.deployment_logs;
create policy "deployment_logs_insert_authenticated"
  on public.deployment_logs
  for insert
  with check (auth.uid() is not null);

-- Project Submissions

drop policy if exists "project_submissions_select_all" on public.project_submissions;
create policy "project_submissions_select_all"
  on public.project_submissions
  for select
  using (auth.uid() is not null);

drop policy if exists "project_submissions_insert_authenticated" on public.project_submissions;
create policy "project_submissions_insert_authenticated"
  on public.project_submissions
  for insert
  with check (auth.uid() is not null);

drop policy if exists "project_submissions_update_pm_admin_only" on public.project_submissions;
create policy "project_submissions_update_pm_admin_only"
  on public.project_submissions
  for update
  using (
    public.is_admin() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'PROJECT_MANAGER'
    )
  )
  with check (
    public.is_admin() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'PROJECT_MANAGER'
    )
  );

-- =====================================================
-- Seed auth users
-- =====================================================
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin@taskflow.io',
    crypt('admin123', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', 'Aarav Sharma', 'role', 'ADMIN', 'avatar_url', ''),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'priya@taskflow.io',
    crypt('user123', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', 'Priya Patel', 'role', 'PROJECT_MANAGER', 'avatar_url', ''),
    now(),
    now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'rohan@taskflow.io',
    crypt('user123', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', 'Rohan Mehta', 'role', 'TEAM_LEADER', 'avatar_url', ''),
    now(),
    now()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'sneha@taskflow.io',
    crypt('user123', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', 'Sneha Gupta', 'role', 'TEAM_MEMBER', 'avatar_url', ''),
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

-- =====================================================
-- Seed demo profiles (matching auth users)
-- =====================================================
-- Temporarily disable the trigger to allow seed data
alter table public.profiles disable trigger enforce_profile_privileges;

insert into public.profiles (id, name, email, role, status, created_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Aarav Sharma', 'admin@taskflow.io', 'ADMIN', 'active', now()),
  ('22222222-2222-2222-2222-222222222222', 'Priya Patel', 'priya@taskflow.io', 'PROJECT_MANAGER', 'active', now()),
  ('33333333-3333-3333-3333-333333333333', 'Rohan Mehta', 'rohan@taskflow.io', 'TEAM_LEADER', 'active', now()),
  ('44444444-4444-4444-4444-444444444444', 'Sneha Gupta', 'sneha@taskflow.io', 'TEAM_MEMBER', 'active', now())
on conflict (id) do update
set name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    status = excluded.status;

-- Re-enable the trigger
alter table public.profiles enable trigger enforce_profile_privileges;

-- =====================================================
-- Seed demo app data
-- =====================================================
insert into public.projects (id, title, description, created_by, deadline, priority, created_at)
values
  ('00000000-0000-0000-0000-000000000101'::uuid, 'Website Redesign', 'Complete overhaul of the company website with modern design and improved UX.', '11111111-1111-1111-1111-111111111111', '2026-06-30T00:00:00Z', 'high', '2025-05-01T08:00:00Z'),
  ('00000000-0000-0000-0000-000000000102'::uuid, 'Mobile App v2', 'Build version 2 of the mobile application with offline support and push notifications.', '11111111-1111-1111-1111-111111111111', '2026-08-15T00:00:00Z', 'medium', '2025-06-15T10:00:00Z'),
  ('00000000-0000-0000-0000-000000000103'::uuid, 'API Migration', 'Migrate legacy REST APIs to GraphQL with improved caching and documentation.', '11111111-1111-1111-1111-111111111111', '2026-05-20T00:00:00Z', 'low', '2025-07-20T12:00:00Z')
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    created_by = excluded.created_by,
    deadline = excluded.deadline,
    priority = excluded.priority,
    created_at = excluded.created_at;

insert into public.project_members (project_id, user_id)
values
  ('00000000-0000-0000-0000-000000000101'::uuid, '22222222-2222-2222-2222-222222222222'),
  ('00000000-0000-0000-0000-000000000101'::uuid, '33333333-3333-3333-3333-333333333333'),
  ('00000000-0000-0000-0000-000000000101'::uuid, '44444444-4444-4444-4444-444444444444'),
  ('00000000-0000-0000-0000-000000000102'::uuid, '33333333-3333-3333-3333-333333333333'),
  ('00000000-0000-0000-0000-000000000102'::uuid, '44444444-4444-4444-4444-444444444444'),
  ('00000000-0000-0000-0000-000000000103'::uuid, '22222222-2222-2222-2222-222222222222'),
  ('00000000-0000-0000-0000-000000000103'::uuid, '44444444-4444-4444-4444-444444444444')
on conflict do nothing;

insert into public.teams (id, name, description, created_by, created_at)
values
  ('00000000-0000-0000-0000-000000000201'::uuid, 'Platform Launch Squad', 'Core delivery team for the redesign and platform rollout.', '11111111-1111-1111-1111-111111111111', '2025-08-01T09:00:00Z'),
  ('00000000-0000-0000-0000-000000000202'::uuid, 'API Migration Crew', 'Focused group handling the GraphQL migration workstream.', '11111111-1111-1111-1111-111111111111', '2025-08-12T13:30:00Z')
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    created_by = excluded.created_by,
    created_at = excluded.created_at;

insert into public.team_members (team_id, user_id)
values
  ('00000000-0000-0000-0000-000000000201'::uuid, '22222222-2222-2222-2222-222222222222'),
  ('00000000-0000-0000-0000-000000000201'::uuid, '33333333-3333-3333-3333-333333333333'),
  ('00000000-0000-0000-0000-000000000202'::uuid, '22222222-2222-2222-2222-222222222222'),
  ('00000000-0000-0000-0000-000000000202'::uuid, '44444444-4444-4444-4444-444444444444')
on conflict do nothing;

insert into public.team_projects (team_id, project_id)
values
  ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
  ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000102'::uuid),
  ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000103'::uuid)
on conflict do nothing;

insert into public.tasks (id, title, description, project_id, assigned_to, created_by, status, priority, due_date, created_at)
values
  ('00000000-0000-0000-0000-000000000301'::uuid, 'Design homepage mockups', 'Create Figma mockups for the new homepage layout.', '00000000-0000-0000-0000-000000000101'::uuid, '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'completed', 'high', '2026-05-10T00:00:00Z', '2025-05-02T09:00:00Z'),
  ('00000000-0000-0000-0000-000000000302'::uuid, 'Implement responsive nav', 'Build the responsive navigation bar with mobile hamburger menu.', '00000000-0000-0000-0000-000000000101'::uuid, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'in_progress', 'high', '2026-05-20T00:00:00Z', '2025-05-03T10:00:00Z'),
  ('00000000-0000-0000-0000-000000000303'::uuid, 'Set up CI/CD pipeline', 'Configure GitHub Actions for automated testing and deployment.', '00000000-0000-0000-0000-000000000101'::uuid, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'pending', 'medium', '2026-05-25T00:00:00Z', '2025-05-04T11:00:00Z'),
  ('00000000-0000-0000-0000-000000000304'::uuid, 'User authentication flow', 'Implement login, signup, and password reset with JWT.', '00000000-0000-0000-0000-000000000102'::uuid, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'in_progress', 'high', '2026-07-01T00:00:00Z', '2025-06-16T09:00:00Z')
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    project_id = excluded.project_id,
    assigned_to = excluded.assigned_to,
    created_by = excluded.created_by,
    status = excluded.status,
    priority = excluded.priority,
    due_date = excluded.due_date,
    created_at = excluded.created_at;

insert into public.comments (id, task_id, user_id, content, created_at)
values
  ('00000000-0000-0000-0000-000000000401'::uuid, '00000000-0000-0000-0000-000000000301'::uuid, '11111111-1111-1111-1111-111111111111', 'Looking great! Please finalize the hero section.', '2025-05-05T14:00:00Z'),
  ('00000000-0000-0000-0000-000000000402'::uuid, '00000000-0000-0000-0000-000000000304'::uuid, '33333333-3333-3333-3333-333333333333', 'OAuth integration pending for Google and GitHub.', '2025-06-20T16:00:00Z')
on conflict (id) do update
set content = excluded.content,
    created_at = excluded.created_at;

insert into public.notifications (id, user_id, title, message, read, type, created_at)
values
  ('00000000-0000-0000-0000-000000000501'::uuid, '33333333-3333-3333-3333-333333333333', 'New Task Assigned', 'You have been assigned "Design homepage mockups"', false, 'task_assigned', '2026-04-01T09:00:00Z'),
  ('00000000-0000-0000-0000-000000000502'::uuid, '33333333-3333-3333-3333-333333333333', 'Task Updated', 'Task "Implement responsive nav" priority changed to High', false, 'task_updated', '2026-04-01T10:30:00Z'),
  ('00000000-0000-0000-0000-000000000503'::uuid, '44444444-4444-4444-4444-444444444444', 'Project Assigned', 'You have been added to "Website Redesign"', true, 'project_assigned', '2026-03-30T11:00:00Z')
on conflict (id) do update
set title = excluded.title,
    message = excluded.message,
    read = excluded.read,
    type = excluded.type,
    created_at = excluded.created_at;

