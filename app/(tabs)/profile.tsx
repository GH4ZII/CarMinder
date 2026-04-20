import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [transferCarName, setTransferCarName] = useState('');
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

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

  const handleTransfer = async (car: CarInfo) => {
    if (!car.id) return;
    Alert.alert(
      'Transfer Car',
      `Generate a transfer code for ${car.merke} ${car.modell}? The new owner will use this code to claim the car with all its history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate Code',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              const result = await api.initiateTransfer(car.id!, token);
              setTransferCarName(`${car.merke} ${car.modell}`);
              setTransferCode(result.transfer_code);
            } catch (e) {
              if (e instanceof ApiError && e.status === 401) {
                await signOut();
                router.replace('/(auth)/login');
                return;
              }
              Alert.alert('Error', 'Failed to generate transfer code.');
            }
          },
        },
      ]
    );
  };

  const handleCopyTransferCode = async () => {
    if (!transferCode) return;
    await Clipboard.setStringAsync(transferCode);
    Alert.alert('Copied', 'Transfer code copied to clipboard.');
  };

  const handleClaimCar = async () => {
    const code = claimCodeInput.trim();
    if (!code) {
      Alert.alert('Error', 'Please enter a transfer code.');
      return;
    }
    setClaimLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const claimed = await api.claimCar(code, token);
      setCars((prev) => [...prev, claimed]);
      setClaimModalOpen(false);
      setClaimCodeInput('');
      Alert.alert('Success', `${claimed.merke} ${claimed.modell} has been added to your garage with all its history.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/(auth)/login');
        return;
      }
      const msg = e instanceof ApiError ? (e.detail ?? e.message) : 'Invalid or expired transfer code.';
      Alert.alert('Error', msg);
    } finally {
      setClaimLoading(false);
    }
  };

  const handleRetire = (car: CarInfo) => {
    if (!car.id) return;
    Alert.alert(
      'Retire Car',
      `Permanently retire ${car.merke} ${car.modell}? This marks it as damaged beyond repair. The VIN will be blocked from ever being registered again. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retire',
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              const updated = await api.retireCar(car.id!, token);
              setCars((prev) => prev.map((c) => (c.id === car.id ? updated : c)));
            } catch (e) {
              if (e instanceof ApiError && e.status === 401) {
                await signOut();
                router.replace('/(auth)/login');
                return;
              }
              Alert.alert('Error', 'Failed to retire car.');
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
                  trackColor={{ false: '#294263', true: '#2DD4BF' }}
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
        <View style={styles.sectionActions}>
          <TouchableOpacity
            style={styles.claimCarButton}
            onPress={() => setClaimModalOpen(true)}
          >
            <Text style={styles.claimCarButtonText}>Claim Car</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addCarButton}
            onPress={() => router.push('/(tabs)/addCar')}
          >
            <Text style={styles.addCarButtonText}>+ Add Car</Text>
          </TouchableOpacity>
        </View>
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
        renderItem={({ item }) => {
          const isRetired = !!item.retired_at;
          return (
          <View style={[styles.carCard, isRetired && styles.carCardRetired]}>
            <View style={styles.carCardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.carTitleRow}>
                  <ThemedText style={[styles.carTitle, isRetired && { opacity: 0.5 }]}>
                    {item.merke} {item.modell}
                  </ThemedText>
                  {isRetired && (
                    <View style={styles.retiredBadge}>
                      <Text style={styles.retiredBadgeText}>Retired</Text>
                    </View>
                  )}
                </View>
                <View style={styles.carMetaRow}>
                  <View style={styles.carMetaTag}>
                    <Text style={styles.carMetaTagText}>{item.registreringsnummer}</Text>
                  </View>
                  <View style={styles.carMetaTag}>
                    <Text style={styles.carMetaTagText}>{item.drivstoff}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.mileageBadge}
                disabled={isRetired}
                onPress={() => {
                  if (isRetired) return;
                  setEditingMileageId(item.id!);
                  setMileageInput(String(item.kilometer));
                }}
              >
                <Text style={styles.mileageBadgeText}>{item.kilometer.toLocaleString()} km</Text>
              </TouchableOpacity>
            </View>

            {!isRetired && (
              <View style={styles.publicToggleRow}>
                <ThemedText style={styles.publicToggleLabel}>Public history</ThemedText>
                <Switch
                  value={item.public_history ?? false}
                  onValueChange={(val) => handleTogglePublic(item.id!, val)}
                  trackColor={{ false: '#294263', true: '#2DD4BF' }}
                  thumbColor="#fff"
                />
              </View>
            )}
            <View style={styles.carCardActions}>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => router.push(`/(tabs)/car/${item.id}` as any)}
              >
                <Text style={styles.viewButtonText}>View timeline</Text>
              </TouchableOpacity>
              {!isRetired && (
                <>
                  <TouchableOpacity
                    style={styles.transferButton}
                    onPress={() => handleTransfer(item)}
                  >
                    <Text style={styles.transferButtonText}>Transfer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.retireButton}
                    onPress={() => handleRetire(item)}
                  >
                    <Text style={styles.retireButtonText}>Retire</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id!)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchCars} />
        }
      />

      {/* Transfer Code Modal */}
      <Modal visible={!!transferCode} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Transfer Code</Text>
            <Text style={styles.modalSubtitle}>
              Share this code with the new owner of {transferCarName}. They can use it to claim the car with all its history.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>{transferCode}</Text>
            </View>
            <Text style={styles.modalHint}>Code expires in 24 hours</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyTransferCode}>
                <Text style={styles.copyButtonText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setTransferCode(null)}
              >
                <Text style={styles.modalCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Claim Car Modal */}
      <Modal visible={claimModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Claim a Car</Text>
            <Text style={styles.modalSubtitle}>
              Enter the transfer code from the previous owner to add their car (with all history) to your garage.
            </Text>
            <TextInput
              style={styles.claimInput}
              value={claimCodeInput}
              onChangeText={setClaimCodeInput}
              placeholder="Paste transfer code"
              placeholderTextColor="#8A8A8A"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setClaimModalOpen(false);
                  setClaimCodeInput('');
                }}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.copyButton, claimLoading && { opacity: 0.6 }]}
                onPress={handleClaimCar}
                disabled={claimLoading}
              >
                <Text style={styles.copyButtonText}>
                  {claimLoading ? 'Claiming...' : 'Claim Car'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#102449',
    borderWidth: 1,
    borderColor: '#294263',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2DD4BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#062B32',
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
    fontSize: 14,
    color: '#B8C6DA',
    marginTop: 4,
    fontWeight: '600',
  },
  avatarChevron: {
    fontSize: 24,
    color: '#B8C6DA',
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
    borderColor: '#294263',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#07142B',
    color: '#E9EEF7',
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
    backgroundColor: '#2DD4BF',
  },
  profileSaveBtnText: {
    color: '#062B32',
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
    backgroundColor: '#2DD4BF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addCarButtonText: {
    color: '#062B32',
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
    color: '#DDE6F2',
  },
  mileageEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mileageInput: {
    width: 90,
    borderWidth: 1,
    borderColor: '#294263',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  mileageSaveBtn: {
    backgroundColor: '#2DD4BF',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mileageSaveBtnText: {
    color: '#062B32',
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
    color: '#2DD4BF',
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
  // Retired state
  carCardRetired: {
    opacity: 0.7,
    borderColor: 'rgba(255,59,48,0.25)',
  },
  carTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  retiredBadge: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  retiredBadgeText: {
    color: '#FF3B30',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  retireButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,149,0,0.1)',
  },
  retireButtonText: {
    color: '#FF9500',
    fontSize: 15,
    fontWeight: '600',
  },
  // Transfer button
  transferButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  transferButtonText: {
    color: '#2DD4BF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Section actions row
  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  claimCarButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  claimCarButtonText: {
    color: '#2DD4BF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0A1A37',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E9EEF7',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8DA0B8',
    lineHeight: 20,
    marginBottom: 20,
  },
  codeBox: {
    backgroundColor: '#07142B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Courier',
    color: '#E9EEF7',
    letterSpacing: 1,
  },
  modalHint: {
    fontSize: 12,
    color: '#8DA0B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  copyButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2DD4BF',
  },
  copyButtonText: {
    color: '#062B32',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8DA0B8',
  },
  claimInput: {
    borderWidth: 1,
    borderColor: '#294263',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#07142B',
    color: '#E9EEF7',
    marginBottom: 20,
    fontFamily: 'Courier',
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
