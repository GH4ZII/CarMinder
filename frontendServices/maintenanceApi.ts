import { API_URL, ApiError, authHeaders } from './apiConfig';
import type { MaintenanceEvent, MaintenanceEventCreate } from './types';

export const maintenanceApi = {
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
      throw new Error('Failed to fetch maintenance events');
    }
    return res.json();
  },

  async createMaintenanceEvent(
    carId: string,
    token: string,
    payload: MaintenanceEventCreate,
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
};
