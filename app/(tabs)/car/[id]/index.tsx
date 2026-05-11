import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, CarCareScoreResponse, CarInfo, CarServiceStatus, IncidentReport, MaintenanceEvent, ServiceDueStatus, api } from '../../../../frontendServices/apiCall';
import { ObdSnapshot, obdService } from '../../../../frontendServices/obdService';

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

function CategoryBar({
  label,
  score,
  weight,
  isLight,
}: {
  label: string;
  score: number;
  weight: number;
  isLight: boolean;
}) {
  const barColor = score >= 75 ? '#34C759' : score >= 50 ? '#FF9500' : '#FF3B30';
  return (
    <View style={scoreStyles.catRow}>
      <View style={scoreStyles.catLabelRow}>
        <Text style={[scoreStyles.catLabel, isLight && { color: '#102016' }]}>{label}</Text>
        <Text style={[scoreStyles.catScore, isLight && { color: '#102016' }]}>{score}/100</Text>
      </View>
      <View style={scoreStyles.barBg}>
        <View style={[scoreStyles.barFill, { width: `${score}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function formatObdValue(value: number | null, unit: string): string {
  if (value == null) return '—';
  return `${value.toLocaleString()} ${unit}`.trim();
}

function CarCareScoreCard({
  data,
  isLight,
}: {
  data: CarCareScoreResponse;
  isLight: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cats = data.categories;
  return (
    <View
      style={[
        scoreStyles.card,
        isLight && { backgroundColor: '#FFFFFF', borderColor: '#BFE9CD' },
      ]}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(!expanded)}>
        <View style={scoreStyles.topRow}>
          <ScoreRing score={data.overall_score} grade={data.grade} />
          <View style={scoreStyles.summaryCol}>
            <Text style={[scoreStyles.cardTitle, isLight && { color: '#102016' }]}>Car Care Score</Text>
            <Text style={[scoreStyles.summary, isLight && { color: '#5F7768' }]}>{data.summary}</Text>
            <Text style={[scoreStyles.confidence, isLight && { color: '#5F7768' }]}>
              Confidence: {data.confidence_label.replace('_', ' ')}
            </Text>
          </View>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={24}
            color={isLight ? '#5F7768' : '#8E8E93'}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={scoreStyles.details}>
          <View style={[scoreStyles.divider, isLight && { backgroundColor: '#D8E5DD' }]} />
          <CategoryBar label={cats.maintenance_regularity.label} score={cats.maintenance_regularity.score} weight={cats.maintenance_regularity.weight} isLight={isLight} />
          <CategoryBar label={cats.eu_inspection.label} score={cats.eu_inspection.score} weight={cats.eu_inspection.weight} isLight={isLight} />
          <CategoryBar label={cats.incident_history.label} score={cats.incident_history.score} weight={cats.incident_history.weight} isLight={isLight} />
          <CategoryBar label={cats.mileage_tracking.label} score={cats.mileage_tracking.score} weight={cats.mileage_tracking.weight} isLight={isLight} />
          <CategoryBar label={cats.documentation_quality.label} score={cats.documentation_quality.score} weight={cats.documentation_quality.weight} isLight={isLight} />

          {data.recommendations.length > 0 && (
            <>
              <View style={[scoreStyles.divider, isLight && { backgroundColor: '#D8E5DD' }]} />
              <Text style={[scoreStyles.recsTitle, isLight && { color: '#102016' }]}>Recommendations</Text>
              {data.recommendations.map((r, i) => (
                <View key={i} style={scoreStyles.recRow}>
                  <Text style={[scoreStyles.recBullet, isLight && { color: '#102016' }]}>•</Text>
                  <Text style={[scoreStyles.recText, isLight && { color: '#102016' }]}>{r}</Text>
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
    backgroundColor: '#0A1A37',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#294263',
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
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: '#E9EEF7' },
  summary: { fontSize: 13, color: '#8DA0B8', marginBottom: 4 },
  confidence: { fontSize: 12, color: '#8DA0B8', textTransform: 'capitalize' },
  details: { marginTop: 12 },
  divider: { height: 1, backgroundColor: '#294263', marginVertical: 12 },
  catRow: { marginBottom: 10 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 13, fontWeight: '500', color: '#DDE6F2' },
  catScore: { fontSize: 13, fontWeight: '600', color: '#8DA0B8' },
  barBg: { height: 6, backgroundColor: '#102449', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  recsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  recRow: { flexDirection: 'row', marginBottom: 6, paddingRight: 8 },
  recBullet: { fontSize: 14, marginRight: 6, color: '#8DA0B8' },
  recText: { fontSize: 13, color: '#8DA0B8', flex: 1 },
});

const SEVERITY_COLORS: Record<string, string> = {
  minor: '#2DD4BF',
  moderate: '#FF9500',
  severe: '#FF3B30',
};

const REPAIR_STATUS_LABELS: Record<string, string> = {
  not_repaired: 'Not repaired',
  partially_repaired: 'Partially repaired',
  fully_repaired: 'Fully repaired',
};

function ServiceStatusCard({ status, isLight }: { status: ServiceDueStatus; isLight: boolean }) {
  const config = URGENCY_CONFIG[status.urgency];
  return (
    <View
      style={[
        styles.serviceCard,
        { backgroundColor: config.bg },
        isLight && { borderWidth: 1, borderColor: '#BFE9CD' },
      ]}
    >
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { user, getToken } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isLight = scheme === 'light';
  const [car, setCar] = useState<CarInfo | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [serviceStatus, setServiceStatus] = useState<CarServiceStatus | null>(null);
  const [careScore, setCareScore] = useState<CarCareScoreResponse | null>(null);
  const [obdSnapshot, setObdSnapshot] = useState<ObdSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [obdOpen, setObdOpen] = useState(false);
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [incidentPhotoView, setIncidentPhotoView] = useState<{
    incident: IncidentReport;
    images: { id: string; url?: string | null }[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  const openIncidentPhotos = useCallback(
    async (inc: IncidentReport) => {
      setIncidentPhotoView({ incident: inc, images: [], loading: true, error: null });
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert('Error', 'Not signed in');
          setIncidentPhotoView(null);
          return;
        }
        const imgs = await api.listIncidentImages(carId, inc.id, token);
        setIncidentPhotoView({
          incident: inc,
          images: imgs.filter((i) => Boolean(i.url)),
          loading: false,
          error: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not load photos';
        setIncidentPhotoView({
          incident: inc,
          images: [],
          loading: false,
          error: msg,
        });
      }
    },
    [carId, getToken]
  );

  const handleExportPdf = useCallback(async () => {
    if (!carId) return;
    try {
      setExporting(true);
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Could not get auth token. Please sign in again.');
        return;
      }

      const arrayBuffer = await api.getCarReportPdf(carId, token);
      const file = new File(Paths.cache, `car-report-${carId}.pdf`);
      file.write(new Uint8Array(arrayBuffer));

      const shareUri = file.contentUri ?? file.uri;
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', dialogTitle: 'Car report PDF' });
      } else {
        await Linking.openURL(shareUri);
      }
    } catch (e) {
      console.error('Car report export failed', e);
      if (e instanceof ApiError) {
        if (e.status === 401) {
          Alert.alert('Error', 'Please sign in again.');
          return;
        }
        Alert.alert('Error', e.message || 'Could not export PDF. Please try again.');
      } else {
        Alert.alert(
          'Error',
          'Could not export PDF. Check your connection and that the API is reachable.'
        );
      }
    } finally {
      setExporting(false);
    }
  }, [carId, getToken]);

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

      const [carData, eventsData, incidentsData, statusData, scoreData, lastObdSnapshot, backendReading] = await Promise.all([
        api.getCar(carId, token),
        api.getMaintenanceEvents(carId, token).catch((e) => { console.warn('Events fetch failed:', e.message ?? e); return [] as MaintenanceEvent[]; }),
        api.getIncidents(carId, token).catch((e) => { console.warn('Incidents fetch failed:', e.message ?? e); return [] as IncidentReport[]; }),
        api.getCarServiceStatus(carId, token).catch((e) => { console.warn('Service status fetch failed:', e.message ?? e); return null; }),
        api.getCarCareScore(carId, token).catch((e) => { console.warn('Score fetch failed:', e.message ?? e); return null; }),
        obdService.getLastSnapshot(carId).catch(() => null),
        api.getLatestObdReading(carId, token).catch(() => null),
      ]);
      setCar(carData);
      setEvents(eventsData);
      setIncidents(incidentsData);
      setServiceStatus(statusData);
      setCareScore(scoreData);

      // Pick the most recent snapshot between local cache and backend
      let bestSnapshot = lastObdSnapshot;
      if (backendReading) {
        const backendAsSnapshot: ObdSnapshot = {
          capturedAt: backendReading.captured_at,
          source: backendReading.source,
          metrics: {
            rpm: backendReading.rpm,
            coolantTempC: backendReading.coolant_temp_c,
            speedKph: backendReading.speed_kph,
            engineLoadPct: backendReading.engine_load_pct,
            batteryVoltage: backendReading.battery_voltage,
            fuelRateLph: backendReading.fuel_rate_lph,
            fuelConsumptionL100km: backendReading.fuel_consumption_l_100km,
            massAirFlowGps: backendReading.mass_air_flow_gps,
            fuelRateSource: backendReading.fuel_rate_source,
          },
          dtcs: backendReading.dtcs,
        };
        if (!bestSnapshot || new Date(backendReading.captured_at) > new Date(bestSnapshot.capturedAt)) {
          bestSnapshot = backendAsSnapshot;
        }
      }
      setObdSnapshot(bestSnapshot);
    } catch {
      setError(true);
      setCar(null);
      setEvents([]);
      setIncidents([]);
      setServiceStatus(null);
      setCareScore(null);
      setObdSnapshot(null);
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
      <ThemedText type="title" style={styles.title}>
        {car ? `${car.merke} ${car.modell}` : '…'}
      </ThemedText>
      {car ? (
        <ThemedText style={styles.subtitle}>
          {car.registreringsnummer} · {car.kilometer?.toLocaleString() ?? '—'} km
        </ThemedText>
      ) : null}

      <TouchableOpacity
        style={[styles.addBtn, styles.exportBtn, isLight && { backgroundColor: '#DFF7E8' }]}
        onPress={handleExportPdf}
        disabled={exporting}
      >
        <Text style={[styles.addBtnText, isLight && { color: '#1C5A34' }]}>{exporting ? 'Generating…' : 'Export PDF'}</Text>
      </TouchableOpacity>

      {/* Car Care Score */}
      {careScore && <CarCareScoreCard data={careScore} isLight={isLight} />}

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
      <TouchableOpacity
        style={[styles.expandRow, styles.expandCard, isLight && styles.expandCardLight]}
        onPress={() => setServiceOpen((prev) => !prev)}
        activeOpacity={0.75}
      >
        <ThemedText type="subtitle" style={styles.sectionTitle}>Service Status</ThemedText>
        <MaterialIcons name={serviceOpen ? 'expand-less' : 'expand-more'} size={22} color={isLight ? '#1C5A34' : '#8DA0B8'} />
      </TouchableOpacity>
      {serviceOpen && serviceStatus?.services.map((s) => (
        <ServiceStatusCard key={s.event_type} status={s} isLight={isLight} />
      ))}

      <TouchableOpacity
        style={[styles.expandRow, styles.expandCard, isLight && styles.expandCardLight]}
        onPress={() => setObdOpen((prev) => !prev)}
        activeOpacity={0.75}
      >
        <ThemedText type="subtitle" style={styles.section}>OBD-II diagnostics</ThemedText>
        <MaterialIcons name={obdOpen ? 'expand-less' : 'expand-more'} size={22} color={isLight ? '#1C5A34' : '#8DA0B8'} />
      </TouchableOpacity>
      {obdOpen && (
        <>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              style={[
                styles.addBtn,
                styles.secondaryBtn,
                isLight && { backgroundColor: '#EFF6F1', borderColor: '#BFE9CD' },
              ]}
              onPress={() => router.push(`/(tabs)/car/${carId}/obd-dashboard` as any)}
            >
              <Text style={[styles.addBtnText, styles.secondaryBtnText, isLight && { color: '#1C5A34' }]}>View Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, isLight && { backgroundColor: '#DFF7E8' }]}
              onPress={() => router.push(`/(tabs)/car/${carId}/obd-scan` as any)}
            >
              <Text style={[styles.addBtnText, isLight && { color: '#1C5A34' }]}>Open Scanner</Text>
            </TouchableOpacity>
          </View>
          {obdSnapshot ? (
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.obdCard}
              onPress={() => router.push(`/(tabs)/car/${carId}/obd-dashboard` as any)}
            >
              <View style={styles.obdHeaderRow}>
                <ThemedText style={styles.obdCardTitle}>
                  Latest reading {obdSnapshot.source === 'simulated' ? '(Demo)' : '(Device)'}
                </ThemedText>
                <ThemedText style={styles.obdTimestamp}>{formatDate(obdSnapshot.capturedAt)}</ThemedText>
              </View>

              <View style={styles.obdMetricsGrid}>
                <View style={[styles.obdMetricItem, isLight && styles.obdMetricItemLight]}>
                  <ThemedText style={[styles.obdMetricLabel, isLight && styles.obdMetricLabelLight]}>RPM</ThemedText>
                  <ThemedText style={[styles.obdMetricValue, isLight && { color: '#102016' }]}>{formatObdValue(obdSnapshot.metrics.rpm, '')}</ThemedText>
                </View>
                <View style={[styles.obdMetricItem, isLight && styles.obdMetricItemLight]}>
                  <ThemedText style={[styles.obdMetricLabel, isLight && styles.obdMetricLabelLight]}>Coolant</ThemedText>
                  <ThemedText style={[styles.obdMetricValue, isLight && { color: '#102016' }]}>{formatObdValue(obdSnapshot.metrics.coolantTempC, '°C')}</ThemedText>
                </View>
                <View style={[styles.obdMetricItem, isLight && styles.obdMetricItemLight]}>
                  <ThemedText style={[styles.obdMetricLabel, isLight && styles.obdMetricLabelLight]}>Speed</ThemedText>
                  <ThemedText style={[styles.obdMetricValue, isLight && { color: '#102016' }]}>{formatObdValue(obdSnapshot.metrics.speedKph, 'km/h')}</ThemedText>
                </View>
                <View style={[styles.obdMetricItem, isLight && styles.obdMetricItemLight]}>
                  <ThemedText style={[styles.obdMetricLabel, isLight && styles.obdMetricLabelLight]}>Engine Load</ThemedText>
                  <ThemedText style={[styles.obdMetricValue, isLight && { color: '#102016' }]}>{formatObdValue(obdSnapshot.metrics.engineLoadPct, '%')}</ThemedText>
                </View>
                <View style={[styles.obdMetricItem, isLight && styles.obdMetricItemLight]}>
                  <ThemedText style={[styles.obdMetricLabel, isLight && styles.obdMetricLabelLight]}>Battery</ThemedText>
                  <ThemedText style={[styles.obdMetricValue, isLight && { color: '#102016' }]}>{formatObdValue(obdSnapshot.metrics.batteryVoltage, 'V')}</ThemedText>
                </View>
                <View style={[styles.obdMetricItem, isLight && styles.obdMetricItemLight]}>
                  <ThemedText style={[styles.obdMetricLabel, isLight && styles.obdMetricLabelLight]}>Fuel Use</ThemedText>
                  <ThemedText style={[styles.obdMetricValue, isLight && { color: '#102016' }]}>{formatObdValue(obdSnapshot.metrics.fuelConsumptionL100km, 'L/100km')}</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.obdDtcTitle}>
                Error codes ({obdSnapshot.dtcs.length})
              </ThemedText>
              {obdSnapshot.dtcs.length === 0 ? (
                <ThemedText style={styles.obdNoCodes}>No stored trouble codes.</ThemedText>
              ) : (
                obdSnapshot.dtcs.map((dtc) => (
                  <View key={dtc.code} style={styles.obdCodeItem}>
                    <Text style={styles.obdCode}>{dtc.code}</Text>
                    <ThemedText style={styles.obdCodeDesc}>{dtc.description}</ThemedText>
                  </View>
                ))
              )}
              <ThemedText style={styles.obdTapHint}>Tap to open charts and history.</ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={styles.obdEmptyCard}>
              <ThemedText style={styles.obdHint}>No OBD snapshot yet.</ThemedText>
              <ThemedText style={styles.obdTapHint}>The dashboard will show gauges, trends, and trouble code history after your first scan.</ThemedText>
            </View>
          )}
        </>
      )}

      {/* Incidents section */}
      <TouchableOpacity
        style={[styles.expandRow, styles.expandCard, isLight && styles.expandCardLight]}
        onPress={() => setIncidentsOpen((prev) => !prev)}
        activeOpacity={0.75}
      >
        <ThemedText type="subtitle" style={styles.section}>Incidents ({incidents.length})</ThemedText>
        <MaterialIcons name={incidentsOpen ? 'expand-less' : 'expand-more'} size={22} color={isLight ? '#1C5A34' : '#8DA0B8'} />
      </TouchableOpacity>
      {incidentsOpen && (
        <>
          <TouchableOpacity
            style={[styles.addBtn, isLight && { backgroundColor: '#DFF7E8' }]}
            onPress={() => router.push(`/(tabs)/car/${carId}/add-incident` as any)}
          >
            <Text style={[styles.addBtnText, isLight && { color: '#1C5A34' }]}>Report incident</Text>
          </TouchableOpacity>
          {incidents.length === 0 ? (
            <ThemedText style={styles.noIncidents}>No incidents reported.</ThemedText>
          ) : (
            incidents.map((inc) => {
              const nPhotos = inc.images?.length ?? 0;
              return (
                <TouchableOpacity
                  key={inc.id}
                  activeOpacity={0.85}
                  onPress={() => openIncidentPhotos(inc)}
                  style={[styles.incidentCard, isLight && { backgroundColor: '#FFF7EB', borderWidth: 1, borderColor: '#F4DDB6' }]}
                >
                  <View style={styles.incidentHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[inc.severity] ?? '#8E8E93' }]}>
                      <Text style={styles.severityText}>{inc.severity.toUpperCase()}</Text>
                    </View>
                    <ThemedText style={styles.cardDate}>{formatDate(inc.incident_date)}</ThemedText>
                  </View>
                  <ThemedText style={styles.incidentDesc}>{inc.description}</ThemedText>
                  {nPhotos > 0 ? (
                    <ThemedText style={styles.incidentPhotoHint}>
                      {nPhotos} photo{nPhotos === 1 ? '' : 's'} · tap to view
                    </ThemedText>
                  ) : (
                    <ThemedText style={styles.incidentPhotoHintMuted}>Tap to view details</ThemedText>
                  )}
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
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}

      <TouchableOpacity
        style={[styles.expandRow, styles.expandCard, isLight && styles.expandCardLight]}
        onPress={() => setTimelineOpen((prev) => !prev)}
        activeOpacity={0.75}
      >
        <ThemedText type="subtitle" style={styles.section}>Maintenance timeline</ThemedText>
        <MaterialIcons name={timelineOpen ? 'expand-less' : 'expand-more'} size={22} color={isLight ? '#1C5A34' : '#8DA0B8'} />
      </TouchableOpacity>
      {timelineOpen && (
        <TouchableOpacity
          style={[styles.addBtn, isLight && { backgroundColor: '#DFF7E8' }]}
          onPress={() => router.push(`/(tabs)/car/${carId}/add-event` as any)}
        >
          <Text style={[styles.addBtnText, isLight && { color: '#1C5A34' }]}>Add event</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      {!timelineOpen ? null : loading ? (
        <ActivityIndicator size="large" />
      ) : error ? (
        <ThemedText style={styles.emptyText}>Couldn’t load. Pull down to retry.</ThemedText>
      ) : (
        <ThemedText style={styles.emptyText}>No maintenance events yet. Tap Add event.</ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: palette.background }]}>
      <FlatList
        data={timelineOpen ? events : []}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <View style={[styles.card, isLight && { backgroundColor: '#FFFFFF', borderColor: '#D8E5DD' }]}>
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

      <Modal
        visible={incidentPhotoView != null}
        transparent
        animationType="fade"
        onRequestClose={() => setIncidentPhotoView(null)}
      >
        <View style={styles.incidentModalRoot}>
          <TouchableOpacity
            style={styles.incidentModalBackdrop}
            activeOpacity={1}
            onPress={() => setIncidentPhotoView(null)}
          />
          <View style={styles.incidentModalCenter} pointerEvents="box-none">
            <View
              style={[
                styles.incidentModalCard,
                isLight && { backgroundColor: '#FFFFFF', borderColor: '#D8E5DD' },
              ]}
              pointerEvents="auto"
            >
              {incidentPhotoView && (
                <>
                  <View style={styles.incidentModalHeader}>
                    <ThemedText type="subtitle" style={styles.incidentModalTitle} numberOfLines={3}>
                      {formatDate(incidentPhotoView.incident.incident_date)}
                      {'\n'}
                      {incidentPhotoView.incident.description}
                    </ThemedText>
                    <TouchableOpacity onPress={() => setIncidentPhotoView(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <MaterialIcons name="close" size={26} color={isLight ? '#1C5A34' : '#8DA0B8'} />
                    </TouchableOpacity>
                  </View>
                  {incidentPhotoView.loading && <ActivityIndicator style={styles.incidentModalSpinner} />}
                  {incidentPhotoView.error != null && (
                    <ThemedText style={styles.incidentModalError}>{incidentPhotoView.error}</ThemedText>
                  )}
                  {!incidentPhotoView.loading &&
                    incidentPhotoView.error == null &&
                    incidentPhotoView.images.length === 0 && (
                      <ThemedText style={styles.incidentModalEmpty}>No photos for this incident.</ThemedText>
                    )}
                  {incidentPhotoView.images.length > 0 && (() => {
                    const cardInnerWidth = windowWidth - 40 - 32;
                    const incidentThumbPx = Math.max(120, Math.floor((cardInnerWidth - 10) / 2));
                    return (
                      <ScrollView
                        style={{ maxHeight: Math.min(400, Math.floor(windowHeight * 0.45)) }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 10,
                            justifyContent: 'flex-start',
                          }}
                        >
                          {incidentPhotoView.images.map((img) =>
                            img.url ? (
                              <Image
                                key={img.id}
                                source={{ uri: img.url }}
                                style={{
                                  width: incidentThumbPx,
                                  height: incidentThumbPx,
                                  borderRadius: 10,
                                  backgroundColor: 'rgba(255,255,255,0.08)',
                                }}
                                resizeMode="cover"
                                accessibilityLabel="Incident photo"
                                onError={(e) => {
                                  if (__DEV__) {
                                    console.warn('Incident image failed to load', img.id, e.nativeEvent.error);
                                  }
                                }}
                              />
                            ) : null
                          )}
                        </View>
                      </ScrollView>
                    );
                  })()}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07142B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 0, marginBottom: 8 },
  backBtnText: { fontSize: 17, color: '#2DD4BF', fontWeight: '600' },
  header: { padding: 20, paddingBottom: 16 },
  title: { marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8DA0B8', marginBottom: 16 },
  sectionTitle: { marginTop: 8, marginBottom: 12 },
  alertBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  alertText: { fontWeight: '600', textAlign: 'center', fontSize: 14 },
  serviceCard: {
    padding: 14,
    borderRadius: 14,
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
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expandCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0A1A37',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#294263',
  },
  expandCardLight: {
    backgroundColor: '#F7FBF8',
    borderColor: '#BFE9CD',
  },
  addBtn: {
    backgroundColor: '#2DD4BF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtn: {
    backgroundColor: '#0A1A37',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#294263',
  },
  secondaryBtnText: {
    color: '#2DD4BF',
  },
  exportBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
  },
  addBtnText: { color: '#062B32', fontSize: 15, fontWeight: '700' },
  obdHint: { fontSize: 13, color: '#8DA0B8', marginBottom: 10 },
  obdEmptyCard: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 0,
    padding: 14,
    marginBottom: 8,
  },
  obdCard: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 0,
    padding: 14,
    marginBottom: 8,
  },
  obdHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  obdCardTitle: { fontSize: 14, fontWeight: '700' },
  obdTimestamp: { fontSize: 12, color: '#8DA0B8' },
  obdMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  obdMetricItem: {
    width: '48%',
    backgroundColor: 'rgba(28,90,52,0.32)',
    borderRadius: 10,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(191,233,205,0.35)',
  },
  obdMetricItemLight: {
    backgroundColor: '#DFF7E8',
    borderColor: '#BFE9CD',
  },
  obdMetricLabel: { fontSize: 12, color: '#8DA0B8', marginBottom: 2 },
  obdMetricLabelLight: { color: '#5F7768' },
  obdMetricValue: { fontSize: 14, fontWeight: '700' },
  obdDtcTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  obdNoCodes: { fontSize: 13, color: '#8DA0B8' },
  obdCodeItem: {
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  obdCode: { fontSize: 13, fontWeight: '700', color: '#B00020', marginBottom: 3 },
  obdCodeDesc: { fontSize: 12, opacity: 0.85 },
  obdTapHint: { fontSize: 12, color: '#8DA0B8', marginTop: 4 },
  list: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    backgroundColor: '#0A1A37',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#294263',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardType: { fontSize: 16, fontWeight: '600' },
  cardDate: { fontSize: 14, color: '#8DA0B8' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  meta: { fontSize: 14, color: '#8DA0B8' },
  notes: { fontSize: 14, color: '#8DA0B8', fontStyle: 'italic', marginTop: 4 },
  empty: { minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 16, textAlign: 'center', color: '#8DA0B8' },
  incidentCard: {
    backgroundColor: 'rgba(255,149,0,0.08)',
    padding: 14,
    borderRadius: 14,
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
  incidentPhotoHint: { fontSize: 13, fontWeight: '600', marginBottom: 6, opacity: 0.95 },
  incidentPhotoHintMuted: { fontSize: 12, marginBottom: 6, opacity: 0.55, fontStyle: 'italic' },
  incidentMeta: { fontSize: 13, opacity: 0.7, marginBottom: 2 },
  noIncidents: { fontSize: 14, opacity: 0.6, marginBottom: 8 },
  incidentModalRoot: { flex: 1 },
  incidentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  incidentModalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  incidentModalCard: {
    maxHeight: '85%',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#0A1A37',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#294263',
  },
  incidentModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  incidentModalTitle: { flex: 1, fontSize: 15 },
  incidentModalSpinner: { marginVertical: 16 },
  incidentModalError: { fontSize: 14, color: '#FF6B6B', marginBottom: 8 },
  incidentModalEmpty: { fontSize: 14, opacity: 0.75 },
});
