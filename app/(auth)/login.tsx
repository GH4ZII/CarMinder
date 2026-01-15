import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import { useState } from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,TextInput,TouchableOpacity, } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const borderColor = useThemeColor({}, 'text');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'text');

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
      if (isSignUp) {
        await signUp(email.trim(), password);
        Alert.alert('Suksess', 'Konto opprettet!', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]);
      } else {
        await signIn(email.trim(), password);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      let errorMessage = 'En feil oppstod';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Bruker ikke funnet';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Feil passord';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'E-postadressen er allerede i bruk';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ugyldig e-postadresse';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Passordet er for svakt';
      }
      Alert.alert('Feil', errorMessage);
    } finally {
      setLoading(false);
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
            {isSignUp ? 'Opprett konto' : 'Logg inn'}
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            {isSignUp
              ? 'Opprett en ny konto for å komme i gang'
              : 'Logg inn for å fortsette'}
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
            autoComplete={isSignUp ? 'password-new' : 'password'}
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
              <ThemedText style={styles.buttonText}>
                {isSignUp ? 'Opprett konto' : 'Logg inn'}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            <ThemedText style={styles.switchText}>
              {isSignUp
                ? 'Har du allerede en konto? Logg inn'
                : 'Har du ikke en konto? Opprett konto'}
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
});