import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  AllCarsServiceStatus,
  api,
  CarServiceStatus,
  ServiceDueStatus,
} from '../../frontendServices/apiCall';

const SERVICE_LABELS: Record<string, string> = {
  oil_change: 'Oil Change',
  brake_service: 'Brake Service',
  tire_change: 'Tire Change',
  inspection: 'Inspection (EU)',
  repair: 'Repair',
  other: 'Other',
};

const URGENCY_CONFIG = {
  overdue: { bg: 'rgba(255,59,48,0.15)', text: '#FF3B30', icon: 'warning' as const, label: 'Overdue' },
  soon: { bg: 'rgba(255,149,0,0.15)', text: '#FF9500', icon: 'notifications-active' as const, label: 'Due Soon' },
  unknown: { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93', icon: 'help-outline' as const, label: 'No Data' },
  ok: { bg: 'rgba(52,199,89,0.15)', text: '#34C759', icon: 'check-circle' as const, label: 'OK' },
};

function ServiceBadge({ status }: { status: ServiceDueStatus }) {
  const config = URGENCY_CONFIG[status.urgency];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <MaterialIcons name={config.icon} size={16} color={config.text} style={styles.badgeIcon} />
      <View style={styles.badgeContent}>
        <ThemedText style={styles.badgeType}>
          {SERVICE_LABELS[status.event_type] ?? status.event_type}
        </ThemedText>
        <Text style={[styles.badgeStatus, { color: config.text }]}>{config.label}</Text>
        {status.days_until_due !== null && (
          <ThemedText style={styles.badgeMeta}>
            {status.days_until_due < 0
              ? `${Math.abs(status.days_until_due)} days overdue`
              : `${status.days_until_due} days left`}
          </ThemedText>
        )}
        {status.km_until_due !== null && (
          <ThemedText style={styles.badgeMeta}>
            {status.km_until_due < 0
              ? `${Math.abs(status.km_until_due).toLocaleString()} km overdue`
              : `${status.km_until_due.toLocaleString()} km left`}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function CarServiceCard({
  car,
  onPress,
}: {
  car: CarServiceStatus;
  onPress: () => void;
}) {
  const urgentServices = car.services.filter((s) => s.urgency === 'overdue' || s.urgency === 'soon');
  const hasUrgent = urgentServices.length > 0;

  return (
    <TouchableOpacity
      style={[styles.carCard, hasUrgent && styles.carCardUrgent]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.carHeader}>
        <View>
          <ThemedText style={styles.carName}>{car.car_name}</ThemedText>
          <ThemedText style={styles.carReg}>{car.registration}</ThemedText>
        </View>
        <ThemedText style={styles.carMileage}>
          {car.current_mileage.toLocaleString()} km
        </ThemedText>
      </View>

      {car.next_service && (
        <View style={styles.nextServiceBanner}>
          <MaterialIcons
            name={URGENCY_CONFIG[car.next_service.urgency].icon}
            size={18}
            color={URGENCY_CONFIG[car.next_service.urgency].text}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.nextServiceText,
                { color: URGENCY_CONFIG[car.next_service.urgency].text },
              ]}
            >
              {SERVICE_LABELS[car.next_service.event_type]}{' '}
              {car.next_service.is_overdue ? 'is overdue!' : 'due soon'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.servicesGrid}>
        {car.services.map((s) => (
          <ServiceBadge key={s.event_type} status={s} />
        ))}
      </View>

      <Text style={styles.tapHint}>Tap to view details →</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, getToken } = useAuth();
  const [status, setStatus] = useState<AllCarsServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token = await getToken();
      if (!token) {
        setError(true);
        return;
      }
      const data = await api.getAllServiceStatus(token);
      setStatus(data);
    } catch (e) {
      console.error('Failed to fetch service status:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus])
  );

  // Not logged in
  if (!user) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="title" style={styles.welcomeTitle}>
          Welcome to CarMinder
        </ThemedText>
        <ThemedText style={styles.welcomeText}>
          Track your car maintenance and never miss a service.
        </ThemedText>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.loginBtnText}>Sign In</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStatus} />}
    >
      <ThemedText type="title" style={styles.title}>
        Service Overview
      </ThemedText>

      {/* Summary Banner */}
      {status && (
        <View style={styles.summaryBanner}>
          {status.urgent_count > 0 ? (
            <>
              <MaterialIcons name="warning" size={28} color="#FF3B30" />
              <View>
                <ThemedText style={styles.summaryText}>
                  {status.overdue_count > 0 && (
                    <Text style={{ color: '#FF3B30' }}>
                      {status.overdue_count} overdue
                    </Text>
                  )}
                  {status.overdue_count > 0 && status.soon_count > 0 && ', '}
                  {status.soon_count > 0 && (
                    <Text style={{ color: '#FF9500' }}>
                      {status.soon_count} due soon
                    </Text>
                  )}
                </ThemedText>
                <ThemedText style={styles.summarySubtext}>
                  across {status.cars.length} vehicle{status.cars.length !== 1 ? 's' : ''}
                </ThemedText>
              </View>
            </>
          ) : (
            <>
              <MaterialIcons name="check-circle" size={28} color="#34C759" />
              <View>
                <ThemedText style={styles.summaryText}>All services up to date</ThemedText>
                <ThemedText style={styles.summarySubtext}>
                  {status.cars.length} vehicle{status.cars.length !== 1 ? 's' : ''} tracked
                </ThemedText>
              </View>
            </>
          )}
        </View>
      )}

      {/* Loading / Error / Empty States */}
      {loading && !status && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading service status...</ThemedText>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            Couldn't load service status. Pull down to retry.
          </ThemedText>
        </View>
      )}

      {status && status.cars.length === 0 && (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No cars added yet.</ThemedText>
          <TouchableOpacity
            style={styles.addCarBtn}
            onPress={() => router.push('/(tabs)/addCar')}
          >
            <Text style={styles.addCarBtnText}>Add Your First Car</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Car Cards */}
      {status?.cars.map((car) => (
        <CarServiceCard
          key={car.car_id}
          car={car}
          onPress={() => router.push(`/(tabs)/car/${car.car_id}` as any)}
        />
      ))}

      {/* Add Car Button (if has cars) */}
      {status && status.cars.length > 0 && (
        <TouchableOpacity
          style={styles.addMoreBtn}
          onPress={() => router.push('/(tabs)/addCar')}
        >
          <Text style={styles.addMoreBtnText}>+ Add Another Car</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { marginBottom: 16 },

  // Welcome (logged out)
  welcomeTitle: { marginBottom: 12, textAlign: 'center' },
  welcomeText: { fontSize: 16, textAlign: 'center', opacity: 0.8, marginBottom: 24 },
  loginBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  // Summary Banner
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  summaryIcon: {},
  summaryText: { fontSize: 16, fontWeight: '600' },
  summarySubtext: { fontSize: 14, opacity: 0.7, marginTop: 2 },

  // Loading/Error/Empty
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, opacity: 0.7 },
  errorContainer: { alignItems: 'center', paddingVertical: 40 },
  errorText: { textAlign: 'center', opacity: 0.8 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, opacity: 0.8, marginBottom: 16 },
  addCarBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addCarBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Car Card
  carCard: {
    backgroundColor: 'rgba(128,128,128,0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  carCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  carHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  carName: { fontSize: 18, fontWeight: '700' },
  carReg: { fontSize: 14, opacity: 0.7, marginTop: 2 },
  carMileage: { fontSize: 14, opacity: 0.8 },

  // Next Service Alert
  nextServiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.12)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  nextServiceIcon: {},
  nextServiceText: { fontSize: 14, fontWeight: '600' },

  // Services Grid
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Service Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    minWidth: '48%',
    flexGrow: 1,
    gap: 8,
  },
  badgeIcon: { marginTop: 2 },
  badgeContent: { flex: 1 },
  badgeType: { fontSize: 13, fontWeight: '600' },
  badgeStatus: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  badgeMeta: { fontSize: 11, opacity: 0.8, marginTop: 2 },

  tapHint: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'right',
    marginTop: 12,
    opacity: 0.8,
  },

  // Add More Button
  addMoreBtn: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
    borderStyle: 'dashed',
  },
  addMoreBtnText: { fontSize: 15, color: '#007AFF', fontWeight: '500' },
});
