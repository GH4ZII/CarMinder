import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/contexts/AuthContext'; 
import { useColorScheme } from '@/hooks/use-color-scheme'; 

// This tells the app which screen to show first (the main tabs screen)
export const unstable_settings = {
  anchor: '(tabs)',
};

// This is the main navigation component - it decides which screen to show
function RootLayoutNav() {
  // Check if user has dark mode or light mode turned on
  const colorScheme = useColorScheme();
  
  // Get info about the logged-in user (null if no one is logged in)
  // Also check if we're still checking the login status
  const { user, loading } = useAuth();
  
  // Get the current page/route the user is on (like "/login" or "/home")
  const segments = useSegments();
  
  // Get the router so we can send users to different pages
  const router = useRouter();

  // This runs every time the user, loading status, or current page changes
  useEffect(() => {
    // If we're still checking if user is logged in, don't do anything yet
    if (loading) return;

    // Check if user is currently on a login/signup page (the "(auth)" pages)
    const inAuthGroup = segments[0] === '(auth)';

    // If user is NOT logged in AND they're NOT on a login page, send them to login
    if (!user && !inAuthGroup) {
      // Send user to the login screen
      router.replace('/(auth)/login');
    } 
    // If user IS logged in AND they're on a login page, send them to the main app
    else if (user && inAuthGroup) {
      // Send user to the main app (tabs screen)
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  // If we're still checking if user is logged in, show a loading spinner
  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  // Show the actual app with all the screens
  return (
    // Set the theme (dark or light mode) based on user's preference
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Create a stack of screens (like a deck of cards - you can navigate between them) */}
      <Stack>
        {/* Login and signup screens (no header shown) */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        {/* Main app screens with tabs at bottom (no header shown) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* Status bar at top of phone (changes color based on theme) */}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

// This is the very first component that loads when app starts
export default function RootLayout() {
  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') return;

    (async () => {
      try {
        const [{ obdService }, { BleElm327ObdTransport }] = await Promise.all([
          import('@/frontendServices/obdService'),
          import('@/frontendServices/bleObdTransport'),
        ]);
        if (!active) return;
        obdService.setTransport(new BleElm327ObdTransport());
      } catch (error) {
        console.warn('Failed to initialize BLE OBD transport:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    // Wrap everything with AuthProvider so all screens can access login functions
    <AuthProvider>
      {/* Show the main navigation component */}
      <RootLayoutNav />
    </AuthProvider>
  );
}

// Styles for the loading screen (spinner in the center)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, // Take up the whole screen
    justifyContent: 'center', // Center things up and down
    alignItems: 'center', // Center things left and right
  },
});
