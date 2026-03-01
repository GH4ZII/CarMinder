import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/frontendServices/apiCall';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const REMEMBER_ME_KEY = '@remember_me';
const SAVED_EMAIL_KEY = '@saved_email';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleCheckError, setAppleCheckError] = useState<string | null>(null);
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

  const borderColor = useThemeColor({}, 'text');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'text');

  // Load remembered credentials on mount
  useEffect(() => {
    loadRememberedCredentials();
  }, []);

  // Check if Apple Sign-In is actually available on this device/build
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('LoginScreen: Platform.OS =', Platform.OS);
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('LoginScreen: AppleAuthentication.isAvailableAsync() =', isAvailable);
        if (mounted) {
          setAppleAvailable(isAvailable);
          setAppleCheckError(null);
        }
      } catch (e: any) {
        console.log('LoginScreen: AppleAuthentication.isAvailableAsync() error', e);
        if (mounted) {
          setAppleAvailable(false);
          setAppleCheckError(
            typeof e?.message === 'string'
              ? e.message
              : 'Apple-innlogging er ikke tilgjengelig i denne builden/enheten.',
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load remembered credentials from AsyncStorage
  const loadRememberedCredentials = async () => {
    try {
      const remembered = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      if (remembered === 'true') {
        setRememberMe(true);
        const savedEmail = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
        }
      }
    } catch (error) {
      console.error('Error loading remembered credentials:', error);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Feil', 'Vennligst fyll ut alle felt');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Feil', 'Passordet må være minst 6 tegn');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      
      // Save credentials if remember me is checked
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
        await AsyncStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
        await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      }
      
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = 'En feil oppstod';
      const d = error?.detail ?? error?.message ?? '';
      if (d.includes('EMAIL_NOT_FOUND') || d.includes('INVALID_LOGIN')) {
        errorMessage = 'Bruker ikke funnet';
      } else if (d.includes('INVALID_PASSWORD')) {
        errorMessage = 'Feil passord';
      } else if (d.includes('INVALID_EMAIL') || d.includes('invalid') && d.includes('email')) {
        errorMessage = 'Ugyldig e-postadresse';
      } else if (typeof d === 'string' && d.length) {
        errorMessage = d;
      }
      Alert.alert('Feil', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = 'Google innlogging feilet. Prøv igjen.';
      const d = error instanceof ApiError ? error.detail : error?.message ?? '';
      if (typeof d === 'string' && (d.includes('INVALID_IDP_RESPONSE') || d.includes('INVALID_CREDENTIAL'))) {
        errorMessage = 'Google-innlogging feilet. Prøv igjen eller bruk e-post.';
      } else if (typeof d === 'string' && d.length && !d.includes('avbrutt') && !d.includes('pågår') && !d.includes('Play Services')) {
        errorMessage = d;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      Alert.alert('Feil', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      await signInWithApple();
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = 'Apple-innlogging feilet. Prøv igjen.';
      const d = error instanceof ApiError ? error.detail : error?.message ?? '';
      if (typeof d === 'string' && (d.includes('INVALID_IDP_RESPONSE') || d.includes('INVALID_CREDENTIAL'))) {
        errorMessage = 'Apple-innlogging feilet. Prøv igjen eller bruk e-post.';
      } else if (typeof d === 'string' && d.length && !d.includes('avbrutt')) {
        errorMessage = d;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      Alert.alert('Feil', errorMessage);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Logg inn
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            Logg inn for å fortsette
          </ThemedText>

          <TextInput
            style={[styles.input, { borderColor, color: textColor }]}
            placeholder="E-post"
            placeholderTextColor={placeholderColor + '80'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />

          <TextInput
            style={[styles.input, { borderColor, color: textColor }]}
            placeholder="Passord"
            placeholderTextColor={placeholderColor + '80'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/(auth)/forgot-password')}
            disabled={loading}
          >
            <ThemedText style={styles.forgotPasswordText}>Glemt passord?</ThemedText>
          </TouchableOpacity>

          <View style={styles.rememberMeContainer}>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              disabled={loading}
              trackColor={{ false: '#767577', true: '#1A1A1A' }}
              thumbColor={rememberMe ? '#fff' : '#f4f3f4'}
            />
            <ThemedText style={styles.rememberMeText}>
              Husk meg
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>
                Logg inn
              </ThemedText>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { borderColor }]} />
            <ThemedText style={styles.dividerText}>eller</ThemedText>
            <View style={[styles.divider, { borderColor }]} />
          </View>

          {!appleAvailable && appleCheckError && (
            <ThemedText style={styles.appleDebugText}>
              Apple-innlogging utilgjengelig: {appleCheckError}
            </ThemedText>
          )}

          <TouchableOpacity
            style={[styles.googleButton, (loading || googleLoading) && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ThemedText style={styles.googleButtonText}>🔍</ThemedText>
                <ThemedText style={styles.googleButtonText}>
                  Fortsett med Google
                </ThemedText>
              </>
            )}
          </TouchableOpacity>

          {appleAvailable && (
            <View style={styles.appleButtonContainer}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={999}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
              {appleLoading && (
                <View style={styles.appleLoadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading || googleLoading}
          >
            <ThemedText style={styles.switchText}>
              Har du ikke en konto? Opprett konto
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rememberMeText: {
    marginLeft: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    opacity: 0.7,
  },
  googleButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  googleButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButtonContainer: {
    marginTop: 12,
    marginBottom: 4,
    position: 'relative',
  },
  appleButton: {
    width: '100%',
    height: 50,
    borderRadius: 999,
  },
  appleLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleDebugText: {
    marginBottom: 12,
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
});