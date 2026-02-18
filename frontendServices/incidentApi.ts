import { API_URL, ApiError, authHeaders } from './apiConfig';
import type { IncidentReport, IncidentReportCreate } from './types';

export const incidentApi = {
  async getIncidentTypes(): Promise<{ severity_levels: string[]; repair_statuses: string[] }> {
    const res = await fetch(`${API_URL}/incidents/types`);
    if (!res.ok) throw new Error('Failed to fetch incident types');
    return res.json();
  },

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

  async createIncident(
    carId: string,
    token: string,
    payload: IncidentReportCreate,
  ): Promise<IncidentReport> {
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
};
