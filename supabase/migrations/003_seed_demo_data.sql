-- Demo app data wired to the seeded auth users.
-- Run after 001_init_schema.sql and 002_seed_demo_auth.sql.
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
