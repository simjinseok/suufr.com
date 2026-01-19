import { NextRequest } from 'next/server';

import prisma from '@/utils/prisma';
import { validateDavAuth, davUnauthorizedResponse } from '@/lib/dav/auth';
import { sessionToIcal, parseIcal } from '@/lib/dav/ical';
import { generateEtag, compareEtag } from '@/lib/dav/etag';
import { CONTENT_TYPES } from '@/lib/dav/constants';

type Params = Promise<{ userId: string; uid: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { userId, uid } = await params;

  const sessionUuid = uid.replace(/\.ics$/, '');

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session: davSession } = authResult;

  if (davSession.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const session = await prisma.session.findFirst({
    where: {
      uuid: sessionUuid,
      lesson: {
        student: {
          organizationId: davSession.organization.id,
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

  if (!session) {
    return new Response('Not Found', { status: 404 });
  }

  const etag = generateEtag(session.id, session.updatedAt);
  const icalData = sessionToIcal(session);

  return new Response(icalData, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES.CALENDAR,
      'ETag': etag,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { userId, uid } = await params;

  const sessionUuid = uid.replace(/\.ics$/, '');

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session: davSession } = authResult;

  if (davSession.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.text();
  const icalData = parseIcal(body);

  const existingSession = await prisma.session.findFirst({
    where: {
      uuid: sessionUuid,
      lesson: {
        student: {
          organizationId: davSession.organization.id,
        },
      },
      deletedAt: null,
    },
  });

  const ifMatch = request.headers.get('If-Match');
  if (existingSession && ifMatch) {
    const currentEtag = generateEtag(existingSession.id, existingSession.updatedAt);
    if (!compareEtag(ifMatch, currentEtag)) {
      return new Response('Precondition Failed', { status: 412 });
    }
  }

  const ifNoneMatch = request.headers.get('If-None-Match');
  if (!existingSession && ifNoneMatch !== '*') {
    return new Response('Not Found', { status: 404 });
  }

  if (existingSession) {
    const updatedSession = await prisma.session.update({
      where: { id: existingSession.id },
      data: {
        notes: icalData.description ?? existingSession.notes,
        sessionAt: icalData.dtstart ?? existingSession.sessionAt,
        duration: icalData.duration ?? existingSession.duration,
      },
    });

    const etag = generateEtag(updatedSession.id, updatedSession.updatedAt);

    return new Response(null, {
      status: 204,
      headers: {
        'ETag': etag,
      },
    });
  }

  return new Response('Not Found', { status: 404 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { userId, uid } = await params;

  const sessionUuid = uid.replace(/\.ics$/, '');

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session: davSession } = authResult;

  if (davSession.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const existingSession = await prisma.session.findFirst({
    where: {
      uuid: sessionUuid,
      lesson: {
        student: {
          organizationId: davSession.organization.id,
        },
      },
      deletedAt: null,
    },
  });

  if (!existingSession) {
    return new Response('Not Found', { status: 404 });
  }

  const ifMatch = request.headers.get('If-Match');
  if (ifMatch) {
    const currentEtag = generateEtag(existingSession.id, existingSession.updatedAt);
    if (!compareEtag(ifMatch, currentEtag)) {
      return new Response('Precondition Failed', { status: 412 });
    }
  }

  await prisma.session.update({
    where: { id: existingSession.id },
    data: { deletedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}
