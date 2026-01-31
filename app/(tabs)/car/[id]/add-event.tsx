import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { api, MaintenanceEventCreate } from '../../../../frontendServices/apiCall';

const EVENT_LABELS: Record<string, string> = {
  oil_change: 'Oil change',
  brake_service: 'Brake service',
  tire_change: 'Tire change',
  inspection: 'Inspection',
  repair: 'Repair',
  other: 'Other',
};

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function AddMaintenanceEventScreen() {
  const router = useRouter();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const scheme = useColorScheme();

  const colors = useMemo(() => {
    const dark = scheme === 'dark';
    return {
      bg: dark ? '#0B0B0F' : '#F5F5F5',
      card: dark ? '#121218' : '#FFFFFF',
      text: dark ? '#FFFFFF' : '#111111',
      subtext: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
      border: dark ? '#2A2A35' : '#DDDDDD',
      placeholder: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
      chip: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
      primary: '#007AFF',
      success: '#34C759',
    };
  }, [scheme]);

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eventType, setEventType] = useState<string | null>(null);

  const [eventDate, setEventDate] = useState(() => toYYYYMMDD(new Date()));
  const [eventTime, setEventTime] = useState(() => toHHMM(new Date()));

  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [pickerTime, setPickerTime] = useState(() => new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const iosVersion =
    typeof Platform.Version === 'string'
      ? parseInt(Platform.Version, 10)
      : Platform.Version;
  const iosDateDisplay = iosVersion >= 14 ? 'inline' : 'spinner';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await api.getEventTypes();
        if (!cancelled) setEventTypes(types);
      } catch {
        if (!cancelled) Alert.alert('Error', 'Failed to load event types.');
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDatePicker = useCallback(() => {
    const now = new Date();
    if (eventDate === toYYYYMMDD(now)) {
      setPickerDate(now);
    } else if (eventDate) {
      setPickerDate(new Date(eventDate + 'T12:00:00'));
    } else {
      setPickerDate(now);
    }
    setShowDatePicker(true);
  }, [eventDate]);

  const openTimePicker = useCallback(() => {
    const base = new Date();
    const [hh, mm] = (eventTime || '12:00').split(':').map((x) => parseInt(x, 10));
    if (!Number.isNaN(hh)) base.setHours(hh);
    if (!Number.isNaN(mm)) base.setMinutes(mm);
    base.setSeconds(0);
    base.setMilliseconds(0);
    setPickerTime(base);
    setShowTimePicker(true);
  }, [eventTime]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
        if (event.type === 'set' && selectedDate) {
          setEventDate(toYYYYMMDD(selectedDate));
        }
        return;
      }
      if (selectedDate) {
        setPickerDate(selectedDate);
        setEventDate(toYYYYMMDD(selectedDate));
      }
    },
    []
  );

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
        if (event.type === 'set' && selectedTime) {
          setEventTime(toHHMM(selectedTime));
        }
        return;
      }
      if (selectedTime) {
        setPickerTime(selectedTime);
        setEventTime(toHHMM(selectedTime));
      }
    },
    []
  );

  const handleSubmit = async () => {
    if (!carId || !user) return;
    if (!eventType) {
      Alert.alert('Error', 'Select an event type.');
      return;
    }
    if (!eventDate?.trim()) {
      Alert.alert('Error', 'Select the event date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: MaintenanceEventCreate = {
        event_type: eventType,
        event_date: eventDate.trim(),
      };

      // If your backend supports time, add an explicit field there and include it here.
      // Example:
      // (payload as any).event_time = eventTime;

      const m = mileage.trim();
      if (m) {
        const mi = parseInt(m, 10);
        if (!Number.isNaN(mi)) payload.mileage = mi;
      }
      const c = cost.trim();
      if (c) {
        const co = parseFloat(c);
        if (!Number.isNaN(co)) payload.cost = co;
      }
      if (vendor.trim()) payload.vendor = vendor.trim();
      if (notes.trim()) payload.notes = notes.trim();

      await api.createMaintenanceEvent(carId, user.uid, payload);
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create event.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!carId || !user) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: colors.bg }]}>
        <ThemedText>Missing car or not logged in.</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={[styles.backBtnText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="title" style={styles.title}>
          Add maintenance event
        </ThemedText>

        {loadingTypes ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <>
            <ThemedText style={[styles.label, { color: colors.subtext }]}>Event type</ThemedText>
            <View style={styles.typeRow}>
              {eventTypes.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.chip },
                    eventType === t && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setEventType(t)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: colors.text },
                      eventType === t && { color: '#fff' },
                    ]}
                  >
                    {EVENT_LABELS[t] ?? t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Date</ThemedText>
            {isIOS ? (
              <View style={styles.pickerBlock}>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display={iosDateDisplay}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  themeVariant={scheme === 'dark' ? 'dark' : 'light'}
                />
              </View>
            ) : isWeb ? (
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
                inputMode="numeric"
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={openDatePicker}
                >
                  <Text style={[styles.selectButtonText, { color: colors.text }]}>{eventDate}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                  />
                )}
              </>
            )}

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Time</ThemedText>
            {isIOS ? (
              <View style={styles.pickerBlock}>
                <DateTimePicker
                  value={pickerTime}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  themeVariant={scheme === 'dark' ? 'dark' : 'light'}
                />
              </View>
            ) : isWeb ? (
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                value={eventTime}
                onChangeText={setEventTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.placeholder}
                inputMode="numeric"
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={openTimePicker}
                >
                  <Text style={[styles.selectButtonText, { color: colors.text }]}>{eventTime}</Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={pickerTime}
                    mode="time"
                    display="default"
                    onChange={handleTimeChange}
                  />
                )}
              </>
            )}

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Mileage (optional)</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              value={mileage}
              onChangeText={setMileage}
              placeholder="km"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
            />

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Cost (optional)</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              value={cost}
              onChangeText={setCost}
              placeholder="e.g. 1299.00"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Vendor (optional)</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              value={vendor}
              onChangeText={setVendor}
              placeholder="Workshop or shop name"
              placeholderTextColor={colors.placeholder}
            />

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Notes (optional)</ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Details"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.success },
                submitting && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Save event</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 0, marginBottom: 16 },
  backBtnText: { fontSize: 17, fontWeight: '500' },
  scroll: { flex: 1 },
  title: { marginBottom: 24 },
  loader: { marginVertical: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  typeChipText: { fontSize: 15, fontWeight: '500' },

  pickerBlock: { marginBottom: 16, width: '100%' },

  selectButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  selectButtonText: { fontSize: 16 },

  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  submitBtn: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
