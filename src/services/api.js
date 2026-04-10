/**
 * API Service Layer
 * Connected to Supabase backend with PostgreSQL + Row Level Security
 */
import { supabase } from '@/lib/supabase';
import { AuthorizationError, hasPermission, normalizeRole, toDbRole } from '@/lib/rbac';
import { socketManager } from '@/lib/socketManager';
let activeUserId = null;
const CALLS_ENABLED = import.meta.env.VITE_ENABLE_CALLS !== 'false';
let typingStates = [];
let projects = [];
let conversations = [];
let chatMessages = [];
let callSessions = [];
let callsFeatureUnavailable = false;
function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function shouldRetry(error) {
    if (!error)
        return false;
    const status = Number(error.status || error.code || 0);
    if ([408, 425, 429, 500, 502, 503, 504].includes(status))
        return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('network') ||
        message.includes('timeout') ||
        message.includes('temporarily') ||
        message.includes('fetch');
}
function isMissingRelationError(error, relationName) {
    if (!error)
        return false;
    const code = String(error.code || error.status || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    if (code === '42p01')
        return true;
    return message.includes('does not exist') && message.includes(relationName.toLowerCase());
}
function markCallsFeatureUnavailable(error) {
    if (isMissingRelationError(error, 'calls')) {
        callsFeatureUnavailable = true;
        console.warn('[CALLS] calls table not available. Calls feature disabled.');
        return true;
    }
    if (isMissingRelationError(error, 'call_participants')) {
        callsFeatureUnavailable = true;
        console.warn('[CALLS] call_participants table not available. Calls feature disabled.');
        return true;
    }
    return false;
}
async function withRetry(operation, options = {}) {
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 250;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await operation();
        }
        catch (error) {
            if (attempt >= retries || !shouldRetry(error)) {
                throw error;
            }
            await sleep(baseDelayMs * (attempt + 1));
        }
    }
    throw new Error('Retry loop terminated unexpectedly');
}
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
function mapNotificationRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        read: row.read,
        createdAt: row.created_at,
        linkPath: row.link_path || undefined,
    };
}
function mapRoleFromDb(role) {
    if (!role)
        return role;
    // Keep VIEWER compatibility for any stale records from older schemas.
    if (role === 'VIEWER')
        return 'TEAM_MEMBER';
    return role;
}
function mapRoleToDb(role) {
    const normalized = normalizeRole(role);
    return toDbRole(normalized);
}
function mapProfileRow(profile) {
    return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: mapRoleFromDb(profile.role),
        status: profile.status,
        avatarUrl: profile.avatar_url || null,
        createdAt: profile.created_at,
    };
}
async function requireUser() {
    if (!activeUserId)
        throw new AuthorizationError('Authentication required');
    ensureSupabase();
    const { data, error } = await withRetry(() => supabase
        .from('profiles')
        .select('*')
        .eq('id', activeUserId)
        .maybeSingle());
    if (error || !data)
        throw new AuthorizationError('Authentication required');
    return mapProfileRow(data);
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
        throw new AuthorizationError('TEAM_LEADER cannot move task status backwards');
    }
}
export function setActiveUserId(userId) {
    activeUserId = userId;
}
const commListeners = new Set();
function emitCommunicationEvent(event) {
    commListeners.forEach((listener) => listener(event));
}
let socketCallBridgeRegistered = false;
function registerSocketCallBridge() {
    if (socketCallBridgeRegistered)
        return;
    socketCallBridgeRegistered = true;
    const forwardCallUpdate = (status) => (data) => emitCommunicationEvent({
        type: 'call:update',
        callId: data?.callId,
        call: data?.callId
            ? {
                id: data.callId,
                status,
                type: data.type || data.callType || 'audio',
                participants: data.participants || [],
                initiatedBy: data.initiatorId || data.acceptedBy || data.endedBy || null,
                conversationId: data.conversationId,
            }
            : null,
    });
    socketManager.on('call:ringing', forwardCallUpdate('ringing'));
    socketManager.on('call:start', forwardCallUpdate('ongoing'));
    socketManager.on('call:accepted', forwardCallUpdate('ongoing'));
    socketManager.on('call:rejected', forwardCallUpdate('ended'));
    socketManager.on('call:ended', forwardCallUpdate('ended'));
}
registerSocketCallBridge();
export function subscribeCommunicationEvents(listener) {
    commListeners.add(listener);
    return () => {
        commListeners.delete(listener);
    };
}
export function subscribeToActiveCalls(onUpdate) {
    if (!CALLS_ENABLED) {
        return () => {
            // Calls feature disabled
        };
    }
    if (callsFeatureUnavailable) {
        return () => {
            // Calls disabled by schema detection
        };
    }
    if (supabase) {
        const channel = supabase
            .channel(`calls:${activeUserId || 'anon'}:${Date.now()}`)
            .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'calls',
        }, (payload) => {
            onUpdate({
                type: 'call:refresh',
                callId: payload.new?.id || payload.old?.id,
            });
        })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }
    return subscribeCommunicationEvents((event) => {
        if (event.type === 'call:update') {
            onUpdate({ type: 'call:update', call: event.call, callId: event.call?.id });
        }
    });
}
function mapMessageRow(row, receiptRows = []) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        receiverId: row.receiver_id || undefined,
        content: row.content,
        type: row.message_type,
        fileUrl: row.file_url || undefined,
        mentions: row.mentions || [],
        status: row.delivery_status,
        seenBy: (receiptRows || [])
            .filter((receipt) => receipt.message_id === row.id && Boolean(receipt.seen_at))
            .map((receipt) => receipt.user_id),
        createdAt: row.created_at,
    };
}
function mapCallRow(row, participantRows = []) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        initiatedBy: row.initiated_by || row.initiator_id,
        participants: participantRows
            .filter((participant) => participant.call_id === row.id)
            .map((participant) => participant.user_id),
        type: row.call_type,
        status: row.status || row.call_status || 'ringing',
        startedAt: row.started_at,
        endedAt: row.ended_at || undefined,
    };
}
function dedupeConversationsByScope(items, currentUserId) {
    const deduped = new Map();
    (items || []).forEach((conversation) => {
        let key = conversation.id;
        if (conversation.type === 'direct') {
            const otherId = (conversation.participants || []).find((participantId) => participantId !== currentUserId) || conversation.id;
            key = `direct:${otherId}`;
        }
        else if (conversation.type === 'project') {
            key = `project:${conversation.projectId || conversation.id}`;
        }
        else if (conversation.type === 'team') {
            key = `team:${conversation.teamId || conversation.title || conversation.id}`;
        }
        const existing = deduped.get(key);
        if (!existing) {
            deduped.set(key, conversation);
            return;
        }
        const existingTs = new Date(existing.lastMessageAt || existing.createdAt || 0).getTime();
        const currentTs = new Date(conversation.lastMessageAt || conversation.createdAt || 0).getTime();
        if (currentTs >= existingTs) {
            deduped.set(key, conversation);
        }
    });
    return Array.from(deduped.values()).sort((a, b) => {
        const aTs = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
        return bTs - aTs;
    });
}
function buildDirectMessageFilter(currentUserId, otherUserId) {
    return `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`;
}
function isMissingColumnError(error, columnName) {
    if (!error)
        return false;
    const code = String(error.code || error.status || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return code === '42703' || (message.includes('column') && message.includes(columnName.toLowerCase()) && message.includes('does not exist'));
}
export function subscribeToConversationMessages(conversationId, onMessage) {
    if (!conversationId) {
        return () => { };
    }
    if (supabase) {
        const channel = supabase
            .channel(`messages:${conversationId}:${activeUserId || 'anon'}:${Date.now()}`)
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
            const row = payload.new;
            if (!row || !row.id)
                return;
            const mapped = mapMessageRow(row, []);
            onMessage(mapped);
            emitCommunicationEvent({ type: 'message:new', conversationId, message: mapped });
            emitCommunicationEvent({ type: 'conversation:update', conversationId });
        })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }
    const unsubscribe = subscribeCommunicationEvents((event) => {
        if (event.type === 'message:new' && event.conversationId === conversationId) {
            onMessage(event.message);
        }
    });
    return unsubscribe;
}
function createNotification(userId, title, message, type, options = {}) {
    ensureSupabase();
    return supabase
        .from('notifications')
        .insert([{
            user_id: userId,
            title,
            message,
            type,
            read: false,
            link_path: options.linkPath || null,
        }])
        .select()
        .single()
        .then(({ data, error }) => {
        if (error)
            throw error;
        return mapNotificationRow(data);
    });
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
            .maybeSingle();
        if (profileError) {
            console.error('[LOGIN] Profile fetch error:', profileError.message);
            return null;
        }
        if (!profile || profile.status === 'inactive') {
            console.error('[LOGIN] Profile not found or inactive');
            return null;
        }
        const user = mapProfileRow(profile);
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
                    role: mapRoleToDb('TEAM_MEMBER')
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
                    role: mapRoleToDb('TEAM_MEMBER'),
                    status: 'active'
                }])
                .select()
                .single();
            if (insertError) {
                console.error('[REGISTER] Profile creation error:', insertError.message);
                return null;
            }
            else {
                profile = newProfile;
            }
        }
        if (!profile) {
            console.error('[REGISTER] Profile is null');
            return null;
        }
        const user = mapProfileRow(profile);
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
        .maybeSingle();
    if (profileError || !profile)
        return null;
    const user = mapProfileRow(profile);
    activeUserId = user.id;
    return { user, token: session.access_token || '' };
}
export async function logout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
    activeUserId = null;
}
export async function initiateGoogleSignIn() {
    ensureSupabase();
    // Use current origin to support any port/domain (task-project-3frx.onrender.com, task-project-3frx.onrender.com, production, etc.)
    const redirectUrl = `${window.location.origin}/auth/callback`;
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) {
            throw error;
        }
        return data;
    }
    catch (err) {
        console.error('[GOOGLE_SIGNIN] OAuth error:', err);
        throw new Error(String(err?.message || 'Failed to initiate Google sign-in. Ensure Google OAuth is configured in Supabase and the redirect URL matches your app origin.'));
    }
}
export async function ensureProfileAfterOAuth() {
    if (!activeUserId) {
        throw new Error('No authenticated user');
    }
    ensureSupabase();
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeUserId)
        .maybeSingle();
    if (error) {
        console.error('[OAUTH_PROFILE] Profile fetch error:', error.message);
        return null;
    }
    if (profile) {
        return mapProfileRow(profile);
    }
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser?.user) {
        throw new Error('Unable to fetch current user');
    }
    const user = authUser.user;
    const namePart = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
    const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{
            id: user.id,
            name: namePart,
            email: user.email || '',
            role: mapRoleToDb('TEAM_MEMBER'),
            status: 'active',
        }])
        .select()
        .single();
    if (insertError) {
        console.error('[OAUTH_PROFILE] Profile creation error:', insertError.message);
        return null;
    }
    return newProfile ? mapProfileRow(newProfile) : null;
}
export async function changePassword(currentPassword, newPassword) {
    const user = await requireUser();
    ensureSupabase();
    if (!currentPassword || !newPassword) {
        throw new Error('Current and new passwords are required');
    }
    if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters');
    }
    try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });
        if (signInError) {
            throw new Error('Current password is incorrect');
        }
    }
    catch (err) {
        throw new Error(String(err?.message || 'Failed to verify current password'));
    }
    try {
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword,
        });
        if (updateError) {
            throw updateError;
        }
    }
    catch (err) {
        throw new Error(String(err?.message || 'Failed to update password'));
    }
    await writeAudit('CHANGE_PASSWORD', 'user', user.id);
    return true;
}
export async function updateOwnProfile(data) {
    const actor = await requireUser();
    ensureSupabase();
    const nextName = typeof data?.name === 'string' ? data.name.trim() : '';
    const nextEmail = typeof data?.email === 'string' ? data.email.trim() : '';
    const updateData = {};
    if (nextName)
        updateData.name = nextName;
    if (nextEmail)
        updateData.email = nextEmail;
    if (Object.prototype.hasOwnProperty.call(data || {}, 'avatarUrl')) {
        updateData.avatar_url = data.avatarUrl || null;
    }
    if (!Object.keys(updateData).length) {
        return actor;
    }
    let updated = null;
    let { data: updatedData, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', actor.id)
        .select('*')
        .single();
    if (error && isMissingColumnError(error, 'avatar_url') && Object.prototype.hasOwnProperty.call(updateData, 'avatar_url')) {
        delete updateData.avatar_url;
        const fallbackResult = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', actor.id)
            .select('*')
            .single();
        updatedData = fallbackResult.data;
        error = fallbackResult.error;
    }
    if (error)
        throw error;
    updated = mapProfileRow(updatedData);
    if (Object.prototype.hasOwnProperty.call(data || {}, 'avatarUrl') && !Object.prototype.hasOwnProperty.call(updatedData || {}, 'avatar_url')) {
        updated.avatarUrl = data.avatarUrl || null;
    }
    if (nextEmail && nextEmail !== actor.email && supabase?.auth?.updateUser) {
        // Email updates can require confirmation; keep profile row as source of truth for immediate UI updates.
        await supabase.auth.updateUser({ email: nextEmail }).catch(() => undefined);
    }
    await writeAudit('UPDATE_SELF_PROFILE', 'user', actor.id);
    return updated;
}
// ── Users ─────────────────────────────────────────────
export async function getUsers() {
    await requireUser();
    ensureSupabase();
    const { data, error } = await supabase.from('profiles').select('*');
    if (error)
        throw error;
    return data.map((p) => mapProfileRow(p));
}
export async function getUserById(id) {
    const actor = await requireUser();
    if (actor.role !== 'ADMIN' && actor.id !== id)
        throw new AuthorizationError('Forbidden');
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error)
        return undefined;
    return data ? mapProfileRow(data) : undefined;
}
export async function createUser(data) {
    await requirePermission('users:manage');
    // Note: This should be handled via Supabase admin API or auth endpoint, not direct insert
    const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert([{ name: data.name, email: data.email, role: mapRoleToDb(data.role), status: data.status }])
        .select()
        .single();
    if (error)
        throw error;
    await writeAudit('CREATE_USER', 'user', newProfile.id);
    return mapProfileRow(newProfile);
}
export async function updateUser(id, data) {
    const actor = await requireUser();
    const { data: target, error: fetchError } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (fetchError || !target)
        throw new Error('User not found');
    if (actor.role === 'TEAM_MEMBER' && actor.id === id) {
        throw new AuthorizationError('TEAM_MEMBER role is read-only');
    }
    const isRoleChange = typeof data.role !== 'undefined' || typeof data.status !== 'undefined';
    if (isRoleChange && !hasPermission(actor.role, 'users:assign-role')) {
        throw new AuthorizationError('Only ADMIN can assign roles or status');
    }
    if (!hasPermission(actor.role, 'users:manage') && actor.id !== id) {
        throw new AuthorizationError('Forbidden');
    }
    const updateData = { ...(data.name && { name: data.name }), ...(data.role && { role: mapRoleToDb(data.role) }), ...(data.status && { status: data.status }) };
    const { data: updated, error } = await supabase.from('profiles').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;
    await writeAudit('UPDATE_USER', 'user', id);
    return mapProfileRow(updated);
}
export async function deleteUser(id) {
    const actor = await requirePermission('users:manage');
    if (actor.id === id) {
        throw new AuthorizationError('You cannot delete your own account');
    }
    const { data: target, error: targetError } = await supabase
        .from('profiles')
        .select('id,name,status')
        .eq('id', id)
        .maybeSingle();
    if (targetError)
        throw targetError;
    if (!target)
        throw new Error('User not found');

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
        const code = String(error.code || '').toLowerCase();
        const isFkRestrict = code === '23503' || String(error.message || '').toLowerCase().includes('foreign key');
        if (!isFkRestrict) {
            throw error;
        }

        // When relational records exist, keep referential integrity and deactivate instead.
        const { error: deactivateError } = await supabase
            .from('profiles')
            .update({ status: 'inactive' })
            .eq('id', id);
        if (deactivateError)
            throw deactivateError;
        await writeAudit('DEACTIVATE_USER', 'user', id);
        return { softDeleted: true };
    }
    await writeAudit('DELETE_USER', 'user', id);
    return { softDeleted: false };
}
// ── Projects ──────────────────────────────────────────
export async function getProjects() {
    await requireUser();
    ensureSupabase();
    const { data, error } = await withRetry(() => supabase.from('projects').select('*'));
    if (error)
        throw error;
    const projectIds = (data || []).map((p) => p.id);
    const { data: memberRows, error: memberError } = projectIds.length
        ? await withRetry(() => supabase.from('project_members').select('project_id,user_id').in('project_id', projectIds))
        : { data: [], error: null };
    if (memberError)
        throw memberError;
    return (data || []).map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: (memberRows || []).filter((m) => m.project_id === p.id).map((m) => m.user_id) }));
}
export async function getProjectById(id) {
    await requireUser();
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error)
        return undefined;
    if (!data)
        return undefined;
    const { data: members, error: memberError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', id);
    if (memberError)
        throw memberError;
    return { id: data.id, title: data.title, description: data.description, createdBy: data.created_by, createdAt: data.created_at, deadline: data.deadline, priority: data.priority, assignedUsers: (members || []).map((m) => m.user_id) };
}
export async function getProjectsForUser(userId) {
    const actor = await requireUser();
    ensureSupabase();
    if (actor.role === 'TEAM_LEADER') {
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
        const { data: memberRows, error: memberError } = await supabase
            .from('project_members')
            .select('project_id,user_id')
            .in('project_id', projectIds);
        if (memberError)
            throw memberError;
        return projects.map(p => ({ id: p.id, title: p.title, description: p.description, createdBy: p.created_by, createdAt: p.created_at, deadline: p.deadline, priority: p.priority, assignedUsers: (memberRows || []).filter((m) => m.project_id === p.id).map((m) => m.user_id) }));
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
    if (Array.isArray(data.assignedUsers) && data.assignedUsers.length > 0) {
        const { error: memberError } = await supabase.from('project_members').insert(
            data.assignedUsers.map((userId) => ({ project_id: newProject.id, user_id: userId }))
        );
        if (memberError) {
            throw memberError;
        }
    }
    await writeAudit('CREATE_PROJECT', 'project', newProject.id);
    return { id: newProject.id, title: newProject.title, description: newProject.description, createdBy: newProject.created_by, createdAt: newProject.created_at, deadline: newProject.deadline, priority: newProject.priority, assignedUsers: Array.isArray(data.assignedUsers) ? data.assignedUsers : [] };
}
export async function updateProject(id, data) {
    await requirePermission('projects:update');
    ensureSupabase();
    const updateData = { ...(data.title && { title: data.title }), ...(data.description && { description: data.description }), ...(data.deadline && { deadline: data.deadline }), ...(data.priority && { priority: data.priority }) };
    const { data: updated, error } = await supabase.from('projects').update(updateData).eq('id', id).select().maybeSingle();
    if (error)
        throw error;
    if (!updated)
        throw new AuthorizationError('Project not found or not accessible');
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
    await requirePermission('projects:update');
    ensureSupabase();
    try {
        const { data: project, error: projectError } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
        if (projectError)
            throw projectError;
        if (!project)
            throw new Error('Project not found');
        const { data: user, error: userError } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (userError)
            throw userError;
        if (!user)
            throw new Error('User not found');

        // Persist manager assignment in projects table for schemas without project_members.role.
        const { error: updateProjectError } = await supabase
            .from('projects')
            .update({ created_by: userId })
            .eq('id', projectId);
        if (updateProjectError)
            throw updateProjectError;

        // Ensure manager is also a project member (idempotent via PK conflict ignore).
        const { error: memberInsertError } = await supabase
            .from('project_members')
            .upsert([{ project_id: projectId, user_id: userId }], { onConflict: 'project_id,user_id', ignoreDuplicates: true });
        if (memberInsertError) {
            console.warn('Could not ensure manager membership row:', memberInsertError.message);
        }

        await createNotification(userId, 'Project Manager Role', `You have been assigned as manager for "${project.title}"`, 'role_assigned');
        await writeAudit('ASSIGN_PROJECT_MANAGER', 'project', projectId);
    } catch (err) {
        console.error('Error assigning project manager:', err);
        throw err;
    }
}
export async function assignProjectMembers(projectId, userIds) {
    await requirePermission('projects:update');
    ensureSupabase();
    try {
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
        if (!project)
            throw new Error('Project not found');
        const { data: existingMembers, error: existingMembersError } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId);
        if (existingMembersError)
            throw existingMembersError;
        const existingIds = existingMembers?.map(m => m.user_id) || [];
        
        const toAdd = userIds.filter(id => !existingIds.includes(id));
        const toRemove = existingIds.filter(id => !userIds.includes(id));
        
        // Remove old members
        if (toRemove.length > 0) {
            const { error: removeError } = await supabase
                .from('project_members')
                .delete()
                .eq('project_id', projectId)
                .in('user_id', toRemove);
            if (removeError)
                throw removeError;
        }
        
        // Add new members
        if (toAdd.length > 0) {
            const { error: addError } = await supabase.from('project_members').insert(
                toAdd.map(userId => ({
                    project_id: projectId,
                    user_id: userId,
                }))
            );
            if (addError)
                throw addError;
            
            await Promise.all(toAdd.map(userId => 
                createNotification(userId, 'Project Assignment', `You have been assigned to project "${project.title}"`, 'project_assigned')
            ));
        }
        
        await writeAudit('ASSIGN_PROJECT_MEMBERS', 'project', projectId);
    } catch (err) {
        console.error('Error assigning project members:', err?.message);
        throw err;
    }
}
// ── Teams ────────────────────────────────────────────
export async function getTeams() {
    await requireUser();
    ensureSupabase();
    const { data, error } = await withRetry(() => supabase.from('teams').select('*'));
    if (error)
        throw error;
    const teamIds = (data || []).map((team) => team.id);
    const { data: memberRows, error: memberError } = teamIds.length
        ? await withRetry(() => supabase.from('team_members').select('team_id,user_id').in('team_id', teamIds))
        : { data: [], error: null };
    if (memberError)
        throw memberError;
    const { data: projectRows, error: projectError } = teamIds.length
        ? await withRetry(() => supabase.from('team_projects').select('team_id,project_id').in('team_id', teamIds))
        : { data: [], error: null };
    if (projectError)
        throw projectError;
    return (data || []).map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        createdBy: team.created_by,
        members: (memberRows || []).filter((member) => member.team_id === team.id).map((member) => member.user_id),
        projects: (projectRows || []).filter((project) => project.team_id === team.id).map((project) => project.project_id),
        createdAt: team.created_at,
    }));
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
    const memberIds = Array.from(new Set((data.members || []).filter(Boolean)));
    if (memberIds.length > 0) {
        const { error: memberError } = await supabase
            .from('team_members')
            .insert(memberIds.map((userId) => ({ team_id: newTeam.id, user_id: userId })));
        if (memberError)
            throw memberError;
    }
    const projectIds = Array.from(new Set((data.projects || []).filter(Boolean)));
    if (projectIds.length > 0) {
        const { error: projectError } = await supabase
            .from('team_projects')
            .insert(projectIds.map((projectId) => ({ team_id: newTeam.id, project_id: projectId })));
        if (projectError)
            throw projectError;
    }
    await writeAudit('CREATE_TEAM', 'team', newTeam.id);
    return { id: newTeam.id, name: newTeam.name, description: newTeam.description, createdBy: newTeam.created_by, members: memberIds, projects: projectIds, createdAt: newTeam.created_at };
}
export async function updateTeam(id, data) {
    await requirePermission('teams:manage');
    ensureSupabase();
    const updateData = { ...(data.name && { name: data.name }), ...(data.description && { description: data.description }) };
    const { data: updated, error } = await supabase.from('teams').update(updateData).eq('id', id).select().single();
    if (error)
        throw error;

    const nextMembers = Array.from(new Set((data.members || []).filter(Boolean)));
    const { data: existingMemberRows, error: existingMemberError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', id);
    if (existingMemberError)
        throw existingMemberError;
    const currentMembers = (existingMemberRows || []).map((row) => row.user_id);
    const membersToAdd = nextMembers.filter((memberId) => !currentMembers.includes(memberId));
    const membersToRemove = currentMembers.filter((memberId) => !nextMembers.includes(memberId));
    if (membersToRemove.length > 0) {
        const { error: removeMembersError } = await supabase
            .from('team_members')
            .delete()
            .eq('team_id', id)
            .in('user_id', membersToRemove);
        if (removeMembersError)
            throw removeMembersError;
    }
    if (membersToAdd.length > 0) {
        const { error: addMembersError } = await supabase
            .from('team_members')
            .insert(membersToAdd.map((memberId) => ({ team_id: id, user_id: memberId })));
        if (addMembersError)
            throw addMembersError;
    }

    const nextProjects = Array.from(new Set((data.projects || []).filter(Boolean)));
    const { data: existingProjectRows, error: existingProjectError } = await supabase
        .from('team_projects')
        .select('project_id')
        .eq('team_id', id);
    if (existingProjectError)
        throw existingProjectError;
    const currentProjects = (existingProjectRows || []).map((row) => row.project_id);
    const projectsToAdd = nextProjects.filter((projectId) => !currentProjects.includes(projectId));
    const projectsToRemove = currentProjects.filter((projectId) => !nextProjects.includes(projectId));
    if (projectsToRemove.length > 0) {
        const { error: removeProjectsError } = await supabase
            .from('team_projects')
            .delete()
            .eq('team_id', id)
            .in('project_id', projectsToRemove);
        if (removeProjectsError)
            throw removeProjectsError;
    }
    if (projectsToAdd.length > 0) {
        const { error: addProjectsError } = await supabase
            .from('team_projects')
            .insert(projectsToAdd.map((projectId) => ({ team_id: id, project_id: projectId })));
        if (addProjectsError)
            throw addProjectsError;
    }

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
    if (actor.role === 'TEAM_LEADER') {
        query = query.eq('assigned_to', actor.id);
    }
    const { data, error } = await withRetry(() => query);
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
    if (actor.role === 'TEAM_LEADER' && data.assigned_to !== actor.id)
        throw new AuthorizationError('Forbidden');
    const { data: comments } = await supabase.from('comments').select('*').eq('task_id', id);
    return { id: data.id, title: data.title, description: data.description, projectId: data.project_id, assignedTo: data.assigned_to, createdBy: data.created_by, status: data.status, priority: data.priority, dueDate: data.due_date, comments: comments?.map(c => ({ id: c.id, taskId: c.task_id, userId: c.user_id, content: c.content, createdAt: c.created_at })) || [], createdAt: data.created_at };
}
export async function getTasksForUser(userId) {
    const actor = await requirePermission('tasks:view');
    if (actor.role === 'TEAM_LEADER' && actor.id !== userId)
        throw new AuthorizationError('Forbidden');
    ensureSupabase();
    const { data, error } = await supabase.from('tasks').select('*').eq('assigned_to', actor.role === 'TEAM_LEADER' ? actor.id : userId);
    if (error || !data)
        throw error || new Error('Failed to fetch tasks');
    return data.map(t => ({ id: t.id, title: t.title, description: t.description, projectId: t.project_id, assignedTo: t.assigned_to, createdBy: t.created_by, status: t.status, priority: t.priority, dueDate: t.due_date, comments: [], createdAt: t.created_at }));
}
export async function getTasksForProject(projectId) {
    const actor = await requirePermission('tasks:view');
    let query = supabase.from('tasks').select('*').eq('project_id', projectId);
    if (actor.role === 'TEAM_LEADER') {
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
    if (actor.role === 'TEAM_LEADER') {
        if (current.assignedTo !== actor.id)
            throw new AuthorizationError('Forbidden');
        const attemptedFields = Object.keys(data);
        const statusOnly = attemptedFields.every((field) => field === 'status');
        if (!statusOnly || typeof data.status === 'undefined') {
            throw new AuthorizationError('TEAM_LEADER can only update task status');
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
    if (actor.role === 'TEAM_LEADER') {
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
    if (actor.role === 'TEAM_LEADER' && task.assigned_to !== actor.id)
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
    return data.map(n => ({ id: n.id, userId: n.user_id, title: n.title, message: n.message, read: n.read, type: n.type, createdAt: n.created_at, linkPath: n.link_path || undefined }));
}
export async function markNotificationRead(id) {
    const actor = await requireUser();
    if (actor.role === 'TEAM_MEMBER')
        throw new AuthorizationError('TEAM_MEMBER role is read-only');
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
    if (actor.role === 'TEAM_MEMBER')
        throw new AuthorizationError('TEAM_MEMBER role is read-only');
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
    if (actor.role === 'ADMIN') {
        const { data: conversationRows, error: conversationError } = await withRetry(() => supabase
            .from('conversations')
            .select('*')
            .order('last_message_at', { ascending: false }));
        if (conversationError)
            throw conversationError;
        const conversationIds = (conversationRows || []).map((row) => row.id);
        const { data: participantRows } = conversationIds.length
            ? await withRetry(() => supabase
                .from('conversation_members')
                .select('conversation_id,user_id')
                .in('conversation_id', conversationIds))
            : { data: [] };
        const mapped = (conversationRows || []).map((row) => ({
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
        return dedupeConversationsByScope(mapped, actor.id);
    }
    const { data: membershipRows, error: membershipError } = await withRetry(() => supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', actor.id));
    if (membershipError)
        throw membershipError;
    const conversationIds = (membershipRows || []).map((row) => row.conversation_id);
    if (conversationIds.length === 0)
        return [];
    const { data: conversationRows, error: conversationError } = await withRetry(() => supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false }));
    if (conversationError)
        throw conversationError;
    const { data: participantRows } = await withRetry(() => supabase
        .from('conversation_members')
        .select('conversation_id,user_id')
        .in('conversation_id', conversationIds));
    const mapped = (conversationRows || []).map((row) => ({
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
    return dedupeConversationsByScope(mapped, actor.id);
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
    const safeTitle = String(title || '').trim() || 'Project Group';
    if (supabase) {
        try {
            const { data: insertedConversation, error: insertConversationError } = await supabase
                .from('conversations')
                .insert([
                {
                    type: 'project',
                    title: safeTitle,
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
        catch (error) {
            throw error;
        }
    }
    throw new Error('Project chat backend is unavailable');
}
export async function getConversationMessages(conversationId) {
    const actor = await requirePermission('chat:view');
    if (supabase) {
        try {
            const { data: conversationRow } = await supabase
                .from('conversations')
                .select('id,type')
                .eq('id', conversationId)
                .maybeSingle();
            const { data: membership } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('conversation_id', conversationId)
                .eq('user_id', actor.id)
                .maybeSingle();
            if (!membership && actor.role !== 'ADMIN')
                throw new AuthorizationError('Forbidden');
            const messageQuery = supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            const { data: messageRows, error: messageError } = await withRetry(() => messageQuery);
            if (messageError)
                throw messageError;
            const messageIds = (messageRows || []).map((row) => row.id);
            const { data: receiptRows } = messageIds.length
                ? await withRetry(() => supabase.from('message_receipts').select('message_id,user_id,seen_at').in('message_id', messageIds))
                : { data: [] };
            return (messageRows || []).map((row) => mapMessageRow(row, receiptRows || []));
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
    const normalizedInput = typeof input === 'string' ? { content: input } : (input || {});
    const actor = await requirePermission('chat:send');
    if (supabase) {
        try {
            const { data: conversationRow } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', normalizedInput.conversationId)
                .single();
            if (!conversationRow)
                throw new Error('Conversation not found');
            const { data: membershipRows } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', normalizedInput.conversationId);
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
            const content = String(normalizedInput.content || '').trim();
            if (!content && !normalizedInput.fileUrl)
                throw new Error('Message cannot be empty');
            const mentions = (await extractMentionUserIds(content)).filter((id) => id !== actor.id);
            const { data: insertedMessage, error: insertMessageError } = await withRetry(() => supabase
                .from('messages')
                .insert([
                {
                    conversation_id: normalizedInput.conversationId,
                    sender_id: actor.id,
                    content,
                    message_type: normalizedInput.type || 'text',
                    file_url: normalizedInput.fileUrl || null,
                    mentions,
                    delivery_status: 'delivered',
                },
            ])
                .select()
                .single());
            if (insertMessageError)
                throw insertMessageError;
            await withRetry(() => supabase.from('conversations').update({ last_message_at: insertedMessage.created_at }).eq('id', normalizedInput.conversationId));
            await withRetry(() => supabase.from('message_receipts').upsert([
                { message_id: insertedMessage.id, user_id: actor.id, delivered_at: insertedMessage.created_at, seen_at: insertedMessage.created_at },
            ]));
            participants
                .filter((participantId) => participantId !== actor.id)
                .forEach((participantId) => {
                createNotification(participantId, 'New message', `${actor.name}: ${content || 'sent an attachment'}`, 'message', {
                    linkPath: `/messages?conversation=${encodeURIComponent(normalizedInput.conversationId)}&message=${encodeURIComponent(insertedMessage.id)}`,
                });
            });
            mentions.forEach((mentionedUserId) => {
                createNotification(mentionedUserId, 'You were mentioned', `${actor.name} mentioned you in chat`, 'mention', {
                    linkPath: `/messages?conversation=${encodeURIComponent(normalizedInput.conversationId)}&message=${encodeURIComponent(insertedMessage.id)}`,
                });
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
            emitCommunicationEvent({ type: 'message:new', conversationId: normalizedInput.conversationId, message: mapped });
            emitCommunicationEvent({ type: 'conversation:update', conversationId: normalizedInput.conversationId });
            return mapped;
        }
        catch {
            // Fall through to local mode
        }
    }
    const conversation = conversations.find((item) => item.id === normalizedInput.conversationId);
    if (!conversation)
        throw new Error('Conversation not found');
    if (!canSendMessage(actor, conversation))
        throw new AuthorizationError('Forbidden');
    const content = String(normalizedInput.content || '').trim();
    if (!content && !normalizedInput.fileUrl)
        throw new Error('Message cannot be empty');
    const mentions = (await extractMentionUserIds(content)).filter((id) => id !== actor.id);
    const message = {
        id: `msg${Date.now()}${Math.random().toString(16).slice(2, 5)}`,
        conversationId: conversation.id,
        senderId: actor.id,
        content,
        type: normalizedInput.type || 'text',
        fileUrl: normalizedInput.fileUrl,
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
        createNotification(participantId, 'New message', `${actor.name}: ${content || 'sent an attachment'}`, 'message', {
            linkPath: `/messages?conversation=${encodeURIComponent(conversation.id)}&message=${encodeURIComponent(message.id)}`,
        });
    });
    mentions.forEach((mentionedUserId) => {
        createNotification(mentionedUserId, 'You were mentioned', `${actor.name} mentioned you in chat`, 'mention', {
            linkPath: `/messages?conversation=${encodeURIComponent(conversation.id)}&message=${encodeURIComponent(message.id)}`,
        });
    });
    emitCommunicationEvent({ type: 'message:new', conversationId: conversation.id, message });
    emitCommunicationEvent({ type: 'conversation:update', conversationId: conversation.id });
    return message;
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
    if (!CALLS_ENABLED)
        return [];
    const actor = await requireUser();
    if (callsFeatureUnavailable)
        return [];
    if (supabase) {
        try {
            if (actor.role === 'ADMIN') {
                const { data: callRows, error: callError } = await withRetry(() => supabase
                    .from('calls')
                    .select('*')
                    .order('started_at', { ascending: false }));
                if (callError)
                    throw callError;
                const callIds = (callRows || []).map((row) => row.id);
                const { data: participantRows, error: participantError } = callIds.length
                    ? await withRetry(() => supabase
                        .from('call_participants')
                        .select('call_id,user_id')
                        .in('call_id', callIds))
                    : { data: [] };
                if (participantError)
                    throw participantError;
                return (callRows || [])
                    .filter((row) => ['ringing', 'ongoing'].includes(String(row.status || row.call_status || 'ringing')))
                    .map((row) => mapCallRow(row, participantRows || []));
            }
            const { data: membershipRows, error: membershipError } = await withRetry(() => supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('user_id', actor.id));
            if (membershipError)
                throw membershipError;
            const conversationIds = (membershipRows || []).map((row) => row.conversation_id);
            if (conversationIds.length === 0)
                return [];
            const { data: callRows, error: callError } = await withRetry(() => supabase
                .from('calls')
                .select('*')
                .in('conversation_id', conversationIds)
                .order('started_at', { ascending: false }));
            if (callError)
                throw callError;
            const callIds = (callRows || []).map((row) => row.id);
            const { data: participantRows, error: participantError } = callIds.length
                ? await withRetry(() => supabase
                    .from('call_participants')
                    .select('call_id,user_id')
                    .in('call_id', callIds))
                : { data: [] };
            if (participantError)
                throw participantError;
            return (callRows || [])
                .filter((row) => ['ringing', 'ongoing'].includes(String(row.status || row.call_status || 'ringing')))
                .map((row) => mapCallRow(row, participantRows || []));
        }
        catch (error) {
            if (markCallsFeatureUnavailable(error))
                return [];
            // Fall through to local mode
        }
    }
    return callSessions.filter((session) => session.status !== 'ended' &&
        session.participants.includes(actor.id) &&
        (hasPermission(actor.role, 'calls:join') || actor.role === 'ADMIN'));
}
export async function startCall(conversationId, type) {
    if (!CALLS_ENABLED)
        throw new Error('Calls feature is disabled for this environment.');
    const actor = await requireUser();
    if (callsFeatureUnavailable)
        throw new Error('Calls feature is not enabled in the database yet.');
    if (!hasPermission(actor.role, 'calls:initiate')) {
        throw new AuthorizationError('Only PROJECT_MANAGER and ADMIN can initiate calls');
    }
    ensureSupabase();
    const { data: conversationRow, error: conversationError } = await withRetry(() => supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single());
    if (conversationError)
        throw conversationError;
    if (!conversationRow)
        throw new Error('Conversation not found');
    const { data: membershipRows, error: membershipError } = await withRetry(() => supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId));
    if (membershipError)
        throw membershipError;
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
    const { data: insertedCall, error: insertCallError } = await withRetry(() => supabase
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
        .single());
    if (insertCallError) {
        if (isMissingColumnError(insertCallError, 'initiated_by')) {
            const fallbackInsert = await withRetry(() => supabase
                .from('calls')
                .insert([
                {
                    conversation_id: conversationId,
                    initiator_id: actor.id,
                    call_type: type,
                    status: 'ringing',
                },
            ])
                .select()
                .single());
            if (fallbackInsert.error)
                throw fallbackInsert.error;
            const fallbackCall = fallbackInsert.data;
            const fallbackParticipants = await withRetry(() => supabase
                .from('call_participants')
                .upsert(participants.map((participantId) => ({ call_id: fallbackCall.id, user_id: participantId }))));
            if (fallbackParticipants.error) {
                if (markCallsFeatureUnavailable(fallbackParticipants.error)) {
                    throw new Error('Calls feature is not enabled in the database yet.');
                }
                throw fallbackParticipants.error;
            }
            await Promise.all(participants
                .filter((participantId) => participantId !== actor.id)
                .map((participantId) => createNotification(participantId, 'Incoming call', `${actor.name} started a ${type} call`, 'call')));
            const mappedFallback = {
                id: fallbackCall.id,
                conversationId: fallbackCall.conversation_id,
                initiatedBy: fallbackCall.initiated_by || fallbackCall.initiator_id,
                participants,
                type: fallbackCall.call_type,
                status: fallbackCall.status,
                startedAt: fallbackCall.started_at,
                endedAt: fallbackCall.ended_at || undefined,
            };
            emitCommunicationEvent({ type: 'call:update', call: mappedFallback });
            return mappedFallback;
        }
        if (markCallsFeatureUnavailable(insertCallError)) {
            throw new Error('Calls feature is not enabled in the database yet.');
        }
        throw insertCallError;
    }
    const { error: participantsError } = await withRetry(() => supabase
        .from('call_participants')
        .upsert(participants.map((participantId) => ({ call_id: insertedCall.id, user_id: participantId }))));
    if (participantsError) {
        if (markCallsFeatureUnavailable(participantsError)) {
            throw new Error('Calls feature is not enabled in the database yet.');
        }
        throw participantsError;
    }
    await Promise.all(participants
        .filter((participantId) => participantId !== actor.id)
        .map((participantId) => createNotification(participantId, 'Incoming call', `${actor.name} started a ${type} call`, 'call')));
    const mapped = {
        id: insertedCall.id,
        conversationId: insertedCall.conversation_id,
        initiatedBy: insertedCall.initiated_by || insertedCall.initiator_id,
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
    if (!CALLS_ENABLED)
        throw new Error('Calls feature is disabled for this environment.');
    const actor = await requirePermission('calls:join');
    if (callsFeatureUnavailable)
        throw new Error('Calls feature is not enabled in the database yet.');
    if (supabase) {
        try {
            const { data: currentRow, error: currentError } = await withRetry(() => supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single());
            if (currentError || !currentRow)
                throw new Error('Call not found');
            const { data: participantRows, error: participantRowsError } = await withRetry(() => supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', currentRow.conversation_id));
            if (participantRowsError)
                throw participantRowsError;
            const participants = (participantRows || []).map((row) => row.user_id);
            if (!participants.includes(actor.id))
                throw new AuthorizationError('Forbidden');
            if (actor.role === 'TEAM_MEMBER') {
                const initiatorId = currentRow.initiated_by || currentRow.initiator_id;
                if (!initiatorId) {
                    throw new AuthorizationError('TEAM_MEMBER can only join TEAM_LEADER initiated calls');
                }
                const { data: initiatorProfile, error: initiatorError } = await withRetry(() => supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', initiatorId)
                    .maybeSingle());
                if (initiatorError)
                    throw initiatorError;
                if (normalizeRole(initiatorProfile?.role) !== 'TEAM_LEADER') {
                    throw new AuthorizationError('TEAM_MEMBER can only join TEAM_LEADER initiated calls');
                }
            }
            const { data: updatedRow, error: updateError } = await withRetry(() => supabase
                .from('calls')
                .update({ status: 'ongoing' })
                .eq('id', callId)
                .select()
                .single());
            if (updateError)
                throw updateError;
            const { error: upsertParticipantError } = await withRetry(() => supabase
                .from('call_participants')
                .upsert([{ call_id: callId, user_id: actor.id, joined_at: new Date().toISOString() }]));
            if (upsertParticipantError)
                throw upsertParticipantError;
            const mapped = {
                id: updatedRow.id,
                conversationId: updatedRow.conversation_id,
                initiatedBy: updatedRow.initiated_by || updatedRow.initiator_id,
                participants,
                type: updatedRow.call_type,
                status: updatedRow.status,
                startedAt: updatedRow.started_at,
                endedAt: updatedRow.ended_at || undefined,
            };
            emitCommunicationEvent({ type: 'call:update', call: mapped });
            return mapped;
        }
        catch (error) {
            if (markCallsFeatureUnavailable(error)) {
                throw new Error('Calls feature is not enabled in the database yet.');
            }
            throw error;
        }
    }

    const call = callSessions.find((session) => session.id === callId);
    if (!call)
        throw new Error('Call not found');
    if (!call.participants.includes(actor.id))
        throw new AuthorizationError('Forbidden');
    if (actor.role === 'TEAM_MEMBER') {
        const initiator = await getUserById(call.initiatedBy);
        if (normalizeRole(initiator?.role) !== 'TEAM_LEADER') {
            throw new AuthorizationError('TEAM_MEMBER can only join TEAM_LEADER initiated calls');
        }
    }
    const updated = {
        ...call,
        status: 'ongoing',
        participants: Array.from(new Set([...(call.participants || []), actor.id])),
    };
    callSessions = callSessions.map((session) => session.id === callId ? updated : session);
    emitCommunicationEvent({ type: 'call:update', call: updated });
    return updated;
}
export async function endCall(callId) {
    if (!CALLS_ENABLED)
        return;
    const actor = await requireUser();
    if (callsFeatureUnavailable)
        return;
    ensureSupabase();
    const { data: currentRow, error: currentError } = await withRetry(() => supabase.from('calls').select('*').eq('id', callId).single());
    if (currentError && markCallsFeatureUnavailable(currentError))
        return;
    if (!currentRow)
        return;
    const { data: participantRows } = await withRetry(() => supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', currentRow.conversation_id));
    const participants = (participantRows || []).map((row) => row.user_id);
    if (!participants.includes(actor.id) && actor.role !== 'ADMIN')
        throw new AuthorizationError('Forbidden');
    const { data: updatedRow, error: updateError } = await withRetry(() => supabase
        .from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callId)
        .select()
        .single());
    if (updateError) {
        if (markCallsFeatureUnavailable(updateError))
            return;
        throw updateError;
    }
    emitCommunicationEvent({
        type: 'call:update',
        call: {
            id: updatedRow.id,
            conversationId: updatedRow.conversation_id,
            initiatedBy: updatedRow.initiated_by || updatedRow.initiator_id,
            participants,
            type: updatedRow.call_type,
            status: updatedRow.status,
            startedAt: updatedRow.started_at,
            endedAt: updatedRow.ended_at || undefined,
        },
    });
}
export async function getCallHistory() {
    const actor = await requirePermission('calls:join');
    ensureSupabase();
    let callRows = [];
    const { data, error } = await withRetry(() => supabase
        .from('calls')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(200));
    if (error)
        throw error;
    callRows = data || [];
    const callIds = callRows.map((row) => row.id);
    let participantRows = [];
    if (callIds.length) {
        const participantResult = await withRetry(() => supabase
            .from('call_participants')
            .select('call_id,user_id')
            .in('call_id', callIds));
        if (!participantResult.error) {
            participantRows = participantResult.data || [];
        }
    }
    return callRows.map((row) => mapCallRow(row, participantRows || []));
}
export async function deleteMessage(messageId) {
    const actor = await requirePermission('chat:view');
    ensureSupabase();
    const { data: currentRow, error: currentError } = await withRetry(() => supabase
        .from('messages')
        .select('id,conversation_id,sender_id')
        .eq('id', messageId)
        .maybeSingle());
    if (currentError)
        throw currentError;
    if (!currentRow)
        return;
    if (actor.role !== 'ADMIN' && currentRow.sender_id !== actor.id)
        throw new AuthorizationError('Only sender or ADMIN can delete this message');
    const { error } = await withRetry(() => supabase
        .from('messages')
        .delete()
        .eq('id', messageId));
    if (error)
        throw error;
    emitCommunicationEvent({ type: 'conversation:update', conversationId: currentRow.conversation_id });
}
export async function deleteCallHistory(callId) {
    const actor = await requirePermission('calls:join');
    ensureSupabase();
    const { data: currentRow, error: currentError } = await withRetry(() => supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .maybeSingle());
    if (currentError)
        throw currentError;
    if (!currentRow)
        return;
    const isOwner = (currentRow.initiated_by || currentRow.initiator_id) === actor.id;
    if (actor.role !== 'ADMIN' && !isOwner)
        throw new AuthorizationError('Only call owner or ADMIN can delete this call history');
    const { error } = await withRetry(() => supabase
        .from('calls')
        .delete()
        .eq('id', callId));
    if (error)
        throw error;
    emitCommunicationEvent({
        type: 'call:update',
        call: {
            id: callId,
            conversationId: currentRow.conversation_id,
            initiatedBy: currentRow.initiated_by || currentRow.initiator_id,
            participants: [],
            type: currentRow.call_type,
            status: 'ended',
            startedAt: currentRow.started_at,
            endedAt: currentRow.ended_at || new Date().toISOString(),
        },
    });
}
export async function searchMessages(query) {
    const actor = await requirePermission('chat:view');
    const trimmed = query.trim().toLowerCase();
    if (!trimmed)
        return [];
    ensureSupabase();
    let messageRows = [];
    if (actor.role === 'ADMIN') {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .ilike('content', `%${trimmed}%`)
            .order('created_at', { ascending: false });
        messageRows = data || [];
    }
    else {
        const { data: membershipRows } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', actor.id);
        const conversationIds = (membershipRows || []).map((row) => row.conversation_id);
        if (conversationIds.length === 0)
            return [];
        const { data } = await supabase
            .from('messages')
            .select('*')
            .in('conversation_id', conversationIds)
            .ilike('content', `%${trimmed}%`)
            .order('created_at', { ascending: false });
        messageRows = data || [];
    }
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

// ── Activity Logs (Real-time Task Tracking) ───────────
export async function getActivityLogs(taskId) {
    const actor = await requirePermission('tasks:view');
    ensureSupabase();

    let query = supabase
        .from('activity_logs')
        .select('*');

    if (taskId) {
        query = query.eq('task_id', taskId);
    }

    const { data, error } = await withRetry(() => 
        query.order('created_at', { ascending: false }).limit(100)
    );

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        taskId: row.task_id,
        action: row.action, // 'created', 'updated', 'moved', 'assigned', 'commented'
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldValue: row.old_value,
        newValue: row.new_value,
        metadata: row.metadata,
        createdAt: row.created_at,
    }));
}

export async function getTaskAssignments(taskId) {
    const actor = await requirePermission('tasks:view');
    ensureSupabase();

    const { data, error } = await withRetry(() =>
        supabase
            .from('task_assignments')
            .select('*')
            .eq('task_id', taskId)
    );

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        taskId: row.task_id,
        assignedTo: row.assigned_to,
        assignedBy: row.assigned_by,
        assignedAt: row.assigned_at,
    }));
}

export async function assignTaskToUser(taskId, assignedTo) {
    const actor = await requirePermission('tasks:assign');
    ensureSupabase();

    const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

    if (taskError || !task) throw new Error('Task not found');

    // Check project membership
    const { data: membership } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', task.project_id)
        .eq('user_id', actor.id)
        .single();

    if (!membership && actor.role !== 'ADMIN') {
        throw new AuthorizationError('Cannot assign tasks in this project');
    }

    // Add assignment
    const { data: assignment, error: assignError } = await supabase
        .from('task_assignments')
        .insert([{
            task_id: taskId,
            assigned_to: assignedTo,
            assigned_by: actor.id,
        }])
        .select()
        .single();

    if (assignError) throw assignError;

    // Create notification
    await createNotification(
        assignedTo,
        'Task Assigned',
        `You have been assigned: "${task.title}"`,
        'task_assigned',
        { taskId }
    );

    // Emit real-time event
    socketManager.emit('task:assigned', {
        taskId,
        projectId: task.project_id,
        userId: actor.id,
        assignedTo,
        assignedBy: actor.id,
    });

    return {
        id: assignment.id,
        taskId: assignment.task_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
    };
}

// =====================================================
// Deployment Management
// =====================================================

export async function createDeploymentRequest(projectId, taskIds = [], environment, description, deploymentDetails = {}) {
    const actor = await requirePermission('deployments:create');
    ensureSupabase();

    // Validate project exists
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

    if (projectError || !project) throw new Error('Project not found');

    // Create deployment
    const { data: deployment, error: deployError } = await supabase
        .from('deployments')
        .insert([{
            project_id: projectId,
            requested_by: actor.id,
            environment,
            status: 'pending',
            description,
            deployment_link: deploymentDetails.deploymentLink || null,
            change_notes: deploymentDetails.changeNotes || null,
            pre_deployment_checklist: deploymentDetails.preDeploymentChecklist || null,
            post_deployment_instructions: deploymentDetails.postDeploymentInstructions || null,
            expected_downtime: deploymentDetails.expectedDowntime || null,
            project_documentation: deploymentDetails.projectDocumentation || null,
            documentation_file_name: deploymentDetails.documentationFileName || null,
        }])
        .select()
        .single();

    if (deployError) throw deployError;

    // Add deployment items (tasks)
    if (taskIds && taskIds.length > 0) {
        const items = taskIds.map(taskId => ({
            deployment_id: deployment.id,
            task_id: taskId,
        }));

        const { error: itemsError } = await supabase
            .from('deployment_items')
            .insert(items);

        if (itemsError) throw itemsError;
    }

    // Create log entry
    await createDeploymentLog(deployment.id, 'created', actor.id, `Deployment requested by ${actor.name}`);

    // Emit real-time event
    socketManager.emit('deployment:created', {
        deploymentId: deployment.id,
        projectId,
        requestedBy: actor.id,
        environment,
    });

    // Create notification for PM/Admin
    const { data: pmAdmins } = await supabase
        .from('profiles')
        .select('id, name')
        .in('role', ['PROJECT_MANAGER', 'ADMIN']);

    if (pmAdmins) {
        for (const user of pmAdmins) {
            await createNotification(
                user.id,
                'New Deployment Request',
                `${actor.name} requested deployment to ${environment}`,
                'deployment_requested',
                { deploymentId: deployment.id }
            );
        }
    }

    return formatDeployment(deployment);
}

export async function getDeployments(filters = {}) {
    const actor = await requirePermission('deployments:view');
    ensureSupabase();

    let query = supabase
        .from('deployments')
        .select('*');

    // Filter by status if provided
    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    // Filter by environment if provided
    if (filters.environment) {
        query = query.eq('environment', filters.environment);
    }

    // Role-based filtering (TEAM_LEADER/MEMBER see only their own)
    if (actor.role !== 'ADMIN' && actor.role !== 'PROJECT_MANAGER') {
        query = query.eq('requested_by', actor.id);
    }

    const { data, error } = await withRetry(() => query);

    if (error) throw error;

    return (data || []).map(formatDeployment);
}

export async function getDeploymentById(deploymentId) {
    const actor = await requirePermission('deployments:view');
    ensureSupabase();

    const { data: deployment, error: deployError } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deploymentId)
        .single();

    if (deployError) throw deployError;
    if (!deployment) throw new Error('Deployment not found');

    // Check permission
    if (
        actor.role !== 'ADMIN' &&
        actor.role !== 'PROJECT_MANAGER' &&
        deployment.requested_by !== actor.id
    ) {
        throw new AuthorizationError('Cannot view this deployment');
    }

    return formatDeployment(deployment);
}

export async function getDeploymentItems(deploymentId) {
    const actor = await requirePermission('deployments:view');
    ensureSupabase();

    const { data: items, error } = await supabase
        .from('deployment_items')
        .select(`
            id,
            deployment_id,
            task_id,
            tasks (
                id,
                title,
                status,
                assigned_to
            ),
            included_at
        `)
        .eq('deployment_id', deploymentId);

    if (error) throw error;

    return (items || []).map(item => ({
        id: item.id,
        deploymentId: item.deployment_id,
        taskId: item.task_id,
        task: item.tasks ? {
            id: item.tasks.id,
            title: item.tasks.title,
            status: item.tasks.status,
            assignedTo: item.tasks.assigned_to,
        } : null,
        includedAt: item.included_at,
    }));
}

export async function approveDeployment(deploymentId, notes = '') {
    const actor = await requirePermission('deployments:approve');
    ensureSupabase();

    // Get deployment
    const { data: deployment, error: deployError } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deploymentId)
        .single();

    if (deployError || !deployment) throw new Error('Deployment not found');

    if (deployment.status !== 'pending') {
        throw new Error('Only pending deployments can be approved');
    }

    // Update deployment
    const { data: updated, error: updateError } = await supabase
        .from('deployments')
        .update({
            status: 'approved',
            approved_by: actor.id,
            approved_at: new Date().toISOString(),
        })
        .eq('id', deploymentId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Create log
    await createDeploymentLog(
        deploymentId,
        'approved',
        actor.id,
        `Approved by ${actor.name}${notes ? ': ' + notes : ''}`
    );

    // Emit event
    socketManager.emit('deployment:approved', {
        deploymentId,
        approvedBy: actor.id,
    });

    // Notify requester
    const { data: requester } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', deployment.requested_by)
        .single();

    if (requester) {
        await createNotification(
            requester.id,
            'Deployment Approved',
            `Your deployment request has been approved`,
            'deployment_approved',
            { deploymentId }
        );
    }

    return formatDeployment(updated);
}

export async function rejectDeployment(deploymentId, reason) {
    const actor = await requirePermission('deployments:approve');
    ensureSupabase();

    // Get deployment
    const { data: deployment, error: deployError } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deploymentId)
        .single();

    if (deployError || !deployment) throw new Error('Deployment not found');

    if (deployment.status !== 'pending') {
        throw new Error('Only pending deployments can be rejected');
    }

    // Update deployment
    const { data: updated, error: updateError } = await supabase
        .from('deployments')
        .update({
            status: 'rejected',
            approved_by: actor.id,
            notes_rejection: reason,
            approved_at: new Date().toISOString(),
        })
        .eq('id', deploymentId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Create log
    await createDeploymentLog(
        deploymentId,
        'rejected',
        actor.id,
        `Rejected by ${actor.name}: ${reason}`
    );

    // Emit event
    socketManager.emit('deployment:rejected', {
        deploymentId,
        rejectedBy: actor.id,
        reason,
    });

    // Notify requester
    const { data: requester } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', deployment.requested_by)
        .single();

    if (requester) {
        await createNotification(
            requester.id,
            'Deployment Rejected',
            `Your deployment request was rejected: ${reason}`,
            'deployment_rejected',
            { deploymentId }
        );
    }

    return formatDeployment(updated);
}

export async function deployToEnvironment(deploymentId, environment) {
    const actor = await requirePermission('deployments:deploy');
    ensureSupabase();

    // Get deployment
    const { data: deployment, error: deployError } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deploymentId)
        .single();

    if (deployError || !deployment) throw new Error('Deployment not found');

    if (deployment.status !== 'approved') {
        throw new Error('Only approved deployments can be deployed');
    }

    // Validate: Only ADMIN can deploy to production
    if (environment === 'production' && actor.role !== 'ADMIN') {
        throw new AuthorizationError('Only admins can deploy to production');
    }

    // Update deployment
    const { data: updated, error: updateError } = await supabase
        .from('deployments')
        .update({
            status: 'deployed',
            environment,
            deployed_at: new Date().toISOString(),
        })
        .eq('id', deploymentId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Create log
    await createDeploymentLog(
        deploymentId,
        'deployed',
        actor.id,
        `Deployed to ${environment} by ${actor.name}`
    );

    // Emit event
    socketManager.emit('deployment:deployed', {
        deploymentId,
        environment,
        deployedBy: actor.id,
    });

    // Notify requester
    const { data: requester } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', deployment.requested_by)
        .single();

    if (requester) {
        await createNotification(
            requester.id,
            'Deployment Complete',
            `Your deployment to ${environment} is complete`,
            'deployment_deployed',
            { deploymentId }
        );
    }

    return formatDeployment(updated);
}

export async function getDeploymentLogs(deploymentId) {
    const actor = await requirePermission('deployments:view');
    ensureSupabase();

    const { data: logs, error } = await supabase
        .from('deployment_logs')
        .select(`
            id,
            deployment_id,
            action,
            user_id,
            message,
            timestamp,
            profiles (
                id,
                name
            )
        `)
        .eq('deployment_id', deploymentId)
        .order('timestamp', { ascending: false });

    if (error) throw error;

    return (logs || []).map(log => ({
        id: log.id,
        deploymentId: log.deployment_id,
        action: log.action,
        userId: log.user_id,
        userName: log.profiles?.name || 'Unknown',
        message: log.message,
        timestamp: log.timestamp,
    }));
}

// =====================================================
// Deployment Helpers
// =====================================================

async function createDeploymentLog(deploymentId, action, userId, message) {
    ensureSupabase();

    const { error } = await supabase
        .from('deployment_logs')
        .insert([{
            deployment_id: deploymentId,
            action,
            user_id: userId,
            message,
        }]);

    if (error) console.error('Error creating deployment log:', error);
}

function formatDeployment(deployment) {
    return {
        id: deployment.id,
        projectId: deployment.project_id,
        requestedBy: deployment.requested_by,
        approvedBy: deployment.approved_by,
        environment: deployment.environment,
        status: deployment.status,
        description: deployment.description,
        notesRejection: deployment.notes_rejection,
        requestedAt: deployment.requested_at,
        approvedAt: deployment.approved_at,
        deployedAt: deployment.deployed_at,
        createdAt: deployment.created_at,
    };
}

// =====================================================
// Project Submissions
// =====================================================

export async function submitProject(projectId, submissionNotes, submissionDetails = {}) {
    const actor = await requirePermission('projects:submit');
    ensureSupabase();

    // Get project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (projectError || !project) throw new Error('Project not found');

    // Create submission
    const { data: submission, error: submissionError } = await supabase
        .from('project_submissions')
        .insert([{
            project_id: projectId,
            submitted_by: actor.id,
            status: 'pending',
            submission_notes: submissionNotes,
            project_link: submissionDetails.projectLink || null,
            completion_summary: submissionDetails.completionSummary || null,
            completion_checklist: submissionDetails.completionChecklist || null,
            deliverables: submissionDetails.deliverables || null,
            next_steps: submissionDetails.nextSteps || null,
            project_documentation: submissionDetails.projectDocumentation || null,
            documentation_file_name: submissionDetails.documentationFileName || null,
        }])
        .select()
        .single();

    if (submissionError) throw submissionError;

    // Update project status
    await supabase
        .from('projects')
        .update({ project_status: 'submitted' })
        .eq('id', projectId);

    // Notify PM/Admin
    const { data: pmAdmins } = await supabase
        .from('profiles')
        .select('id, name')
        .in('role', ['PROJECT_MANAGER', 'ADMIN']);

    if (pmAdmins) {
        for (const user of pmAdmins) {
            await createNotification(
                user.id,
                'Project Submission',
                `${project.title} has been submitted for approval by ${actor.name}`,
                'project_submitted',
                { projectId, submissionId: submission.id }
            );
        }
    }

    // Emit socket event
    socketManager.emit('project:submitted', {
        projectId,
        submissionId: submission.id,
        submittedBy: actor.id,
    });

    return formatProjectSubmission(submission);
}

export async function getProjectSubmissions(filters = {}) {
    const actor = await requirePermission('projects:view');
    ensureSupabase();

    let query = supabase
        .from('project_submissions')
        .select(`
            id,
            project_id,
            submitted_by,
            approved_by,
            status,
            submission_notes,
            rejection_reason,
            submitted_at,
            approved_at,
            created_at,
            projects (id, title),
            submitted_by: profiles!submitted_by (id, name),
            approved_by: profiles!approved_by (id, name)
        `);

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
    }

    const { data, error } = await withRetry(() => query);

    if (error) throw error;

    return (data || []).map(formatProjectSubmission);
}

export async function getProjectSubmissionById(submissionId) {
    const actor = await requirePermission('projects:view');
    ensureSupabase();

    const { data: submission, error } = await supabase
        .from('project_submissions')
        .select(`
            *,
            projects (id, title, description),
            submitted_by: profiles!submitted_by (id, name),
            approved_by: profiles!approved_by (id, name)
        `)
        .eq('id', submissionId)
        .single();

    if (error) throw error;
    if (!submission) throw new Error('Submission not found');

    return formatProjectSubmission(submission);
}

export async function approveProjectSubmission(submissionId, approvalNotes = '') {
    const actor = await requirePermission('projects:approve');
    ensureSupabase();

    // Get submission
    const { data: submission, error: submissionError } = await supabase
        .from('project_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

    if (submissionError || !submission) throw new Error('Submission not found');

    if (submission.status !== 'pending') {
        throw new Error('Only pending submissions can be approved');
    }

    // Update submission
    const { data: updated, error: updateError } = await supabase
        .from('project_submissions')
        .update({
            status: 'approved',
            approved_by: actor.id,
            approved_at: new Date().toISOString(),
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Update project status
    await supabase
        .from('projects')
        .update({
            project_status: 'completed',
            completion_date: new Date().toISOString(),
        })
        .eq('id', submission.project_id);

    // Notify submitter
    const { data: submitter } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', submission.submitted_by)
        .single();

    if (submitter) {
        await createNotification(
            submitter.id,
            'Project Approved',
            'Your project submission has been approved!',
            'project_approved',
            { submissionId, projectId: submission.project_id }
        );
    }

    // Emit socket event
    socketManager.emit('project:approved', {
        submissionId,
        projectId: submission.project_id,
        approvedBy: actor.id,
    });

    return formatProjectSubmission(updated);
}

export async function rejectProjectSubmission(submissionId, rejectionReason) {
    const actor = await requirePermission('projects:approve');
    ensureSupabase();

    // Get submission
    const { data: submission, error: submissionError } = await supabase
        .from('project_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

    if (submissionError || !submission) throw new Error('Submission not found');

    if (submission.status !== 'pending') {
        throw new Error('Only pending submissions can be rejected');
    }

    // Update submission
    const { data: updated, error: updateError } = await supabase
        .from('project_submissions')
        .update({
            status: 'rejected',
            approved_by: actor.id,
            rejection_reason: rejectionReason,
            approved_at: new Date().toISOString(),
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Notify submitter
    const { data: submitter } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', submission.submitted_by)
        .single();

    if (submitter) {
        await createNotification(
            submitter.id,
            'Project Submission Rejected',
            `Your project submission was rejected: ${rejectionReason}`,
            'project_rejected',
            { submissionId, projectId: submission.project_id }
        );
    }

    // Emit socket event
    socketManager.emit('project:rejected', {
        submissionId,
        projectId: submission.project_id,
        rejectedBy: actor.id,
        reason: rejectionReason,
    });

    return formatProjectSubmission(updated);
}

// =====================================================
// Project Submission Helpers
// =====================================================

function formatProjectSubmission(submission) {
    return {
        id: submission.id,
        projectId: submission.project_id,
        submittedBy: submission.submitted_by,
        approvedBy: submission.approved_by,
        status: submission.status,
        submissionNotes: submission.submission_notes,
        rejectionReason: submission.rejection_reason,
        submittedAt: submission.submitted_at,
        approvedAt: submission.approved_at,
        createdAt: submission.created_at,
        project: submission.projects ? {
            id: submission.projects.id,
            title: submission.projects.title,
            description: submission.projects.description,
        } : null,
        submitterName: submission.submitted_by?.name || 'Unknown',
        approverName: submission.approved_by?.name || null,
    };
}

