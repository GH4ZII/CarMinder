import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AllCarsServiceStatus,
  api,
  ApiError,
  CarCareScoreResponse,
  CarServiceStatus,
  ServiceDueStatus,
} from '../../frontendServices/apiCall';

/** Deep forest green header (service-station style) */
const OVERVIEW_HEADER_GREEN = '#073B33';

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

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759',
  B: '#30D158',
  C: '#FF9500',
  D: '#FF6B35',
  F: '#FF3B30',
};

// ─── Score Ring ──────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = GRADE_COLORS[grade] ?? '#8E8E93';

  return (
    <View style={ringStyles.container}>
      {/* Background ring */}
      <View style={[ringStyles.bgRing, { borderColor: 'rgba(128,128,128,0.15)' }]} />
      {/* Colored arc overlay — approximated with quarter-border trick */}
      <View
        style={[
          ringStyles.arcRing,
          {
            borderTopColor: score >= 1 ? color : 'transparent',
            borderRightColor: score >= 25 ? color : 'transparent',
            borderBottomColor: score >= 50 ? color : 'transparent',
            borderLeftColor: score >= 75 ? color : 'transparent',
          },
        ]}
      />
      {/* Score text */}
      <View style={ringStyles.labelWrap}>
        <Text style={[ringStyles.number, { color }]}>{score}</Text>
        <Text style={[ringStyles.grade, { color }]}>{grade}</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { width: 84, height: 84, justifyContent: 'center', alignItems: 'center' },
  bgRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    borderWidth: 6,
  },
  arcRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    borderWidth: 6,
    transform: [{ rotate: '-90deg' }],
  },
  labelWrap: { alignItems: 'center' },
  number: { fontSize: 22, fontWeight: '800' },
  grade: { fontSize: 12, fontWeight: '700', marginTop: -2 },
});

// ─── Score Card ─────────────────────────────────────────────

function CarScoreCard({ score }: { score: CarCareScoreResponse }) {
  const color = GRADE_COLORS[score.grade] ?? '#8E8E93';

  return (
    <View style={styles.scoreCard}>
      <ScoreRing score={score.overall_score} grade={score.grade} />
      <View style={styles.scoreDetails}>
        <Text style={[styles.scoreTitle, { color }]}>Car Care Score</Text>
        <ThemedText style={styles.scoreSummary} numberOfLines={2}>
          {score.summary}
        </ThemedText>
        {(score.confidence_label === 'very_low' || score.confidence_label === 'low') && (
          <Text style={styles.confidenceNote}>
            Limited data — add more records for accuracy
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Service Badge ──────────────────────────────────────────

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

// ─── Car Service Card ───────────────────────────────────────

function CarServiceCard({
  car,
  score,
  onPress,
  scheme,
  palette,
  style,
  joinedWithSummary,
}: {
  car: CarServiceStatus;
  score: CarCareScoreResponse | null;
  onPress: () => void;
  scheme: 'light' | 'dark';
  palette: (typeof Colors)['light'];
  style?: object;
  joinedWithSummary?: boolean;
}) {
  const urgentServices = car.services.filter((s) => s.urgency === 'overdue' || s.urgency === 'soon');
  const hasUrgent = urgentServices.length > 0;

  return (
    <TouchableOpacity
      style={[
        styles.carCard,
        joinedWithSummary && styles.joinedFirstCarCard,
        hasUrgent && styles.carCardUrgent,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Score at top */}
      {score && <CarScoreCard score={score} />}

      <View style={styles.carHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.carName, scheme === 'light' && { color: palette.text }]}>{car.car_name}</ThemedText>
          <ThemedText style={[styles.carReg, scheme === 'light' && { color: palette.icon }]}>{car.registration}</ThemedText>
        </View>
        <ThemedText style={[styles.carMileage, scheme === 'light' && { color: palette.icon }]}>
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

      <Text style={[styles.tapHint, scheme === 'light' && { color: '#1C5A34' }]}>Tap to view details →</Text>
    </TouchableOpacity>
  );
}

// ─── Home Screen ────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, getToken, signOut } = useAuth();
  const [status, setStatus] = useState<AllCarsServiceStatus | null>(null);
  const [scores, setScores] = useState<Record<string, CarCareScoreResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

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

      // Fetch scores for all cars in parallel
      const scoreEntries = await Promise.allSettled(
        data.cars.map(async (car) => {
          const s = await api.getCarCareScore(car.car_id, token);
          return [car.car_id, s] as const;
        })
      );
      const scoreMap: Record<string, CarCareScoreResponse> = {};
      for (const entry of scoreEntries) {
        if (entry.status === 'fulfilled') {
          scoreMap[entry.value[0]] = entry.value[1];
        }
      }
      setScores(scoreMap);
    } catch (e) {
      console.error('Failed to fetch service status:', e);
      // If unauthorized (401), sign out to force re-authentication
      if (e instanceof ApiError && e.status === 401) {
        console.log('Token expired or invalid, signing out...');
        await signOut();
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, getToken, signOut]);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus])
  );

  // Not logged in
  if (!user) {
    return (
      <View style={styles.center}>
        <ThemedText type="title" style={styles.welcomeTitle}>
          Welcome to CarMinder
        </ThemedText>
        <ThemedText style={styles.welcomeText}>
          Track your car maintenance and never miss a service.
        </ThemedText>
        <TouchableOpacity
          style={[styles.loginBtn, scheme === 'light' && styles.loginBtnLight]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={[styles.loginBtnText, scheme === 'light' && styles.lightButtonText]}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userInitial = (user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase();

  return (
    <View style={[styles.screenRoot, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.overviewHeader,
          {
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <View style={styles.overviewHeaderTopRow}>
          <TouchableOpacity
            style={styles.overviewHeaderAvatar}
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            activeOpacity={0.8}
          >
            <Text style={styles.overviewHeaderAvatarText}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.overviewHeaderTitle}>Service Overview</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { backgroundColor: palette.background }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStatus} />}
      >
      {/* Summary Banner + first card in one wrapper */}
      {status && status.cars.length > 0 && (
        <View style={styles.combinedTopBlock}>
          <View style={[styles.summaryBanner, styles.joinedSummaryBanner]}>
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
                  <ThemedText style={[styles.summarySubtext, { color: palette.text }]}>
                    across {status.cars.length} vehicle{status.cars.length !== 1 ? 's' : ''}
                  </ThemedText>
                </View>
              </>
            ) : (
              <>
                <MaterialIcons name="check-circle" size={28} color="#34C759" />
                <View>
                  <ThemedText style={[styles.summaryText, { color: palette.text }]}>All services up to date</ThemedText>
                  <ThemedText style={[styles.summarySubtext, { color: palette.text }]}>
                    {status.cars.length} vehicle{status.cars.length !== 1 ? 's' : ''} tracked
                  </ThemedText>
                </View>
              </>
            )}
          </View>
          <CarServiceCard
            key={status.cars[0].car_id}
            car={status.cars[0]}
            score={scores[status.cars[0].car_id] ?? null}
            onPress={() => router.push(`/(tabs)/car/${status.cars[0].car_id}` as any)}
            scheme={scheme}
            palette={palette}
            style={styles.joinedTopCard}
            joinedWithSummary
          />
        </View>
      )}

      {status && status.cars.length === 0 && (
        <View style={styles.summaryBanner}>
          <MaterialIcons name="check-circle" size={28} color="#34C759" />
          <View>
            <ThemedText style={[styles.summaryText, { color: palette.text }]}>All services up to date</ThemedText>
            <ThemedText style={[styles.summarySubtext, { color: palette.text }]}>
              0 vehicles tracked
            </ThemedText>
          </View>
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
            style={[styles.addCarBtn, scheme === 'light' && styles.addCarBtnLight]}
            onPress={() => router.push('/(tabs)/addCar')}
          >
            <Text style={[styles.addCarBtnText, scheme === 'light' && styles.lightButtonText]}>Add Your First Car</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Car Cards */}
      {status?.cars.slice(1).map((car) => (
        <CarServiceCard
          key={car.car_id}
          car={car}
          score={scores[car.car_id] ?? null}
          onPress={() => router.push(`/(tabs)/car/${car.car_id}` as any)}
          scheme={scheme}
          palette={palette}
        />
      ))}

      {/* Add Car Button (if has cars) */}
      {status && status.cars.length > 0 && (
        <TouchableOpacity
          style={[styles.addMoreBtn, scheme === 'light' && styles.addMoreBtnLight]}
          onPress={() => router.push('/(tabs)/addCar')}
        >
          <Text style={[styles.addMoreBtnText, scheme === 'light' && styles.lightButtonText]}>+ Add Another Car</Text>
        </TouchableOpacity>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  overviewHeader: {
    backgroundColor: OVERVIEW_HEADER_GREEN,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 56,
    overflow: 'hidden',
  },
  overviewHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  overviewHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewHeaderAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  overviewHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#07142B',
  },
  // Welcome (logged out)
  welcomeTitle: { marginBottom: 12, textAlign: 'center', color: '#E9EEF7' },
  welcomeText: { fontSize: 16, textAlign: 'center', color: '#93A3B8', marginBottom: 24 },
  loginBtn: {
    backgroundColor: '#2DD4BF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginBtnText: { color: '#062B32', fontSize: 16, fontWeight: '700' },
  loginBtnLight: {
    backgroundColor: '#DFF7E8',
    borderWidth: 1,
    borderColor: '#BFE9CD',
  },

  // Summary Banner
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 6,
    marginBottom: 8,
    gap: 12,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  combinedTopBlock: {
    marginBottom: 16,
  },
  joinedSummaryBanner: {
    marginBottom: 0,
  },
  summaryText: { fontSize: 16, fontWeight: '600', color: '#E9EEF7' },
  summarySubtext: { fontSize: 14, color: '#8DA0B8', marginTop: 2 },

  // Loading/Error/Empty
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, color: '#8DA0B8' },
  errorContainer: { alignItems: 'center', paddingVertical: 40 },
  errorText: { textAlign: 'center', color: '#F55252' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#8DA0B8', marginBottom: 16 },
  addCarBtn: {
    backgroundColor: '#2DD4BF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addCarBtnText: { color: '#062B32', fontSize: 15, fontWeight: '700' },
  addCarBtnLight: {
    backgroundColor: '#DFF7E8',
    borderWidth: 1,
    borderColor: '#BFE9CD',
  },

  // Score Card
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 8,
    marginBottom: 14,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  scoreDetails: { flex: 1 },
  scoreTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  scoreSummary: { fontSize: 13, color: '#8DA0B8', lineHeight: 18 },
  confidenceNote: { fontSize: 11, color: '#FF9500', marginTop: 4 },

  // Car Card
  carCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 20,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  joinedTopCard: {
    marginTop: 0,
  },
  joinedFirstCarCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
  carCardUrgent: {
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
  },
  carHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  carName: { fontSize: 18, fontWeight: '700', color: '#E9EEF7' },
  carReg: { fontSize: 14, color: '#8DA0B8', marginTop: 2 },
  carMileage: { fontSize: 14, color: '#8DA0B8' },

  // Next Service Alert
  nextServiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 4,
    marginBottom: 12,
    gap: 8,
  },
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
    borderRadius: 12,
    minWidth: '48%',
    flexGrow: 1,
    gap: 8,
  },
  badgeIcon: { marginTop: 2 },
  badgeContent: { flex: 1 },
  badgeType: { fontSize: 13, fontWeight: '600' },
  badgeStatus: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  badgeMeta: { fontSize: 11, color: '#8DA0B8', marginTop: 2 },

  tapHint: {
    fontSize: 12,
    color: '#2DD4BF',
    textAlign: 'right',
    marginTop: 12,
  },

  // Add More Button
  addMoreBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  addMoreBtnText: { fontSize: 15, color: '#2DD4BF', fontWeight: '600' },
  addMoreBtnLight: {
    backgroundColor: '#DFF7E8',
    borderColor: '#BFE9CD',
  },
  lightButtonText: {
    color: '#1C5A34',
  },
});
