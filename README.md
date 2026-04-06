# task-project

Task management app built with React, Vite, and shadcn/ui.

## Supabase Setup

1. Create a Supabase project.
2. Copy the SQL from [supabase/migrations/001_init_schema.sql](supabase/migrations/001_init_schema.sql) into the SQL editor.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your local environment from [`.env.example`](.env.example).
4. Use [src/lib/supabase.ts](src/lib/supabase.ts) as the client entry point when you start wiring the app to the database.

The schema uses `auth.users` plus a public `profiles` table for admin-controlled user data, and separate team/project membership tables for clean access control.
