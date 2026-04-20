import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/frontendServices/apiCall';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.logoWrap}>
            <AntDesign name="car" size={24} color={styles.logoIcon.color} />
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to manage your vehicles</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="alex@example.com"
            placeholderTextColor="#8DA0B8"
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
          <View style={[styles.passwordWrap, errorMessage && styles.passwordWrapError]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#8DA0B8"
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
                color={errorMessage ? '#F55252' : '#8DA0B8'}
              />
            </TouchableOpacity>
          </View>

          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

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
            <View style={styles.divider} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, (loading || googleLoading) && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#D8E1EE" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#D8E1EE" />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, (loading || appleLoading) && styles.buttonDisabled]}
              onPress={handleAppleSignIn}
              disabled={loading || appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator color="#D8E1EE" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={18} color="#D8E1EE" />
                  <Text style={styles.socialButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading || googleLoading || appleLoading}
          >
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchTextAccent}>Sign up</Text>
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
    backgroundColor: '#07142B',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#07142B',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#07142B',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#2DD4BF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    color: '#072033',
  },
  title: {
    color: '#E9EEF7',
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#93A3B8',
    fontSize: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    color: '#DDE6F2',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelError: {
    color: '#F55252',
  },
  input: {
    backgroundColor: '#0A1A37',
    borderColor: '#294263',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#DDE6F2',
    minHeight: 52,
    marginBottom: 16,
  },
  passwordWrap: {
    backgroundColor: '#0A1A37',
    borderColor: '#294263',
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
    color: '#DDE6F2',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#2DD4BF',
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#2DD4BF',
    borderRadius: 10,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  loginButtonText: {
    color: '#062B32',
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
    borderColor: '#213755',
  },
  dividerText: {
    marginHorizontal: 14,
    color: '#7D8EA6',
    fontSize: 13,
  },
  socialButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#294263',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  socialButtonText: {
    color: '#DDE6F2',
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
    color: '#8392A6',
    fontSize: 14,
  },
  switchTextAccent: {
    color: '#2DD4BF',
    fontWeight: '700',
  },
});
