// API client and auth types used for login/signup and token handling
import { api, AuthUser, TokenResponse } from '@/frontendServices/apiCall';
import {
  registerForPushNotifications,
  removePushTokenFromBackend,
  sendPushTokenToBackend,
} from '@/frontendServices/notifications';
// Persistent storage for keeping the user logged in across app restarts
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Keys used in AsyncStorage to store the JWT and user object
const AUTH_TOKEN_KEY = '@auth_token';
const AUTH_USER_KEY = '@auth_user';

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
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  forgotPassword: (email: string) => Promise<void>;
}

// React context that will hold auth state and methods; undefined when used outside AuthProvider
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Remember the user and token in AsyncStorage
async function persistAuth(data: TokenResponse) {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
}

// Clear the user and token from AsyncStorage
async function clearPersistedAuth() {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
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
      const [t, u] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
      ]);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u) as AuthUser);
        setupPushNotifications(t);
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
    await clearPersistedAuth();
  }, [token]);

  const getToken = useCallback((): Promise<string | null> => {
    return Promise.resolve(token);
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
        signUp,
        signOut,
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
