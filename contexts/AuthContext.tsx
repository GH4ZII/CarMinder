// API client and auth types used for login/signup and token handling
import { api, AuthUser, TokenResponse } from '@/frontendServices/apiCall';
import {
  registerForPushNotifications,
  removePushTokenFromBackend,
  sendPushTokenToBackend,
} from '@/frontendServices/notifications';
// Persistent storage for keeping the user logged in across app restarts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Keys used in storage; SecureStore requires alphanumeric + ".", "-", "_"
const AUTH_TOKEN_KEY = '@auth_token';
const AUTH_USER_KEY = '@auth_user';
const BIOMETRICS_ENABLED_KEY = '@use_biometrics';
const SECURE_AUTH_TOKEN_KEY = 'auth_token_secure';

function parseJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = atob(payload);
    const parsed = JSON.parse(json) as { exp?: number };
    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const exp = parseJwtExpiry(token);
  if (!exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + skewSeconds;
}

// Google Sign-In is optional: only available in dev/build, not in Expo Go.
// Dynamically require and configure so the app still runs if the package is missing.
let GoogleSignin: any = null;
let isGoogleSignInAvailable = false;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  isGoogleSignInAvailable = true;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: true, // Required to get idToken for backend verification
  });
} catch {
  isGoogleSignInAvailable = false;
}

// Shape of the auth context: current user, loading state, and auth methods
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  getToken: () => Promise<string | null>;
  forgotPassword: (email: string) => Promise<void>;
}

// React context that will hold auth state and methods; undefined when used outside AuthProvider
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Remember the user and token in AsyncStorage + SecureStore (for biometrics)
async function persistAuth(data: TokenResponse) {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  await SecureStore.setItemAsync(SECURE_AUTH_TOKEN_KEY, data.access_token);
}

// Clear the user and token from AsyncStorage
async function clearPersistedAuth() {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
  await SecureStore.deleteItemAsync(SECURE_AUTH_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pushTokenRef = useRef<string | null>(null);

  // Register for push notifications and send token to backend
  const setupPushNotifications = useCallback(async (authToken: string) => {
    const expoPushToken = await registerForPushNotifications();
    if (expoPushToken) {
      pushTokenRef.current = expoPushToken;
      await sendPushTokenToBackend(expoPushToken, authToken);
    }
  }, []);

  // Function to check if the user is logged in
  const hydrate = useCallback(async () => {
    try {
      const [t, u, secureToken, biometricsFlag] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
        SecureStore.getItemAsync(SECURE_AUTH_TOKEN_KEY),
        AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY),
      ]);
      const shouldUseBiometrics = biometricsFlag === 'true';
      const effectiveToken = shouldUseBiometrics && secureToken ? secureToken : t;
      if (effectiveToken && u) {
        if (isTokenExpired(effectiveToken)) {
          await AsyncStorage.removeItem(BIOMETRICS_ENABLED_KEY);
          await clearPersistedAuth();
          setToken(null);
          setUser(null);
          return;
        }
        setToken(effectiveToken);
        setUser(JSON.parse(u) as AuthUser);
        setupPushNotifications(effectiveToken);
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
  }, [setupPushNotifications]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Function to sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.authLogin(email, password);
    setToken(data.access_token);
    setUser(data.user);
    await persistAuth(data);
    setupPushNotifications(data.access_token);
  }, [setupPushNotifications]);

  // Function to sign up with email and password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const data = await api.authSignup(email, password, name);
    setToken(data.access_token);
    setUser(data.user);
    await persistAuth(data);
    setupPushNotifications(data.access_token);
  }, [setupPushNotifications]);

  // Function to sign in with Google
  const signInWithGoogle = useCallback(async () => {
    if (!isGoogleSignInAvailable || !GoogleSignin) {
      throw new Error('Google Sign-In er ikke tilgjengelig i Expo Go. Bruk en dev build for å teste Google Sign-In.');
    }
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken;
      if (!idToken) throw new Error('Google Sign-In avbrutt');
      const data = await api.authGoogle(idToken);
      setToken(data.access_token);
      setUser(data.user);
      await persistAuth(data);
      setupPushNotifications(data.access_token);
    } catch (e: any) {
      if (e?.code === 'sign_in_cancelled') throw new Error('Google Sign-In avbrutt');
      if (e?.code === 'in_progress') throw new Error('Google Sign-In pågår allerede');
      if (e?.code === 'play_services_not_available') throw new Error('Google Play Services ikke tilgjengelig');
      throw e;
    }
  }, [setupPushNotifications]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple-innlogging er bare tilgjengelig på iOS.');
    }

    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple-innlogging er ikke tilgjengelig på denne enheten.');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple-innlogging avbrutt');
      }

      const fullName =
        credential.fullName
          ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim() || null
          : null;

      const data = await api.authApple({
        identity_token: credential.identityToken,
        email: credential.email ?? null,
        full_name: fullName,
      });

      setToken(data.access_token);
      setUser(data.user);
      await persistAuth(data);
      setupPushNotifications(data.access_token);
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED') {
        throw new Error('Apple-innlogging avbrutt');
      }
      throw e;
    }
  }, [setupPushNotifications]);

  const signOut = useCallback(async () => {
    // Remove push token from backend before clearing auth
    if (pushTokenRef.current && token) {
      await removePushTokenFromBackend(pushTokenRef.current, token);
      pushTokenRef.current = null;
    }
    if (isGoogleSignInAvailable && GoogleSignin) {
      try {
        const cur = await GoogleSignin.getCurrentUser();
        if (cur) await GoogleSignin.signOut();
      } catch (_) {}
    }
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(BIOMETRICS_ENABLED_KEY);
    await clearPersistedAuth();
  }, [token]);

  const updateProfile = useCallback(async (updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!token) return null;
    if (!isTokenExpired(token)) return token;

    await AsyncStorage.removeItem(BIOMETRICS_ENABLED_KEY);
    await clearPersistedAuth();
    setToken(null);
    setUser(null);
    return null;
  }, [token]);

  const forgotPassword = useCallback(async (email: string) => {
    await api.authForgotPassword(email);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signInWithGoogle,
        signInWithApple,
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
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
