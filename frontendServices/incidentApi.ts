import { API_URL, ApiError, authHeaders } from './apiConfig';
import type { IncidentAttachmentUpload, IncidentReport, IncidentReportCreate } from './types';

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
    attachments?: {
      beforeImage?: IncidentAttachmentUpload | null;
      afterImage?: IncidentAttachmentUpload | null;
      receiptPdf?: IncidentAttachmentUpload | null;
    }
  ): Promise<IncidentReport> {
    const form = new FormData();
    appendIncidentFormField(form, 'incident_date', payload.incident_date);
    appendIncidentFormField(form, 'severity', payload.severity);
    appendIncidentFormField(form, 'description', payload.description);
    appendIncidentFormField(form, 'damage_description', payload.damage_description);
    appendIncidentFormField(form, 'repair_status', payload.repair_status);
    appendIncidentFormField(form, 'repair_cost', payload.repair_cost);
    appendIncidentFormField(form, 'repair_vendor', payload.repair_vendor);
    appendIncidentFormField(form, 'insurance_claim', payload.insurance_claim);
    appendIncidentFormField(form, 'mileage', payload.mileage);
    appendIncidentAttachment(form, 'before_image', attachments?.beforeImage);
    appendIncidentAttachment(form, 'after_image', attachments?.afterImage);
    appendIncidentAttachment(form, 'receipt_pdf', attachments?.receiptPdf);

    const res = await fetch(`${API_URL}/cars/${carId}/incidents`, {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
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

function appendIncidentFormField(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  form.append(key, String(value));
}

function appendIncidentAttachment(
  form: FormData,
  field: string,
  file?: IncidentAttachmentUpload | null
): void {
  if (!file?.uri) return;
  form.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.type ?? 'application/octet-stream',
  } as any);
}
