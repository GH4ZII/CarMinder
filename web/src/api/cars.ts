import type {
  AllCarsServiceStatus,
  CarCareScoreResponse,
  CarInfo,
  CarServiceStatus,
  CarUpdate,
  IncidentReport,
  IncidentReportCreate,
  KilometerUpdate,
  MaintenanceEvent,
  MaintenanceEventCreate,
  ObdReadingResponse,
  PublicCarHistory,
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
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    if (res.status === 400 && detail) {
      if (detail.includes('retired')) {
        throw new ApiError(
          'This vehicle has been permanently retired (damaged beyond repair) and cannot be registered again.',
          400,
          detail,
        );
      }
      if (detail.includes('already registered')) {
        throw new ApiError(
          'This car is already registered to another account. Ask the current owner to generate a transfer code so you can claim it.',
          400,
          detail,
        );
      }
      throw new ApiError(detail, 400, detail);
    }
    throw new ApiError('Failed to save car', res.status, detail);
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

export async function getIncidentTypes(): Promise<{
  severity_levels: string[];
  repair_statuses: string[];
}> {
  const res = await fetch(`${API_URL}/incidents/types`);
  if (!res.ok) {
    throw new Error('Failed to fetch incident types');
  }
  return res.json();
}

export async function getIncidents(
  carId: string,
  token: string
): Promise<IncidentReport[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/incidents`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError('Failed to fetch incidents', res.status, detail);
  }
  return res.json();
}

export async function createIncident(
  carId: string,
  token: string,
  payload: IncidentReportCreate
): Promise<IncidentReport> {
  const res = await fetch(`${API_URL}/cars/${carId}/incidents`, {
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
    throw new ApiError(msg || 'Failed to create incident', res.status, msg);
  }
  return res.json();
}

export async function uploadIncidentImages(
  carId: string,
  incidentId: string,
  token: string,
  files: File[]
): Promise<{ id: string; url?: string | null }[]> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }

  const res = await fetch(`${API_URL}/cars/${carId}/incidents/${incidentId}/images`, {
    method: 'POST',
    headers: { ...authHeaders(token) },
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError(detail ?? 'Failed to upload incident images', res.status, detail);
  }
  return res.json();
}

export async function listIncidentImages(
  carId: string,
  incidentId: string,
  token: string
): Promise<{ id: string; url?: string | null }[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/incidents/${incidentId}/images`, {
    headers: { ...authHeaders(token) },
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError(detail ?? 'Failed to list incident images', res.status, detail);
  }
  return res.json();
}

export async function getLatestObdReading(
  carId: string,
  token: string
): Promise<ObdReadingResponse | null> {
  const res = await fetch(`${API_URL}/cars/${carId}/obd-readings/latest`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    return null;
  }
  return res.json();
}

export async function getObdReadings(
  carId: string,
  token: string,
  limit = 50
): Promise<ObdReadingResponse[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/obd-readings?limit=${limit}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    throw new ApiError('Failed to fetch OBD readings', res.status);
  }
  return res.json();
}

export async function initiateTransfer(
  carId: string,
  token: string
): Promise<{ transfer_code: string; expires_at: string }> {
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
}

export async function cancelTransfer(carId: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${carId}/transfer`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError(detail ?? 'Failed to cancel transfer', res.status, detail);
  }
}

export async function claimCar(
  transferCode: string,
  token: string
): Promise<CarInfo> {
  const res = await fetch(`${API_URL}/cars/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ transfer_code: transferCode }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError(detail ?? 'Failed to claim car', res.status, detail);
  }
  return res.json();
}

export async function retireCar(carId: string, token: string): Promise<CarInfo> {
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
}

export async function getCarReportPdf(carId: string, token: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/cars/${carId}/report.pdf`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const detail = await parseErrorDetail(res);
    throw new ApiError(detail ?? 'Failed to generate car report PDF', res.status);
  }
  return res.blob();
}

export async function getPublicHistory(regNumber: string): Promise<PublicCarHistory | null> {
  const res = await fetch(
    `${API_URL}/public/history/${encodeURIComponent(regNumber.trim().toUpperCase())}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch public history');
  return res.json();
}
