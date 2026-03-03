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

export interface OwnershipTwinRequest {
  action: 'delay' | 'do_now';
  event_type: string;
  delay_days?: number;
  monthly_km?: number;
}

export interface OwnershipTwinScore {
  overall_score: number;
  grade: string;
  confidence: number;
  confidence_label: string;
}

export interface OwnershipTwinCategoryDelta {
  category: string;
  before: number;
  after: number;
  delta: number;
}

export interface OwnershipTwinResponse {
  car_id: string;
  action: 'delay' | 'do_now';
  event_type: string;
  assumptions: string[];
  baseline: OwnershipTwinScore;
  projected: OwnershipTwinScore;
  category_deltas: OwnershipTwinCategoryDelta[];
  baseline_urgency: string | null;
  projected_urgency: string | null;
  score_delta: number;
  risk_change: 'improved' | 'worsened' | 'stable';
  explanation_source: 'llm' | 'rule_based';
  narrative: string;
  projected_recommendations: string[];
  computed_at: string;
  scoring_version: string;
  projected_as_of: string;
}
