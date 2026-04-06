import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Permission } from '@/lib/rbac';
import { UserRole } from '@/types';

export function ProtectedRoute({
  children,
  adminOnly = false,
  allowedRoles,
  requiredPermission,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedRoles?: UserRole[];
  requiredPermission?: Permission;
}) {
  const { isAuthenticated, isAdmin, hasRole, can } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (allowedRoles && !hasRole(allowedRoles)) return <Navigate to="/dashboard" replace />;
  if (requiredPermission && !can(requiredPermission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
