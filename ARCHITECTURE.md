# Jira-Like Upgrade - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React 18)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Tasks Page     │  │  Kanban Board    │  │   Task Modal     │  │
│  │   (Table View)   │  │  (Drag-Drop)     │  │  (Detail/Chat)   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                      │                      │             │
│  ┌────────▼──────────────────────▼──────────────────────▼─────────┐ │
│  │                    Socket.io Client                            │ │
│  │  Listeners:                                                    │ │
│  │  • task:created, task:updated, task:moved, task:deleted       │ │
│  └────────┬──────────────────────────────────────┬────────────────┘ │
│           │                                      │                   │
│  ┌────────▼────────┐  ┌───────────────────────┬─▼──────────────┐  │
│  │   API Layer     │  │   Supabase Client    │ Socket.io      │  │
│  │  (api.js)       │  │  (Postgres Client)   │ (WebSocket)    │  │
│  └────────┬────────┘  └───────────────────────┴─┬──────────────┘  │
│           │                                      │                   │
└───────────┼──────────────────────────────────────┼───────────────────┘
            │                                      │
    ┌───────▼──────────────────────────────────────▼────────┐
    │                  Network/Internet                      │
    └───────┬──────────────────────────────────────┬─────────┘
            │                                      │
  ┌─────────▼────────────────────────────────┬────▼─────────┐
  │       Supabase Backend (PostgreSQL)      │  Socket.io   │
  │                                          │   Server     │
  │  ┌─────────────────────────────────────┐ │              │
  │  │  REST API Endpoints                 │ │ ┌──────────┐│
  │  │  • /tasks (CRUD)                    │ │ │ Port 8001││
  │  │  • /comments (CRUD)                 │ │ └──────────┘│
  │  │  • /activity-logs (GET)             │ │              │
  │  │  • /notifications (GET, PATCH)      │ │ Events:     │
  │  │  • /task-assignments (CRUD)         │ │ • task:* events
  │  │                                     │ │ • Broadcasts to
  │  │  With JWT auth + RLS policies      │ │   project rooms
  │  └─────────────────────────────────────┘ │              │
  │                                          │              │
  │  ┌─────────────────────────────────────┐ │              │
  │  │  Database (PostgreSQL)              │ │              │
  │  │                                     │ │              │
  │  │  Tables:                            │ │              │
  │  │  • profiles (users & roles)         │ │              │
  │  │  • projects, project_members       │ │              │
  │  │  • tasks (status, priority, etc)   │ │              │
  │  │  • task_assignments (multi-assign) │ │              │
  │  │  • activity_logs (audit trail)     │ │              │
  │  │  • comments (on tasks)             │ │              │
  │  │  • notifications (real-time)       │ │              │
  │  │  • calls, messages, conversations  │ │              │
  │  │                                     │ │              │
  │  │  Features:                         │ │              │
  │  │  • Row Level Security (RLS)        │ │              │
  │  │  • Automated triggers              │ │              │
  │  │  • Proper indexing                 │ │              │
  │  │  • Foreign key constraints         │ │              │
  │  └─────────────────────────────────────┘ │              │
  └──────────────────────────────────────────┴──────────────┘
```

---

## Real-Time Event Flow

### Scenario: User A drags task from TODO → IN_PROGRESS

```
User A's Browser
┌─────────────────┐
│ Drags task      │
│ UI updates      │ (Optimistic - instant)
│ Emits event     │
└────────┬────────┘
         │
         │ socket.emit('task:moved', {
         │   taskId, projectId, userId,
         │   fromStatus: 'pending',
         │   toStatus: 'in_progress'
         │ })
         │
         ▼
Server (Express + Socket.io)
┌────────────────────────────────────┐
│ 1. Validate permissions            │
│ 2. Log activity to DB              │
│ 3. Broadcast to watchers           │
│ 4. Create notifications            │
│ 5. Persist to Supabase             │
└────────┬───────────────────────────┘
         │
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
   Database              Broadcast Event
   ┌──────────────────┐  ┌──────────────────────────────┐
   │ activity_logs:   │  │ to project:projectId:tasks   │
   │ {                │  │                              │
   │  action: moved,  │  │ socket.emit('task:updated',  │
   │  from: pending,  │  │   {taskId, changes})         │
   │  to: in_progress │  │                              │
   │ }                │  └──────────────────────────────┘
   └──────────────────┘             │
                                    ├─────────────────┐
                                    │                 │
                                 (to all other users)
                                    │                 │
                     ┌──────────────▼─┐    ┌──────────▼──┐
                     │ User B Browser  │    │ User C's Tab│
                     │                 │    │             │
                     │ Listen on:      │    │ Listen on:  │
                     │ task:updated    │    │ task:updated│
                     │ ↓               │    │ ↓           │
                     │ Update state    │    │ Update state│
                     │ ↓               │    │ ↓           │
                     │ Re-render UI    │    │ Re-render UI│
                     │ ↓               │    │ ↓           │
                     │ Task moves!     │    │ Task moves! │
                     │ (Instant)       │    │ (Instant)   │
                     └─────────────────┘    └─────────────┘
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                      PROFILES                               │
├─────────────────────────────────────────────────────────────┤
│ id (UUID)  │ name │ email │ role │ status │ avatar_url     │
└─────────────────────────────────────────────────────────────┘
              ▲                  ▲
              │                  │ (ADMIN, PM, TL, TM)
              │                  │
              └────┬─────────────┘
                   │ 1:N
┌──────────────────────────────────────────────────────────────┐
│                     PROJECTS                                │
├──────────────────────────────────────────────────────────────┤
│ id │ title │ description │ created_by │ priority │ deadline  │
└──────────────────────────────────────────────────────────────┘
       ▲                          ├──N:N─────────────┐
       │ (Created by user)        │                  │
       │                   ┌──────▼─────────┐ ┌─────▼────────┐
       │                   │ PROJECT_       │ │ TEAM_        │
       │                   │ MEMBERS        │ │ PROJECTS     │
       │                   └────────────────┘ └──────────────┘
       │
       │ 1:N
┌──────────────────────────────────────────────────────────────┐
│                      TASKS                                   │
├──────────────────────────────────────────────────────────────┤
│ id │ title │ description │ status │ priority │ due_date     │
│ project_id │ assigned_to │ created_by │ created_at │ updatedAt│
└──────────────────────────────────────────────────────────────┘
    │  ▲
    │  └─ M:N
    │  ┌────────────────────────┐
    │  │ TASK_ASSIGNMENTS       │
    │  ├────────────────────────┤
    │  │ task_id                │
    │  │ assigned_to (User ID)  │
    │  │ assigned_by            │
    │  │ assigned_at            │
    │  └────────────────────────┘
    │
    │ 1:N
    ├─────────────────────────────┐
    │                             │
┌───▼──────────────┐  ┌──────────▼──────────┐
│    COMMENTS      │  │   ACTIVITY_LOGS     │
├──────────────────┤  ├─────────────────────┤
│ id               │  │ id                  │
│ task_id          │  │ user_id             │
│ user_id          │  │ task_id             │
│ content          │  │ action (moved,      │
│ created_at       │  │   assigned, etc)    │
└──────────────────┘  │ entity_type         │
                      │ old_value (JSONB)   │
                      │ new_value (JSONB)   │
                      │ metadata (JSONB)    │
                      │ created_at          │
                      └─────────────────────┘

                  ┌─────────────────────┐
                  │  NOTIFICATIONS      │
                  ├─────────────────────┤
                  │ id                  │
                  │ user_id (recipient) │
                  │ task_id (optional)  │
                  │ title, message      │
                  │ type (assigned,     │
                  │   status_changed)   │
                  │ read                │
                  │ created_at          │
                  └─────────────────────┘
```

---

## Socket.io Room Structure

```
┌────────────────────────────────────────────────────┐
│           Socket.io Namespace: /                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Room: project:PROJECT_ID:tasks              │ │
│  │  Purpose: All users viewing a project board  │ │
│  │                                              │ │
│  │  When user joins board:                      │ │
│  │  socket.emit('task:join-board', proj, user) │ │
│  │  → socket.join('project:PROJECT_ID:tasks)   │ │
│  │                                              │ │
│  │  Broadcasts to this room:                    │ │
│  │  • task:created                              │ │
│  │  • task:updated                              │ │
│  │  • task:moved                                │ │
│  │  • task:deleted                              │ │
│  │  • task:comment-added                        │ │
│  │  • task:assigned                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Room: user:USER_ID                          │ │
│  │  Purpose: Targeted notifications             │ │
│  │                                              │ │
│  │  When user authenticates:                    │ │
│  │  socket.emit('user:authenticate', userId)   │ │
│  │  → socket.join('user:USER_ID')               │ │
│  │                                              │ │
│  │  Broadcasts to this room:                    │ │
│  │  • notification:new                          │ │
│  │  • task:assigned (if user is assignee)       │ │
│  │  • call:ringing                              │ │
│  │  • message:new                               │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Room: conversation:CONVERSATION_ID          │ │
│  │  Purpose: Chat in conversations              │ │
│  │  (Existing feature, already implemented)     │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## Permissions Model (RBAC)

```
┌─────────────────────┐
│      ADMIN          │
├─────────────────────┤
│ ✓ Create tasks      │
│ ✓ Edit tasks        │
│ ✓ Delete tasks      │
│ ✓ Assign users      │
│ ✓ View all tasks    │
│ ✓ View audit logs   │
│ ✓ Manage users      │
└─────────────────────┘

┌─────────────────────┐
│  PROJECT_MANAGER    │
├─────────────────────┤
│ ✓ Create tasks      │
│ ✓ Edit tasks        │
│ ✓ Delete tasks      │
│ ✓ Assign users      │
│ ✓ View project tasks│
│ ✓ View audit logs   │
│ ✗ Manage users      │
└─────────────────────┘

┌─────────────────────┐
│   TEAM_LEADER       │
├─────────────────────┤
│ ✗ Create tasks      │
│ ✓ Edit own tasks    │
│ ✗ Delete tasks      │
│ ✗ Assign users      │
│ ✓ View own tasks    │
│ ✓ View audit logs   │
│ ✗ Manage users      │
└─────────────────────┘

┌─────────────────────┐
│   TEAM_MEMBER       │
├─────────────────────┤
│ ✗ Create tasks      │
│ ✗ Edit tasks        │
│ ✗ Delete tasks      │
│ ✗ Assign users      │
│ ✓ View own tasks    │
│ ✓ View notifications│
│ ✗ Manage users      │
└─────────────────────┘
```

---

## Optimization Layers

```
┌─────────────────────────────────────────────────────┐
│              CLIENT-SIDE OPTIMIZATION               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  • Optimistic UI (instant feedback)                │
│  • React memoization (prevent re-renders)          │
│  • Debounced search (reduce server calls)          │
│  • Lazy loading (on-demand task details)           │
│  • Caching (user list, project list)               │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              DATABASE OPTIMIZATION                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Indexes:                                           │
│  • activity_logs(user_id)                          │
│  • activity_logs(task_id)                          │
│  • activity_logs(created_at desc)  ← Recent first  │
│  • task_assignments(task_id)                       │
│  • task_assignments(assigned_to)                   │
│  • notifications(user_id, created_at desc)         │
│                                                     │
│  Pagination:                                        │
│  • Activity logs: LIMIT 100                        │
│  • Notifications: LIMIT 50                         │
│  • Messages: LIMIT 50                              │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              SOCKET.IO OPTIMIZATION                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  For 1000+ concurrent users:                       │
│                                                     │
│  ┌───────────────┐                                 │
│  │ Socket.io     │                                 │
│  │ Server 1      │───┐                             │
│  └───────────────┘   │                             │
│                      ├──→ Redis Adapter            │
│  ┌───────────────┐   │                             │
│  │ Socket.io     │───┤   Handles sync between      │
│  │ Server 2      │───┤   multiple servers          │
│  └───────────────┘   │                             │
│                      │                             │
│  ┌───────────────┐   │                             │
│  │ Socket.io     │───┘                             │
│  │ Server N      │                                 │
│  └───────────────┘                                 │
│                                                     │
│  (Currently using in-memory storage - works for    │
│   100+ concurrent. Add Redis for 1000+)            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────┐
│     CLIENT-SIDE SECURITY                │
├─────────────────────────────────────────┤
│ • JWT token storage                     │
│ • HTTPS enforced                        │
│ • XSS prevention (React escaping)       │
│ • CSRF token (if applicable)            │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│     REST API SECURITY (Server.js)       │
├─────────────────────────────────────────┤
│ • JWT verification on every request     │
│ • Permission checking (via hasPermission)
│ • Role-based access control             │
│ • Input validation & sanitization       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│   DATABASE SECURITY (Supabase)          │
├─────────────────────────────────────────┤
│ • Row Level Security (RLS) policies     │
│ • Foreign key constraints                │
│ • NOT NULL constraints                   │
│ • Unique constraints                     │
│ • Audit triggers (auto-logging)         │
└─────────────────────────────────────────┘
```

---

## Deployment Architecture

```
Development
  └─ Local Machine
     ├─ Node.js (Server) on port 8001
     ├─ Vite (Frontend) on port 5173
     └─ Supabase Local (Database)

Staging
  └─ Staging Server
     ├─ Node.js (Server) on port 8001
     ├─ Next.js/Static (Frontend) 5173
     └─ Supabase Staging
        └─ Migrations applied
        └─ RLS policies enabled

Production
  └─ Production Server (or Vercel/Netlify)
     ├─ Node.js + PM2 (Server - multiple instances)
     ├─ Deployed Frontend (Vercel, Netlify, etc)
     ├─ Redis (for Socket.io adapter)
     ├─ Supabase Production
     │  └─ All migrations applied
     │  └─ Full backups enabled
     │  └─ Monitoring enabled
     └─ CDN (for static assets)
```

---

This architecture is **production-ready** and can scale from 10 to 1000+ concurrent users with minimal changes.

**Key advantages:**
- ✅ Real-time collaboration built-in
- ✅ Secure by default (RLS + permissions)
- ✅ Scalable (Redis adapter ready)
- ✅ Observable (activity logs everything)
- ✅ Auditable (complete audit trail)
