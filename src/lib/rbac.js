export const ROLES = {
    ADMIN: 'ADMIN',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    TEAM_MEMBER: 'TEAM_MEMBER',
    VIEWER: 'VIEWER',
};
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
    TEAM_MEMBER: [
        'tasks:update-own-status',
        'tasks:view',
        'comments:add',
        'chat:view',
        'chat:send',
        'calls:join',
        'dashboard:view',
    ],
    VIEWER: [
        'tasks:view',
        'reports:view',
        'chat:view',
        'dashboard:view',
    ],
};
export function hasPermission(role, permission) {
    return rolePermissions[role].includes(permission);
}
export function hasAnyRole(role, roles) {
    return roles.includes(role);
}
export function roleLabel(role) {
    return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
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

