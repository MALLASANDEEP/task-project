
# Task & Project Management Tool — Frontend

## Overview
A complete React frontend for a remote team task/project management tool with role-based UI (Admin vs User), mock data, and a clean API service layer ready to swap in your Express + MongoDB backend.

## Authentication & Routing
- Login and Register pages with email/password + Google/GitHub OAuth buttons (UI only, mock auth)
- JWT token stored in localStorage (mock), auth context for session management
- Protected routes with role-based redirects
- Mock users: one Admin, one Team Member

## Layout
- **Sidebar navigation** using shadcn Sidebar component
  - Admin menu: Dashboard, Projects, Tasks, Users, Settings
  - User menu: Dashboard, My Projects, My Tasks, Profile
- **Header** with user avatar, notifications bell, and sidebar toggle
- Responsive — collapsible sidebar on mobile

## Admin Pages
1. **Dashboard** — Stats cards (total projects, tasks, active users, task status breakdown), recent activity feed
2. **User Management** — Table with create/edit/delete users, role assignment, activate/deactivate toggle
3. **Project Management** — Project cards/list with create/edit/delete, assign team members, set deadline & priority
4. **Task Management** — Task board or table view, create/edit/delete tasks under projects, assign to users, set priority & status, comments section

## User Pages
1. **Dashboard** — Assigned projects overview, personal task summary with status counts
2. **My Projects** — List of assigned projects (read-only)
3. **My Tasks** — Task list with status update (Pending → In Progress → Completed), view deadlines, add comments
4. **Profile Settings** — Edit name/email, change password form

## Shared Features
- **Notifications** — In-app notification bell with dropdown, mock notification data for task assignments/updates
- **Search & Filter** — Search bar + filters (status, priority, assignee) on tasks and projects pages
- **Responsive design** — Mobile-friendly with Tailwind

## API Service Layer
- `src/services/api.ts` — Clean abstraction with functions like `getProjects()`, `createTask()`, `updateTaskStatus()`, etc.
- All functions currently return mock data from `src/data/mockData.ts`
- Easy to replace with `fetch()` calls to your Express backend
- Typed interfaces for User, Project, Task in `src/types/`

## Mock Data
- 3 sample projects with varying priorities and deadlines
- 10+ sample tasks across projects with different statuses
- 5 sample users (1 admin, 4 team members)
- Sample comments and notifications

## Tech
- React 18 + Vite + TypeScript + Tailwind CSS
- shadcn/ui components (tables, cards, dialogs, forms, sidebar, badges)
- React Router for routing
- React Query for data fetching (ready for real API)
- Lucide icons
