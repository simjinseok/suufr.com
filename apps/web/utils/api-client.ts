import 'server-only';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | string[] | number[] | undefined>;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  let url = `${API_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          searchParams.set(key, value.join(','));
        }
        else {
          searchParams.set(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const error = await response.json().catch((e) => e);
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}
