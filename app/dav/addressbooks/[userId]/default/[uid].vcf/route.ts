import { NextRequest } from 'next/server';

import prisma from '@/utils/prisma';
import { validateDavAuth, davUnauthorizedResponse } from '@/lib/dav/auth';
import { studentToVcard, parseVcard } from '@/lib/dav/vcard';
import { generateEtag, compareEtag } from '@/lib/dav/etag';
import { CONTENT_TYPES } from '@/lib/dav/constants';

type Params = Promise<{ userId: string; uid: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { userId, uid } = await params;

  const studentUuid = uid.replace(/\.vcf$/, '');

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session } = authResult;

  if (session.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const student = await prisma.student.findFirst({
    where: {
      uuid: studentUuid,
      organizationId: session.organization.id,
      deletedAt: null,
    },
  });

  if (!student) {
    return new Response('Not Found', { status: 404 });
  }

  const etag = generateEtag(student.id, student.updatedAt);
  const vcardData = studentToVcard(student);

  return new Response(vcardData, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES.VCARD,
      'ETag': etag,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { userId, uid } = await params;

  const studentUuid = uid.replace(/\.vcf$/, '');

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session } = authResult;

  if (session.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await request.text();
  const vcardData = parseVcard(body);

  const existingStudent = await prisma.student.findFirst({
    where: {
      uuid: studentUuid,
      organizationId: session.organization.id,
      deletedAt: null,
    },
  });

  const ifMatch = request.headers.get('If-Match');
  if (existingStudent && ifMatch) {
    const currentEtag = generateEtag(existingStudent.id, existingStudent.updatedAt);
    if (!compareEtag(ifMatch, currentEtag)) {
      return new Response('Precondition Failed', { status: 412 });
    }
  }

  const ifNoneMatch = request.headers.get('If-None-Match');
  if (!existingStudent && ifNoneMatch !== '*') {
    return new Response('Not Found', { status: 404 });
  }

  if (existingStudent) {
    const updateData: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      notes?: string;
    } = {};

    if (vcardData.name) {
      updateData.name = vcardData.name;
    }

    if (vcardData.phone !== undefined) {
      updateData.phone = vcardData.phone || null;
    }

    if (vcardData.email !== undefined) {
      updateData.email = vcardData.email || null;
    }

    if (vcardData.notes !== undefined) {
      updateData.notes = vcardData.notes;
    }

    const updatedStudent = await prisma.student.update({
      where: { id: existingStudent.id },
      data: updateData,
    });

    const etag = generateEtag(updatedStudent.id, updatedStudent.updatedAt);

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

  const studentUuid = uid.replace(/\.vcf$/, '');

  const authResult = await validateDavAuth(request);
  if (!authResult.success) {
    return davUnauthorizedResponse();
  }

  const { session } = authResult;

  if (session.user.id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const existingStudent = await prisma.student.findFirst({
    where: {
      uuid: studentUuid,
      organizationId: session.organization.id,
      deletedAt: null,
    },
  });

  if (!existingStudent) {
    return new Response('Not Found', { status: 404 });
  }

  const ifMatch = request.headers.get('If-Match');
  if (ifMatch) {
    const currentEtag = generateEtag(existingStudent.id, existingStudent.updatedAt);
    if (!compareEtag(ifMatch, currentEtag)) {
      return new Response('Precondition Failed', { status: 412 });
    }
  }

  await prisma.student.update({
    where: { id: existingStudent.id },
    data: { deletedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}
