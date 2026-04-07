import { UserRole } from '@/types';

export const ROLES = {
  ADMIN: 'ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  TEAM_MEMBER: 'TEAM_MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type Permission =
  | 'users:manage'
  | 'users:assign-role'
  | 'projects:create'
  | 'projects:update'
  | 'projects:delete'
  | 'tasks:create'
  | 'tasks:update'
  | 'tasks:delete'
  | 'tasks:assign'
  | 'tasks:update-own-status'
  | 'tasks:view'
  | 'comments:add'
  | 'chat:view'
  | 'chat:send'
  | 'chat:create-group'
  | 'calls:initiate'
  | 'calls:join'
  | 'reports:view'
  | 'dashboard:view'
  | 'teams:manage';

const rolePermissions: Record<UserRole, Permission[]> = {
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

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function hasAnyRole(role: UserRole, roles: UserRole[]): boolean {
  return roles.includes(role);
}

export function roleLabel(role: UserRole): string {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export class AuthorizationError extends Error {
  status: number;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
    this.status = 403;
  }
}
