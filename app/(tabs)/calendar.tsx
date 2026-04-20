import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, CarInfo, MaintenanceEvent } from '../../frontendServices/apiCall';

// ─── Helpers ────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  oil_change: 'Oil Change',
  brake_service: 'Brake Service',
  tire_change: 'Tire Change',
  inspection: 'Inspection',
  repair: 'Repair',
  other: 'Other',
};

const EVENT_TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  oil_change: 'oil-barrel',
  brake_service: 'build',
  tire_change: 'tire-repair',
  inspection: 'search',
  repair: 'settings',
  other: 'assignment',
};

function formatShortDate(s: string): { month: string; day: string; year: string } {
  const d = new Date(s + 'T00:00:00');
  const month = MONTH_NAMES[d.getMonth()]?.substring(0, 3).toUpperCase() ?? '';
  const day = String(d.getDate());
  const year = String(d.getFullYear());
  return { month, day, year };
}

function formatCost(cents: number): string {
  return `${(cents / 100).toFixed(0)} kr`;
}

// ─── Month/Year Picker Modal ────────────────────────────────

function MonthYearPicker({
  visible,
  currentYear,
  currentMonth,
  onSelect,
  onClose,
  isDark,
}: {
  visible: boolean;
  currentYear: number;
  currentMonth: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const [pickerYear, setPickerYear] = useState(currentYear);
  const yearListRef = useRef<FlatList>(null);

  const bgColor = '#0A1A37';
  const textColor = '#E9EEF7';
  const dimColor = '#8DA0B8';
  const pillBg = '#102449';

  const now = new Date();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = now.getFullYear() - 10; y <= now.getFullYear() + 5; y++) list.push(y);
    return list;
  }, []);

  // Scroll to current year when opened
  const onYearLayout = useCallback(() => {
    const idx = years.indexOf(pickerYear);
    if (idx >= 0 && yearListRef.current) {
      yearListRef.current.scrollToIndex({ index: Math.max(0, idx - 2), animated: false });
    }
  }, [pickerYear, years]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.pickerContainer, { backgroundColor: bgColor }]}>
          {/* Year Scroll */}
          <Text style={[styles.pickerLabel, { color: dimColor }]}>Year</Text>
          <FlatList
            ref={yearListRef}
            data={years}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item)}
            contentContainerStyle={styles.yearList}
            onLayout={onYearLayout}
            getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
            renderItem={({ item: year }) => {
              const isActive = year === pickerYear;
              return (
                <TouchableOpacity
                  style={[
                    styles.yearPill,
                    { backgroundColor: isActive ? '#2DD4BF' : pillBg },
                  ]}
                  onPress={() => setPickerYear(year)}
                >
                  <Text style={[styles.yearText, { color: isActive ? '#062B32' : textColor }]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Month Grid */}
          <Text style={[styles.pickerLabel, { color: dimColor, marginTop: 16 }]}>Month</Text>
          <View style={styles.monthGrid}>
            {MONTH_NAMES.map((name, idx) => {
              const isActive = idx === currentMonth && pickerYear === currentYear;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.monthCell,
                    { backgroundColor: isActive ? '#2DD4BF' : pillBg },
                  ]}
                  onPress={() => {
                    onSelect(pickerYear, idx);
                    onClose();
                  }}
                >
                  <Text style={[styles.monthCellText, { color: isActive ? '#062B32' : textColor }]}>
                    {name.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Car Selector ───────────────────────────────────────────

function CarSelector({
  cars,
  selectedId,
  onSelect,
  isDark,
}: {
  cars: CarInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isDark: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carSelectorContent}
      style={styles.carSelector}
    >
      {cars.map((car) => {
        const isActive = car.id === selectedId;
        return (
          <TouchableOpacity
            key={car.id}
            style={[
              styles.carPill,
              {
                backgroundColor: isActive
                  ? '#2DD4BF'
                  : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.06)',
              },
            ]}
            onPress={() => car.id && onSelect(car.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.carPillText,
                {
                  color: isActive ? '#062B32' : '#E9EEF7',
                },
              ]}
            >
              {car.merke} {car.modell}
            </Text>
            <Text
              style={[
                styles.carPillReg,
                {
                  color: isActive
                    ? 'rgba(255,255,255,0.8)'
                    : isDark
                      ? 'rgba(255,255,255,0.5)'
                      : 'rgba(0,0,0,0.5)',
                },
              ]}
            >
              {car.registreringsnummer}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Event Entry Card ───────────────────────────────────────

function EventEntry({
  event,
  isFirst,
  isLast,
  isDark,
  onPress,
}: {
  event: MaintenanceEvent;
  isFirst: boolean;
  isLast: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { month, day } = formatShortDate(event.event_date);
  const iconName = EVENT_TYPE_ICONS[event.event_type] ?? 'assignment';
  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;

  const tags: string[] = [];
  if (event.vendor) tags.push(event.vendor);
  if (event.mileage != null) tags.push(`${event.mileage.toLocaleString()} km`);
  if (event.cost_cents != null) tags.push(formatCost(event.cost_cents));

  const hasNotes = !!event.notes;

  return (
    <View style={styles.entryRow}>
      {/* Date Column — tap to navigate calendar */}
      <TouchableOpacity style={styles.entryDateCol} onPress={onPress} activeOpacity={0.6}>
        <Text style={[styles.entryMonth, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
          {isFirst ? month : ''}
        </Text>
        <Text style={[styles.entryDay, { color: '#E9EEF7' }]}>
          {isFirst ? day : ''}
        </Text>
      </TouchableOpacity>

      {/* Timeline Column — continuous line, tap to navigate */}
      <TouchableOpacity style={styles.timelineCol} onPress={onPress} activeOpacity={0.6}>
        <View style={[styles.timelineLine, { backgroundColor: isFirst ? 'transparent' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') }]} />
        <View style={styles.timelineDot} />
        <View style={[styles.timelineLineBottom, { backgroundColor: isLast ? 'transparent' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') }]} />
      </TouchableOpacity>

      {/* Card */}
      <TouchableOpacity
        style={[
          styles.entryCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          },
        ]}
        activeOpacity={0.7}
        onPress={() => hasNotes ? setExpanded(!expanded) : onPress()}
      >
        <View style={styles.entryCardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.entryTitleRow}>
              <MaterialIcons name={iconName} size={16} color="#E9EEF7" />
              <Text style={[styles.entryTitle, { color: '#E9EEF7' }]}>
                {label}
              </Text>
            </View>
            {tags.length > 0 && (
              <View style={styles.entryTags}>
                {tags.map((tag, i) => (
                  <View
                    key={i}
                    style={[
                      styles.entryTag,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
                    <View style={styles.entryTagInner}>
                      <MaterialIcons name={iconName} size={12} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'} />
                      <Text
                        style={[
                          styles.entryTagText,
                          { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)' },
                        ]}
                      >
                        {tag}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
          {hasNotes && (
            <MaterialIcons
              name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={18}
              color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
              style={styles.expandArrow}
            />
          )}
        </View>
        {expanded && event.notes && (
          <Text style={[styles.entryNotes, { color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }]}>
            {event.notes}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────

export default function CalendarScreen() {
  const { user, getToken } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [cars, setCars] = useState<CarInfo[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Key to force Calendar re-render when we jump via picker
  const [calendarKey, setCalendarKey] = useState(0);

  const scrollRef = useRef<ScrollView>(null);

  // Fetch cars on focus
  const fetchCars = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const carsData = await api.getUserCars(token);
      setCars(carsData);
      if (carsData.length > 0 && !selectedCarId) {
        setSelectedCarId(carsData[0].id ?? null);
      }
    } catch (e) {
      console.error('Failed to fetch cars:', e);
    } finally {
      setLoading(false);
    }
  }, [user, getToken, selectedCarId]);

  useFocusEffect(
    useCallback(() => {
      fetchCars();
    }, [fetchCars])
  );

  // Fetch events when selected car changes
  const fetchEvents = useCallback(async () => {
    if (!selectedCarId || !user) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const eventsData = await api.getMaintenanceEvents(selectedCarId, token);
      setEvents(eventsData);
    } catch (e: any) {
      console.error('Failed to fetch events:', `status=${e?.status}`, e?.detail ?? e?.message ?? e);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [selectedCarId, user, getToken]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  // Build markedDates for the Calendar component
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    events.forEach((e) => {
      marks[e.event_date] = {
        marked: true,
        dotColor: '#2DD4BF',
        ...(e.event_date === selectedDate && { selected: true, selectedColor: '#2DD4BF' }),
      };
    });
    if (selectedDate && !marks[selectedDate]) {
      marks[selectedDate] = { selected: true, selectedColor: '#2DD4BF' };
    }
    return marks;
  }, [events, selectedDate]);

  // Current initial date for the Calendar component
  const initialDate = useMemo(() => {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
  }, [viewYear, viewMonth, calendarKey]);

  // All events sorted newest first for the full timeline
  const allEventsSorted = useMemo(() => {
    return [...events].sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [events]);

  // Group events by date for timeline
  const groupedEntries = useMemo(() => {
    const result: { event: MaintenanceEvent; isFirst: boolean; isLast: boolean }[] = [];
    let lastDate = '';
    allEventsSorted.forEach((event, idx) => {
      const isFirst = event.event_date !== lastDate;
      result.push({ event, isFirst, isLast: idx === allEventsSorted.length - 1 });
      lastDate = event.event_date;
    });
    return result;
  }, [allEventsSorted]);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString === selectedDate ? null : day.dateString);
  };

  const handleMonthChange = (month: DateData) => {
    setViewYear(month.year);
    setViewMonth(month.month - 1);
    setSelectedDate(null);
  };

  const handleSelectCar = (carId: string) => {
    setSelectedCarId(carId);
    setSelectedDate(null);
  };

  // Navigate calendar to a specific event date when tapped in timeline
  const handleEntryPress = (eventDate: string) => {
    const d = new Date(eventDate + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();

    setViewYear(year);
    setViewMonth(month);
    setSelectedDate(eventDate);
    setCalendarKey((k) => k + 1);

    // Scroll to top to show the calendar
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handlePickerSelect = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    setSelectedDate(null);
    setCalendarKey((k) => k + 1);
  };

  if (!user) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.emptyText}>Sign in to view your calendar.</ThemedText>
      </ThemedView>
    );
  }

  const handleRefresh = async () => {
    await fetchCars();
    await fetchEvents();
  };

  const calendarTheme = {
    backgroundColor: 'transparent',
    calendarBackground: 'transparent',
    textSectionTitleColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    dayTextColor: '#E9EEF7',
    todayTextColor: '#2DD4BF',
    monthTextColor: '#E9EEF7',
    arrowColor: '#2DD4BF',
    textDisabledColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    selectedDayBackgroundColor: '#2DD4BF',
    selectedDayTextColor: '#062B32',
    textDayFontWeight: '500' as const,
    textMonthFontWeight: '700' as const,
    textDayHeaderFontWeight: '600' as const,
    textDayFontSize: 15,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 13,
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading || eventsLoading} onRefresh={handleRefresh} />}
      >
        <ThemedText type="title" style={[styles.screenTitle, { paddingTop: insets.top + 12 }]}>Calendar</ThemedText>

        {/* Car Selector */}
        {cars.length > 0 && (
          <CarSelector
            cars={cars}
            selectedId={selectedCarId}
            onSelect={handleSelectCar}
            isDark={isDark}
          />
        )}

        {loading && cars.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : cars.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={styles.emptyText}>No cars added yet.</ThemedText>
          </View>
        ) : (
          <>
            {/* Calendar with tappable header */}
            <View style={styles.calendarWrapper}>
              <Calendar
                key={calendarKey}
                current={initialDate}
                markedDates={markedDates}
                onDayPress={handleDayPress}
                onMonthChange={handleMonthChange}
                theme={calendarTheme}
                firstDay={1}
                enableSwipeMonths
                renderHeader={(date: string) => (
                  <TouchableOpacity onPress={() => setPickerVisible(true)} activeOpacity={0.6}>
                    <Text style={[styles.calendarHeader, { color: '#E9EEF7' }]}>
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Full Timeline */}
            <View style={styles.entriesSection}>
              <ThemedText type="subtitle" style={styles.entriesTitle}>
                All Events
              </ThemedText>

              {eventsLoading ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
              ) : groupedEntries.length === 0 ? (
                <ThemedText style={styles.noEntries}>No events recorded yet.</ThemedText>
              ) : (
                groupedEntries.map(({ event, isFirst, isLast }) => (
                  <EventEntry
                    key={event.id}
                    event={event}
                    isFirst={isFirst}
                    isLast={isLast}
                    isDark={isDark}
                    onPress={() => handleEntryPress(event.event_date)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Month/Year Picker */}
      <MonthYearPicker
        visible={pickerVisible}
        currentYear={viewYear}
        currentMonth={viewMonth}
        onSelect={handlePickerSelect}
        onClose={() => setPickerVisible(false)}
        isDark={isDark}
      />
    </ThemedView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 200 },
  screenTitle: { paddingHorizontal: 20, marginBottom: 12 },

  // Car Selector
  carSelector: { marginBottom: 16 },
  carSelectorContent: { paddingHorizontal: 20, gap: 10 },
  carPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  carPillText: { fontSize: 14, fontWeight: '600' },
  carPillReg: { fontSize: 11, marginTop: 2 },

  // Calendar
  calendarWrapper: { paddingHorizontal: 12, marginBottom: 8 },
  calendarHeader: { fontSize: 18, fontWeight: '700' },

  // Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
  },
  pickerLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  yearList: { gap: 8, paddingVertical: 4 },
  yearPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    width: 64,
    alignItems: 'center',
  },
  yearText: { fontSize: 15, fontWeight: '600' },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthCell: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  monthCellText: { fontSize: 15, fontWeight: '600' },

  // Entries
  entriesSection: { paddingHorizontal: 20, marginTop: 16 },
  entriesTitle: { marginBottom: 16 },
  noEntries: { opacity: 0.6, textAlign: 'center', marginTop: 20 },
  emptyText: { fontSize: 16, opacity: 0.7, textAlign: 'center' },

  // Event Entry
  entryRow: { flexDirection: 'row', marginBottom: 4, minHeight: 70 },

  entryDateCol: { width: 48, alignItems: 'center', paddingTop: 14 },
  entryMonth: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  entryDay: { fontSize: 20, fontWeight: '700' },

  timelineCol: { width: 24, alignItems: 'center' },
  timelineLine: { width: 2, flex: 1 },
  timelineLineBottom: { width: 2, flex: 1 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2DD4BF',
    marginVertical: 4,
  },

  entryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    marginLeft: 8,
    marginBottom: 8,
  },
  entryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  entryTitle: { fontSize: 16, fontWeight: '700' },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  entryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  entryTagInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  entryTagText: { fontSize: 12, fontWeight: '500' },
  expandArrow: { fontSize: 12, paddingTop: 4, paddingLeft: 8 },
  entryNotes: { fontSize: 14, lineHeight: 20, marginTop: 10 },
});
