import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, IncidentAttachmentUpload, IncidentReportCreate } from '../../../../frontendServices/apiCall';

const SEVERITY_LABELS: Record<string, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  severe: 'Severe',
};

const REPAIR_STATUS_LABELS: Record<string, string> = {
  not_repaired: 'Not repaired',
  partially_repaired: 'Partially repaired',
  fully_repaired: 'Fully repaired',
};

const SEVERITY_LEVELS = ['minor', 'moderate', 'severe'];
const REPAIR_STATUSES = ['not_repaired', 'partially_repaired', 'fully_repaired'];

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AddIncidentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: carId } = useLocalSearchParams<{ id: string }>();
  const { user, getToken } = useAuth();
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
      primary: '#1A1A1A',
      success: '#1A1A1A',
    };
  }, [scheme]);

  const [submitting, setSubmitting] = useState(false);
  const [severity, setSeverity] = useState<string>('minor');
  const [repairStatus, setRepairStatus] = useState<string>('not_repaired');
  const [incidentDate, setIncidentDate] = useState<string>(() => toYYYYMMDD(new Date()));
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const maximumDate = useMemo(() => new Date(), []);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDateIOSModal, setShowDateIOSModal] = useState(false);
  const [description, setDescription] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairVendor, setRepairVendor] = useState('');
  const [mileage, setMileage] = useState('');
  const [insuranceClaim, setInsuranceClaim] = useState(false);
  const [beforeImage, setBeforeImage] = useState<IncidentAttachmentUpload | null>(null);
  const [afterImage, setAfterImage] = useState<IncidentAttachmentUpload | null>(null);
  const [receiptPdf, setReceiptPdf] = useState<IncidentAttachmentUpload | null>(null);

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const openDatePicker = useCallback(() => {
    const now = new Date();
    if (incidentDate === toYYYYMMDD(now)) {
      setPickerDate(now);
    } else if (incidentDate) {
      setPickerDate(new Date(incidentDate + 'T12:00:00'));
    } else {
      setPickerDate(now);
    }
    if (isIOS) {
      setShowDateIOSModal(true);
    } else {
      setShowDatePicker(true);
    }
  }, [incidentDate, isIOS]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
        if (event.type === 'set' && selectedDate) {
          setPickerDate(selectedDate);
          setIncidentDate(toYYYYMMDD(selectedDate));
        }
        return;
      }
      const date = selectedDate ?? (event.nativeEvent.timestamp ? new Date(event.nativeEvent.timestamp) : null);
      if (date) {
        setPickerDate(date);
        setIncidentDate(toYYYYMMDD(date));
      }
    },
    []
  );

  const showSeverityPicker = useCallback(() => {
    if (!isIOS) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SEVERITY_LEVELS.map((s) => SEVERITY_LABELS[s]), 'Cancel'],
        cancelButtonIndex: SEVERITY_LEVELS.length,
        title: 'Select severity',
      },
      (idx) => {
        if (idx !== undefined && idx < SEVERITY_LEVELS.length) {
          setSeverity(SEVERITY_LEVELS[idx]);
        }
      }
    );
  }, [isIOS]);

  const showRepairStatusPicker = useCallback(() => {
    if (!isIOS) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...REPAIR_STATUSES.map((s) => REPAIR_STATUS_LABELS[s]), 'Cancel'],
        cancelButtonIndex: REPAIR_STATUSES.length,
        title: 'Select repair status',
      },
      (idx) => {
        if (idx !== undefined && idx < REPAIR_STATUSES.length) {
          setRepairStatus(REPAIR_STATUSES[idx]);
        }
      }
    );
  }, [isIOS]);

  const pickImage = useCallback(async (kind: 'before' | 'after') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach incident images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    const attachment: IncidentAttachmentUpload = {
      uri: asset.uri,
      name: asset.fileName ?? `incident-${kind}-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    };

    if (kind === 'before') {
      setBeforeImage(attachment);
    } else {
      setAfterImage(attachment);
    }
  }, []);

  const pickReceiptPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    setReceiptPdf({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/pdf',
    });
  }, []);

  const handleSubmit = async () => {
    if (!carId || !user) return;
    if (!description.trim()) {
      Alert.alert('Error', 'Please describe what happened.');
      return;
    }
    if (!incidentDate?.trim()) {
      Alert.alert('Error', 'Select the incident date.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Could not get auth token. Please sign in again.');
        return;
      }

      const payload: IncidentReportCreate = {
        incident_date: incidentDate.trim(),
        severity,
        description: description.trim(),
        repair_status: repairStatus,
        insurance_claim: insuranceClaim,
      };

      if (damageDescription.trim()) payload.damage_description = damageDescription.trim();
      const m = mileage.trim();
      if (m) {
        const mi = parseInt(m, 10);
        if (!Number.isNaN(mi)) payload.mileage = mi;
      }
      const c = repairCost.trim();
      if (c) {
        const co = parseFloat(c);
        if (!Number.isNaN(co)) payload.repair_cost = co;
      }
      if (repairVendor.trim()) payload.repair_vendor = repairVendor.trim();

      await api.createIncident(carId, token, payload, {
        beforeImage,
        afterImage,
        receiptPdf,
      });
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create incident.';
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText type="title" style={styles.title}>
            Report incident
          </ThemedText>

          {/* Severity */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>
            Severity <Text style={styles.required}>*</Text>
          </ThemedText>
          {isIOS ? (
            <Pressable
              style={[styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={showSeverityPicker}
            >
              <Text style={[styles.selectButtonText, { color: colors.text }]}>
                {SEVERITY_LABELS[severity]}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.typeRow}>
              {SEVERITY_LEVELS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.chip },
                    severity === s && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setSeverity(s)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: colors.text },
                      severity === s && { color: '#fff' },
                    ]}
                  >
                    {SEVERITY_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Date */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>
            Date <Text style={styles.required}>*</Text>
          </ThemedText>
          {isWeb ? (
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={incidentDate}
              onChangeText={setIncidentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              inputMode="numeric"
            />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={openDatePicker}
              >
                <Text style={[styles.selectButtonText, { color: colors.text }]}>{incidentDate}</Text>
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

          {/* Description */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>
            What happened? <Text style={styles.required}>*</Text>
          </ThemedText>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the incident"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
          />

          {/* Damage description */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>Damage details (optional)</ThemedText>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={damageDescription}
            onChangeText={setDamageDescription}
            placeholder="What was damaged?"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={2}
          />

          {/* Repair status */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>Repair status</ThemedText>
          {isIOS ? (
            <Pressable
              style={[styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={showRepairStatusPicker}
            >
              <Text style={[styles.selectButtonText, { color: colors.text }]}>
                {REPAIR_STATUS_LABELS[repairStatus]}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.typeRow}>
              {REPAIR_STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.chip },
                    repairStatus === s && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setRepairStatus(s)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: colors.text },
                      repairStatus === s && { color: '#fff' },
                    ]}
                  >
                    {REPAIR_STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Insurance claim */}
          <View style={styles.switchRow}>
            <ThemedText style={[styles.label, { color: colors.subtext, marginBottom: 0 }]}>Insurance claim</ThemedText>
            <Switch value={insuranceClaim} onValueChange={setInsuranceClaim} />
          </View>

          {/* Mileage */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>Mileage (optional)</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={mileage}
            onChangeText={setMileage}
            placeholder="km"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />

          {/* Repair cost */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>Repair cost (optional)</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={repairCost}
            onChangeText={setRepairCost}
            placeholder="e.g. 15000.00"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />

          {/* Repair vendor */}
          <ThemedText style={[styles.label, { color: colors.subtext }]}>Repair vendor (optional)</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={repairVendor}
            onChangeText={setRepairVendor}
            placeholder="Workshop name"
            placeholderTextColor={colors.placeholder}
          />

          <ThemedText style={[styles.label, { color: colors.subtext }]}>Attachments (optional)</ThemedText>
          <TouchableOpacity
            style={[styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => pickImage('before')}
          >
            <Text style={[styles.selectButtonText, { color: colors.text }]}>
              {beforeImage ? `Before image: ${beforeImage.name}` : 'Choose before image'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => pickImage('after')}
          >
            <Text style={[styles.selectButtonText, { color: colors.text }]}>
              {afterImage ? `After image: ${afterImage.name}` : 'Choose after image'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={pickReceiptPdf}
          >
            <Text style={[styles.selectButtonText, { color: colors.text }]}>
              {receiptPdf ? `Receipt PDF: ${receiptPdf.name}` : 'Choose repair receipt PDF'}
            </Text>
          </TouchableOpacity>
          {(beforeImage || afterImage || receiptPdf) && (
            <View style={styles.attachmentActions}>
              {beforeImage && (
                <TouchableOpacity onPress={() => setBeforeImage(null)}>
                  <Text style={[styles.attachmentActionText, { color: colors.primary }]}>Remove before image</Text>
                </TouchableOpacity>
              )}
              {afterImage && (
                <TouchableOpacity onPress={() => setAfterImage(null)}>
                  <Text style={[styles.attachmentActionText, { color: colors.primary }]}>Remove after image</Text>
                </TouchableOpacity>
              )}
              {receiptPdf && (
                <TouchableOpacity onPress={() => setReceiptPdf(null)}>
                  <Text style={[styles.attachmentActionText, { color: colors.primary }]}>Remove receipt PDF</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.success }, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Save incident</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
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
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  required: { color: '#FF3B30', fontWeight: '700' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  typeChipText: { fontSize: 15, fontWeight: '500' },
  selectButton: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  selectButtonText: { fontSize: 16 },
  iosPicker: { alignSelf: 'stretch' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2A2A35',
  },
  modalDone: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  modalDoneText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, marginBottom: 16 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  attachmentActions: { gap: 8, marginBottom: 16 },
  attachmentActionText: { fontSize: 14, fontWeight: '500' },
  submitBtn: { padding: 16, borderRadius: 999, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
