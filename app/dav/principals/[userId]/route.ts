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

  const href = `/dav/principals/${userId}/`;

  const props: Record<string, unknown> = {};

  if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
    props['D:resourcetype'] = { 'D:principal': '' };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('displayname')) {
    props['D:displayname'] = session.user.email;
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('principal-URL')) {
    props['D:principal-URL'] = { 'D:href': href };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('calendar-home-set')) {
    props['C:calendar-home-set'] = {
      'D:href': `/dav/calendars/${userId}/`,
    };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('addressbook-home-set')) {
    props['CARD:addressbook-home-set'] = {
      'D:href': `/dav/addressbooks/${userId}/`,
    };
  }

  return multistatusResponse([
    {
      href,
      status: 200,
      props,
    },
  ]);
}
