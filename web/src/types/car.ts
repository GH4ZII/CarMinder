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
  created_at?: string;
  updated_at?: string;
}

export interface CarUpdate {
  kilometer?: number;
  farge?: string;
  eukontrollfrist?: string;
  public_history?: boolean;
}

export interface KilometerUpdate {
  kilometer: number;
}

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

export interface MaintenanceEventCreate {
  event_type: string;
  event_date: string;
  mileage?: number | null;
  cost?: number | null;
  vendor?: string | null;
  notes?: string | null;
}

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

export interface CarServiceStatus {
  car_id: string;
  car_name: string;
  registration: string;
  current_mileage: number;
  services: ServiceDueStatus[];
  next_service: ServiceDueStatus | null;
}

export interface AllCarsServiceStatus {
  cars: CarServiceStatus[];
  urgent_count: number;
  overdue_count: number;
  soon_count: number;
}

// ── Car Care Score ──────────────────────────────────────────

export interface CategoryScore {
  score: number; // 0-100
  weight: number; // weight in overall score (sums to 100)
  label: string; // human-readable name
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
  overall_score: number; // 0-100
  grade: string; // A, B, C, D, F
  confidence: number; // 0.0-1.0
  confidence_label: string; // "very_low" | "low" | "moderate" | "high"
  summary: string;
  categories: CategoryBreakdown;
  recommendations: string[];
  computed_at: string;
  scoring_version: string;
  scored_as_of: string | null;
}

// ── OBD Readings ────────────────────────────────────────────

export interface ObdDiagnosticCode {
  code: string;
  description: string;
}

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
  dtcs: ObdDiagnosticCode[];
  created_at: string;
}

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
