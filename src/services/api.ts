/**
 * API Service Layer
 * Connected to Supabase backend with PostgreSQL + Row Level Security
 */

import { supabase } from '@/lib/supabase';
import { mockUsers, mockCredentials, mockProjects, mockTeams, mockTasks, mockNotifications } from '@/data/mockData';
import { User, Project, Team, Task, Notification, TaskStatus, UserRole, UserStatus, Comment } from '@/types';
import { AuthorizationError, hasPermission } from '@/lib/rbac';

let activeUserId: string | null = null;

// ── Persistent Storage for Mock Data ──────────────────
// When using mock data, persist users and credentials to localStorage
// so registered users survive page reloads

function initializeUsers(): User[] {
  if (typeof localStorage === 'undefined') return [...mockUsers];
  const stored = localStorage.getItem('taskflow_mock_users');
  return stored ? JSON.parse(stored) : [...mockUsers];
}

function initializeCredentials(): typeof mockCredentials {
  if (typeof localStorage === 'undefined') return [...mockCredentials];
  const stored = localStorage.getItem('taskflow_mock_credentials');
  return stored ? JSON.parse(stored) : [...mockCredentials];
}

function saveUsers(users: User[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('taskflow_mock_users', JSON.stringify(users));
  }
}

function saveCredentials(credentials: typeof mockCredentials): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('taskflow_mock_credentials', JSON.stringify(credentials));
  }
}

function initializeProjects(): Project[] {
  if (typeof localStorage === 'undefined') return [...mockProjects];
  const stored = localStorage.getItem('taskflow_mock_projects');
  return stored ? JSON.parse(stored) : [...mockProjects];
}

function initializeTeams(): Team[] {
  if (typeof localStorage === 'undefined') return [...mockTeams];
  const stored = localStorage.getItem('taskflow_mock_teams');
  return stored ? JSON.parse(stored) : [...mockTeams];
}

function initializeTasks(): Task[] {
  if (typeof localStorage === 'undefined') return [...mockTasks];
  const stored = localStorage.getItem('taskflow_mock_tasks');
  return stored ? JSON.parse(stored) : [...mockTasks];
}

function saveProjects(projects: Project[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('taskflow_mock_projects', JSON.stringify(projects));
  }
}

function saveTeams(teams: Team[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('taskflow_mock_teams', JSON.stringify(teams));
  }
}

function saveTasks(tasks: Task[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('taskflow_mock_tasks', JSON.stringify(tasks));
  }
}

let users = initializeUsers();
let credentials = initializeCredentials();
let projects = initializeProjects();
let teams = initializeTeams();
let tasks = initializeTasks();
let notifications = [...mockNotifications];

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

async function writeAudit(action: AuditAction, targetType: AuditLog['targetType'], targetId: string) {
  if (!activeUserId) return;
  // Audit logs are stored in Supabase, logged via database trigger or separate table
  console.log('[AUDIT]', { actor: activeUserId, action, targetType, targetId });
}

async function requireUser(): Promise<User | null> {
  if (!activeUserId) throw new AuthorizationError('Authentication required');
  
  // Try Supabase first, fall back to mock data
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeUserId)
        .single();
      if (!error && data) {
        return { id: data.id, name: data.name, email: data.email, role: data.role, status: data.status, createdAt: data.created_at };
      }
    } catch (e) {
      // Supabase query failed, fall through to mock data
    }
  }
  
  // Fall back to local users array
  const user = users.find(u => u.id === activeUserId);
  if (!user) throw new AuthorizationError('Authentication required');
  return user;
}

async function requirePermission(permission: Parameters<typeof hasPermission>[1]): Promise<User> {
  const user = await requireUser();
  if (!hasPermission(user!.role, permission)) {
    throw new AuthorizationError('Forbidden');
  }
  return user!;
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
  await requirePermission('users:manage');
  // Fetch audit logs from Supabase if available, for now return empty
  return [];
}

// ── Auth ──────────────────────────────────────────────
export async function login(email: string, password: string): Promise<{ user: User; token: string } | null> {
  // Always try Supabase first if available, then fall back to mock
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (!error && data.user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profileError && profile && profile.status !== 'inactive') {
            const user: User = {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              status: profile.status,
              createdAt: profile.created_at
            };

            activeUserId = user.id;
            await writeAudit('LOGIN', 'auth', user.id);
            return { user, token: data.session?.access_token || '' };
          }
        } catch (e) {
          // Profile fetch failed, fall through to mock auth
        }
      }
    } catch (e) {
      // Supabase auth failed, fall through to mock auth
    }
  }

  // Fallback to mock auth
  const cred = credentials.find(c => c.email === email && c.password === password);
  if (!cred) return null;
  const user = users.find(u => u.id === cred.userId);
  if (!user || user.status === 'inactive') return null;
  activeUserId = user.id;
  await writeAudit('LOGIN', 'auth', user.id);
  return { user, token: `mock-token-${user.id}` };
}

export async function register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
  // Try Supabase first, fall back to mock if it fails
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'TEAM_MEMBER'
          }
        }
      });

      if (!error && data.user) {
        try {
          // Wait a moment for the profile trigger to fire
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profileError && profile) {
            const user: User = {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              status: profile.status,
              createdAt: profile.created_at
            };

            activeUserId = user.id;
            await writeAudit('REGISTER', 'auth', user.id);
            return { user, token: data.session?.access_token || '' };
          } else {
            // Profile creation failed, but user was created in auth - create profile manually
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert([{
                id: data.user.id,
                name,
                email,
                role: 'TEAM_MEMBER',
                status: 'active'
              }])
              .select()
              .single();
            
            if (!insertError && newProfile) {
              const user: User = {
                id: newProfile.id,
                name: newProfile.name,
                email: newProfile.email,
                role: newProfile.role,
                status: newProfile.status,
                createdAt: newProfile.created_at
              };
              activeUserId = user.id;
              await writeAudit('REGISTER', 'auth', user.id);
              return { user, token: data.session?.access_token || '' };
            }
          }
        } catch (e) {
          console.error('Profile creation error:', e);
          // Fall through to mock registration
        }
      }
    } catch (e) {
      console.error('Supabase registration error:', e);
      // Fall through to mock registration
    }
  }

  // Fallback to mock registration
  const newUser: User = {
    id: `u${Date.now()}`,
    name,
    email,
    role: 'TEAM_MEMBER',
    status: 'active',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  credentials.push({ email, password, userId: newUser.id });
  saveUsers(users);
  saveCredentials(credentials);
  activeUserId = newUser.id;
  await writeAudit('REGISTER', 'auth', newUser.id);
  return { user: newUser, token: `mock-token-${newUser.id}` };
}

// ── Users ─────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  await requireUser();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data) {
        return data.map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, status: p.status, createdAt: p.created_at }));
      }
    } catch (e) {
      // Fall through to mock data
    }
  }
  return [...users];
}
export async function getUserById(id: string): Promise<User | undefined> {
  const actor = await requireUser();
  if (actor.role !== 'ADMIN' && actor.id !== id) throw new AuthorizationError('Forbidden');
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) return undefined;
  return data ? { id: data.id, name: data.name, email: data.email, role: data.role, status: data.status, createdAt: data.created_at } : undefined;
}
export async function createUser(data: { name: string; email: string; role: UserRole; status: UserStatus }): Promise<User> {
  await requirePermission('users:manage');
  // Note: This should be handled via Supabase admin API or auth endpoint, not direct insert
  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert([{ name: data.name, email: data.email, role: data.role, status: data.status }])
    .select()
    .single();
  if (error) throw error;
  await writeAudit('CREATE_USER', 'user', newProfile.id);
  return { id: newProfile.id, name: newProfile.name, email: newProfile.email, role: newProfile.role, status: newProfile.status, createdAt: newProfile.created_at };
}
export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const actor = await requireUser();
  const { data: target, error: fetchError } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (fetchError || !target) throw new Error('User not found');

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

  const updateData = { ...(data.name && { name: data.name }), ...(data.role && { role: data.role }), ...(data.status && { status: data.status }) };
  const { data: updated, error } = await supabase.from('profiles').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  await writeAudit('UPDATE_USER', 'user', id);
  return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, status: updated.status, createdAt: updated.created_at };
}
export async function deleteUser(id: string): Promise<void> {
  await requirePermission('users:manage');
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
  await writeAudit('DELETE_USER', 'user', id);
}

// ── Projects ──────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  await requireUser();
  if (!supabase) return [...mockProjects];
  const { data, error } = await supabase.from('projects').select('*');
  if (error || !data) throw error;
  return data.map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: [] }));
}
export async function getProjectById(id: string): Promise<Project | undefined> {
  await requireUser();
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error) return undefined;
  return data ? { id: data.id, title: data.title, description: data.description, createdBy: data.created_by, createdAt: data.created_at, deadline: data.deadline, priority: data.priority, assignedUsers: [] } : undefined;
}
export async function getProjectsForUser(userId: string): Promise<Project[]> {
  const actor = await requireUser();
  
  if (supabase) {
    try {
      if (actor.role === 'TEAM_MEMBER') {
        const { data, error } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', actor.id);
        if (!error && data) {
          const projectIds = data?.map(pm => pm.project_id) || [];
          if (projectIds.length === 0) return [];
          const { data: projects, error: projError } = await supabase
            .from('projects')
            .select('*')
            .in('id', projectIds);
          if (!projError && projects) {
            return projects.map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: [] }));
          }
        }
      } else {
        return getProjects();
      }
    } catch (e) {
      // Fall through to mock data
    }
  }
  
  // Fall back to mock data
  if (actor.role === 'TEAM_MEMBER') {
    return projects.filter(p => p.assignedUsers.includes(actor.id));
  }
  return [...projects];
}
export async function createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const actor = await requirePermission('projects:create');
  
  if (!supabase) {
    const newProject: Project = {
      id: `p${Date.now()}`,
      title: data.title,
      description: data.description,
      createdBy: actor.id,
      createdAt: new Date().toISOString(),
      deadline: data.deadline,
      priority: data.priority,
      assignedUsers: data.assignedUsers || []
    };
    projects.push(newProject);
    saveProjects(projects);
    await writeAudit('CREATE_PROJECT', 'project', newProject.id);
    return newProject;
  }
  
  const { data: newProject, error } = await supabase
    .from('projects')
    .insert([{ title: data.title, description: data.description, created_by: actor.id, deadline: data.deadline, priority: data.priority }])
    .select()
    .single();
  if (error) throw error;
  await writeAudit('CREATE_PROJECT', 'project', newProject.id);
  return { id: newProject.id, title: newProject.title, description: newProject.description, createdBy: newProject.created_by, createdAt: newProject.created_at, deadline: newProject.deadline, priority: newProject.priority, assignedUsers: [] };
}
export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  await requirePermission('projects:update');
  
  if (!supabase) {
    const projectIndex = projects.findIndex(p => p.id === id);
    if (projectIndex === -1) throw new Error('Project not found');
    const project = projects[projectIndex];
    const updated = { ...project, ...data, id: project.id, createdAt: project.createdAt };
    projects[projectIndex] = updated;
    saveProjects(projects);
    await writeAudit('UPDATE_PROJECT', 'project', id);
    return updated;
  }
  
  const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.deadline && { deadline: data.deadline }), ...(data.priority && { priority: data.priority }) };
  const { data: updated, error } = await supabase.from('projects').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  await writeAudit('UPDATE_PROJECT', 'project', id);
  return { id: updated.id, title: updated.title, description: updated.description, createdBy: updated.created_by, createdAt: updated.created_at, deadline: updated.deadline, priority: updated.priority, assignedUsers: [] };
}
export async function deleteProject(id: string): Promise<void> {
  await requirePermission('projects:delete');
  
  if (!supabase) {
    projects = projects.filter(p => p.id !== id);
    saveProjects(projects);
    await writeAudit('DELETE_PROJECT', 'project', id);
    return;
  }
  
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
  await writeAudit('DELETE_PROJECT', 'project', id);
}

// ── Teams ────────────────────────────────────────────
export async function getTeams(): Promise<Team[]> {
  await requireUser();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('teams').select('*');
      if (!error && data) {
        return data.map(t => ({ id: t.id, name: t.name, description: t.description, createdBy: t.created_by, members: [], projects: [], createdAt: t.created_at }));
      }
    } catch (e) {
      // Fall through to mock data
    }
  }
  return [...teams];
}
export async function getTeamById(id: string): Promise<Team | undefined> {
  await requireUser();
  const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();
  if (error) return undefined;
  if (!data) return undefined;
  const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', id);
  const { data: projects } = await supabase.from('team_projects').select('project_id').eq('team_id', id);
  return { id: data.id, name: data.name, description: data.description, createdBy: data.created_by, members: members?.map(m => m.user_id) || [], projects: projects?.map(p => p.project_id) || [], createdAt: data.created_at };
}
export async function createTeam(data: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
  const actor = await requirePermission('teams:manage');
  
  if (!supabase) {
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name: data.name,
      description: data.description,
      createdBy: actor.id,
      members: data.members || [],
      projects: data.projects || [],
      createdAt: new Date().toISOString()
    };
    teams.push(newTeam);
    saveTeams(teams);
    await writeAudit('CREATE_TEAM', 'team', newTeam.id);
    return newTeam;
  }
  
  const { data: newTeam, error } = await supabase
    .from('teams')
    .insert([{ name: data.name, description: data.description, created_by: actor.id }])
    .select()
    .single();
  if (error) throw error;
  await writeAudit('CREATE_TEAM', 'team', newTeam.id);
  return { id: newTeam.id, name: newTeam.name, description: newTeam.description, createdBy: newTeam.created_by, members: data.members, projects: data.projects, createdAt: newTeam.created_at };
}
export async function updateTeam(id: string, data: Partial<Team>): Promise<Team> {
  await requirePermission('teams:manage');
  
  if (!supabase) {
    const teamIndex = teams.findIndex(t => t.id === id);
    if (teamIndex === -1) throw new Error('Team not found');
    const team = teams[teamIndex];
    const updated = { ...team, ...data, id: team.id, createdAt: team.createdAt };
    teams[teamIndex] = updated;
    saveTeams(teams);
    await writeAudit('UPDATE_TEAM', 'team', id);
    return updated;
  }
  
  const updateData = { ...(data.name && { name: data.name }), ...(data.description && { description: data.description }) };
  const { data: updated, error } = await supabase.from('teams').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  await writeAudit('UPDATE_TEAM', 'team', id);
  const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', id);
  const { data: projects } = await supabase.from('team_projects').select('project_id').eq('team_id', id);
  return { id: updated.id, name: updated.name, description: updated.description, createdBy: updated.created_by, members: members?.map(m => m.user_id) || [], projects: projects?.map(p => p.project_id) || [], createdAt: updated.created_at };
}
export async function deleteTeam(id: string): Promise<void> {
  await requirePermission('teams:manage');
  
  if (!supabase) {
    teams = teams.filter(t => t.id !== id);
    saveTeams(teams);
    await writeAudit('DELETE_TEAM', 'team', id);
    return;
  }
  
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
  await writeAudit('DELETE_TEAM', 'team', id);
}

// ── Tasks ─────────────────────────────────────────────
export async function getTasks(): Promise<Task[]> {
  const actor = await requirePermission('tasks:view');
  
  if (supabase) {
    try {
      let query = supabase.from('tasks').select('*');
      if (actor.role === 'TEAM_MEMBER') {
        query = query.eq('assigned_to', actor.id);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
      }
    } catch (e) {
      // Fall through to mock data
    }
  }
  
  // Fall back to mock data
  if (actor.role === 'TEAM_MEMBER') {
    return tasks.filter(t => t.assignedTo === actor.id);
  }
  return [...tasks];
}
export async function getTaskById(id: string): Promise<Task | undefined> {
  const actor = await requirePermission('tasks:view');
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
  if (error) return undefined;
  if (!data) return undefined;
  if (actor.role === 'TEAM_MEMBER' && data.assigned_to !== actor.id) throw new AuthorizationError('Forbidden');
  const { data: comments } = await supabase.from('comments').select('*').eq('task_id', id);
  return { id: data.id, title: data.title, description: data.description, projectId: data.project_id, assignedTo: data.assigned_to, createdBy: data.created_by, status: data.status, priority: data.priority, dueDate: data.due_date, comments: comments?.map(c => ({ id: c.id, taskId: c.task_id, userId: c.user_id, content: c.content, createdAt: c.created_at })) || [], createdAt: data.created_at };
}
export async function getTasksForUser(userId: string): Promise<Task[]> {
  const actor = await requirePermission('tasks:view');
  if (actor.role === 'TEAM_MEMBER' && actor.id !== userId) throw new AuthorizationError('Forbidden');
  
  if (supabase) {
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('assigned_to', actor.role === 'TEAM_MEMBER' ? actor.id : userId);
      if (!error && data) {
        return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
      }
    } catch (e) {
      // Fall through to mock data
    }
  }
  
  // Fall back to mock data
  return tasks.filter(t => t.assignedTo === (actor.role === 'TEAM_MEMBER' ? actor.id : userId));
}
export async function getTasksForProject(projectId: string): Promise<Task[]> {
  const actor = await requirePermission('tasks:view');
  let query = supabase.from('tasks').select('*').eq('project_id', projectId);
  if (actor.role === 'TEAM_MEMBER') {
    query = query.eq('assigned_to', actor.id);
  }
  const { data, error } = await query;
  if (error || !data) throw error;
  return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
}
export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'comments'>): Promise<Task> {
  const actor = await requirePermission('tasks:create');
  if (data.assignedTo !== actor.id) {
    await requirePermission('tasks:assign');
  }
  
  if (!supabase) {
    const newTask: Task = {
      id: `tk${Date.now()}`,
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      assignedTo: data.assignedTo,
      createdBy: actor.id,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      comments: [],
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    saveTasks(tasks);
    await writeAudit('CREATE_TASK', 'task', newTask.id);
    return newTask;
  }
  
  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert([{ title: data.title, description: data.description, project_id: data.projectId, assigned_to: data.assignedTo, created_by: actor.id, status: data.status, priority: data.priority, due_date: data.dueDate }])
    .select()
    .single();
  if (error) throw error;
  await writeAudit('CREATE_TASK', 'task', newTask.id);
  return { id: newTask.id, title: newTask.title, description: newTask.description, projectId: newTask.project_id, assignedTo: newTask.assigned_to, createdBy: newTask.created_by, status: newTask.status, priority: newTask.priority, dueDate: newTask.due_date, comments: [], createdAt: newTask.created_at };
}
export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  const actor = await requireUser();
  
  let current: Task | undefined;
  if (!supabase) {
    current = tasks.find(t => t.id === id);
  } else {
    const { data: fetchedCurrent, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (fetchError || !fetchedCurrent) throw new Error('Task not found');
    current = { id: fetchedCurrent.id, title: fetchedCurrent.title, description: fetchedCurrent.description, projectId: fetchedCurrent.project_id, assignedTo: fetchedCurrent.assigned_to, createdBy: fetchedCurrent.created_by, status: fetchedCurrent.status, priority: fetchedCurrent.priority, dueDate: fetchedCurrent.due_date, comments: [], createdAt: fetchedCurrent.created_at };
  }
  
  if (!current) throw new Error('Task not found');

  if (actor!.role === 'TEAM_MEMBER') {
    if (current.assignedTo !== actor!.id) throw new AuthorizationError('Forbidden');
    const attemptedFields = Object.keys(data);
    const statusOnly = attemptedFields.every((field) => field === 'status');
    if (!statusOnly || typeof data.status === 'undefined') {
      throw new AuthorizationError('TEAM_MEMBER can only update task status');
    }
    assertTaskTransition(current.status, data.status);
  } else {
    await requirePermission('tasks:update');
    if (typeof data.assignedTo !== 'undefined' && data.assignedTo !== current.assignedTo) {
      await requirePermission('tasks:assign');
    }
  }

  if (!supabase) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) throw new Error('Task not found');
    const updated = { ...tasks[taskIndex], ...data, id: tasks[taskIndex].id, createdAt: tasks[taskIndex].createdAt, comments: tasks[taskIndex].comments };
    tasks[taskIndex] = updated;
    saveTasks(tasks);
    await writeAudit('UPDATE_TASK', 'task', id);
    return updated;
  }

  const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.assignedTo && { assigned_to: data.assignedTo }), ...(data.status && { status: data.status }), ...(data.priority && { priority: data.priority }), ...(data.dueDate && { due_date: data.dueDate }) };
  const { data: updated, error } = await supabase.from('tasks').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  await writeAudit('UPDATE_TASK', 'task', id);
  return { id: updated.id, title: updated.title, description: updated.description, projectId: updated.project_id, assignedTo: updated.assigned_to, createdBy: updated.created_by, status: updated.status, priority: updated.priority, dueDate: updated.due_date, comments: [], createdAt: updated.created_at };
}
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const actor = await requireUser();
  const { data: task, error } = await supabase.from('tasks').select('*').eq('id', id).single();
  if (error || !task) throw new Error('Task not found');

  if (actor!.role === 'TEAM_MEMBER') {
    if (task.assigned_to !== actor!.id) throw new AuthorizationError('Forbidden');
    await requirePermission('tasks:update-own-status');
    assertTaskTransition(task.status, status);
  } else {
    await requirePermission('tasks:update');
  }

  const updated = await updateTask(id, { status });
  await writeAudit('UPDATE_TASK_STATUS', 'task', id);
  return updated;
}
export async function deleteTask(id: string): Promise<void> {
  await requirePermission('tasks:delete');
  
  if (!supabase) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(tasks);
    await writeAudit('DELETE_TASK', 'task', id);
    return;
  }
  
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
  await writeAudit('DELETE_TASK', 'task', id);
}
export async function addComment(taskId: string, userId: string, content: string): Promise<Comment> {
  const actor = await requirePermission('comments:add');
  const { data: task, error: taskError } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (taskError || !task) throw new Error('Task not found');
  if (actor.id !== userId) throw new AuthorizationError('Forbidden');
  if (actor.role === 'TEAM_MEMBER' && task.assigned_to !== actor.id) throw new AuthorizationError('Forbidden');

  const { data: comment, error } = await supabase
    .from('comments')
    .insert([{ task_id: taskId, user_id: userId, content }])
    .select()
    .single();
  if (error) throw error;
  await writeAudit('ADD_COMMENT', 'comment', comment.id);
  return { id: comment.id, taskId: comment.task_id, userId: comment.user_id, content: comment.content, createdAt: comment.created_at };
}

// ── Notifications ─────────────────────────────────────
export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  const actor = await requireUser();
  if (actor.id !== userId && actor.role !== 'ADMIN') throw new AuthorizationError('Forbidden');
  if (!supabase) return mockNotifications.filter(n => n.userId === userId);
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId);
  if (error || !data) throw error;
  return data.map(n => ({ id: n.id, userId: n.user_id, title: n.title, message: n.message, read: n.read, type: n.type, createdAt: n.created_at }));
}
export async function markNotificationRead(id: string): Promise<void> {
  const actor = await requireUser();
  if (actor.role === 'VIEWER') throw new AuthorizationError('VIEWER role is read-only');
  const { data: notification, error: fetchError } = await supabase.from('notifications').select('*').eq('id', id).single();
  if (fetchError || !notification) return;
  if (actor.id !== notification.user_id && actor.role !== 'ADMIN') throw new AuthorizationError('Forbidden');
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const actor = await requireUser();
  if (actor.role === 'VIEWER') throw new AuthorizationError('VIEWER role is read-only');
  if (actor.id !== userId && actor.role !== 'ADMIN') throw new AuthorizationError('Forbidden');
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  if (error) throw error;
}

// ── Stats (Admin) ─────────────────────────────────────
export async function getDashboardStats() {
  await requirePermission('dashboard:view');
  
  if (!supabase) {
    const tasksByStatus = {
      pending: mockTasks.filter(t => t.status === 'pending').length,
      in_progress: mockTasks.filter(t => t.status === 'in_progress').length,
      completed: mockTasks.filter(t => t.status === 'completed').length,
    };
    return {
      totalProjects: mockProjects.length,
      totalTasks: mockTasks.length,
      activeUsers: mockUsers.filter(u => u.status === 'active').length,
      tasksByStatus,
    };
  }
  
  const { data: projects } = await supabase.from('projects').select('id');
  const { data: tasks } = await supabase.from('tasks').select('id, status');
  const { data: activeUsers } = await supabase.from('profiles').select('id').eq('status', 'active');

  const tasksByStatus = {
    pending: tasks?.filter(t => t.status === 'pending').length || 0,
    in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
    completed: tasks?.filter(t => t.status === 'completed').length || 0,
  };

  return {
    totalProjects: projects?.length || 0,
    totalTasks: tasks?.length || 0,
    activeUsers: activeUsers?.length || 0,
    tasksByStatus,
  };
}
