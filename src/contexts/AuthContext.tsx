import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState } from '@/types';
import * as api from '@/services/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = localStorage.getItem('taskflow_auth');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return { user: null, token: null, isAuthenticated: false };
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
    setState({ user: result.user, token: result.token, isAuthenticated: true });
    return true;
  }, []);

  const registerFn = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.register(name, email, password);
    setState({ user: result.user, token: result.token, isAuthenticated: true });
    return true;
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, token: null, isAuthenticated: false });
  }, []);

  const updateProfile = useCallback((data: Partial<User>) => {
    setState(prev => prev.user ? { ...prev, user: { ...prev.user, ...data } } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login: loginFn, register: registerFn, logout, updateProfile, isAdmin: state.user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
