import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
export function ProtectedRoute({ children, adminOnly = false, allowedRoles, requiredPermission, }) {
    const { isAuthenticated, isAuthReady, isAdmin, hasRole, can } = useAuth();
    if (!isAuthReady)
        return <div className="min-h-[40vh]" />;
    if (!isAuthenticated)
        return <Navigate to="/login" replace/>;
    if (adminOnly && !isAdmin)
        return <Navigate to="/dashboard" replace/>;
    if (allowedRoles && !hasRole(allowedRoles))
        return <Navigate to="/dashboard" replace/>;
    if (requiredPermission && !can(requiredPermission))
        return <Navigate to="/dashboard" replace/>;
    return <>{children}</>;
}


