import { API_URL, ApiError, parseErrorDetail, authHeaders } from './client';

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

export async function lookupVehicle(regNumber: string): Promise<CarInfo | null> {
  const res = await fetch(`${API_URL}/cars/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registration_number: regNumber }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? data.car : null;
}

export async function saveCar(car: CarInfo, token: string): Promise<CarInfo> {
  const res = await fetch(`${API_URL}/cars/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(car),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    throw new Error(text || 'Failed to save car');
  }
  return res.json();
}

export async function getUserCars(token: string): Promise<CarInfo[]> {
  const res = await fetch(`${API_URL}/cars/`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    if (res.status === 401) throw new ApiError('Unauthorized', 401, detail);
    throw new Error(detail || 'Failed to fetch cars');
  }
  return res.json();
}
