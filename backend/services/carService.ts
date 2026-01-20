import { supabase } from '../supabase';

export interface CarInfo {
  id?: string;
  firebase_user_id?: string;
  registreringsnummer: string;
  merke: string;
  modell: string;
  arsmodell: string;
  farge: string;
  kilometer: number;
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

export const carService = {
  // Save a new car
  async saveCar(car: CarInfo, firebaseUserId: string): Promise<{ data: CarInfo | null; error: Error | null }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabase
        .from('cars')
        .insert({
          firebase_user_id: firebaseUserId,
          registreringsnummer: car.registreringsnummer,
          merke: car.merke,
          modell: car.modell,
          arsmodell: car.arsmodell,
          farge: car.farge,
          kilometer: car.kilometer,
          forstegangregistrert: car.forstegangRegistrert,
          chassisnummer: car.chassisNummer,
          drivstoff: car.drivstoff,
          girkasse: car.girkasse,
          motoreffekt: car.motorEffekt,
          slagvolum: car.slagvolum,
          co2utslipp: car.co2Utslipp,
          forbruk: car.forbruk,
          egenvekt: car.egenvekt,
          totalvekt: car.totalvekt,
          antallseter: car.antallSeter,
          antalldorer: car.antallDorer,
          karosseri: car.karosseri,
          eukontrollfrist: car.euKontrollFrist,
          makshastighet: car.maksHastighet,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error saving car:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get all cars for a user
  async getUserCars(firebaseUserId: string): Promise<{ data: CarInfo[] | null; error: Error | null }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .eq('firebase_user_id', firebaseUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching cars:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get a single car by ID
  async getCarById(carId: string): Promise<{ data: CarInfo | null; error: Error | null }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .eq('id', carId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching car:', error);
      return { data: null, error: error as Error };
    }
  },

  // Update a car
  async updateCar(carId: string, updates: Partial<CarInfo>): Promise<{ data: CarInfo | null; error: Error | null }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabase
        .from('cars')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', carId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating car:', error);
      return { data: null, error: error as Error };
    }
  },

  // Delete a car
  async deleteCar(carId: string): Promise<{ error: Error | null }> {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') };
    }

    try {
      const { error } = await supabase
        .from('cars')
        .delete()
        .eq('id', carId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting car:', error);
      return { error: error as Error };
    }
  },

  // Update kilometer
  async updateKilometer(carId: string, kilometer: number): Promise<{ error: Error | null }> {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') };
    }

    try {
      const { error } = await supabase
        .from('cars')
        .update({ kilometer, updated_at: new Date().toISOString() })
        .eq('id', carId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error updating kilometer:', error);
      return { error: error as Error };
    }
  },
};