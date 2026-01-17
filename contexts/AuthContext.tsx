import { auth } from '@/config/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '85293564173-aaqii4vghaolclqfvdsmoor0dq093lfa.apps.googleusercontent.com',
  iosClientId: '85293564173-s45cv8b32c8d394nhdfpqr1sb9ebigf2.apps.googleusercontent.com',
  offlineAccess: true,
});

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
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

  const signUp = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, {
      displayName: name,
    });
  };

  const signOut = async () => {
    try {
      // Sign out from Google if signed in
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        await GoogleSignin.signOut();
      }
    } catch (error) {
      console.error('Google Sign-Out Error:', error);
    }
    // Sign out from Firebase
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}