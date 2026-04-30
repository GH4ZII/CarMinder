import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { ObdReadingResponse, api } from '../../../../frontendServices/apiCall';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 56;
const CHART_H = 160;
const GAUGE_SIZE = (SCREEN_W - 72) / 2;

// --- Gauge Component ---

type GaugeProps = {
  value: number | null;
  min: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  warningThreshold?: number;
  dark: boolean;
};

function Gauge({ value, min, max, label, unit, color, warningThreshold, dark }: GaugeProps) {
  const size = GAUGE_SIZE;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2 - 8;
  const cx = size / 2;
  const cy = size / 2 + 4;

  // Arc from 135deg to 405deg (270deg sweep)
  const startAngle = 135;
  const sweepAngle = 270;
  const pct = value != null ? Math.min(Math.max((value - min) / (max - min), 0), 1) : 0;
  const endAngle = startAngle + sweepAngle * pct;

  const polarToCart = (angle: number, r: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  });

  const bgStart = polarToCart(startAngle, radius);
  const bgEnd = polarToCart(startAngle + sweepAngle, radius);
  const bgArc = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  const valEnd = polarToCart(endAngle, radius);
  const largeArc = sweepAngle * pct > 180 ? 1 : 0;
  const valArc =
    value != null
      ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`
      : '';

  const displayColor =
    warningThreshold != null && value != null && value >= warningThreshold ? '#FF3B30' : color;

  const textColor = dark ? '#E9EEF7' : '#102016';
  const subColor = dark ? '#8DA0B8' : '#5F7768';
  const cardBg = dark ? '#0A1A37' : '#FFFFFF';
  const cardBorder = dark ? '#294263' : '#D8E5DD';

  return (
    <View style={[gaugeStyles.container, { width: size, height: size, backgroundColor: cardBg, borderColor: cardBorder }]}>
      <Svg width={size} height={size}>
        <Path d={bgArc} stroke={cardBorder} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        {valArc ? (
          <Path d={valArc} stroke={displayColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        ) : null}
        <SvgText
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize={22}
          fontWeight="700"
          fill={textColor}
        >
          {value != null ? formatCompact(value) : '--'}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize={11}
          fill={subColor}
        >
          {unit}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 32}
          textAnchor="middle"
          fontSize={11}
          fontWeight="600"
          fill={subColor}
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// --- Mini Line Chart ---

type LineChartProps = {
  data: { date: string; value: number }[];
  color: string;
  label: string;
  unit: string;
  dark: boolean;
};

function MiniLineChart({ data, color, label, unit, dark }: LineChartProps) {
  const cardBg = dark ? '#0A1A37' : '#FFFFFF';
  const cardBorder = dark ? '#294263' : '#D8E5DD';

  if (data.length < 2) {
    return (
      <View style={[chartStyles.container, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <ThemedText style={chartStyles.label}>{label}</ThemedText>
        <ThemedText style={chartStyles.noData}>Not enough data for chart</ThemedText>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padX = 40;
  const padY = 28;
  const padBottom = 24;
  const w = CHART_W - padX * 2;
  const h = CHART_H - padY - padBottom;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * w,
    y: padY + h - ((d.value - minVal) / range) * h,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Fill area under curve
  const fillD = `${pathD} L ${points[points.length - 1].x} ${padY + h} L ${points[0].x} ${padY + h} Z`;

  const textColor = dark ? '#8DA0B8' : '#5F7768';
  const gridColor = dark ? '#294263' : '#D8E5DD';

  // Y-axis labels (3 ticks)
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];

  // X-axis labels (first, middle, last)
  const xLabels =
    data.length >= 3
      ? [
          { idx: 0, label: formatShortDate(data[0].date) },
          { idx: Math.floor(data.length / 2), label: formatShortDate(data[Math.floor(data.length / 2)].date) },
          { idx: data.length - 1, label: formatShortDate(data[data.length - 1].date) },
        ]
      : data.map((d, i) => ({ idx: i, label: formatShortDate(d.date) }));

  return (
    <View style={[chartStyles.container, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={chartStyles.headerRow}>
        <ThemedText style={chartStyles.label}>{label}</ThemedText>
        <ThemedText style={chartStyles.unitLabel}>{unit}</ThemedText>
      </View>
      <Svg width={CHART_W} height={CHART_H}>
        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          const y = padY + h - ((tick - minVal) / range) * h;
          return (
            <G key={`grid-${i}`}>
              <Line x1={padX} y1={y} x2={padX + w} y2={y} stroke={gridColor} strokeWidth={0.5} />
              <SvgText x={padX - 6} y={y + 4} textAnchor="end" fontSize={9} fill={textColor}>
                {formatCompact(tick)}
              </SvgText>
            </G>
          );
        })}

        {/* Fill */}
        <Path d={fillD} fill={color} opacity={0.1} />

        {/* Line */}
        <Path d={pathD} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />

        {/* Dots on first and last */}
        <Circle cx={points[0].x} cy={points[0].y} r={3} fill={color} />
        <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill={color} />

        {/* X-axis labels */}
        {xLabels.map((xl) => (
          <SvgText
            key={`x-${xl.idx}`}
            x={points[xl.idx].x}
            y={padY + h + 16}
            textAnchor="middle"
            fontSize={9}
            fill={textColor}
          >
            {xl.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 14, fontWeight: '700' },
  unitLabel: { fontSize: 11, opacity: 0.5 },
  noData: { fontSize: 12, opacity: 0.5, marginTop: 8 },
});

// --- Helpers ---

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return '';
  }
}

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// --- DTC Severity Badge ---

function DtcBadge({ code, description }: { code: string; description: string }) {
  const prefix = code.charAt(0);
  const colors: Record<string, { bg: string; text: string }> = {
    P: { bg: 'rgba(255,59,48,0.10)', text: '#FF3B30' },
    C: { bg: 'rgba(255,149,0,0.10)', text: '#FF9500' },
    B: { bg: 'rgba(255,204,0,0.10)', text: '#CC8800' },
    U: { bg: 'rgba(88,86,214,0.10)', text: '#5856D6' },
  };
  const c = colors[prefix] ?? colors.P;

  return (
    <View style={[dtcStyles.item, { backgroundColor: c.bg }]}>
      <View style={dtcStyles.codeRow}>
        <Text style={[dtcStyles.code, { color: c.text }]}>{code}</Text>
        <Text style={[dtcStyles.type, { color: c.text }]}>
          {prefix === 'P' ? 'Powertrain' : prefix === 'C' ? 'Chassis' : prefix === 'B' ? 'Body' : 'Network'}
        </Text>
      </View>
      <ThemedText style={dtcStyles.desc}>{description}</ThemedText>
    </View>
  );
}

const dtcStyles = StyleSheet.create({
  item: { borderRadius: 12, padding: 12, marginBottom: 8 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  code: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  type: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', opacity: 0.8 },
  desc: { fontSize: 12, opacity: 0.85 },
});

// --- Main Screen ---

export default function ObdDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = Colors[scheme ?? 'light'];
  const primaryBtnBg = dark ? '#2DD4BF' : '#DFF7E8';
  const primaryBtnText = dark ? '#062B32' : '#1C5A34';

  const [readings, setReadings] = useState<ObdReadingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    if (!carId) return;
    try {
      setLoadError(null);
      const token = await getToken();
      if (!token) {
        setLoadError('You need to be signed in to load diagnostics.');
        return;
      }
      const data = await api.listObdReadings(carId, token, 50);
      setReadings(data);
    } catch (e) {
      console.warn('Failed to fetch OBD readings:', e);
      setLoadError('Could not load OBD readings right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [carId, getToken]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchReadings();
  }, [fetchReadings]);

  const latest = readings[0] ?? null;

  // Build chart data series (oldest first)
  const chartData = useMemo(() => {
    const sorted = [...readings].reverse();
    return {
      rpm: sorted.filter((r) => r.rpm != null).map((r) => ({ date: r.captured_at, value: r.rpm! })),
      coolant: sorted.filter((r) => r.coolant_temp_c != null).map((r) => ({ date: r.captured_at, value: r.coolant_temp_c! })),
      speed: sorted.filter((r) => r.speed_kph != null).map((r) => ({ date: r.captured_at, value: r.speed_kph! })),
      load: sorted.filter((r) => r.engine_load_pct != null).map((r) => ({ date: r.captured_at, value: r.engine_load_pct! })),
      battery: sorted.filter((r) => r.battery_voltage != null).map((r) => ({ date: r.captured_at, value: r.battery_voltage! })),
      fuelUse: sorted.filter((r) => r.fuel_consumption_l_100km != null).map((r) => ({ date: r.captured_at, value: r.fuel_consumption_l_100km! })),
      fuelRate: sorted.filter((r) => r.fuel_rate_lph != null).map((r) => ({ date: r.captured_at, value: r.fuel_rate_lph! })),
      maf: sorted.filter((r) => r.mass_air_flow_gps != null).map((r) => ({ date: r.captured_at, value: r.mass_air_flow_gps! })),
    };
  }, [readings]);

  if (!carId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Missing car.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: primaryBtnBg }]}
              onPress={() => router.push(`/(tabs)/car/${carId}/obd-scan` as any)}
            >
              <Text style={[styles.primaryBtnText, { color: primaryBtnText }]}>New Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ThemedText type="title" style={styles.title}>Diagnostics</ThemedText>

        {latest && (
          <ThemedText style={[styles.subtitle, { color: palette.icon }]}>
            Last scan: {formatFullDate(latest.captured_at)} ({latest.source})
          </ThemedText>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <ThemedText style={{ marginTop: 12, opacity: 0.6 }}>Loading readings...</ThemedText>
          </View>
        ) : loadError ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Diagnostics unavailable</ThemedText>
            <ThemedText style={styles.emptyHint}>{loadError}</ThemedText>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: primaryBtnBg }]}
              onPress={refresh}
            >
              <Text style={[styles.primaryBtnText, { color: primaryBtnText }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : readings.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>No readings yet</ThemedText>
            <ThemedText style={styles.emptyHint}>
              Connect your OBD-II adapter and scan your car to see diagnostics here.
            </ThemedText>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: primaryBtnBg }]}
              onPress={() => router.push(`/(tabs)/car/${carId}/obd-scan` as any)}
            >
              <Text style={[styles.primaryBtnText, { color: primaryBtnText }]}>Start First Scan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Live Gauges */}
            <ThemedText style={styles.sectionTitle}>Current Metrics</ThemedText>
            <View style={styles.gaugeGrid}>
              <Gauge value={latest?.rpm ?? null} min={0} max={8000} label="RPM" unit="rev/min" color="#2DD4BF" warningThreshold={6000} dark={dark} />
              <Gauge value={latest?.coolant_temp_c ?? null} min={-40} max={150} label="Coolant" unit="°C" color="#34C759" warningThreshold={110} dark={dark} />
              <Gauge value={latest?.speed_kph ?? null} min={0} max={260} label="Speed" unit="km/h" color="#2DD4BF" dark={dark} />
              <Gauge value={latest?.engine_load_pct ?? null} min={0} max={100} label="Load" unit="%" color="#FF9500" warningThreshold={85} dark={dark} />
              <Gauge value={latest?.fuel_consumption_l_100km ?? null} min={0} max={20} label="Fuel Use" unit="L/100km" color="#5856D6" warningThreshold={12} dark={dark} />
              <Gauge value={latest?.fuel_rate_lph ?? null} min={0} max={25} label="Fuel Rate" unit="L/h" color="#0A84FF" dark={dark} />
            </View>

            {/* Battery - full width */}
            <View
              style={[
                styles.batteryCard,
                { backgroundColor: dark ? '#0A1A37' : '#FFFFFF', borderColor: dark ? '#294263' : '#D8E5DD' },
              ]}
            >
              <View style={styles.batteryRow}>
                <ThemedText style={styles.batteryLabel}>Battery</ThemedText>
                <ThemedText style={styles.batteryValue}>
                  {latest?.battery_voltage != null ? `${latest.battery_voltage.toFixed(1)} V` : '--'}
                </ThemedText>
              </View>
              <View style={styles.batteryBarBg}>
                <View
                  style={[
                    styles.batteryBarFill,
                    {
                      width: `${latest?.battery_voltage != null ? Math.min(Math.max(((latest.battery_voltage - 10) / 5) * 100, 0), 100) : 0}%`,
                      backgroundColor:
                        latest?.battery_voltage != null && latest.battery_voltage < 11.8
                          ? '#FF3B30'
                          : latest?.battery_voltage != null && latest.battery_voltage < 12.4
                            ? '#FF9500'
                            : '#34C759',
                    },
                  ]}
                />
              </View>
              <View style={styles.batteryLabels}>
                <ThemedText style={styles.batteryRangeLabel}>10V</ThemedText>
                <ThemedText style={styles.batteryRangeLabel}>12.6V</ThemedText>
                <ThemedText style={styles.batteryRangeLabel}>15V</ThemedText>
              </View>
            </View>

            {/* History Charts */}
            {readings.length >= 2 && (
              <>
                <ThemedText style={styles.sectionTitle}>Trends ({readings.length} readings)</ThemedText>
                <TouchableOpacity onPress={refresh} disabled={refreshing} style={styles.refreshBtn}>
                  <Text style={[styles.refreshBtnText, { color: palette.accent }]}>
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>

                <MiniLineChart data={chartData.rpm} color="#2DD4BF" label="RPM" unit="rev/min" dark={dark} />
                <MiniLineChart data={chartData.coolant} color="#34C759" label="Coolant Temperature" unit="°C" dark={dark} />
                <MiniLineChart data={chartData.speed} color="#2DD4BF" label="Speed" unit="km/h" dark={dark} />
                <MiniLineChart data={chartData.load} color="#FF9500" label="Engine Load" unit="%" dark={dark} />
                <MiniLineChart data={chartData.battery} color="#34C759" label="Battery Voltage" unit="V" dark={dark} />
                <MiniLineChart data={chartData.fuelUse} color="#5856D6" label="Fuel Consumption" unit="L/100km" dark={dark} />
                <MiniLineChart data={chartData.fuelRate} color="#0A84FF" label="Fuel Rate" unit="L/h" dark={dark} />
                <MiniLineChart data={chartData.maf} color="#FF2D55" label="Mass Air Flow" unit="g/s" dark={dark} />
              </>
            )}

            {/* Diagnostic Trouble Codes */}
            <ThemedText style={styles.sectionTitle}>
              Trouble Codes {latest?.dtcs?.length ? `(${latest.dtcs.length})` : ''}
            </ThemedText>
            {!latest?.dtcs?.length ? (
              <View
                style={[
                  styles.noDtcCard,
                  { backgroundColor: dark ? '#0A1A37' : '#FFFFFF', borderColor: dark ? '#294263' : '#D8E5DD' },
                ]}
              >
                <Text style={{ fontSize: 28 }}>{'✓'}</Text>
                <ThemedText style={styles.noDtcText}>No trouble codes detected</ThemedText>
                <ThemedText style={styles.noDtcHint}>Your vehicle systems are operating normally.</ThemedText>
              </View>
            ) : (
              latest.dtcs.map((dtc) => (
                <DtcBadge key={dtc.code} code={dtc.code} description={dtc.description} />
              ))
            )}
          </>
        )}
        <TouchableOpacity
          style={[styles.emptyBtn, styles.backBottomBtn, { backgroundColor: primaryBtnBg }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.primaryBtnText, { color: primaryBtnText }]}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07142B' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  scanBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#062B32', fontSize: 15, fontWeight: '700' },
  backBottomBtn: { alignSelf: 'center', marginTop: 20 },
  title: { marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#8DA0B8', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 },

  // Gauges
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },

  // Battery
  batteryCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 12,
  },
  batteryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  batteryLabel: { fontSize: 14, fontWeight: '700' },
  batteryValue: { fontSize: 22, fontWeight: '800' },
  batteryBarBg: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EFF6F1',
    overflow: 'hidden',
  },
  batteryBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  batteryLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  batteryRangeLabel: { fontSize: 9, color: '#8DA0B8' },

  // Refresh
  refreshBtn: { marginBottom: 12 },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: '#2DD4BF' },

  // DTCs
  noDtcCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  noDtcText: { fontSize: 16, fontWeight: '700' },
  noDtcHint: { fontSize: 12, color: '#8DA0B8', textAlign: 'center' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 14, color: '#8DA0B8', textAlign: 'center', maxWidth: 280 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyBtnText: { color: '#062B32', fontSize: 15, fontWeight: '700' },
});
