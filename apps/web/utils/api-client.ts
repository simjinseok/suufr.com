import 'server-only';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;

export class ApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, options: { code?: string; status: number }) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | string[] | number[] | undefined>;
  // 세션이 필요한 요청(2단계 인증 관리 등)에 refresh_token 쿠키(= better-auth 세션 토큰)를 X-Session-Token 으로 함께 보낸다
  withSessionToken?: boolean;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, withSessionToken = false } = options;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const sessionToken = withSessionToken ? cookieStore.get('refresh_token')?.value : undefined;

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
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // NestJS 기본 형식({ message, error: 'CODE' })과
    // 커스텀 필터 형식({ error: { code, message } }) 모두 지원
    const code = typeof body?.error === 'string' ? body.error : body?.error?.code;
    const rawMessage = body?.error?.message ?? body?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    throw new ApiError(message || `API Error: ${response.status}`, {
      code,
      status: response.status,
    });
  }

  return response.json();
}
