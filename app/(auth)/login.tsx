import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/frontendServices/apiCall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
  Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const REMEMBER_ME_KEY = '@remember_me_enabled';
const REMEMBERED_EMAIL_KEY = '@remembered_email';
const REMEMBERED_PASSWORD_KEY = 'remembered_password_secure';
const AUTH_COLORS = {
  background: '#F2F7F4',
  surface: '#F8FBF9',
  text: '#102326',
  muted: '#60787B',
  border: '#D8E2DF',
  accent: '#1F6D3C',
  accentSoft: '#C6E8D8',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rememberMeFlag, savedEmail, savedPassword] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_ME_KEY),
          AsyncStorage.getItem(REMEMBERED_EMAIL_KEY),
          SecureStore.getItemAsync(REMEMBERED_PASSWORD_KEY),
        ]);
        if (!mounted) return;
        const shouldRemember = rememberMeFlag !== 'false';
        setRememberMe(shouldRemember);
        if (shouldRemember) {
          if (savedEmail) setEmail(savedEmail);
          if (savedPassword) setPassword(savedPassword);
        }
      } catch {
        // Ignore storage read errors and keep defaults.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS !== 'ios') {
          if (mounted) {
            setAppleAvailable(false);
          }
          return;
        }
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (mounted) {
          setAppleAvailable(isAvailable);
        }
      } catch {
        if (mounted) {
          setAppleAvailable(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      if (rememberMe) {
        await Promise.all([
          AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'),
          AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim()),
          SecureStore.setItemAsync(REMEMBERED_PASSWORD_KEY, password),
        ]);
      } else {
        await Promise.all([
          AsyncStorage.setItem(REMEMBER_ME_KEY, 'false'),
          AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY),
          SecureStore.deleteItemAsync(REMEMBERED_PASSWORD_KEY),
        ]);
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      let parsedMessage = 'Login failed. Please try again.';
      const d = error?.detail ?? error?.message ?? '';
      if (d.includes('EMAIL_NOT_FOUND') || d.includes('INVALID_LOGIN')) {
        parsedMessage = 'User not found. Please check your email.';
      } else if (d.includes('INVALID_PASSWORD')) {
        parsedMessage = 'Incorrect password. Please try again.';
      } else if (d.includes('INVALID_EMAIL') || (d.includes('invalid') && d.includes('email'))) {
        parsedMessage = 'Invalid email address.';
      } else if (typeof d === 'string' && d.length) {
        parsedMessage = d;
      }
      setErrorMessage(parsedMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = 'Google sign-in failed. Please try again.';
      const d = error instanceof ApiError ? error.detail : error?.message ?? '';
      if (typeof d === 'string' && (d.includes('INVALID_IDP_RESPONSE') || d.includes('INVALID_CREDENTIAL'))) {
        errorMessage = 'Google sign-in failed. Please try again or use email.';
      } else if (typeof d === 'string' && d.length && !d.includes('cancelled') && !d.includes('in progress') && !d.includes('Play Services')) {
        errorMessage = d;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setErrorMessage('');
    setAppleLoading(true);
    try {
      await signInWithApple();
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = 'Apple sign-in failed. Please try again.';
      const d = error instanceof ApiError ? error.detail : error?.message ?? '';
      if (typeof d === 'string' && (d.includes('INVALID_IDP_RESPONSE') || d.includes('INVALID_CREDENTIAL'))) {
        errorMessage = 'Apple sign-in failed. Please try again or use email.';
      } else if (typeof d === 'string' && d.length && !d.includes('cancelled')) {
        errorMessage = d;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: AUTH_COLORS.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: AUTH_COLORS.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: AUTH_COLORS.background }]}>
          <View style={styles.logoWrap}>
            <AntDesign name="car" size={24} color={styles.logoIcon.color} />
          </View>

          <Text style={[styles.title, { color: AUTH_COLORS.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: AUTH_COLORS.muted }]}>Log in to manage your vehicles</Text>

          <Text style={[styles.label, { color: AUTH_COLORS.text }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: AUTH_COLORS.surface, borderColor: AUTH_COLORS.border, color: AUTH_COLORS.text }]}
            placeholder="alex@example.com"
            placeholderTextColor={AUTH_COLORS.muted}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errorMessage) {
                setErrorMessage('');
              }
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />

          <Text style={[styles.label, errorMessage && styles.labelError]}>Password</Text>
          <View style={[styles.passwordWrap, { backgroundColor: AUTH_COLORS.surface, borderColor: AUTH_COLORS.border }, errorMessage && styles.passwordWrapError]}>
            <TextInput
              style={[styles.passwordInput, { color: AUTH_COLORS.text }]}
              placeholder="Enter your password"
              placeholderTextColor={AUTH_COLORS.muted}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              disabled={loading}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={errorMessage ? '#F55252' : AUTH_COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <TouchableOpacity
            style={styles.rememberMeRow}
            onPress={() => setRememberMe((prev) => !prev)}
            disabled={loading}
          >
            <Ionicons
              name={rememberMe ? 'checkbox' : 'square-outline'}
              size={20}
              color={rememberMe ? AUTH_COLORS.accent : AUTH_COLORS.muted}
            />
            <Text style={[styles.rememberMeText, { color: AUTH_COLORS.text }]}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/(auth)/forgot-password')}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#00151F" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { borderColor: AUTH_COLORS.border }]} />
            <Text style={[styles.dividerText, { color: AUTH_COLORS.muted }]}>Or continue with</Text>
            <View style={[styles.divider, { borderColor: AUTH_COLORS.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, { borderColor: AUTH_COLORS.border }, (loading || googleLoading) && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={AUTH_COLORS.muted} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={AUTH_COLORS.text} />
                <Text style={[styles.socialButtonText, { color: AUTH_COLORS.text }]}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity
              style={[styles.socialButton, { borderColor: AUTH_COLORS.border }, styles.appleButton, (loading || appleLoading) && styles.buttonDisabled]}
              onPress={handleAppleSignIn}
              disabled={loading || appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator color={AUTH_COLORS.muted} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={18} color={AUTH_COLORS.text} />
                  <Text style={[styles.socialButtonText, { color: AUTH_COLORS.text }]}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading || googleLoading || appleLoading}
          >
            <Text style={[styles.switchText, { color: AUTH_COLORS.muted }]}>
              Don't have an account? <Text style={[styles.switchTextAccent, { color: AUTH_COLORS.accent }]}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F7F4',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#F2F7F4',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#F2F7F4',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#C6E8D8',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    color: '#1F6D3C',
  },
  title: {
    color: '#102326',
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#60787B',
    fontSize: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    color: '#102326',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelError: {
    color: '#F55252',
  },
  input: {
    backgroundColor: '#F8FBF9',
    borderColor: '#D8E2DF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#102326',
    minHeight: 52,
    marginBottom: 16,
  },
  passwordWrap: {
    backgroundColor: '#F8FBF9',
    borderColor: '#D8E2DF',
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  passwordWrapError: {
    borderColor: '#F55252',
    backgroundColor: '#171B33',
  },
  passwordInput: {
    flex: 1,
    color: '#102326',
    fontSize: 16,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
  },
  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: '#F55252',
    fontSize: 13,
    marginTop: 8,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  rememberMeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#1F6D3C',
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#1F6D3C',
    borderRadius: 10,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  loginButtonText: {
    color: '#F3F8F5',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: '#D8E2DF',
  },
  dividerText: {
    marginHorizontal: 14,
    color: '#60787B',
    fontSize: 13,
  },
  socialButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D8E2DF',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  socialButtonText: {
    color: '#102326',
    fontSize: 15,
    fontWeight: '600',
  },
  appleButton: {
    marginBottom: 20,
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    color: '#60787B',
    fontSize: 14,
  },
  switchTextAccent: {
    color: '#1F6D3C',
    fontWeight: '700',
  },
});
