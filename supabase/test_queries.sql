-- ============================================
-- SUPABASE INTEGRATION TEST SCRIPT
-- Run these queries in Supabase SQL Editor
-- ============================================

-- TEST 1: Verify all tables exist
SELECT 
  tablename,
  'EXISTS ✅' as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'projects', 'tasks', 'teams', 'project_members', 'team_members', 'comments', 'notifications')
ORDER BY tablename;

-- TEST 2: Count demo users
SELECT 
  COUNT(*) as total_auth_users,
  array_agg(email) as emails
FROM auth.users;

-- TEST 3: View all profiles
SELECT 
  id,
  name,
  email,
  role,
  status,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- TEST 4: Verify RLS Policies count
SELECT 
  COUNT(*) as total_policies,
  tablename,
  COUNT(*) as policies_per_table
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- TEST 5: Check for demo data (projects, tasks, etc)
SELECT 
  'profiles' as table,
  COUNT(*) as row_count
FROM public.profiles
UNION ALL
SELECT 'projects', COUNT(*) FROM public.projects
UNION ALL
SELECT 'teams', COUNT(*) FROM public.teams
UNION ALL
SELECT 'tasks', COUNT(*) FROM public.tasks
UNION ALL
SELECT 'team_members', COUNT(*) FROM public.team_members
UNION ALL
SELECT 'project_members', COUNT(*) FROM public.project_members;

-- TEST 6: View trigger status
SELECT 
  trigger_name,
  event_object_table,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'on_auth_user_created';

-- TEST 7: Verify RLS is enabled on tables
SELECT 
  schemaname,
  tablename,
  CASE WHEN rowsecurity = true THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'projects', 'tasks', 'teams', 'project_members', 'team_members', 'comments', 'notifications')
ORDER BY tablename;
