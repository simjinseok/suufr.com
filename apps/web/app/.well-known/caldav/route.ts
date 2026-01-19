import { NextRequest } from 'next/server';
import { DAV_CAPABILITIES } from '@/lib/dav/constants';

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      Allow: 'OPTIONS, GET, PROPFIND',
      DAV: `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.CALENDAR_ACCESS}`,
    },
  });
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/dav/`, 301);
}

export function PROPFIND(request: NextRequest) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/dav/`, 301);
}
