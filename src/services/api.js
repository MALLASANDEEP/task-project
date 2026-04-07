/**
 * API Service Layer
 * Connected to Supabase backend with PostgreSQL + Row Level Security
 */
import { supabase } from '@/lib/supabase';
import { mockUsers, mockCredentials, mockProjects, mockTeams, mockTasks, mockNotifications } from '@/data/mockData';
import { AuthorizationError, hasPermission } from '@/lib/rbac';
let activeUserId = null;
// ── Persistent Storage for Mock Data ──────────────────
// When using mock data, persist users and credentials to localStorage
// so registered users survive page reloads
function initializeUsers() {
    if (typeof localStorage === 'undefined')
        return [...mockUsers];
    const stored = localStorage.getItem('taskflow_mock_users');
    return stored ? JSON.parse(stored) : [...mockUsers];
}
function initializeCredentials() {
    if (typeof localStorage === 'undefined')
        return [...mockCredentials];
    const stored = localStorage.getItem('taskflow_mock_credentials');
    return stored ? JSON.parse(stored) : [...mockCredentials];
}
function saveUsers(users) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_users', JSON.stringify(users));
    }
}
function saveCredentials(credentials) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_credentials', JSON.stringify(credentials));
    }
}
function initializeProjects() {
    if (typeof localStorage === 'undefined')
        return [...mockProjects];
    const stored = localStorage.getItem('taskflow_mock_projects');
    return stored ? JSON.parse(stored) : [...mockProjects];
}
function initializeTeams() {
    if (typeof localStorage === 'undefined')
        return [...mockTeams];
    const stored = localStorage.getItem('taskflow_mock_teams');
    return stored ? JSON.parse(stored) : [...mockTeams];
}
function initializeTasks() {
    if (typeof localStorage === 'undefined')
        return [...mockTasks];
    const stored = localStorage.getItem('taskflow_mock_tasks');
    return stored ? JSON.parse(stored) : [...mockTasks];
}
function initializeNotifications() {
    if (typeof localStorage === 'undefined')
        return [...mockNotifications];
    const stored = localStorage.getItem('taskflow_mock_notifications');
    return stored ? JSON.parse(stored) : [...mockNotifications];
}
function initializeConversations() {
    if (typeof localStorage === 'undefined')
        return [];
    const stored = localStorage.getItem('taskflow_mock_conversations');
    return stored ? JSON.parse(stored) : [];
}
function initializeMessages() {
    if (typeof localStorage === 'undefined')
        return [];
    const stored = localStorage.getItem('taskflow_mock_messages');
    return stored ? JSON.parse(stored) : [];
}
function initializeTypingStates() {
    if (typeof localStorage === 'undefined')
        return [];
    const stored = localStorage.getItem('taskflow_mock_typing_states');
    return stored ? JSON.parse(stored) : [];
}
function initializeCallSessions() {
    if (typeof localStorage === 'undefined')
        return [];
    const stored = localStorage.getItem('taskflow_mock_calls');
    return stored ? JSON.parse(stored) : [];
}
function saveProjects(projects) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_projects', JSON.stringify(projects));
    }
}
function saveTeams(teams) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_teams', JSON.stringify(teams));
    }
}
function saveTasks(tasks) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_tasks', JSON.stringify(tasks));
    }
}
function saveNotifications(notificationItems) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_notifications', JSON.stringify(notificationItems));
    }
}
function saveConversations(items) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_conversations', JSON.stringify(items));
    }
}
function saveMessages(items) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_messages', JSON.stringify(items));
    }
}
function saveTypingStates(items) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_typing_states', JSON.stringify(items));
    }
}
function saveCallSessions(items) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('taskflow_mock_calls', JSON.stringify(items));
    }
}
let users = initializeUsers();
let credentials = initializeCredentials();
let projects = initializeProjects();
let teams = initializeTeams();
let tasks = initializeTasks();
let notifications = initializeNotifications();
let conversations = initializeConversations();
let chatMessages = initializeMessages();
let typingStates = initializeTypingStates();
let callSessions = initializeCallSessions();
async function writeAudit(action, targetType, targetId) {
    if (!activeUserId)
        return;
    // Audit logs are stored in Supabase, logged via database trigger or separate table
    console.log('[AUDIT]', { actor: activeUserId, action, targetType, targetId });
}
async function requireUser() {
    if (!activeUserId)
        throw new AuthorizationError('Authentication required');
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
        }
        catch (e) {
            // Supabase query failed, fall through to mock data
        }
    }
    // Fall back to local users array
    const user = users.find(u => u.id === activeUserId);
    if (!user)
        throw new AuthorizationError('Authentication required');
    return user;
}
async function requirePermission(permission) {
    const user = await requireUser();
    if (!hasPermission(user.role, permission)) {
        throw new AuthorizationError('Forbidden');
    }
    return user;
}
function assertTaskTransition(current, next) {
    const order = ['pending', 'in_progress', 'completed'];
    const currentIndex = order.indexOf(current);
    const nextIndex = order.indexOf(next);
    if (nextIndex < currentIndex) {
        throw new AuthorizationError('TEAM_MEMBER cannot move task status backwards');
    }
}
export function setActiveUserId(userId) {
    activeUserId = userId;
}
const commListeners = new Set();
function emitCommunicationEvent(event) {
    commListeners.forEach((listener) => listener(event));
}
export function subscribeCommunicationEvents(listener) {
    commListeners.add(listener);
    return () => {
        commListeners.delete(listener);
    };
}
function createNotification(userId, title, message, type) {
    const nextNotification = {
        id: `n${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
    };
    notifications = [nextNotification, ...notifications];
    saveNotifications(notifications);
}
function findUserByMention(mentionName) {
    const normalized = mentionName.trim().toLowerCase();
    return users.find((u) => u.name.toLowerCase().replace(/\s+/g, '') === normalized.replace(/\s+/g, ''));
}
function extractMentionUserIds(content) {
    const mentionMatches = content.match(/@[a-zA-Z0-9_.-]+/g) || [];
    const ids = mentionMatches
        .map((token) => findUserByMention(token.replace('@', ''))?.id)
        .filter((id) => Boolean(id));
    return Array.from(new Set(ids));
}
function getProjectMemberIds(projectId) {
    if (!projectId)
        return [];
    const project = projects.find((p) => p.id === projectId);
    return project?.assignedUsers || [];
}
function canAccessConversation(actor, conversation) {
    if (actor.role === 'ADMIN')
        return true;
    if (conversation.participants.includes(actor.id))
        return true;
    if (conversation.type === 'project') {
        const projectMembers = getProjectMemberIds(conversation.projectId);
        if (actor.role === 'PROJECT_MANAGER')
            return projectMembers.length > 0;
        if (actor.role === 'TEAM_MEMBER')
            return projectMembers.includes(actor.id);
    }
    return false;
}
function canSendMessage(actor, conversation) {
    if (!hasPermission(actor.role, 'chat:send'))
        return false;
    if (actor.role === 'TEAM_MEMBER' && conversation.type === 'project') {
        const projectMembers = getProjectMemberIds(conversation.projectId);
        return projectMembers.includes(actor.id);
    }
    return canAccessConversation(actor, conversation);
}
export async function getAuditLogs() {
    await requirePermission('users:manage');
    // Fetch audit logs from Supabase if available, for now return empty
    return [];
}
// ── Auth ──────────────────────────────────────────────
export async function login(email, password) {
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
                        const user = {
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
                }
                catch (e) {
                    // Profile fetch failed, fall through to mock auth
                }
            }
        }
        catch (e) {
            // Supabase auth failed, fall through to mock auth
        }
    }
    // Fallback to mock auth
    const cred = credentials.find(c => c.email === email && c.password === password);
    if (!cred)
        return null;
    const user = users.find(u => u.id === cred.userId);
    if (!user || user.status === 'inactive')
        return null;
    activeUserId = user.id;
    await writeAudit('LOGIN', 'auth', user.id);
    return { user, token: `mock-token-${user.id}` };
}
export async function register(name, email, password) {
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
                        const user = {
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
                    }
                    else {
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
                            const user = {
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
                }
                catch (e) {
                    console.error('Profile creation error:', e);
                    // Fall through to mock registration
                }
            }
        }
        catch (e) {
            console.error('Supabase registration error:', e);
            // Fall through to mock registration
        }
    }
    // Fallback to mock registration
    const newUser = {
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
export async function getUsers() {
    await requireUser();
    if (supabase) {
        try {
            const { data, error } = await supabase.from('profiles').select('*');
            if (!error && data) {
                return data.map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, status: p.status, createdAt: p.created_at }));
            }
        }
        catch (e) {
            // Fall through to mock data
        }
    }
    return [...users];
}
export async function getUserById(id) {
    const actor = await requireUser();
    if (actor.role !== 'ADMIN' && actor.id !== id)
        throw new AuthorizationError('Forbidden');
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error)
        return undefined;
    return data ? { id: data.id, name: data.name, email: data.email, role: data.role, status: data.status, createdAt: data.created_at } : undefined;
}
export async function createUser(data) {
    await requirePermission('users:manage');
    // Note: This should be handled via Supabase admin API or auth endpoint, not direct insert
    const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert([{ name: data.name, email: data.email, role: data.role, status: data.status }])
        .select()
        .single();
    if (error)
        throw error;
    await writeAudit('CREATE_USER', 'user', newProfile.id);
    return { id: newProfile.id, name: newProfile.name, email: newProfile.email, role: newProfile.role, status: newProfile.status, createdAt: newProfile.created_at };
}
export async function updateUser(id, data) {
    const actor = await requireUser();
    const { data: target, error: fetchError } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (fetchError || !target)
        throw new Error('User not found');
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
    if (error)
        throw error;
    await writeAudit('UPDATE_USER', 'user', id);
    return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, status: updated.status, createdAt: updated.created_at };
}
export async function deleteUser(id) {
    await requirePermission('users:manage');
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error)
        throw error;
    await writeAudit('DELETE_USER', 'user', id);
}
// ── Projects ──────────────────────────────────────────
export async function getProjects() {
    await requireUser();
    if (!supabase)
        return [...mockProjects];
    const { data, error } = await supabase.from('projects').select('*');
    if (error || !data)
        throw error;
    return data.map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: [] }));
}
export async function getProjectById(id) {
    await requireUser();
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
    if (error)
        return undefined;
    return data ? { id: data.id, title: data.title, description: data.description, createdBy: data.created_by, createdAt: data.created_at, deadline: data.deadline, priority: data.priority, assignedUsers: [] } : undefined;
}
export async function getProjectsForUser(userId) {
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
                    if (projectIds.length === 0)
                        return [];
                    const { data: projects, error: projError } = await supabase
                        .from('projects')
                        .select('*')
                        .in('id', projectIds);
                    if (!projError && projects) {
                        return projects.map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: [] }));
                    }
                }
            }
            else {
                return getProjects();
            }
        }
        catch (e) {
            // Fall through to mock data
        }
    }
    // Fall back to mock data
    if (actor.role === 'TEAM_MEMBER') {
        return projects.filter(p => p.assignedUsers.includes(actor.id));
    }
    return [...projects];
}
export async function createProject(data) {
    const actor = await requirePermission('projects:create');
    if (!supabase) {
        const newProject = {
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
    if (error)
        throw error;
    await writeAudit('CREATE_PROJECT', 'project', newProject.id);
    return { id: newProject.id, title: newProject.title, description: newProject.description, createdBy: newProject.created_by, createdAt: newProject.created_at, deadline: newProject.deadline, priority: newProject.priority, assignedUsers: [] };
}
export async function updateProject(id, data) {
    await requirePermission('projects:update');
    if (!supabase) {
        const projectIndex = projects.findIndex(p => p.id === id);
        if (projectIndex === -1)
            throw new Error('Project not found');
        const project = projects[projectIndex];
        const updated = { ...project, ...data, id: project.id, createdAt: project.createdAt };
        projects[projectIndex] = updated;
        saveProjects(projects);
        await writeAudit('UPDATE_PROJECT', 'project', id);
        return updated;
    }
    const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.deadline && { deadline: data.deadline }), ...(data.priority && { priority: data.priority }) };
    const { data: updated, error } = await supabase.from('projects').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;
    await writeAudit('UPDATE_PROJECT', 'project', id);
    return { id: updated.id, title: updated.title, description: updated.description, createdBy: updated.created_by, createdAt: updated.created_at, deadline: updated.deadline, priority: updated.priority, assignedUsers: [] };
}
export async function deleteProject(id) {
    await requirePermission('projects:delete');
    if (!supabase) {
        projects = projects.filter(p => p.id !== id);
        saveProjects(projects);
        await writeAudit('DELETE_PROJECT', 'project', id);
        return;
    }
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error)
        throw error;
    await writeAudit('DELETE_PROJECT', 'project', id);
}
// ── Teams ────────────────────────────────────────────
export async function getTeams() {
    await requireUser();
    if (supabase) {
        try {
            const { data, error } = await supabase.from('teams').select('*');
            if (!error && data) {
                return data.map(t => ({ id: t.id, name: t.name, description: t.description, createdBy: t.created_by, members: [], projects: [], createdAt: t.created_at }));
            }
        }
        catch (e) {
            // Fall through to mock data
        }
    }
    return [...teams];
}
export async function getTeamById(id) {
    await requireUser();
    const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();
    if (error)
        return undefined;
    if (!data)
        return undefined;
    const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', id);
    const { data: projects } = await supabase.from('team_projects').select('project_id').eq('team_id', id);
    return { id: data.id, name: data.name, description: data.description, createdBy: data.created_by, members: members?.map(m => m.user_id) || [], projects: projects?.map(p => p.project_id) || [], createdAt: data.created_at };
}
export async function createTeam(data) {
    const actor = await requirePermission('teams:manage');
    if (!supabase) {
        const newTeam = {
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
    if (error)
        throw error;
    await writeAudit('CREATE_TEAM', 'team', newTeam.id);
    return { id: newTeam.id, name: newTeam.name, description: newTeam.description, createdBy: newTeam.created_by, members: data.members, projects: data.projects, createdAt: newTeam.created_at };
}
export async function updateTeam(id, data) {
    await requirePermission('teams:manage');
    if (!supabase) {
        const teamIndex = teams.findIndex(t => t.id === id);
        if (teamIndex === -1)
            throw new Error('Team not found');
        const team = teams[teamIndex];
        const updated = { ...team, ...data, id: team.id, createdAt: team.createdAt };
        teams[teamIndex] = updated;
        saveTeams(teams);
        await writeAudit('UPDATE_TEAM', 'team', id);
        return updated;
    }
    const updateData = { ...(data.name && { name: data.name }), ...(data.description && { description: data.description }) };
    const { data: updated, error } = await supabase.from('teams').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;
    await writeAudit('UPDATE_TEAM', 'team', id);
    const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', id);
    const { data: projects } = await supabase.from('team_projects').select('project_id').eq('team_id', id);
    return { id: updated.id, name: updated.name, description: updated.description, createdBy: updated.created_by, members: members?.map(m => m.user_id) || [], projects: projects?.map(p => p.project_id) || [], createdAt: updated.created_at };
}
export async function deleteTeam(id) {
    await requirePermission('teams:manage');
    if (!supabase) {
        teams = teams.filter(t => t.id !== id);
        saveTeams(teams);
        await writeAudit('DELETE_TEAM', 'team', id);
        return;
    }
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error)
        throw error;
    await writeAudit('DELETE_TEAM', 'team', id);
}
// ── Tasks ─────────────────────────────────────────────
export async function getTasks() {
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
        }
        catch (e) {
            // Fall through to mock data
        }
    }
    // Fall back to mock data
    if (actor.role === 'TEAM_MEMBER') {
        return tasks.filter(t => t.assignedTo === actor.id);
    }
    return [...tasks];
}
export async function getTaskById(id) {
    const actor = await requirePermission('tasks:view');
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (error)
        return undefined;
    if (!data)
        return undefined;
    if (actor.role === 'TEAM_MEMBER' && data.assigned_to !== actor.id)
        throw new AuthorizationError('Forbidden');
    const { data: comments } = await supabase.from('comments').select('*').eq('task_id', id);
    return { id: data.id, title: data.title, description: data.description, projectId: data.project_id, assignedTo: data.assigned_to, createdBy: data.created_by, status: data.status, priority: data.priority, dueDate: data.due_date, comments: comments?.map(c => ({ id: c.id, taskId: c.task_id, userId: c.user_id, content: c.content, createdAt: c.created_at })) || [], createdAt: data.created_at };
}
export async function getTasksForUser(userId) {
    const actor = await requirePermission('tasks:view');
    if (actor.role === 'TEAM_MEMBER' && actor.id !== userId)
        throw new AuthorizationError('Forbidden');
    if (supabase) {
        try {
            const { data, error } = await supabase.from('tasks').select('*').eq('assigned_to', actor.role === 'TEAM_MEMBER' ? actor.id : userId);
            if (!error && data) {
                return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
            }
        }
        catch (e) {
            // Fall through to mock data
        }
    }
    // Fall back to mock data
    return tasks.filter(t => t.assignedTo === (actor.role === 'TEAM_MEMBER' ? actor.id : userId));
}
export async function getTasksForProject(projectId) {
    const actor = await requirePermission('tasks:view');
    let query = supabase.from('tasks').select('*').eq('project_id', projectId);
    if (actor.role === 'TEAM_MEMBER') {
        query = query.eq('assigned_to', actor.id);
    }
    const { data, error } = await query;
    if (error || !data)
        throw error;
    return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
}
export async function createTask(data) {
    const actor = await requirePermission('tasks:create');
    if (data.assignedTo !== actor.id) {
        await requirePermission('tasks:assign');
    }
    if (!supabase) {
        const newTask = {
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
        if (newTask.assignedTo !== actor.id) {
            createNotification(newTask.assignedTo, 'New Task Assigned', `You have been assigned "${newTask.title}"`, 'task_assigned');
        }
        await writeAudit('CREATE_TASK', 'task', newTask.id);
        return newTask;
    }
    const { data: newTask, error } = await supabase
        .from('tasks')
        .insert([{ title: data.title, description: data.description, project_id: data.projectId, assigned_to: data.assignedTo, created_by: actor.id, status: data.status, priority: data.priority, due_date: data.dueDate }])
        .select()
        .single();
    if (error)
        throw error;
    if (newTask.assigned_to !== actor.id) {
        createNotification(newTask.assigned_to, 'New Task Assigned', `You have been assigned "${newTask.title}"`, 'task_assigned');
    }
    await writeAudit('CREATE_TASK', 'task', newTask.id);
    return { id: newTask.id, title: newTask.title, description: newTask.description, projectId: newTask.project_id, assignedTo: newTask.assigned_to, createdBy: newTask.created_by, status: newTask.status, priority: newTask.priority, dueDate: newTask.due_date, comments: [], createdAt: newTask.created_at };
}
export async function updateTask(id, data) {
    const actor = await requireUser();
    let current;
    if (!supabase) {
        current = tasks.find(t => t.id === id);
    }
    else {
        const { data: fetchedCurrent, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
        if (fetchError || !fetchedCurrent)
            throw new Error('Task not found');
        current = { id: fetchedCurrent.id, title: fetchedCurrent.title, description: fetchedCurrent.description, projectId: fetchedCurrent.project_id, assignedTo: fetchedCurrent.assigned_to, createdBy: fetchedCurrent.created_by, status: fetchedCurrent.status, priority: fetchedCurrent.priority, dueDate: fetchedCurrent.due_date, comments: [], createdAt: fetchedCurrent.created_at };
    }
    if (!current)
        throw new Error('Task not found');
    if (actor.role === 'TEAM_MEMBER') {
        if (current.assignedTo !== actor.id)
            throw new AuthorizationError('Forbidden');
        const attemptedFields = Object.keys(data);
        const statusOnly = attemptedFields.every((field) => field === 'status');
        if (!statusOnly || typeof data.status === 'undefined') {
            throw new AuthorizationError('TEAM_MEMBER can only update task status');
        }
        assertTaskTransition(current.status, data.status);
    }
    else {
        await requirePermission('tasks:update');
        if (typeof data.assignedTo !== 'undefined' && data.assignedTo !== current.assignedTo) {
            await requirePermission('tasks:assign');
        }
    }
    if (!supabase) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex === -1)
            throw new Error('Task not found');
        const updated = { ...tasks[taskIndex], ...data, id: tasks[taskIndex].id, createdAt: tasks[taskIndex].createdAt, comments: tasks[taskIndex].comments };
        tasks[taskIndex] = updated;
        saveTasks(tasks);
        if (data.assignedTo && data.assignedTo !== current.assignedTo) {
            createNotification(data.assignedTo, 'Task Reassigned', `You were assigned "${updated.title}"`, 'task_assigned');
        }
        await writeAudit('UPDATE_TASK', 'task', id);
        return updated;
    }
    const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.assignedTo && { assigned_to: data.assignedTo }), ...(data.status && { status: data.status }), ...(data.priority && { priority: data.priority }), ...(data.dueDate && { due_date: data.dueDate }) };
    const { data: updated, error } = await supabase.from('tasks').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;
    if (data.assignedTo && data.assignedTo !== current.assignedTo) {
        createNotification(data.assignedTo, 'Task Reassigned', `You were assigned "${updated.title}"`, 'task_assigned');
    }
    await writeAudit('UPDATE_TASK', 'task', id);
    return { id: updated.id, title: updated.title, description: updated.description, projectId: updated.project_id, assignedTo: updated.assigned_to, createdBy: updated.created_by, status: updated.status, priority: updated.priority, dueDate: updated.due_date, comments: [], createdAt: updated.created_at };
}
export async function updateTaskStatus(id, status) {
    const actor = await requireUser();
    const { data: task, error } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (error || !task)
        throw new Error('Task not found');
    if (actor.role === 'TEAM_MEMBER') {
        if (task.assigned_to !== actor.id)
            throw new AuthorizationError('Forbidden');
        await requirePermission('tasks:update-own-status');
        assertTaskTransition(task.status, status);
    }
    else {
        await requirePermission('tasks:update');
    }
    const updated = await updateTask(id, { status });
    await writeAudit('UPDATE_TASK_STATUS', 'task', id);
    return updated;
}
export async function deleteTask(id) {
    await requirePermission('tasks:delete');
    if (!supabase) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks(tasks);
        await writeAudit('DELETE_TASK', 'task', id);
        return;
    }
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error)
        throw error;
    await writeAudit('DELETE_TASK', 'task', id);
}
export async function addComment(taskId, userId, content) {
    const actor = await requirePermission('comments:add');
    const { data: task, error: taskError } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    if (taskError || !task)
        throw new Error('Task not found');
    if (actor.id !== userId)
        throw new AuthorizationError('Forbidden');
    if (actor.role === 'TEAM_MEMBER' && task.assigned_to !== actor.id)
        throw new AuthorizationError('Forbidden');
    const { data: comment, error } = await supabase
        .from('comments')
        .insert([{ task_id: taskId, user_id: userId, content }])
        .select()
        .single();
    if (error)
        throw error;
    const mentionUserIds = extractMentionUserIds(content).filter((id) => id !== userId);
    mentionUserIds.forEach((mentionedId) => {
        createNotification(mentionedId, 'You were mentioned', `Mentioned in task discussion: "${task.title}"`, 'mention');
    });
    await writeAudit('ADD_COMMENT', 'comment', comment.id);
    return { id: comment.id, taskId: comment.task_id, userId: comment.user_id, content: comment.content, createdAt: comment.created_at };
}
// ── Notifications ─────────────────────────────────────
export async function getNotificationsForUser(userId) {
    const actor = await requireUser();
    if (actor.id !== userId && actor.role !== 'ADMIN')
        throw new AuthorizationError('Forbidden');
    if (!supabase)
        return notifications.filter(n => n.userId === userId);
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId);
    if (error || !data)
        throw error;
    return data.map(n => ({ id: n.id, userId: n.user_id, title: n.title, message: n.message, read: n.read, type: n.type, createdAt: n.created_at }));
}
export async function markNotificationRead(id) {
    const actor = await requireUser();
    if (actor.role === 'VIEWER')
        throw new AuthorizationError('VIEWER role is read-only');
    if (!supabase) {
        const existing = notifications.find((n) => n.id === id);
        if (!existing)
            return;
        if (actor.id !== existing.userId && actor.role !== 'ADMIN')
            throw new AuthorizationError('Forbidden');
        notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
        saveNotifications(notifications);
        return;
    }
    const { data: notification, error: fetchError } = await supabase.from('notifications').select('*').eq('id', id).single();
    if (fetchError || !notification)
        return;
    if (actor.id !== notification.user_id && actor.role !== 'ADMIN')
        throw new AuthorizationError('Forbidden');
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error)
        throw error;
}
export async function markAllNotificationsRead(userId) {
    const actor = await requireUser();
    if (actor.role === 'VIEWER')
        throw new AuthorizationError('VIEWER role is read-only');
    if (actor.id !== userId && actor.role !== 'ADMIN')
        throw new AuthorizationError('Forbidden');
    if (!supabase) {
        notifications = notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n));
        saveNotifications(notifications);
        return;
    }
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
    if (error)
        throw error;
}
// ── Communication (Chat + Calls) ─────────────────────
export async function getConversations() {
    const actor = await requirePermission('chat:view');
    if (supabase) {
        try {
            const { data: membershipRows, error: membershipError } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('user_id', actor.id);
            if (membershipError)
                throw membershipError;
            const conversationIds = (membershipRows || []).map((row) => row.conversation_id);
            if (conversationIds.length === 0)
                return [];
            const { data: conversationRows, error: conversationError } = await supabase
                .from('conversations')
                .select('*')
                .in('id', conversationIds)
                .order('last_message_at', { ascending: false });
            if (conversationError)
                throw conversationError;
            const { data: participantRows } = await supabase
                .from('conversation_members')
                .select('conversation_id,user_id')
                .in('conversation_id', conversationIds);
            return (conversationRows || []).map((row) => ({
                id: row.id,
                type: row.type,
                title: row.title || undefined,
                projectId: row.project_id || undefined,
                teamId: row.team_id || undefined,
                createdBy: row.created_by,
                participants: (participantRows || [])
                    .filter((participant) => participant.conversation_id === row.id)
                    .map((participant) => participant.user_id),
                lastMessageAt: row.last_message_at,
                createdAt: row.created_at,
            }));
        }
        catch {
            // Fall through to local mode
        }
    }
    return conversations
        .filter((conversation) => canAccessConversation(actor, conversation))
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}
export async function createDirectConversation(otherUserId) {
    const actor = await requirePermission('chat:send');
    if (actor.id === otherUserId)
        throw new AuthorizationError('Cannot start a direct conversation with yourself');
    if (supabase) {
        try {
            const { data: actorMemberships } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('user_id', actor.id);
            const actorConversationIds = (actorMemberships || []).map((row) => row.conversation_id);
            if (actorConversationIds.length > 0) {
                const { data: directConversations } = await supabase
                    .from('conversations')
                    .select('id,type')
                    .in('id', actorConversationIds)
                    .eq('type', 'direct');
                const directIds = (directConversations || []).map((row) => row.id);
                if (directIds.length > 0) {
                    const { data: directMembers } = await supabase
                        .from('conversation_members')
                        .select('conversation_id,user_id')
                        .in('conversation_id', directIds);
                    const existing = directIds.find((conversationId) => {
                        const members = (directMembers || [])
                            .filter((member) => member.conversation_id === conversationId)
                            .map((member) => member.user_id);
                        return members.length === 2 && members.includes(actor.id) && members.includes(otherUserId);
                    });
                    if (existing) {
                        const { data: existingConversation } = await supabase
                            .from('conversations')
                            .select('*')
                            .eq('id', existing)
                            .single();
                        if (existingConversation) {
                            return {
                                id: existingConversation.id,
                                type: existingConversation.type,
                                title: existingConversation.title || undefined,
                                projectId: existingConversation.project_id || undefined,
                                teamId: existingConversation.team_id || undefined,
                                createdBy: existingConversation.created_by,
                                participants: [actor.id, otherUserId],
                                lastMessageAt: existingConversation.last_message_at,
                                createdAt: existingConversation.created_at,
                            };
                        }
                    }
                }
            }
            const { data: insertedConversation, error: insertConversationError } = await supabase
                .from('conversations')
                .insert([
                {
                    type: 'direct',
                    title: 'Direct message',
                    created_by: actor.id,
                    last_message_at: new Date().toISOString(),
                },
            ])
                .select()
                .single();
            if (insertConversationError)
                throw insertConversationError;
            const { error: insertMembersError } = await supabase.from('conversation_members').insert([
                { conversation_id: insertedConversation.id, user_id: actor.id },
                { conversation_id: insertedConversation.id, user_id: otherUserId },
            ]);
            if (insertMembersError)
                throw insertMembersError;
            return {
                id: insertedConversation.id,
                type: insertedConversation.type,
                title: insertedConversation.title || undefined,
                projectId: insertedConversation.project_id || undefined,
                teamId: insertedConversation.team_id || undefined,
                createdBy: insertedConversation.created_by,
                participants: [actor.id, otherUserId],
                lastMessageAt: insertedConversation.last_message_at,
                createdAt: insertedConversation.created_at,
            };
        }
        catch {
            // Fall through to local mode
        }
    }
    const existing = conversations.find((conversation) => conversation.type === 'direct' &&
        conversation.participants.length === 2 &&
        conversation.participants.includes(actor.id) &&
        conversation.participants.includes(otherUserId));
    if (existing)
        return existing;
    const nextConversation = {
        id: `conv${Date.now()}${Math.random().toString(16).slice(2, 5)}`,
        type: 'direct',
        participants: [actor.id, otherUserId],
        createdBy: actor.id,
        title: 'Direct message',
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
    };
    conversations = [nextConversation, ...conversations];
    saveConversations(conversations);
    emitCommunicationEvent({ type: 'conversation:update', conversationId: nextConversation.id });
    return nextConversation;
}
export async function createProjectConversation(projectId, title) {
    const actor = await requirePermission('chat:create-group');
    const project = projects.find((item) => item.id === projectId);
    if (!project)
        throw new Error('Project not found');
    if (supabase) {
        try {
            const { data: insertedConversation, error: insertConversationError } = await supabase
                .from('conversations')
                .insert([
                {
                    type: 'project',
                    title: title.trim() || `${project.title} chat`,
                    project_id: projectId,
                    created_by: actor.id,
                    last_message_at: new Date().toISOString(),
                },
            ])
                .select()
                .single();
            if (insertConversationError)
                throw insertConversationError;
            let memberIds = [];
            const { data: projectMembers } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', projectId);
            memberIds = (projectMembers || []).map((member) => member.user_id);
            memberIds = Array.from(new Set([actor.id, ...memberIds]));
            if (memberIds.length > 0) {
                const { error: insertMembersError } = await supabase
                    .from('conversation_members')
                    .insert(memberIds.map((memberId) => ({ conversation_id: insertedConversation.id, user_id: memberId })));
                if (insertMembersError)
                    throw insertMembersError;
            }
            return {
                id: insertedConversation.id,
                type: insertedConversation.type,
                title: insertedConversation.title || undefined,
                projectId: insertedConversation.project_id || undefined,
                teamId: insertedConversation.team_id || undefined,
                createdBy: insertedConversation.created_by,
                participants: memberIds,
                lastMessageAt: insertedConversation.last_message_at,
                createdAt: insertedConversation.created_at,
            };
        }
        catch {
            // Fall through to local mode
        }
    }
    const nextConversation = {
        id: `conv${Date.now()}${Math.random().toString(16).slice(2, 5)}`,
        type: 'project',
        title: title.trim() || `${project.title} chat`,
        projectId,
        participants: [...new Set([actor.id, ...project.assignedUsers])],
        createdBy: actor.id,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
    };
    conversations = [nextConversation, ...conversations];
    saveConversations(conversations);
    emitCommunicationEvent({ type: 'conversation:update', conversationId: nextConversation.id });
    return nextConversation;
}
export async function getConversationMessages(conversationId) {
    const actor = await requirePermission('chat:view');
    if (supabase) {
        try {
            const { data: membership } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('conversation_id', conversationId)
                .eq('user_id', actor.id)
                .maybeSingle();
            if (!membership)
                throw new AuthorizationError('Forbidden');
            const { data: messageRows, error: messageError } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });
            if (messageError)
                throw messageError;
            const messageIds = (messageRows || []).map((row) => row.id);
            const { data: receiptRows } = messageIds.length
                ? await supabase.from('message_receipts').select('message_id,user_id,seen_at').in('message_id', messageIds)
                : { data: [] };
            return (messageRows || []).map((row) => ({
                id: row.id,
                conversationId: row.conversation_id,
                senderId: row.sender_id,
                content: row.content,
                type: row.message_type,
                fileUrl: row.file_url || undefined,
                mentions: row.mentions || [],
                status: row.delivery_status,
                seenBy: (receiptRows || [])
                    .filter((receipt) => receipt.message_id === row.id && Boolean(receipt.seen_at))
                    .map((receipt) => receipt.user_id),
                createdAt: row.created_at,
            }));
        }
        catch {
            // Fall through to local mode
        }
    }
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation || !canAccessConversation(actor, conversation))
        throw new AuthorizationError('Forbidden');
    return chatMessages
        .filter((message) => message.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
export async function sendMessage(input) {
    const actor = await requirePermission('chat:send');
    if (supabase) {
        try {
            const { data: conversationRow } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', input.conversationId)
                .single();
            if (!conversationRow)
                throw new Error('Conversation not found');
            const { data: membershipRows } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', input.conversationId);
            const participants = (membershipRows || []).map((row) => row.user_id);
            const conversation = {
                id: conversationRow.id,
                type: conversationRow.type,
                title: conversationRow.title || undefined,
                projectId: conversationRow.project_id || undefined,
                teamId: conversationRow.team_id || undefined,
                createdBy: conversationRow.created_by,
                participants,
                lastMessageAt: conversationRow.last_message_at,
                createdAt: conversationRow.created_at,
            };
            if (!canSendMessage(actor, conversation))
                throw new AuthorizationError('Forbidden');
            const content = input.content.trim();
            if (!content && !input.fileUrl)
                throw new Error('Message cannot be empty');
            const mentions = extractMentionUserIds(content).filter((id) => id !== actor.id);
            const { data: insertedMessage, error: insertMessageError } = await supabase
                .from('messages')
                .insert([
                {
                    conversation_id: input.conversationId,
                    sender_id: actor.id,
                    content,
                    message_type: input.type || 'text',
                    file_url: input.fileUrl || null,
                    mentions,
                    delivery_status: 'delivered',
                },
            ])
                .select()
                .single();
            if (insertMessageError)
                throw insertMessageError;
            await supabase.from('conversations').update({ last_message_at: insertedMessage.created_at }).eq('id', input.conversationId);
            await supabase.from('message_receipts').upsert([
                { message_id: insertedMessage.id, user_id: actor.id, delivered_at: insertedMessage.created_at, seen_at: insertedMessage.created_at },
            ]);
            participants
                .filter((participantId) => participantId !== actor.id)
                .forEach((participantId) => {
                createNotification(participantId, 'New message', `${actor.name}: ${content || 'sent an attachment'}`, 'message');
            });
            mentions.forEach((mentionedUserId) => {
                createNotification(mentionedUserId, 'You were mentioned', `${actor.name} mentioned you in chat`, 'mention');
            });
            const mapped = {
                id: insertedMessage.id,
                conversationId: insertedMessage.conversation_id,
                senderId: insertedMessage.sender_id,
                content: insertedMessage.content,
                type: insertedMessage.message_type,
                fileUrl: insertedMessage.file_url || undefined,
                mentions: insertedMessage.mentions || [],
                status: insertedMessage.delivery_status,
                seenBy: [actor.id],
                createdAt: insertedMessage.created_at,
            };
            emitCommunicationEvent({ type: 'message:new', conversationId: input.conversationId, message: mapped });
            emitCommunicationEvent({ type: 'conversation:update', conversationId: input.conversationId });
            return mapped;
        }
        catch {
            // Fall through to local mode
        }
    }
    const conversation = conversations.find((item) => item.id === input.conversationId);
    if (!conversation)
        throw new Error('Conversation not found');
    if (!canSendMessage(actor, conversation))
        throw new AuthorizationError('Forbidden');
    const content = input.content.trim();
    if (!content && !input.fileUrl)
        throw new Error('Message cannot be empty');
    const mentions = extractMentionUserIds(content).filter((id) => id !== actor.id);
    const message = {
        id: `msg${Date.now()}${Math.random().toString(16).slice(2, 5)}`,
        conversationId: conversation.id,
        senderId: actor.id,
        content,
        type: input.type || 'text',
        fileUrl: input.fileUrl,
        mentions,
        status: 'delivered',
        seenBy: [actor.id],
        createdAt: new Date().toISOString(),
    };
    chatMessages = [...chatMessages, message];
    saveMessages(chatMessages);
    conversations = conversations.map((item) => item.id === conversation.id ? { ...item, lastMessageAt: message.createdAt } : item);
    saveConversations(conversations);
    conversation.participants
        .filter((participantId) => participantId !== actor.id)
        .forEach((participantId) => {
        createNotification(participantId, 'New message', `${actor.name}: ${content || 'sent an attachment'}`, 'message');
    });
    mentions.forEach((mentionedUserId) => {
        createNotification(mentionedUserId, 'You were mentioned', `${actor.name} mentioned you in chat`, 'mention');
    });
    emitCommunicationEvent({ type: 'message:new', conversationId: conversation.id, message });
    emitCommunicationEvent({ type: 'conversation:update', conversationId: conversation.id });
    return message;
}
export async function markMessagesSeen(conversationId) {
    const actor = await requirePermission('chat:view');
    if (supabase) {
        try {
            const { data: messageRows } = await supabase
                .from('messages')
                .select('id,sender_id')
                .eq('conversation_id', conversationId);
            if (!messageRows || messageRows.length === 0)
                return;
            const nowIso = new Date().toISOString();
            const receipts = messageRows.map((row) => ({
                message_id: row.id,
                user_id: actor.id,
                delivered_at: nowIso,
                seen_at: nowIso,
            }));
            await supabase.from('message_receipts').upsert(receipts);
            emitCommunicationEvent({ type: 'conversation:update', conversationId });
            return;
        }
        catch {
            // Fall through to local mode
        }
    }
    chatMessages = chatMessages.map((message) => {
        if (message.conversationId !== conversationId)
            return message;
        if (message.seenBy.includes(actor.id))
            return { ...message, status: 'seen' };
        return { ...message, seenBy: [...message.seenBy, actor.id], status: 'seen' };
    });
    saveMessages(chatMessages);
    emitCommunicationEvent({ type: 'conversation:update', conversationId });
}
export async function setTypingIndicator(conversationId, isTyping) {
    const actor = await requirePermission('chat:send');
    const existing = typingStates.find((typingState) => typingState.conversationId === conversationId && typingState.userId === actor.id);
    if (existing) {
        typingStates = typingStates.map((typingState) => typingState.conversationId === conversationId && typingState.userId === actor.id
            ? { ...typingState, isTyping, updatedAt: new Date().toISOString() }
            : typingState);
    }
    else {
        typingStates = [
            ...typingStates,
            { conversationId, userId: actor.id, isTyping, updatedAt: new Date().toISOString() },
        ];
    }
    saveTypingStates(typingStates);
    emitCommunicationEvent({ type: 'typing:update', conversationId });
}
export async function getTypingUsers(conversationId) {
    const actor = await requirePermission('chat:view');
    const now = Date.now();
    return typingStates
        .filter((typingState) => typingState.conversationId === conversationId &&
        typingState.userId !== actor.id &&
        typingState.isTyping &&
        now - new Date(typingState.updatedAt).getTime() < 4000)
        .map((typingState) => typingState.userId);
}
export async function getActiveCalls() {
    const actor = await requireUser();
    if (supabase) {
        try {
            const { data: membershipRows } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('user_id', actor.id);
            const conversationIds = (membershipRows || []).map((row) => row.conversation_id);
            if (conversationIds.length === 0)
                return [];
            const { data: callRows } = await supabase
                .from('calls')
                .select('*')
                .in('conversation_id', conversationIds)
                .in('status', ['ringing', 'ongoing'])
                .order('started_at', { ascending: false });
            const { data: participantRows } = await supabase
                .from('conversation_members')
                .select('conversation_id,user_id')
                .in('conversation_id', conversationIds);
            return (callRows || []).map((row) => ({
                id: row.id,
                conversationId: row.conversation_id,
                initiatedBy: row.initiated_by,
                participants: (participantRows || [])
                    .filter((participant) => participant.conversation_id === row.conversation_id)
                    .map((participant) => participant.user_id),
                type: row.call_type,
                status: row.status,
                startedAt: row.started_at,
                endedAt: row.ended_at || undefined,
            }));
        }
        catch {
            // Fall through to local mode
        }
    }
    return callSessions.filter((session) => session.status !== 'ended' &&
        session.participants.includes(actor.id) &&
        (hasPermission(actor.role, 'calls:join') || actor.role === 'ADMIN'));
}
export async function startCall(conversationId, type) {
    const actor = await requireUser();
    if (!hasPermission(actor.role, 'calls:initiate')) {
        throw new AuthorizationError('Only PROJECT_MANAGER and ADMIN can initiate calls');
    }
    if (supabase) {
        try {
            const { data: conversationRow } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', conversationId)
                .single();
            if (!conversationRow)
                throw new Error('Conversation not found');
            const { data: membershipRows } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', conversationId);
            const participants = (membershipRows || []).map((row) => row.user_id);
            const conversation = {
                id: conversationRow.id,
                type: conversationRow.type,
                title: conversationRow.title || undefined,
                projectId: conversationRow.project_id || undefined,
                teamId: conversationRow.team_id || undefined,
                createdBy: conversationRow.created_by,
                participants,
                lastMessageAt: conversationRow.last_message_at,
                createdAt: conversationRow.created_at,
            };
            if (!canAccessConversation(actor, conversation))
                throw new AuthorizationError('Forbidden');
            const { data: insertedCall, error: insertCallError } = await supabase
                .from('calls')
                .insert([
                {
                    conversation_id: conversationId,
                    initiated_by: actor.id,
                    call_type: type,
                    status: 'ringing',
                },
            ])
                .select()
                .single();
            if (insertCallError)
                throw insertCallError;
            await supabase
                .from('call_participants')
                .upsert(participants.map((participantId) => ({ call_id: insertedCall.id, user_id: participantId })));
            participants
                .filter((participantId) => participantId !== actor.id)
                .forEach((participantId) => {
                createNotification(participantId, 'Incoming call', `${actor.name} started a ${type} call`, 'call');
            });
            const mapped = {
                id: insertedCall.id,
                conversationId: insertedCall.conversation_id,
                initiatedBy: insertedCall.initiated_by,
                participants,
                type: insertedCall.call_type,
                status: insertedCall.status,
                startedAt: insertedCall.started_at,
                endedAt: insertedCall.ended_at || undefined,
            };
            emitCommunicationEvent({ type: 'call:update', call: mapped });
            return mapped;
        }
        catch {
            // Fall through to local mode
        }
    }
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation || !canAccessConversation(actor, conversation))
        throw new AuthorizationError('Forbidden');
    const nextCall = {
        id: `call${Date.now()}${Math.random().toString(16).slice(2, 5)}`,
        conversationId,
        initiatedBy: actor.id,
        participants: [...new Set(conversation.participants)],
        type,
        status: 'ringing',
        startedAt: new Date().toISOString(),
    };
    callSessions = [nextCall, ...callSessions];
    saveCallSessions(callSessions);
    nextCall.participants
        .filter((participantId) => participantId !== actor.id)
        .forEach((participantId) => {
        createNotification(participantId, 'Incoming call', `${actor.name} started a ${type} call`, 'call');
    });
    emitCommunicationEvent({ type: 'call:update', call: nextCall });
    return nextCall;
}
export async function joinCall(callId) {
    const actor = await requirePermission('calls:join');
    if (supabase) {
        try {
            const { data: currentRow, error: currentError } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();
            if (currentError || !currentRow)
                throw new Error('Call not found');
            const { data: participantRows } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', currentRow.conversation_id);
            const participants = (participantRows || []).map((row) => row.user_id);
            if (!participants.includes(actor.id))
                throw new AuthorizationError('Forbidden');
            const { data: updatedRow, error: updateError } = await supabase
                .from('calls')
                .update({ status: 'ongoing' })
                .eq('id', callId)
                .select()
                .single();
            if (updateError)
                throw updateError;
            await supabase
                .from('call_participants')
                .upsert([{ call_id: callId, user_id: actor.id, joined_at: new Date().toISOString() }]);
            const mapped = {
                id: updatedRow.id,
                conversationId: updatedRow.conversation_id,
                initiatedBy: updatedRow.initiated_by,
                participants,
                type: updatedRow.call_type,
                status: updatedRow.status,
                startedAt: updatedRow.started_at,
                endedAt: updatedRow.ended_at || undefined,
            };
            emitCommunicationEvent({ type: 'call:update', call: mapped });
            return mapped;
        }
        catch {
            // Fall through to local mode
        }
    }
    const current = callSessions.find((session) => session.id === callId);
    if (!current)
        throw new Error('Call not found');
    if (!current.participants.includes(actor.id))
        throw new AuthorizationError('Forbidden');
    const updated = {
        ...current,
        status: 'ongoing',
        participants: Array.from(new Set([...current.participants, actor.id])),
    };
    callSessions = callSessions.map((session) => (session.id === callId ? updated : session));
    saveCallSessions(callSessions);
    emitCommunicationEvent({ type: 'call:update', call: updated });
    return updated;
}
export async function endCall(callId) {
    const actor = await requireUser();
    if (supabase) {
        try {
            const { data: currentRow } = await supabase.from('calls').select('*').eq('id', callId).single();
            if (!currentRow)
                return;
            const { data: participantRows } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', currentRow.conversation_id);
            const participants = (participantRows || []).map((row) => row.user_id);
            if (!participants.includes(actor.id) && actor.role !== 'ADMIN')
                throw new AuthorizationError('Forbidden');
            const { data: updatedRow, error: updateError } = await supabase
                .from('calls')
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('id', callId)
                .select()
                .single();
            if (updateError)
                throw updateError;
            emitCommunicationEvent({
                type: 'call:update',
                call: {
                    id: updatedRow.id,
                    conversationId: updatedRow.conversation_id,
                    initiatedBy: updatedRow.initiated_by,
                    participants,
                    type: updatedRow.call_type,
                    status: updatedRow.status,
                    startedAt: updatedRow.started_at,
                    endedAt: updatedRow.ended_at || undefined,
                },
            });
            return;
        }
        catch {
            // Fall through to local mode
        }
    }
    const current = callSessions.find((session) => session.id === callId);
    if (!current)
        return;
    if (!current.participants.includes(actor.id) && actor.role !== 'ADMIN')
        throw new AuthorizationError('Forbidden');
    const updated = {
        ...current,
        status: 'ended',
        endedAt: new Date().toISOString(),
    };
    callSessions = callSessions.map((session) => (session.id === callId ? updated : session));
    saveCallSessions(callSessions);
    emitCommunicationEvent({ type: 'call:update', call: updated });
}
export async function searchMessages(query) {
    const actor = await requirePermission('chat:view');
    const trimmed = query.trim().toLowerCase();
    if (!trimmed)
        return [];
    if (supabase) {
        try {
            const { data: membershipRows } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('user_id', actor.id);
            const conversationIds = (membershipRows || []).map((row) => row.conversation_id);
            if (conversationIds.length === 0)
                return [];
            const { data: messageRows } = await supabase
                .from('messages')
                .select('*')
                .in('conversation_id', conversationIds)
                .ilike('content', `%${trimmed}%`)
                .order('created_at', { ascending: false });
            return (messageRows || []).map((row) => ({
                id: row.id,
                conversationId: row.conversation_id,
                senderId: row.sender_id,
                content: row.content,
                type: row.message_type,
                fileUrl: row.file_url || undefined,
                mentions: row.mentions || [],
                status: row.delivery_status,
                seenBy: [],
                createdAt: row.created_at,
            }));
        }
        catch {
            // Fall through to local mode
        }
    }
    const accessibleConversationIds = conversations
        .filter((conversation) => canAccessConversation(actor, conversation))
        .map((conversation) => conversation.id);
    return chatMessages
        .filter((message) => accessibleConversationIds.includes(message.conversationId) &&
        message.content.toLowerCase().includes(trimmed))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

