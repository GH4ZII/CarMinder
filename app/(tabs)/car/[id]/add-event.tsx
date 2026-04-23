import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, MaintenanceEventCreate, ReceiptOcrResult } from '../../../../frontendServices/apiCall';

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
  const insets = useSafeAreaInsets();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { user, getToken } = useAuth();
  const scheme = useColorScheme();

  const colors = useMemo(() => {
    return {
      bg: '#07142B',
      card: '#0A1A37',
      text: '#E9EEF7',
      subtext: '#8DA0B8',
      border: '#294263',
      placeholder: '#8DA0B8',
      chip: '#102449',
      primary: '#2DD4BF',
      success: '#2DD4BF',
    };
  }, [scheme]);

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [eventType, setEventType] = useState<string | null>(null);

  const [eventDate, setEventDate] = useState<string>(() => toYYYYMMDD(new Date()));
  const [eventTime, setEventTime] = useState<string>(() => toHHMM(new Date()));

  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [pickerTime, setPickerTime] = useState(() => new Date());

  // Memoize maximumDate to prevent spinner jumping
  const maximumDate = useMemo(() => new Date(), []);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDateIOSModal, setShowDateIOSModal] = useState(false);
  const [showTimeIOSModal, setShowTimeIOSModal] = useState(false);

  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await api.getEventTypes();
        if (!cancelled) {
          setEventTypes(types);
          if (!eventType && types.length) {
            setEventType(types[0]);
          }
        }
      } catch {
        if (!cancelled) Alert.alert('Error', 'Failed to load event types.');
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventType]);

  const openDatePicker = useCallback(() => {
    const now = new Date();
    if (eventDate === toYYYYMMDD(now)) {
      setPickerDate(now);
    } else if (eventDate) {
      setPickerDate(new Date(eventDate + 'T12:00:00'));
    } else {
      setPickerDate(now);
    }
    if (isIOS) {
      setShowDateIOSModal(true);
    } else {
      setShowDatePicker(true);
    }
  }, [eventDate, isIOS]);

  const openTimePicker = useCallback(() => {
    const base = new Date();
    const [hh, mm] = (eventTime || '12:00').split(':').map((x) => parseInt(x, 10));
    if (!Number.isNaN(hh)) base.setHours(hh);
    if (!Number.isNaN(mm)) base.setMinutes(mm);
    base.setSeconds(0);
    base.setMilliseconds(0);
    setPickerTime(base);
    if (isIOS) {
      setShowTimeIOSModal(true);
    } else {
      setShowTimePicker(true);
    }
  }, [eventTime, isIOS]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
        if (event.type === 'set' && selectedDate) {
          setPickerDate(selectedDate);
          setEventDate(toYYYYMMDD(selectedDate));
        }
        return;
      }
      // iOS - use event.nativeEvent.timestamp for v8.x compatibility
      const date = selectedDate ?? (event.nativeEvent.timestamp ? new Date(event.nativeEvent.timestamp) : null);
      if (date) {
        setPickerDate(date);
        setEventDate(toYYYYMMDD(date));
      }
    },
    []
  );

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
        if (event.type === 'set' && selectedTime) {
          setPickerTime(selectedTime);
          setEventTime(toHHMM(selectedTime));
        }
        return;
      }
      // iOS - use event.nativeEvent.timestamp for v8.x compatibility
      const time = selectedTime ?? (event.nativeEvent.timestamp ? new Date(event.nativeEvent.timestamp) : null);
      if (time) {
        setPickerTime(time);
        setEventTime(toHHMM(time));
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
      const token = await getToken();  // Use getToken() instead of user.getIdToken()
      
      if (!token) {
        Alert.alert('Error', 'Could not get auth token. Please sign in again.');
        return;
      }
      
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

      await api.createMaintenanceEvent(carId, token, payload);
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create event.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const applyOcrPrefill = useCallback((result: ReceiptOcrResult) => {
    let updates = 0;

    if (result.event_date) {
      setEventDate(result.event_date);
      updates += 1;
    }

    if (typeof result.cost === 'number' && Number.isFinite(result.cost)) {
      setCost(String(result.cost));
      updates += 1;
    }

    if (result.vendor) {
      setVendor(result.vendor);
      updates += 1;
    }

    if (result.notes) {
      setNotes(result.notes);
      updates += 1;
    }

    if (typeof result.mileage === 'number' && Number.isFinite(result.mileage)) {
      setMileage(String(result.mileage));
      updates += 1;
    }

    if (updates === 0) {
      Alert.alert('No fields detected', 'OCR could not confidently extract values from this receipt.');
    }
  }, []);

  const handleScanReceipt = useCallback(async () => {
    if (!user) return;

    try {
      setScanningReceipt(true);

      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Could not get auth token. Please sign in again.');
        return;
      }

      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert('Camera permission required', 'Please allow camera access to scan receipts.');
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.75,
      });

      if (cameraResult.canceled || !cameraResult.assets?.length) {
        return;
      }

      const asset = cameraResult.assets[0];
      const ocrResult = await api.scanReceipt(token, {
        uri: asset.uri,
        name: asset.fileName ?? 'receipt.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });

      applyOcrPrefill(ocrResult);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to scan receipt.';
      Alert.alert('OCR scan failed', msg);
    } finally {
      setScanningReceipt(false);
    }
  }, [applyOcrPrefill, getToken, user]);

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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText type="title" style={styles.title}>
            Add maintenance event
          </ThemedText>

        {loadingTypes ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <>
            <ThemedText style={[styles.label, { color: colors.subtext }]}>
              Event type <Text style={styles.required}>*</Text>
            </ThemedText>
            {isIOS ? (
              <Pressable
                style={[
                  styles.selectButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => {
                  if (!eventTypes.length) return;
                  ActionSheetIOS.showActionSheetWithOptions(
                    {
                      options: [...eventTypes.map((t) => EVENT_LABELS[t] ?? t), 'Cancel'],
                      cancelButtonIndex: eventTypes.length,
                      title: 'Select event type',
                    },
                    (idx) => {
                      if (idx === undefined || idx === eventTypes.length) return;
                      setEventType(eventTypes[idx]);
                    }
                  );
                }}
              >
                <Text style={[styles.selectButtonText, { color: colors.text }]}>
                  {eventType ? EVENT_LABELS[eventType] ?? eventType : 'Select event type'}
                </Text>
              </Pressable>
            ) : (
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
                        eventType === t && { color: '#062B32' },
                      ]}
                    >
                      {EVENT_LABELS[t] ?? t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <ThemedText style={[styles.label, { color: colors.subtext }]}>
              Date <Text style={styles.required}>*</Text>
            </ThemedText>
            {isWeb ? (
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
                  <Text style={[styles.selectButtonText, { color: colors.text }]}>
                    {eventDate}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={maximumDate}
                  />
                )}
                {isIOS && (
                  <Modal visible={showDateIOSModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                      <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                        <DateTimePicker
                          value={pickerDate}
                          mode="date"
                          display="spinner"
                          onChange={handleDateChange}
                          maximumDate={maximumDate}
                          themeVariant={scheme === 'dark' ? 'dark' : 'light'}
                          style={styles.iosPicker}
                        />
                        <TouchableOpacity
                          style={[styles.modalDone, { backgroundColor: colors.primary }]}
                          onPress={() => setShowDateIOSModal(false)}
                        >
                          <Text style={styles.modalDoneText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                )}
              </>
            )}

            <ThemedText style={[styles.label, { color: colors.subtext }]}>Time</ThemedText>
            {isWeb ? (
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
                {isIOS && (
                  <Modal visible={showTimeIOSModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                      <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                        <DateTimePicker
                          value={pickerTime}
                          mode="time"
                          display="spinner"
                          onChange={handleTimeChange}
                          themeVariant={scheme === 'dark' ? 'dark' : 'light'}
                          style={styles.iosPicker}
                        />
                        <TouchableOpacity
                          style={[styles.modalDone, { backgroundColor: colors.primary }]}
                          onPress={() => setShowTimeIOSModal(false)}
                        >
                          <Text style={styles.modalDoneText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.scanBtn,
                { borderColor: colors.primary },
                scanningReceipt && styles.submitBtnDisabled,
              ]}
              onPress={handleScanReceipt}
              disabled={scanningReceipt || submitting}
            >
              {scanningReceipt ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.scanBtnText, { color: colors.primary }]}>Scan receipt (OCR)</Text>
              )}
            </TouchableOpacity>

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
                <ActivityIndicator color="#062B32" />
              ) : (
                <Text style={styles.submitBtnText}>Save event</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 0, marginBottom: 16 },
  backBtnText: { fontSize: 17, fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: { marginBottom: 24, lineHeight: 32 },
  loader: { marginVertical: 24 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  required: { color: '#FF3B30', fontWeight: '700' },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  typeChipText: { fontSize: 15, fontWeight: '500' },

  pickerBlock: { marginBottom: 16, width: '100%' },

  selectButton: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  selectButtonText: { fontSize: 16 },
  iosPicker: { alignSelf: 'stretch' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2A2A35',
  },
  modalDone: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalDoneText: { color: '#062B32', fontSize: 16, fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  submitBtn: {
    padding: 16,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#062B32', fontSize: 16, fontWeight: '700' },
  scanBtn: {
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  scanBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
