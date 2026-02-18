export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carminder-production.up.railway.app';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const j = await res.json();
    return typeof j?.detail === 'string' ? j.detail : undefined;
  } catch {
    return undefined;
  }
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}
