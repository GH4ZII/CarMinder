import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { ObdDevice, ObdSnapshot, obdService } from '../../../../frontendServices/obdService';

const GREEN_PRIMARY = '#1C5A34';
const GREEN_SOFT = '#DFF7E8';
const GREEN_BORDER = '#BFE9CD';
const TEXT_MUTED_LIGHT = '#5F7768';
const POLL_INTERVAL_MS = 4000;

type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';

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
  const [devices, setDevices] = useState<ObdDevice[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [selectedDevice, setSelectedDevice] = useState<ObdDevice | null>(null);
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef(false);
  const connectedRef = useRef(false);
  const stateRef = useRef<ConnectionState>('disconnected');

  const setStateTracked = useCallback((state: ConnectionState) => {
    stateRef.current = state;
    setConnectionState(state);
  }, []);

  const uploadIfDeviceReading = useCallback(async (result: ObdSnapshot) => {
    if (result.source !== 'device' || !carId) return;

    try {
      const token = await getToken();
      if (token) {
        await api.uploadObdReading(carId, token, snapshotToObdPayload(result));
      }
    } catch (err) {
      console.warn('OBD upload failed (cached locally):', err);
    }
  }, [carId, getToken]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollingRef.current = false;
  }, []);

  const disconnect = useCallback(async (showErrors = false) => {
    stopPolling();
    connectedRef.current = false;
    try {
      await obdService.disconnect();
    } catch (err: any) {
      if (showErrors) {
        Alert.alert('Disconnect failed', err?.message ?? 'Could not disconnect from the adapter.');
      }
    } finally {
      setSelectedDevice(null);
      setPollError(null);
      setStateTracked('disconnected');
    }
  }, [setStateTracked, stopPolling]);

  const pollOnce = useCallback(async () => {
    if (!carId || !connectedRef.current || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const result = await obdService.readSnapshot(carId);
      setSnapshot(result);
      setPollError(null);
      await uploadIfDeviceReading(result);
    } catch (e: any) {
      const message = e?.message ?? 'Connection dropped while reading OBD data.';
      setPollError(message);

      if (!obdService.getConnectedDevice()) {
        connectedRef.current = false;
        stopPolling();
        setSelectedDevice(null);
        setStateTracked('disconnected');
      }
    } finally {
      pollingRef.current = false;
    }
  }, [carId, setStateTracked, stopPolling, uploadIfDeviceReading]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollOnce();
    pollTimerRef.current = setInterval(() => {
      pollOnce();
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling]);

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

  useEffect(() => {
    const unsubscribe = obdService.onDisconnect(() => {
      if (!connectedRef.current) return;
      connectedRef.current = false;
      stopPolling();
      setSelectedDevice(null);
      setPollError('The adapter disconnected.');
      setStateTracked('disconnected');
    });
    return unsubscribe;
  }, [setStateTracked, stopPolling]);

  useEffect(() => {
    const unsubscribe = obdService.onConnect((device) => {
      setSelectedDevice(device);
      connectedRef.current = true;
      setPollError(null);
      setStateTracked('connected');
      startPolling();
    });
    return unsubscribe;
  }, [setStateTracked, startPolling]);

  useFocusEffect(
    useCallback(() => {
      const connected = obdService.getConnectedDevice();
      if (connected) {
        setSelectedDevice(connected);
        connectedRef.current = true;
        setPollError(null);
        setStateTracked('connected');
        startPolling();
      }

      return () => {
        stopPolling();
      };
    }, [setStateTracked, startPolling, stopPolling])
  );

  const discoverDevices = useCallback(async () => {
    setPollError(null);
    setDevices([]);
    setStateTracked('scanning');
    try {
      const found = await obdService.discoverDevices((device) => {
        setDevices((current) => {
          if (current.some((d) => d.id === device.id)) {
            return current.map((d) => (d.id === device.id ? device : d));
          }
          return [...current, device].sort((a, b) => {
            const obdScore = Number(Boolean(b.isLikelyObd)) - Number(Boolean(a.isLikelyObd));
            if (obdScore !== 0) return obdScore;
            return (b.rssi ?? -999) - (a.rssi ?? -999);
          });
        });
      });
      setDevices(found);
      if (!found.length) {
        setPollError('No OBD-II adapters found nearby.');
      }
    } catch (e: any) {
      const message = e?.message ?? 'Could not scan for Bluetooth devices.';
      setPollError(message);
      Alert.alert('Bluetooth scan failed', message);
    } finally {
      if (stateRef.current === 'scanning') setStateTracked('disconnected');
    }
  }, [setStateTracked]);

  const connectToDevice = useCallback(async (device: ObdDevice) => {
    if (!carId) return;
    setPollError(null);
    setSelectedDevice(device);
    setStateTracked('connecting');
    try {
      await obdService.connectToDevice(device);
      const connected = obdService.getConnectedDevice() ?? device;
      setSelectedDevice(connected);
      connectedRef.current = true;
      setStateTracked('connected');
      startPolling();
    } catch (e: any) {
      connectedRef.current = false;
      setSelectedDevice(null);
      setStateTracked('disconnected');
      Alert.alert('OBD connection failed', e?.message ?? 'Could not connect to the adapter.');
    }
  }, [carId, setStateTracked, startPolling]);

  const runDemo = useCallback(async () => {
    if (!carId) return;
    setStateTracked('connecting');
    try {
      const result = await obdService.scanDemo(carId);
      setSnapshot(result);
      Alert.alert('Demo scan complete', 'This simulated reading was cached locally only.');
    } catch (e: any) {
      Alert.alert('Demo scan failed', e?.message ?? 'Could not run demo scan.');
    } finally {
      setStateTracked('disconnected');
    }
  }, [carId, setStateTracked]);

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

        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>OBD-II Scanner</ThemedText>
          <View style={[styles.connectionBadge, connectionState === 'connected' && styles.connectionBadgeConnected]}>
            <View style={[styles.connectionDot, connectionState === 'connected' && styles.connectionDotConnected]} />
            <Text style={styles.connectionBadgeText}>
              {connectionState === 'connected'
                ? selectedDevice?.name ?? 'Connected'
                : connectionState === 'scanning'
                  ? 'Scanning'
                  : connectionState === 'connecting'
                    ? 'Connecting'
                    : 'Disconnected'}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {supported ? (
            <>
              {connectionState === 'connected' ? (
                <TouchableOpacity
                  style={[styles.scanBtn, styles.disconnectBtn]}
                  onPress={() => disconnect(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.scanBtn, (connectionState === 'scanning' || connectionState === 'connecting') && styles.scanBtnDisabled]}
                  onPress={discoverDevices}
                  disabled={connectionState === 'scanning' || connectionState === 'connecting'}
                  activeOpacity={0.85}
                >
                  {connectionState === 'scanning' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : null}
                  <Text style={styles.scanBtnText}>
                    {connectionState === 'scanning' ? 'Scanning nearby devices…' : 'Scan for adapters'}
                  </Text>
                </TouchableOpacity>
              )}

              {devices.length > 0 && connectionState !== 'connected' && (
                <View style={styles.deviceList}>
                  <ThemedText style={styles.deviceListTitle}>Nearby OBD-II adapters</ThemedText>
                  {devices.map((device) => (
                    <TouchableOpacity
                      key={device.id}
                      style={[styles.deviceItem, isLight && styles.deviceItemLight]}
                      onPress={() => connectToDevice(device)}
                      disabled={connectionState === 'connecting'}
                      activeOpacity={0.85}
                    >
                      <View style={styles.deviceInfo}>
                        <ThemedText style={styles.deviceName}>{device.name}</ThemedText>
                        <ThemedText style={[styles.deviceMeta, isLight && { color: TEXT_MUTED_LIGHT }]}>
                          OBD-II adapter
                          {device.rssi != null ? ` · ${device.rssi} dBm` : ''}
                        </ThemedText>
                      </View>
                      {connectionState === 'connecting' && selectedDevice?.id === device.id ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Text style={[styles.connectText, isLight && { color: GREEN_PRIMARY }]}>Connect</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {connectionState === 'connected' && (
                <ThemedText style={[styles.hint, isLight && { color: TEXT_MUTED_LIGHT }]}>
                  Reading live data every {POLL_INTERVAL_MS / 1000} seconds.
                </ThemedText>
              )}
            </>
          ) : (
            <>
              <ThemedText style={[styles.hint, isLight && { color: TEXT_MUTED_LIGHT }]}>
                Native OBD transport is not configured yet in this build.
              </ThemedText>
              <TouchableOpacity
                style={[styles.demoBtn, connectionState === 'connecting' && styles.scanBtnDisabled]}
                onPress={runDemo}
                disabled={connectionState === 'connecting'}
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

        {pollError && (
          <View style={[styles.statusCard, isLight && styles.statusCardLight]}>
            <ThemedText style={[styles.statusText, isLight && { color: TEXT_MUTED_LIGHT }]}>
              {pollError}
            </ThemedText>
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
            Scan for a Bluetooth adapter, select it, and live readings will start automatically.
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  title: { flex: 1 },
  connectionBadge: {
    minHeight: 30,
    maxWidth: 180,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(141,160,184,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectionBadgeConnected: {
    backgroundColor: 'rgba(28,90,52,0.16)',
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8DA0B8',
  },
  connectionDotConnected: {
    backgroundColor: '#34C759',
  },
  connectionBadgeText: {
    color: '#5F7768',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
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
  disconnectBtn: {
    backgroundColor: '#B00020',
  },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  deviceList: {
    gap: 8,
    marginTop: 4,
  },
  deviceListTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  deviceItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(191,233,205,0.35)',
    backgroundColor: 'rgba(28,90,52,0.20)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deviceItemLight: {
    backgroundColor: '#FFFFFF',
    borderColor: GREEN_BORDER,
  },
  deviceInfo: { flex: 1, gap: 2 },
  deviceName: { fontSize: 14, fontWeight: '700' },
  deviceMeta: { fontSize: 12, color: '#8DA0B8' },
  connectText: { fontSize: 13, fontWeight: '800', color: GREEN_SOFT },
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
  statusCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,149,0,0.25)',
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statusCardLight: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  statusText: { fontSize: 13, color: '#8DA0B8' },
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
