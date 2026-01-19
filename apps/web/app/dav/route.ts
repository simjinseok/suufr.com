import { NextRequest } from 'next/server';

import { validateDavAuth, davUnauthorizedResponse } from '@/lib/dav/auth';
import { parsePropfind, multistatusResponse } from '@/lib/dav/xml';
import { DAV_CAPABILITIES } from '@/lib/dav/constants';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      Allow: 'OPTIONS, PROPFIND',
      DAV: `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.CALENDAR_ACCESS}, ${DAV_CAPABILITIES.ADDRESSBOOK}`,
    },
  });
}

export async function PROPFIND(request: NextRequest) {
  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session } = authResult;
  const body = await request.text();
  const propfindRequest = parsePropfind(body);

  const href = '/dav/';

  const props: Record<string, unknown> = {};

  if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
    props['D:resourcetype'] = { 'D:collection': '' };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('current-user-principal')) {
    props['D:current-user-principal'] = {
      'D:href': `/dav/principals/${session.user.id}/`,
    };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('displayname')) {
    props['D:displayname'] = 'Suufr DAV';
  }

  return multistatusResponse([
    {
      href,
      status: 200,
      props,
    },
  ]);
}
