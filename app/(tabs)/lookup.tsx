import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, PublicCarHistory } from '../../frontendServices/apiCall';

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

const EVENT_LABELS: Record<string, string> = {
  oil_change: 'Oil change',
  brake_service: 'Brake service',
  tire_change: 'Tire change',
  inspection: 'Inspection',
  repair: 'Repair',
  other: 'Other',
};

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

export default function LookupScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colors = useMemo(() => {
    return {
      bg: '#07142B',
      card: '#0A1A37',
      text: '#E9EEF7',
      subtext: '#8DA0B8',
      border: '#294263',
      placeholder: '#8DA0B8',
      primary: '#2DD4BF',
    };
  }, [scheme]);

  const [regNumber, setRegNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicCarHistory | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const reg = regNumber.trim().toUpperCase();
    if (!reg) {
      Alert.alert('Error', 'Enter a registration number.');
      return;
    }
    setLoading(true);
    setResult(null);
    setSearched(true);
    try {
      const data = await api.getPublicHistory(reg);
      setResult(data);
    } catch {
      Alert.alert('Error', 'Failed to look up car history.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      >
        <ThemedText type="title" style={styles.pageTitle}>Car History Lookup</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.subtext }]}>
          Search for a car's public maintenance and incident history by registration number.
        </ThemedText>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={regNumber}
            onChangeText={(t) => setRegNumber(t.toUpperCase())}
            placeholder="e.g. AB12345"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            maxLength={7}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary }]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#062B32" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {searched && !loading && !result && (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No public history found. The car may not exist or the owner has not made their history public.
            </ThemedText>
          </View>
        )}

        {result && (
          <View style={styles.resultsContainer}>
            {/* Car info card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.carTitle}>
                {result.car.merke} {result.car.modell}
              </ThemedText>
              <ThemedText style={[styles.carMeta, { color: colors.subtext }]}>
                {result.car.registreringsnummer} · {result.car.arsmodell} · {result.car.farge}
              </ThemedText>
              <ThemedText style={[styles.carMeta, { color: colors.subtext }]}>
                {result.car.kilometer.toLocaleString()} km
              </ThemedText>
            </View>

            {/* Incidents */}
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Incident Reports ({result.incident_reports.length})
            </ThemedText>
            {result.incident_reports.length === 0 ? (
              <ThemedText style={[styles.noData, { color: colors.subtext }]}>No incidents reported.</ThemedText>
            ) : (
              result.incident_reports.map((inc, i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.incidentHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[inc.severity] ?? '#8E8E93' }]}>
                      <Text style={styles.severityText}>{inc.severity.toUpperCase()}</Text>
                    </View>
                    <ThemedText style={styles.incidentDate}>{formatDate(inc.incident_date)}</ThemedText>
                  </View>
                  <ThemedText style={styles.incidentDesc}>{inc.description}</ThemedText>
                  {inc.damage_description && (
                    <ThemedText style={[styles.incidentMeta, { color: colors.subtext }]}>
                      Damage: {inc.damage_description}
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.incidentMeta, { color: colors.subtext }]}>
                    Repair: {REPAIR_STATUS_LABELS[inc.repair_status] ?? inc.repair_status}
                  </ThemedText>
                  {inc.mileage != null && (
                    <ThemedText style={[styles.incidentMeta, { color: colors.subtext }]}>
                      {inc.mileage.toLocaleString()} km
                    </ThemedText>
                  )}
                </View>
              ))
            )}

            {/* Maintenance events */}
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Maintenance History ({result.maintenance_events.length})
            </ThemedText>
            {result.maintenance_events.length === 0 ? (
              <ThemedText style={[styles.noData, { color: colors.subtext }]}>No maintenance events recorded.</ThemedText>
            ) : (
              result.maintenance_events.map((evt, i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.eventRow}>
                    <ThemedText style={styles.eventType}>{EVENT_LABELS[evt.event_type] ?? evt.event_type}</ThemedText>
                    <ThemedText style={styles.eventDate}>{formatDate(evt.event_date)}</ThemedText>
                  </View>
                  <View style={styles.eventMetaRow}>
                    {evt.mileage != null && (
                      <ThemedText style={[styles.eventMeta, { color: colors.subtext }]}>
                        {evt.mileage.toLocaleString()} km
                      </ThemedText>
                    )}
                    {evt.vendor && (
                      <ThemedText style={[styles.eventMeta, { color: colors.subtext }]}>
                        {evt.vendor}
                      </ThemedText>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  pageTitle: { marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  searchBtn: { paddingHorizontal: 20, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { color: '#062B32', fontSize: 16, fontWeight: '700' },
  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', opacity: 0.7 },
  resultsContainer: { gap: 0 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  carTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  carMeta: { fontSize: 14, marginBottom: 2 },
  sectionTitle: { marginTop: 16, marginBottom: 10 },
  noData: { fontSize: 14, marginBottom: 10 },
  incidentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  severityText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  incidentDate: { fontSize: 14, opacity: 0.8 },
  incidentDesc: { fontSize: 15, marginBottom: 6 },
  incidentMeta: { fontSize: 13, marginBottom: 2 },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  eventType: { fontSize: 15, fontWeight: '600' },
  eventDate: { fontSize: 14, opacity: 0.8 },
  eventMetaRow: { flexDirection: 'row', gap: 12 },
  eventMeta: { fontSize: 13 },
});
