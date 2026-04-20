import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, CarInfo } from '../../frontendServices/apiCall';

export default function AddCarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [regNumber, SetRegNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);
  const { user, getToken, signOut } = useAuth();

  const colors = useMemo(() => ({
    bg: '#07142B',
    card: '#0A1A37',
    text: '#E9EEF7',
    subtext: '#8DA0B8',
    border: '#294263',
    inputBg: '#0A1A37',
    sectionBorder: '#294263',
    rowBorder: '#294263',
  }), [isDark]);

  const fetchCarInfo = async () => {
    if (!regNumber.trim()) {
      Alert.alert("Error", "Please enter the registration number!");
      return;
    }

    setLoading(true);
    try {
      // Now uses FastAPI backend instead of direct API call
      const car = await api.lookupVehicle(regNumber);
      
      if (!car) {
        Alert.alert("Error", "No car was found");
        return;
      }

      setCarInfo(car);


    } catch (error) {
      Alert.alert("Error", "Could not fetch the car info");
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const saveCar = async () => {
    if (!carInfo) return;

    if (!user) {
      Alert.alert("Error", "You must be logged in to save a car");
      return;
    }

    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Could not get auth token. Please sign in again.");
      return;
    }

    setSaving(true);
    try {
      await api.saveCar(carInfo, token);
      Alert.alert("Success", "Car saved successfully!");
      setCarInfo(null);
      SetRegNumber('');
      router.back();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await signOut();
        router.replace("/(auth)/login");
        return;
      }
      const msg =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to save car';
      Alert.alert("Cannot Register Car", msg);
    } finally {
      setSaving(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
    <View style={[styles.infoRow, { borderBottomColor: colors.rowBorder }]}>
      <Text style={[styles.label, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { borderBottomColor: colors.sectionBorder }]}>{title}</Text>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Add Your Car</ThemedText>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            placeholder="Enter registration number (e.g., AB12345)"
            placeholderTextColor={colors.subtext}
            value={regNumber}
            onChangeText={SetRegNumber}
            autoCapitalize="characters"
            maxLength={7}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={fetchCarInfo}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#062B32" />
            ) : (
              <Text style={styles.buttonText}>Fetch Car Info</Text>
            )}
          </TouchableOpacity>
        </View>

        {carInfo && (
          <View style={[styles.carInfoContainer, { backgroundColor: colors.card, shadowColor: isDark ? 'transparent' : '#000' }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>{carInfo.merke} {carInfo.modell}</Text>

            <SectionHeader title="Basic Information" />
            <InfoRow label="Registration" value={carInfo.registreringsnummer} />
            <InfoRow label="Brand" value={carInfo.merke} />
            <InfoRow label="Model" value={carInfo.modell} />
            <InfoRow label="First Registered" value={carInfo.forstegangregistrert} />
            <InfoRow label="Body Type" value={carInfo.karosseri} />
            <InfoRow label="Doors" value={carInfo.antalldorer} />
            <InfoRow label="Seats" value={carInfo.antallseter} />

            <SectionHeader title="Engine & Performance" />
            <InfoRow label="Fuel Type" value={carInfo.drivstoff} />
            <InfoRow label="Transmission" value={carInfo.girkasse} />
            <InfoRow label="Engine Power" value={`${carInfo.motoreffekt} kW`} />
            <InfoRow label="Engine Size" value={`${carInfo.slagvolum} cc`} />
            <InfoRow label="Max Speed" value={`${carInfo.makshastighet} km/h`} />

            <SectionHeader title="Environment" />
            <InfoRow label="CO₂ Emissions" value={`${carInfo.co2utslipp} g/km`} />
            <InfoRow label="Fuel Consumption" value={`${carInfo.forbruk} L/100km`} />

            <SectionHeader title="Weight" />
            <InfoRow label="Curb Weight" value={`${carInfo.egenvekt} kg`} />
            <InfoRow label="Max Weight" value={`${carInfo.totalvekt} kg`} />

            <SectionHeader title="Other" />
            <InfoRow label="Chassis Number" value={carInfo.chassisnummer} />
            <InfoRow label="EU Control Due" value={carInfo.eukontrollfrist} />

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={saveCar}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#062B32" />
              ) : (
                <Text style={styles.buttonText}>Save Car to your profile</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#2DD4BF',
    fontWeight: '600',
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    padding: 15,
    borderRadius: 14,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  button: {
    backgroundColor: '#2DD4BF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#062B32',
    fontSize: 16,
    fontWeight: '700',
  },
  carInfoContainer: {
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DDE6F2',
    marginTop: 15,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: '#294263',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#2DD4BF',
  },
});

