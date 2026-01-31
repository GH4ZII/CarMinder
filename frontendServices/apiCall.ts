export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.129.48.163:8000';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Interface for the auth user
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Interface for the token response
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// Function to parse the error detail
async function parseErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const j = await res.json();
    return typeof j?.detail === 'string' ? j.detail : undefined;
  } catch {
    return undefined;
  }
}

// Interface for the car info
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

// Function to create the auth headers
function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

// Function to login with email and password
export const api = {
  async authLogin(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Login failed', res.status, detail);
    }
    return res.json();
  },

  // Function to sign up with email and password
  async authSignup(email: string, password: string, name: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Signup failed', res.status, detail);
    }
    return res.json();
  },

  // Function to sign in with Google
  async authGoogle(idToken: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Google login failed', res.status, detail);
    }
    return res.json();
  },

  // Function to lookup a vehicle
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

  // Function to save a car
  async saveCar(car: CarInfo, token: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(car),
    });
    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 401) {
        throw new ApiError('Unauthorized', 401);
      }
      if (res.status === 400 && errorText.includes('Car already registered to this user')) {
        throw new Error('This car is already saved to your profile.');
      }
      throw new Error(`Failed to save car: ${errorText}`);
    }
    return res.json();
  },

  // Function to get the user's cars
  async getUserCars(token: string): Promise<CarInfo[]> {
    if (!token?.length) {
      throw new Error('getUserCars called without token');
    }
    const res = await fetch(`${API_URL}/cars/`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch cars');
    }
    return res.json();
  },

  // Function to delete a car
  async deleteCar(carId: string, token: string): Promise<void> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to delete car');
    }
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
};
