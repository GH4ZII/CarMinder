import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      Alert.alert('Success', 'Account created!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (error: any) {
      let errorMessage = 'An error occurred';
      const d = error?.detail ?? error?.message ?? '';
      if (d.includes('EMAIL_EXISTS')) {
        errorMessage = 'Email is already in use';
      } else if (d.includes('INVALID_EMAIL') || (d.includes('invalid') && d.includes('email'))) {
        errorMessage = 'Invalid email address';
      } else if (d.includes('WEAK_PASSWORD')) {
        errorMessage = 'Password is too weak';
      } else if (typeof d === 'string' && d.length) {
        errorMessage = d;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { backgroundColor: palette.background }]}>
          <ThemedText type="title" style={styles.title}>
            Create account
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            Create a new account to get started
          </ThemedText>

          <TextInput
            placeholder="Name"
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }]}
            placeholderTextColor={palette.icon}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            editable={!loading}
          />

          <TextInput
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }]}
            placeholder="Email"
            placeholderTextColor={palette.icon}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />

          <TextInput
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }]}
            placeholder="Password"
            placeholderTextColor={palette.icon}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!loading}
          />

          <TextInput
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }]}
            placeholder="Confirm password"
            placeholderTextColor={palette.icon}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#062B32" />
            ) : (
              <ThemedText style={[styles.buttonText, { color: '#000000' }]}>
                Create account
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => router.push('/(auth)/login')}
            disabled={loading}
          >
            <ThemedText style={[styles.switchText, { color: palette.accent }]}>
              Already have an account? Log in
            </ThemedText>
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
  content: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#07142B',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8DA0B8',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0A1A37',
    borderColor: '#294263',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#DDE6F2',
    fontSize: 16,
    marginBottom: 16,
    minHeight: 52,
  },
  button: {
    backgroundColor: '#2DD4BF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#062B32',
    fontSize: 15,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#2DD4BF',
    fontSize: 14,
    fontWeight: '500',
  },
});
