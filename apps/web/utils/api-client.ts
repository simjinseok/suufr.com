import 'server-only';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;

// api 에 연결하지 못했을 때(네트워크·DNS·api 다운). status 0, code NETWORK_ERROR
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const NETWORK_ERROR_MESSAGE = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요';
// 응답은 왔지만 본문이 에러 형식이 아닐 때(프록시 5xx 등)
const UNEXPECTED_RESPONSE_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요';

export class ApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, options: { code?: string; status: number; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
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

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  catch (error) {
    // fetch 가 던지는 "fetch failed" 같은 원문은 사용자에게 보일 메시지가 아니다. 서버 액션은 error.message 를 그대로 화면에 쓴다
    throw new ApiError(NETWORK_ERROR_MESSAGE, { code: NETWORK_ERROR, status: 0, cause: error });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // NestJS 기본 형식({ message, error: 'CODE' })과
    // 커스텀 필터 형식({ error: { code, message } }) 모두 지원
    const code = typeof body?.error === 'string' ? body.error : body?.error?.code;
    const rawMessage = body?.error?.message ?? body?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    throw new ApiError(message || UNEXPECTED_RESPONSE_MESSAGE, {
      code,
      status: response.status,
    });
  }

  return response.json();
}
