import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, CarInfo } from '../../frontendServices/apiCall';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, signOut, getToken } = useAuth();
  const [cars, setCars] = useState<CarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  const BIOMETRICS_ENABLED_KEY = '@use_biometrics';
  const SECURE_AUTH_TOKEN_KEY = 'auth_token_secure';
  const SECURE_BIOMETRICS_ENABLED_KEY = 'use_biometrics_flag';

  useEffect(() => {
    const checkBiometrics = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsSupported(hasHardware && isEnrolled);

      if (hasHardware && isEnrolled) {
        const stored = await SecureStore.getItemAsync(SECURE_BIOMETRICS_ENABLED_KEY);
        setBiometricsEnabled(stored === 'true');
      }
    };

    checkBiometrics();
  }, []);

  // Function to fetch the user's cars
  const fetchCars = useCallback(async () => {
    if (!user) return;
    const token = await getToken(); // Get the token from the AuthContext
    if (!token) return;
    setLoading(true);
    setFetchError(false);
    try {
      const data = await api.getUserCars(token); // Get the user's cars from the API
      setCars(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/(auth)/login');
        return;
      }
      setFetchError(true);
      setCars([]);
      Alert.alert('Error', 'Failed to fetch cars. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [user, getToken, signOut, router]);

  useFocusEffect(
    useCallback(() => {
      fetchCars();
    }, [fetchCars])
  );

  const handleTogglePublic = async (carId: string, value: boolean) => {
    if (!user) return;
    const token = await getToken();
    if (!token) return;
    try {
      const updated = await api.updateCar(carId, token, { public_history: value } as any);
      setCars((prev) => prev.map((c) => (c.id === carId ? updated : c)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/(auth)/login');
        return;
      }
      Alert.alert('Error', 'Failed to update visibility setting.');
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    if (!biometricsSupported) {
      Alert.alert('Ikke tilgjengelig', 'Biometrisk innlogging er ikke tilgjengelig på denne enheten.');
      return;
    }
    if (value) {
      const token = await getToken();
      if (!token) {
        Alert.alert('Feil', 'Kunne ikke aktivere biometri uten gyldig innlogging.');
        return;
      }
      await SecureStore.setItemAsync(SECURE_AUTH_TOKEN_KEY, token);
      await SecureStore.setItemAsync(SECURE_BIOMETRICS_ENABLED_KEY, 'true');
      setBiometricsEnabled(true);
    } else {
      await SecureStore.deleteItemAsync(SECURE_AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(SECURE_BIOMETRICS_ENABLED_KEY);
      setBiometricsEnabled(false);
    }
  };

  // Function to delete a car
  const handleDelete = async (carId: string) => {
    if (!user) return;
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteCar(carId, token); // Delete the car from the API
      setCars((prev) => prev.filter((car) => car.id !== carId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/(auth)/login');
        return;
      }
      Alert.alert('Error', 'Failed to delete car');
    }
  };

  if (authLoading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText style={styles.notLoggedIn}>Not logged in</ThemedText>
      </ThemedView>
    );
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <ThemedText type="title" style={styles.title}>
        Profile
      </ThemedText>
      <ThemedText style={styles.info}>Email: {user.email ?? '—'}</ThemedText>
      {user.displayName ? (
        <ThemedText style={styles.info}>Name: {user.displayName}</ThemedText>
      ) : null}
      {biometricsSupported && (
        <View style={styles.biometricRow}>
          <ThemedText style={styles.biometricLabel}>Bruk FaceID/biometri for rask innlogging</ThemedText>
          <Switch
            value={biometricsEnabled}
            onValueChange={handleToggleBiometrics}
          />
        </View>
      )}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
      <View style={styles.sectionRow}>
        <ThemedText type="subtitle" style={styles.section}>
          Your Cars
        </ThemedText>
        <TouchableOpacity
          style={styles.addCarButton}
          onPress={() => router.push('/(tabs)/addCar')}
        >
          <Text style={styles.addCarButtonText}>Add Car</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : fetchError ? (
        <ThemedText style={styles.emptyText}>
          Couldn't load cars. Pull down to retry.
        </ThemedText>
      ) : (
        <ThemedText style={styles.emptyText}>
          No cars yet. Tap Add Car above to add one.
        </ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={cars}
        keyExtractor={(item) => item.id ?? ''}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyComponent}
        renderItem={({ item }) => (
          <View style={styles.carCard}>
            <ThemedText style={styles.carTitle}>
              {item.merke} {item.modell} ({item.registreringsnummer})
            </ThemedText>
            <View style={styles.publicToggleRow}>
              <ThemedText style={styles.publicToggleLabel}>Public history</ThemedText>
              <Switch
                value={item.public_history ?? false}
                onValueChange={(val) => handleTogglePublic(item.id!, val)}
              />
            </View>
            <View style={styles.carCardActions}>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => router.push(`/(tabs)/car/${item.id}` as any)}
              >
                <Text style={styles.viewButtonText}>View timeline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id!)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchCars} />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notLoggedIn: {
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  title: {
    marginBottom: 8,
  },
  info: {
    fontSize: 16,
    marginBottom: 6,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    marginBottom: 0,
  },
  addCarButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addCarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  carCard: {
    backgroundColor: 'rgba(128,128,128,0.12)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  carTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  publicToggleLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  carCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  viewButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.15)',
  },
  viewButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,59,48,0.15)',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
});
