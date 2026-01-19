import { NextRequest } from 'next/server';

import { validateDavAuth, davUnauthorizedResponse } from '@/lib/dav/auth';
import { parsePropfind, multistatusResponse, type MultistatusResponse } from '@/lib/dav/xml';
import { DAV_CAPABILITIES } from '@/lib/dav/constants';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      Allow: 'OPTIONS, PROPFIND',
      DAV: `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.ADDRESSBOOK}`,
    },
  });
}

type Params = Promise<{ userId: string }>;

export async function PROPFIND(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { userId } = await params;

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session } = authResult;

  if (session.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.text();
  const propfindRequest = parsePropfind(body);
  const depth = request.headers.get('Depth') || '0';

  const href = `/dav/addressbooks/${userId}/`;

  const homeProps: Record<string, unknown> = {};

  if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
    homeProps['D:resourcetype'] = { 'D:collection': '' };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('displayname')) {
    homeProps['D:displayname'] = '주소록';
  }

  const responses: MultistatusResponse[] = [
    {
      href,
      status: 200,
      props: homeProps,
    },
  ];

  // If depth is 1, include the default addressbook
  if (depth === '1') {
    const addressbookHref = `/dav/addressbooks/${userId}/default/`;
    const addressbookProps: Record<string, unknown> = {};

    if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
      addressbookProps['D:resourcetype'] = {
        'D:collection': '',
        'CARD:addressbook': '',
      };
    }

    if (propfindRequest.allprop || propfindRequest.props?.includes('displayname')) {
      addressbookProps['D:displayname'] = `${session.organization.name} 학생`;
    }

    responses.push({
      href: addressbookHref,
      status: 200,
      props: addressbookProps,
    });
  }

  return multistatusResponse(responses);
}
