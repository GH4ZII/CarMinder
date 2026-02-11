import * as authApi from '@/api/auth';
import { getGoogleCredential } from '@/api/google';
import type { AuthUser, TokenResponse } from '@/types/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

let googleScriptLoading: Promise<void> | null = null;

async function loadGoogleScript() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.google?.accounts?.id) return;

  if (!googleScriptLoading) {
    googleScriptLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Kunne ikke laste Google Sign-In skriptet'));
      document.head.appendChild(script);
    });
  }

  await googleScriptLoading;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
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
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google-klient-ID mangler. Sett VITE_GOOGLE_CLIENT_ID i .env for web.');
    }

    await loadGoogleScript();

    const w = window as any;
    if (!w.google?.accounts?.id) {
      throw new Error('Google Sign-In er ikke tilgjengelig i denne nettleseren.');
    }

    const idToken = await new Promise<string>((resolve, reject) => {
      let resolved = false;

      w.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (response?.credential) {
            resolved = true;
            resolve(response.credential as string);
          } else {
            reject(new Error('Google-innlogging feilet: ingen legitimasjon mottatt.'));
          }
        },
      });

      w.google.accounts.id.prompt((notification: any) => {
        if (!resolved && (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.())) {
          reject(new Error('Google-innlogging ble avbrutt.'));
        }
      });
    });

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

  const getToken = useCallback((): Promise<string | null> => {
    return Promise.resolve(token);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signInWithGoogle, signUp, signOut, getToken }}
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
