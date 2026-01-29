import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { api, ApiError, CarInfo } from '../../frontendServices/apiCall';

export default function AddCarScreen() {
  const router = useRouter();
  const [regNumber, SetRegNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);
  const { user, getToken, signOut } = useAuth();

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
      Alert.alert("Success", "Car information fetched!");

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
      Alert.alert("Error", "Failed to save car");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Add Your Car</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter registration number (e.g., AB12345)"
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
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Fetch Car Info</Text>
            )}
          </TouchableOpacity>
        </View>

        {carInfo && (
          <View style={styles.carInfoContainer}>
            <Text style={styles.infoTitle}>🚗 {carInfo.merke} {carInfo.modell}</Text>

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
                <ActivityIndicator color="#fff" />
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
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  carInfoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginTop: 15,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#34C759',
  },
});

