# 🚀 Complete Setup Checklist

## Before Testing (DO THIS FIRST)

### 1. Run SQL Setup in Supabase ⚠️ CRITICAL
- [ ] Go to https://supabase.com/dashboard → Select your project
- [ ] Click "SQL Editor" → "New Query"
- [ ] Copy entire content of `supabase/taskflow_full_setup.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run" (or Ctrl+Enter)
- [ ] Wait for success message ✅

### 2. Create `.env.local` File
- [ ] File should exist at project root: `.env.local`
- [ ] Contains:
  ```
  VITE_SUPABASE_URL=https://vtuwiqnpexbhexlblhyh.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_VFKCmSxy5vtqw7eHHqrJXQ_ITwVfBoU
  ```

---

## Validation Tests

### 3. Run Test Queries in Supabase
- [ ] Go to SQL Editor → "New Query"
- [ ] Copy content from `supabase/test_queries.sql`
- [ ] Run each query and verify:
  - ✅ TEST 1 shows 9 tables
  - ✅ TEST 2 shows 4 users (admin@, pm@, member@, viewer@)
  - ✅ TEST 3 shows 4 profiles with correct roles
  - ✅ TEST 4 shows 30+ RLS policies
  - ✅ TEST 5 shows demo data counts
  - ✅ TEST 6 shows trigger is active
  - ✅ TEST 7 shows RLS enabled on all tables

### 4. Build React App
```bash
cd c:\Users\malla\Downloads\task&mangement\task & mangement
npm run build
```
- [ ] Exit code: 0 ✅
- [ ] No TypeScript errors

### 5. Start Development Server
```bash
npm run dev
```
- [ ] Server starts without crashing
- [ ] Browser opens to http://localhost:5173
- [ ] Login page loads

### 6. Test Admin Login
- [ ] Email: `admin@example.com`
- [ ] Password: `password123`
- [ ] **Expected Results:**
  - [ ] Login successful
  - [ ] Redirects to /dashboard
  - [ ] Dashboard shows role: "Admin"
  - [ ] Full menu visible (Projects, Tasks, Teams, Users, Settings)
  - [ ] Can see sample data

### 7. Test Project Manager Login
- [ ] Email: `pm@example.com`
- [ ] Password: `password123`
- [ ] **Expected Results:**
  - [ ] Login successful
  - [ ] Dashboard shows role: "Project Manager"
  - [ ] Can manage projects & teams

### 8. Test Team Member Login
- [ ] Email: `member@example.com`
- [ ] Password: `password123`
- [ ] **Expected Results:**
  - [ ] Login successful
  - [ ] Dashboard shows role: "Team Member"
  - [ ] Can only see assigned tasks

### 9. Test Viewer Login
- [ ] Email: `viewer@example.com`
- [ ] Password: `password123`
- [ ] **Expected Results:**
  - [ ] Login successful
  - [ ] Dashboard shows role: "Viewer"
  - [ ] Read-only mode (no edit/delete buttons)

### 10. Test New User Registration
- [ ] Click "Sign up"
- [ ] Register:
  - [ ] Name: `John Doe`
  - [ ] Email: `john@test.com`
  - [ ] Password: `test123456`
- [ ] **Expected Results:**
  - [ ] Account created
  - [ ] Logged in automatically
  - [ ] Redirects to dashboard
  - [ ] Role shows as "Team Member"

### 11. Verify New User in Database
```sql
SELECT email, role, status FROM public.profiles WHERE email = 'john@test.com';
```
- [ ] Returns 1 row
- [ ] role = TEAM_MEMBER
- [ ] status = active

### 12. Check Browser Console
- [ ] Open Developer Tools (F12)
- [ ] Go to Console tab
- [ ] Look for:
  - ✅ `[AUDIT] { actor: ... action: 'LOGIN' ... }` (auth working!)
  - ❌ NO "Failed to load resource 400" errors
  - ❌ NO "Authentication required" errors
  - ❌ NO "Forbidden" errors

### 13. Test Logout
- [ ] Click user menu → Logout
- [ ] **Expected:** Redirects to login page ✅

### 14. Test Protected Routes
- [ ] Logout
- [ ] Try to access `/users` directly
- [ ] **Expected:** Redirects to login ✅
- [ ] After login as admin, access `/users`
- [ ] **Expected:** Users management page loads ✅

---

## Success Criteria ✅

If all of these pass, your Supabase integration is **100% working**:

- [x] All 4 demo users can login
- [x] Each role sees appropriate dashboard
- [x] New users can register
- [x] Role-based access control works
- [x] No TypeScript errors
- [x] No auth errors in console
- [x] Logout works
- [x] Protected routes work

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to load 400` | Users not seeded | Run SQL setup again |
| `Authentication required` | `.env.local` not found | Create `.env.local` with credentials |
| `Forbidden` | RLS blocking access | Check user exists in profiles table |
| Login page blank | Build not fresh | Stop dev server, run `npm run build`, restart |
| Profiles table empty | Trigger not firing | Check trigger status in SQL test |

---

## Files Reference

- **SQL Setup:** `supabase/taskflow_full_setup.sql` - Run this first!
- **Test Queries:** `supabase/test_queries.sql` - Run to verify
- **API Service:** `src/services/api.ts` - Supabase integration
- **Auth Context:** `src/contexts/AuthContext.tsx` - Auth state
- **Types:** `src/types/index.ts` - TypeScript types
- **Environment:** `.env.local` - Supabase credentials
