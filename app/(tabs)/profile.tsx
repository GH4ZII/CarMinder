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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, CarInfo } from '../../frontendServices/apiCall';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, signOut, getToken, updateProfile } = useAuth();
  const [cars, setCars] = useState<CarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [editingMileageId, setEditingMileageId] = useState<string | null>(null);
  const [mileageInput, setMileageInput] = useState('');
  const [savingMileage, setSavingMileage] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);

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

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  // Function to fetch the user's cars
  const fetchCars = useCallback(async () => {
    if (!user) return;
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setFetchError(false);
    try {
      const data = await api.getUserCars(token);
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

  const handleSaveMileage = async (carId: string) => {
    const km = parseInt(mileageInput, 10);
    if (isNaN(km) || km < 0) {
      Alert.alert('Error', 'Please enter a valid mileage');
      return;
    }
    setSavingMileage(true);
    try {
      const token = await getToken();
      if (!token) return;
      const updated = await api.updateCar(carId, token, { kilometer: km } as any);
      setCars((prev) => prev.map((c) => (c.id === carId ? updated : c)));
      setEditingMileageId(null);
      setMileageInput('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/(auth)/login');
        return;
      }
      Alert.alert('Error', 'Failed to update mileage');
    } finally {
      setSavingMileage(false);
    }
  };

  const handleSaveProfile = async () => {
    const nextName = displayName.trim();
    if (!nextName) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ displayName: nextName });
      Alert.alert('Saved', 'Profile updated.');
    } catch {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = () => {
    Alert.alert(
      'Delete Profile',
      'This removes all your cars from this app and signs you out. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              const currentCars = await api.getUserCars(token);
              await Promise.all(
                currentCars
                  .filter((c) => c.id)
                  .map((c) => api.deleteCar(c.id!, token))
              );
              await signOut();
              router.replace('/(auth)/signup');
            } catch (e) {
              if (e instanceof ApiError && e.status === 401) {
                await signOut();
                router.replace('/(auth)/login');
                return;
              }
              Alert.alert('Error', 'Failed to delete profile.');
            }
          },
        },
      ]
    );
  };

  // Function to delete a car
  const handleDelete = async (carId: string) => {
    if (!user) return;
    Alert.alert(
      'Delete Car',
      'Are you sure you want to delete this car? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              await api.deleteCar(carId, token);
              setCars((prev) => prev.filter((car) => car.id !== carId));
            } catch (e) {
              if (e instanceof ApiError && e.status === 401) {
                await signOut();
                router.replace('/(auth)/login');
                return;
              }
              Alert.alert('Error', 'Failed to delete car');
            }
          },
        },
      ]
    );
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

  const totalKm = cars.reduce((sum, c) => sum + (c.kilometer || 0), 0);
  const initials = (user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase();

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      {/* Avatar + Name */}
      <TouchableOpacity
        style={styles.avatarRow}
        onPress={() => setAccountPanelOpen((prev) => !prev)}
        activeOpacity={0.8}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.avatarInfo}>
          {user.displayName ? (
            <ThemedText style={styles.userName}>{user.displayName}</ThemedText>
          ) : null}
          <ThemedText style={styles.userEmail}>{user.email ?? '—'}</ThemedText>
          <ThemedText style={styles.avatarHint}>
            {accountPanelOpen ? 'Hide account controls' : 'Show account controls'}
          </ThemedText>
        </View>
        <Text style={styles.avatarChevron}>{accountPanelOpen ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {accountPanelOpen && (
        <>
          {/* Quick Stats */}
          {!loading && cars.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{cars.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Vehicles</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{totalKm.toLocaleString()}</ThemedText>
                <ThemedText style={styles.statLabel}>Total km</ThemedText>
              </View>
            </View>
          )}

          {/* Settings */}
          <View style={styles.settingsCard}>
            <View style={styles.settingsForm}>
              <ThemedText style={styles.settingsFormTitle}>Edit profile</ThemedText>
              <TextInput
                style={styles.profileInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor="#8A8A8A"
                maxLength={64}
              />
              <View style={styles.profileActionRow}>
                <TouchableOpacity
                  style={styles.profileResetBtn}
                  onPress={() => setDisplayName(user?.displayName ?? '')}
                >
                  <Text style={styles.profileResetBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileSaveBtn}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  <Text style={styles.profileSaveBtnText}>
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {biometricsSupported && (
              <View style={styles.settingsItem}>
                <ThemedText style={styles.settingsLabel}>FaceID / Biometrics</ThemedText>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleToggleBiometrics}
                  trackColor={{ false: '#E8E8E8', true: '#1A1A1A' }}
                  thumbColor="#fff"
                />
              </View>
            )}
            <TouchableOpacity style={styles.settingsItem} onPress={signOut}>
              <ThemedText style={styles.settingsLabel}>Sign Out</ThemedText>
              <ThemedText style={styles.settingsChevron}>→</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.dangerZone}>
            <ThemedText style={styles.dangerTitle}>Delete profile</ThemedText>
            <ThemedText style={styles.dangerText}>
              Remove all your cars and history from this app.
            </ThemedText>
            <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteProfile}>
              <Text style={styles.dangerButtonText}>Delete Profile</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.sectionRow}>
        <ThemedText type="subtitle" style={styles.section}>
          Your Cars
        </ThemedText>
        <TouchableOpacity
          style={styles.addCarButton}
          onPress={() => router.push('/(tabs)/addCar')}
        >
          <Text style={styles.addCarButtonText}>+ Add Car</Text>
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
          Could not load cars. Pull down to retry.
        </ThemedText>
      ) : (
        <>
          <ThemedText style={styles.emptyText}>
            No cars yet. Tap Add Car above to get started.
          </ThemedText>
        </>
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
            <View style={styles.carCardHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.carTitle}>
                  {item.merke} {item.modell}
                </ThemedText>
                <View style={styles.carMetaRow}>
                  <View style={styles.carMetaTag}>
                    <Text style={styles.carMetaTagText}>{item.registreringsnummer}</Text>
                  </View>
                  <View style={styles.carMetaTag}>
                    <Text style={styles.carMetaTagText}>{item.drivstoff}</Text>
                  </View>
                </View>
              </View>

              {/* Mileage display/edit */}
              {editingMileageId === item.id ? (
                <View style={styles.mileageEditRow}>
                  <TextInput
                    style={styles.mileageInput}
                    value={mileageInput}
                    onChangeText={setMileageInput}
                    keyboardType="numeric"
                    placeholder="km"
                    autoFocus
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.mileageSaveBtn}
                    onPress={() => handleSaveMileage(item.id!)}
                    disabled={savingMileage}
                  >
                    <Text style={styles.mileageSaveBtnText}>{savingMileage ? '...' : '✓'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mileageCancelBtn}
                    onPress={() => {
                      setEditingMileageId(null);
                      setMileageInput('');
                    }}
                  >
                    <Text style={styles.mileageCancelBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.mileageBadge}
                  onPress={() => {
                    setEditingMileageId(item.id!);
                    setMileageInput(String(item.kilometer));
                  }}
                >
                  <Text style={styles.mileageBadgeText}>{item.kilometer.toLocaleString()} km</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.publicToggleRow}>
              <ThemedText style={styles.publicToggleLabel}>Public history</ThemedText>
              <Switch
                value={item.public_history ?? false}
                onValueChange={(val) => handleTogglePublic(item.id!, val)}
                trackColor={{ false: '#E8E8E8', true: '#1A1A1A' }}
                thumbColor="#fff"
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
  // Avatar Section
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    paddingVertical: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  avatarInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.6,
  },
  avatarHint: {
    fontSize: 12,
    opacity: 0.45,
    marginTop: 2,
  },
  avatarChevron: {
    fontSize: 20,
    opacity: 0.45,
    marginLeft: 8,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(128,128,128,0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginHorizontal: 12,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  // Settings card
  settingsCard: {
    backgroundColor: 'rgba(128,128,128,0.06)',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  settingsForm: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  settingsFormTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#E3E3E3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111',
  },
  profileActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  profileResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  profileResetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  profileSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1A1A1A',
  },
  profileSaveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingsChevron: {
    fontSize: 16,
    opacity: 0.4,
  },
  dangerZone: {
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,59,48,0.35)',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF3B30',
  },
  dangerText: {
    fontSize: 13,
    opacity: 0.75,
    marginTop: 4,
    marginBottom: 10,
  },
  dangerButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Section
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
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
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
  // Car Card
  carCard: {
    backgroundColor: 'rgba(128,128,128,0.06)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  carCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  carTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  carMetaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  carMetaTag: {
    backgroundColor: 'rgba(128,128,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  carMetaTagText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  // Mileage
  mileageBadge: {
    backgroundColor: 'rgba(26,26,26,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mileageBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  mileageEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mileageInput: {
    width: 90,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  mileageSaveBtn: {
    backgroundColor: '#1A1A1A',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mileageSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  mileageCancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  mileageCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
  },
  // Toggle
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.12)',
    marginBottom: 4,
  },
  publicToggleLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  // Actions
  carCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  viewButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(26,26,26,0.1)',
  },
  viewButtonText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,59,48,0.1)',
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
