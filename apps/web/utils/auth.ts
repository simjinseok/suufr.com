import { cookies } from 'next/headers';
import type { ConsentStatus } from '@/utils/api/auth';

export type Session = {
  user: {
    id: string;
    email?: string;
    name?: string;
    // better-auth 2단계 인증(TOTP) 사용 여부
    twoFactorEnabled?: boolean;
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
  // 약관·개인정보 동의 상태. required = 현재 문서 버전에 대한 동의가 없음 → 재동의 모달
  consents: ConsentStatus;
};

// API가 subscription을 아직 내려주지 않을 때(배포 시차) 안전 폴백
// TODO(billing): 결제 오픈 전 임시 완화 — api의 plan.constants.ts(free.maxStudents)와 함께 5로 복원할 것
const FREE_SUBSCRIPTION: Session['subscription'] = {
  plan: 'free',
  limits: { maxStudents: 1000, storageQuotaBytes: 104857600 },
};

// API가 consents를 아직 내려주지 않을 때(배포 시차) 안전 폴백 — 재동의를 강제하지 않는다
const NO_CONSENT_INFO: ConsentStatus = { terms: null, privacy: null, overseasTransfer: null, required: false };

const API_URL = process.env.API_URL || 'http://localhost:5001';

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
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

    return {
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
  }
  catch {
    return null;
  }
}
