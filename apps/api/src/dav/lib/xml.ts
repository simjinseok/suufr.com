import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { NS } from './constants';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: false,
});

export type PropfindRequest = {
  allprop?: boolean;
  propname?: boolean;
  props?: string[];
};

export type ReportRequest = {
  type: 'calendar-query' | 'calendar-multiget' | 'addressbook-query' | 'addressbook-multiget';
  props?: string[];
  hrefs?: string[];
};

export function parsePropfind(xml: string): PropfindRequest {
  if (!xml || xml.trim() === '') {
    return { allprop: true };
  }

  const parsed = parser.parse(xml);
  const propfind = parsed['D:propfind'] || parsed['d:propfind'] || parsed['propfind'] || {};

  if (propfind['D:allprop'] || propfind['d:allprop'] || propfind['allprop']) {
    return { allprop: true };
  }

  if (propfind['D:propname'] || propfind['d:propname'] || propfind['propname']) {
    return { propname: true };
  }

  const prop = propfind['D:prop'] || propfind['d:prop'] || propfind['prop'] || {};
  const props = Object.keys(prop).map((key) => {
    // Remove namespace prefix
    const colonIndex = key.indexOf(':');
    return colonIndex > -1 ? key.slice(colonIndex + 1) : key;
  });

  return { props };
}

export function parseReport(xml: string): ReportRequest {
  const parsed = parser.parse(xml);

  // Calendar query
  if (parsed['C:calendar-query'] || parsed['cal:calendar-query']) {
    const query = parsed['C:calendar-query'] || parsed['cal:calendar-query'];
    return {
      type: 'calendar-query',
      props: extractProps(query),
    };
  }

  // Calendar multiget
  if (parsed['C:calendar-multiget'] || parsed['cal:calendar-multiget']) {
    const multiget = parsed['C:calendar-multiget'] || parsed['cal:calendar-multiget'];
    return {
      type: 'calendar-multiget',
      props: extractProps(multiget),
      hrefs: extractHrefs(multiget),
    };
  }

  // Addressbook query
  if (parsed['C:addressbook-query'] || parsed['card:addressbook-query']) {
    const query = parsed['C:addressbook-query'] || parsed['card:addressbook-query'];
    return {
      type: 'addressbook-query',
      props: extractProps(query),
    };
  }

  // Addressbook multiget
  if (parsed['C:addressbook-multiget'] || parsed['card:addressbook-multiget']) {
    const multiget = parsed['C:addressbook-multiget'] || parsed['card:addressbook-multiget'];
    return {
      type: 'addressbook-multiget',
      props: extractProps(multiget),
      hrefs: extractHrefs(multiget),
    };
  }

  return { type: 'calendar-query' };
}

function extractProps(obj: Record<string, unknown>): string[] {
  const prop = obj?.['D:prop'] || obj?.['d:prop'] || obj?.['prop'] || {};
  return Object.keys(prop).map((key) => {
    const colonIndex = key.indexOf(':');
    return colonIndex > -1 ? key.slice(colonIndex + 1) : key;
  });
}

function extractHrefs(obj: Record<string, unknown>): string[] {
  const hrefs: string[] = [];
  const href = obj?.['D:href'] || obj?.['d:href'] || obj?.['href'];

  if (Array.isArray(href)) {
    hrefs.push(...href);
  }
  else if (href) {
    hrefs.push(href as string);
  }

  return hrefs;
}

export type MultistatusResponse = {
  href: string;
  status: number;
  props?: Record<string, unknown>;
  error?: string;
};

export function buildMultistatus(responses: MultistatusResponse[]): string {
  const responseElements = responses.map((r) => {
    if (r.error) {
      return {
        'D:href': r.href,
        'D:status': `HTTP/1.1 ${r.status} ${getStatusText(r.status)}`,
      };
    }

    const propstat: Record<string, unknown>[] = [];

    if (r.props) {
      const foundProps: Record<string, unknown> = {};
      const notFoundProps: string[] = [];

      for (const [key, value] of Object.entries(r.props)) {
        if (value !== undefined) {
          foundProps[key] = value;
        }
        else {
          notFoundProps.push(key);
        }
      }

      if (Object.keys(foundProps).length > 0) {
        propstat.push({
          'D:prop': foundProps,
          'D:status': 'HTTP/1.1 200 OK',
        });
      }

      if (notFoundProps.length > 0) {
        const notFound: Record<string, string> = {};
        for (const prop of notFoundProps) {
          notFound[prop] = '';
        }
        propstat.push({
          'D:prop': notFound,
          'D:status': 'HTTP/1.1 404 Not Found',
        });
      }
    }

    return {
      'D:href': r.href,
      'D:propstat': propstat.length === 1 ? propstat[0] : propstat,
    };
  });

  const multistatus = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    'D:multistatus': {
      '@_xmlns:D': NS.DAV,
      '@_xmlns:C': NS.CALDAV,
      '@_xmlns:CS': NS.CS,
      '@_xmlns:CARD': NS.CARDDAV,
      'D:response': responseElements.length === 1 ? responseElements[0] : responseElements,
    },
  };

  return builder.build(multistatus);
}

function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    207: 'Multi-Status',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    412: 'Precondition Failed',
    500: 'Internal Server Error',
  };
  return statusTexts[status] || 'Unknown';
}
