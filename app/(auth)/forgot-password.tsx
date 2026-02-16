import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
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

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const borderColor = useThemeColor({}, 'text');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'text');

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Feil', 'Vennligst skriv inn e-postadressen din');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      Alert.alert(
        'Sjekk e-posten din',
        'Hvis e-posten finnes i systemet vårt, har vi sendt en lenke for å resette passordet.'
      );
      router.back();
    } catch (error: any) {
      const message =
        typeof error?.message === 'string' && error.message.length
          ? error.message
          : 'Noe gikk galt. Prøv igjen senere.';
      Alert.alert('Feil', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Glemt passord
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            Skriv inn e-posten din, så sender vi en lenke for å resette passordet.
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

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Send reset-lenke</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <ThemedText style={styles.switchText}>Tilbake til innlogging</ThemedText>
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
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
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
    color: '#0a7ea4',
    fontSize: 14,
  },
})

