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

interface CarInfo {
  registreringsnummer: string;
  merke: string;
  modell: string;
  arsmodell: string;
  farge: string;
  kilometer: number;
  // New fields
  forstegangRegistrert: string;
  chassisNummer: string;
  drivstoff: string;
  girkasse: string;
  motorEffekt: number;
  slagvolum: number;
  co2Utslipp: number;
  forbruk: number;
  egenvekt: number;
  totalvekt: number;
  antallSeter: number;
  antallDorer: number;
  karosseri: string;
  euKontrollFrist: string;
  maksHastighet: number;
}

export default function AddCarScreen() {
  const [regNumber, SetRegNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);

  const fetchCarInfo = async () => {
    if (!regNumber.trim()) {
      Alert.alert("Error", "Please enter the registration number!");
      return;
    }

    setLoading(true);
    try {
      const apikey = process.env.EXPO_PUBLIC_API_KEY;

      if (!apikey) {
        Alert.alert("Error", "API key not configured");
        return;
      }
      const response = await fetch(
        `https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata?kjennemerke=${regNumber.toUpperCase()}`,
        {
          headers: {
            'SVV-Authorization': `Apikey ${apikey}`
          }
        }
      );

      if (!response.ok) {
        Alert.alert("Error", "No car was found");
        return;
      }

      const data = await response.json();
      const kjoretoyData = data.kjoretoydataListe?.[0];

      if (!kjoretoyData) {
        Alert.alert("Error", "No vehicle data found");
        return;
      }

      const tekniskData = kjoretoyData.godkjenning?.tekniskGodkjenning?.tekniskeData;
      const miljoData = tekniskData?.miljodata?.miljoOgdrivstoffGruppe?.[0];
      const motorData = tekniskData?.motorOgDrivverk;
      const vekter = tekniskData?.vekter;
      const karosseri = tekniskData?.karosseriOgLasteplan;

      const carData: CarInfo = {
        registreringsnummer: regNumber.toUpperCase(),
        merke: tekniskData?.generelt?.merke?.[0]?.merke || 'Unknown',
        modell: tekniskData?.generelt?.handelsbetegnelse?.[0] || 'Unknown',
        arsmodell: kjoretoyData.forstegangsregistrering?.registrertForstegangNorgeDato?.substring(0, 4) || 'Unknown',
        farge: karosseri?.rFarge?.[0]?.kodeBeskrivelse || 'Not specified',
        kilometer: 0,
        // New fields
        forstegangRegistrert: kjoretoyData.forstegangsregistrering?.registrertForstegangNorgeDato || 'Unknown',
        chassisNummer: kjoretoyData.kjoretoyId?.understellsnummer || 'Unknown',
        drivstoff: miljoData?.drivstoffKodeMiljodata?.kodeNavn || 'Unknown',
        girkasse: motorData?.girkassetype?.kodeNavn || 'Unknown',
        motorEffekt: motorData?.motor?.[0]?.drivstoff?.[0]?.maksNettoEffekt || 0,
        slagvolum: motorData?.motor?.[0]?.slagvolum || 0,
        co2Utslipp: miljoData?.forbrukOgUtslipp?.[0]?.co2BlandetKjoring || 0,
        forbruk: miljoData?.forbrukOgUtslipp?.[0]?.forbrukBlandetKjoring || 0,
        egenvekt: vekter?.egenvekt || 0,
        totalvekt: vekter?.tillattTotalvekt || 0,
        antallSeter: tekniskData?.persontall?.sitteplasserTotalt || 0,
        antallDorer: karosseri?.antallDorer?.[0] || 0,
        karosseri: karosseri?.karosseritype?.kodeNavn || 'Unknown',
        euKontrollFrist: kjoretoyData.periodiskKjoretoyKontroll?.kontrollfrist || 'Unknown',
        maksHastighet: motorData?.maksimumHastighet?.[0] || 0,
      };

      setCarInfo(carData);
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

    try {
      console.log("Saving car:", carInfo);
      Alert.alert("Success", "Car saved successfully!");
      setCarInfo(null);
      SetRegNumber('');
    } catch (error) {
      Alert.alert("Error", "Failed to save car");
      console.error(error);
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
            <InfoRow label="First Registered" value={carInfo.forstegangRegistrert} />
            <InfoRow label="Body Type" value={carInfo.karosseri} />
            <InfoRow label="Doors" value={carInfo.antallDorer} />
            <InfoRow label="Seats" value={carInfo.antallSeter} />

            <SectionHeader title="Engine & Performance" />
            <InfoRow label="Fuel Type" value={carInfo.drivstoff} />
            <InfoRow label="Transmission" value={carInfo.girkasse} />
            <InfoRow label="Engine Power" value={`${carInfo.motorEffekt} kW`} />
            <InfoRow label="Engine Size" value={`${carInfo.slagvolum} cc`} />
            <InfoRow label="Max Speed" value={`${carInfo.maksHastighet} km/h`} />

            <SectionHeader title="Environment" />
            <InfoRow label="CO₂ Emissions" value={`${carInfo.co2Utslipp} g/km`} />
            <InfoRow label="Fuel Consumption" value={`${carInfo.forbruk} L/100km`} />

            <SectionHeader title="Weight" />
            <InfoRow label="Curb Weight" value={`${carInfo.egenvekt} kg`} />
            <InfoRow label="Max Weight" value={`${carInfo.totalvekt} kg`} />

            <SectionHeader title="Other" />
            <InfoRow label="Chassis Number" value={carInfo.chassisNummer} />
            <InfoRow label="EU Control Due" value={carInfo.euKontrollFrist} />

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={saveCar}
            >
              <Text style={styles.buttonText}>Save Car</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 40,
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

