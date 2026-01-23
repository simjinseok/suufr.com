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
export class XmlBuilderService {
  private readonly DAV_NS = 'DAV:';
  private readonly CARDDAV_NS = 'urn:ietf:params:xml:ns:carddav';
  private readonly CS_NS = 'http://calendarserver.org/ns/';

  /**
   * Build a PROPFIND multistatus response
   */
  buildMultistatus(responses: PropfindResponse[]): string {
    const responseElements = responses
      .map(r => this.buildResponse(r))
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="${this.DAV_NS}" xmlns:C="${this.CARDDAV_NS}" xmlns:CS="${this.CS_NS}">
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

    // Build attributes string
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
      case this.CARDDAV_NS:
        return 'C';
      case this.CS_NS:
        return 'CS';
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

  /**
   * Build properties for the principal resource
   */
  buildPrincipalProps(userId: string, displayName: string): PropfindProperty[] {
    return [
      { name: 'resourcetype', children: [{ name: 'principal' }] },
      { name: 'displayname', value: displayName },
      {
        name: 'addressbook-home-set',
        namespace: this.CARDDAV_NS,
        children: [
          { name: 'href', value: `/carddav/principals/${userId}/contacts/` },
        ],
      },
      {
        name: 'current-user-principal',
        children: [
          { name: 'href', value: `/carddav/principals/${userId}/` },
        ],
      },
      {
        name: 'principal-URL',
        children: [
          { name: 'href', value: `/carddav/principals/${userId}/` },
        ],
      },
      {
        name: 'supported-report-set',
        children: [
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'addressbook-multiget', namespace: this.CARDDAV_NS }] }] },
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'sync-collection' }] }] },
        ],
      },
    ];
  }

  /**
   * Build properties for the address book collection
   */
  buildAddressBookProps(userId: string, displayName: string, ctag: string, syncToken: string): PropfindProperty[] {
    return [
      {
        name: 'resourcetype',
        children: [
          { name: 'collection' },
          { name: 'addressbook', namespace: this.CARDDAV_NS },
        ],
      },
      { name: 'displayname', value: displayName },
      { name: 'getctag', namespace: this.CS_NS, value: ctag },
      { name: 'sync-token', value: syncToken },
      {
        name: 'supported-address-data',
        namespace: this.CARDDAV_NS,
        children: [
          {
            name: 'address-data-type',
            namespace: this.CARDDAV_NS,
            attributes: { 'content-type': 'text/vcard', 'version': '3.0' },
          },
        ],
      },
      {
        name: 'supported-report-set',
        children: [
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'addressbook-multiget', namespace: this.CARDDAV_NS }] }] },
          { name: 'supported-report', children: [{ name: 'report', children: [{ name: 'sync-collection' }] }] },
        ],
      },
      {
        name: 'current-user-privilege-set',
        children: [
          { name: 'privilege', children: [{ name: 'read' }] },
          { name: 'privilege', children: [{ name: 'write-content' }] },
          { name: 'privilege', children: [{ name: 'read-current-user-privilege-set' }] },
        ],
      },
    ];
  }

  /**
   * Build properties for an individual contact
   */
  buildContactProps(href: string, etag: string, vcardData?: string): PropfindProperty[] {
    const props: PropfindProperty[] = [
      { name: 'resourcetype' },
      { name: 'getetag', value: etag },
      { name: 'getcontenttype', value: 'text/vcard; charset=utf-8' },
      // Privileges: read + write-content only (no create/delete)
      {
        name: 'current-user-privilege-set',
        children: [
          { name: 'privilege', children: [{ name: 'read' }] },
          { name: 'privilege', children: [{ name: 'write-content' }] },
          { name: 'privilege', children: [{ name: 'read-current-user-privilege-set' }] },
        ],
      },
    ];

    if (vcardData) {
      props.push({
        name: 'address-data',
        namespace: this.CARDDAV_NS,
        value: vcardData,
      });
    }

    return props;
  }

  /**
   * Build addressbook-multiget response
   */
  buildMultigetResponse(contacts: Array<{ href: string; etag: string; vcardData: string }>): string {
    const responses: PropfindResponse[] = contacts.map(contact => ({
      href: contact.href,
      status: 200,
      properties: this.buildContactProps(contact.href, contact.etag, contact.vcardData),
    }));

    return this.buildMultistatus(responses);
  }

  /**
   * Build sync-collection response
   */
  buildSyncCollectionResponse(
    changed: Array<{ href: string; etag: string }>,
    deleted: string[],
    newSyncToken: string,
  ): string {
    const responseElements: string[] = [];

    // Changed/new contacts
    for (const contact of changed) {
      responseElements.push(`  <D:response>
    <D:href>${this.escapeXml(contact.href)}</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>${this.escapeXml(contact.etag)}</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`);
    }

    // Deleted contacts
    for (const href of deleted) {
      responseElements.push(`  <D:response>
    <D:href>${this.escapeXml(href)}</D:href>
    <D:status>HTTP/1.1 404 Not Found</D:status>
  </D:response>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="${this.DAV_NS}" xmlns:C="${this.CARDDAV_NS}" xmlns:CS="${this.CS_NS}">
${responseElements.join('\n')}
  <D:sync-token>${this.escapeXml(newSyncToken)}</D:sync-token>
</D:multistatus>`;
  }
}
