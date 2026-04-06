create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER');
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

create index if not exists idx_project_members_user_id on public.project_members (user_id);
create index if not exists idx_team_members_user_id on public.team_members (user_id);
create index if not exists idx_team_projects_project_id on public.team_projects (project_id);
create index if not exists idx_tasks_project_id on public.tasks (project_id);
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);
create index if not exists idx_comments_task_id on public.comments (task_id);

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
        when 'TEAM_MEMBER' then 'TEAM_MEMBER'::public.user_role
        when 'VIEWER' then 'VIEWER'::public.user_role
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

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_projects enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

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