import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api, CarCareScoreResponse, CarInfo, CarServiceStatus, IncidentReport, MaintenanceEvent, ServiceDueStatus } from '../../../../frontendServices/apiCall';

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

const URGENCY_CONFIG = {
  overdue: { bg: 'rgba(255,59,48,0.15)', text: '#FF3B30', icon: 'warning' as const, label: 'Overdue' },
  soon: { bg: 'rgba(255,149,0,0.15)', text: '#FF9500', icon: 'notifications-active' as const, label: 'Due Soon' },
  unknown: { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93', icon: 'help-outline' as const, label: 'No Data' },
  ok: { bg: 'rgba(52,199,89,0.15)', text: '#34C759', icon: 'check-circle' as const, label: 'OK' },
};

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759',
  B: '#30D158',
  C: '#FF9500',
  D: '#FF6B00',
  F: '#FF3B30',
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = GRADE_COLORS[grade] ?? '#8E8E93';
  return (
    <View style={[scoreStyles.ring, { borderColor: color }]}>
      <Text style={[scoreStyles.grade, { color }]}>{grade}</Text>
      <Text style={[scoreStyles.scoreNum, { color }]}>{score}</Text>
    </View>
  );
}

function CategoryBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const barColor = score >= 75 ? '#34C759' : score >= 50 ? '#FF9500' : '#FF3B30';
  return (
    <View style={scoreStyles.catRow}>
      <View style={scoreStyles.catLabelRow}>
        <Text style={scoreStyles.catLabel}>{label}</Text>
        <Text style={scoreStyles.catScore}>{score}/100</Text>
      </View>
      <View style={scoreStyles.barBg}>
        <View style={[scoreStyles.barFill, { width: `${score}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function SectionDivider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(128,128,128,0.15)', marginVertical: 16 }} />;
}

function CarCareScoreCard({ data }: { data: CarCareScoreResponse }) {
  const [expanded, setExpanded] = useState(false);
  const cats = data.categories;
  return (
    <View style={scoreStyles.card}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(!expanded)}>
        <View style={scoreStyles.topRow}>
          <ScoreRing score={data.overall_score} grade={data.grade} />
          <View style={scoreStyles.summaryCol}>
            <Text style={scoreStyles.cardTitle}>Car Care Score</Text>
            <Text style={scoreStyles.summary}>{data.summary}</Text>
            <Text style={scoreStyles.confidence}>
              Confidence: {data.confidence_label.replace('_', ' ')}
            </Text>
          </View>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={24}
            color="#8E8E93"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={scoreStyles.details}>
          <View style={scoreStyles.divider} />
          <CategoryBar label={cats.maintenance_regularity.label} score={cats.maintenance_regularity.score} weight={cats.maintenance_regularity.weight} />
          <CategoryBar label={cats.eu_inspection.label} score={cats.eu_inspection.score} weight={cats.eu_inspection.weight} />
          <CategoryBar label={cats.incident_history.label} score={cats.incident_history.score} weight={cats.incident_history.weight} />
          <CategoryBar label={cats.mileage_tracking.label} score={cats.mileage_tracking.score} weight={cats.mileage_tracking.weight} />
          <CategoryBar label={cats.documentation_quality.label} score={cats.documentation_quality.score} weight={cats.documentation_quality.weight} />

          {data.recommendations.length > 0 && (
            <>
              <View style={scoreStyles.divider} />
              <Text style={scoreStyles.recsTitle}>Recommendations</Text>
              {data.recommendations.map((r, i) => (
                <View key={i} style={scoreStyles.recRow}>
                  <Text style={scoreStyles.recBullet}>•</Text>
                  <Text style={scoreStyles.recText}>{r}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(128,128,128,0.06)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grade: { fontSize: 22, fontWeight: '800' },
  scoreNum: { fontSize: 12, fontWeight: '600', marginTop: -2 },
  summaryCol: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: '#007AFF' },
  summary: { fontSize: 13, opacity: 0.85, marginBottom: 4 },
  confidence: { fontSize: 12, opacity: 0.6, textTransform: 'capitalize' },
  details: { marginTop: 12 },
  divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: 12 },
  catRow: { marginBottom: 10 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 13, fontWeight: '500', opacity: 0.9 },
  catScore: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  barBg: { height: 6, backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  recsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  recRow: { flexDirection: 'row', marginBottom: 6, paddingRight: 8 },
  recBullet: { fontSize: 14, marginRight: 6, opacity: 0.6 },
  recText: { fontSize: 13, opacity: 0.85, flex: 1 },
});

const SEVERITY_COLORS: Record<string, string> = {
  minor: '#007AFF',
  moderate: '#FF9500',
  severe: '#FF3B30',
};

const REPAIR_STATUS_LABELS: Record<string, string> = {
  not_repaired: 'Not repaired',
  partially_repaired: 'Partially repaired',
  fully_repaired: 'Fully repaired',
};

function ServiceStatusCard({ status }: { status: ServiceDueStatus }) {
  const config = URGENCY_CONFIG[status.urgency];
  return (
    <View style={[styles.serviceCard, { backgroundColor: config.bg }]}>
      <View style={styles.serviceHeader}>
        <ThemedText style={styles.serviceType}>{eventTypeLabel(status.event_type)}</ThemedText>
        <View style={styles.serviceUrgencyRow}>
          <MaterialIcons name={config.icon} size={14} color={config.text} />
          <Text style={[styles.serviceUrgency, { color: config.text }]}>
            {config.label}
          </Text>
        </View>
      </View>
      <View style={styles.serviceDetails}>
        {status.due_date && (
          <ThemedText style={styles.serviceMeta}>
            Due: {formatDate(status.due_date)}
            {status.days_until_due !== null && (
              <Text style={{ color: status.days_until_due < 0 ? '#FF3B30' : undefined }}>
                {' '}({status.days_until_due < 0 ? `${Math.abs(status.days_until_due)} days overdue` : `${status.days_until_due} days left`})
              </Text>
            )}
          </ThemedText>
        )}
        {status.due_mileage !== null && (
          <ThemedText style={styles.serviceMeta}>
            Due at: {status.due_mileage.toLocaleString()} km
            {status.km_until_due !== null && (
              <Text style={{ color: status.km_until_due < 0 ? '#FF3B30' : undefined }}>
                {' '}({status.km_until_due < 0 ? `${Math.abs(status.km_until_due).toLocaleString()} km overdue` : `${status.km_until_due.toLocaleString()} km left`})
              </Text>
            )}
          </ThemedText>
        )}
        {status.last_date && (
          <ThemedText style={styles.serviceLastDone}>
            Last: {formatDate(status.last_date)}
            {status.last_mileage !== null && ` at ${status.last_mileage.toLocaleString()} km`}
          </ThemedText>
        )}
        {!status.last_date && status.urgency === 'unknown' && (
          <ThemedText style={styles.serviceLastDone}>No record of this service</ThemedText>
        )}
      </View>
    </View>
  );
}

export default function CarTimelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { user, getToken } = useAuth();
  const [car, setCar] = useState<CarInfo | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [serviceStatus, setServiceStatus] = useState<CarServiceStatus | null>(null);
  const [careScore, setCareScore] = useState<CarCareScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetch = useCallback(async () => {
    if (!carId || !user) return;
    setLoading(true);
    setError(false);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Could not get auth token. Please sign in again.');
        return;
      }

      const [carData, eventsData, incidentsData, statusData, scoreData] = await Promise.all([
        api.getCar(carId, token),
        api.getMaintenanceEvents(carId, token).catch((e) => { console.warn('Events fetch failed:', e.message ?? e); return [] as MaintenanceEvent[]; }),
        api.getIncidents(carId, token).catch((e) => { console.warn('Incidents fetch failed:', e.message ?? e); return [] as IncidentReport[]; }),
        api.getCarServiceStatus(carId, token).catch((e) => { console.warn('Service status fetch failed:', e.message ?? e); return null; }),
        api.getCarCareScore(carId, token).catch((e) => { console.warn('Score fetch failed:', e.message ?? e); return null; }),
      ]);
      setCar(carData);
      setEvents(eventsData);
      setIncidents(incidentsData);
      setServiceStatus(statusData);
      setCareScore(scoreData);
    } catch {
      setError(true);
      setCar(null);
      setEvents([]);
      setIncidents([]);
      setServiceStatus(null);
      setCareScore(null);
      Alert.alert('Error', 'Failed to load. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [carId, user, getToken]);

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
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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

      {/* Car Care Score */}
      {careScore && <CarCareScoreCard data={careScore} />}

      {/* Alert banner for urgent services */}
      {serviceStatus?.next_service && (
        <View style={[styles.alertBanner, { backgroundColor: URGENCY_CONFIG[serviceStatus.next_service.urgency].bg }]}>
          <Text style={[styles.alertText, { color: URGENCY_CONFIG[serviceStatus.next_service.urgency].text }]}>
            {URGENCY_CONFIG[serviceStatus.next_service.urgency].icon}{' '}
            {eventTypeLabel(serviceStatus.next_service.event_type)}{' '}
            {serviceStatus.next_service.is_overdue ? 'is overdue!' : 'is due soon'}
          </Text>
        </View>
      )}

      {/* Service Status Section */}
      <SectionDivider />
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Service Status
      </ThemedText>
      {serviceStatus?.services.map((s) => (
        <ServiceStatusCard key={s.event_type} status={s} />
      ))}

      {/* Incidents section */}
      <SectionDivider />
      <View style={styles.sectionRow}>
        <ThemedText type="subtitle" style={styles.section}>
          Incidents ({incidents.length})
        </ThemedText>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: '#FF9500' }]}
          onPress={() => router.push(`/(tabs)/car/${carId}/add-incident` as any)}
        >
          <Text style={styles.addBtnText}>Report incident</Text>
        </TouchableOpacity>
      </View>
      {incidents.length === 0 ? (
        <ThemedText style={styles.noIncidents}>No incidents reported.</ThemedText>
      ) : (
        incidents.map((inc) => (
          <View key={inc.id} style={styles.incidentCard}>
            <View style={styles.incidentHeader}>
              <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[inc.severity] ?? '#8E8E93' }]}>
                <Text style={styles.severityText}>{inc.severity.toUpperCase()}</Text>
              </View>
              <ThemedText style={styles.cardDate}>{formatDate(inc.incident_date)}</ThemedText>
            </View>
            <ThemedText style={styles.incidentDesc}>{inc.description}</ThemedText>
            {inc.damage_description && (
              <ThemedText style={styles.incidentMeta}>Damage: {inc.damage_description}</ThemedText>
            )}
            <ThemedText style={styles.incidentMeta}>
              Repair: {REPAIR_STATUS_LABELS[inc.repair_status] ?? inc.repair_status}
            </ThemedText>
            {inc.mileage != null && (
              <ThemedText style={styles.incidentMeta}>{inc.mileage.toLocaleString()} km</ThemedText>
            )}
            {inc.insurance_claim && (
              <ThemedText style={styles.incidentMeta}>Insurance claim filed</ThemedText>
            )}
          </View>
        ))
      )}

      <SectionDivider />
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
  sectionTitle: { marginTop: 8, marginBottom: 12 },
  alertBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertText: { fontWeight: '600', textAlign: 'center', fontSize: 14 },
  serviceCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceType: { fontSize: 15, fontWeight: '600' },
  serviceUrgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceUrgency: { fontSize: 13, fontWeight: '600' },
  serviceDetails: { gap: 4 },
  serviceMeta: { fontSize: 13, opacity: 0.9 },
  serviceLastDone: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
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
    backgroundColor: 'rgba(128,128,128,0.08)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardType: { fontSize: 16, fontWeight: '600' },
  cardDate: { fontSize: 14, opacity: 0.8 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  meta: { fontSize: 14, opacity: 0.85 },
  notes: { fontSize: 14, opacity: 0.8, fontStyle: 'italic', marginTop: 4 },
  empty: { minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 16, textAlign: 'center', opacity: 0.8 },
  incidentCard: {
    backgroundColor: 'rgba(255,149,0,0.08)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  severityText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  incidentDesc: { fontSize: 14, marginBottom: 4 },
  incidentMeta: { fontSize: 13, opacity: 0.7, marginBottom: 2 },
  noIncidents: { fontSize: 14, opacity: 0.6, marginBottom: 8 },
});
