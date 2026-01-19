import { NextRequest } from 'next/server';

import prisma from '@/utils/prisma';
import { validateDavAuth, davUnauthorizedResponse } from '@/lib/dav/auth';
import { parsePropfind, parseReport, multistatusResponse, type MultistatusResponse } from '@/lib/dav/xml';
import { studentToVcard } from '@/lib/dav/vcard';
import { generateEtag } from '@/lib/dav/etag';
import { DAV_CAPABILITIES, CONTENT_TYPES } from '@/lib/dav/constants';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      Allow: 'OPTIONS, PROPFIND, REPORT',
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

  const href = `/dav/addressbooks/${userId}/default/`;

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

  if (propfindRequest.allprop || propfindRequest.props?.includes('addressbook-description')) {
    addressbookProps['CARD:addressbook-description'] = '스프 학생 연락처';
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('supported-address-data')) {
    addressbookProps['CARD:supported-address-data'] = {
      'CARD:address-data-type': {
        '@_content-type': 'text/vcard',
        '@_version': '3.0',
      },
    };
  }

  if (propfindRequest.allprop || propfindRequest.props?.includes('getctag')) {
    const latestStudent = await prisma.student.findFirst({
      where: {
        organizationId: session.organization.id,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    addressbookProps['CS:getctag'] = latestStudent
      ? `"${latestStudent.updatedAt.getTime()}"`
      : '"0"';
  }

  const responses: MultistatusResponse[] = [
    {
      href,
      status: 200,
      props: addressbookProps,
    },
  ];

  // If depth is 1, include all students
  if (depth === '1') {
    const students = await prisma.student.findMany({
      where: {
        organizationId: session.organization.id,
        deletedAt: null,
      },
    });

    for (const student of students) {
      const contactHref = `/dav/addressbooks/${userId}/default/${student.uuid}.vcf`;
      const contactProps: Record<string, unknown> = {};

      if (propfindRequest.allprop || propfindRequest.props?.includes('resourcetype')) {
        contactProps['D:resourcetype'] = '';
      }

      if (propfindRequest.allprop || propfindRequest.props?.includes('getcontenttype')) {
        contactProps['D:getcontenttype'] = CONTENT_TYPES.VCARD;
      }

      if (propfindRequest.allprop || propfindRequest.props?.includes('getetag')) {
        contactProps['D:getetag'] = generateEtag(student.id, student.updatedAt);
      }

      responses.push({
        href: contactHref,
        status: 200,
        props: contactProps,
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

  let students;

  if (report.type === 'addressbook-multiget' && report.hrefs?.length) {
    const uuids = report.hrefs.map((href) => {
      const match = href.match(/([^/]+)\.vcf$/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];

    students = await prisma.student.findMany({
      where: {
        uuid: { in: uuids },
        organizationId: session.organization.id,
        deletedAt: null,
      },
    });
  }
  else {
    students = await prisma.student.findMany({
      where: {
        organizationId: session.organization.id,
        deletedAt: null,
      },
    });
  }

  const responses: MultistatusResponse[] = students.map((student) => {
    const contactHref = `/dav/addressbooks/${userId}/default/${student.uuid}.vcf`;
    const contactProps: Record<string, unknown> = {};

    if (report.props?.includes('getetag')) {
      contactProps['D:getetag'] = generateEtag(student.id, student.updatedAt);
    }

    if (report.props?.includes('address-data')) {
      contactProps['CARD:address-data'] = studentToVcard(student);
    }

    return {
      href: contactHref,
      status: 200,
      props: contactProps,
    };
  });

  return multistatusResponse(responses);
}
