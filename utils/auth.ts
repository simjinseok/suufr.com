import { cookies } from 'next/headers';
import prisma from '@/utils/prisma';
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
  };
  organizations: Array<{
    id: number;
    uuid: string;
    name: string;
    role: OrganizationRole;
  }>;
};

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return null;
  }

  // JWT payload 디코딩 (header.payload.signature 중 payload 부분)
  const payload = JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64').toString(),
  );

  const userId = payload.sub;

  // OrganizationMember 조회 (userId로 직접)
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    include: {
      organization: true,
    },
  });

  // 멤버십이 없으면 아직 프로비저닝 전 (로그인 성공 직후)
  if (memberships.length === 0) {
    return {
      user: {
        id: userId,
        email: payload.email,
        name: payload.name,
      },
      organization: null as unknown as Session['organization'],
      organizations: [],
    };
  }

  // UserSettings 조회
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  // 멤버십 목록을 organization 정보로 변환
  const organizations = memberships.map(membership => ({
    id: membership.organization.id,
    uuid: membership.organization.uuid,
    name: membership.organization.name,
    role: membership.role,
  }));

  // 현재 조직 결정 (settings.currentOrganizationId 또는 첫 번째 멤버십)
  let currentOrg = organizations[0];
  if (settings?.currentOrganizationId) {
    const found = organizations.find(
      org => org.id === settings.currentOrganizationId,
    );
    if (found) {
      currentOrg = found;
    }
  }

  // 현재 멤버십에서 사용자 이름 가져오기
  const currentMembership = memberships.find(
    m => m.organization.id === currentOrg.id,
  );

  return {
    user: {
      id: userId,
      email: payload.email,
      name: currentMembership?.name ?? payload.name,
    },
    organization: currentOrg,
    organizations,
  };
}
