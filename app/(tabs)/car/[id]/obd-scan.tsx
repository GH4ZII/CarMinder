import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, snapshotToObdPayload } from '../../../../frontendServices/apiCall';
import { ObdSnapshot, obdService } from '../../../../frontendServices/obdService';

const GREEN_PRIMARY = '#1C5A34';
const GREEN_SOFT = '#DFF7E8';
const GREEN_BORDER = '#BFE9CD';
const TEXT_MUTED_LIGHT = '#5F7768';

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

function formatObdValue(value: number | null, unit: string): string {
  if (value == null) return '—';
  return `${value.toLocaleString()} ${unit}`.trim();
}

export default function ObdScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isLight = scheme === 'light';

  const [snapshot, setSnapshot] = useState<ObdSnapshot | null>(null);
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(true);

  const uploadIfDeviceReading = useCallback((result: ObdSnapshot) => {
    if (result.source !== 'device' || !carId) return;

    // Upload to backend (fire-and-forget)
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          await api.uploadObdReading(carId, token, snapshotToObdPayload(result));
        }
      } catch (err) {
        console.warn('OBD upload failed (cached locally):', err);
      }
    })();
  }, [carId, getToken]);

  // Check support + load cached snapshot on mount
  useEffect(() => {
    if (!carId) return;
    let cancelled = false;
    (async () => {
      const [sup, cached] = await Promise.all([
        obdService.isSupported().catch(() => false),
        obdService.getLastSnapshot(carId).catch(() => null),
      ]);
      if (cancelled) return;
      setSupported(sup);
      setSnapshot(cached);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [carId]);

  const scan = useCallback(async () => {
    if (!carId) return;
    setScanning(true);
    try {
      const result = await obdService.scanCar(carId);
      setSnapshot(result);
      uploadIfDeviceReading(result);
    } catch (e: any) {
      Alert.alert('OBD scan failed', e?.message ?? 'Could not read OBD data.');
    } finally {
      setScanning(false);
    }
  }, [carId, uploadIfDeviceReading]);

  const runDemo = useCallback(async () => {
    if (!carId) return;
    setScanning(true);
    try {
      const result = await obdService.scanDemo(carId);
      setSnapshot(result);
      Alert.alert('Demo scan complete', 'This simulated reading was cached locally only.');
    } catch (e: any) {
      Alert.alert('Demo scan failed', e?.message ?? 'Could not run demo scan.');
    } finally {
      setScanning(false);
    }
  }, [carId]);

  if (!carId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Missing car.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: isLight ? GREEN_PRIMARY : palette.accent }]}>← Back</Text>
        </TouchableOpacity>

        <ThemedText type="title" style={styles.title}>OBD-II Scanner</ThemedText>

        {/* Action buttons */}
        <View style={styles.actions}>
          {supported ? (
            <TouchableOpacity
              style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
              onPress={scan}
              disabled={scanning}
              activeOpacity={0.85}
            >
              {scanning ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : null}
              <Text style={styles.scanBtnText}>{scanning ? 'Scanning…' : 'Scan adapter'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <ThemedText style={[styles.hint, isLight && { color: TEXT_MUTED_LIGHT }]}>
                Native OBD transport is not configured yet in this build.
              </ThemedText>
              <TouchableOpacity
                style={[styles.demoBtn, scanning && styles.scanBtnDisabled]}
                onPress={runDemo}
                disabled={scanning}
                activeOpacity={0.85}
              >
                <Text style={styles.demoBtnText}>Demo scan</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {checking && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {/* Results */}
        {snapshot && (
          <View style={styles.resultCard}>
            <View style={styles.headerRow}>
              <ThemedText style={styles.cardTitle}>
                {snapshot.source === 'simulated' ? 'Demo reading' : 'Device reading'}
              </ThemedText>
              <ThemedText style={[styles.timestamp, isLight && { color: TEXT_MUTED_LIGHT }]}>
                {formatDate(snapshot.capturedAt)}
              </ThemedText>
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricItem, isLight && styles.metricItemLight]}>
                <ThemedText style={[styles.metricLabel, isLight && styles.metricLabelLight]}>RPM</ThemedText>
                <ThemedText style={[styles.metricValue, isLight && { color: '#102016' }]}>
                  {formatObdValue(snapshot.metrics.rpm, '')}
                </ThemedText>
              </View>
              <View style={[styles.metricItem, isLight && styles.metricItemLight]}>
                <ThemedText style={[styles.metricLabel, isLight && styles.metricLabelLight]}>Coolant</ThemedText>
                <ThemedText style={[styles.metricValue, isLight && { color: '#102016' }]}>
                  {formatObdValue(snapshot.metrics.coolantTempC, '°C')}
                </ThemedText>
              </View>
              <View style={[styles.metricItem, isLight && styles.metricItemLight]}>
                <ThemedText style={[styles.metricLabel, isLight && styles.metricLabelLight]}>Speed</ThemedText>
                <ThemedText style={[styles.metricValue, isLight && { color: '#102016' }]}>
                  {formatObdValue(snapshot.metrics.speedKph, 'km/h')}
                </ThemedText>
              </View>
              <View style={[styles.metricItem, isLight && styles.metricItemLight]}>
                <ThemedText style={[styles.metricLabel, isLight && styles.metricLabelLight]}>Engine Load</ThemedText>
                <ThemedText style={[styles.metricValue, isLight && { color: '#102016' }]}>
                  {formatObdValue(snapshot.metrics.engineLoadPct, '%')}
                </ThemedText>
              </View>
              <View style={[styles.metricItem, isLight && styles.metricItemLight]}>
                <ThemedText style={[styles.metricLabel, isLight && styles.metricLabelLight]}>Battery</ThemedText>
                <ThemedText style={[styles.metricValue, isLight && { color: '#102016' }]}>
                  {formatObdValue(snapshot.metrics.batteryVoltage, 'V')}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.dtcTitle}>
              Error codes ({snapshot.dtcs.length})
            </ThemedText>
            {snapshot.dtcs.length === 0 ? (
              <ThemedText style={[styles.noCodes, isLight && { color: TEXT_MUTED_LIGHT }]}>
                No stored trouble codes.
              </ThemedText>
            ) : (
              snapshot.dtcs.map((dtc) => (
                <View key={dtc.code} style={styles.codeItem}>
                  <Text style={styles.code}>{dtc.code}</Text>
                  <ThemedText style={styles.codeDesc}>{dtc.description}</ThemedText>
                </View>
              ))
            )}
          </View>
        )}

        {!snapshot && !checking && (
          <ThemedText style={[styles.hint, isLight && { color: TEXT_MUTED_LIGHT }]}>
            Tap the button above to start a scan.
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backBtnText: { fontSize: 17, fontWeight: '600' },
  title: { marginBottom: 16 },
  actions: { marginBottom: 20, gap: 10 },
  scanBtn: {
    backgroundColor: GREEN_PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  demoBtn: {
    backgroundColor: GREEN_SOFT,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnText: { color: GREEN_PRIMARY, fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, marginBottom: 4, color: '#8DA0B8' },
  resultCard: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  timestamp: { fontSize: 12, opacity: 0.75 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricItem: {
    width: '48%',
    backgroundColor: 'rgba(28,90,52,0.32)',
    borderRadius: 10,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(191,233,205,0.35)',
  },
  metricItemLight: {
    backgroundColor: GREEN_SOFT,
    borderColor: GREEN_BORDER,
  },
  metricLabel: { fontSize: 12, color: '#8DA0B8', marginBottom: 2 },
  metricLabelLight: { color: TEXT_MUTED_LIGHT },
  metricValue: { fontSize: 14, fontWeight: '700' },
  dtcTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  noCodes: { fontSize: 13, color: '#8DA0B8' },
  codeItem: {
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  code: { fontSize: 13, fontWeight: '700', color: '#B00020', marginBottom: 3 },
  codeDesc: { fontSize: 12, opacity: 0.85 },
});
