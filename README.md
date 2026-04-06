# task-project

Task management app built with React, Vite, and shadcn/ui.

## RBAC Implementation

The app now uses Role-Based Access Control with four roles:

1. ADMIN
2. PROJECT_MANAGER
3. TEAM_MEMBER
4. VIEWER

### Core RBAC Files

- `src/lib/rbac.ts`: role constants, permission matrix, authorization helpers
- `src/services/api.ts`: backend-style authorization checks with 403 errors and audit logs
- `src/components/ProtectedRoute.tsx`: route-level role/permission guards
- `src/contexts/AuthContext.tsx`: auth helpers (`hasRole`, `can`) for UI gating

### Behavior Highlights

- ADMIN has full access (users, projects, teams, tasks, role assignment).
- PROJECT_MANAGER can manage tasks and view reports/dashboard.
- TEAM_MEMBER can view assigned tasks, update own status, and add comments.
- VIEWER is read-only.

Unauthorized actions return `403 Forbidden` from the API layer and are surfaced in the UI via destructive toasts.

### Demo Accounts

- ADMIN: `admin@taskflow.io / admin123`
- PROJECT_MANAGER: `priya@taskflow.io / user123`
- TEAM_MEMBER: `rohan@taskflow.io / user123`
- VIEWER: `sneha@taskflow.io / user123`

## Supabase Setup

1. Create a Supabase project.
2. Copy the SQL from [supabase/taskflow_full_setup.sql](supabase/taskflow_full_setup.sql) into the SQL editor.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your local environment from [`.env.example`](.env.example).
6. Use [src/lib/supabase.ts](src/lib/supabase.ts) as the client entry point when you start wiring the app to the database.

The schema uses `auth.users` plus a public `profiles` table for admin-controlled user data, and separate team/project membership tables for clean access control.
