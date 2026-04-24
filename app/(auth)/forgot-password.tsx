import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

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
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.background }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: palette.background }]}>
          <View style={styles.logoWrap}>
            <AntDesign name="car" size={22} color={styles.logoIcon.color} />
          </View>

          <Text style={[styles.title, { color: palette.text }]}>Forgot password</Text>
          <Text style={[styles.subtitle, { color: palette.icon }]}>
            Enter your email and we will send you a reset link.
          </Text>

          <Text style={[styles.label, { color: palette.text }]}>Email</Text>

          <TextInput
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }, errorMessage && styles.inputError]}
            placeholder="alex@example.com"
            placeholderTextColor={palette.icon}
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
            <Text style={[styles.backButtonText, { color: palette.accent }]}>Back to login</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    color: '#DDE6F2',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
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
    backgroundColor: '#2DD4BF',
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
    color: '#062B32',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#2DD4BF',
    fontSize: 15,
    fontWeight: '600',
  },
})
