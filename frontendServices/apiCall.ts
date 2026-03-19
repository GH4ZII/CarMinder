export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carminder-production.up.railway.app';

console.log('🌐 API_URL initialized:', API_URL);
console.log('🌐 EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);

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
  public_history?: boolean;
  retired_at?: string | null;
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

/** Service due status computed by backend */
export interface ServiceDueStatus {
  event_type: string;
  last_date: string | null;
  last_mileage: number | null;
  due_date: string | null;
  due_mileage: number | null;
  is_overdue: boolean;
  days_until_due: number | null;
  km_until_due: number | null;
  urgency: 'ok' | 'soon' | 'overdue' | 'unknown';
}

/** Service status for a single car */
export interface CarServiceStatus {
  car_id: string;
  car_name: string;
  registration: string;
  current_mileage: number;
  services: ServiceDueStatus[];
  next_service: ServiceDueStatus | null;
}

/** Overview of all cars' service status */
export interface AllCarsServiceStatus {
  cars: CarServiceStatus[];
  urgent_count: number;
  overdue_count: number;
  soon_count: number;
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

  async authApple(payload: { identity_token: string; email?: string | null; full_name?: string | null }): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Apple login failed', res.status, detail);
    }
    return res.json();
  },

  // Function to trigger password reset email
  async authForgotPassword(email: string): Promise<void> {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Password reset failed', res.status, detail);
    }
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
      if (res.status === 400 && errorText.includes('already registered')) {
        throw new Error('This car is already registered to another account. Ask the current owner to transfer it to you.');
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
    console.log('🔍 Fetching cars from:', `${API_URL}/cars/`);
    console.log('🔍 Token available:', !!token, 'length:', token?.length);
    
    try {
      const res = await fetch(`${API_URL}/cars/`, {
        headers: authHeaders(token),
      });
      
      console.log('📡 Response status:', res.status);
      console.log('📡 Response ok:', res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error response:', errorText);
        
        if (res.status === 401) throw new ApiError('Unauthorized', 401);
        throw new Error(`Failed to fetch cars: ${res.status} ${errorText}`);
      }
      
      const data = await res.json();
      console.log('✅ Cars fetched successfully:', data.length, 'cars');
      return data;
    } catch (error) {
      console.error('💥 Fetch error:', error);
      throw error;
    }
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

  async getCar(carId: string, token: string): Promise<CarInfo> {
    console.log('🚗 Fetching car:', carId);
    try {
      const res = await fetch(`${API_URL}/cars/${carId}`, {
        headers: authHeaders(token),
      });
      console.log('📡 getCar response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ getCar error:', errorText);
        if (res.status === 401) throw new ApiError('Unauthorized', 401);
        throw new Error(`Failed to fetch car: ${res.status} ${errorText}`);
      }
      
      const data = await res.json();
      console.log('✅ Car fetched:', data);
      return data;
    } catch (error) {
      console.error('💥 getCar error:', error);
      throw error;
    }
  },

  async getEventTypes(): Promise<string[]> {
    const res = await fetch(`${API_URL}/maintenance/event-types`);
    if (!res.ok) throw new Error('Failed to fetch event types');
    const data = await res.json();
    return data.event_types ?? [];
  },

  async getMaintenanceEvents(carId: string, token: string): Promise<MaintenanceEvent[]> {
    const res = await fetch(`${API_URL}/cars/${carId}/events`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res);
      throw new ApiError(
        detail ?? 'Failed to fetch maintenance events',
        res.status,
        detail,
      );
    }
    return res.json();
  },

  async createMaintenanceEvent(
    carId: string,
    token: string,
    payload: MaintenanceEventCreate
  ): Promise<MaintenanceEvent> {
    const res = await fetch(`${API_URL}/cars/${carId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const err = await res.json().catch(() => ({}));
      const msg = Array.isArray(err.detail)
        ? err.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join('; ') || res.statusText
        : (typeof err.detail === 'string' ? err.detail : res.statusText);
      throw new Error(msg || 'Failed to create maintenance event');
    }
    return res.json();
  },

  /** Get service status for a specific car */
  async getCarServiceStatus(carId: string, token: string): Promise<CarServiceStatus> {
    const res = await fetch(`${API_URL}/cars/${carId}/service-status`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch service status');
    }
    return res.json();
  },

  /** Get service status overview for all user's cars */
  async getAllServiceStatus(token: string): Promise<AllCarsServiceStatus> {
    const res = await fetch(`${API_URL}/service-status`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch service status');
    }
    return res.json();
  },

  /** Update a car (e.g. toggle public_history) */
  async updateCar(carId: string, token: string, updates: Partial<CarInfo>): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to update car');
    }
    return res.json();
  },

  /** Get incident type metadata */
  async getIncidentTypes(): Promise<{ severity_levels: string[]; repair_statuses: string[] }> {
    const res = await fetch(`${API_URL}/incidents/types`);
    if (!res.ok) throw new Error('Failed to fetch incident types');
    return res.json();
  },

  /** List incidents for a car */
  async getIncidents(carId: string, token: string): Promise<IncidentReport[]> {
    const res = await fetch(`${API_URL}/cars/${carId}/incidents`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch incidents');
    }
    return res.json();
  },

  /** Create an incident report */
  async createIncident(carId: string, token: string, payload: IncidentReportCreate): Promise<IncidentReport> {
    const res = await fetch(`${API_URL}/cars/${carId}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const err = await res.json().catch(() => ({}));
      const msg = Array.isArray(err.detail)
        ? err.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join('; ') || res.statusText
        : (typeof err.detail === 'string' ? err.detail : res.statusText);
      throw new Error(msg || 'Failed to create incident');
    }
    return res.json();
  },

  /** Lookup public car history by registration number (no auth) */
  async getPublicHistory(regNumber: string): Promise<PublicCarHistory | null> {
    const res = await fetch(`${API_URL}/public/history/${encodeURIComponent(regNumber.trim().toUpperCase())}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch public history');
    return res.json();
  },

  /** Get car care score for a specific car */
  async getCarCareScore(carId: string, token: string): Promise<CarCareScoreResponse> {
    const res = await fetch(`${API_URL}/cars/${carId}/score`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch car care score');
    }
    return res.json();
  },

  /** Upload an OBD reading to the backend */
  async uploadObdReading(carId: string, token: string, payload: ObdReadingCreate): Promise<ObdReadingResponse> {
    const res = await fetch(`${API_URL}/cars/${carId}/obd-readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res);
      throw new ApiError(detail ?? 'Failed to upload OBD reading', res.status, detail);
    }
    return res.json();
  },

  /** Get the latest OBD reading for a car */
  async getLatestObdReading(carId: string, token: string): Promise<ObdReadingResponse | null> {
    const res = await fetch(`${API_URL}/cars/${carId}/obd-readings/latest`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      return null;
    }
    return res.json();
  },

  /** Initiate a car transfer — returns a transfer code the buyer uses to claim */
  async initiateTransfer(carId: string, token: string): Promise<{ transfer_code: string; expires_at: string }> {
    const res = await fetch(`${API_URL}/cars/${carId}/transfer`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res);
      throw new ApiError(detail ?? 'Failed to initiate transfer', res.status, detail);
    }
    return res.json();
  },

  /** Cancel a pending transfer */
  async cancelTransfer(carId: string, token: string): Promise<void> {
    const res = await fetch(`${API_URL}/cars/${carId}/transfer`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res);
      throw new ApiError(detail ?? 'Failed to cancel transfer', res.status, detail);
    }
  },

  /** Claim a car using a transfer code */
  async claimCar(transferCode: string, token: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ transfer_code: transferCode }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res);
      throw new ApiError(detail ?? 'Failed to claim car', res.status, detail);
    }
    return res.json();
  },

  /** Retire a car (damaged beyond repair — permanently blocks re-registration) */
  async retireCar(carId: string, token: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/${carId}/retire`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res);
      throw new ApiError(detail ?? 'Failed to retire car', res.status, detail);
    }
    return res.json();
  },

  /** Get car report PDF as ArrayBuffer (throws ApiError on non-2xx). Use ArrayBuffer so React Native can write bytes without Blob.arrayBuffer(). */
  async getCarReportPdf(carId: string, token: string): Promise<ArrayBuffer> {
    const res = await fetch(`${API_URL}/cars/${carId}/report.pdf`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const detail = await parseErrorDetail(res).catch(() => undefined);
      throw new ApiError(detail ?? 'Failed to generate PDF', res.status, detail);
    }
    return res.arrayBuffer();
  },
};

/** Convert an ObdSnapshot (from obdService) into the flat backend payload */
export function snapshotToObdPayload(snapshot: import('./obdService').ObdSnapshot): ObdReadingCreate {
  return {
    captured_at: snapshot.capturedAt,
    source: snapshot.source,
    rpm: snapshot.metrics.rpm,
    coolant_temp_c: snapshot.metrics.coolantTempC,
    speed_kph: snapshot.metrics.speedKph,
    engine_load_pct: snapshot.metrics.engineLoadPct,
    battery_voltage: snapshot.metrics.batteryVoltage,
    dtcs: snapshot.dtcs,
  };
}

// Car care score interfaces
export interface CategoryScore {
  score: number;
  weight: number;
  label: string;
}

export interface CategoryBreakdown {
  maintenance_regularity: CategoryScore;
  eu_inspection: CategoryScore;
  incident_history: CategoryScore;
  mileage_tracking: CategoryScore;
  documentation_quality: CategoryScore;
}

export interface CarCareScoreResponse {
  car_id: string;
  overall_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;
  confidence_label: 'very_low' | 'low' | 'moderate' | 'high';
  summary: string;
  categories: CategoryBreakdown;
  recommendations: string[];
  computed_at: string;
}

// Incident report interfaces
export interface IncidentReport {
  id: string;
  car_id: string;
  incident_date: string;
  severity: string;
  description: string;
  damage_description: string | null;
  repair_status: string;
  repair_cost_cents: number | null;
  repair_vendor: string | null;
  insurance_claim: boolean;
  mileage: number | null;
  created_at: string;
}

export interface IncidentReportCreate {
  incident_date: string;
  severity: string;
  description: string;
  damage_description?: string | null;
  repair_status: string;
  repair_cost?: number | null;
  repair_vendor?: string | null;
  insurance_claim: boolean;
  mileage?: number | null;
}

// Public history interfaces
export interface PublicCarInfo {
  registreringsnummer: string;
  merke: string;
  modell: string;
  arsmodell: string;
  farge: string;
  kilometer: number;
}

export interface PublicMaintenanceEvent {
  event_type: string;
  event_date: string;
  mileage: number | null;
  vendor: string | null;
}

export interface PublicIncidentReport {
  incident_date: string;
  severity: string;
  description: string;
  damage_description: string | null;
  repair_status: string;
  mileage: number | null;
}

export interface PublicCarHistory {
  car: PublicCarInfo;
  maintenance_events: PublicMaintenanceEvent[];
  incident_reports: PublicIncidentReport[];
}

// OBD reading interfaces
export interface ObdReadingResponse {
  id: string;
  car_id: string;
  captured_at: string;
  source: 'device' | 'simulated';
  rpm: number | null;
  coolant_temp_c: number | null;
  speed_kph: number | null;
  engine_load_pct: number | null;
  battery_voltage: number | null;
  dtcs: { code: string; description: string }[];
  created_at: string;
}

export interface ObdReadingCreate {
  captured_at: string;
  source: 'device' | 'simulated';
  rpm: number | null;
  coolant_temp_c: number | null;
  speed_kph: number | null;
  engine_load_pct: number | null;
  battery_voltage: number | null;
  dtcs: { code: string; description: string }[];
}

