// Auth types
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// Vehicle types
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
}

// Maintenance types
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

// Service status types
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

// Incident types
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
  before_image_url: string | null;
  after_image_url: string | null;
  receipt_pdf_url: string | null;
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

export interface IncidentAttachmentUpload {
  uri: string;
  name: string;
  type?: string | null;
}

// Public history types
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
  before_image_url: string | null;
  after_image_url: string | null;
  receipt_pdf_url: string | null;
}

export interface PublicCarHistory {
  car: PublicCarInfo;
  maintenance_events: PublicMaintenanceEvent[];
  incident_reports: PublicIncidentReport[];
}
