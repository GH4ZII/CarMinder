import { API_URL, ApiError, authHeaders } from './apiConfig';
import type { AllCarsServiceStatus, CarServiceStatus } from './types';

export const serviceStatusApi = {
  async getCarServiceStatus(carId: string, token: string): Promise<CarServiceStatus> {
    const res = await fetch(`${API_URL}/cars/${carId}/service-status`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch service status');
    }
    return res.json();
  },

  async getAllServiceStatus(token: string): Promise<AllCarsServiceStatus> {
    const res = await fetch(`${API_URL}/service-status`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to fetch service status');
    }
    return res.json();
  },
};
