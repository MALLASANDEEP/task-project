import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState } from '@/types';
import * as api from '@/services/api';
import { hasPermission, Permission } from '@/lib/rbac';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  isAdmin: boolean;
  role: User['role'] | null;
  hasRole: (roles: User['role'] | User['role'][]) => boolean;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = localStorage.getItem('taskflow_auth');
    const initialState = stored
      ? (() => { try { return JSON.parse(stored); } catch { return { user: null, token: null, isAuthenticated: false }; } })()
      : { user: null, token: null, isAuthenticated: false };

    api.setActiveUserId(initialState.user?.id || null);
    return initialState;
  });

  useEffect(() => {
    if (state.isAuthenticated) {
      localStorage.setItem('taskflow_auth', JSON.stringify(state));
    } else {
      localStorage.removeItem('taskflow_auth');
    }
  }, [state]);

  const loginFn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    if (!result) return false;
    api.setActiveUserId(result.user.id);
    setState({ user: result.user, token: result.token, isAuthenticated: true });
    return true;
  }, []);

  const registerFn = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.register(name, email, password);
    api.setActiveUserId(result.user.id);
    setState({ user: result.user, token: result.token, isAuthenticated: true });
    return true;
  }, []);

  const logout = useCallback(() => {
    api.setActiveUserId(null);
    setState({ user: null, token: null, isAuthenticated: false });
  }, []);

  const updateProfile = useCallback((data: Partial<User>) => {
    setState(prev => prev.user ? { ...prev, user: { ...prev.user, ...data } } : prev);
  }, []);

  useEffect(() => {
    api.setActiveUserId(state.user?.id || null);
  }, [state.user?.id]);

  const role = state.user?.role || null;
  const isAdmin = role === 'ADMIN';

  const hasRole = useCallback((roles: User['role'] | User['role'][]) => {
    if (!role) return false;
    return Array.isArray(roles) ? roles.includes(role) : role === roles;
  }, [role]);

  const can = useCallback((permission: Permission) => {
    if (!role) return false;
    return hasPermission(role, permission);
  }, [role]);

  return (
    <AuthContext.Provider value={{ ...state, login: loginFn, register: registerFn, logout, updateProfile, isAdmin, role, hasRole, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
