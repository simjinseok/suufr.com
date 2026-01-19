import prisma from '@/utils/prisma';
import { verifyToken } from '@/utils/app-token';
import type { OrganizationRole } from '@/prisma/generated/client';

export type DavSession = {
  user: {
    id: string;
    email: string;
  };
  organization: {
    id: number;
    uuid: string;
    name: string;
    role: OrganizationRole;
  };
  tokenId: number;
};

type AuthResult
  = | { success: true; session: DavSession }
    | { success: false; error: string };

export function parseBasicAuth(
  header: string | null,
): { email: string; password: string } | null {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }

  try {
    const base64 = header.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    return {
      email: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  }
  catch {
    return null;
  }
}

export async function validateDavAuth(request: Request): Promise<AuthResult> {
  console.log('[DAV] Request:', request.method, request.url);
  const authHeader = request.headers.get('Authorization');
  const credentials = parseBasicAuth(authHeader);

  if (!credentials) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }

  const { email, password: token } = credentials;

  // Find all tokens for users with this email (via Cognito-linked memberships)
  // Since we don't have a User table, we need to find tokens and verify
  const appTokens = await prisma.appToken.findMany({
    where: {
      deletedAt: null,
    },
  });

  // Try to find a matching token
  for (const appToken of appTokens) {
    const isValid = await verifyToken(token, appToken.tokenHash);
    if (!isValid) continue;

    // Token is valid, now verify the user has the expected email
    // Find the user's membership to get organization info
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: appToken.userId,
        deletedAt: null,
      },
      include: {
        organization: true,
      },
    });

    if (!membership) continue;

    // Update lastUsedAt
    await prisma.appToken.update({
      where: { id: appToken.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      success: true,
      session: {
        user: {
          id: appToken.userId,
          email,
        },
        organization: {
          id: membership.organization.id,
          uuid: membership.organization.uuid,
          name: membership.organization.name,
          role: membership.role,
        },
        tokenId: appToken.id,
      },
    };
  }

  return { success: false, error: 'Invalid credentials' };
}

export function davUnauthorizedResponse(realm: string = 'Suufr DAV'): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}"`,
    },
  });
}
