import { API_URL, ApiError, authHeaders } from './apiConfig';
import type { MaintenanceEvent, MaintenanceEventCreate, ScanReceiptResponse } from './types';

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

  /**
   * Upload a receipt / service-report image.
   * The backend stores the image in Supabase Storage, runs Claude Vision OCR,
   * and returns { receipt_image_url, extracted: { event_type, event_date, mileage, cost, vendor, notes } }.
   *
   * @param carId   - the car this receipt belongs to
   * @param token   - JWT auth token
   * @param imageUri - local file URI from expo-image-picker (e.g. file:///...)
   * @param mimeType - MIME type of the image (e.g. 'image/jpeg')
   */
  async scanReceipt(
    carId: string,
    token: string,
    imageUri: string,
    mimeType: string = 'image/jpeg',
  ): Promise<ScanReceiptResponse> {
    const formData = new FormData();
    // React Native FormData accepts { uri, name, type }
    formData.append('file', {
      uri: imageUri,
      name: `receipt.${mimeType.split('/')[1] ?? 'jpg'}`,
      type: mimeType,
    } as unknown as Blob);

    const res = await fetch(`${API_URL}/cars/${carId}/events/scan-receipt`, {
      method: 'POST',
      headers: authHeaders(token), // Content-Type is set automatically for FormData
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const err = await res.json().catch(() => ({}));
      const msg = typeof err.detail === 'string' ? err.detail : 'Failed to scan receipt';
      throw new Error(msg);
    }

    return res.json();
  },
};
