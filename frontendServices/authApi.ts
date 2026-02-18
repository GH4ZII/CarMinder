import { API_URL, ApiError, parseErrorDetail } from './apiConfig';
import type { TokenResponse } from './types';

export const authApi = {
  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Login failed', res.status, detail);
    }
    return res.json();
  },

  async signup(email: string, password: string, name: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Signup failed', res.status, detail);
    }
    return res.json();
  },

  async google(idToken: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Google login failed', res.status, detail);
    }
    return res.json();
  },

  async forgotPassword(email: string): Promise<void> {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new ApiError('Password reset failed', res.status, detail);
    }
  },
};
