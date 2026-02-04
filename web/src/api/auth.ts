import type { TokenResponse } from '@/types/auth';
import { API_URL, ApiError, parseErrorDetail } from './client';

export async function authLogin(email: string, password: string): Promise<TokenResponse> {
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
}

export async function authSignup(
  email: string,
  password: string,
  name: string
): Promise<TokenResponse> {
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
}

export async function authGoogle(idToken: string): Promise<TokenResponse> {
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
}
