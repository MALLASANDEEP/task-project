export const ROLES = {
    ADMIN: 'ADMIN',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    TEAM_LEADER: 'TEAM_LEADER',
    TEAM_MEMBER: 'TEAM_MEMBER',
};

const legacyToAppRole = {
    TEAM_MEMBER: ROLES.TEAM_LEADER,
    VIEWER: ROLES.TEAM_MEMBER,
};

const appToDbRole = {
    [ROLES.ADMIN]: 'ADMIN',
    [ROLES.PROJECT_MANAGER]: 'PROJECT_MANAGER',
    [ROLES.TEAM_LEADER]: 'TEAM_MEMBER',
    [ROLES.TEAM_MEMBER]: 'VIEWER',
};

export function normalizeRole(role) {
    if (!role)
        return role;
    return legacyToAppRole[role] || role;
}

export function toDbRole(role) {
    const normalized = normalizeRole(role);
    return appToDbRole[normalized] || role;
}
const rolePermissions = {
    ADMIN: [
        'users:manage',
        'users:assign-role',
        'projects:create',
        'projects:update',
        'projects:delete',
        'tasks:create',
        'tasks:update',
        'tasks:delete',
        'tasks:assign',
        'tasks:update-own-status',
        'tasks:view',
        'comments:add',
        'chat:view',
        'chat:send',
        'chat:create-group',
        'calls:initiate',
        'calls:join',
        'reports:view',
        'dashboard:view',
        'teams:manage',
    ],
    PROJECT_MANAGER: [
        'tasks:create',
        'tasks:update',
        'tasks:delete',
        'tasks:assign',
        'tasks:view',
        'comments:add',
        'chat:view',
        'chat:send',
        'chat:create-group',
        'calls:initiate',
        'calls:join',
        'reports:view',
        'dashboard:view',
    ],
    TEAM_LEADER: [
        'tasks:update-own-status',
        'tasks:view',
        'comments:add',
        'chat:view',
        'chat:send',
        'calls:join',
        'dashboard:view',
    ],
    TEAM_MEMBER: [
        'tasks:view',
        'reports:view',
        'chat:view',
        'dashboard:view',
    ],
};
export function hasPermission(role, permission) {
    const normalized = normalizeRole(role);
    return (rolePermissions[normalized] || []).includes(permission);
}
export function hasAnyRole(role, roles) {
    const normalizedRole = normalizeRole(role);
    return roles.map((item) => normalizeRole(item)).includes(normalizedRole);
}
export function roleLabel(role) {
    const normalized = normalizeRole(role) || '';
    return normalized.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
export function extractErrorMessage(error) {
    if (error instanceof AuthorizationError)
        return error.message;
    if (error instanceof Error)
        return error.message;
    return 'Something went wrong';
}
export class AuthorizationError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'AuthorizationError';
        this.status = 403;
    }
}

