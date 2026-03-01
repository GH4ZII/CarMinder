import * as authApi from '@/api/auth';
import { getGoogleCredential } from '@/api/google';
import type { AuthUser, TokenResponse } from '@/types/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  getToken: () => Promise<string | null>;
  forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistAuth(data: TokenResponse) {
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
}

function clearPersistedAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(() => {
    try {
      const t = localStorage.getItem(AUTH_TOKEN_KEY);
      const u = localStorage.getItem(AUTH_USER_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u) as AuthUser);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await authApi.authLogin(email, password);
    setToken(data.access_token);
    setUser(data.user);
    persistAuth(data);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const idToken = await getGoogleCredential();
    const data = await authApi.authGoogle(idToken);
    setToken(data.access_token);
    setUser(data.user);
    persistAuth(data);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const data = await authApi.authSignup(email, password, name);
    setToken(data.access_token);
    setUser(data.user);
    persistAuth(data);
  }, []);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    clearPersistedAuth();
  }, []);

  const updateProfile = useCallback(async (updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getToken = useCallback((): Promise<string | null> => {
    return Promise.resolve(token);
  }, [token]);

  const forgotPassword = useCallback(async (email: string) => {
    await authApi.authForgotPassword(email);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        updateProfile,
        getToken,
        forgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
