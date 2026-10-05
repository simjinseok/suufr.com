import 'server-only';
import { headers } from 'next/headers';
import type { ConsentPayload } from '@/utils/api/auth';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/constants/legal';

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-fA-F:.]{2,45}$/;

// 요청 헤더에서 클라이언트 IP 를 뽑는다. API 서버가 보는 IP 는 web 서버 IP 이므로 web 이 전달해야 실제 클라이언트 IP 가 된다.
// 형식이 이상하면 undefined — IP 때문에 가입이 실패하면 안 된다.
export function extractClientIp(requestHeaders: Headers): string | undefined {
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim();
  const candidate = forwarded || requestHeaders.get('x-real-ip')?.trim();
  if (!candidate) return undefined;
  return IPV4.test(candidate) || IPV6.test(candidate) ? candidate : undefined;
}

// 현재 요청의 IP·UA 를 포함한 동의 페이로드 (가입·재동의 공용). Zod 검증을 통과한 뒤에만 호출한다.
export async function buildConsentPayload(): Promise<ConsentPayload> {
  const requestHeaders = await headers();
  return {
    terms: true,
    privacy: true,
    overseasTransfer: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_POLICY_VERSION,
    ipAddress: extractClientIp(requestHeaders),
    userAgent: requestHeaders.get('user-agent')?.slice(0, 512) || undefined,
  };
}
