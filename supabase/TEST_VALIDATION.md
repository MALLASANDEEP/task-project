# Supabase Integration Test & Validation

## Step 1: Verify Database Schema ✅

After running `taskflow_full_setup.sql` in Supabase SQL Editor, verify these tables exist:

```sql
-- Run in Supabase SQL Editor to verify:
SELECT 
  schemaname,
  tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Tables:**
- ✅ profiles
- ✅ projects
- ✅ project_members
- ✅ teams
- ✅ team_members
- ✅ team_projects
- ✅ tasks
- ✅ comments
- ✅ notifications

---

## Step 2: Verify Demo Users Created ✅

```sql
-- Run in Supabase SQL Editor to verify users exist:
SELECT id, email, raw_user_meta_data FROM auth.users;
```

**Expected 4 Users:**
| Email | Role | Password |
|-------|------|----------|
| admin@example.com | ADMIN | password123 |
| pm@example.com | PROJECT_MANAGER | password123 |
| member@example.com | TEAM_MEMBER | password123 |
| viewer@example.com | VIEWER | password123 |

---

## Step 3: Verify Profiles Table Populated ✅

```sql
-- Run in Supabase SQL Editor:
SELECT id, name, email, role, status FROM public.profiles;
```

**Expected 4 Profiles:**
- Should show all 4 users with correct roles (ADMIN, PROJECT_MANAGER, TEAM_MEMBER, VIEWER)
- status should be 'active' for all

---

## Step 4: Verify RLS Policies Active ✅

```sql
-- Run in Supabase SQL Editor:
SELECT schemaname, tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected: Multiple policies like**
- profiles_select_own_or_admin
- projects_select_admin_creator_or_member
- tasks_select_assigned_or_admin
- notifications_select_own_or_admin

---

## Step 5: Test Login via React App 🚀

1. **Ensure `.env.local` exists** with:
   ```
   VITE_SUPABASE_URL=https://vtuwiqnpexbhexlblhyh.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_VFKCmSxy5vtqw7eHHqrJXQ_ITwVfBoU
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Test Login Credentials:**
   
   **ADMIN Account:**
   - Email: `admin@example.com`
   - Password: `password123`
   - Expected: Dashboard shows as ADMIN with full access
   
   **PROJECT_MANAGER Account:**
   - Email: `pm@example.com`
   - Password: `password123`
   - Expected: Managing Projects/Teams visible
   
   **TEAM_MEMBER Account:**
   - Email: `member@example.com`
   - Password: `password123`
   - Expected: Only own tasks visible
   
   **VIEWER Account:**
   - Email: `viewer@example.com`
   - Password: `password123`
   - Expected: Read-only mode, no edit buttons

---

## Step 6: Check Browser Console for Errors

After login attempt, check for:

❌ **ERRORS to fix:**
- `Failed to load resource: 400` → Users not seeded, run SQL again
- `Authentication required` → `.env.local` not loaded, restart dev server
- `Forbidden` → RLS policies blocking, check policies

✅ **GOOD SIGNS:**
- `[AUDIT] { actor: ..., action: 'LOGIN', ... }` → Auth working!
- Profile data loaded from `profiles` table
- Dashboard renders with role-specific content

---

## Step 7: Test New User Registration

1. Click "Sign in" → "Sign up"
2. Register with:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `test123456`

3. Check Supabase:
   ```sql
   SELECT id, email, role, status FROM public.profiles WHERE email = 'test@example.com';
   ```
   
   **Expected:** New profile created automatically with role='TEAM_MEMBER'

---

## Quick Checklist

- [ ] SQL setup run successfully (no errors)
- [ ] 4 demo users visible in `auth.users`
- [ ] 4 profiles visible in `public.profiles`
- [ ] `.env.local` file exists
- [ ] `npm run dev` starts without TypeScript errors
- [ ] Can login with `admin@example.com`
- [ ] Dashboard shows for logged-in user
- [ ] Logout works
- [ ] Can register new user

---

## If Something Fails

**Error: "Profile creation failed"**
- Solution: Run SQL again, trigger might not be active

**Error: "Forbidden"**
- Solution: RLS policies blocking, check that user exists in profiles table

**Error: "VITE_SUPABASE_URL not found"**
- Solution: .env.local not created, create it with credentials

**Can't see registered users:**
- Solution: Run `SELECT * FROM auth.users;` to verify they exist
