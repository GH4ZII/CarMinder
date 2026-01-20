import { auth } from '@/config/firebase';
import {
  GoogleAuthProvider, // Convert Google token -> Firebase credential
  User,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Lazy load Google Sign-In only when needed (not available in Expo Go)
let GoogleSignin: any = null;
let isGoogleSignInAvailable = false;

try {
  // Try to import GoogleSignin - this will fail in Expo Go
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  isGoogleSignInAvailable = true;
  // Configure Google Sign-In only if available
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: true,
  });
} catch (error) {
  // GoogleSignin is not available (e.g., in Expo Go)
  console.log('Google Sign-In not available (running in Expo Go?)');
  isGoogleSignInAvailable = false;
}

// Firebase Auth Context Type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}


// Creates a Context that provides access to authentication data throughout the app
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Main component that provides authentication functionality to all child components
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Listen to changes in Firebase authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user); 
      setLoading(false); 
    });

    return unsubscribe;
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    if (!isGoogleSignInAvailable || !GoogleSignin) {
      throw new Error('Google Sign-In er ikke tilgjengelig i Expo Go. Bruk en dev build for å teste Google Sign-In.');
    }

    try {
      // Check if device supports Google Play Services (Android only)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Get user info from Google
      const userInfo = await GoogleSignin.signIn();

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(userInfo.data?.idToken);

      // Sign in with Firebase using the Google credential
      await signInWithCredential(auth, googleCredential);
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code === 'sign_in_cancelled') {
        throw new Error('Google Sign-In avbrutt');
      } else if (error.code === 'in_progress') {
        throw new Error('Google Sign-In pågår allerede');
      } else if (error.code === 'play_services_not_available') {
        throw new Error('Google Play Services ikke tilgjengelig');
      } else {
        throw new Error('Google Sign-In feilet. Prøv igjen.');
      }
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, {
      displayName: name,
    });
  };

  // Sign out from Google and Firebase
  const signOut = async () => {
    if (isGoogleSignInAvailable && GoogleSignin) {
      try {
        // Sign out from Google if signed in
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser) {
          await GoogleSignin.signOut();
        }
      } catch (error) {
        console.error('Google Sign-Out Error:', error);
      }
    }
    // Sign out from Firebase
    await firebaseSignOut(auth);
  };

  // Provide the authentication context to all child components
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to access the authentication context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}