# Final Submission Checklist

## 1. Build and Quality Gate

- [ ] Run `npm install`
- [ ] Run `npm run lint` and verify zero warnings and zero errors
- [ ] Run `npm run test -- --run`
- [ ] Run `npm run build`
- [ ] Start with `npm run dev` and verify main routes load without console errors

## 2. Supabase and Realtime Setup

- [ ] Confirm `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Apply migration `supabase/migrations/005_messages_receiver_support.sql`
- [ ] Apply migration `supabase/migrations/006_enable_realtime_for_communication.sql`
- [ ] Verify `calls`, `call_participants`, and `messages` are in `supabase_realtime` publication
- [ ] Validate Row Level Security policies for conversations, messages, and calls

## 3. UX and Stability Verification

- [ ] Confirm loading states appear on Projects, Teams, Users, Calls, and Messages pages
- [ ] Confirm empty states show clear next action text
- [ ] Trigger a runtime error intentionally and verify global Error Boundary fallback renders
- [ ] Confirm retry behavior recovers transient API failures (network timeout/retryable status)

## 4. Role-Based Scenario Tests

### Admin

- [ ] Login as ADMIN succeeds
- [ ] Can view dashboard analytics and user management
- [ ] Can create, edit, delete users
- [ ] Can create project, assign manager, assign members
- [ ] Can create/update/delete teams
- [ ] Can create/update/delete tasks and reassign tasks
- [ ] Can view/join/initiate/end calls
- [ ] Can read/send messages in allowed conversations

### Project Manager

- [ ] Login as PROJECT_MANAGER succeeds
- [ ] Can create/update projects
- [ ] Can assign team members to projects
- [ ] Can create/update tasks and assign team members
- [ ] Can create project chats and direct chats
- [ ] Can initiate audio and video calls
- [ ] Can join/end calls for assigned conversations

### Team Member

- [ ] Login as TEAM_MEMBER succeeds
- [ ] Can view only assigned projects/tasks
- [ ] Can update own task status with valid transitions
- [ ] Can send/receive messages in member conversations
- [ ] Can join calls where they are participants
- [ ] Cannot access admin/user management routes

### Viewer

- [ ] Login as VIEWER succeeds
- [ ] Can access read-only pages allowed by RBAC
- [ ] Cannot create/update/delete users, projects, teams, tasks
- [ ] Cannot send messages
- [ ] Cannot join/initiate calls
- [ ] Restricted actions show clear authorization errors

## 5. Communication Workflow Validation

- [ ] Open two sessions with different users and verify live incoming messages
- [ ] Verify typing indicator appears and auto-clears
- [ ] Start audio call from session A and verify session B receives incoming call state
- [ ] Join call from session B and verify both sessions show `ongoing`
- [ ] End call from one session and verify both update to ended state
- [ ] Verify no duplicate notifications are created for same event

## 6. Final Submission Artifacts

- [ ] Update README with setup and test steps
- [ ] Include demo credentials for all roles
- [ ] Include screenshots: Dashboard, Projects, Tasks, Messages, Calls, Admin pages
- [ ] Include known limitations and future improvements section
