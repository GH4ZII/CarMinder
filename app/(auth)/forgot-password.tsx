import { useAuth } from '@/contexts/AuthContext';
import AntDesign from '@expo/vector-icons/AntDesign';
import { router } from 'expo-router';
import { useState } from 'react';
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

const AUTH_COLORS = {
  background: '#F2F7F4',
  surface: '#F8FBF9',
  text: '#102326',
  muted: '#60787B',
  border: '#D8E2DF',
  accent: '#1F6D3C',
};

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      Alert.alert(
        'Check your email',
        'If that email exists in our system, we sent a password reset link.'
      );
      router.back();
    } catch (error: any) {
      const message =
        typeof error?.message === 'string' && error.message.length
          ? error.message
          : 'Something went wrong. Please try again later.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: AUTH_COLORS.background }]}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: AUTH_COLORS.background }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: AUTH_COLORS.background }]}>
          <View style={styles.logoWrap}>
            <AntDesign name="car" size={22} color={styles.logoIcon.color} />
          </View>

          <Text style={[styles.title, { color: AUTH_COLORS.text }]}>Forgot password</Text>
          <Text style={[styles.subtitle, { color: AUTH_COLORS.muted }]}>
            Enter your email and we will send you a reset link.
          </Text>

          <Text style={[styles.label, { color: AUTH_COLORS.text }]}>Email</Text>

          <TextInput
            style={[styles.input, { backgroundColor: AUTH_COLORS.surface, borderColor: AUTH_COLORS.border, color: AUTH_COLORS.text }, errorMessage && styles.inputError]}
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

          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#00151F" />
            ) : (
              <Text style={styles.primaryButtonText}>Send reset link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={[styles.backButtonText, { color: AUTH_COLORS.accent }]}>Back to login</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    color: '#102326',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
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
    marginBottom: 10,
  },
  inputError: {
    borderColor: '#F55252',
    backgroundColor: '#171B33',
  },
  errorText: {
    color: '#F55252',
    fontSize: 13,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1F6D3C',
    borderRadius: 10,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#F3F8F5',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#1F6D3C',
    fontSize: 15,
    fontWeight: '600',
  },
})
