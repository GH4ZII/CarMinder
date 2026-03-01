import type {
  AllCarsServiceStatus,
  CarCareScoreResponse,
  CarInfo,
  CarServiceStatus,
  CarUpdate,
  KilometerUpdate,
  MaintenanceEvent,
  MaintenanceEventCreate,
} from '@/types/car';
import { API_URL, ApiError, authHeaders, parseErrorDetail } from './client';

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
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(car),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    if (res.status === 400 && errorText.includes('Car already registered to this user')) {
      throw new Error('This car is already saved to your profile.');
    }
    throw new Error(`Failed to save car: ${errorText}`);
  }
  return res.json();
}

export async function getUserCars(token: string): Promise<CarInfo[]> {
  const res = await fetch(`${API_URL}/cars/`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    throw new Error('Failed to fetch cars');
  }
  return res.json();
}

export async function getCar(carId: string, token: string): Promise<CarInfo> {
  const res = await fetch(`${API_URL}/cars/${carId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    throw new Error('Failed to fetch car');
  }
  return res.json();
}

export async function deleteCar(carId: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${carId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    throw new Error('Failed to delete car');
  }
}

export async function updateCar(
  carId: string,
  token: string,
  updates: CarUpdate
): Promise<CarInfo> {
  const res = await fetch(`${API_URL}/cars/${carId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError('Failed to update car', res.status, detail);
  }
  return res.json();
}

export async function updateKilometer(
  carId: string,
  token: string,
  data: KilometerUpdate
): Promise<CarInfo> {
  const res = await fetch(`${API_URL}/cars/${carId}/kilometer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError('Failed to update mileage', res.status, detail);
  }
  return res.json();
}

export async function getEventTypes(): Promise<string[]> {
  const res = await fetch(`${API_URL}/maintenance/event-types`);
  if (!res.ok) throw new Error('Failed to fetch event types');
  const data = await res.json();
  return data.event_types ?? [];
}

export async function getMaintenanceEvents(
  carId: string,
  token: string
): Promise<MaintenanceEvent[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/events`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    throw new Error('Failed to fetch maintenance events');
  }
  return res.json();
}

export async function createMaintenanceEvent(
  carId: string,
  token: string,
  payload: MaintenanceEventCreate
): Promise<MaintenanceEvent> {
  const res = await fetch(`${API_URL}/cars/${carId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err.detail)
      ? err.detail
          .map((e: { msg?: string }) => e.msg)
          .filter(Boolean)
          .join('; ') || res.statusText
      : typeof err.detail === 'string'
        ? err.detail
        : res.statusText;
    throw new Error(msg || 'Failed to create maintenance event');
  }
  return res.json();
}

export async function getCarServiceStatus(
  carId: string,
  token: string
): Promise<CarServiceStatus> {
  const res = await fetch(`${API_URL}/cars/${carId}/service-status`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError('Failed to fetch service status', res.status, detail);
  }
  return res.json();
}

export async function getAllServiceStatus(token: string): Promise<AllCarsServiceStatus> {
  const res = await fetch(`${API_URL}/service-status`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError('Failed to fetch service status', res.status, detail);
  }
  return res.json();
}

export async function getCarCareScore(
  carId: string,
  token: string
): Promise<CarCareScoreResponse> {
  const res = await fetch(`${API_URL}/cars/${carId}/score`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError('Failed to fetch car care score', res.status, detail);
  }
  return res.json();
}
