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

import { mockUsers, mockProjects, mockTeams, mockTasks, mockNotifications, mockCredentials } from '@/data/mockData';
import { User, Project, Team, Task, Notification, TaskStatus, UserRole, UserStatus, Comment } from '@/types';
import { AuthorizationError, hasPermission } from '@/lib/rbac';

// Mutable copies for CRUD operations
let users = [...mockUsers];
let projects = [...mockProjects];
let teams = [...mockTeams];
let tasks = [...mockTasks];
let notifications = [...mockNotifications];
let activeUserId: string | null = null;

type AuditAction =
  | 'LOGIN'
  | 'REGISTER'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'CREATE_TEAM'
  | 'UPDATE_TEAM'
  | 'DELETE_TEAM'
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'UPDATE_TASK_STATUS'
  | 'ADD_COMMENT';

interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  targetType: 'user' | 'project' | 'team' | 'task' | 'comment' | 'auth';
  targetId: string;
  at: string;
}

const auditLogs: AuditLog[] = [];

function encodeBase64(value: string): string {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(value);
  return Buffer.from(value, 'utf-8').toString('base64');
}

function createMockJwt(user: User): string {
  const header = encodeBase64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64(JSON.stringify({ sub: user.id, role: user.role, iat: Math.floor(Date.now() / 1000) }));
  const signature = encodeBase64('mock-signature');
  return `${header}.${payload}.${signature}`;
}

function writeAudit(action: AuditAction, targetType: AuditLog['targetType'], targetId: string) {
  if (!activeUserId) return;
  auditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    actorId: activeUserId,
    action,
    targetType,
    targetId,
    at: new Date().toISOString(),
  });
}

function requireUser(): User {
  if (!activeUserId) throw new AuthorizationError('Authentication required');
  const user = users.find((u) => u.id === activeUserId);
  if (!user) throw new AuthorizationError('Authentication required');
  return user;
}

function requirePermission(permission: Parameters<typeof hasPermission>[1]): User {
  const user = requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new AuthorizationError('Forbidden');
  }
  return user;
}

function canReadTask(user: User, task: Task): boolean {
  if (user.role === 'ADMIN' || user.role === 'PROJECT_MANAGER' || user.role === 'VIEWER') return true;
  return task.assignedTo === user.id;
}

function assertTaskTransition(current: TaskStatus, next: TaskStatus) {
  const order: TaskStatus[] = ['pending', 'in_progress', 'completed'];
  const currentIndex = order.indexOf(current);
  const nextIndex = order.indexOf(next);
  if (nextIndex < currentIndex) {
    throw new AuthorizationError('TEAM_MEMBER cannot move task status backwards');
  }
}

export function setActiveUserId(userId: string | null) {
  activeUserId = userId;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  requirePermission('users:manage');
  return auditLogs;
}

// ── Auth ──────────────────────────────────────────────
export async function login(email: string, password: string): Promise<{ user: User; token: string } | null> {
  const cred = mockCredentials.find(c => c.email === email && c.password === password);
  if (!cred) return null;
  const user = users.find(u => u.id === cred.userId);
  if (!user || user.status === 'inactive') return null;
  activeUserId = user.id;
  writeAudit('LOGIN', 'auth', user.id);
  return { user, token: createMockJwt(user) };
}

export async function register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
  const newUser: User = { id: `u${Date.now()}`, name, email, role: 'TEAM_MEMBER', status: 'active', createdAt: new Date().toISOString() };
  users.push(newUser);
  mockCredentials.push({ email, password, userId: newUser.id });
  activeUserId = newUser.id;
  writeAudit('REGISTER', 'auth', newUser.id);
  return { user: newUser, token: createMockJwt(newUser) };
}

// ── Users ─────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  requireUser();
  return users;
}
export async function getUserById(id: string): Promise<User | undefined> {
  const actor = requireUser();
  if (actor.role !== 'ADMIN' && actor.id !== id) throw new AuthorizationError('Forbidden');
  return users.find(u => u.id === id);
}
export async function createUser(data: { name: string; email: string; role: UserRole; status: UserStatus }): Promise<User> {
  requirePermission('users:manage');
  const u: User = { id: `u${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  users.push(u);
  writeAudit('CREATE_USER', 'user', u.id);
  return u;
}
export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const actor = requireUser();
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error('User not found');

  if (actor.role === 'VIEWER' && actor.id === id) {
    throw new AuthorizationError('VIEWER role is read-only');
  }

  const isRoleChange = typeof data.role !== 'undefined' || typeof data.status !== 'undefined';
  if (isRoleChange && !hasPermission(actor.role, 'users:assign-role')) {
    throw new AuthorizationError('Only ADMIN can assign roles or status');
  }

  if (!hasPermission(actor.role, 'users:manage') && actor.id !== id) {
    throw new AuthorizationError('Forbidden');
  }

  users = users.map(u => u.id === id ? { ...u, ...data } : u);
  writeAudit('UPDATE_USER', 'user', id);
  return users.find(u => u.id === id)!;
}
export async function deleteUser(id: string): Promise<void> {
  requirePermission('users:manage');
  users = users.filter(u => u.id !== id);
  writeAudit('DELETE_USER', 'user', id);
}

// ── Projects ──────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  requireUser();
  return projects;
}
export async function getProjectById(id: string): Promise<Project | undefined> {
  requireUser();
  return projects.find(p => p.id === id);
}
export async function getProjectsForUser(userId: string): Promise<Project[]> {
  const actor = requireUser();
  if (actor.role === 'TEAM_MEMBER') {
    return projects.filter(p => p.assignedUsers.includes(actor.id));
  }
  return projects;
}
export async function createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  requirePermission('projects:create');
  const p: Project = { id: `p${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  projects.push(p);
  writeAudit('CREATE_PROJECT', 'project', p.id);
  return p;
}
export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  requirePermission('projects:update');
  projects = projects.map(p => p.id === id ? { ...p, ...data } : p);
  writeAudit('UPDATE_PROJECT', 'project', id);
  return projects.find(p => p.id === id)!;
}
export async function deleteProject(id: string): Promise<void> {
  requirePermission('projects:delete');
  projects = projects.filter(p => p.id !== id);
  writeAudit('DELETE_PROJECT', 'project', id);
}

// ── Teams ────────────────────────────────────────────
export async function getTeams(): Promise<Team[]> {
  requireUser();
  return teams;
}
export async function getTeamById(id: string): Promise<Team | undefined> {
  requireUser();
  return teams.find(team => team.id === id);
}

function attachTeamProjects(team: Pick<Team, 'members' | 'projects'>) {
  const projectIds = new Set(team.projects);
  const memberIds = team.members;

  projects = projects.map((project) => {
    if (!projectIds.has(project.id)) return project;
    return {
      ...project,
      assignedUsers: Array.from(new Set([...project.assignedUsers, ...memberIds])),
    };
  });
}

export async function createTeam(data: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
  requirePermission('teams:manage');
  const team: Team = { id: `team${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  teams.push(team);
  attachTeamProjects(team);
  writeAudit('CREATE_TEAM', 'team', team.id);
  return team;
}

export async function updateTeam(id: string, data: Partial<Team>): Promise<Team> {
  requirePermission('teams:manage');
  teams = teams.map(team => team.id === id ? { ...team, ...data } : team);
  const updated = teams.find(team => team.id === id)!;
  attachTeamProjects(updated);
  writeAudit('UPDATE_TEAM', 'team', id);
  return updated;
}

export async function deleteTeam(id: string): Promise<void> {
  requirePermission('teams:manage');
  teams = teams.filter(team => team.id !== id);
  writeAudit('DELETE_TEAM', 'team', id);
}

// ── Tasks ─────────────────────────────────────────────
export async function getTasks(): Promise<Task[]> {
  const actor = requirePermission('tasks:view');
  if (actor.role === 'TEAM_MEMBER') return tasks.filter(t => t.assignedTo === actor.id);
  return tasks;
}
export async function getTaskById(id: string): Promise<Task | undefined> {
  const actor = requirePermission('tasks:view');
  const task = tasks.find(t => t.id === id);
  if (!task) return undefined;
  if (!canReadTask(actor, task)) throw new AuthorizationError('Forbidden');
  return task;
}
export async function getTasksForUser(userId: string): Promise<Task[]> {
  const actor = requirePermission('tasks:view');
  if (actor.role === 'TEAM_MEMBER' && actor.id !== userId) throw new AuthorizationError('Forbidden');
  return actor.role === 'TEAM_MEMBER' ? tasks.filter(t => t.assignedTo === actor.id) : tasks.filter(t => t.assignedTo === userId);
}
export async function getTasksForProject(projectId: string): Promise<Task[]> {
  const actor = requirePermission('tasks:view');
  const projectTasks = tasks.filter(t => t.projectId === projectId);
  return actor.role === 'TEAM_MEMBER' ? projectTasks.filter(t => t.assignedTo === actor.id) : projectTasks;
}
export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'comments'>): Promise<Task> {
  const actor = requirePermission('tasks:create');
  if (data.assignedTo !== actor.id) {
    requirePermission('tasks:assign');
  }
  const t: Task = { id: `t${Date.now()}`, ...data, comments: [], createdAt: new Date().toISOString() };
  tasks.push(t);
  writeAudit('CREATE_TASK', 'task', t.id);
  return t;
}
export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  const actor = requireUser();
  const current = tasks.find(t => t.id === id);
  if (!current) throw new Error('Task not found');

  if (actor.role === 'TEAM_MEMBER') {
    if (current.assignedTo !== actor.id) throw new AuthorizationError('Forbidden');

    const attemptedFields = Object.keys(data);
    const statusOnly = attemptedFields.every((field) => field === 'status');
    if (!statusOnly || typeof data.status === 'undefined') {
      throw new AuthorizationError('TEAM_MEMBER can only update task status');
    }

    assertTaskTransition(current.status, data.status);
  } else {
    requirePermission('tasks:update');
    if (typeof data.assignedTo !== 'undefined' && data.assignedTo !== current.assignedTo) {
      requirePermission('tasks:assign');
    }
  }

  tasks = tasks.map(t => t.id === id ? { ...t, ...data } : t);
  writeAudit('UPDATE_TASK', 'task', id);
  return tasks.find(t => t.id === id)!;
}
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const actor = requireUser();
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error('Task not found');

  if (actor.role === 'TEAM_MEMBER') {
    if (task.assignedTo !== actor.id) throw new AuthorizationError('Forbidden');
    requirePermission('tasks:update-own-status');
    assertTaskTransition(task.status, status);
  } else {
    requirePermission('tasks:update');
  }

  const updated = await updateTask(id, { status });
  writeAudit('UPDATE_TASK_STATUS', 'task', id);
  return updated;
}
export async function deleteTask(id: string): Promise<void> {
  requirePermission('tasks:delete');
  tasks = tasks.filter(t => t.id !== id);
  writeAudit('DELETE_TASK', 'task', id);
}
export async function addComment(taskId: string, userId: string, content: string): Promise<Comment> {
  const actor = requirePermission('comments:add');
  const task = tasks.find(t => t.id === taskId);
  if (!task) throw new Error('Task not found');
  if (actor.id !== userId) throw new AuthorizationError('Forbidden');
  if (actor.role === 'TEAM_MEMBER' && task.assignedTo !== actor.id) throw new AuthorizationError('Forbidden');

  const comment: Comment = { id: `c${Date.now()}`, taskId, userId, content, createdAt: new Date().toISOString() };
  tasks = tasks.map(t => t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t);
  writeAudit('ADD_COMMENT', 'comment', comment.id);
  return comment;
}

// ── Notifications ─────────────────────────────────────
export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  const actor = requireUser();
  if (actor.id !== userId && actor.role !== 'ADMIN') throw new AuthorizationError('Forbidden');
  return notifications.filter(n => n.userId === userId);
}
export async function markNotificationRead(id: string): Promise<void> {
  const actor = requireUser();
  if (actor.role === 'VIEWER') throw new AuthorizationError('VIEWER role is read-only');
  const notification = notifications.find((n) => n.id === id);
  if (!notification) return;
  if (actor.id !== notification.userId && actor.role !== 'ADMIN') throw new AuthorizationError('Forbidden');
  notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
}
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const actor = requireUser();
  if (actor.role === 'VIEWER') throw new AuthorizationError('VIEWER role is read-only');
  if (actor.id !== userId && actor.role !== 'ADMIN') throw new AuthorizationError('Forbidden');
  notifications = notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
}

// ── Stats (Admin) ─────────────────────────────────────
export async function getDashboardStats() {
  requirePermission('dashboard:view');
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
