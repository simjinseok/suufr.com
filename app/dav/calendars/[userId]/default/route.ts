import { NextRequest } from 'next/server';

import prisma from '@/utils/prisma';
import { validateDavAuth, davUnauthorizedResponse } from '@/lib/dav/auth';
import { parsePropfind, parseReport, multistatusResponse, type MultistatusResponse } from '@/lib/dav/xml';
import { sessionToIcal } from '@/lib/dav/ical';
import { generateEtag } from '@/lib/dav/etag';
import { DAV_CAPABILITIES, CONTENT_TYPES } from '@/lib/dav/constants';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      Allow: 'OPTIONS, PROPFIND, REPORT',
      DAV: `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.CALENDAR_ACCESS}`,
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

  const href = `/dav/calendars/${userId}/default/`;

  const calendarProps: Record<string, unknown> = {};

  if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
    calendarProps['D:resourcetype'] = {
      'D:collection': '',
      'C:calendar': '',
    };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('displayname')) {
    calendarProps['D:displayname'] = `${session.organization.name} 수업`;
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('calendar-description')) {
    calendarProps['C:calendar-description'] = '스프 수업 일정';
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('supported-calendar-component-set')) {
    calendarProps['C:supported-calendar-component-set'] = {
      'C:comp': { '@_name': 'VEVENT' },
    };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('getctag')) {
    const latestSession = await prisma.session.findFirst({
      where: {
        lesson: {
          student: {
            organizationId: session.organization.id,
          },
        },
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    calendarProps['CS:getctag'] = latestSession
      ? `"${latestSession.updatedAt.getTime()}"`
      : '"0"';
  }

  const responses: MultistatusResponse[] = [
    {
      href,
      status: 200,
      props: calendarProps,
    },
  ];

  // If depth is 1, include all sessions
  if (depth === '1') {
    const sessions = await prisma.session.findMany({
      where: {
        lesson: {
          student: {
            organizationId: session.organization.id,
          },
        },
        deletedAt: null,
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
    });

    for (const s of sessions) {
      const eventHref = `/dav/calendars/${userId}/default/${s.uuid}.ics`;
      const eventProps: Record<string, unknown> = {};

      if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
        eventProps['D:resourcetype'] = '';
      }

      if (propfindRequest.allprop || propfindRequest.props?.includes('getcontenttype')) {
        eventProps['D:getcontenttype'] = CONTENT_TYPES.CALENDAR;
      }

      if (propfindRequest.allprop || propfindRequest.props?.includes('getetag')) {
        eventProps['D:getetag'] = generateEtag(s.id, s.updatedAt);
      }

      responses.push({
        href: eventHref,
        status: 200,
        props: eventProps,
      });
    }
  }

  return multistatusResponse(responses);
}

export async function REPORT(
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
  const report = parseReport(body);

  let sessions;

  if (report.type === 'calendar-multiget' && report.hrefs?.length) {
    const uuids = report.hrefs.map((href) => {
      const match = href.match(/([^/]+)\.ics$/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];

    sessions = await prisma.session.findMany({
      where: {
        uuid: { in: uuids },
        lesson: {
          student: {
            organizationId: session.organization.id,
          },
        },
        deletedAt: null,
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
    });
  }
  else {
    sessions = await prisma.session.findMany({
      where: {
        lesson: {
          student: {
            organizationId: session.organization.id,
          },
        },
        deletedAt: null,
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  const responses: MultistatusResponse[] = sessions.map((s) => {
    const eventHref = `/dav/calendars/${userId}/default/${s.uuid}.ics`;
    const eventProps: Record<string, unknown> = {};

    if (report.props?.includes('getetag')) {
      eventProps['D:getetag'] = generateEtag(s.id, s.updatedAt);
    }

    if (report.props?.includes('calendar-data')) {
      eventProps['C:calendar-data'] = sessionToIcal(s);
    }

    return {
      href: eventHref,
      status: 200,
      props: eventProps,
    };
  });

  return multistatusResponse(responses);
}
