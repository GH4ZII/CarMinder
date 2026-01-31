import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, CarInfo, MaintenanceEvent } from '../../../../frontendServices/apiCall';

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

function formatCost(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2)}`;
}

function eventTypeLabel(t: string): string {
  const map: Record<string, string> = {
    oil_change: 'Oil change',
    brake_service: 'Brake service',
    tire_change: 'Tire change',
    inspection: 'Inspection',
    repair: 'Repair',
    other: 'Other',
  };
  return map[t] ?? t;
}

export default function CarTimelineScreen() {
  const router = useRouter();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [car, setCar] = useState<CarInfo | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetch = useCallback(async () => {
    if (!carId || !user) return;
    setLoading(true);
    setError(false);
    try {
      const [carData, eventsData] = await Promise.all([
        api.getCar(carId, user.uid),
        api.getMaintenanceEvents(carId, user.uid),
      ]);
      setCar(carData);
      setEvents(eventsData);
    } catch {
      setError(true);
      setCar(null);
      setEvents([]);
      Alert.alert('Error', 'Failed to load. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [carId, user]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  if (!carId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Missing car.</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Not logged in.</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <ThemedText type="title" style={styles.title}>
        {car ? `${car.merke} ${car.modell}` : '…'}
      </ThemedText>
      {car ? (
        <ThemedText style={styles.subtitle}>
          {car.registreringsnummer} · {car.kilometer?.toLocaleString() ?? '—'} km
        </ThemedText>
      ) : null}
      <View style={styles.sectionRow}>
        <ThemedText type="subtitle" style={styles.section}>
          Maintenance timeline
        </ThemedText>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push(`/(tabs)/car/${carId}/add-event` as any)}
        >
          <Text style={styles.addBtnText}>Add event</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : error ? (
        <ThemedText style={styles.emptyText}>Couldn’t load. Pull down to retry.</ThemedText>
      ) : (
        <ThemedText style={styles.emptyText}>No maintenance events yet. Tap Add event.</ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <ThemedText style={styles.cardType}>{eventTypeLabel(item.event_type)}</ThemedText>
              <ThemedText style={styles.cardDate}>{formatDate(item.event_date)}</ThemedText>
            </View>
            {(item.mileage != null || item.cost_cents != null || item.vendor) && (
              <View style={styles.cardMeta}>
                {item.mileage != null && (
                  <ThemedText style={styles.meta}>{item.mileage.toLocaleString()} km</ThemedText>
                )}
                {item.cost_cents != null && (
                  <ThemedText style={styles.meta}>{formatCost(item.cost_cents)}</ThemedText>
                )}
                {item.vendor && <ThemedText style={styles.meta}>{item.vendor}</ThemedText>}
              </View>
            )}
            {item.notes ? (
              <ThemedText style={styles.notes} numberOfLines={2}>
                {item.notes}
              </ThemedText>
            ) : null}
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 0, marginBottom: 8 },
  backBtnText: { fontSize: 17, color: '#007AFF', fontWeight: '500' },
  header: { padding: 20, paddingBottom: 16 },
  title: { marginBottom: 4 },
  subtitle: { fontSize: 14, opacity: 0.8, marginBottom: 16 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: { marginBottom: 0 },
  addBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  list: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    backgroundColor: 'rgba(128,128,128,0.12)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardType: { fontSize: 16, fontWeight: '600' },
  cardDate: { fontSize: 14, opacity: 0.8 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  meta: { fontSize: 14, opacity: 0.85 },
  notes: { fontSize: 14, opacity: 0.8, fontStyle: 'italic', marginTop: 4 },
  empty: { minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 16, textAlign: 'center', opacity: 0.8 },
});
