/**
 * API Service Layer
 * Currently returns mock data. Replace function bodies with fetch() calls
 * to your Express + MongoDB backend.
 *
 * Example:
 *   const BASE_URL = 'http://localhost:5000/api';
 *   export async function getProjects() {
 *     const res = await fetch(`${BASE_URL}/projects`, { headers: authHeaders() });
 *     return res.json();
 *   }
 */

import { mockUsers, mockProjects, mockTasks, mockNotifications, mockCredentials } from '@/data/mockData';
import { User, Project, Task, Notification, TaskStatus, UserRole, UserStatus, Priority, Comment } from '@/types';

// Mutable copies for CRUD operations
let users = [...mockUsers];
let projects = [...mockProjects];
let tasks = [...mockTasks];
let notifications = [...mockNotifications];

// ── Auth ──────────────────────────────────────────────
export async function login(email: string, password: string): Promise<{ user: User; token: string } | null> {
  const cred = mockCredentials.find(c => c.email === email && c.password === password);
  if (!cred) return null;
  const user = users.find(u => u.id === cred.userId);
  if (!user || user.status === 'inactive') return null;
  return { user, token: `mock-jwt-token-${user.id}` };
}

export async function register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
  const newUser: User = { id: `u${Date.now()}`, name, email, role: 'user', status: 'active', createdAt: new Date().toISOString() };
  users.push(newUser);
  mockCredentials.push({ email, password, userId: newUser.id });
  return { user: newUser, token: `mock-jwt-token-${newUser.id}` };
}

// ── Users ─────────────────────────────────────────────
export async function getUsers(): Promise<User[]> { return users; }
export async function getUserById(id: string): Promise<User | undefined> { return users.find(u => u.id === id); }
export async function createUser(data: { name: string; email: string; role: UserRole; status: UserStatus }): Promise<User> {
  const u: User = { id: `u${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  users.push(u);
  return u;
}
export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  users = users.map(u => u.id === id ? { ...u, ...data } : u);
  return users.find(u => u.id === id)!;
}
export async function deleteUser(id: string): Promise<void> { users = users.filter(u => u.id !== id); }

// ── Projects ──────────────────────────────────────────
export async function getProjects(): Promise<Project[]> { return projects; }
export async function getProjectById(id: string): Promise<Project | undefined> { return projects.find(p => p.id === id); }
export async function getProjectsForUser(userId: string): Promise<Project[]> { return projects.filter(p => p.assignedUsers.includes(userId)); }
export async function createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const p: Project = { id: `p${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  projects.push(p);
  return p;
}
export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  projects = projects.map(p => p.id === id ? { ...p, ...data } : p);
  return projects.find(p => p.id === id)!;
}
export async function deleteProject(id: string): Promise<void> { projects = projects.filter(p => p.id !== id); }

// ── Tasks ─────────────────────────────────────────────
export async function getTasks(): Promise<Task[]> { return tasks; }
export async function getTaskById(id: string): Promise<Task | undefined> { return tasks.find(t => t.id === id); }
export async function getTasksForUser(userId: string): Promise<Task[]> { return tasks.filter(t => t.assignedTo === userId); }
export async function getTasksForProject(projectId: string): Promise<Task[]> { return tasks.filter(t => t.projectId === projectId); }
export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'comments'>): Promise<Task> {
  const t: Task = { id: `t${Date.now()}`, ...data, comments: [], createdAt: new Date().toISOString() };
  tasks.push(t);
  return t;
}
export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  tasks = tasks.map(t => t.id === id ? { ...t, ...data } : t);
  return tasks.find(t => t.id === id)!;
}
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return updateTask(id, { status });
}
export async function deleteTask(id: string): Promise<void> { tasks = tasks.filter(t => t.id !== id); }
export async function addComment(taskId: string, userId: string, content: string): Promise<Comment> {
  const comment: Comment = { id: `c${Date.now()}`, taskId, userId, content, createdAt: new Date().toISOString() };
  tasks = tasks.map(t => t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t);
  return comment;
}

// ── Notifications ─────────────────────────────────────
export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  return notifications.filter(n => n.userId === userId);
}
export async function markNotificationRead(id: string): Promise<void> {
  notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
}
export async function markAllNotificationsRead(userId: string): Promise<void> {
  notifications = notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
}

// ── Stats (Admin) ─────────────────────────────────────
export async function getDashboardStats() {
  return {
    totalProjects: projects.length,
    totalTasks: tasks.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    tasksByStatus: {
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    },
  };
}
