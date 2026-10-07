import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ConsentStatus } from '@/utils/api/auth';

export type Session = {
  user: {
    id: string;
    email?: string;
    name?: string;
    // better-auth 2단계 인증(TOTP) 사용 여부
    twoFactorEnabled?: boolean;
    // 이메일 인증 여부. false 면 앱 레이아웃이 인증 안내 배너를 띄운다 (api 배포 시차로 없으면 인증된 것으로 간주)
    emailVerified?: boolean;
  };
  organization: {
    id: number;
    uuid: string;
    name: string;
    profileName: string | null;
    profileImageUrl: string | null;
  } | null;
  organizations: Array<{
    id: number;
    uuid: string;
    name: string;
    profileName: string | null;
    profileImageUrl: string | null;
  }>;
  subscription: {
    plan: 'free' | 'pro';
    limits: {
      maxStudents: number | null;
      storageQuotaBytes: number;
    };
  };
  // 약관·개인정보 동의 이력(기록용). 화면 분기에는 쓰지 않는다
  consents: ConsentStatus;
};

// API가 subscription을 아직 내려주지 않을 때(배포 시차) 안전 폴백 — api plan.constants.ts 의 free 와 같은 값
const FREE_SUBSCRIPTION: Session['subscription'] = {
  plan: 'free',
  limits: { maxStudents: 5, storageQuotaBytes: 104857600 },
};

// API가 consents를 아직 내려주지 않을 때(배포 시차) 안전 폴백
const NO_CONSENT_INFO: ConsentStatus = { terms: null, privacy: null };

const API_URL = process.env.API_URL || 'http://localhost:5001';

/** api 에 닿지 못했거나 5xx 를 받은 경우. 세션이 없는 것과 구분해야 사용자를 조용히 로그인 화면으로 보내지 않는다 */
export type SessionResult = { ok: true; session: Session | null } | { ok: false };

/** 앱 레이아웃·페이지용. api 장애면 로그인 화면으로 보내되 사유(?error=unavailable)를 알린다. redirect 는 throw 라 try 밖에서 부른다 */
export async function getSession(): Promise<Session | null> {
  const result = await fetchSession();
  if (!result.ok) redirect('/login?error=unavailable');
  return result.session;
}

/** 세션 조회. 401/403·토큰 없음은 session: null, api 장애는 ok: false */
export async function fetchSession(): Promise<SessionResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return { ok: true, session: null };
  }

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: true, session: null };
    }
    if (!res.ok) {
      return { ok: false };
    }

    const data = await res.json();
    const organizations = data.organizations ?? [];

    // 쿠키에서 선택된 organization uuid 읽기
    const savedOrgUuid = cookieStore.get('organization_uuid')?.value;
    let selectedOrg = savedOrgUuid
      ? organizations.find((org: { uuid: string }) => org.uuid === savedOrgUuid)
      : null;

    // 없거나 찾을 수 없으면 첫 번째 organization 선택
    if (!selectedOrg && organizations.length > 0) {
      selectedOrg = organizations[0];
    }

    const session: Session = {
      user: data.user,
      organization: selectedOrg
        ? {
            id: selectedOrg.id,
            uuid: selectedOrg.uuid,
            name: selectedOrg.name,
            profileName: selectedOrg.profileName,
            profileImageUrl: selectedOrg.profileImageUrl,
          }
        : null,
      organizations,
      subscription: data.subscription ?? FREE_SUBSCRIPTION,
      consents: data.consents ?? NO_CONSENT_INFO,
    };
    return { ok: true, session };
  }
  catch {
    return { ok: false };
  }
}
