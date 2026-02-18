import { API_URL } from './apiConfig';
import type { PublicCarHistory } from './types';

export const publicApi = {
  async getPublicHistory(regNumber: string): Promise<PublicCarHistory | null> {
    const res = await fetch(
      `${API_URL}/public/history/${encodeURIComponent(regNumber.trim().toUpperCase())}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch public history');
    return res.json();
  },
};
