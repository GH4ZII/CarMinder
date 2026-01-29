const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.229.16.70:8000';

export interface CarInfo {
  id?: string;
  firebase_user_id?: string;
  registreringsnummer: string;
  merke: string;
  modell: string;
  arsmodell: string;
  farge: string;
  kilometer: number;
  forstegangregistrert: string;
  chassisnummer: string;
  drivstoff: string;
  girkasse: string;
  motoreffekt: number;
  slagvolum: number;
  co2utslipp: number;
  forbruk: number;
  egenvekt: number;
  totalvekt: number;
  antallseter: number;
  antalldorer: number;
  karosseri: string;
  eukontrollfrist: string;
  makshastighet: number;
}

/** Server-defined; thin client fetches via getEventTypes(). */
export type MaintenanceEventType =
  | 'oil_change'
  | 'brake_service'
  | 'tire_change'
  | 'inspection'
  | 'repair'
  | 'other';

export interface MaintenanceEvent {
  id: string;
  car_id: string;
  event_type: string;
  event_date: string;
  mileage: number | null;
  cost_cents: number | null;
  vendor: string | null;
  notes: string | null;
  receipt_image_url: string | null;
  created_at: string;
}

/** Minimal create payload; server validates and normalizes. */
export interface MaintenanceEventCreate {
  event_type: string;
  event_date: string;
  mileage?: number | null;
  cost?: number | null;
  vendor?: string | null;
  notes?: string | null;
}

export const api = {
  async lookupVehicle(regNumber: string): Promise<CarInfo | null> {
    const res = await fetch(`${API_URL}/cars/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_number: regNumber }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.car : null;
  },

  async saveCar(car: CarInfo, userId: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'firebase-user-id': userId,
      },
      body: JSON.stringify(car),
    });
    if (!res.ok) {
      const errorText = await res.text();
      // Check for duplicate car error from backend
      if (res.status === 400 && errorText.includes('Car already registered to this user')) {
        throw new Error('This car is already saved to your profile.');
      }
      throw new Error(`Failed to save car: ${errorText}`);
    }
    return res.json();
  },

  async getUserCars(userId: string): Promise<CarInfo[]> {
    const res = await fetch(`${API_URL}/cars/`, {
      headers: { 'firebase-user-id': userId },
    });
    if (!res.ok) throw new Error('Failed to fetch cars');
    return res.json();
  },

  async deleteCar(carId: string, userId: string): Promise<void> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      method: 'DELETE',
      headers: { 'firebase-user-id': userId },
    });
    if (!res.ok) throw new Error('Failed to delete car');
  },

  async getCar(carId: string, userId: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      headers: { 'firebase-user-id': userId },
    });
    if (!res.ok) throw new Error('Failed to fetch car');
    return res.json();
  },

  async getEventTypes(): Promise<string[]> {
    const res = await fetch(`${API_URL}/maintenance/event-types`);
    if (!res.ok) throw new Error('Failed to fetch event types');
    const data = await res.json();
    return data.event_types ?? [];
  },

  async getMaintenanceEvents(carId: string, userId: string): Promise<MaintenanceEvent[]> {
    const res = await fetch(`${API_URL}/cars/${carId}/events`, {
      headers: { 'firebase-user-id': userId },
    });
    if (!res.ok) throw new Error('Failed to fetch maintenance events');
    return res.json();
  },

  async createMaintenanceEvent(
    carId: string,
    userId: string,
    payload: MaintenanceEventCreate
  ): Promise<MaintenanceEvent> {
    const res = await fetch(`${API_URL}/cars/${carId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'firebase-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = Array.isArray(err.detail)
        ? err.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join('; ') || res.statusText
        : (typeof err.detail === 'string' ? err.detail : res.statusText);
      throw new Error(msg || 'Failed to create maintenance event');
    }
    return res.json();
  },
};