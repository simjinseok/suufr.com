import { Injectable } from '@nestjs/common';

interface PropfindProperty {
  name: string;
  namespace?: string;
  value?: string;
  attributes?: Record<string, string>;
  children?: PropfindProperty[];
}

interface PropfindResponse {
  href: string;
  status: number;
  properties: PropfindProperty[];
}

@Injectable()
export class CaldavXmlBuilderService {
  // XML Namespaces for CalDAV
  // @see RFC 4791 (CalDAV), RFC 4918 (WebDAV), Apple/CalendarServer extensions
  private readonly DAV_NS = 'DAV:';
  private readonly CALDAV_NS = 'urn:ietf:params:xml:ns:caldav';
  private readonly CS_NS = 'http://calendarserver.org/ns/';
  private readonly APPLE_NS = 'http://apple.com/ns/ical/';

  buildMultistatus(responses: PropfindResponse[]): string {
    const responseElements = responses
      .map(r => this.buildResponse(r))
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="${this.DAV_NS}" xmlns:C="${this.CALDAV_NS}" xmlns:CS="${this.CS_NS}" xmlns:A="${this.APPLE_NS}">
${responseElements}
</D:multistatus>`;
  }

  private buildResponse(response: PropfindResponse): string {
    const propElements = response.properties
      .map(p => this.buildProperty(p))
      .join('\n        ');

    const statusText = response.status === 200 ? 'HTTP/1.1 200 OK' : `HTTP/1.1 ${response.status}`;

    return `  <D:response>
    <D:href>${this.escapeXml(response.href)}</D:href>
    <D:propstat>
      <D:prop>
        ${propElements}
      </D:prop>
      <D:status>${statusText}</D:status>
    </D:propstat>
  </D:response>`;
  }

  private buildProperty(prop: PropfindProperty): string {
    const prefix = this.getPrefix(prop.namespace);
    const tagName = `${prefix}:${prop.name}`;

    let attrStr = '';
    if (prop.attributes) {
      attrStr = Object.entries(prop.attributes)
        .map(([key, val]) => ` ${key}="${this.escapeXml(val)}"`)
        .join('');
    }

    if (prop.children && prop.children.length > 0) {
      const childElements = prop.children
        .map(c => this.buildProperty(c))
        .join('');
      return `<${tagName}${attrStr}>${childElements}</${tagName}>`;
    }

    if (prop.value !== undefined) {
      return `<${tagName}${attrStr}>${this.escapeXml(prop.value)}</${tagName}>`;
    }

    return `<${tagName}${attrStr}/>`;
  }

  private getPrefix(namespace?: string): string {
    switch (namespace) {
      case this.CALDAV_NS:
        return 'C';
      case this.CS_NS:
        return 'CS';
      case this.APPLE_NS:
        return 'A';
      case this.DAV_NS:
      default:
        return 'D';
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  buildPrincipalProps(userId: string, displayName: string): PropfindProperty[] {
    return [
      { name: 'resourcetype', children: [{ name: 'principal' }] },
      { name: 'displayname', value: displayName },
      {
        name: 'calendar-home-set',
        namespace: this.CALDAV_NS,
        children: [
          { name: 'href', value: `/caldav/principals/${userId}/calendars/` },
        ],
      },
      {
        name: 'current-user-principal',
        children: [
          { name: 'href', value: `/caldav/principals/${userId}/` },
        ],
      },
      {
        name: 'principal-URL',
        children: [
          { name: 'href', value: `/caldav/principals/${userId}/` },
        ],
      },
      {
        name: 'supported-report-set',
        children: [
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'calendar-query', namespace: this.CALDAV_NS }] }] },
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'calendar-multiget', namespace: this.CALDAV_NS }] }] },
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'sync-collection' }] }] },
        ],
      },
    ];
  }

  buildCalendarHomeProps(userId: string): PropfindProperty[] {
    return [
      {
        name: 'resourcetype',
        children: [{ name: 'collection' }],
      },
      {
        name: 'current-user-principal',
        children: [
          { name: 'href', value: `/caldav/principals/${userId}/` },
        ],
      },
    ];
  }

  buildCalendarProps(userId: string, displayName: string, ctag: string, syncToken: string): PropfindProperty[] {
    return [
      {
        name: 'resourcetype',
        children: [
          { name: 'collection' },
          { name: 'calendar', namespace: this.CALDAV_NS },
        ],
      },
      { name: 'displayname', value: displayName },
      { name: 'calendar-description', namespace: this.CALDAV_NS, value: 'Calendar for lesson sessions' },
      { name: 'getctag', namespace: this.CS_NS, value: ctag },
      { name: 'sync-token', value: syncToken },
      { name: 'calendar-color', namespace: this.APPLE_NS, value: '#5856D6FF' },
      {
        name: 'supported-calendar-component-set',
        namespace: this.CALDAV_NS,
        children: [
          {
            name: 'comp',
            namespace: this.CALDAV_NS,
            attributes: { name: 'VEVENT' },
          },
        ],
      },
      {
        name: 'supported-calendar-data',
        namespace: this.CALDAV_NS,
        children: [
          {
            name: 'calendar-data',
            namespace: this.CALDAV_NS,
            attributes: { 'content-type': 'text/calendar', 'version': '2.0' },
          },
        ],
      },
      {
        name: 'supported-report-set',
        children: [
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'calendar-query', namespace: this.CALDAV_NS }] }] },
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'calendar-multiget', namespace: this.CALDAV_NS }] }] },
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'sync-collection' }] }] },
        ],
      },
      {
        name: 'current-user-privilege-set',
        children: [
          { name: 'privilege', children: [{ name: 'read' }] },
          { name: 'privilege', children: [{ name: 'write' }] },
          { name: 'privilege', children: [{ name: 'write-content' }] },
          { name: 'privilege', children: [{ name: 'read-current-user-privilege-set' }] },
        ],
      },
    ];
  }

  buildEventProps(href: string, etag: string, updatedAt?: Date, createdAt?: Date, icalData?: string): PropfindProperty[] {
    const props: PropfindProperty[] = [
      { name: 'resourcetype' },
      { name: 'getetag', value: etag },
      { name: 'getcontenttype', value: 'text/calendar; charset=utf-8; component=VEVENT' },
    ];

    if (updatedAt) {
      props.push({ name: 'getlastmodified', value: updatedAt.toUTCString() });
    }
    if (createdAt) {
      props.push({ name: 'creationdate', value: createdAt.toISOString() });
    }

    props.push({
      name: 'current-user-privilege-set',
      children: [
        { name: 'privilege', children: [{ name: 'read' }] },
        { name: 'privilege', children: [{ name: 'write' }] },
        { name: 'privilege', children: [{ name: 'write-content' }] },
        { name: 'privilege', children: [{ name: 'read-current-user-privilege-set' }] },
      ],
    });

    if (icalData) {
      props.push({
        name: 'calendar-data',
        namespace: this.CALDAV_NS,
        value: icalData,
      });
    }

    return props;
  }

  buildMultigetResponse(events: Array<{ href: string; etag: string; updatedAt?: Date; createdAt?: Date; icalData: string }>): string {
    const responses: PropfindResponse[] = events.map(event => ({
      href: event.href,
      status: 200,
      properties: this.buildEventProps(event.href, event.etag, event.updatedAt, event.createdAt, event.icalData),
    }));

    return this.buildMultistatus(responses);
  }

  buildSyncCollectionResponse(
    changed: Array<{ href: string; etag: string }>,
    deleted: string[],
    newSyncToken: string,
  ): string {
    const responseElements: string[] = [];

    for (const event of changed) {
      responseElements.push(`  <D:response>
    <D:href>${this.escapeXml(event.href)}</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>${this.escapeXml(event.etag)}</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`);
    }

    for (const href of deleted) {
      responseElements.push(`  <D:response>
    <D:href>${this.escapeXml(href)}</D:href>
    <D:status>HTTP/1.1 404 Not Found</D:status>
  </D:response>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="${this.DAV_NS}" xmlns:C="${this.CALDAV_NS}" xmlns:CS="${this.CS_NS}">
${responseElements.join('\n')}
  <D:sync-token>${this.escapeXml(newSyncToken)}</D:sync-token>
</D:multistatus>`;
  }
}
