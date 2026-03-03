import { API_URL, ApiError, authHeaders } from './apiConfig';
import type { CarInfo, OwnershipTwinRequest, OwnershipTwinResponse } from './types';

export const carApi = {
  async lookupVehicle(regNumber: string): Promise<CarInfo | null> {
    const res = await fetch(`${API_URL}/cars/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_number: regNumber }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.car : null;
  },

  async saveCar(car: CarInfo, token: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
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
  },

  async getUserCars(token: string): Promise<CarInfo[]> {
    if (!token?.length) throw new Error('getUserCars called without token');
    const res = await fetch(`${API_URL}/cars/`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error(`Failed to fetch cars: ${res.status} ${errorText}`);
    }
    return res.json();
  },

  async deleteCar(carId: string, token: string): Promise<void> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to delete car');
    }
  },

  async getCar(carId: string, token: string): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error(`Failed to fetch car: ${res.status} ${errorText}`);
    }
    return res.json();
  },

  async updateCar(carId: string, token: string, updates: Partial<CarInfo>): Promise<CarInfo> {
    const res = await fetch(`${API_URL}/cars/${carId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      throw new Error('Failed to update car');
    }
    return res.json();
  },

  async getOwnershipTwin(
    carId: string,
    token: string,
    payload: OwnershipTwinRequest
  ): Promise<OwnershipTwinResponse> {
    const res = await fetch(`${API_URL}/cars/${carId}/ownership-twin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 401) throw new ApiError('Unauthorized', 401);
      const errorText = await res.text();
      throw new Error(`Failed to simulate ownership twin: ${res.status} ${errorText}`);
    }
    return res.json();
  },
};
