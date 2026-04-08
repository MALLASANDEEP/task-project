/**
 * API Service Layer
 * Connected to Supabase backend with PostgreSQL + Row Level Security
 */
import { supabase } from '@/lib/supabase';
import { AuthorizationError, hasPermission } from '@/lib/rbac';
let activeUserId = null;
const typingStates = [];
function ensureSupabase() {
    if (!supabase)
        throw new Error('Supabase client not initialized');
}
async function writeAudit(action, targetType, targetId) {
    if (!activeUserId)
        return;
    // Audit logs are stored in Supabase, logged via database trigger or separate table
    console.log('[AUDIT]', { actor: activeUserId, action, targetType, targetId });
}
async function requireUser() {
    if (!activeUserId)
        throw new AuthorizationError('Authentication required');
    ensureSupabase();
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeUserId)
        .single();
    if (error || !data)
        throw new AuthorizationError('Authentication required');
    return { id: data.id, name: data.name, email: data.email, role: data.role, status: data.status, createdAt: data.created_at };
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
async function createNotification(userId, title, message, type) {
    ensureSupabase();
    const { data, error } = await supabase.from('notifications').insert([{
        user_id: userId,
        title,
        message,
        type,
        read: false,
    }]).select().single();
    if (error)
        throw error;
    return data;
}
async function findUserByMention(mentionName) {
    ensureSupabase();
    const normalized = mentionName.trim().toLowerCase().replace(/\s+/g, '');
    const { data, error } = await supabase.from('profiles').select('*');
    if (error)
        throw error;
    return data.find((u) => u.name.toLowerCase().replace(/\s+/g, '') === normalized);
}
async function extractMentionUserIds(content) {
    const mentionMatches = content.match(/@[a-zA-Z0-9_.-]+/g) || [];
    const ids = await Promise.all(mentionMatches.map(async (token) => {
        const user = await findUserByMention(token.replace('@', ''));
        return user?.id;
    }));
    return Array.from(new Set(ids.filter((id) => Boolean(id))));
}
function canAccessConversation(actor, conversation) {
    if (actor.role === 'ADMIN')
        return true;
    return conversation.participants.includes(actor.id);
}
function canSendMessage(actor, conversation) {
    if (!hasPermission(actor.role, 'chat:send'))
        return false;
    return canAccessConversation(actor, conversation);
}
export async function getAuditLogs() {
    await requirePermission('users:manage');
    // Fetch audit logs from Supabase if available, for now return empty
    return [];
}
// ── Auth ──────────────────────────────────────────────
export async function login(email, password) {
    ensureSupabase();
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            console.error('[LOGIN] Auth error:', error.message);
            return null;
        }
        if (!data?.user) {
            console.error('[LOGIN] No user returned from auth');
            return null;
        }
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        if (profileError) {
            console.error('[LOGIN] Profile fetch error:', profileError.message);
            return null;
        }
        if (!profile || profile.status === 'inactive') {
            console.error('[LOGIN] Profile not found or inactive');
            return null;
        }
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
    } catch (err) {
        console.error('[LOGIN] Exception:', err);
        return null;
    }
}
export async function register(name, email, password) {
    ensureSupabase();
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
        if (error) {
            console.error('[REGISTER] Signup error:', error.message);
            return null;
        }
        if (!data?.user) {
            console.error('[REGISTER] No user returned from signup');
            return null;
        }
        // Wait for profile trigger to create profile
        await new Promise(resolve => setTimeout(resolve, 500));
        let profile = null;
        // Try to fetch existing profile
        const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        if (!profileError && existingProfile) {
            profile = existingProfile;
        } else {
            // Create profile if trigger didn't work
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
            if (insertError) {
                console.error('[REGISTER] Profile creation error:', insertError.message);
                return null;
            }
            profile = newProfile;
        }
        if (!profile) {
            console.error('[REGISTER] Profile is null');
            return null;
        }
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
    } catch (err) {
        console.error('[REGISTER] Exception:', err);
        return null;
    }
}
export async function restoreSession() {
    if (!supabase)
        return null;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session)
        return null;
    const session = sessionData.session;
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    if (profileError || !profile)
        return null;
    const user = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        createdAt: profile.created_at,
    };
    activeUserId = user.id;
    return { user, token: session.access_token || '' };
}
export async function logout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
    activeUserId = null;
}
// ── Users ─────────────────────────────────────────────
export async function getUsers() {
    await requireUser();
    ensureSupabase();
    const { data, error } = await supabase.from('profiles').select('*');
    if (error)
        throw error;
    return data.map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, status: p.status, createdAt: p.created_at }));
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
    ensureSupabase();
    const { data, error } = await supabase.from('projects').select('*');
    if (error)
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
    ensureSupabase();
    if (actor.role === 'TEAM_MEMBER') {
        const { data, error } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', actor.id);
        if (error)
            throw error;
        const projectIds = data?.map(pm => pm.project_id) || [];
        if (projectIds.length === 0)
            return [];
        const { data: projects, error: projError } = await supabase
            .from('projects')
            .select('*')
            .in('id', projectIds);
        if (projError)
            throw projError;
        return projects.map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: [] }));
    }
    return getProjects();
}
export async function createProject(data) {
    const actor = await requirePermission('projects:create');
    ensureSupabase();
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
    ensureSupabase();
    const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.deadline && { deadline: data.deadline }), ...(data.priority && { priority: data.priority }) };
    const { data: updated, error } = await supabase.from('projects').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;
    await writeAudit('UPDATE_PROJECT', 'project', id);
    return { id: updated.id, title: updated.title, description: updated.description, createdBy: updated.created_by, createdAt: updated.created_at, deadline: updated.deadline, priority: updated.priority, assignedUsers: [] };
}
export async function deleteProject(id) {
    await requirePermission('projects:delete');
    ensureSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error)
        throw error;
    await writeAudit('DELETE_PROJECT', 'project', id);
}
export async function getProjectMembers(projectId) {
    await requireUser();
    ensureSupabase();
    try {
        const { data, error } = await supabase.from('project_members').select('*').eq('project_id', projectId);
        if (error) {
            console.warn('project_members table may not exist:', error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('Error fetching project members:', err);
        return [];
    }
}
export async function assignProjectManager(projectId, userId) {
    const actor = await requirePermission('projects:update');
    ensureSupabase();
    try {
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project)
            throw new Error('Project not found');
        const { data: user } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!user)
            throw new Error('User not found');
        // Try to delete existing manager, but don't fail if none exists or table missing
        try {
            await supabase.from('project_members').delete().eq('project_id', projectId).eq('role', 'manager');
        } catch (deleteError) {
            console.log('Delete previous manager skipped:', deleteError?.message);
        }
        const { error: insertError } = await supabase.from('project_members').insert([{
            project_id: projectId,
            user_id: userId,
            role: 'manager',
            assigned_at: new Date().toISOString()
        }]);
        if (insertError) {
            console.warn('Could not save project manager to DB (table may not exist):', insertError.message);
        }
        await createNotification(userId, 'Project Manager Role', `You have been assigned as manager for "${project.title}"`, 'role_assigned');
        await writeAudit('ASSIGN_PROJECT_MANAGER', 'project', projectId);
    } catch (err) {
        console.error('Error assigning project manager:', err);
        throw err;
    }
}
export async function assignProjectMembers(projectId, userIds) {
    const actor = await requirePermission('projects:update');
    ensureSupabase();
    try {
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project)
            throw new Error('Project not found');
        
        // Try to get existing members - handle table not existing
        let existingIds = [];
        try {
            const { data: existingMembers } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', projectId)
                .eq('role', 'member');
            existingIds = existingMembers?.map(m => m.user_id) || [];
        } catch (err) {
            console.log('Could not query project_members (table may not exist)');
            existingIds = [];
        }
        
        const toAdd = userIds.filter(id => !existingIds.includes(id));
        const toRemove = existingIds.filter(id => !userIds.includes(id));
        
        // Remove old members
        if (toRemove.length > 0) {
            try {
                await supabase
                    .from('project_members')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('role', 'member')
                    .in('user_id', toRemove);
            } catch (err) {
                console.log('Delete members error:', err?.message);
            }
        }
        
        // Add new members
        if (toAdd.length > 0) {
            try {
                await supabase.from('project_members').insert(
                    toAdd.map(userId => ({
                        project_id: projectId,
                        user_id: userId,
                        role: 'member',
                        assigned_at: new Date().toISOString()
                    }))
                );
            } catch (err) {
                console.warn('Could not save project members (table may not exist):', err?.message);
            }
            
            // Send notifications even if DB insert fails
            await Promise.all(toAdd.map(userId => 
                createNotification(userId, 'Project Assignment', `You have been assigned to project "${project.title}"`, 'project_assigned')
            ));
        }
        
        await writeAudit('ASSIGN_PROJECT_MEMBERS', 'project', projectId);
    } catch (err) {
        console.error('Error assigning project members:', err?.message);
    }
}
// ── Teams ────────────────────────────────────────────
export async function getTeams() {
    await requireUser();
    ensureSupabase();
    const { data, error } = await supabase.from('teams').select('*');
    if (error)
        throw error;
    return data.map(t => ({ id: t.id, name: t.name, description: t.description, createdBy: t.created_by, members: [], projects: [], createdAt: t.created_at }));
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
    ensureSupabase();
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
    ensureSupabase();
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
    ensureSupabase();
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error)
        throw error;
    await writeAudit('DELETE_TEAM', 'team', id);
}
// ── Tasks ─────────────────────────────────────────────
export async function getTasks() {
    const actor = await requirePermission('tasks:view');
    ensureSupabase();
    let query = supabase.from('tasks').select('*');
    if (actor.role === 'TEAM_MEMBER') {
        query = query.eq('assigned_to', actor.id);
    }
    const { data, error } = await query;
    if (error || !data)
        throw error || new Error('Failed to fetch tasks');
    return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
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
    ensureSupabase();
    const { data, error } = await supabase.from('tasks').select('*').eq('assigned_to', actor.role === 'TEAM_MEMBER' ? actor.id : userId);
    if (error || !data)
        throw error || new Error('Failed to fetch tasks');
    return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
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
    ensureSupabase();
    const { data: newTask, error } = await supabase
        .from('tasks')
        .insert([{ title: data.title, description: data.description, project_id: data.projectId, assigned_to: data.assignedTo, created_by: actor.id, status: data.status, priority: data.priority, due_date: data.dueDate }])
        .select()
        .single();
    if (error)
        throw error;
    if (newTask.assigned_to !== actor.id) {
        await createNotification(newTask.assigned_to, 'New Task Assigned', `You have been assigned "${newTask.title}"`, 'task_assigned');
    }
    await writeAudit('CREATE_TASK', 'task', newTask.id);
    return { id: newTask.id, title: newTask.title, description: newTask.description, projectId: newTask.project_id, assignedTo: newTask.assigned_to, createdBy: newTask.created_by, status: newTask.status, priority: newTask.priority, dueDate: newTask.due_date, comments: [], createdAt: newTask.created_at };
}
export async function updateTask(id, data) {
    const actor = await requireUser();
    const { data: fetchedCurrent, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (fetchError || !fetchedCurrent)
        throw new Error('Task not found');
    const current = { id: fetchedCurrent.id, title: fetchedCurrent.title, description: fetchedCurrent.description, projectId: fetchedCurrent.project_id, assignedTo: fetchedCurrent.assigned_to, createdBy: fetchedCurrent.created_by, status: fetchedCurrent.status, priority: fetchedCurrent.priority, dueDate: fetchedCurrent.due_date, comments: [], createdAt: fetchedCurrent.created_at };
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
    const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.assignedTo && { assigned_to: data.assignedTo }), ...(data.status && { status: data.status }), ...(data.priority && { priority: data.priority }), ...(data.dueDate && { due_date: data.dueDate }) };
    const { data: updated, error } = await supabase.from('tasks').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;
    if (data.assignedTo && data.assignedTo !== current.assignedTo) {
        await createNotification(data.assignedTo, 'Task Reassigned', `You were assigned "${updated.title}"`, 'task_assigned');
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
    ensureSupabase();
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
    const mentionUserIds = (await extractMentionUserIds(content)).filter((id) => id !== userId);
    await Promise.all(mentionUserIds.map((mentionedId) => createNotification(mentionedId, 'You were mentioned', `Mentioned in task discussion: "${task.title}"`, 'mention')));
    await writeAudit('ADD_COMMENT', 'comment', comment.id);
    return { id: comment.id, taskId: comment.task_id, userId: comment.user_id, content: comment.content, createdAt: comment.created_at };
}
// ── Notifications ─────────────────────────────────────
export async function getNotificationsForUser(userId) {
    const actor = await requireUser();
    if (actor.id !== userId && actor.role !== 'ADMIN')
        throw new AuthorizationError('Forbidden');
    ensureSupabase();
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId);
    if (error || !data)
        throw error;
    return data.map(n => ({ id: n.id, userId: n.user_id, title: n.title, message: n.message, read: n.read, type: n.type, createdAt: n.created_at }));
}
export async function markNotificationRead(id) {
    const actor = await requireUser();
    if (actor.role === 'VIEWER')
        throw new AuthorizationError('VIEWER role is read-only');
    ensureSupabase();
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
    ensureSupabase();
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
    if (error)
        throw error;
}
// ── Communication (Chat + Calls) ─────────────────────
export async function getConversations() {
    const actor = await requirePermission('chat:view');
    ensureSupabase();
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
    ensureSupabase();
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
    const mentions = (await extractMentionUserIds(content)).filter((id) => id !== actor.id);
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
    await Promise.all(participants
        .filter((participantId) => participantId !== actor.id)
        .map((participantId) => createNotification(participantId, 'New message', `${actor.name}: ${content || 'sent an attachment'}`, 'message')));
    await Promise.all(mentions.map((mentionedUserId) => createNotification(mentionedUserId, 'You were mentioned', `${actor.name} mentioned you in chat`, 'mention')));
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
export async function markMessagesSeen(conversationId) {
    const actor = await requirePermission('chat:view');
    ensureSupabase();
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
    ensureSupabase();
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
    await Promise.all(participants
        .filter((participantId) => participantId !== actor.id)
        .map((participantId) => createNotification(participantId, 'Incoming call', `${actor.name} started a ${type} call`, 'call')));
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
}
export async function endCall(callId) {
    const actor = await requireUser();
    ensureSupabase();
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
}
export async function searchMessages(query) {
    const actor = await requirePermission('chat:view');
    const trimmed = query.trim().toLowerCase();
    if (!trimmed)
        return [];
    ensureSupabase();
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
// ── Stats (Admin) ─────────────────────────────────────
export async function getDashboardStats() {
    await requirePermission('dashboard:view');
    ensureSupabase();
    const { data: projects, error: projectError } = await supabase.from('projects').select('id');
    if (projectError)
        throw projectError;
    const { data: tasks, error: taskError } = await supabase.from('tasks').select('id, status');
    if (taskError)
        throw taskError;
    const { data: activeUsers, error: activeUsersError } = await supabase.from('profiles').select('id').eq('status', 'active');
    if (activeUsersError)
        throw activeUsersError;
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

