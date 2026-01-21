import { cookies } from 'next/headers';
import type { OrganizationRole } from '@/prisma/generated/client';

export type Session = {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
  organization: {
    id: number;
    uuid: string;
    name: string;
    role: OrganizationRole;
  } | null;
  membership: {
    id: number;
    uuid: string;
    name: string;
    role: OrganizationRole;
    profileImageKey: string | null;
  } | null;
  organizations: Array<{
    id: number;
    uuid: string;
    name: string;
    role: OrganizationRole;
  }>;
};

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

    // 쿠키에서 선택된 organization id 읽기
    const savedOrgId = cookieStore.get('organization_id')?.value;
    let selectedOrg = savedOrgId
      ? organizations.find((org: { id: number }) => org.id === Number(savedOrgId))
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
            role: selectedOrg.role,
          }
        : null,
      membership: selectedOrg
        ? {
            id: selectedOrg.membershipId,
            uuid: selectedOrg.membershipUuid,
            name: selectedOrg.membershipName,
            role: selectedOrg.role,
            profileImageKey: selectedOrg.profileImageKey,
          }
        : null,
      organizations,
    };
  } catch {
    return null;
  }
}
